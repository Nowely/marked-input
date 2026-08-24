# Signals

A reactive system built on [alien-signals](./alien-signals/)' `createReactiveSystem()`. It provides four reactive primitives — **Signal**, **Computed**, **Event**, and **Effect** — plus batching, scoping, and watch utilities.

Design principles:

- **Function-call API** — signals and computeds are callable, not objects with `.get()`/`.set()` methods
- **Auto-tracking** — dependencies are captured automatically when reads happen inside `effect()` or `computed()`
- **Zero allocations for the happy path** — the core algorithm avoids `Array`, `Set`, and `Map`, using a doubly-linked list instead
- **Push-pull propagation** — changes push notifications down the graph, but values are pulled (recomputed lazily) only when read

## Conceptual Model

| Primitive     | Models        | Equality check             | Re-propagates on same value? |
| ------------- | ------------- | -------------------------- | ---------------------------- |
| `signal<T>`   | State         | `===` (or custom `equals`) | No                           |
| `computed<T>` | Derived state | `===` (or custom `equals`) | No                           |
| `event<T>`    | Occurrences   | None                       | Always                       |
| `effect()`    | Side-effects  | —                          | —                            |

## API

### `signal<T>(options?)`

Creates a reactive state cell. The single argument is an options object — there is no positional `initial`.

```ts
import {signal} from './signals'

const count = signal<number>({initial: 0})

count() // 0 — read
count(1) // write
count() // 1
```

Writing `undefined` stores `undefined` literally — there is no implicit "revert to initial" behavior. If `initial` is omitted, the signal starts at `undefined` and its type widens to `Signal<T | undefined>`.

```ts
const slot = signal<string>() // Signal<string | undefined>
slot() // undefined
slot('a')
slot() // 'a'
slot(undefined)
slot() // undefined — literal
```

