# `rowSelectionText`'s original-vs-clamped distinction: delete it or pin it

Type: task
Status: resolved — deleted, and the rule it stood for moved onto the span (2026-08-27)
Blocked by: —

## Problem

Round ten wrote a rule, round eleven flagged that nothing exercises it, and the coverage audit
reproduced the flag. `map.md:1220-1224`:

> **WHAT I COULD NOT MAKE REDDEN, stated plainly.** Round ten wrote "the row selection is read from
> the ORIGINAL pair, which is what keeps round nine's refusal". Feeding it the CLAMPED pair instead
> is green over the whole suite AND identical on the running page across six gestures (chip, board
> card and toc entry x type/Backspace). The distinction the comment documents is real in the code
> and unexercised by anything; the code is left as it is and the claim is flagged rather than
> trusted.

`insights.md:373-381` puts it the same way and costs it:

> line 489 feeds `contentSpan` the clamped pair, line 491 asks `rowSelection` the ORIGINAL pair, and
> the comment says that is what keeps round nine's refusal. Feeding it the clamped pair is
> **2232/2232 green** and identical on the running page across six gestures. … **Cost:** one line,
> and a maintainer's word — doctrine A.8's "zero callers is not dead code" does not apply (this is
> internal, not published), but doctrine E.6's "does your pin redden" says a distinction nothing can
> exercise is not a distinction. Two reads with no measurable difference are a deletion candidate,
> not a pin.

Verified at `52ef65ae`, `packages/core/src/features/tokens/seam/TokenModel.ts:488-499`: the two
reads are still there and still differ — `contentSpan(…, this.#offBlockInterior(anchors))` at
`:489`, `this.rowSelection(anchors)` at `:491`.

## Why it matters here

`insights.md:221-227` counts six decorative pins this effort shipped, and one of them *"asserted the
defect itself as the contract"*. An unexercised distinction is the same hazard one layer down: it
reads as load-bearing and nothing proves it is.

## The fork

Either a pin that reddens when the clamped pair is fed to `rowSelection`, or the deletion. Not both,
and not neither. Note the counter-example the record insists on (`insights.md:216-220`):
`#enterRow`'s `into === 0` fork was ALSO green when deleted and turned out to be load-bearing, found
by a probe that typed a character rather than asserting an offset — so a probe belongs before the
deletion.

## Answer

**The distinction IS exercisable, and the case that discriminates it shows the ORIGINAL read letting
a typed character delete a frozen row.** Measured on `'aa⏎@card panel⏎```js⏎code⏎```'` with the card
painting none of its text, sweeping from `aa`'s start into the middle of `code` and typing once:

- the RAW pair holds no row whole — `store.rows.selected()` is empty, it is an ordinary text
  selection — so the refusal was vacuous;
- `#offBlockInterior` pulls the far edge back to the fence's own boundary, because an edge inside a
  raw body from outside the row names the ROW;
- the span that resolves from covers `aa` and the frozen card whole, and one `'Z'` emitted
  `'Z⏎```js⏎code⏎```'`.

So the comment's stated reason was wrong and its instinct was not. What the raw read actually bore
was the CALLER: `replaceRowSelection` re-derived the same raw reading to decide whether to consume
the key, so the two raw reads had to agree or a refusal fell through to a raw write. Feeding the
clamped pair to the shared refusal was measured first and is worse — Backspace over the same sweep
then cuts the fence open, `'de⏎```'` where it used to emit `'⏎```js⏎code⏎```'`.

The answer is neither pin nor swap. `rowSelectionText` answered two questions with one selection —
which bytes a ranged text edit writes over, and whether that edit is allowed at all — and they are
now two reads. The span is its own answer; `TokenModel.holdsFrozenRow` is the refusal, asked of the
SPAN the typed character is about to write, and the caller consumes structurally rather than
re-deriving anything. The refusal reads OVERLAP where the old one read cover, which is forced: a
click on frozen presentation selects the row across its own element, and the span that resolves from
is the row's own interior, which covers no row at all.

Pins in `rowKeys.spec.ts`, both seen red. Disabling `holdsFrozenRow` reddens the new sweep case with
`expected 'Z⏎```js⏎code⏎```' to be 'aa⏎@card panel⏎```js⏎code⏎```'` AND the round-nine pin
*"CONSUMES the key and leaves the row standing"* with `expected 'before⏎@card a⏎after' to be
'before⏎@card panel⏎after'`, plus three showcase pins in `caret.react.spec`.

**Behaviour change:** typing over a selection whose resolved span reaches any part of a row that
holds no editable position is consumed and refused, where a span that merely overlapped such a row
used to write. The paint, the delete path and every gesture over an exact row cover are unchanged —
measured on the same document, byte for byte.

## Corrected 2026-08-27 — the resolved span alone is not a witness either

Review measured the converse of everything above, and it holds: the resolution ACQUIRES rows the raw
pair never held (which is what this answer is built on) and it also **LOSES rows the raw pair held**.
Two shapes, both reaching the write:

- **A frozen body that is EMPTY.** `rowSelectionText` resolves a click on such a row to a collapsed
  POSITION inside it, and the overlap test is strict on both sides, so a zero-length span against a
  zero-length line overlaps nothing. `'before⏎@card ⏎after'` row-selected and typed over emitted
  `'before⏎@card a⏎after'` — the row not deleted but CORRUPTED, bytes in a body the kind cannot read
  back. A **regression** from this ticket's own answer: the refusal it replaced read `rowSelection`
  over the raw pair, which covers that row whole. Also the ordinary case, since most atomic kinds a
  menu offers carry no `text:` and so are chosen with an empty body (`insights.md:68-78`).
- **A plain cross-row sweep.** From mid-text to mid-text across a frozen row both edges are inside
  content, so `contentSpan` calls it an ordinary text selection and answers `undefined`; the raw pair
  reaches `store.edit.replace`, and `'aa⏎@card panel⏎bb'` swept 1→16 emitted `'aZb'`.
  `holdsFrozenRow` answers `true` for that pair — nothing asked it. Pre-existing, but the sentence
  above states the closed class as *"any part of a row that holds no editable position"*, which this
  refutes.

Both close with one rule and one line: **ask the refusal of EITHER pair** (`5e94e8c0`). Neither is a
witness alone. Two pins added, both seen to redden with the raw read disabled.

Two more readings, recorded because they were chased:

- **Select-all is not this question.** `'aa⏎@card panel'` covered whole and typed over emits `'Z'`,
  and a review read that as the resolved span being clipped off the frozen row. It is not: the write
  never reaches this arm at all — `isAllSelected` replaces the whole value one layer up
  (`input.ts`), which is what Mod+A and a keystroke mean everywhere. Not a defect.
- **`'absent'` is a race, not a verdict.** `holdsFrozenRow` asked `reachable` alone, where every
  sibling reading in the file gates on `rowPaint` first. It mattered less while only the resolved
  span reached it; the raw pair names rows the resolution never touched, so the three-way read went
  in with it (`15b665a7`).
