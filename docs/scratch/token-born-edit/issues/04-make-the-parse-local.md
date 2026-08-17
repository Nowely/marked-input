# Phase 2 — make the parse local

Status: needs-info

Blocked by: 03

Stop re-parsing the whole document on every keystroke.

## The asymmetry to fix

`fold(next, window)` in `tree/valueBoundary.ts` already **holds** the edit window and hands it to
`adopt` — while `parseValue(parser, next)` receives only the string. The information needed to
bound a parse is computed on every commit and delivered one layer too late.

`Parser.parse` then runs three whole-document passes: two global `matchAll` sweeps in
`SegmentMatcher.search`, a sort of every match, and an overlap filter that is
O(static × dynamic) in match count.

## There was one, and it was deleted

`8685bc69`, 2026-06-13, on `phase7-first-class-rows-wip`:
`refactor(tokens): delete incrementalParse + property spec; bench keeps the full-parse tripwire` —
230 lines of implementation and 199 of property spec. The commit body is empty and the commit sits
three hours before that branch's final commit, so it went as part of the first-class-Row rework,
apparently on the expectation that a Row would become the unit of incrementality. Not because it
failed.

Its contract, from its own docblock:

> the result deep-equals `parser.parse(nextValue)` for ANY document and ANY single edit —
> correctness never depends on incrementality. Every guard below therefore falls back to a full
> parse rather than risk a divergent splice.

What it had already solved, and what any fresh attempt would have to re-solve:

- **Window selection.** Expand to enclosing top-level token boundaries, widen by one whole token
  per side, then snap both endpoints outward to TEXT tokens — the parse emits a strictly
  alternating top-level stream, so a window with text endpoints splices back into a valid one.
- **Non-local segment pairing**, the hard part. A closing segment pairs with the *nearest
  unmatched* opening, which can sit arbitrarily far outside any bounded window. Its conservative
  inert-outside rule: every text content outside the window must contain no markup segment at all,
  else full parse.
- **Stabilisation.** Re-parse a window widened by its own width on each side; if the spliced
  content differs, adopt the doubled window and retry, at most three times, then full parse. A
  window grown to the whole document *is* the full parse.
- Suffix positions shifted by the delta.

Today's `Window` in `tree/` is the direct descendant of the `EditHint` it took.

## Why it is blocked by phase 1

While a Row's extent is a document-wide chain, no window is sound: a Row's start depends on a match
that may lie outside it.

## First step

Measure. The same commit that deleted it reduced the bench to a full-parse tripwire, and
`parser.bench.result.json` has been stale since — so nobody knows what it bought. Establish a
baseline at 10 / 100 / 500 rows first, then restore the implementation from
`git show 8685bc69^:packages/core/src/features/tokens/incrementalParse.ts` and measure against it.
Do not port it blindly: it predates the tree-as-truth rewrite.

## Known ceiling

An incremental parse removes **one** of the two O(document) costs per keystroke. The other is the
eager position rewrite — see [issue 05](05-make-the-address-local.md). Until both land, the
keystroke stays O(document) and this phase's win is half.
