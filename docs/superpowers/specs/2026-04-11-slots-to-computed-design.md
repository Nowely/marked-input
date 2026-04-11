# Design: Fold Slot Feature into `store.computed`

**Date:** 2026-04-11  
**Branch:** impr5  
**Status:** Approved

## Summary

Remove `store.slot` and `createSlots`. Convert all 5 slot derivations into `Computed<T>` entries on `store.computed`. Parameterless slots (`container`, `block`, `span`) become `Computed<[Component, props]>`; parameterized slots (`mark`, `overlay`) become `Computed<(arg) => [Component, props]>` — computed values that return resolver functions.

## Motivation

The current `createSlots` factory produces custom wrapper objects (`Slot`, `MarkSlot`, `OverlaySlot`) with `use()` and `get()` methods. This duplicates what `Computed<T>` already provides and forces Vue components to manually "touch" signal refs inside Vue `computed()` to register reactive dependencies. Converting to real `Computed<T>` eliminates the wrappers, enables auto-memoization, and lets Vue call `.use()` directly instead of working around the alien-signals/Vue reactivity boundary.

## Architecture

### `Store.computed` after rework

```typescript
readonly computed = {
    // existing
    parser: computed(...),
    containerClass: computed(...),
    containerStyle: computed(...),

    // slots folded in
    container: computed(() =>
        [resolveSlot('container', this.state.slots()), resolveSlotProps('container', this.state.slotProps())]
    ) as unknown as Slot,
    block: computed(() =>
        [resolveSlot('block', this.state.slots()), resolveSlotProps('block', this.state.slotProps())]
    ) as unknown as Slot,
    span: computed(() =>
        [resolveSlot('span', this.state.slots()), resolveSlotProps('span', this.state.slotProps())]
    ) as unknown as Slot,
    overlay: computed(() =>
        (option?: CoreOption, defaultComponent?: unknown) =>
            resolveOverlaySlot(this.state.Overlay(), option, defaultComponent)
    ) as unknown as OverlaySlot,
    mark: computed(() =>
        (token: Token) =>
            resolveMarkSlot(token, this.state.options(), this.state.Mark(), this.state.Span())
    ) as unknown as MarkSlot,
}
```

`store.slot` is removed. `readonly slot = createSlots(...)` is deleted from `Store`.

### Slot types (`slots/types.ts`)

Types become thin interfaces extending `Computed<T>`, kept solely as module-augmentation targets:

```typescript
export interface Slot extends Computed<readonly [unknown, Record<string, unknown> | undefined]> {}

export interface MarkSlot
    extends Computed<(token: Token) => readonly [unknown, unknown]> {}

export interface OverlaySlot
    extends Computed<(option?: CoreOption, defaultComponent?: unknown) => readonly [unknown, unknown]> {}
```

## File Changes

### Deleted
- `packages/core/src/features/slots/createSlots.ts`
- `packages/core/src/features/slots/createSlots.spec.ts`

### Modified
- `packages/core/src/store/Store.ts` — remove `slot`, add 5 entries to `computed`
- `packages/core/src/features/slots/types.ts` — replace concrete interfaces with thin `extends Computed<T>` interfaces
- `packages/core/src/features/slots/index.ts` — remove `createSlots` and `SlotSignals` exports

### Unchanged
- `packages/core/src/features/slots/resolveSlot.ts`
- `packages/core/src/features/slots/resolveOptionSlot.ts`

## Framework Component Changes

### React

```tsx
// Container.tsx, Block.tsx
store.computed.container.use()  // was: store.slot.container.use()
store.computed.block.use()      // was: store.slot.block.use()

// Token.tsx
const resolve = store.computed.mark.use()
const [Component, props] = resolve(mark)
// was: const [Component, props] = store.slot.mark.use(mark)

// OverlayRenderer.tsx
const resolve = store.computed.overlay.use()
const [Overlay, props] = resolve(overlayMatch?.option, Suggestions)
// was: const [Overlay, props] = store.slot.overlay.use(overlayMatch?.option, Suggestions)
```

### Vue

```vue
<!-- Container.vue — drop manual signal-touching block -->
const containerSlot = store.computed.container.use()  // Ref<[C, props]>
<!-- was: manually touching slotsRef.value + slotPropsRef.value then .get() -->

<!-- Token.vue -->
const resolveMarkRef = store.computed.mark.use()  // Ref<(token) => [C, props]>
const resolved = computed(() => resolveMarkRef.value(props.mark))
<!-- was: touching MarkRef.value + SpanRef.value then store.slot.mark.get(props.mark) -->

<!-- OverlayRenderer.vue -->
const resolveOverlay = store.computed.overlay.use()  // Ref<(option, default) => [C, props]>
<!-- was: touching OverlayRef.value then store.slot.overlay.get(...) -->
```

## Framework Type Augmentations

### Vue (`packages/vue/markput/src/lib/hooks/useStore.ts`)

Add `Computed<T>` augmentation; update `MarkSlot`/`OverlaySlot` to reflect resolver-function return. Remove `get()` overloads. Remove `Slot` augmentation (no longer needed — covered by `Computed<T>`).

```typescript
declare module '@markput/core' {
    interface Signal<T> { use(): Ref<T> }       // unchanged
    interface Computed<T> { use(): Ref<T> }     // new

    interface MarkSlot {
        use(): Ref<(token: Token) => readonly [Component, MarkProps]>
    }
    interface OverlaySlot {
        use(): Ref<(option?: Option, defaultComponent?: Component) => readonly [Component, OverlayProps]>
    }
    // Slot interface augmentation removed (Computed<T> covers it)
}
```

### React (`packages/react/markput/src/lib/providers/StoreContext.ts`)

`use()` drops its argument, returns typed resolver function. Remove `Slot` augmentation.

```typescript
declare module '@markput/core' {
    interface MarkSlot {
        use(): (token: Token) => readonly [ComponentType<MarkProps>, MarkProps]
    }
    interface OverlaySlot {
        use(): (option?: CoreOption, defaultComponent?: unknown) => readonly [ComponentType<OverlayProps>, OverlayProps]
    }
    // Slot interface augmentation removed
}
```

## Testing

`createSlots.spec.ts` is deleted. All slot-resolution cases migrate into a new `describe('computed slots')` block in `packages/core/src/store/Store.spec.ts`:

- Default container/block/span resolution
- Custom slot override
- SlotProps with data-attribute conversion
- Mark slot — text token (Span fallback)
- Mark slot — custom Span component with value prop
- Mark slot — throws when no Mark component
- Overlay slot — resolves from global Overlay

## Call Site Summary

| Before | After |
|--------|-------|
| `store.slot.container.use()` | `store.computed.container.use()` |
| `store.slot.block.use()` | `store.computed.block.use()` |
| `store.slot.span.use()` / `.get()` | `store.computed.span.use()` |
| `store.slot.mark.use(token)` | `store.computed.mark.use()(token)` |
| `store.slot.mark.get(token)` | `store.computed.mark()(token)` |
| `store.slot.overlay.use(opt, def)` | `store.computed.overlay.use()(opt, def)` |
| `store.slot.overlay.get(opt, def)` | `store.computed.overlay()(opt, def)` |
