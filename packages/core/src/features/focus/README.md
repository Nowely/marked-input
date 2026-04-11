# Focus Feature

Manages focus tracking and recovery within the editor. Tracks the currently focused element, restores focus/caret position after re-renders, and handles auto-focus when the editor is empty.

## Components

- **FocusFeature**: Feature class that:
    - Listens for `focusin`/`focusout`/`click` events on the container
    - Subscribes to `recoverFocus` events and restores focus/caret from recovery descriptors (handles stale DOM nodes, next/prev navigation, child index offset)
    - Subscribes to `afterTokensRendered` to trigger sync and focus recovery when a Mark is active
    - Auto-focuses the first child on click when the editor is empty

## Usage

The feature is registered by the Store automatically. Focus recovery is triggered by other features through `store.event.recoverFocus`.
