# The edit is born in the Token

An editing arc, not a refactor. Today an edit is born in the Value string and the Token tree
recovers from it afterwards; the goal is to invert that, so editing a Token makes that Token
immediately correct and everything outward is derived.

Agreed with the maintainer 2026-08-18. Four phases, ordered by a dependency argument rather than
by size — each one is what makes the next expressible.

## Goals, in priority order

- **G1 — the edit is born in the Token.** The maintainer's own framing: every framework has the
  controlled-component pattern; here the same thing, but per Token. Edit a Token and it is
  correct at once; propagation outward is derived, not written.
- **G2 — fewer concepts** to hold in the head to follow one keystroke end to end.
- **G3 — the Row stops being a stopgap.** One model, with markdown's editor semantics: a line of
  text plus Enter is its own block.
- **G4 — efficiency: no O(document) work per keystroke.** Explicitly ranked below G2 by the
  maintainer.

## Constraints

- The frameworks keep the rendering role; core does not own the document DOM
  ([ADR-0002](../../adr/0002-one-contenteditable-host.md),
  [ADR-0007](../../adr/0007-row-identity-travels-with-the-row.md)). Re-opening either is a new
  decision, not a step in this arc.
- Breaking changes are allowed. The Markup contract, the `Option` shape, the parse algorithm, the
  Row representation and the public API are all in scope.

## The floor — what this arc cannot buy

Establishing this first, because it re-aims the whole effort. Eight concepts must be held to
follow one keystroke: `renderEpoch`, the `pendingStructural` latch, the delta accumulator with
exact-id cancellation, the re-entry guard, `bind`'s all-or-nothing frame alignment plus
unbind-vs-kill, the divergence sweep having to be a `changed` subscriber, Vue's two announcement
sites plus its epoch dedupe, and the ordering rules inside the commit batch.

**Four of them are the invoice for framework-owned DOM, not accidental complexity.** Proven by a
controlled experiment rather than argued: `@handlewithcare/react-prosemirror` takes ProseMirror's
core unchanged and inverts DOM ownership so React paints — and concepts 1, 2, 5 and 7 all
reappear there (`nextProps` + `commitPendingEffects`, a `viewDescRef` undefined until a layout
effect, `if (!update()) { destroy(); create() }`, `flushSync` plumbing). Three of the four major
analogs — ProseMirror, CodeMirror 6, Lexical — avoid them only by owning the DOM. Slate, the one
that lets the framework render, has them too.

So the paint handshake is irreducible and **the commit pipeline is not where the complexity budget
is**. It is upstream, and all of it has one root:

| What | Why it exists |
| --- | --- |
| `resolveSlotLeadingMatches`' document-wide chain | the marker-less paragraph has nothing to bound it |
| `filterEmptyText`, wired into `tree/valueBoundary.ts` | the same |
| two `isSlotLeading` predicates (`tree/siblings.ts:9`, `keyboard/blockEdit.ts:13`) | the same |
| `gapWindow`, the echo protocol, the `#committed` mirror | [ADR-0001](../../adr/0001-tree-as-source-of-truth.md) names them outright as the price of identity being *recovered* after a splice rather than *preserved* |
| a full re-parse per keystroke | the parser has no windowed entry point |
| the position rewrite of the whole suffix | positions are stored |

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
| Phase 2 — local parse | — | — | — | half |
| Phase 3 — local address | **✓** | `gapWindow`, the echo protocol, `#committed` | — | half |
| Phase 4 — sweep | — | 1–2 pipeline concepts | — | — |

## Out of scope, deliberately

- **Core owning the document DOM.** Closed by ADR-0007 and priced: one extra element per Mark
  moves `tokenElement` up a level, which is the subject of the DOM-to-Anchor projection, so
  `anchorFor` flips arms and every boundary on a Slot Mark answers `undefined`; the 1520-line HTML
  snapshot is invalidated; ADR-0005's Chromium caret probes at Mark edges need re-measuring; the
  `Nested` fixtures render Marks as `ul`/`li`/`h1`, which an interposed `span` breaks.
- **Announcing the delta as a set difference.** Real but orthogonal — it neither blocks nor is
  blocked by anything here. Parked as
  [backlog issue 28](../backlog/issues/28-announce-the-delta-as-a-set-difference.md).
- **Sweep-line for `SegmentMatcher`'s overlap filter.** It optimises a full parse, which phase 2
  aims to stop performing. Improvement for its own sake until phase 2 resolves; the written patch
  is preserved outside the repo.

## Measurement

There is **no baseline**. `parser.bench.result.json` holds 18 entries whose newest is 2026-06-12
and whose other seventeen are from November 2025 in an older format; it was last touched in #267,
before the current architecture. Any phase claiming a G4 win establishes its own baseline first.

## Open, at the time of writing

- Phase 0's answer.
- What `incrementalParse` actually cost. The same commit that deleted it reduced the bench to a
  full-parse tripwire, so the win was never recorded.
- Whether phase 3 is separable from expressing edits as tree operations, or whether they are one
  project. If they are one, the phase ordering above needs correcting.
