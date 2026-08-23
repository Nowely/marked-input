# Per-node state: does BlockStore generalize?

Type: grilling
Status: resolved

## Question

`BlockStore` (`packages/core/src/features/block/BlockStore.ts`, 147 lines)
holds per-row UI state — `isHovered`, `isDragging`, `dropPosition`, `menuOpen`,
`menuPosition` — plus DOM wiring (`attachContainer`/`attachGrip`/`attachMenu`),
vended lazily by `BlockController`'s WeakMap keyed by the row's TreeNode.
Nothing analogous exists for marks.

Under one facility set: what is the generic per-node state facility for any
node kind, who owns it, and is block row-control state an extension of it or a
consumer beside it? Does `BlockController` (92 lines: the `DragAction` event +
one watch lowering actions onto node verbs) survive as a separate owner, or
does it fold into the generic facility?

Constraints: one-way unification (marks gain no drag/menu); one owner per
state (AGENTS.md); the phase-4 target surface (~12 members) is the API budget
this must fit.

## Round 1 (2026-08-22) — narrowed, and now blocked on 02

The blocking edge is inverted from what this map assumed: **02 constrains 01**,
not the reverse. Every option here except "dissolve the state" is an argument
about where per-row WIRING lives, and wiring exists only because the controls
are DOM inside the row. The maintainer has taken the controls-out-of-the-row
direction in [02](02-one-render-path.md), which dissolves the keying question
outright — with no controls in the row there is no per-row record to key by
node, by id, or by element. Deciding this ticket first would have re-committed
to per-row controls.

Two things survived round 1 independent of that, and one died:

**Land as its own commit, unblocked by anything — the row-verb fold.** The
`DragAction` event and its four-verb protocol (`shared/types.ts:113-117`),
`features/block/operations.ts` (36 lines) and `BlockController`'s lowering
watch all die; `BlockStore` holds its node and calls
`node.remove()`/`duplicate()`/`insertAfter()`/`moveTo()` directly. Two things
must be carried, not dropped: the negative-index refusal at
`BlockController.ts:45` is NOT unreachable (`BlockStore.#onContainerDrop`
parses `text/plain` with no provenance check and `#blockIndex` is
`rootIndexOf(node.id) ?? -1`; unguarded, `rows().at(-1)?.moveTo(0)` moves the
LAST row to the top), and `BlockController.spec.ts` is the ADR-0007 row-identity
oracle — its `describe('row identity')` and `describe('per-row stores
(identity-keyed)')` cases must be rehomed at tree level, not deleted with the
file. **BEHAVIOR CHANGE:** `store.block.action({...})` leaves the reachable
Store surface, and it is documented consumer usage at `architecture.md:221,235`.

**Still to decide once 02's prototype lands — the state half.** Only
`dropPosition` is genuinely N-ary. Hover could become CSS, and
dragging/menu one editor-level signal addressed by node. Costs measured
against it: CSS `:hover` makes hover follow the POSITION rather than the row
(the same ADR-0007 §3 amendment 02 already needs), a singleton `dropPosition`
invalidates 2N components per dragover tick, and `BLOCK_MENU_ITEMS`' published
`run: (store: BlockStore) => void` (`menu.ts:9`) loses its parameter type.

**Dead: putting the record on `TokenHandle` or on the node.** The handle route
is refuted by ADR-0008 in code — `TokenModel.ts:69-71`, "ABSENCE IS THE ONLY
REFUSAL … the handle's existence IS the validity check" — so an `alive()` gate
is exactly the second flag-shaped refusal that ADR removed; and React calls
`s.block.get(node)` during RENDER (`Block.tsx:22-23`), before the ref and
before bind. The node route writes a mutable member on a published type whose
invariant is "ADOPTION IS THE ONLY WRITER" (`tree/types.ts:43-49`), and
`BlockController.ts:11-24` already argues object keying and id keying are the
same statement. Both lenses killed both.

## Landed (2026-08-22) — the fold half only

The row-verb fold shipped first, on its own. At the time this section was
written the ticket stayed open because its actual question — the per-node state
facility — was still behind [02](02-one-render-path.md); the Answer below
records how that question was dissolved rather than answered.

Gone: the `DragAction` type, the `store.block.action` event, `BlockController`'s
lowering watch, and `features/block/operations.ts`. `BlockStore` takes
`(node, PropsModel, TokenModel)` and its verbs are `insertAfter(separator)` /
`remove()` / `duplicate()` on the row it holds; the drop handler calls
`moveTo()`. `BlockController` is the `WeakMap<TreeNode, BlockStore>` and
`get(node)`. Neither adapter changed.

