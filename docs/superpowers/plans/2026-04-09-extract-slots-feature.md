# Extract Slots Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract slot factory functions, interfaces, and resolution logic from `Store.ts` and `shared/utils/` into a dedicated `features/slots/` module.

**Architecture:** Move `createNamedSlot`, `createOverlaySlot`, `createMarkSlot` and the `Slot`/`MarkSlot`/`OverlaySlot` interfaces into `packages/core/src/features/slots/`. Move `resolveSlot.ts` and `resolveOptionSlot.ts` from `shared/utils/` into the new feature. `Store.ts` will import and call a single `createSlots()` function. No behavioral changes — pure structural extraction.

**Tech Stack:** TypeScript, Vitest, existing signal system

---

## File Structure

| Action | File                                                    | Responsibility                                                                                                                                  |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `packages/core/src/features/slots/types.ts`             | `Slot`, `MarkSlot`, `OverlaySlot` interfaces                                                                                                    |
| Create | `packages/core/src/features/slots/resolveSlot.ts`       | `resolveSlot`, `resolveSlotProps`, `resolveOverlaySlot`, `resolveMarkSlot`, `SlotName`, `SlotOption` (moved from `shared/utils/resolveSlot.ts`) |
| Create | `packages/core/src/features/slots/resolveOptionSlot.ts` | `resolveOptionSlot` (moved from `shared/utils/resolveOptionSlot.ts`)                                                                            |
| Create | `packages/core/src/features/slots/createSlots.ts`       | `createNamedSlot`, `createOverlaySlot`, `createMarkSlot`, `createSlots` (moved from `Store.ts`)                                                 |
| Create | `packages/core/src/features/slots/index.ts`             | Public re-exports                                                                                                                               |
| Create | `packages/core/src/features/slots/createSlots.spec.ts`  | Tests for slot factories (moved from `Store.spec.ts`)                                                                                           |
| Modify | `packages/core/src/features/store/Store.ts`             | Remove slot factories, interfaces, resolution imports; import `createSlots`                                                                     |
| Modify | `packages/core/src/features/store/index.ts`             | Remove `Slot`, `MarkSlot`, `OverlaySlot` re-exports                                                                                             |
| Modify | `packages/core/src/features/store/Store.spec.ts`        | Remove slot tests                                                                                                                               |
| Delete | `packages/core/src/shared/utils/resolveSlot.ts`         | Moved to `features/slots/`                                                                                                                      |
| Delete | `packages/core/src/shared/utils/resolveOptionSlot.ts`   | Moved to `features/slots/`                                                                                                                      |
| Modify | `packages/core/src/shared/utils/index.ts`               | Remove re-exports of moved files                                                                                                                |
| Modify | `packages/core/index.ts`                                | Update exports: slot types from new location                                                                                                    |

---

### Task 1: Create `features/slots/types.ts`

**Files:**

- Create: `packages/core/src/features/slots/types.ts`

- [ ] **Step 1: Create the types file with Slot, MarkSlot, OverlaySlot interfaces**

```typescript
import type {CoreOption} from '../../shared/types'
import type {Token} from '../parsing'

export interface Slot {
    use(): readonly unknown[]
    get(): readonly unknown[]
}

export interface MarkSlot {
    use(token: Token): readonly unknown[]
    get(token: Token): readonly unknown[]
}

export interface OverlaySlot {
    use(option?: CoreOption, defaultComponent?: unknown): readonly unknown[]
    get(option?: CoreOption, defaultComponent?: unknown): readonly unknown[]
}
```

---

### Task 2: Create `features/slots/resolveOptionSlot.ts`

**Files:**

- Create: `packages/core/src/features/slots/resolveOptionSlot.ts`

- [ ] **Step 1: Move `resolveOptionSlot` from `shared/utils/resolveOptionSlot.ts`**

```typescript
export function resolveOptionSlot<T extends object>(optionConfig: T | ((base: T) => T) | undefined, baseProps: T): T {
    if (optionConfig !== undefined) {
        return typeof optionConfig === 'function' ? optionConfig(baseProps) : optionConfig
    }
    return baseProps
}
```

---

### Task 3: Create `features/slots/resolveSlot.ts`

**Files:**

- Create: `packages/core/src/features/slots/resolveSlot.ts`

- [ ] **Step 1: Move `resolveSlot.ts` content from `shared/utils/resolveSlot.ts`, updating imports**

