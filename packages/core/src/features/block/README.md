# Block Feature

Manages the block editing mode where each row/token is rendered as a separate draggable block. Subscribes to drag action events and routes value mutations through `store.edit.replace()` so subscribers observe a batched value/caret update per drag operation.

## Components

- **BlockController**: Owns `store.block.action` (a reactive event) and forwards drag operations to `applyDragAction` in `operations.ts`; receives `EditController` so all writes go through the single batched write path. Also vends each row's `BlockStore` via `store.block.get(token)`, lazily created and cached per token.
- **BlockStore**: Per-row UI state (drag/hover/menu signals) and DOM wiring (`attachContainer`/`attachGrip`/`attachMenu`). One instance per row token.
- **getAlwaysShowHandle**: Extracts `alwaysShowHandle` from `DraggableConfig`

## Operations (internal)

The pure functions in `operations.ts` never take a raw value. The document reaches them as a `SliceRead` — `(from, to) => tokens.valueBetween(from, to)` — so every read comes from the token tree itself and is consistent with the `rows` whose positions address it, which a props-first `value()` is not in controlled mode.

`applyDragAction(read, rows, action, options)` serves every drag action (reorder/add/delete/duplicate). It projects the rows into per-row texts plus inter-row gaps, edits those, and composes the result, so its `{value, caret}` caret always indexes the value beside it; `undefined` means there is nothing to write. `addDragRow`, `deleteDragRow`, `mergeDragRows` and `canMergeRows` serve the keyboard feature's row edits on the same terms.

## Usage

The feature is registered by the Store and activates when block layout and `draggable` are both enabled. Drag actions are dispatched via `store.block.action({...})`.
