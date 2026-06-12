# Store Feature

The central orchestrator of the markput system. Aggregates reactive state, computed values, events, DOM registration, features, lifecycle, slots, and supporting classes.

## Components

- **Store**: Main state container that manages:
    - **Feature state** (`store.<feature>.*`) — signals owned by features: tokens, accepted serialized value, selection range, composition flags, overlay match
    - **Host** (`store.host`) — adapter-fed runtime state: the `rendered` event and the `container` HTMLElement signal. Written by React/Vue `MarkedInput`; features read. `host.onMounted(cb)` runs `cb(container)` whenever a container is attached, auto-disposing inner subscriptions on detach and re-running with the new element on swap.
    - **Props** (`store.props`) — readonly signals written only via `store.props.set()` (value, options, readOnly, drag, slots, etc.)
    - **Computed values** (`store.<feature>.*`) — derived values: `enabled`, `parser`, `selection.position`, `containerComponent`, `containerProps`, slot resolvers
    - **Events** (`store.<feature>.<event>()`) — typed reactive events: `overlay.select`, `overlay.close`, `block.action`, and host lifecycle events
    - **DOM refs** (`store.host.container`, `store.overlay.element`) — reactive signals holding container and overlay HTMLElement references
    - **Token layer** (`store.tokens`) — parsing, live node map, DOM↔model facade, adapter ref registries, and caret/selection DOM operations. See `features/tokens/README.md` for the full contract.
    - **Selection & Caret placement** (`store.selection`) — raw selection mapping and caret range placement
    - **Features** (`store.<feature>`) — all feature instances
    - **`store.props.set()`** — batch update for framework-provided prop signals (used by React/Vue `MarkedInput`)

Features update internal state by calling the owning feature signal. For multiple internal updates in one tick, wrap in `batch()` from `@markput/core` (same module as `Store`).

## Usage

```typescript
import {Store, batch} from '@markput/core'

const store = new Store()
store.props.set({value: 'Hello @[world](test)', readOnly: false})
```

The Store is created by framework wrappers and passed to all features. Features communicate through feature-owned state/events, `store.props`, and `store.selection`. `store.value.current` is the internal accepted serialized value state owned by `ValueModel`; feature code routes edits through `store.value.replace()` or `store.value.current()` instead of mutating tokens or accepted value state directly. `ValueModel` enforces `store.props.readOnly()` for editor-originated writes through the raw value edit pipeline; external controlled `props.value` updates still replace the accepted value.

## Readonly Props

All `store.props` signals are created with `{readonly: true}`. Direct writes like `store.props.value('x')` are silently ignored at runtime. Only `store.props.set()` can mutate props — it uses `batch(fn, {mutable: true})` to temporarily open the write gate.

This enforces the architectural rule: framework adapters (React/Vue `MarkedInput`) write props via `store.props.set()`; features and other consumers only read.