```typescript
import type {CoreOption, CoreSlotProps, CoreSlots, GenericElement} from '../../shared/types'
import type {Token} from '../parsing'
import {convertDataAttrs} from '../../shared/utils/dataAttributes'
import {resolveOptionSlot} from './resolveOptionSlot'

export type SlotName = 'container' | 'block' | 'span'

const defaultSlots: Record<SlotName, string> = {
    container: 'div',
    block: 'div',
    span: 'span',
}

export function resolveSlot(slotName: SlotName, slots: unknown): GenericElement {
    // oxlint-disable-next-line no-unsafe-type-assertion -- `slots` is `CoreSlots | undefined` at runtime; typed as unknown for Vue Ref<T> cross-framework compat
    return (slots as CoreSlots | undefined)?.[slotName] ?? defaultSlots[slotName]
}

export function resolveSlotProps(slotName: SlotName, slotProps: unknown): Record<string, unknown> | undefined {
    // oxlint-disable-next-line no-unsafe-type-assertion -- `slotProps` is `CoreSlotProps | undefined` at runtime; typed as unknown for Vue Ref<T> cross-framework compat
    const props = (slotProps as CoreSlotProps | undefined)?.[slotName]
    return props ? convertDataAttrs(props) : undefined
}

type SlotProp = Record<string, unknown> | ((base: Record<string, unknown>) => Record<string, unknown>)

/**
 * Internal view of a framework-specific Option for slot resolution.
 * Framework Option types (React, Vue) extend CoreOption with these properties.
 */
export interface SlotOption extends CoreOption {
    Mark?: unknown
    mark?: SlotProp
    Overlay?: unknown
    overlay?: SlotProp
}

export function resolveOverlaySlot(globalComponent: unknown, option?: SlotOption, defaultComponent?: unknown) {
    const Component = option?.Overlay ?? globalComponent ?? defaultComponent
    if (!Component)
        throw new Error(
            'No overlay component found. Provide either option.Overlay, global Overlay, or a defaultComponent.'
        )
    const props = resolveOptionSlot<Record<string, unknown>>(option?.overlay, {})
    return [Component, props] as const
}

export function resolveMarkSlot(
    token: Token,
    tokenOptions: SlotOption[] | undefined,
    GlobalMark: unknown,
    GlobalSpan: unknown,
    defaultSpan: unknown
) {
    if (token.type === 'text') return [GlobalSpan ?? defaultSpan, {value: token.content}] as const
    const option = tokenOptions?.[token.descriptor.index]
    const baseProps = {value: token.value, meta: token.meta}
    const props = resolveOptionSlot(option?.mark, baseProps)
    const Component = option?.Mark ?? GlobalMark
    if (!Component) throw new Error('No mark component found. Provide either option.Mark or global Mark.')
    return [Component, props] as const
}
```

---

### Task 4: Create `features/slots/createSlots.ts`

**Files:**

- Create: `packages/core/src/features/slots/createSlots.ts`

- [ ] **Step 1: Move the three factory functions from `Store.ts` and add `createSlots` composition function**

