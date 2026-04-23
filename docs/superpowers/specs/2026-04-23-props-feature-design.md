# PropsFeature Design

## Problem

`store.props` is a plain object of 15 readonly signals defined inline in `Store.ts`. The `setProps()` method lives on Store and directly mutates these signals. This means prop management logic is scattered between Store's field definition and its method, rather than encapsulated in a single class.

## Solution

Extract the props signals and `set()` logic into a `PropsFeature` class. `store.props` becomes an instance of this class instead of a plain object.

## Design

### PropsFeature class

Location: `packages/core/src/store/PropsFeature.ts`

```typescript
export class PropsFeature {
  readonly value = signal<string | undefined>(undefined, {readonly: true})
  readonly defaultValue = signal<string | undefined>(undefined, {readonly: true})
  readonly onChange = signal<((value: string) => void) | undefined>(undefined, {readonly: true})
  readonly options = signal<CoreOption[]>(DEFAULT_OPTIONS, {readonly: true})
  readonly readOnly = signal<boolean>(false, {readonly: true})
  readonly layout = signal<'inline' | 'block'>('inline', {readonly: true})
  readonly draggable = signal<boolean | DraggableConfig>(false, {readonly: true})
  readonly showOverlayOn = signal<OverlayTrigger>('change', {readonly: true})
  readonly Span = signal<Slot | undefined>(undefined, {readonly: true})
  readonly Mark = signal<Slot | undefined>(undefined, {readonly: true})
  readonly Overlay = signal<Slot | undefined>(undefined, {readonly: true})
  readonly className = signal<string | undefined>(undefined, {readonly: true})
  readonly style = signal<CSSProperties | undefined>(undefined, {equals: shallow, readonly: true})
  readonly slots = signal<CoreSlots | undefined>(undefined, {readonly: true})
  readonly slotProps = signal<CoreSlotProps | undefined>(undefined, {readonly: true})

  constructor(private readonly _store: Store) {}

  set(values: Partial<SignalValues<typeof this>>): void {
    batch(
      () => {
        for (const key of Object.keys(values) as (keyof typeof this)[]) {
          if (!(key in this)) continue
          ;(this[key] as never)(values[key] as never)
        }
      },
      {mutable: true}
    )
  }
}
```

### Store changes

- `store.props` becomes `new PropsFeature(this)` instead of a plain object literal
- `Store.setProps()` delegates to `this.props.set()`
- Signal definitions move out of Store.ts into PropsFeature

### Key properties

- **Does NOT implement Feature interface** — no enable/disable, no state/computed/emit
- **Lives at `store.props`** (store root level), NOT inside `store.feature`
- **Zero migration** — all existing `store.props.X()` calls work unchanged since the signal properties are still accessible on the same object path
- Framework wrappers (React/Vue) call `store.setProps()` as before — the delegation is transparent

### Files changed

| File | Change |
|------|--------|
| `packages/core/src/store/PropsFeature.ts` | New file — PropsFeature class |
| `packages/core/src/store/Store.ts` | Replace inline props object with `new PropsFeature(this)`, delegate `setProps` |
| `packages/core/src/store/index.ts` | Export PropsFeature if needed |
| `packages/core/src/store/Store.spec.ts` | Update tests if they reference internal structure |
