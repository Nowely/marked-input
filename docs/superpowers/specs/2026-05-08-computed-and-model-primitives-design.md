# Computed and Model primitives — design

Date: 2026-05-08
Branch: b0
Owner: @nowely

## Goals

1. Extract `computed` from the monolithic `signal.ts` into its own module — it
   has grown into a model rather than a primitive.
2. Drop the `field: Signal<T>` argument from the writable `computed` callbacks.
   Caller passes values, not signals — Vue style.
3. Simplify the writable `computed` signature so it reads like the readonly
   form.
4. Split the current writable `computed` into two distinct primitives:
   - **`computed`** — pure writable computed. No internal state.
   - **`model`** — Vue `defineModel`-inspired primitive that wraps an internal
     signal for the controlled/uncontrolled pattern.

## Non-goals

- Splitting the rest of `signal.ts` (effect, event, watch, reactive system
  internals). They share module state with `signal()` and stay together.
- Adding new reactive features. This is a refactor.
- Behavior changes in `ValueModel`. The spec preserves all four observable
  behaviors (uncontrolled write, controlled write, readOnly, undefined write).

## File structure

```
packages/core/src/shared/signals/
  alien-signals/         (unchanged)
  signal.ts              (-: writable computed factory; -: computed export)
  computed.ts            (NEW)
  model.ts               (NEW)
  index.ts               (updated re-exports)
```

`computed.ts` and `model.ts` import a small set of internals from `signal.ts`:
`computedOper`, `ComputedNode`, `ReactiveFlags`, `signal()`, `untracked()`. The
reactive system stays in `signal.ts` as a single module.

## API — `computed`

Two forms. The readonly form is unchanged from today.

```ts
// Readonly — unchanged
computed<T>(
  getter: (prev?: T) => T,
  opts?: {equals?: (a: T, b: T) => boolean}
): Computed<T>

// Writable — new shape (no field, no initial)
computed<T>(opts: {
  get: (prev?: T) => T
  set: (next: T) => void
  equals?: (a: T, b: T) => boolean
}): Signal<T>
```

The writable form has no internal storage. The caller manages backing
externally if they need it:

```ts
const local = signal(0)
const c = computed({
  get: () => local() * 2,
  set: next => local(next / 2),
})
```

`get` receives the previous computed value as `prev` (same shape as readonly).
`set` receives only the value being written.

### Implementation sketch

A writable `computed` is a `ComputedNode` whose `getter` is `opts.get`, plus a
callable that:
- For `()`: invokes `computedOper` (standard memoized read)
- For `(next)`: invokes `opts.set(next)`

No backing signal, no `initialized` flag, no lazy untracked init.

## API — `model`

```ts
model<T>(opts: {
  default: () => T
  get: (value: T) => T
  set: (next: T | undefined, previous: T) => T
}): Signal<T>
```

Field meanings:
- `default`: seed for the internal signal. Lazy — runs on first read of
  internal. Runs in `untracked` scope so seed dependencies do not leak into
  the model's getter.
- `get`: receives the current internal value, returns the value to expose.
  Lets the caller decide whether to surface internal or an external source.
- `set`: receives the value being written and the current internal value;
  returns the new internal value. Strictly returns `T` — TypeScript catches
  missing return paths.

### Behavior

- Read: returns `get(internal())`. First read forces lazy init of internal.
- Write `(next)`:
  1. Compute `result = set(next, internal())`
  2. Write `internal(result)`. The signal's own equality check skips
     propagation when `result === previous`.

This means `set` controls everything: emit-side effects, conditional internal
writes, readOnly guards. There is no separate "abort" channel — `return previous`
is the abort.

### Why the strict-T return

A `T | void` return signals "skip" via `void`. That works but invites
forgotten return paths to silently mean "skip". Strict-T forces the caller to
write `return previous` explicitly for the no-op case, and TypeScript catches
missing branches.

### Implementation sketch

```ts
function model<T>(opts: ModelOptions<T>): Signal<T> {
  let internal: Signal<T> | undefined
  const ensure = (): Signal<T> =>
    internal ?? (internal = signal(untracked(opts.default)))

  // Reads go through computed so opts.get is memoized and external deps
  // (signals read inside opts.get) propagate to subscribers.
  const reader = computed(() => opts.get(ensure()()))

  return ((...args: [T | undefined] | []) => {
    if (args.length === 0) return reader()
    const sig = ensure()
    sig(opts.set(args[0], sig()))
  }) as Signal<T>
}
```

The reader is a readonly `computed` so reads memoize and external deps inside
`opts.get` (e.g. `this.props.value()` in `ValueModel`) propagate to effects
that depend on the model. The internal signal is a dep of the reader; writes
to internal trigger reader recomputation.

