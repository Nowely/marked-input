# The edit is born in the Token

An editing arc, not a refactor. Today an edit is born in the Value string and the Token tree
recovers from it afterwards; the goal is to invert that, so editing a Token makes that Token
immediately correct and everything outward is derived.

Agreed with the maintainer 2026-08-18. Four phases, ordered by a dependency argument rather than
by size — each one is what makes the next expressible.

> **RE-PRICED 2026-08-19, and two of this file's own arguments were refuted by measurement.** G4
> is gone as a motivation: at 1000 marks the splice, the full re-parse, adoption's suffix rewrite
> and the whole commit pipeline are together ~0.74 ms, about 3% of a keystroke, and typing stays
> inside a frame up to ~500 inline spans and at every block-layout size tested. The "floor"
> section below is overstated — five of its eight concepts have since been deleted or shown
> removable with a green suite. Numbers, method and the instruments that lied are in
> [`../native-caret-motion/measurements.md`](../native-caret-motion/measurements.md). **Nothing in
> this arc can be justified by speed any more.** It stands or falls on G1, G2 and G3.

## Goals, in priority order

- **G1 — the edit is born in the Token.** The maintainer's own framing: every framework has the
  controlled-component pattern; here the same thing, but per Token. Edit a Token and it is
  correct at once; propagation outward is derived, not written.
- **G2 — fewer concepts** to hold in the head to follow one keystroke end to end.
- **G3 — the Row stops being a stopgap.** One model, with markdown's editor semantics: a line of
  text plus Enter is its own block.
- **G4 — efficiency: no O(document) work per keystroke.** Explicitly ranked below G2 by the
  maintainer, and now **withdrawn**: the O(document) work was measured and is not reachable as a
  performance problem at any document size a user will produce. Keep the goal only in the sense
  that a local edit is easier to reason about; do not spend anything on it for speed.

## Constraints

- The frameworks keep the rendering role; core does not own the document DOM
  ([ADR-0002](../../adr/0002-one-contenteditable-host.md),
  [ADR-0007](../../adr/0007-row-identity-travels-with-the-row.md)). Re-opening either is a new
  decision, not a step in this arc.
- Breaking changes are allowed. The Markup contract, the `Option` shape, the parse algorithm, the
  Row representation and the public API are all in scope.

## The parser's standing goal

Stated by the maintainer 2026-08-18, and it changes what "done" means for anything touching
`parser/`:

> My goal is to create a universal parser, which in theory is able to handle any custom syntax and
> something typical like XML or markdown. While keeping a simple set of markup rules. The current
> parser implementation is a long process of simplifying its logic, where every rule is extremely
> logical, derived, natural. In which there are no specific weights and other hacks.

The success criterion is therefore not speed and not incrementality: **every decision the parser
makes is declared, and none is inferred from a coincidence of shape or from the order in which
Options were registered.**

Measured against that, these are the current violations — the list is what reclassifies the work,
because under this criterion the chain is not "slow", it is a hack, and the length sort is not a
detail, it is a weight that loses data:

| Site | What it is | Consequence |
| --- | --- | --- |
| `SegmentMatcher.ts:88` — statics sorted longest-first into one alternation | priority by literal length | a registered `\n\n` eats another Markup's `\n` terminator; the set `['# __slot__\n\n', '- [__value__] __slot__\n']` loses a whole Row, with no slot-leading Markup involved (measured) |
| `SegmentMatcher.ts:110` — dynamics sorted longest-first | the same weight | not separately measured |
| `PatternMatcher.ts:146` — "relies on processing order to determine which match to keep" | priority by registration order | which of two colliding Options survives depends on array position |
| `PatternMatcher.ts:84-92` — completing states before pending, both LIFO | priority by matcher state | its own docblock calls it "priority" |
| `PatternMatcher.ts:113-137` — `resolveSlotLeadingMatches` | a post-pass repairing one Markup shape | carries `//TODO need review it` at `:43` |
| `isSlotLeading` = `segments.length === 1 && hasSlot` | semantics inferred from a **count** | cannot tell a leading marker from a trailing terminator; a marker-only Markup gives its second occurrence the previous Row's text as its Slot (measured) |

