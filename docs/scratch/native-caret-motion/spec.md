# Let the browser move the caret on the common typing path — CLOSED

Status: wontfix

Reopened, then closed: [ADR-0006](../../adr/0006-beforeinput-guard.md) stands.

## Verdict

**No.** The direction was proposed on the strength of one inference, and the inference was wrong.
The guard stays fail-closed, and there is no latency argument left for changing it.

Kept as a record because the measurements behind it redirect a lot of other work.

## How it got proposed

`commitCost.bench.ts` measured a keystroke at inline 1000 marks (42 KB, 2001 tokens) at ~16-40 ms,
of which the string splice, the full re-parse, adoption's O(document) suffix rewrite and the
entire commit pipeline are **together ~0.74 ms — about 3%**. The other ~97% was the caret.

`caretCost.bench.ts` then isolated the caret outside markput entirely. At 2000 spans a selection
write costs ~80 ms after a DOM mutation and ~0.001 ms on clean layout, at every host size. It is
not frequency (exactly one selection write per keystroke, counted), not locality (dirtying the
caret's own surface costs the same as a far one), and not `contenteditable` (a plain host pays the
same).

That read as: the selection write forces a synchronous layout, so let the browser insert the
character and move the caret inside its own pipeline instead.

## Why it is wrong

**The layout has to happen anyway.** The DOM changed, so it must be laid out before the next
paint. If forcing it early only moves work the frame was going to do, handing the insertion to the
browser changes nothing.

Measured, `layoutCost.bench.ts` at 2000 spans:

| after the same mutation | mean |
| --- | --- |
| `selection.collapse` | 93.0 ms |
| a bare forced reflow (`void host.offsetHeight`) | 89.4 ms |
| nothing — layout left to the frame | 0.0003 ms |

A bare reflow costs what the selection write costs. **The bill is the layout, not the selection.**
`Selection.collapse` is not doing anything special; it forces the layout any layout read would
force, and the browser pays the same bill when it does the insertion itself.

## What the cost actually is

Same 2000 spans, same mutation, same selection write, varying only how the spans are grouped:

| structure | mean | rme |
| --- | --- | --- |
| one flat inline context | 93.0 ms | ±30%, 10 samples |
| 1 span per block | 0.285 ms | ±3.8%, 2457 samples |
| 20 spans per block | 0.049 ms | ±2.2%, 14449 samples |

Three orders of magnitude. The whole cost is that inline layout puts the entire document in **one
inline formatting context**, and editing one character reflows it wholesale. Nothing about markput
is involved — it is a browser property of a flat inline run.

This also explains a number that was sitting in plain sight: `commitCost.bench.ts` reads
block-1000-rows at ~0.8 ms against inline-1000-marks at 16-40 ms **for the same token count**.
Block layout already has the fix by construction, one block per Row.

## Is there anything to do about it?

Probably not, and deliberately so.

Chunking inline content into blocks is **not** available as a fix: a block box breaks the line,
and an inline field has to flow as one paragraph. `display: inline-block` changes line breaking
too. So the structural remedy that works for block layout does not transfer.

But the shape it costs on is a **single 42 KB inline paragraph**, which no realistic inline field
has. At 200 spans the flat arm is 0.62 ms. A mention input, a tag field, a formula line — none of
them approach the size where this appears, and the mode that genuinely holds large documents is
block layout, which is already ~50× cheaper.

So: no action. If a consumer ever does put a 42 KB single paragraph in an inline editor, the honest
answer is that Chromium reflows an inline formatting context wholesale and markput cannot change
that.

## What this closes elsewhere

- **ADR-0006 stands.** The fail-closed guard was never the cost.
- **The conditional-guard idea** — do not cancel, but detect and repair afterwards — is a better
  design than the predictive narrow-case list this file originally proposed, and it stays a good
  idea on its own merits (it is also the only shape that could ever manage composition, which is
  currently unhandled: zero `compositionstart` listeners in core). But it cannot be justified on
  latency, because the latency is not there.
- **EditContext** is not favoured on latency grounds either — a non-editable host pays the same
  forced layout. Its case rests entirely on composition, on deleting the input guard, and on the
  browser never mutating author DOM. Those are real, and they are unaffected by this.
- **No work on the parser, adoption or the commit pipeline can be motivated by speed.** They are
  ~3% of a keystroke. If they are worth changing it is for concept count (G2), which was ranked
  above efficiency from the start — that argument should be made on its own and not borrow a
  performance claim the measurements refute.

## The one improvement that did land

`Selection.collapse` instead of `removeAllRanges()` + `addRange()`, because the two-call form pays
the forced layout twice. ~24% off a keystroke at 100 marks. See
`perf(core): place the caret with Selection.collapse instead of addRange`.

## Cross-check pending

An independent measurement run was in flight when this was written: a markput-free A/B of native
versus cancelled typing, a CDP `LayoutCount`/`LayoutDuration` count per path, and a spike that
actually lets `insertText` through in markput. Its purpose was to answer this same question by
other instruments. If it contradicts the table above — in particular if it finds the cancelled
path lays out **more times** per keystroke than the native one — this verdict has to be revisited,
because that is the one mechanism under which the direction would still pay.
