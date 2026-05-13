# DomController → DomModel refactor

## Goal

Replace the 829-line `dom/DomController.ts` god class with a focused `DomModel` and a small set of single-purpose collaborators. The public surface accessed via `store.dom.*` stays the same so consumers (keyboard, caret, overlay, clipboard, MarkputHandler, framework adapters) do not churn.

## Current state

`features/dom/DomController.ts` does six things:

1. **Container + ref registry** — `container` signal, `controlFor()` / `childrenFor()` ref callbacks, `#pendingControls` / `#pendingChildSequences`, composition flags, `index` / `diagnostics` / `indexed` / `readOnly` exposures.
2. **DOM indexing** — `#commitRendered`, `#indexBlockTokens`, `#indexTokenSequence`, `#indexTokenElement`, `#indexNestedTokenSequence`, `#childSequenceHostsFor`, `#isControlRoot`, `#elementChildren`, plus the `#pathElements` / `#elementRoles` maps and `locateNode()`.
3. **Text-surface reconciliation** — `reconcile()`, `#reconcileStructuralTextSurfaces`.
4. **Raw boundary mapping** — `rawPositionFromBoundary`, `readRawSelection`, `#rawPositionFromContainerBoundary`, `#rawPositionFromTokenChildBoundary`, `#locateRegisteredDescendant`.
5. **Caret placement** — `placeAt`, `placeRange`, `focusAddress`, `#findTextTargetForRawPosition`, `#focusMarkBoundaryForRawPosition`, `#placeCaretInTextSurface`, `#placeCollapsedBoundary`, `#placeSelection`, `#boundaryInTextSurface`.
6. **Text-offset utilities** — `nextTextNode`, `splitsSurrogatePair`, `textOffsetWithin`, `textOffsetFromTreeWalker`, `textLength`, `elementBoundaryOffset`, `hasEditableAncestorBefore` (free functions at the top of the file).

## Target structure

```
features/dom/
  DomModel.ts          # public class (replaces DomController), composes the pieces below
  DomIndexer.ts        # responsibility 2 + 3 (indexer owns reconcile because it depends on #pathElements)
  DomBoundary.ts       # responsibility 4
  DomCaretPlacer.ts    # responsibility 5
  textOffsets.ts       # responsibility 6 (free helper functions)
  isTextTokenSpan.ts   # unchanged
  README.md            # updated to describe the new split
  index.ts             # re-exports `DomModel` (and `isTextTokenSpan`)
  DomModel.spec.ts     # renamed from DomController.spec.ts
```

### DomModel (public facade)

Owns:

- Signals: `container`, `index` (computed view of `#domIndex`), `readOnly` (computed from props).
- Events: `diagnostics`, `indexed`.
- Ref registries: `controlFor(ownerPath?)`, `childrenFor(ownerPath)` plus the underlying `#pendingControls` / `#pendingChildSequences` maps.
- Composition flags: `compositionStarted()`, `compositionEnded()`.
- Generation counter and the `#domIndex` write-side signal.

Composes:

- `#indexer = new DomIndexer(this, lifecycle, props, parsing)`
- `#boundary = new DomBoundary(this, parsing)`
- `#caret = new DomCaretPlacer(this, parsing, value)`

Re-exposes (thin delegation, same signatures as today):

- `reconcile(opts?)` → `#indexer.reconcile(opts)`
- `locateNode(node)` → `#indexer.locateNode(node)`
- `rawPositionFromBoundary(node, offset, affinity?)` → `#boundary.fromBoundary(...)`
- `readRawSelection()` → `#boundary.readSelection()`
- `placeAt(rawPos, affinity?)` → `#caret.placeAt(...)`
- `placeRange(range)` → `#caret.placeRange(...)`
- `focusAddress(address, boundary?)` → `#caret.focusAddress(...)`

The body of `DomModel` is small (state + thin delegators + the click-on-empty handler that lives in `lifecycle.onMounted`).

### DomIndexer

Internal-only (constructed by `DomModel`). Owns:

- `#pathElements: Map<string, PathElements>`, `#elementRoles: WeakMap<HTMLElement, RegisteredRole>`.
- `#rendering` / `#queuedRender` re-entry guard, `#generation` counter.
- Public methods: `locateNode(node)`, `reconcile(opts?)`, `pathElementsFor(address)`, `pathElements(): Iterable<PathElements>`.
- Privates: `#commitRendered`, `#indexBlockTokens`, `#indexTokenSequence`, `#indexTokenElement`, `#indexNestedTokenSequence`, `#childSequenceHostsFor`, `#isControlRoot`, `#elementChildren`, `#reconcileStructuralTextSurfaces`.

Wiring: `DomModel` registers two `lifecycle.onMounted` callbacks — one for the existing click-on-empty listener, one that calls `#indexer.bind()` which sets up `watch(lifecycle.rendered, ...)` and `watch(props.readOnly, ...)`. The indexer reads `model.container()`, the pending registries, props, and the parse controller; it pushes the indexed generation back to the model through a narrow `model.commitIndex(generation)` method and emits `model.indexed()` / `model.diagnostics(...)` via methods on the model.

### DomBoundary

Internal-only. Owns the boundary→raw mapping. Methods:

