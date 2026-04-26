# DOM Feature

Owns rendered DOM structure, token-to-element indexing, raw boundary mapping, text reconciliation, focus-by-address, and caret recovery application.

## Components

- **DOM registration**: React/Vue register the root through `store.dom.container` and block controls through `store.dom.controlFor()`.
- **DOM index**: Built after `lifecycle.rendered()` from direct rendered token roots.
- **Raw mapping**: Converts DOM boundaries and selections to serialized raw positions for the value pipeline.
- **Recovery**: Applies `caret.recovery` after renders by placing text carets, selections, or mark-boundary focus. Failed recovery is cleared after the attempt and reported through `dom.diagnostics`.
- **Text reconciliation**: Keeps structural text roots in sync with parsed text tokens and `readOnly` state.

Production code must not infer token identity from public data attributes or user refs.
