# Store Feature

The central orchestrator of the markput system. Aggregates reactive state, computed values, events, DOM refs, node proxies, features, lifecycle, slots, and supporting classes.

## Components

- **Store**: Main state container that manages:
    - **Internal state** (`store.state`) — signals owned by features: tokens, previous value, inner value, recovery, selection mode, overlay match/trigger
    - **Props** (`store.props`) — readonly signals written only via `setProps()` (value, options, readOnly, drag, slots, etc.)
    - **Computed** (`store.computed`) — derived values: `hasMark`, `parser`, `containerClass`, `containerStyle`, slot resolvers
    - **Events** (`store.event`) — typed events: change, parse, delete, select, overlay, sync, focus, drag, lifecycle, and more
    - **DOM refs** (`store.refs`) — container and overlay HTMLElement references
    - **Node proxies** (`store.nodes`) — `focus` and `input` NodeProxy instances
    - **Features** (`store.features`) — all feature instances
    - **`setProps()`** — batch update for framework-provided prop signals (used by React/Vue `MarkedInput`)

Features update internal state by calling each signal, e.g. `store.state.tokens(next)`. For multiple internal updates in one tick, wrap in `batch()` from `@markput/core` (same module as `Store`).

## Usage

```typescript
import {Store, batch} from '@markput/core'

const store = new Store()
store.setProps({value: 'Hello @[world](test)', readOnly: false})

batch(() => {
    store.state.tokens(newTokens)
    store.state.previousValue(serialized)
})
```

The Store is created by framework wrappers and passed to all features. Features communicate through `store.state`, `store.props`, `store.event`, and `store.nodes`.

## Readonly Props

All `store.props` signals are created with `{readonly: true}`. Direct writes like `store.props.value('x')` are silently ignored at runtime. Only `setProps()` can mutate props — it uses `batch(fn, {mutable: true})` to temporarily open the write gate.

This enforces the architectural rule: framework adapters (React/Vue `MarkedInput`) write props via `setProps()`; features and other consumers only read.
