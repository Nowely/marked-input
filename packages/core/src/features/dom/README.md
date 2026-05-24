# DOM Feature

Owns rendered DOM structure, token-to-element indexing, raw boundary mapping, and structural text reconciliation. Caret placement back into the DOM is the responsibility of `SelectionController`.

## Layout

- `DomModel.ts` — public facade exposed as `store.dom`. Owns `container`, ref registries (`controlFor` / `childrenFor`), composition flags, the click-on-empty listener, and the `index` / `indexed` / `readOnly` surface. Exposes read-only views into the index (`locateNode`, `pathElements`, `pathElementsFor`) and the boundary mapping (`rawPositionFromBoundary`, `readRawSelection`).
- `DomIndexer.ts` — rebuilds the token-to-element index after `lifecycle.rendered`, keeps `#pathElements` / `#elementRoles` in sync, and reconciles structural text surfaces (text content + `contentEditable`) when `props.readOnly` changes or selection mode toggles.
- `DomBoundary.ts` — converts DOM `(node, offset)` boundaries and the current browser selection into raw value positions. Used by the value pipeline and keyboard handlers.
- `textOffsets.ts` — pure helpers for walking text content (`textOffsetWithin`, `textLength`, `hasEditableAncestorBefore`, etc.). Also consumed by `SelectionController`'s inlined placement helpers.

## Registration

React/Vue register the root through `store.dom.container` and block controls through `store.dom.controlFor()`. Mark child slots use `store.dom.childrenFor()`.

## Indexing

The index is built after `lifecycle.rendered()` from direct rendered token roots. Out-of-shape DOM trees are surfaced through the indexed status, not through thrown errors.

## Notes

Production code must not infer token identity from public data attributes or user refs.
