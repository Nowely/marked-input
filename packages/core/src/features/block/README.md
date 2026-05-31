# Block Feature

Manages the block editing mode where each row/token is rendered as a separate draggable block. Subscribes to drag action events and routes value mutations through `store.edit.replace()` so subscribers observe a batched value/caret update per drag operation.

## Components

- **BlockController**: Owns `store.block.action` (a reactive event) and forwards drag operations to `applyDragAction` in `operations.ts`; receives `EditController` so all writes go through the single batched write path. Also vends each row's `BlockStore` via `store.block.get(token)`, lazily created and cached per token.
- **BlockStore**: Per-row UI state (drag/hover/menu signals) and DOM wiring (`attachContainer`/`attachGrip`/`attachMenu`). One instance per row token.
- **getAlwaysShowHandle**: Extracts `alwaysShowHandle` from `DraggableConfig`

## Operations (internal)

The feature uses pure functions from `operations.ts` for manipulating the raw value: `reorderDragRows`, `addDragRow`, `deleteDragRow`, `duplicateDragRow`, `mergeDragRows` (returns `{value, caret}`), `canMergeRows`.

## Usage

The feature is registered by the Store and activates when block layout and `draggable` are both enabled. Drag actions are dispatched via `store.block.action({...})`.
