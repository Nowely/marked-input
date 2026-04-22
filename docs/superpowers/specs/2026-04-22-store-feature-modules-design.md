# Store Feature Modules — Ownership Refactor

## Problem

`packages/core/src/store/Store.ts` is a 229-line registry that centralizes four parallel maps for the entire editor:

- `props` — 15 readonly signals (public API from framework adapters)
- `state` — 8 internal signals
- `computed` — 12 derived values
- `emit` — 10 events

Every feature class (`OverlayFeature`, `FocusFeature`, `InputFeature`, …) reads and writes fields on these central maps but declares none of them. Ownership is implicit: to know who writes `innerValue` you have to grep across 11 feature files. New engineers can't answer "where does this state live?" without reading Store.ts and chasing call sites.

Two independent code reviews confirmed the coupling is not just aesthetic:

- `innerValue` is written by keyboard, drag, clipboard, and the system listener — no single owner.
- `previousValue` is written by parsing, the system listener, and input — again no single owner.
- `SystemListenerFeature` is effectively a "bag of leftover event handlers" that writes into whatever state it needs.
- `hasMark` lives on `store.computed` as a parser concern, but it's really a mark-capability check.
- `sync` event is emitted by focus and consumed by `ContentEditableFeature` — neither "caret" nor "system" captures what it actually does (DOM reconciliation).

## Goal

Distribute `state`, `computed`, and `emit` from the central maps into feature classes so each feature owns its reactive surface. Access becomes `store.feature.<name>.state.<field>` / `.computed.<field>` / `.emit.<event>`. `props` stays centralized as the public API surface. The new layout must:

1. Give every signal, computed, and event a single, intuitive owner feature.
2. Keep one clear entry point (`store.feature.*`) so readers can list every slice from one file.
3. Reuse the existing `enable()` / `disable()` lifecycle contract.
4. Preserve all current behavior (no semantic changes).

## Non-goals

- Not changing the public API of `@markput/core`, `@markput/react`, or `@markput/vue`.
- Not changing `props` ownership — `store.props` stays as-is (the `<MarkedInput>` prop surface).
- Not introducing a new reactivity primitive or DI system. Features still receive `Store` via constructor.
- Not tree-shaking features or adding a plugin system.
- Not modifying the parser, caret math, drag algorithms, or any runtime behavior.
- Not touching `store.key`, `store.blocks`, `store.nodes`, `store.handler` — these stay on the `Store` root as infrastructure.

## Approach

**Class-based slices (Approach B).** Each feature class exposes its own `state`, `computed`, `emit` as public readonly fields. Store constructs all features in a `feature` record:

```ts
class Store {
  readonly props    = {...}                    // centralized, unchanged
  readonly key      = new KeyGenerator()
  readonly blocks   = new BlockRegistry()
  readonly nodes    = {focus: new NodeProxy(...), input: new NodeProxy(...)}
  readonly handler  = new MarkputHandler(this)

  readonly feature = {
    lifecycle: new LifecycleFeature(this),
    value:     new ValueFeature(this),
    parsing:   new ParsingFeature(this),
    mark:      new MarkFeature(this),
    overlay:   new OverlayFeature(this),
    slots:     new SlotsFeature(this),
    drag:      new DragFeature(this),
    clipboard: new ClipboardFeature(this),
    keyboard:  new KeyboardFeature(this),
    caret:     new CaretFeature(this),
    dom:       new DomFeature(this),
  }

  setProps(values) {...}
}
```

Each feature follows one shape:

```ts
export class ValueFeature {
  readonly state = {
    previousValue: signal<string | undefined>(undefined),
    innerValue:    signal<string | undefined>(undefined),
  }
  readonly computed = {
    currentValue: computed(() => this.state.previousValue() ?? this.#store.props.value() ?? ''),
  }
  readonly emit = {
    change: event(),
  }

  constructor(readonly #store: Store) {}

  enable()  { /* wire effect handlers (e.g. SystemListener's change/innerValue watchers) */ }
  disable() { /* dispose effect scope */ }
}
```

Cross-feature access is explicit: `store.feature.parsing.state.tokens()`, `store.feature.overlay.emit.overlayClose()`. This makes every cross-slice read greppable and locatable.

### Why class-based over closures

- Existing feature files are already classes with `enable` / `disable` methods. Smallest diff from today.
- TypeScript infers `store.feature.parsing.state.tokens` correctly without helper types.
- `enable` / `disable` naturally stay as instance methods; no separate orchestration object needed.
- Classes match the "feature" terminology used throughout architecture docs.

