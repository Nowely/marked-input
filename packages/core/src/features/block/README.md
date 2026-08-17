# Block Feature

Manages the block editing mode where each row is rendered as a separate draggable block. Subscribes to drag action events and turns each one into a write on the token layer.

## Components

- **BlockController**: Owns `store.block.action` (a reactive event) and lowers each drag operation onto the row's own node — `remove()`, `duplicate()`, `insertAfter()` — so the commit names the row it addressed. Reorder, and the two adds with no row to address, still go through `applyDragAction` and `EditController.setValue`. Also vends each row's `BlockStore` via `store.block.get(node)`, lazily created and cached per stable node id.
- **BlockStore**: Per-row UI state (drag/hover/menu signals) and DOM wiring (`attachContainer`/`attachGrip`/`attachMenu`). One instance per row node.
- **getAlwaysShowHandle**: Extracts `alwaysShowHandle` from `DraggableConfig`

## Why the node verbs, and not a composed document

A composed document is diffed back to an edit window by `gapWindow`, a STRING diff — and a string diff cannot tell two byte-identical rows apart. `duplicate` and `add` manufacture exactly those (`createRowContent` answers the same string every time), so deleting the first of two identical rows retained the wrong node and announced the wrong id in `changed.removed`. Both adapters key rows by `node.id` and this feature prunes per-row state by it, so the wrong id unmounted the wrong row.

Addressing the row's own node removes the ambiguity at the source: the splice window is the row's own span, and adoption's prefix/suffix walks keep every other row.

## Operations (internal)

The pure functions in `operations.ts` never take a raw value. The document reaches them as a `SliceRead` — `(from, to) => tokens.valueBetween(from, to)` — so every read comes from the token tree itself and is consistent with the `rows` whose positions address it, which a props-first `value()` is not in controlled mode.

`applyDragAction(read, rows, action, options)` now serves REORDER and the two adds no anchor can name (an empty tree, and a negative `afterIndex`, which means before the first row). It projects the rows into per-row texts plus inter-row gaps, edits those, and composes the result, so its `{value, caret}` caret always indexes the value beside it; `undefined` means there is nothing to write. `addDragRow` serves the keyboard feature's Enter on a mark row, which wants its caret at the END of the inserted content.

Row deletion and merging left this file for the node verbs: `deleteDragRow` became `row.remove()`, and `mergeDragRows`/`canMergeRows` became `a.mergeWith(b)`, which answers whether the pair had a boundary to remove instead of being asked first. That move also took the last `.position` read out of `block/` — the reason the directory sits on [ADR-0003](../../../../../docs/adr/0003-one-address-space.md)'s allowlist.

## Usage

The feature is registered by the Store and activates when block layout is enabled; `draggable` gates only the reorder action, because the menu and keyboard row edits are block-mode features rather than drag UI. Drag actions are dispatched via `store.block.action({...})`.