For revert-on-undefined behavior, use `default` instead of `initial` — see the [Default slot](#default-slot) section below.

**Options:**

```ts
signal<{id: number; name: string}>({
    initial: {id: 1, name: 'alice'},
    equals: (a, b) => a.id === b.id, // custom equality — skips propagation when true
    readonly: true, // ignores direct writes (see batch with mutable)
})
```

When using a `computed` companion together with a union-typed `initial`, drop
the explicit `<T>` argument and widen on `initial` instead — TS infers both
the value type and the companion shape from the option object in one pass:

```ts
const layout = signal({
    initial: 'inline' as 'inline' | 'block',
    readonly: true,
    computed: self => ({isBlock: () => self() === 'block'}),
})
layout.isBlock() // Computed<boolean>
```

| Option     | Type                                      | Default     | Description                                                                                                                                                                     |
| ---------- | ----------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initial`  | `T \| (() => T)`                          | `undefined` | Eager value, or a lazy factory called once in `untracked()` on first read/write. Factory form disallowed when `T` is itself a function type. Mutually exclusive with `default`. |
| `default`  | `T \| (() => T)`                          | `undefined` | Like `initial`, plus: writing `undefined` reverts the signal to this default. Read type stays `Signal<T>`. Mutually exclusive with `initial`. See below.                        |
| `equals`   | `(a: T, b: T) => boolean`                 | `===`       | Return `true` to suppress propagation                                                                                                                                           |
| `readonly` | `boolean`                                 | `false`     | Block writes except inside `batch(fn, {mutable: true})`                                                                                                                         |
| `get`      | `(value: T) => T`                         | identity    | Memoized read transform; runs inside a private `computed` so external signals read inside `get` propagate to consumers                                                          |
| `set`      | `(next, previous: T) => T`                | identity    | Write transform; return `previous` to reject the write. With `initial`, `next: T \| undefined`. With `default`, `next: T` (undefined is handled before `set`).                  |
| `computed` | `(self) => Record<string, () => unknown>` | —           | Attach named derived views to the signal callable (e.g. `layout.isBlock()`)                                                                                                     |

#### Default slot

Use `default` instead of `initial` when writing `undefined` should reset the signal to a known fallback. This is the right tool for framework-prop signals where adapters spread every prop into a `set({...})` call — including the ones the user did not provide, which arrive as `undefined`.

```ts
const layout = signal<'inline' | 'block'>({default: 'inline', readonly: true})

layout() // 'inline'
layout('block') // returns true
layout() // 'block'
layout(undefined) // returns true — reverts to 'inline'
layout() // 'inline'
layout(undefined) // returns false — already at default
```

Trace summary:

| Call           | Returns | State after |
| -------------- | ------- | ----------- |
| `s()`          | `'hi'`  | `'hi'`      |
| `s('bye')`     | `true`  | `'bye'`     |
| `s()`          | `'bye'` | `'bye'`     |
| `s(undefined)` | `true`  | `'hi'`      |
| `s()`          | `'hi'`  | `'hi'`      |
| `s(undefined)` | `false` | `'hi'`      |

Behavior:

- The signal's read type is `Signal<T>`, not `Signal<T | undefined>`.
- The factory form `default: () => T` is lazy and cached: it runs once inside `untracked()` on first read/write, and the cached value is used for every subsequent revert.
- `set` (if provided) sees only defined writes. Undefined-revert is handled before `set` is consulted.
- `readonly` gates undefined writes too. Outside a mutable batch, `s(undefined)` returns `false` and does not revert.
- `equals` applies to revert as well — writing `undefined` while the current value already equals the default is a no-op.
- `default` and `initial` are mutually exclusive at the type level.
- Callable `T` (e.g. `Slot`) cannot use `default`, same rule as `initial`.

If you need dynamic revert behavior (e.g. "reset to whatever the current external default formula yields"), stay on `initial` and write your own `set` — the controlled/uncontrolled pattern in the block below is the worked example.

**Controlled / uncontrolled pattern.** `get` and `set` together model a value that can be either internally owned or externally driven:

```ts
const props = {value: signal<string>(), defaultValue: signal<string>(), onChange: signal<(v: string) => void>()}

const current = signal<string>({
    initial: () => props.defaultValue() ?? '',
    get: value => (props.value() !== undefined ? (props.value() ?? '') : value),
    set: (next, previous) => {
        if (next === undefined) return previous
        props.onChange()?.(next)
        return props.value() !== undefined ? previous : next
    },
})
```

### `computed<T>(getter, options?)`

Creates a lazily-evaluated derived value. The getter receives the previous value as its argument.

```ts
const count = signal<number>({initial: 1})
const doubled = computed(() => count() * 2)

doubled() // 2 — computed on first read
count(5)
doubled() // 10 — recomputed because `count` changed
```

Computeds are **cached** — the getter only re-runs when a dependency changes and the result is read again:

```ts
let calls = 0
const expensive = computed(() => {
    calls++
    return count() * 2
})

expensive()
expensive()
calls // 1 — cached, not recomputed

count(10)
expensive()
calls // 2 — recomputed because dependency changed
```

**Chained computeds** work naturally:

```ts
const a = signal<number>({initial: 1})
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
const obj = computed(() => ({parity: count() % 2 === 0 ? 'even' : 'odd'}), {equals: (a, b) => a.parity === b.parity})
```

| Option   | Type                      | Default | Description                                      |
| -------- | ------------------------- | ------- | ------------------------------------------------ |
| `equals` | `(a: T, b: T) => boolean` | `===`   | Return `true` to suppress downstream propagation |

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
const count = signal<number>({initial: 0})

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
const show = signal<boolean>({initial: true})
const count = signal<number>({initial: 0})

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
count(2) // no output — inner effect no longer exists
```

### `effectScope(fn)`

Creates a scope that collects all effects created inside `fn`. Calling the returned dispose function cleans up all of them at once.

```ts
const count = signal<number>({initial: 0})

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

### `watch(source, callback, options?)`

Watches a reactive source for changes. Skips the first run by default (unlike `effect`); pass `{immediate: true}` to fire on the first run as well. Provides the previous value to the callback.

```ts
const count = signal<number>({initial: 0})

const dispose = watch(count, (newVal, oldVal) => {
    console.log(`${oldVal} -> ${newVal}`)
})

count(1) // Console: 0 -> 1
count(5) // Console: 1 -> 5
```

To run the callback immediately (not just on changes), pass `{immediate: true}`. The first call receives `(currentValue, undefined)`:

```ts
const count = signal<number>({initial: 5})

watch(
    count,
    (newVal, oldVal) => {
        console.log(`${oldVal} -> ${newVal}`)
    },
    {immediate: true}
)
// Console: undefined -> 5
count(10)
// Console: 5 -> 10
```

Accepts three source types:

```ts
watch(mySignal, (val, prev) => {
    /* ... */
})
watch(myEvent, (val, prev) => {
    /* ... */
})
watch(
    () => myComputed(),
    (val, prev) => {
        /* ... */
    }
)
```

The callback runs inside `untracked()` — reads inside the callback do not create subscriptions.

### `batch(fn, options?)`

Defers effect flush until `fn` completes. Multiple signal writes inside the batch trigger only a single effect run.

```ts
const a = signal<number>({initial: 1})
const b = signal<number>({initial: 2})
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
const config = signal<string>({initial: 'default', readonly: true})

batch(() => {
    config('override') // ignored — not mutable
})

batch(
    () => {
        config('override')
    },
    {mutable: true}
) // allowed
```

Nested batches restore the mutable scope correctly:

```ts
batch(() => {
    batch(
        () => {
            config('a') // allowed — inner mutable
        },
        {mutable: true}
    )
    config('b') // ignored — outer is not mutable
})
```

The window covers the batch body and nothing else. It closes before the batch drains its queued effects, so a watcher that writes a `readonly` signal while the batch flushes is refused like any other outside write and gets `false` back. That also means a watcher that throws mid-drain cannot strand the scope open — `mutableScope` is module state, and a leak there would disable the readonly gate for the rest of the process.

### `untracked(fn)`

Runs `fn` without tracking reactive dependencies. Useful inside effects where you need to read a signal without subscribing to it.

```ts
const a = signal<number>({initial: 1})
const b = signal<number>({initial: 2})

effect(() => {
    a() // tracked
    untracked(() => b()) // not tracked
})

b(10) // no effect re-run — b was read inside untracked
```

## Type Helpers

### `Signal<T, C>`

```ts
type Signal<T, C extends Record<string, unknown> = {}> = {
    (): T // read
    (value: T | undefined): boolean // write — returns true if the stored value actually changed
} & {readonly [K in keyof C]: Computed<C[K]>}
```

`C` is the _value_ record for any computed companions attached via the `computed` option. For a signal without companions, `C` defaults to `{}` so `Signal<T>` reads as before:

```ts
const layout: Signal<'inline' | 'block', {isBlock: boolean}> = signal({
    initial: 'inline' as 'inline' | 'block',
    computed: self => ({isBlock: () => self() === 'block'}),
})

layout() // 'inline' | 'block'
layout.isBlock() // Computed<boolean>
```

You almost never write this annotation by hand — TS infers it from the `signal({...})` call. The two-parameter form mainly makes hover types and explicit re-annotations readable.

### `Computed<T>`

```ts
interface Computed<T> {
    (): T // read
}
```

### `Event<T>`

```ts
interface Event<T = void> {
    (payload: T): void // emit
    read(): T | undefined // read (auto-tracks)
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

| Function                  | Purpose                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| `link(dep, sub, version)` | Create or confirm a dependency edge                               |
| `unlink(link)`            | Remove a dependency edge; calls `unwatched` if dep loses all subs |
| `propagate(link)`         | Walk the subscriber graph, marking nodes Pending/Dirty            |
| `checkDirty(link, sub)`   | Recursively verify whether deps actually changed                  |
| `shallowPropagate(link)`  | Upgrade Pending subs to Dirty without recursing                   |

This module wires those primitives through `createReactiveSystem()`, providing the `update`, `notify`, and `unwatched` callbacks that implement the signal/computed/event-specific behavior.

### Comparison with alien-signals

This module extends the [alien-signals](./alien-signals/) reference API with:

| Feature                              | alien-signals | This module |
| ------------------------------------ | ------------- | ----------- |
| Custom `equals` on signal            | No            | Yes         |
| Custom `equals` on computed          | No            | Yes         |
| `readonly` signals                   | No            | Yes         |
| Lazy `initial` factory               | No            | Yes         |
| `default` slot (revert-on-undefined) | No            | Yes         |
| `get` / `set` transforms             | No            | Yes         |
| `event<T>()` primitive               | No            | Yes         |
| `watch()` with old/new values        | No            | Yes         |
| `batch()` with `{mutable}` scope     | No            | Yes         |
| Effect scopes                        | Yes           | Yes         |
| `untracked()`                        | No            | Yes         |
