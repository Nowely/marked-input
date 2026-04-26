# DOM Feature

Owns adapter-registered DOM structure, token-to-element indexing, raw boundary mapping, text reconciliation, focus-by-address, and caret recovery application.

## Components

- **DOM registration**: React/Vue register the root through `store.dom.container` and structural child elements through `store.dom.refFor()`.
- **DOM index**: Built after `lifecycle.rendered()` from adapter-registered structural elements.
- **Raw mapping**: Converts DOM boundaries and selections to serialized raw positions for the value pipeline.
- **Recovery**: Applies `caret.recovery` after renders by placing text carets, selections, or mark-boundary focus. Failed recovery is cleared after the attempt and reported through `dom.diagnostics`.
- **Text reconciliation**: Keeps registered text surfaces in sync with parsed text tokens and `readOnly` state.

Production code must not infer token identity from DOM child order, public data attributes, or user refs.
