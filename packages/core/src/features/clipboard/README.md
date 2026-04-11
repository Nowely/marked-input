# Clipboard Feature

Provides copy, cut, and paste operations with rich markup support. On copy, writes three MIME types to the clipboard (`text/plain`, `text/html`, `application/x-markput`) to preserve markup fidelity on internal paste.

## Components

- **CopyFeature**: Feature class handling `copy` and `cut` events — serializes selected tokens to markup/plain/HTML and writes to clipboard; on cut, also deletes the selected tokens
- **captureMarkupPaste**: Captures markput MIME data from a ClipboardEvent
- **consumeMarkupPaste**: Reads and clears captured markput paste data for a container
- **clearMarkupPaste**: Clears captured markput paste data without reading
- **selectionToTokens**: Maps a browser Selection to the subset of tokens it covers, returning boundary offsets

## Usage

```typescript
import {selectionToTokens} from '@markput/core'

const range = selectionToTokens(tokens, selection)
// range: { startToken, endToken, startOffset, endOffset }
```

The `CopyFeature` is registered by the Store automatically. The custom MIME type (`application/x-markput`) preserves full markup syntax on internal copy/paste operations.
