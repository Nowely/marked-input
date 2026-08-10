# Clipboard Feature

Provides copy, cut, and paste operations with rich markup support. On copy, writes three MIME types to the clipboard (`text/plain`, `text/html`, `application/x-markput`) to preserve markup fidelity on internal paste.

## Components

- **ClipboardController**: Controller class handling `copy` and `cut` events — serializes selected tokens to markup/plain/HTML and writes to clipboard; on cut, also deletes the selected tokens through `store.edit.replace()`
- **captureMarkupPaste**: Captures markput MIME data from a ClipboardEvent
- **consumeMarkupPaste**: Reads and clears captured markput paste data for a container
- **DOM selection as anchors**: Clipboard reads `store.selection.domAnchors()` — what the live window selection says, resolved in the live tree. It forms no absolute offset (spec S2 D1); `store.tokens.valueBetween(anchor, head)` projects the span to a string.

## Usage

```typescript
const anchors = store.selection.domAnchors()
if (anchors) {
    const markup = store.tokens.valueBetween(anchors.anchor, anchors.head)
}
```

The `ClipboardController` is registered by the Store automatically. The custom MIME type (`application/x-markput`) preserves full markup syntax on internal copy/paste operations.