Not everything is like this, and the audit must stay fair: `Match.conflictsWith` is a principled
rule — overlap is permitted only where it is legal nesting, tested through `hasSlot` and the slot
gap. Rules of that kind are semantics and must survive; the table above is accidental priority and
must not.

**The tension, named rather than dodged.** "Any syntax" and "no priority rules" are not jointly
achievable in general: ambiguity is a property of syntaxes, not of parsers — markdown requires a
code span to beat emphasis, XML requires a close to bind to the nearest unmatched open of the same
name. The achievable form of the goal is that priority becomes **local and declared** instead of
**global and implicit**.

**The checkable form**, which does not exist as a test yet: *permuting the Options must not change
the tree.* It is worth landing as a characterisation of what is currently true before any
behaviour changes, together with the open question of what minimal declaration set covers XML,
markdown and arbitrary custom syntax, and where a real grammar becomes unavoidable.

## The floor — what this arc cannot buy

Establishing this first, because it re-aims the whole effort. Eight concepts must be held to
follow one keystroke: `renderEpoch`, the `pendingStructural` latch, the delta accumulator with
exact-id cancellation, the re-entry guard, `bind`'s all-or-nothing frame alignment plus
unbind-vs-kill, the divergence sweep having to be a `changed` subscriber, Vue's two announcement
sites plus its epoch dedupe, and the ordering rules inside the commit batch.

**This section is REFUTED and kept only as a record of the argument.** It claimed four of the
eight were the irreducible invoice for framework-owned DOM, on the strength of an analogy:
`@handlewithcare/react-prosemirror` inverts DOM ownership so React paints, and concepts 1, 2, 5
and 7 reappear there.

The analogy is confounded — that project keeps ProseMirror's single-phase synchronous view
contract *and* its MutationObserver input model *and* has to manufacture identity ProseMirror
lacks, none of which markput has. And the conclusion did not survive contact: three of the eight
have been deleted outright with a green suite, and two more measured removable. Two of the
supposedly irreducible four are the price of *re-deriving a fact the framework already holds*, and
one more is the price of *waiting for a paint the framework never had to announce* — both removed
by [`../consigned-surfaces/spec.md`](../consigned-surfaces/spec.md) without touching DOM
ownership. The honest floor is **one** concept: a post-paint step for the caret on structural
edits, which even the design that took DOM ownership outright still has.

So the commit pipeline IS where a large part of the budget was, and it is being spent. The rows
below are still real and still upstream — but they are reasons of clarity, not of cost:

| What | Why it exists |
| --- | --- |
| `resolveSlotLeadingMatches`' document-wide chain | the marker-less paragraph has nothing to bound it |
| `filterEmptyText`, wired into `tree/valueBoundary.ts` | the same |
| two `isSlotLeading` predicates (`tree/siblings.ts:9`, `keyboard/blockEdit.ts:13`) | the same |
| `gapWindow`, the echo protocol, the `#committed` mirror | [ADR-0001](../../adr/0001-tree-as-source-of-truth.md) names them outright as the price of identity being *recovered* after a splice rather than *preserved* |
| a full re-parse per keystroke | the parser has no windowed entry point (measured: ~0.41 ms at 1000 marks — a clarity problem, not a cost) |
| the position rewrite of the whole suffix | positions are stored (measured: a few percent of a keystroke; deriving them instead was measured 7-8x more expensive) |

Every row is a consequence of the edit being born in the string. That is what this arc changes.

## The phases

Each phase is what makes the next expressible; the order is forced, not preferred.

### Phase 0 — decide the Row boundary

What ends a Row, and how a marker-less paragraph is bounded. Everything downstream changes shape
with the answer. See [issue 02](issues/02-decide-the-row-boundary.md).

### Phase 1 — make the Row local

Delete the chain. Either as a pure refactor inside `parser/` — the abandoned
`phase7-first-class-rows-wip` branch did exactly this and `git diff --numstat` over
`PatternMatcher.ts` reads `0 42`, a deletion replaced by nothing — or it disappears by
construction if Rows become self-delimiting Marks. `filterEmptyText` and both predicates go with
it. See [issue 03](issues/03-make-the-row-extent-local.md).

