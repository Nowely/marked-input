# Drag Feature

Manages the drag-and-drop block editing mode where each row/token is rendered as a separate draggable block. Subscribes to drag action events and dispatches operations like reorder, add, delete, duplicate, and merge.

## Components

- **DragFeature**: Feature class that subscribes to `store.event.dragAction` and dispatches drag operations
- **getAlwaysShowHandle**: Extracts `alwaysShowHandle` from `DraggableConfig`
- **EMPTY_TEXT_TOKEN**: Constant used as placeholder when no rows exist

## Operations (internal)

The feature uses pure functions from `operations.ts` for manipulating the raw value: `reorderDragRows`, `addDragRow`, `deleteDragRow`, `duplicateDragRow`, `mergeDragRows`, `canMergeRows`, `getMergeDragRowJoinPos`.

## Usage

The feature is registered by the Store and activates when drag mode is enabled. Drag actions are dispatched via `store.event.dragAction`.
