# Store Feature

The central orchestrator of the markput system. Aggregates reactive state, computed values, events, DOM registration, features, lifecycle, slots, and supporting classes.

## Components

- **Store**: Main state container that manages:
    - **Feature state** (`store.<feature>.*`) — signals owned by features: tokens, accepted serialized value, recovery, selection mode, overlay match
    - **Props** (`store.props`) — readonly signals written only via `store.props.set()` (value, options, readOnly, drag, slots, etc.)
    - **Computed values** (`store.<feature>.*`) — derived values: `enabled`, `parser`, `isControlledMode`, `containerComponent`, `containerProps`, slot resolvers
    - **Events** (`store.<feature>.<event>()`) — typed reactive events: `value.change`, `parsing.reparse`, `overlay.select`, `overlay.close`, `drag.action`, and lifecycle events
    - **DOM refs** (`store.dom.container`, `store.overlay.element`) — reactive signals holding container and overlay HTMLElement references
    - **DOM registration** (`store.dom`) — adapter-owned structural refs, token location, raw selection mapping, and caret placement
    - **Features** (`store.<feature>`) — all feature instances
    - **`store.props.set()`** — batch update for framework-provided prop signals (used by React/Vue `MarkedInput`)

Features update internal state by calling the owning feature signal, e.g. `store.parsing.tokens(next)`. For multiple internal updates in one tick, wrap in `batch()` from `@markput/core` (same module as `Store`).

## Usage

```typescript
import {Store, batch} from '@markput/core'

const store = new Store()
store.props.set({value: 'Hello @[world](test)', readOnly: false})

batch(() => {
    store.parsing.tokens(newTokens)
})
```

The Store is created by framework wrappers and passed to all features. Features communicate through feature-owned state/events, `store.props`, `store.dom`, and `store.caret`. `store.value.current` is the internal accepted serialized value state owned by `ValueFeature`; feature code routes edits through `store.value.replaceRange()` or `store.value.replaceAll()` instead of mutating tokens or accepted value state directly. `ValueFeature` enforces `store.props.readOnly()` for editor-originated writes through the raw value edit pipeline; external controlled `props.value` updates still replace the accepted value.

## Readonly Props

All `store.props` signals are created with `{readonly: true}`. Direct writes like `store.props.value('x')` are silently ignored at runtime. Only `store.props.set()` can mutate props — it uses `batch(fn, {mutable: true})` to temporarily open the write gate.

This enforces the architectural rule: framework adapters (React/Vue `MarkedInput`) write props via `store.props.set()`; features and other consumers only read.
