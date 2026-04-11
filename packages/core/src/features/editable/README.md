# Editable Feature

Keeps the DOM in sync with token state by managing `contentEditable` attributes and `textContent` on rendered elements. Reacts to `readOnly` changes, selection state, and sync events.

## Components

- **ContentEditableFeature**: Reactive feature that sets `contentEditable` on text spans (non-drag) or text/mark rows (drag mode), and syncs `textContent` for all text spans including deeply nested marks
- **isTextTokenSpan**: Identifies bare `<span>` elements representing text tokens (no attributes or only `contenteditable`)

## Usage

The feature is registered by the Store and runs automatically on state changes. `isTextTokenSpan` is used internally by other features to identify editable text spans.
