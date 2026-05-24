# Bridge Feature

Owns the token↔DOM index plus the DOM-side state every other DOM-aware feature reads from. Exposed as `store.bridge`.

## Layout

- `DomTokenBridge.ts` — indexing class. Owns the `controlFor` / `childrenFor` ref-callback registries (consumed by adapters), the `compositionStarted/Ended/isComposing` flag (consumed by `DomSelectionBridge` via `DomBoundary`), and the `setSelecting` flag (pushed by `SelectionController.onMounted`). Indexes after `host.rendered`, reconciles structural text surfaces (`textContent` + `contentEditable`) when `props.readOnly` or `#selecting` changes.
- `isTextTokenSpan.ts` — DOM identity check exposed for adapters that need to recognise the span shape rendered for text tokens. Currently unused inside core; not re-exported from the top-level `@markput/core` barrel.

## Public Surface

- `indexed`, `isIndexed` — index lifecycle.
- `controlFor(ownerPath?)`, `childrenFor(ownerPath)` — adapter-facing ref-callback factories.
- `compositionStarted()`, `compositionEnded()`, `isComposing()` — composition gating, written by the keyboard feature.
- `setSelecting(active)` — write-only flag setter; pushed by `SelectionController` via a `watch(isUserSelecting, ...)` from inside `onMounted`. The bridge does not subscribe to selection state; it stores the flag and reconciles on transitions only.
- `locateNode`, `pathElements`, `pathElementsFor`, `roleFor`, `reconcile` — index reads, consumed by `DomSelectionBridge` and the keyboard feature.

## Wiring

`Store` constructs the bridge before `SelectionController`. Selection takes `bridge` as a constructor argument and pushes `isUserSelecting` changes via a one-line watch. No subscription crosses the construction boundary.

## Production Constraint

Production code must not infer token identity from public data attributes or user refs.
