# Event Primitive Design

**Date:** 2026-04-09  
**Branch:** correct-signals  
**Status:** Approved

## Problem

The current codebase has two separate event primitives:

- `voidEvent()` — uses `getActiveSub()` to detect call context: inside an effect = subscribe, outside = emit. Implicit and surprising.
- `payloadEvent<T>()` — uses `args.length`: `e(payload)` = emit, `e()` = subscribe. Consistent but separate type.

Issues:

1. Two types for the same concept — users must choose between them
2. `voidEvent` silently changes behavior based on call context (context sniffing via `getActiveSub()`)
3. No explicit emit surface — calling the event to emit looks identical to calling it to subscribe

## Design

### Unified `event<T>()` factory

Replace both primitives with a single `event<T = void>()` function.

```ts
interface Event<T = void> {
    /** Read/subscribe — auto-tracks inside effects. Returns latest payload or undefined. */
    (): T | undefined
    /** Emit — always fires, even for the same payload reference. */
    emit(payload: T): void
    /** Framework hook bridge. */
    use(): T | undefined
}

function event<T = void>(): Event<T>
```

### Calling convention

| Call              | Meaning                         | When                         |
| ----------------- | ------------------------------- | ---------------------------- |
| `e()`             | Subscribe / read latest payload | Always — no context sniffing |
| `e.emit()`        | Emit (void event)               | Always                       |
| `e.emit(payload)` | Emit with payload               | Always                       |

`e()` is always a read. `e.emit()` is always a write. No `getActiveSub()` anywhere.

### Void events

```ts
const change = event() // Event<void>
change.emit() // emit
change() // subscribe in effects, returns undefined
```

### Payload events

```ts
const del = event<{token: Token}>()
del.emit({token}) // emit — always fires (boxed internally)
del() // subscribe, returns {token} | undefined
```

### Integration with `watch`

`watch` is unchanged. The dep function calls `e()` to establish tracking:

```ts
watch(
    () => store.events.change(), // dep: subscribe
    () => {
        /* handler */
    }
)

watch(
    () => store.events.delete(), // dep: subscribe
    () => {
        const payload = store.events.delete() // read latest payload
        if (!payload) return
        // ...
    }
)
```

### Internal implementation

Unified box trick (same as current `payloadEvent`):

```ts
export function event<T = void>(): Event<T> {
    let seq = 0
    const inner = alienSignal<{v: T; id: number} | undefined>(undefined)

    const callable = function eventCallable() {
        const box = inner()
        return box !== undefined ? box.v : undefined
    } as unknown as Event<T>

    callable.emit = (payload: T) => inner({v: payload, id: ++seq})
    callable.use = () => getUseHookFactory()(callable)() as T | undefined

    return callable
}
```

The box `{v, id}` ensures every `.emit()` fires subscribers even when the same reference is passed.  
`seq` is a monotonically increasing integer — no reliance on object identity for uniqueness.

## Migration

All `voidEvent()` and `payloadEvent<T>()` call sites update mechanically:

| Before                            | After              |
| --------------------------------- | ------------------ |
| `voidEvent()`                     | `event()`          |
| `payloadEvent<T>()`               | `event<T>()`       |
| `ev()` (emit outside effect)      | `ev.emit()`        |
| `ev(payload)` (emit)              | `ev.emit(payload)` |
| `ev()` (subscribe in dep)         | `ev()` — unchanged |
| `ev()` (read payload in callback) | `ev()` — unchanged |

### Store events (example)

```ts
// Before
readonly events = {
  change: voidEvent(),
  parse: voidEvent(),
  delete: payloadEvent<{token: Token}>(),
  select: payloadEvent<{mark: Token; match: OverlayMatch}>(),
  clearOverlay: voidEvent(),
  checkOverlay: voidEvent(),
}

// After
readonly events = {
  change: event(),
  parse: event(),
  delete: event<{token: Token}>(),
  select: event<{mark: Token; match: OverlayMatch}>(),
  clearOverlay: event(),
  checkOverlay: event(),
}
```

Emit sites in controllers/handlers change from `store.events.change()` to `store.events.change.emit()`.  
Subscribe deps and payload reads are unchanged.

## Exports

`voidEvent` and `payloadEvent` are deleted from all exports.  
`event` is added in their place.

```ts
// signals/index.ts
export {signal, effect, event, watch, batch} from './signal'
export type {Signal, Event, SignalValues} from './signal'
```

## Tests

- Delete `voidEvent()` and `payloadEvent<T>()` describe blocks
- Add unified `event<T>()` describe block covering:
    - Returns `undefined` before first emit
    - `e()` auto-tracks inside effects
    - `e.emit()` always fires (void)
    - `e.emit(payload)` always fires, even same reference
    - Multiple effects subscribe independently
    - No infinite loop when `e()` called inside effect
    - `e.use()` delegates to registered factory
