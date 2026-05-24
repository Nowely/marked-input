# Block Feature

Manages the block editing mode where each row/token is rendered as a separate draggable block. Subscribes to drag action events and routes value mutations through `store.edit.replace()` so subscribers observe a batched value/caret update per drag operation.

## Components

- **BlockController**: Subscribes to `store.block.action` (a reactive event) and dispatches drag operations (reorder, add, delete, duplicate). Receives `EditController` so all writes go through the single batched write path.
- **getAlwaysShowHandle**: Extracts `alwaysShowHandle` from `DraggableConfig`
- **EMPTY_TEXT_TOKEN**: Constant used as placeholder when no rows exist

## Operations (internal)

The feature uses pure functions from `operations.ts` for manipulating the raw value: `reorderDragRows`, `addDragRow`, `deleteDragRow`, `duplicateDragRow`, `mergeDragRows`, `canMergeRows`, `getMergeDragRowJoinPos`.

## Usage

The feature is registered by the Store and activates when block layout and `draggable` are both enabled. Drag actions are dispatched via `store.block.action({...})`.