`opts.set` runs in a non-tracking write context. Reads of computeds and
signals inside `set` (e.g. `this.isControlledMode()`, `this.props.readOnly()`)
return their current memoized value without establishing dependency links.

### Why no `equals` on `model`

The internal signal de-dupes with `===`. Adding `equals` to `model` is YAGNI
until a caller needs structural equality on the wrapped value. Extending later
is additive.

## ValueModel migration

```ts
import {computed} from '../../shared/signals/computed'
import {model} from '../../shared/signals/model'
// or via signals/index re-exports

export class ValueModel {
  readonly isControlledMode = computed(() => this.props.value() !== undefined)

  readonly current = model<string>({
    default: () => this.props.value() ?? this.props.defaultValue() ?? '',
    get: value => (this.isControlledMode() ? (this.props.value() ?? '') : value),
    set: (next, previous) => {
      if (next === undefined) return previous
      if (this.props.readOnly()) return previous
      this.props.onChange()?.(next)
      return this.isControlledMode() ? previous : next
    },
  })

  constructor(private readonly props: PropsModel) {}

  replace(range: RawRange, replacement: string): void {
    const current = this.current()
    if (range.start < 0 || range.end < range.start || range.end > current.length) return
    this.current(current.slice(0, range.start) + replacement + current.slice(range.end))
  }
}
```

`isControlledMode` is preserved as a public computed. It is part of the
existing public surface — `ValueModel.spec.ts` asserts on it and `get`/`set`
inside `model` read it.

### Behavior trace

| Mode                      | `set` returns        | Internal write | Emit  |
|---------------------------|----------------------|----------------|-------|
| `next === undefined`      | `previous`           | no-op          | no    |
| readOnly                  | `previous`           | no-op          | no    |
| controlled, normal        | `previous`           | no-op          | yes   |
| uncontrolled, normal      | `next`               | written        | yes   |

All four match the current `ValueModel` exactly. No observable behavior
change.

## Test plan

### `computed.spec.ts`

Keep all existing readonly tests as-is. Rewrite the `computed — writable`
describe block:

Drop:
- `field starts undefined when no initial provided`
- `initial runs lazily on first field read`
- `initial runs inside untracked — does not leak deps into getter`
- `set routing — set writes field when caller chooses`
- `set routing — set can skip field write`
- `field write propagates through get to effect`
- `get can choose external over field, field write does not change result`

Add:
- `get receives previous computed value as prev`
- `set receives next value`
- `set can write to an external signal that get also reads`
- `external dep change in get propagates to effect`
- `equals option suppresses propagation when output unchanged`
- `isReactive returns true for writable computed`

### `model.spec.ts` (new)

- `read returns get(internal)` — initial value
- `default runs lazily on first read` — call counter
- `default runs in untracked scope` — dep mutated after init does not retrigger
- `default runs once` — repeated reads do not re-seed
- `set receives (next, previous)` — second arg matches current internal value
- `set return value becomes the new internal value` — write reflected on next read
- `set returning previous is a no-op` — internal unchanged
- `controlled-style get reads external; set returning previous keeps internal stable`
- `uncontrolled-style get reads internal; set returning next writes internal`
- `Signal interface — readable as Signal<T>` — `isReactive` returns true

### `ValueModel.spec.ts`

Unchanged. All existing assertions hold. If any assertion fails during
implementation, treat it as a regression in the `model` primitive, not a
spec change.

## Migration order

1. Add `computed.ts` and `model.ts` with full tests (all green in isolation).
2. Update `signals/index.ts` to re-export from new files.
3. Remove writable factory and the `computed` export from `signal.ts`.
4. Update `ValueModel` to use `model`.
5. Run full test suite (Core 313, React 171, Vue 157 — all should remain
   green).

The first three steps land the primitives without touching consumers. Step 4
is a focused diff against the new APIs. Each step compiles.

## Risk and rollback

- **Risk: lazy init timing.** `model`'s `default` is lazy. If a consumer reads
  the model in a context where `default` calls a signal that has not been set,
  behavior may differ from eager init. Mitigation: tests assert lazy + untracked
  semantics explicitly. ValueModel's `default` reads `props.value`/`defaultValue`,
  both of which exist by the time `current()` is first read.
- **Risk: strict-T return surprises.** Existing call sites today are limited to
  the writable `computed` factory inside `signal.ts`. The only user-facing call
  site is `ValueModel`, rewritten in step 4. No other consumers exist.
- **Rollback:** revert is mechanical — restore `signal.ts`, restore old
  `ValueModel`, drop new files.

## Out of scope

- Splitting `effect`, `event`, `watch` into their own files.
- Reworking how `Store` wires features.
- Renaming or relocating `signals/` itself.
- Adding `equals` to `model`.
