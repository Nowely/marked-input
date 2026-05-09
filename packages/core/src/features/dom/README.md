# DOM Feature

Owns rendered DOM structure, token-to-element indexing, raw boundary mapping, text reconciliation, focus-by-address, and caret range placement.

## Components

- **DOM registration**: React/Vue register the root through `store.dom.container` and block controls through `store.dom.controlFor()`.
- **DOM index**: Built after `lifecycle.rendered()` from direct rendered token roots.
- **Raw mapping**: Converts DOM boundaries and selections to serialized raw positions for the value pipeline.
- **Range placement**: Applies `caret.selection` to the DOM after every render by placing text carets or selections. Out-of-bounds ranges are clamped; ranges that cannot be placed are cleared and reported through `dom.diagnostics`.
- **Text reconciliation**: Keeps structural text roots in sync with parsed text tokens and `readOnly` state.

Production code must not infer token identity from public data attributes or user refs.