Behavior changes, all declared in the commit body:

- `store.block.action({...})` leaves the reachable Store surface; the website
  architecture doc and both READMEs are updated.
- The "two adds no anchor can name" go with `addRowUnanchored`. An empty
  document already IS one empty row (issue 08), and the negative-`afterIndex`
  arm was reachable only through a store whose row had left the tree, where it
  inserted an empty row at the DOCUMENT START. It now no-ops.
- Index-out-of-range refusals for delete/duplicate go away with the index
  protocol — a store addresses its own node.

Carried, as the round-1 answer required, and each now pinned by a test that
fails without it: the drop path's `source < 0`, `Number.isNaN`, `draggable`
and `isBlock` refusals. The `isBlock` copy on the MENU verbs is the one guard
measured non-load-bearing — a row node cannot outlive block layout, so the
transaction layer refuses first. Kept as the second belt; a clean follow-up
removal.

Rehoming: `describe('row identity')` moved to
`packages/core/src/features/tokens/tree/markNode.spec.ts`.
`describe('per-row stores (identity-keyed)')` stayed put, because
`BlockController.spec.ts` was not deleted — the controller survives as the
WeakMap vendor and `get(node)` is what those cases assert.

## Answer

**Resolved 2026-08-24 by recording what shipped, not by further work.** The
question — what is the generic per-node state facility, who owns it, does
`BlockController` survive as its own owner — was overtaken by the row-controls
layer. The answer is more radical than any of the four approaches round 1
produced: **there is no per-node state facility, because the per-node record
stopped existing.**

### The evidence

`packages/core/src/features/block/BlockController.ts` holds five signals for the
WHOLE editor, and each stores an ID, not a record:

```ts
readonly state = {
    hovered:  signal<number | null>({initial: null}),
    dragging: signal<number | null>({initial: null}),
    drop:     signal<{id: number; edge: DropEdge} | null>({initial: null, equals: shallow}),
    menu:     signal<{id: number; top: number; left: number} | null>({initial: null, equals: shallow}),
    geometry: signal({initial: 0}),
}
```

`menuElement` is likewise ONE registration for the editor where the per-row
store took one per row. Grep for `WeakMap` or `new Map<` in
`features/block/`: exactly one hit, and it is the docblock at :45 describing
what the OLD design did (`vended a per-row BlockStore out of a WeakMap and
pruned them by row id`).

So the keying question this ticket opened with — node object versus id, prune
versus self-collecting, does the WeakMap silently lose state across adoption —
is not answered. It is **dissolved**. There is no record to key.

Measured consequence, at 200 rows: 201 grip buttons → 1, 201 control roots → 1,
1608 DOM listeners → 7, mount 44 ms → 18 ms.

### One honest correction to "nothing is keyed by node"

Two node-keyed structures DO survive in core, and both are `TokenModel`'s:
`#nodes = new Map<number, TokenHandle>()` (":643", the live node layer keyed by
stable token id, mutated only through the commit pipeline) and `RefRegistry`'s
`#byOwner = new Map<number, Map<object, HTMLElement>>()` (":718"). Neither is a
UI-state facility — they are DOM identity and element registration, they have
one owner already, and this ticket never proposed touching them. The accurate
statement is that **no per-node UI-state record exists**, not that nothing is
keyed by node.

### What died along the way, with the reason

- **The row-verb fold** landed first and separately (`5b408707`): the
  `DragAction` event, its four-verb protocol and `features/block/operations.ts`
  are gone; the controller calls the row's own node verbs.
- **`TokenHandle` as the record** — refuted by ADR-0008 in code before the
  layer made it moot.
- **State on the node** — refuted: it writes a mutable member on a published
  type whose invariant is "ADOPTION IS THE ONLY WRITER".
- **The per-row store** — deleted outright by the controls layer.

### The one part of the question that survives

Round 1 asked, and the layer did not answer: **would MARKS ever want per-node
state** — hover for an overlay, say — even though drag stays row-only? Nothing
in core gives a mark per-node UI state today, and nothing asks for it. That is
now a question about whether a feature is wanted, not about how to build a
facility, so it does not belong to this ticket. If it is ever wanted, the
finding to carry over is that the row case was answered by NOT building the
facility — five editor-level signals addressed by id beat any keyed record, and
the same shape is available to marks.
