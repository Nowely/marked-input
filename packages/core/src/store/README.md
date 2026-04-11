# Store Feature

The central orchestrator of the markput system. Aggregates reactive state, computed values, events, DOM refs, node proxies, features, lifecycle, slots, and supporting classes.

## Components

- **Store**: Main state container that manages:
    - **Reactive state** (`store.state`) — 20+ signals for tokens, value, selection, overlay, options, readOnly, callbacks, styling, slots
    - **Computed** (`store.computed`) — derived values: `hasMark`, `parser`, `containerClass`, `containerStyle`
    - **Events** (`store.event`) — 12 typed events: change, parse, delete, select, clearOverlay, checkOverlay, sync, recoverFocus, dragAction, updated, afterTokensRendered, unmounted
    - **DOM refs** (`store.refs`) — container and overlay HTMLElement references
    - **Node proxies** (`store.nodes`) — `focus` and `input` NodeProxy instances
    - **Features** (`store.features`) — all feature instances
    - **Lifecycle** (`store.lifecycle`) — feature enable/disable manager
    - **Slots** (`store.slot`) — component customization system
    - **`setState()`** — batch-update method for multiple state signals

## Usage

```typescript
import {Store} from '@markput/core'

const store = new Store(options)
store.setState({value: 'Hello @[world](test)', readOnly: false})
```

The Store is created by framework wrappers and passed to all features. Features communicate exclusively through `store.state`, `store.event`, and `store.nodes`.
