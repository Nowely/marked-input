# Signals

A reactive system built on [alien-signals](./alien-signals/)' `createReactiveSystem()`. It provides four reactive primitives — **Signal**, **Computed**, **Event**, and **Effect** — plus batching, scoping, and watch utilities.

Design principles:

- **Function-call API** — signals and computeds are callable, not objects with `.get()`/`.set()` methods
- **Auto-tracking** — dependencies are captured automatically when reads happen inside `effect()` or `computed()`
- **Zero allocations for the happy path** — the core algorithm avoids `Array`, `Set`, and `Map`, using a doubly-linked list instead
- **Push-pull propagation** — changes push notifications down the graph, but values are pulled (recomputed lazily) only when read

## Conceptual Model

| Primitive | Models | Equality check | Re-propagates on same value? |
|---|---|---|---|
| `signal<T>` | State | `===` (or custom `equals`) | No |
| `computed<T>` | Derived state | `===` (or custom `equals`) | No |
| `event<T>` | Occurrences | None | Always |
| `effect()` | Side-effects | — | — |

## API

### `signal<T>(initial, options?)`

Creates a reactive state cell.

```ts
import {signal} from './signals'

const count = signal(0)

count()    // 0 — read
count(1)   // write
count()    // 1
```

**Default fallback.** If the signal was created with a non-`undefined` initial value, setting it to `undefined` reverts to that initial value:

```ts
const mode = signal('edit')
mode(undefined)
mode() // 'edit' — reverted to default
```

Signals created with `undefined` as initial have no default fallback — `undefined` is a valid value.

**Options:**

```ts
signal({id: 1, name: 'alice'}, {
  equals: (a, b) => a.id === b.id, // custom equality — skips propagation when true
  readonly: true,                   // ignores direct writes (see batch with mutable)
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `equals` | `(a: T, b: T) => boolean` | `===` | Return `true` to suppress propagation |
| `readonly` | `boolean` | `false` | Block writes except inside `batch(fn, {mutable: true})` |

### `computed<T>(getter, options?)`

Creates a lazily-evaluated derived value. The getter receives the previous value as its argument.

```ts
const count = signal(1)
const doubled = computed(() => count() * 2)

doubled()  // 2 — computed on first read
count(5)
doubled()  // 10 — recomputed because `count` changed
```

Computeds are **cached** — the getter only re-runs when a dependency changes and the result is read again:

```ts
let calls = 0
const expensive = computed(() => { calls++; return count() * 2 })

expensive()
expensive()
calls // 1 — cached, not recomputed

count(10)
expensive()
calls // 2 — recomputed because dependency changed
```

**Chained computeds** work naturally:

```ts
const a = signal(1)
const b = computed(() => a() + 1)
const c = computed(() => b() * 3)
c() // 6
```

**Previous value** is available as the getter's argument:

```ts
const items = signal<string[]>([])
const count = computed((prev = 0) => items().length)
```

**Options:**

```ts
const obj = computed(
  () => ({parity: count() % 2 === 0 ? 'even' : 'odd'}),
  {equals: (a, b) => a.parity === b.parity}
)
```

| Option | Type | Default | Description |
|---|---|---|---|
| `equals` | `(a: T, b: T) => boolean` | `===` | Return `true` to suppress downstream propagation |

### `event<T>()`

Creates a reactive event primitive. Unlike signals, events **always propagate** — every emission triggers subscribers, regardless of payload equality.

```ts
const onClick = event<{x: number; y: number}>()
const onReset = event() // void event

// Subscribe
effect(() => {
  const payload = onClick.read()
  // payload is undefined before first emit
})

// Emit
onClick({x: 10, y: 20})
onReset()
```

The split API is intentional:

- `ev(payload)` — emit (write-side)
- `ev.read()` — subscribe (read-side, auto-tracks inside effects)

This separation prevents accidental subscription when emitting.

### `effect(fn)`

Runs `fn` immediately, auto-tracks any signal/computed/event reads inside it, and re-runs when tracked dependencies change. Returns a dispose function.

```ts
const count = signal(0)

const dispose = effect(() => {
  console.log(count())
})
// Console: 0 — runs immediately

count(1)
// Console: 1 — re-runs because `count` changed

dispose()
count(2)
// No output — disposed
```

**Nested effects** are cleaned up when the outer effect re-runs:

```ts
const show = signal(true)
const count = signal(0)

effect(() => {
  if (show()) {
    effect(() => {
      console.log(count())
    }) // inner effect created
  }
})
// Console: 0

count(1)
// Console: 1

show(false) // inner effect is cleaned up
count(2)    // no output — inner effect no longer exists
```

### `effectScope(fn)`

Creates a scope that collects all effects created inside `fn`. Calling the returned dispose function cleans up all of them at once.

```ts
const count = signal(0)