### Why keep `props` centralized

`store.props` mirrors the `<MarkedInput>` component API 1:1. Splitting it across features would force adapters to call `store.feature.overlay.setProps({Overlay})` / `store.feature.drag.setProps({draggable})` etc., complicating the framework bridge for no reader benefit. One `setProps()` call on `Store` keeps the public surface ergonomic.

## Architecture

### Feature Inventory — 11 features

| # | `store.feature.*` | Class | Derived from | `state` | `computed` | `emit` |
|---|---|---|---|---|---|---|
| 1 | `lifecycle` | `LifecycleFeature` | *(new)* | — | — | `mounted`, `unmounted`, `rendered` |
| 2 | `value` | `ValueFeature` | *(new; absorbs `SystemListenerFeature` `change` + `innerValue` watchers)* | `previousValue`, `innerValue` | `currentValue` | `change` |
| 3 | `parsing` | `ParsingFeature` | `ParseFeature` | `tokens` | `parser` | `reparse` |
| 4 | `mark` | `MarkFeature` | *(new; hosts `MarkHandler`; absorbs `SystemListenerFeature` `markRemove` watcher)* | — | `hasMark`, `mark` | `markRemove` |
| 5 | `overlay` | `OverlayFeature` | `OverlayFeature` *(absorbs `SystemListenerFeature` `overlaySelect` watcher)* | `overlayMatch`, `overlay` *(DOM ref)* | `overlay` *(computed)* | `overlaySelect`, `overlayClose` |
| 6 | `slots` | `SlotsFeature` | *(new)* | `container` *(DOM ref)* | `isBlock`, `isDraggable`, `containerComponent`, `containerProps`, `blockComponent`, `blockProps`, `spanComponent`, `spanProps` | — |
| 7 | `drag` | `DragFeature` | `DragFeature` | — | — | `drag` |
| 8 | `clipboard` | `ClipboardFeature` | `CopyFeature` | — | — | — |
| 9 | `keyboard` | `KeyboardFeature` | `InputFeature` + `BlockEditFeature` + `ArrowNavFeature` *(merged; three internal modules preserved)* | — | — | — |
| 10 | `caret` | `CaretFeature` | `FocusFeature` + `TextSelectionFeature` | `recovery`, `selecting` | — | — |
| 11 | `dom` | `DomFeature` | `ContentEditableFeature` | — | — | `reconcile` *(renamed from `sync`)* |

`SystemListenerFeature` is **dissolved** — its four event watchers redistribute to their natural owners (`value`, `mark`, `overlay`). No "leftover" slice remains.

### Stays on `Store` root (unchanged infrastructure)

| Field | Purpose |
|---|---|
| `store.props` | Centralized public-API surface (15 readonly signals) |
| `store.key` | `KeyGenerator` for render-stable token keys |
| `store.blocks` | `BlockRegistry` (WeakMap of per-token drag/menu state) |
| `store.nodes` | `{focus, input}` NodeProxy references (DOM navigation helpers) |
| `store.handler` | `MarkputHandler` façade (external handler API) |
| `store.feature` | The 11 slices above |
| `store.setProps(...)` | Batched adapter entry point |

### Access pattern

```ts
// Read tokens (any feature):
this.#store.feature.parsing.state.tokens()

// Emit close from a keyboard module:
this.#store.feature.overlay.emit.overlayClose()

// Subscribe to reconcile from the DOM feature:
watch(this.#store.feature.dom.emit.reconcile, () => this.align())

// Framework adapter writes props (unchanged):
store.setProps({value: 'hi', readOnly: false})
```

### Ownership rules

1. **Writer is owner.** Every `state` / `emit` field is owned by the feature that is its *primary* writer / emitter in current code. Secondary writers (cross-slice writes) are allowed but explicit.
2. **Computed follows semantic home.** Computed values live on the feature they conceptually describe, not the feature that consumes them. `hasMark` → `mark` (not `parsing`). `isDraggable` → `slots` (not `drag`, because the only consumer is `buildContainerProps` in slots).
3. **Props stay centralized.** `props.*` is never split into feature slices. Features read `this.#store.props.<x>` directly.
4. **Store root is infrastructure only.** Anything that isn't a reactive signal/computed/event stays on `Store` directly (`key`, `blocks`, `nodes`, `handler`).
5. **Cross-slice reads are explicit.** `store.feature.X.state.Y` shows both the owner and the field at the call site. No magic resolvers, no context lookups.

### Notable re-homing decisions

