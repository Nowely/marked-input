# Selection Feature

Owns the reactive caret/selection state, orchestrates DOM placement after render and re-index, and exposes raw-boundary reads for keyboard, clipboard, and overlay consumers. Exposed as `store.selection`.

## Layout

- `SelectionController.ts` — reactive state, DOM event listeners, caret placement, and `(node, offset)` ↔ raw position translation. Owns `range`, `position` (writable computed), `isAllSelected`, and `isUserSelecting`. Public surface: `selectAll`, `focusFirst`, `placeAtAddress`, `readRaw`, `rawPositionFromBoundary`, `readSelectedContent`.
- `textOffsets.ts` — pure helpers used by the boundary translator and the placement primitives.
- `caretDom.ts` — stateless DOM caret helpers (`getCaretIndex`, `setAtElement`, `setAtX`, `getRect`, `isOnFirstLine`, `isOnLastLine`, `placeAtTextOffset`, `placeAtChildBoundary`, `placeRangeAcrossSurfaces`, `focusIfNeeded`).

## Public Surface

- `range: Signal<Range | undefined>` — single source of truth for caret/selection. Writes propagate to the DOM via `watch(range)` → `DomSelectionBridge.applyRange`.
- `position: Signal<number | undefined>` — writable computed bound to `range.start`; writes collapse the range to `{start: pos, end: pos}`.
- `isUserSelecting: Signal<boolean>` — selection-in-progress signal. Pushed to `TextSurfaces.setSelecting` so structural text surfaces flip to `contenteditable="false"` during drags.
- `isAllSelected: Signal<boolean>` — computed; true when the selection spans the entire raw value.
- `selectAll()`, `focusFirst()`, `placeAtAddress(address, boundary)` — imperative helpers.
- `readRaw()`, `rawPositionFromBoundary(node, offset, affinity)`, `readSelectedContent()` — boundary reads, available to non-selection consumers (keyboard, clipboard, overlay).

## Wiring

Inside `host.onMounted`, `SelectionController` registers DOM listeners (`#trackSelection`, `#trackUserSelecting`, `#focusEmptyEditorOnClick`) and two watches that re-apply the range: one on `range` itself, one on `dom.indexed`.