const stop = effectScope(() => {
  effect(() => console.log(`A: ${count()}`))
  effect(() => console.log(`B: ${count()}`))
})
// Console: A: 0, B: 0

count(1)
// Console: A: 1, B: 1

stop()
count(2) // no output — both effects cleaned up
```

### `watch(source, callback)`

Watches a reactive source for changes. Skips the first run (unlike `effect`), and provides the previous value to the callback.

```ts
const count = signal(0)

const dispose = watch(count, (newVal, oldVal) => {
  console.log(`${oldVal} -> ${newVal}`)
})

count(1) // Console: 0 -> 1
count(5) // Console: 1 -> 5
```

Accepts three source types:

```ts
watch(mySignal, (val, prev) => { /* ... */ })
watch(myEvent, (val, prev) => { /* ... */ })
watch(() => myComputed(), (val, prev) => { /* ... */ })
```

The callback runs inside `untracked()` — reads inside the callback do not create subscriptions.

### `batch(fn, options?)`

Defers effect flush until `fn` completes. Multiple signal writes inside the batch trigger only a single effect run.

```ts
const a = signal(1)
const b = signal(2)
const sum = computed(() => a() + b())

effect(() => console.log(sum()))
// Console: 3

batch(() => {
  a(10)
  b(20)
  // sum not yet recomputed
})
// Console: 30 — single update
```

**Mutable option.** Allows writes to `readonly` signals inside the batch:

```ts
const config = signal('default', {readonly: true})

batch(() => {
  config('override')        // ignored — not mutable
})

batch(() => {
  config('override')
}, {mutable: true})         // allowed
```

Nested batches restore the mutable scope correctly:

```ts
batch(() => {
  batch(() => {
    config('a') // allowed — inner mutable
  }, {mutable: true})
  config('b') // ignored — outer is not mutable
})
```

### `trigger(fn)`

One-shot reactive trigger. Reads signals inside `fn`, then immediately propagates changes to their downstream subscribers. Does not create a persistent subscription.

```ts
const arr = signal<number[]>([])
const length = computed(() => arr().length)

length() // 0

arr().push(1)   // direct mutation — signal doesn't know it changed
length()         // still 0 — cached

trigger(() => {
  arr() // read `arr` so trigger knows what to propagate
})
length() // 1 — propagated
```

### `untracked(fn)`

Runs `fn` without tracking reactive dependencies. Useful inside effects where you need to read a signal without subscribing to it.

```ts
const a = signal(1)
const b = signal(2)

effect(() => {
  a()                   // tracked
  untracked(() => b())  // not tracked
})

b(10) // no effect re-run — b was read inside untracked
```

## Type Helpers

### `Signal<T>`

```ts
interface Signal<T> {
  (): T                  // read
  (value: T | undefined): void // write
}
```

### `Computed<T>`

```ts
interface Computed<T> {
  (): T // read
}
```

### `Event<T>`

```ts
interface Event<T = void> {
  (payload: T): void      // emit
  read(): T | undefined   // read (auto-tracks)
}
```

### `SignalValues<T>`

Extracts the raw value types from a record of signals/computeds:

```ts
type State = {
  count: Signal<number>
  name: Signal<string>
  total: Computed<number>
}

type Values = SignalValues<State>
// { count: number; name: string; total: number }
```

## Architecture

The reactive graph is a bipartite structure of **dep** nodes (signals, computeds, events) and **sub** nodes (effects, effect scopes, computeds), connected by a doubly-linked list of `Link` edges.

```
Signal ──link──> Computed ──link──> Effect
Event  ──link──> Effect
```

The core algorithm lives in [`alien-signals/system.ts`](./alien-signals/system.ts) and provides:

| Function | Purpose |
|---|---|
| `link(dep, sub, version)` | Create or confirm a dependency edge |
| `unlink(link)` | Remove a dependency edge; calls `unwatched` if dep loses all subs |
| `propagate(link)` | Walk the subscriber graph, marking nodes Pending/Dirty |
| `checkDirty(link, sub)` | Recursively verify whether deps actually changed |
| `shallowPropagate(link)` | Upgrade Pending subs to Dirty without recursing |

This module wires those primitives through `createReactiveSystem()`, providing the `update`, `notify`, and `unwatched` callbacks that implement the signal/computed/event-specific behavior.

### Comparison with alien-signals

This module extends the [alien-signals](./alien-signals/) reference API with:

| Feature | alien-signals | This module |
|---|---|---|
| Custom `equals` on signal | No | Yes |
| Custom `equals` on computed | No | Yes |
| `readonly` signals | No | Yes |
| Default fallback on `undefined` | No | Yes |
| `event<T>()` primitive | No | Yes |
| `watch()` with old/new values | No | Yes |
| `batch()` with `{mutable}` scope | No | Yes |
| Effect scopes | Yes | Yes |
| `trigger()` | Yes | Yes |
| `untracked()` | No | Yes |
