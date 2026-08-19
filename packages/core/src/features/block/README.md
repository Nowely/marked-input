# Block Feature

Manages the block editing mode where each row is rendered as a separate draggable block. Subscribes to drag action events and turns each one into a write on the token layer.

## Components

- **BlockController**: Owns `store.block.action` (a reactive event) and lowers every drag operation onto the row's own node — `remove()`, `duplicate()`, `insertAfter()`, `moveTo()` — so the commit names the row it addressed. Only the two adds with no row to address are left composed. Also vends each row's `BlockStore` via `store.block.get(node)`, lazily created and cached in a `WeakMap` keyed by the row NODE — adoption writes surviving nodes in place and allocates an id only at `buildNode`, so within one input "kept its id" and "kept its object" are the same statement, and the object key self-collects instead of needing a prune.
- **BlockStore**: Per-row UI state (drag/hover/menu signals) and DOM wiring (`attachContainer`/`attachGrip`/`attachMenu`). One instance per row node.
- **getAlwaysShowHandle**: Extracts `alwaysShowHandle` from `DraggableConfig`

## Why the node verbs, and not a composed document

A composed document is diffed back to an edit window by `gapWindow`, a STRING diff — and a string diff cannot tell two byte-identical rows apart. `duplicate` and `add` manufacture exactly those (`createRowContent` answers the same string every time), so deleting the first of two identical rows retained the wrong node and announced the wrong id in `changed.removed`. Both adapters key rows by `node.id` and this feature keyed per-row state by the row's identity, so the wrong id unmounted the wrong row.

Addressing the row's own node removes the ambiguity at the source: the splice window is the row's own span, and adoption's prefix/suffix walks keep every other row.

## Operations (internal)

The pure functions in `operations.ts` never take a raw value. The document reaches them as a `SliceRead` — `(from, to) => tokens.valueBetween(from, to)` — so every read comes from the token tree itself and is consistent with the `rows` whose positions address it, which a props-first `value()` is not in controlled mode.

`addRowUnanchored(read, rows, afterIndex, options)` is all that is left of the composed path — the two adds no anchor can name: an EMPTY tree has no row to insert after, and a negative `afterIndex` means before the first row, which `insertAfter` cannot express. Neither is reachable from the menu. `addDragRow` serves the keyboard feature's Enter on a mark row, which wants its caret at the END of the inserted content.

Deletion, merging and reorder left this file for the node verbs: `deleteDragRow` became `row.remove()`, `mergeDragRows`/`canMergeRows` became `a.mergeWith(b)` (which answers whether the pair had a boundary to remove instead of being asked first), and `applyDragAction`'s reorder arm became `row.moveTo(index)`. Reorder is the one that needed more than an anchor: a permutation is not derivable from the two strings, so the commit carries a `Pairing` stating it. That work also took the last `.position` read out of `block/`, which is why the directory is no longer on [ADR-0003](../../../../../docs/adr/0003-one-address-space.md)'s allowlist — the allowlist is gone.

## Usage

The feature is registered by the Store and activates when block layout is enabled; `draggable` gates only the reorder action, because the menu and keyboard row edits are block-mode features rather than drag UI. Drag actions are dispatched via `store.block.action({...})`.
