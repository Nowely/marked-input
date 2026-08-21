# Union the token store with the block store?

Type: research
Status: open

Two id-keyed registries cover the same nodes: `TokenModel`'s node map, pruned inside the bind
pass, and `BlockController`'s store map (`features/block/BlockController.ts:19`), pruned off the
`tokens.changed` event. Different triggers, same ids.

What `BlockStore` holds that the token layer does not, all seven fields:

- Five UI signals — `isHovered`, `isDragging`, `dropPosition`, `menuOpen`, `menuPosition`. **Not**
  derivable from the tree.
- `#blockIndex` (`BlockStore.ts:67`) — derivable in principle: `tokens.rootIndexOf` already
  answers it on the keyboard path (`keyboard/blockEdit.ts:51`). But `BlockStore` holds no node
  id at all, so "derive it" means new plumbing, not a call swap.
- `refs.container` — overlaps `bind`'s `rowElement` (`dom/bind.ts:183`), but only partly: `bind`
  resolves rows positionally and all-or-nothing, bailing the whole frame when one row has more
  than one non-control child. The adapter-attached ref is not that.
- `#dragAction` — a per-row copy of the single `BlockController.action` event.
- Three listener-cleanup closures — genuinely `BlockStore`'s.

So two of seven are arguably derivable and the UI half is not. Merging everything into the node
layer would put drag and menu state on a public `TreeNode`.

**Question.** Fold the two derivable fields onto the token layer and keep the UI signals as a
separate id-keyed store, or accept one merged map and the public-surface cost of UI state on a
node? The note's own reason for asking — "so a new block isn't created in time" — needs
restating as a concrete symptom before either option can be scored.

## Comments

2026-08-21 — The "fold the two derivable fields" option is executed; the store-union question
itself stays open. The RowNode cutover removed this issue's stated blocker ("`BlockStore`
holds no node id at all"): `BlockController.get(node)` keys stores by the node object, so it
constructs each `BlockStore` with what it already holds — the shared `action` event and a live
index reader, `() => tokens.rootIndexOf(node.id) ?? -1`. `#blockIndex` and `#dragAction` are
deleted, `attachContainer`/`attachGrip` take only the element, the one-field `DragActions`
interface is gone from `shared/types.ts`, and both adapters dropped the `blockIndex` prop
threading (react `Block.tsx`/`DragHandle.tsx`, vue `Block.vue`/`DragHandle.vue`, plus both
`Container`s). Of the seven fields the body counts, what remains in `BlockStore` is the five UI
signals, `refs.container`, and the listener cleanups — exactly the set the body called not
derivable. Whether THAT residue merges into the token layer is still the open question.
