# DOM Feature

Owns rendered DOM structure, token-to-element indexing, raw boundary mapping, text reconciliation, focus-by-address, and caret range placement.

## Layout

- `DomModel.ts` — public facade exposed as `store.dom`. Owns `container`, ref registries (`controlFor` / `childrenFor`), composition flags, the click-on-empty listener, and the `index` / `indexed` / `diagnostics` / `readOnly` surface. Composes the three collaborators below and delegates the imperative methods to them.
- `DomIndexer.ts` — rebuilds the token-to-element index after `lifecycle.rendered`, keeps `#pathElements` / `#elementRoles` in sync, and reconciles structural text surfaces (text content + `contentEditable`) when `props.readOnly` changes or selection mode toggles.
- `DomBoundary.ts` — converts DOM `(node, offset)` boundaries and the current browser selection into raw value positions. Used by the value pipeline and keyboard handlers.
- `DomCaretPlacer.ts` — places carets and ranges back into the DOM from raw positions or token addresses (`placeAt`, `placeRange`, `focusAddress`). Out-of-bounds inputs are clamped; placements that cannot resolve return `invalidBoundary` and the caller is expected to surface that.
- `textOffsets.ts` — pure helpers for walking text content (`textOffsetWithin`, `textLength`, `splitsSurrogatePair`, `hasEditableAncestorBefore`, etc.).

## Registration

React/Vue register the root through `store.dom.container` and block controls through `store.dom.controlFor()`. Mark child slots use `store.dom.childrenFor()`.

## Indexing

The index is built after `lifecycle.rendered()` from direct rendered token roots. Out-of-shape DOM trees produce `dom.diagnostics` events (`ambiguousStructure`, `stalePath`, `missingContainer`, etc.) rather than throwing.

## Notes

Production code must not infer token identity from public data attributes or user refs.
