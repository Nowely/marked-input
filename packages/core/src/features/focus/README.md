# Focus Feature

Manages focus tracking and recovery within the editor. Tracks the currently focused element, restores focus/caret position after re-renders, and handles auto-focus when the editor is empty.

## Components

- **FocusFeature**: Feature class that:
    - Listens for `focusin`/`focusout`/`click` events on the container
    - After each token render (when a `Mark` component is provided), reads `store.state.recovery`, restores focus/caret from recovery descriptors (handles stale DOM nodes, next/prev navigation, child index offset), and clears the recovery state
    - Subscribes to `afterTokensRendered` to trigger sync and that automatic caret recovery
    - Auto-focuses the first child on click when the editor is empty

## Usage

The feature is registered by the Store automatically. Caret recovery runs after each token render when a `Mark` component is provided — it reads `store.state.recovery`, restores the caret, and clears the recovery state.