```typescript
import type {CoreOption, CoreSlotProps, CoreSlots, GenericComponent} from '../../shared/types'
import type {Signal} from '../../shared/signals'
import type {Token} from '../parsing'
import {resolveMarkSlot, resolveOverlaySlot, resolveSlot, resolveSlotProps} from './resolveSlot'
import type {SlotName} from './resolveSlot'
import type {MarkSlot, OverlaySlot, Slot} from './types'

function createNamedSlot(
    slots: Signal<CoreSlots | undefined>,
    slotProps: Signal<CoreSlotProps | undefined>,
    name: SlotName
): Slot {
    // oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment Slot with typed overloads; core satisfies the base interface
    return {
        use: () => [resolveSlot(name, slots.use()), resolveSlotProps(name, slotProps.use())] as const,
        get: () => [resolveSlot(name, slots.get()), resolveSlotProps(name, slotProps.get())] as const,
    } as unknown as Slot
}

function createOverlaySlot(overlay: Signal<GenericComponent | undefined>): OverlaySlot {
    // oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment OverlaySlot with typed overloads; core satisfies the base interface
    return {
        use: (option?: CoreOption, defaultComponent?: unknown) =>
            resolveOverlaySlot(overlay.use(), option, defaultComponent),
        get: (option?: CoreOption, defaultComponent?: unknown) =>
            resolveOverlaySlot(overlay.get(), option, defaultComponent),
    } as unknown as OverlaySlot
}

function createMarkSlot(
    options: Signal<CoreOption[]>,
    mark: Signal<GenericComponent | undefined>,
    span: Signal<GenericComponent | undefined>,
    getDefaultSpan: () => unknown
): MarkSlot {
    // oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment MarkSlot with typed overloads; core satisfies the base interface
    return {
        use: (token: Token) => resolveMarkSlot(token, options.get(), mark.use(), span.use(), getDefaultSpan()),
        get: (token: Token) => resolveMarkSlot(token, options.get(), mark.get(), span.get(), getDefaultSpan()),
    } as unknown as MarkSlot
}

export interface SlotSignals {
    slots: Signal<CoreSlots | undefined>
    slotProps: Signal<CoreSlotProps | undefined>
    Overlay: Signal<GenericComponent | undefined>
    options: Signal<CoreOption[]>
    Mark: Signal<GenericComponent | undefined>
    Span: Signal<GenericComponent | undefined>
    getDefaultSpan: () => unknown
}

export function createSlots(signals: SlotSignals) {
    return {
        container: createNamedSlot(signals.slots, signals.slotProps, 'container'),
        block: createNamedSlot(signals.slots, signals.slotProps, 'block'),
        span: createNamedSlot(signals.slots, signals.slotProps, 'span'),
        overlay: createOverlaySlot(signals.Overlay),
        mark: createMarkSlot(signals.options, signals.Mark, signals.Span, signals.getDefaultSpan),
    }
}
```

---

### Task 5: Create `features/slots/index.ts`

**Files:**

- Create: `packages/core/src/features/slots/index.ts`

- [ ] **Step 1: Create the barrel export file**

```typescript
export {createSlots, type SlotSignals} from './createSlots'
export type {Slot, MarkSlot, OverlaySlot} from './types'
export {
    resolveSlot,
    resolveSlotProps,
    resolveOverlaySlot,
    resolveMarkSlot,
    type SlotName,
    type SlotOption,
} from './resolveSlot'
export {resolveOptionSlot} from './resolveOptionSlot'
```

---

### Task 6: Write tests for `createSlots`

**Files:**

- Create: `packages/core/src/features/slots/createSlots.spec.ts`

- [ ] **Step 1: Write the test file (tests extracted from Store.spec.ts slot describe block)**

```typescript
import {describe, it, expect, beforeEach} from 'vitest'

import {setUseHookFactory, signal} from '../../shared/signals'
import {createSlots} from './createSlots'

describe('createSlots', () => {
    beforeEach(() => {
        setUseHookFactory(() => () => undefined)
    })

    function setup(defaultSpan: unknown = null) {
        const slots = signal<unknown>(undefined)
        const slotProps = signal<unknown>(undefined)
        const Overlay = signal<unknown>(undefined)
        const options = signal<unknown[]>([])
        const Mark = signal<unknown>(undefined)
        const Span = signal<unknown>(undefined)

        return createSlots({
            slots,
            slotProps,
            Overlay,
            options,
            Mark,
            Span,
            getDefaultSpan: () => defaultSpan,
        })
    }

    it('should return default container slot', () => {
        const slot = setup()
        expect(slot.container.get()).toEqual(['div', undefined])
    })

    it('should return default block slot', () => {
        const slot = setup()
        expect(slot.block.get()).toEqual(['div', undefined])
    })

    it('should return default span slot', () => {
        const slot = setup()
        expect(slot.span.get()).toEqual(['span', undefined])
    })

    it('should resolve custom container slot', () => {
        const slots = signal<unknown>(undefined)
        const slotProps = signal<unknown>(undefined)
        const sut = createSlots({
            slots,
            slotProps,
            Overlay: signal(undefined),
            options: signal([]),
            Mark: signal(undefined),
            Span: signal(undefined),
            getDefaultSpan: () => null,
        })
        slots.set({container: 'section'})
        expect(sut.container.get()).toEqual(['section', undefined])
    })

    it('should resolve custom slot with props', () => {
        const slots = signal<unknown>(undefined)
        const slotProps = signal<unknown>(undefined)
        const sut = createSlots({
            slots,
            slotProps,
            Overlay: signal(undefined),
            options: signal([]),
            Mark: signal(undefined),
            Span: signal(undefined),
            getDefaultSpan: () => null,
        })
        slots.set({span: 'strong'})
        slotProps.set({span: {className: 'bold'}})
        const [, props] = sut.span.get()
        expect(props).toEqual({className: 'bold'})
    })

    it('should resolve mark slot for text token using defaultSpan', () => {
        const slot = setup('span')
        const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
        const [component, props] = slot.mark.get(token)
        expect(component).toBe('span')
        expect(props).toEqual({value: 'hello'})
    })

    it('should throw for mark token without Mark component', () => {
        const slot = setup()
        // oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for test, token shape is intentionally partial
        const token = {
            type: 'mark',
            value: '@john',
            meta: undefined,
            descriptor: {index: 0},
            position: {start: 0, end: 5},
        } as any
        expect(() => slot.mark.get(token)).toThrow('No mark component found')
    })
})
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/slots/createSlots.spec.ts`
Expected: All tests PASS

