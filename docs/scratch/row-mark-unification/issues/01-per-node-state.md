# Per-node state: does BlockStore generalize?

Type: grilling
Status: open
Blocked by: 02

## Question

`BlockStore` (`packages/core/src/features/block/BlockStore.ts`, 147 lines)
holds per-row UI state — `isHovered`, `isDragging`, `dropPosition`, `menuOpen`,
`menuPosition` — plus DOM wiring (`attachContainer`/`attachGrip`/`attachMenu`),
vended lazily by `BlockController`'s WeakMap keyed by the row's TreeNode.
Nothing analogous exists for marks.

Under one facility set: what is the generic per-node state facility for any
node kind, who owns it, and is block chrome state an extension of it or a
consumer beside it? Does `BlockController` (92 lines: the `DragAction` event +
one watch lowering actions onto node verbs) survive as a separate owner, or
does it fold into the generic facility?

Constraints: one-way unification (marks gain no drag/menu); one owner per
state (AGENTS.md); the phase-4 target surface (~12 members) is the API budget
this must fit.

## Round 1 (2026-08-22) — narrowed, and now blocked on 02

The blocking edge is inverted from what this map assumed: **02 constrains 01**,
not the reverse. Every option here except "dissolve the state" is an argument
about where per-row WIRING lives, and wiring exists only because chrome is DOM
inside the row. The maintainer has taken the chrome-out-of-the-row direction
in [02](02-one-render-path.md), which dissolves the keying question outright —
with no chrome in the row there is no per-row record to key by node, by id, or
by element. Deciding this ticket first would have re-committed to per-row
chrome.

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

The row-verb fold shipped; the ticket stays `open` because its actual question
— the per-node state facility — is still behind [02](02-one-render-path.md).

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