- `fromBoundary(node, offset, affinity)` (today's `rawPositionFromBoundary`).
- `readSelection()` (today's `readRawSelection`).
- Privates: `#fromContainerBoundary`, `#fromTokenChildBoundary`, `#locateRegisteredDescendant`.

Depends on: `model.container()`, `model.index()`, `model.locateNode(...)` (through model facade or directly on indexer ref), `parsing.index()`, and helpers from `textOffsets.ts` (`textOffsetWithin`, `hasEditableAncestorBefore`).

### DomCaretPlacer

Internal-only. Owns range placement. Methods:

- `placeAt(rawPos, affinity)`, `placeRange(range)`, `focusAddress(address, boundary)`.
- Privates: `#findTextTargetForRawPosition`, `#focusMarkBoundaryForRawPosition`, `#placeCaretInTextSurface`, `#placeCollapsedBoundary`, `#placeSelection`, `#boundaryInTextSurface`.

Depends on: `model.index()`, indexer queries (iterate `#pathElements`), `parsing.index()`, `value.current()`.

### textOffsets.ts

Pure helpers used by DomBoundary (and possibly DomCaretPlacer):

- `nextTextNode(walker)`
- `splitsSurrogatePair(text, offset)`
- `textOffsetWithin(surface, node, offset)`
- `textOffsetFromTreeWalker(surface, target, targetOffset)`
- `textLength(surface)`
- `elementBoundaryOffset(surface, offset)`
- `hasEditableAncestorBefore(node, boundary)`

No state, no class. Easy to unit-test in isolation if we later want to.

## Cross-piece API (internal)

To avoid each collaborator needing the others' private maps, the `DomIndexer` exposes a narrow internal interface that `DomBoundary` and `DomCaretPlacer` consume through their constructor argument (the indexer instance):

```ts
interface DomIndexAccess {
  locateNode(node: Node): NodeLocationResult
  pathElements(): Iterable<PathElements>             // for caret placer
  pathElementsFor(address: TokenAddress): PathElements | undefined  // for focusAddress
}
```

The `DomModel` constructs `DomIndexer` first, then passes the indexer reference into `DomBoundary` and `DomCaretPlacer`. Consumers of `store.dom.*` see no difference.

## Data flow (unchanged)

1. Framework refs → `model.container(el)`, `model.controlFor(path)`, `model.childrenFor(path)` → registries in DomModel.
2. `lifecycle.rendered` → `DomIndexer.#commitRendered` rebuilds `#pathElements` / `#elementRoles`, writes `#domIndex`, fires `model.indexed`.
3. `props.readOnly` change → `DomIndexer.reconcile()`.
4. Consumer queries (`store.dom.locateNode`, `store.dom.placeAt`, etc.) → DomModel delegates to the right collaborator.

## Public API impact

- `store.dom` is now an instance of `DomModel` instead of `DomController`. All method signatures and signal/event names stay identical.
- Type imports throughout the codebase change `import type {DomController} from '../dom/DomController'` to `import type {DomModel} from '../dom/DomModel'`. Affected files (8):
  - `features/caret/TriggerFinder.ts`
  - `features/caret/CaretModel.ts`
  - `features/overlay/OverlayController.ts`
  - `features/keyboard/KeyboardController.ts`
  - `features/clipboard/ClipboardController.ts`
  - `shared/classes/MarkputHandler.ts`
  - `store/Store.ts`
  - `features/dom/index.ts`
- `DomController.spec.ts` is renamed to `DomModel.spec.ts`; the only code change is the `describe('DomController structural indexing', ...)` string. Tests cover behavior, not class identity, so they should pass without further changes.

## Testing

The existing 560-line `DomController.spec.ts` exercises end-to-end behavior through `store.dom.*`. Because the public API is preserved, every existing assertion remains valid. No new tests are required for the refactor itself, but the work is acceptance-gated on:

- `pnpm --filter @markput/core test --run` — must pass.
- `pnpm --filter @markput/react build` and `pnpm --filter @markput/vue build` — must succeed.

If any of `textOffsets.ts`'s helpers become awkward to test through the public surface, we can add a tiny `textOffsets.spec.ts` — but only if needed.

## Out of scope

- Changing any behavior. This is a pure structural refactor.
- Touching `features/caret/CaretModel.ts`, `features/parsing/*`, or framework adapters beyond import path updates.
- Splitting `DomIndexer` further (e.g. separating the inline vs block indexing strategies) — the indexing block is large but cohesive; revisit if it grows again.
- Renaming `store.dom` to `store.domModel` or exposing the collaborators on the store — the facade is the right boundary.

## Risks & mitigations

- **Mid-refactor breakage from circular deps.** DomBoundary and DomCaretPlacer both need indexer access. Mitigation: pass the indexer instance explicitly through constructors; never reach back to the model for indexer state.
- **Subtle behavior drift on re-entry / reconcile.** The `#rendering` / `#queuedRender` guard sits in indexer now; verify reconcile triggered from `props.readOnly` watcher still composes correctly. Spec coverage includes readOnly toggles.
- **Spec describe-block churn confuses git blame.** Acceptable cost for a clearer file structure; the rename itself is one commit so blame walks through cleanly.
