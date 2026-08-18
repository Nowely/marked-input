# The incremental parser — everything found, for when we come back

A standing record, not an active plan. Written 2026-08-18 after the parser investigations, so that
resuming does not mean re-deriving.

**Read this first, because it re-prices the whole idea:** an incremental parser does **not** shorten
the pending window. That was the reason it was wanted, and the reason does not hold — see
[§5](#5-what-it-would-actually-buy). It is still worth doing, on the correctness grounds in
[§4](#4-what-blocks-it), just not for that.

## 1. It already existed, and it was deleted

`8685bc69`, 2026-06-13 — `refactor(tokens): delete incrementalParse + property spec; bench keeps the
full-parse tripwire`. 230 lines of implementation and 199 of property spec removed.

It lives on the branch `phase7-first-class-rows-wip`, three hours before that branch's final commit,
with an empty commit body. It went as part of the first-class-Row rework, apparently on the
expectation that a Row would become the unit of incrementality — **not because it failed**.

Recover it with:

```
git show 8685bc69^:packages/core/src/features/tokens/incrementalParse.ts
git show 8685bc69^:packages/core/src/features/tokens/incrementalParse.property.spec.ts
```

That branch is also the only copy of 16 design documents under `docs/superpowers/` (12 362 lines).
Do not delete the branch.

## 2. Its contract, quoted from its own docblock

> the result deep-equals `parser.parse(nextValue)` for ANY document and ANY single edit —
> correctness never depends on incrementality. Every guard below therefore falls back to a full
> parse rather than risk a divergent splice.

That is the right contract and any fresh attempt should keep it: incrementality is an optimisation
that is always allowed to give up, never a second source of truth.

## 3. Its algorithm, and the two hard parts it had already solved

1. Validate the hint against both values — a bogus hint falls back to a full parse.
2. **Window selection.** In PREV coordinates: expand `[hint.start, hint.end]` to enclosing
   top-level token boundaries, widen by one whole token per side, then snap both endpoints outward
   to TEXT tokens. The parse emits a strictly alternating top-level stream (text, mark, …, text,
   empty texts included), so a window with text endpoints splices back into a valid stream.
3. **The inert-outside guard — the genuinely hard part.** Segment pairing is non-local: a closing
   segment pairs with the *nearest unmatched* opening, which can sit arbitrarily far outside any
   bounded window, and a doubling check alone cannot see it. Its conservative rule: every text
   content outside the window — top-level text tokens, plus nested text/value/meta inside outside
   marks — must contain no markup segment at all; otherwise full parse.
4. Reparse `nextValue.slice(windowStart, windowEndPrev + delta)` and shift the resulting positions
   by `+windowStart`, recursively, including slot ranges.
5. **Stabilisation by doubling.** Reparse a window widened by its own width on each side; the
   spliced content of the two windows must be identical over the doubled range. Equal → accept;
   different → adopt the doubled window and retry, at most `MAX_WIDENINGS = 3`, then full parse. A
   window grown to cover the whole document *is* the full parse.
6. Output `[prefix prev tokens (same objects, positions valid), reparsed window tokens, suffix prev
   tokens rebuilt with positions shifted by delta]`; the identity layer reuses ids on top.

It took an `EditHint` from `tokenIdentity`. Today's `Window` in `tree/` is that type's direct
descendant, so the plumbing still exists.

## 4. What blocks it

### It has no caller, and the window is delivered one layer too late

`fold(next, window)` (`tree/valueBoundary.ts:64-70`) **already holds** the edit window and hands it
to `adopt` — while `parseValue(parser, next)` receives only the string. And `adopt` takes the whole
document's tokens (`adopt.ts:40-43`). So even a perfect windowed parse cannot be plugged in until
adoption accepts a windowed result. Measured elsewhere: a row-local parse prototype ran 93x–2515x
faster on the parse itself and had nowhere to deliver it.

### The Row extent is a document-wide chain

`PatternMatcher.resolveSlotLeadingMatches` walks completed matches left to right with a running
boundary from 0, setting each slot-leading match's start to the end of the previous one. While that
holds, **no window is sound** — a Row's start depends on a match that may lie outside it.

Measured, and it fixes the obvious plan: deleting the chain *before* a line-oriented parse lands
makes single-segment slot markups match nothing at all (`'# __slot__'` collapses to content `"# "`
with an empty slot, and every heading body stays plain TEXT). The chain is the only completion
mechanism for that shape under a flat parse. **It must die after, not before.**

### Three parser defects underneath, all measured

- **W5, the representation.** `scanMarkupStructure` drops the empty leading/trailing segment
  (`MarkupDescriptor.ts:102-104` and `:117-119`), so `'# __slot__'` and `'__slot__\n\n'` are
  structurally indistinguishable and `isSlotLeading = segments.length === 1 && hasSlot` answers true
  for both. Consequence is an **ADR-0001 violation**: `['# __slot__']` on `'# one\n# two\n'` gives
  `MARK "# "` then `MARK "one↲# "`, and `toString` returns `"# # one\ntwo\n"`.
  A prototype fix (retain the empty segments, read a declared bit instead of a count) was measured
  green on the whole suite — 74 files, 1467 tests — with **zero blast radius**, which is itself
  evidence that nothing in the tree exercises a marker-only Markup.
- **W1, cross-option literal shadowing.** `SegmentMatcher` sorts every Option's literals
  longest-first into one shared alternation, so one Option's literal deletes another's mark, and it
  is **invariant under registration order**, so a permutation test does not catch it:
  ```
  ['#[__value__]']                             on 'a #[x] b' -> MARK "#[x]"
  ['#[__value__]', '- [__value__] __slot__\n'] on 'a #[x] b' -> plain TEXT
  ['#[__value__]', '- [__value__] __slot__\n'] on 'a #[x]b'  -> MARK "#[x]"
  ```
  The todo Markup contributes `'] '`, which outranks `']'` at offset 5, so the mark never closes.
  There is a **third**, input-dependent mechanism in the same family: a `'\n'`-only Markup kills the
  shipped fence through `resolveSlotLeadingMatches` back-dating a start plus `Match.conflictsWith`
  rejecting the overlap. Attacking only the length sort fixes two of the three.
- **`TreeBuilder` consults `conflictsWith` against `lastAcceptedMatch` only**, producing a child
  whose range ends past its parent and a TEXT token with start > end, and a broken round trip — 6 of
  47040 in one measured sweep.

### What in the deleted implementation is now stale

- Its window snapped endpoints to **root-level TEXT tokens**; some candidate Row designs abolish
  those, so the snap has no anchor.
- Its inert-outside guard is stated over **segments**. If the break stops being a segment — which is
  the direction the separator work points — a break outside the window can move a boundary inside
  it and the guard will not see it.
- It predates tree-as-truth ([ADR-0001](../../adr/0001-tree-as-source-of-truth.md)), one address
  space ([ADR-0003](../../adr/0003-one-address-space.md)) and the `Pairing`
  ([ADR-0007](../../adr/0007-row-identity-travels-with-the-row.md)). **Do not port it; read it.**

## 5. What it would actually buy

**It does not shorten the pending window, and that matters most.** The window is between the commit
and the bind: core commits → the framework renders → `rendered()` → bind. The parse happens *before*
the commit, entirely on the synchronous side. Proven: the paint is asynchronous in both adapters, no
`flushSync` exists anywhere in the repo, React's bump reaches `useSyncExternalStore` on a microtask
and Vue's reaches a queued render effect; five assertions in `commitPipeline.spec.ts` pin the window.
While the frameworks own the document DOM ([ADR-0007](../../adr/0007-row-identity-travels-with-the-row.md)),
some fail-closed window is irreducible.

Also narrower than it sounds: **the pending window only exists for structural commits.** A text
keystroke routes around it entirely — `apply` with `render === false` only announces, and the DOM is
written by the per-Surface effect, at zero component renders.

**The measured ceiling.** One keystroke at 500 rows decomposes as parse 42%, `joinNodes` **30%**,
`filterEmptyText` 2%, adopt + splice 25%. With a *free* parser the keystroke improves **1.68x /
1.87x / 1.91x** at 100 / 500 / 2000 rows — `joinNodes` and the eager position rewrite are both
Θ(document) and neither is touched by parsing.

**The absolute numbers are small.** `Parser.parse` at 500 rows / ~20 KB: 0.10 ms (paragraph option
set), 0.19 ms (todo set). The whole keystroke path is ~0.25 ms at 500 rows.

**The one real frame-budget miss is something else.** A two-value inline Markup that actually
matches — `'<__value__>__meta__</__value__>'`, one tag per row — costs **8.5 ms at 800 rows** and
grows 5.53x for 2x rows. That is `SegmentMatcher`'s overlap filter, which is O(static × dynamic) and
**inert for row markups** (they are all static, so the filter is a linear copy plus a sort) but bites
hard as soon as a dynamic Markup matches. If the goal is latency, this is the cheapest real win in
the whole investigation, and it has nothing to do with incrementality.

## 6. There is no baseline

`packages/core/src/features/tokens/parser.bench.result.json` holds 18 entries: the newest is
2026-06-12, the other seventeen are from November 2025 in an older format, and the file was last
touched in #267 — before the current architecture. The bench also contains **no row markup at all**,
so there was never a row baseline to be stale. Any efficiency claim establishes its own baseline
first; that measurement is step one of any resumption, not its reporting.

## 7. Open questions for whoever resumes

- Does the inert-outside guard degenerate on mark-rich documents? It bails whenever text outside the
  window contains any markup segment; how often that fires on a real document was never measured.
- Can the window be derived from the **tree** — token boundaries are known — instead of from a
  string diff? That was never tried and it is the obvious question given tree-as-truth.
- Adoption under a changed root shape: nobody drove `adopt` when root-level text tokens are absent,
  and the alternating text/mark root invariant is what the window snap leaned on.
- Does an incremental parse interact with the `Pairing` that carries row identity through a reorder?
  Unexamined.

## 8. If the goal is the pending window, do these instead

None of them touch the parser.

- `pending()` has **exactly one** production consumer — the guard in `TokenModel.ts:61` — and the
  window's only externally visible effect is `handle(id)` answering `undefined`. The blast radius of
  changing it is one line.
- markput has **no flush-and-read escape hatch**; Lexical's `editor.read(cb)` defaults to
  `'force-commit'`, committing before it reads. It is the one idea from the analog survey shaped like
  something markput lacks rather than something it rejected.
- Making staleness **unrepresentable rather than latched** — a handle carrying its generation, so a
  stale read is an obviously dead object rather than a flag consulted at one site.
- Slate, the only analog whose DOM is framework-rendered, has the same window and answers with a
  **throw** at the resolver, with the latch bolted on beside it at four opt-in sites. markput's
  fail-closed read was judged better on centrality, phase alignment and default direction — so the
  goal is to make the window unfelt, not to adopt someone else's answer.
