# Store Feature

The Store feature provides centralized state management for the MarkedInput component.

## Components

- **Store**: Main state container that manages tokens, focus, recovery state, and component references

## Features

- Reactive state management with proxy-based change detection
- Event-driven updates through EventBus
- DOM node management with NodeProxy
- Unique key generation for components
- Recovery mechanism for caret positioning

## Usage

```typescript
import {Store} from '@core/features/store'

const store = Store.create(props)
// State changes trigger events automatically
```
