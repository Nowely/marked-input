# Phase 2 — make the parse local

Status: needs-info

Blocked by: nothing. Phase 1 (issue 03) landed 2026-08-20 with #291, so this is the only
remaining phase of the pair — and its ground moved under it.

**Four premises of the deleted `incrementalParse` are now dead** (verified at HEAD 2026-08-22):

1. It returned `[...prev.slice(0, lo), ...windowTokens, ...prev.slice(hi + 1).map(shift)]`, built
   from `prev: Token[]` objects **that no longer exist**. The tree holds `TreeNode`s, and the only
   node→token materializer is `tree/__testing__/snapshot.ts`, marked TEST-ONLY and deliberately
   unmemoized.
2. `Parser.hasSegments` — the inert-outside guard's predicate — was deleted with it. `Parser`'s
   whole public surface today is `parse(value)` and `parseRows(value, separator)`; neither takes
   a window.
3. The window snap to root-level TEXT tokens has no anchor in block mode, where roots are
   `RowToken`s (ADR-0009).
4. One of the property spec's three markups, `'__slot__\n\n'`, now throws at construction.

**And the delivery seam does not exist.** `adopt(tree, window, parsed, selectionBefore)` takes
`parsed: readonly (Token | RowToken)[]` — the WHOLE document's roots (`tree/adopt.ts:49-54`). A
windowed parse has nowhere to be delivered. Either adoption gains a windowed-result contract (all
three of its walks change), or the caller reconstitutes a full root list from nodes, which is
O(document) and cancels the win. That is two changes, not one.

**What it buys, by this arc's own table: nothing against a surviving goal.** Phase 2's G1/G2/G3
cells are dashes and its G4 cell reads withdrawn. Speed was measured away 2026-08-19. Schedule
this on correctness and the parser's standing goal, or not at all.

---

Originally blocked by: 03

> **The full record now lives in
> [`docs/scratch/incremental-parser/spec.md`](../../incremental-parser/spec.md)** — the deleted
> implementation, its contract and algorithm, the three defects underneath it, the measured ceiling,
> and the open questions. Read that before this file.
>
> Re-priced 2026-08-18: an incremental parse **does not shorten the pending window**, which was the
> reason it sat in this arc. It stays worth doing on correctness grounds, but it is no longer on the
> path to that goal, and this phase should be scheduled on its own merits rather than as a step here.

Stop re-parsing the whole document on every keystroke.

> **RE-PRICED 2026-08-19.** Speed is no longer a reason: the full re-parse is ~0.41 ms at 1000
> marks, about 3% of a keystroke. But a SOUND windowing predicate has since been found and
> validated over 2.24M chained edits — widen to the neighbours AND up to the parent scope, with a
> frame check at every ancestor. Doubling alone is refuted at up to 35% wrong trees. See §9 of
> [`../../incremental-parser/spec.md`](../../incremental-parser/spec.md) before starting.

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