---

### Task 7: Update `Store.ts` to use `createSlots`

**Files:**

- Modify: `packages/core/src/features/store/Store.ts`

- [ ] **Step 1: Remove slot factory functions (lines 30-63), interfaces (lines 65-82), and resolution imports (lines 15-16). Add import of `createSlots` from `../slots`. Replace inline `slot` property with `createSlots` call.**

The top of Store.ts should change to remove these lines:

```
import {resolveMarkSlot, resolveOverlaySlot, resolveSlot, resolveSlotProps} from '../../shared/utils/resolveSlot'
import type {SlotName} from '../../shared/utils/resolveSlot'
```

And add:

```
import {createSlots} from '../slots'
```

Remove lines 30-82 entirely (the three factory functions and three interfaces).

Replace the `slot` property (lines 131-137):

```typescript
readonly slot = createSlots({
    slots: this.state.slots,
    slotProps: this.state.slotProps,
    Overlay: this.state.Overlay,
    options: this.state.options,
    Mark: this.state.Mark,
    Span: this.state.Span,
    getDefaultSpan: () => this._defaultSpan,
})
```

---

### Task 8: Update `Store` exports

**Files:**

- Modify: `packages/core/src/features/store/index.ts`

- [ ] **Step 1: Remove Slot, MarkSlot, OverlaySlot from store index**

```typescript
export {Store, type StoreOptions} from './Store'
```

---

### Task 9: Remove slot tests from `Store.spec.ts`

**Files:**

- Modify: `packages/core/src/features/store/Store.spec.ts`

- [ ] **Step 1: Remove the entire `describe('slot', ...)` block (lines 128-178)**

Delete lines 128-178 from `Store.spec.ts`. These tests are now in `createSlots.spec.ts`.

---

### Task 10: Clean up old files

**Files:**

- Delete: `packages/core/src/shared/utils/resolveSlot.ts`
- Delete: `packages/core/src/shared/utils/resolveOptionSlot.ts`
- Modify: `packages/core/src/shared/utils/index.ts`

- [ ] **Step 1: Delete `shared/utils/resolveSlot.ts`**

Run: `rm packages/core/src/shared/utils/resolveSlot.ts`

- [ ] **Step 2: Delete `shared/utils/resolveOptionSlot.ts`**

Run: `rm packages/core/src/shared/utils/resolveOptionSlot.ts`

- [ ] **Step 3: Update `shared/utils/index.ts` to remove moved exports**

```typescript
export {shallow} from './shallow'
export {cx} from './cx'
export {merge} from './merge'
```

---

### Task 11: Update `packages/core/index.ts`

**Files:**

- Modify: `packages/core/index.ts`

- [ ] **Step 1: Update slot type exports to come from new location**

Replace line 24:

```typescript
export {Store, type Slot, type MarkSlot, type OverlaySlot} from './src/features/store'
```

With:

```typescript
export {Store} from './src/features/store'
export type {Slot, MarkSlot, OverlaySlot} from './src/features/slots'
```

---

### Task 12: Run all checks

- [ ] **Step 1: Run tests**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: No type errors

- [ ] **Step 4: Run lint**

Run: `pnpm run lint`
Expected: No lint errors

- [ ] **Step 5: Run format**

Run: `pnpm run format`
Expected: No format errors

---

### Task 13: Commit

- [ ] **Step 1: Stage and commit all changes**

```bash
git add packages/core/src/features/slots/ packages/core/src/features/store/ packages/core/src/shared/utils/ packages/core/index.ts docs/superpowers/plans/2026-04-09-extract-slots-feature.md
git commit -m "refactor(core): extract slot factories into features/slots module"
```
