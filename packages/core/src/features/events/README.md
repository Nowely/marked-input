# Events Feature

The Events feature provides a type-safe event system for communication between components.

## Components

- **EventBus**: Pub-sub event system with typed event keys and listeners

## Features

- Type-safe event handling with Symbol-based event keys
- Multiple listeners per event
- Automatic cleanup with unsubscribe functions
- Support for complex event payloads

## Usage

```typescript
import {EventBus} from '@core/features/events'
import {EventKey} from '@core/shared/types'

const EVENT_UPDATE = Symbol('update') as EventKey<string>

const bus = new EventBus()
const unsubscribe = bus.on(EVENT_UPDATE, data => console.log(data))

bus.send(EVENT_UPDATE, 'new data')
unsubscribe()
```
