# Signal Defaults & Simplified setState

## Problem

1. **Framework boilerplate**: React/Vue components manually destructure props and apply `?? defaultValue` for each key. This is repetitive and error-prone — every new signal with a default requires updating both core and framework layers.

2. **Type dishonesty**: Signals like `readOnly: signal<boolean>(false)` claim type `boolean`, but `.set(undefined)` makes `.get()` return `undefined` at runtime. Consumers must guard against `undefined` even though the type says they don't need to.

3. **Default values are framework concerns**: Defaults for `readOnly`, `drag`, `showOverlayOn`, `options` are currently maintained in the framework layer. They should live in core, where the signals are defined.

## Design

### Signal read-time fallback

When a signal is created with a non-`undefined` initial value, that value becomes the **default fallback**. If `.set(undefined)` is called (or the signal is never set), reads return the default instead of `undefined`.

**Heuristic**: `initial !== undefined` means the signal has a default. `initial === undefined` means no default — `undefined` is a valid stored value.

```ts
// Has default — type is OverlayTrigger, reads never return undefined
showOverlayOn: signal<OverlayTrigger>('change')

// No default — type is string | undefined, reads can return undefined
value: signal<string | undefined>(undefined)
```

### Signal type changes

```ts
interface Signal<T> {
  (): T                                        // read — always T
  (value: T | undefined): void                 // write — undefined reverts to default
  get(): T                                     // read alias
  set(value: T | undefined): void              // write alias
  use(): T                                     // framework hook
}
```

The setter accepts `T | undefined` regardless of whether `T` includes `undefined`. Passing `undefined` reverts to the default (if one exists) or stores `undefined` (if no default).

### Internal mechanism

The inner alien-signal stores `T | undefined`. On every read, the callable checks: if the stored value is `undefined` and a default exists, return the default. Otherwise return the stored value.

```ts
// Pseudo-code for the default branch
const inner = alienSignal<T | undefined>(initial)
const _default = initial  // captured at creation

const callable = function signalCallable(...args: [T | undefined] | []) {
  if (args.length) {
    inner(args[0])
  } else {
    const raw = inner()
    return raw !== undefined ? raw : _default as T
  }
}

callable.get = () => {
  const raw = inner()
  return raw !== undefined ? raw : _default as T
}

callable.set = (v: T | undefined) => inner(v)
```

The `hasDefault` flag is derived from `initial !== undefined`. When `hasDefault` is `false`, reads return the raw value directly (no fallback check — zero overhead for signals without defaults).

### No new SignalOptions field

The default is inferred from the initial value. No `{default: ...}` option is needed. This keeps the API surface minimal.

## Store.state changes

### Signals that gain defaults (become non-nullable)

| Before | After |
|--------|-------|
| `showOverlayOn: signal<OverlayTrigger \| undefined>(undefined)` | `showOverlayOn: signal<OverlayTrigger>('change')` |
| `options: signal<CoreOption[] \| undefined>(undefined)` | `options: signal<CoreOption[]>(DEFAULT_OPTIONS)` |

### Signals that already had non-undefined initial (gain fallback behavior)

| Signal | Default | Change |
|--------|---------|--------|
| `readOnly: signal<boolean>(false)` | `false` | `.set(undefined)` now returns `false` instead of `undefined` |
| `drag: signal<boolean \| {alwaysShowHandle: boolean}>(false)` | `false` | Same fallback behavior |
| `tokens: signal<Token[]>([])` | `[]` | Same fallback behavior |

### Signals that stay nullable (no default)

These have `undefined` initial values and no meaningful default:

- `value`, `defaultValue`, `previousValue` — `string | undefined`
- `recovery` — `Recovery | undefined`
- `parser` — `Parser | undefined`
- `selecting` — `'drag' | 'all' | undefined`
- `overlayMatch` — `OverlayMatch | undefined`
- `onChange` — `((value: string) => void) | undefined`
- `Span`, `Mark`, `Overlay` — `GenericComponent | undefined`
- `className` — `string | undefined`
- `style` — `StyleProperties | undefined`
- `slots` — `CoreSlots | undefined`
- `slotProps` — `CoreSlotProps | undefined`

### Import change

`DEFAULT_OPTIONS` must be importable in `Store.ts`. It currently comes from the parsing module or needs to be sourced from the options config.

## Framework simplification

### React — Before

```tsx
const [store] = useState(() => {
  const nextStore = new Store({defaultSpan: DefaultSpan})
  nextStore.setState({
    readOnly: props.readOnly ?? false,
    drag: props.drag ?? false,
    options: props.options ?? DEFAULT_OPTIONS,
    showOverlayOn: props.showOverlayOn ?? 'change',
    // ... 12 more keys
  })
  return nextStore
})

useLayoutEffect(() => {
  store.setState({
    readOnly: props.readOnly ?? false,
    drag: props.drag ?? false,
    options: props.options ?? DEFAULT_OPTIONS,
    showOverlayOn: props.showOverlayOn ?? 'change',
    // ... duplicated
  })
})
```

### React — After

```tsx
const [store] = useState(() => {
  const nextStore = new Store({defaultSpan: DefaultSpan})
  nextStore.setState({
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: props.onChange,
    readOnly: props.readOnly,
    drag: props.drag,
    options: props.options,
    showOverlayOn: props.showOverlayOn,
    Span: props.Span,
    Mark: props.Mark,
    Overlay: props.Overlay,
    className,
    style,
    slots: props.slots,
    slotProps,
  })
  return nextStore
})
```

No `??` operators. `undefined` props are passed through — signals revert to their defaults.

### Vue — Same pattern

The `withDefaults` macro can also be simplified since core now owns the defaults:

```vue
<!-- Before -->
const props = withDefaults(defineProps<MarkedInputProps>(), {
  options: () => DEFAULT_OPTIONS,
  showOverlayOn: 'change',
  readOnly: false,
  drag: false,
})

<!-- After -->
const props = defineProps<MarkedInputProps>()
```

Defaults are no longer needed in the framework layer — they live in core signals.

## Controller impact

Controllers that read `showOverlayOn`, `options`, `readOnly`, or `drag` via `.get()` now get non-nullable types. Any existing `undefined` guards on these signals become dead code and can be removed.

## Implementation scope

### Core (`@markput/core`)

1. **`signal.ts`** — Add fallback logic to all 3 branches (default, `equals: false`, `equals: fn`). Introduce `hasDefault` flag based on `initial !== undefined`.
2. **`Store.ts`** — Update signal declarations: `showOverlayOn` and `options` become non-nullable with defaults. Import `DEFAULT_OPTIONS`.
3. **Controllers** — Remove dead `undefined` guards on defaulted signals.

### React (`@markput/react`)

1. **`MarkedInput.tsx`** — Remove all `??` operators from `setState` calls. Remove `withDefaults` imports if any.
2. **`MarkedInputProps`** — Keep types as-is (optional props are still optional in the component API).

### Vue (`@markput/vue`)

1. **`MarkedInput.vue`** — Remove `withDefaults` wrapper. Remove `??` operators from `syncProps()`.
2. **`types.ts`** — Keep prop types as-is.

### Tests

- Update existing signal tests for fallback behavior.
- Add tests for `.set(undefined)` reverting to default.
- Update Store tests for new signal types.
- Verify React/Vue component tests still pass (no behavioral change — same runtime values).

## Open questions

- None. The design is self-contained and backward-compatible in behavior (same runtime values, just cleaner API).