| Field | Old home | New home | Reason |
|---|---|---|---|
| `hasMark` | `store.computed` (consumed by parser) | `feature.mark.computed` | Asks "is a Mark slot configured?" — a mark-capability check, not a parser concern. |
| `isDraggable` | `store.computed` (conceptually drag) | `feature.slots.computed` | The only consumer is `buildContainerProps` (slots). Drag doesn't read it. |
| `currentValue` | `store.computed` | `feature.value.computed` | It's `previousValue ?? props.value` — the editable-string view, colocated with its inputs in `value`. |
| `sync` event | `store.emit` | `feature.dom.emit.reconcile` | Renamed. The handler reconciles DOM attributes + textContent with token state — "reconcile" matches the verb. |
| `container` DOM ref | `store.state.container` | `feature.slots.state.container` | Set by the `<Container>` slot component; slots owns container rendering. |
| `overlay` DOM ref | `store.state.overlay` | `feature.overlay.state.overlay` | Set by the `<Overlay>` portal; overlay owns overlay DOM. |
| `markRemove` event | `store.emit` | `feature.mark.emit.markRemove` | Only emitter is `MarkHandler` (hosted in mark). |
| `change` event | `store.emit` | `feature.value.emit.change` | Multi-emitter (input, deleteMark, MarkHandler), but semantic home is the value slice (every emission represents "the value mutated"). |
| `previousValue` / `innerValue` | `store.state` (no clear owner) | `feature.value.state` | Dedicated value slice replaces the ambiguous multi-writer pattern. |
| `reparse` event | `store.emit` | `feature.parsing.emit.reparse` | Parsing is the primary consumer (re-runs the parser); emitters outside parsing (system listener) now live inside `value` and emit across slices. |

### Feature consolidation rationale

**Keyboard merge** (`Input` + `BlockEdit` + `ArrowNav`). All three attach to the `container` keydown/beforeinput surface, all three early-return based on `isBlock`, and all three share the same mental model ("the editor reacting to typed keys"). The original three-way split (per `architecture.md`) was done for class-size reasons, not because the domains are distinct. The merge preserves the three modules as internal files:

```
features/keyboard/
  KeyboardFeature.ts    # facade: owns enable/disable, delegates to modules
  input.ts              # former InputFeature logic
  blockEdit.ts          # former BlockEditFeature logic
  arrowNav.ts           # former ArrowNavFeature logic
```

`KeyboardFeature.enable()` calls each module's `enable(store)`; same for disable. No shared state between modules beyond `store`.

**Caret (`Focus` + `TextSelection`).** Focus handles caret position recovery; TextSelection tracks selection mode. Both live in the "where is the caret / what is selected" conceptual space. They're intentionally kept separate from DOM reconciliation (`dom`), which does a different job.

**Dom (`ContentEditable` extracted).** DOM attribute + textContent alignment is a distinct concern: it mirrors token state into the live DOM. Owning `reconcile` as its event makes the data flow explicit:

```
lifecycle.rendered → caret.recovers → dom.reconcile → dom.align()
```

**System listener dissolution.** `SystemListenerFeature` today watches four events (`change`, `innerValue`, `markRemove`, `overlaySelect`). Each watcher belongs with the feature that owns the event's natural consumer:

| Watcher | New home | Why |
|---|---|---|
| `watch(change, …)` → writes `previousValue`, emits `reparse` | `value` | Writes value state |
| `watch(innerValue, …)` → reparses and writes `tokens` | `value` | Reads/writes value state |
| `watch(markRemove, …)` → slices tokens, writes `innerValue` | `mark` | Owns `markRemove`; writes value state cross-slice |
| `watch(overlaySelect, …)` → inserts markup, writes `recovery`/`innerValue` | `overlay` | Owns `overlaySelect` |

## Migration Strategy

The work proceeds in bottom-up order, **one feature slice per commit**, so each commit leaves the repo building and tests passing. Shape:

