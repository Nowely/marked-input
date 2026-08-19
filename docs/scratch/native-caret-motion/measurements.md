# What a keystroke actually costs, and how three measurements disagreed

Status: reference

Written after four measurement passes contradicted each other. It records the numbers that
survived, the ones that did not, and — most usefully — **which instruments lie**.

## The one number that matters

A person does not feel milliseconds of script. They feel **dropped frames**. So: edit one
character per animation frame, never force layout from script, and record the gaps between
consecutive frame callbacks. An undisturbed frame on the measuring machine is 8.3 ms (120 Hz).

Flat inline, one `<span>` per token, all in one `contenteditable`:

| spans | median frame | p95 | max | frames > 20 ms |
| --- | --- | --- | --- | --- |
| 100 | 8.3 ms | 9.2 | 9.4 | 0 / 69 |
| 250 | 8.3 ms | 9.3 | 9.4 | 0 / 69 |
| 500 | 8.3 ms | 9.2 | 9.3 | 0 / 69 |
| **1000** | **16.7 ms** | 33.4 | 87.9 | **19 / 69** |
| 1500 | 24.7 ms | 41.2 | 46.7 | 42 / 69 |
| 2000 | 32.5 ms | 50.3 | 55.3 | 57 / 69 |
| 6000 | 91.0 ms | 166.1 | 175.1 | 89 / 89 |
| 20000 | 777 ms | 1366 | 1709 | 89 / 89 |

The same documents with the spans grouped 20 to a block `div`:

| spans | median frame | frames > 20 ms |
| --- | --- | --- |
| 2000 | 8.3 ms | 0 / 89 |
| 6000 | 8.3 ms | 0 / 89 |
| 20000 | 8.3 ms | 0 / 89 |

**Flat inline editing is smooth to ~500 spans and degrades from ~1000. Block structure removes the
cost entirely at every size tested.** In markput terms a mark contributes roughly two tokens, so an
inline field is comfortable to a few hundred marks; block layout, which already renders one block
per Row, never pays this at all.

## Which instruments lied, and by how much

This is the part worth keeping. Four instruments, same document (2000 spans), same edit:

| instrument | reading | verdict |
| --- | --- | --- |
| frame interval while editing once per frame | ~24 ms of added work per frame | **ground truth** |
| vitest bench, mutate + `collapse` in a tight loop | ~73-102 ms per edit | 3-4× too high |
| JS-forced reflow (`void host.offsetHeight`) per edit | ~22 ms per edit | roughly right |
| CDP `Performance.getMetrics` → `LayoutDuration` | **0.59 ms** per keystroke | **~40× too low** |

Two traps, both of which caught this investigation:

- **A tight loop is not typing.** `vitest bench` hammers with no frame between iterations. A person
  types at most one character per frame, and the browser gets to lay out incrementally in between.
  Every absolute figure in `commitCost.bench.ts`, `caretCost.bench.ts` and `layoutCost.bench.ts` is
  a tight-loop figure and reads 2-4× high. Their *ratios* held up against frame-paced measurement;
  their absolutes did not.
- **`LayoutDuration` does not capture what you think.** It reported 0.59 ms per keystroke on a
  document where frames were visibly stretching to 32 ms. Do not use it to decide whether something
  is fast.

A third trap, from an earlier pass: **run benchmarks on an idle machine.** Measuring while
background agents ran browser suites inflated absolutes 5-30% and pushed rme from ~1% to 20-105%.

## What this settled

**Letting the browser insert the character does not help.** Counted with CDP across three
interleaved rounds at 2000 spans, real keyboard input in both arms:

| path | layouts per keystroke | layout ms per keystroke |
| --- | --- | --- |
| native (uncancelled) | 1.00 | 0.56 |
| cancelled, spliced and caret written by script | 1.00 | 0.56 |
| mutate only, no selection write | 1.00 | 0.50 |

The cancelled path does **not** cause a second layout. That was the one mechanism under which
handing the insertion to the browser would have removed work rather than moved it, so
[the proposal](spec.md) is closed and ADR-0006 stands.

**The caret is not the cost.** A bare forced reflow costs what a selection write costs, so the
selection write is only a trigger. And the layout it triggers happens once per frame either way.

**Nothing in `core` is the cost.** At 1000 marks the splice, the full re-parse, adoption's
O(document) suffix rewrite and the whole commit pipeline are together ~0.74 ms. Whatever is worth
changing about them, it is not speed.

## Reproducing

The frame-interval measurement is the one worth keeping. It needs Playwright directly (frame pacing
and CDP are not reachable from the vitest bench harness), so it lives here rather than in
`packages/core`. Run it from the repo root with `node <file>.mjs`.

```js
import {chromium} from 'playwright'

const SPANS = Number(process.env.SPANS ?? 2000)
const FRAMES = Number(process.env.FRAMES ?? 90)

const html = (spans, chunk) => `<!doctype html><html><body style="margin:0">
<div id="host" contenteditable="true" style="font:14px system-ui"></div>
<script>
  const host = document.getElementById('host')
  let block = null
  for (let i = 0; i < ${spans}; i++) {
    if (${chunk} > 0 && i % ${chunk} === 0) { block = document.createElement('div'); host.appendChild(block) }
    const s = document.createElement('span')
    s.appendChild(document.createTextNode('word' + i + ' and more text here '))
    ;(block || host).appendChild(s)
  }
  window.__surface = host.querySelectorAll('span')[${spans} >> 1].firstChild
  host.focus()
  getSelection().collapse(window.__surface, 3)
  window.__frameGaps = (frames, edit) => new Promise(resolve => {
    const gaps = []; let last = null, i = 0
    const step = now => {
      if (last !== null) gaps.push(now - last)
      last = now
      if (edit) {
        window.__surface.replaceData(0, 1, i % 2 ? 'a' : 'b')
        getSelection().collapse(window.__surface, i % 2 ? 3 : 4)
      }
      if (++i >= frames) resolve(gaps); else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
</script></body></html>`

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [label, chunk] of [['flat inline', 0], ['20 per block', 20]]) {
  await page.setContent(html(SPANS, chunk))
  await page.waitForTimeout(400)
  await page.evaluate(() => window.__frameGaps(10, true)) // warm up
  for (const [name, edit] of [['idle', false], ['editing', true]]) {
    const gaps = await page.evaluate(([f, e]) => window.__frameGaps(f, e), [FRAMES, edit])
    const s = gaps.slice().sort((a, b) => a - b)
    console.log(label, name, 'median', s[s.length >> 1].toFixed(1), 'dropped', gaps.filter(g => g > 20).length)
  }
}
await browser.close()
```

The idle control is not optional: without it a 16.7 ms reading cannot be told from a frame-rate cap.