*Blocked by phase 0: a chain cannot be deleted before it is known what bounds a paragraph.*

### Phase 2 — make the parse local

Restore a windowed parse. One existed: `incrementalParse` (230 lines plus a 199-line property
spec) was deleted in `8685bc69`, during phase7 and apparently as part of it, not because it
failed. Its property contract was that the result deep-equals a full parse for **any** document
and **any** single edit, with every guard falling back to a full parse; its hardest problem —
segment pairing being non-local, since a closing segment pairs with the nearest unmatched opening
arbitrarily far outside any window — was already solved by an inert-outside guard plus a
doubling-window stabilisation. See [issue 04](issues/04-make-the-parse-local.md).

*Blocked by phase 1: while a Row's extent is a document-wide chain, no window is sound.*

### Phase 3 — make the address local

Positions stop being stored state and become derived, so `adopt` stops rewriting the suffix.
See [issue 05](issues/05-make-the-address-local.md).

*Blocked by nothing in this arc — running in parallel — but it is the phase that delivers G1:
while a Token's address is stored state that goes stale the moment a sibling before it changes
length, "the edit is born in the Token" is not representable.*

### Phase 4 — the concept sweep

Only then recount the eight and remove whatever is left without a cause. See
[issue 06](issues/06-concept-sweep.md).

## What each phase buys

| | G1 | G2 | G3 | G4 |
| --- | --- | --- | --- | --- |
| Phase 0 — decision | — | — | ✓ | — |
| Phase 1 — local Row | — | the chain, `filterEmptyText`, both predicates | ✓ | — |
| Phase 2 — local parse | — | — | — | ~~half~~ withdrawn |
| Phase 3 — local address | **✓** | `gapWindow`, the echo protocol, `#committed` | — | ~~half~~ withdrawn |
| Phase 4 — sweep | — | 1–2 pipeline concepts | — | — |

## Out of scope, deliberately

- **Core owning the document DOM.** Closed by ADR-0007 and priced: one extra element per Mark
  moves `tokenElement` up a level, which is the subject of the DOM-to-Anchor projection, so
  `anchorFor` flips arms and every boundary on a Slot Mark answers `undefined`; the 1520-line HTML
  snapshot is invalidated; ADR-0005's Chromium caret probes at Mark edges need re-measuring; the
  `Nested` fixtures render Marks as `ul`/`li`/`h1`, which an interposed `span` breaks.
- **Announcing the delta as a set difference.** Real but orthogonal — it neither blocks nor is
  blocked by anything here. Parked as
  [`backlog/issues/closed.md`](../backlog/issues/closed.md) — done 2026-08-18.
- **Sweep-line for `SegmentMatcher`'s overlap filter.** It optimises a full parse, which phase 2
  aims to stop performing. Improvement for its own sake until phase 2 resolves; the written patch
  is preserved outside the repo.

## Measurement

There is a baseline now, and it is what withdrew G4. `packages/core/src/features/tokens/`
carries three benches — the commit ladder, the caret write, and the layout — plus a frame-interval
measurement written up in
[`../native-caret-motion/measurements.md`](../native-caret-motion/measurements.md).

Read the instrument caveats there before quoting any of it. Three traps were found the hard way: a
tight loop is not typing and reads 2-4x high; CDP's `LayoutDuration` under-reports by ~40x; and
benchmarking on a loaded machine inflates absolutes 5-30%. The only metric that tracks what a
person feels is the frame interval.

## Open, at the time of writing

- ~~Phase 0's answer.~~ Answered 2026-08-20: candidate 3 — the separator is structural, and a
  Row becomes a tree node. Decisions, evidence and the 7-step plan:
  [issues/08](issues/08-the-separator-is-structural.md). Phases 1 and 2 are unblocked.
- ~~What `incrementalParse` actually cost.~~ Answered: it does not matter, because the parse is
  ~3% of a keystroke. Pursue a local parse for correctness and for the parser's standing goal, not
  for speed.
- Whether phase 3 is separable from expressing edits as tree operations, or whether they are one
  project. If they are one, the phase ordering above needs correcting.