1. **Set up scaffolding.** Introduce `store.feature` as an empty record alongside the existing `store.feature`. Existing features keep reading from `store.state` / `store.computed` / `store.emit` during migration.
2. **Introduce `LifecycleFeature`** (simplest — pure events). Move `mounted`, `unmounted`, `rendered` into it. Update references across features (one sweep).
3. **Introduce `ValueFeature`.** Move `previousValue`, `innerValue`, `currentValue`, `change`. Move `SystemListenerFeature`'s `change` + `innerValue` watchers into `ValueFeature.enable()`.
4. **Introduce `ParsingFeature`.** Replace the existing `ParseFeature` class-and-directory. Move `tokens`, `parser`, `reparse`.
5. **Introduce `MarkFeature`.** Move `hasMark`, `mark` computed, `markRemove`. Move SystemListener's `markRemove` watcher.
6. **Introduce `OverlayFeature` v2.** Move `overlayMatch`, overlay DOM ref, `overlay` computed, `overlaySelect`, `overlayClose`. Move SystemListener's `overlaySelect` watcher.
7. **Introduce `SlotsFeature`.** Move `container` DOM ref, `isBlock`, `isDraggable`, all slot computeds/props.
8. **Introduce `DragFeature` v2.** Move `drag` event.
9. **Introduce `ClipboardFeature`.** Rename + relocate `CopyFeature`.
10. **Introduce `KeyboardFeature`.** Merge `InputFeature` + `BlockEditFeature` + `ArrowNavFeature` into internal modules.
11. **Introduce `CaretFeature`.** Merge `FocusFeature` + `TextSelectionFeature`.
12. **Introduce `DomFeature`.** Rename `ContentEditableFeature`. Rename `sync` → `reconcile`.
13. **Delete `SystemListenerFeature`.** All watchers have been redistributed.
14. **Remove legacy `store.state` / `store.computed` / `store.emit` maps** from `Store.ts`.

Each step:
- Adds the new feature class under its own directory (`features/<name>/`).
- Adds / updates the feature's README.
- Updates all call sites (features, framework adapters, hooks, tests) to read from the new location.
- Keeps `store.state.X` aliases temporarily during the step (as getters forwarding to the new location) if the step can't convert every call site in one commit. Aliases are removed in the final cleanup commit.

Pure mechanical changes (rename + move + update imports) should dominate; any behavioral change flagged in review blocks the step.

## Testing

- All existing `*.spec.ts` files continue to pass after each commit. If a test imports `store.state.X`, it's updated to `store.feature.<name>.state.X`.
- `Store.spec.ts` adds per-feature shape tests (`expect(store.feature.value.state.previousValue).toBeDefined()` etc.) to lock the public surface.
- Storybook browser tests re-run unchanged — they exercise behavior, not Store layout.
- `pnpm test`, `pnpm run build`, `pnpm run typecheck`, `pnpm run lint:check`, `pnpm run format:check` must all pass at every commit.

## Documentation updates

- `packages/core/src/store/README.md` — rewritten to describe `store.feature.*`.
- `packages/website/src/content/docs/development/architecture.md` — Store Structure section rewritten; feature table updated to 11 features; event table updated for `reconcile`.
- `AGENTS.md` "Do NOT" section — the line "add new state keys to either `state` or `props` in `Store.ts`" changes to "add new state to the owning feature's `state` / `computed` / `emit`; `props` remains in `Store.ts`."
- Every feature folder (`features/*/README.md`) — updated to list its owned `state`, `computed`, `emit` fields.

## Open questions / risks

1. **Feature construction order.** `SlotsFeature.computed.isBlock` is read during `buildContainerProps` construction. If any slice references another's computed *at construction time* (not inside effects), we need lazy computeds or a two-phase init. Current code only reads computeds inside effects/handlers, so construction order should not matter — validate this during the scaffold step.
2. **Readonly vs writable signals across slices.** Today `store.state.tokens` is mutable from any feature. Under the new layout a feature could expose `tokens` as readonly externally. Decision: keep signals mutable cross-slice in v1 to minimize behavior change; add readonly wrappers later if needed.
3. **Framework adapter ref wiring.** The Vue and React `<Container>` components currently call `store.state.container(el)`. They'll need to call `store.feature.slots.state.container(el)`. Similarly for `<Overlay>` (→ `store.feature.overlay.state.overlay`). Adapter diff is small but touches both packages.
4. **Renaming `sync` → `reconcile`** is a breaking change for anyone who subscribed to `store.emit.sync` externally. Internal only; not part of the public package API (not exported from `@markput/core`). No external impact.

## Success criteria

- `Store.ts` shrinks to ≤ 80 lines (from 229) — props + infrastructure + feature record + `setProps`.
- Every `store.state.X` / `store.computed.X` / `store.emit.X` reference in the monorepo resolves to `store.feature.<owner>.<category>.X`.
- `store.feature.<name>` appears in all IDE autocompletion paths and TypeScript correctly infers the per-slice types without helper mapped types.
- `pnpm test`, `pnpm run build`, `pnpm run typecheck`, `pnpm run lint:check`, `pnpm run format:check` pass on every commit of the migration.
- No user-observable behavior change (snapshot + interaction tests unchanged).
