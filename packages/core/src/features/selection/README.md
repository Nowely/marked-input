# Selection Feature

Owns the reactive caret/selection state, orchestrates DOM placement after render and re-index, and exposes raw-boundary reads for keyboard, clipboard, and overlay consumers. Exposed as `store.selection`.

## Layout

- `SelectionController.ts` — reactive state + orchestration. Owns `range`, `position` (writable computed), `isAllSelected`, and `isUserSelecting`. Pushes `isUserSelecting` to `bridge.setSelecting` via a watch inside `onMounted`. Public delegations: `selectAll`, `focusFirst`, `placeAtAddress`, `readRaw`, `rawPositionFromBoundary`, `readSelectedContent`.
- `DomSelectionBridge.ts` — private bridge owning the `DomBoundary` instance, the caret-placement primitives, and the DOM event listeners (`#trackSelection`, `#trackUserSelecting`, `#focusEmptyEditorOnClick`). Read-only access to `range` via `applyRange`; writes back through the explicit `onRangeRead` callback in `SelectionBridgeAttachDeps`.
- `DomBoundary.ts` — DOM `(node, offset)` ↔ raw position translator. Constructed inside `DomSelectionBridge`.
- `textOffsets.ts` — pure helpers used by `DomBoundary` and the placement primitives.
- `caretDom.ts` — stateless DOM caret helpers (`getCaretIndex`, `setAtElement`, `setAtX`, `getRect`, `isOnFirstLine`, `isOnLastLine`, `placeAtTextOffset`, `placeAtChildBoundary`, `placeRangeAcrossSurfaces`, `focusIfNeeded`).

## Public Surface

- `range: Signal<Range | undefined>` — single source of truth for caret/selection. Writes propagate to the DOM via `watch(range)` → `DomSelectionBridge.applyRange`.
- `position: Signal<number | undefined>` — writable computed bound to `range.start`; writes collapse the range to `{start: pos, end: pos}`.
- `isUserSelecting: Signal<boolean>` — selection-in-progress signal. Pushed to `TextSurfaces.setSelecting` so structural text surfaces flip to `contenteditable="false"` during drags.
- `isAllSelected: Signal<boolean>` — computed; true when the selection spans the entire raw value.
- `selectAll()`, `focusFirst()`, `placeAtAddress(address, boundary)` — imperative helpers.
- `readRaw()`, `rawPositionFromBoundary(node, offset, affinity)`, `readSelectedContent()` — boundary reads, available to non-selection consumers (keyboard, clipboard, overlay) because the `DomBoundary` instance lives inside this feature.

## Wiring

The controller constructs `DomSelectionBridge` in its body. Inside `host.onMounted`, it calls `bridge.attach(container, deps)` with `onRangeRead`, the `isUserSelecting` signal, and `isPlacingCaret` accessor. Two watches relay caret intent: one on `range`, one on `bridge.indexed`.
