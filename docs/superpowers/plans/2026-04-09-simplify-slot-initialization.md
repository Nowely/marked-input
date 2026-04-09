# Simplify Store.slot Initialization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 65-line constructor slot initialization with 3 module-level factory functions and a 6-line field initializer.

**Architecture:** Extract `createNamedSlot`, `createOverlaySlot`, and `createMarkSlot` as private module-level factories in `Store.ts`. The `slot` field moves from constructor assignment to a `readonly` field initializer. The closures capture signals by reference and read `_defaultSpan` lazily, so initialization order is preserved. Also removes two unused imports (`cx`, `merge`).

**Tech Stack:** TypeScript, alien-signals reactive system

---

## File Structure

| Action | File                                             | Responsibility                    |
| ------ | ------------------------------------------------ | --------------------------------- |
| Modify | `packages/core/src/features/store/Store.ts`      | Factories + simplified slot field |
| Modify | `packages/core/src/features/store/Store.spec.ts` | New tests for slot factories      |

---

### Task 1: Remove unused imports

**Files:**

- Modify: `packages/core/src/features/store/Store.ts:15-16`

- [ ] **Step 1: Remove the two unused import lines**

Remove these two lines from Store.ts (they are not used anywhere in the file):

```ts
import {cx} from '../../shared/utils/cx'
import {merge} from '../../shared/utils/merge'
```

- [ ] **Step 2: Verify build still passes**

Run: `pnpm run build`
Expected: PASS (no errors)

---

### Task 2: Add factory functions at module level

**Files:**

- Modify: `packages/core/src/features/store/Store.ts` (add between imports and `StoreOptions` interface, after line 29)

- [ ] **Step 1: Add `createNamedSlot` factory**

Insert after the `import type { Parser, Token }` block (before `StoreOptions` interface):

```ts
import type {Signal} from '../../shared/signals'

function createNamedSlot(
    slots: Signal<CoreSlots | undefined>,
    slotProps: Signal<CoreSlotProps | undefined>,
    name: SlotName
): Slot {
    return {
        use: () => [resolveSlot(name, slots.use()), resolveSlotProps(name, slotProps.use())] as const,
        get: () => [resolveSlot(name, slots.get()), resolveSlotProps(name, slotProps.get())] as const,
    }
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
```

Note: `SlotName` is already imported from `resolveSlot.ts` — but it's a type exported from that module. Check the existing imports and add `type {SlotName}` to the `resolveSlot` import if not already present.

- [ ] **Step 2: Update the `resolveSlot` import line to also import `SlotName`**

Change:

```ts
import {resolveMarkSlot, resolveOverlaySlot, resolveSlot, resolveSlotProps} from '../../shared/utils/resolveSlot'
```

To:

```ts
import {resolveMarkSlot, resolveOverlaySlot, resolveSlot, resolveSlotProps} from '../../shared/utils/resolveSlot'
import type {SlotName} from '../../shared/utils/resolveSlot'
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm run typecheck`
Expected: PASS

---

### Task 3: Convert `slot` from constructor to field initializer

**Files:**

- Modify: `packages/core/src/features/store/Store.ts` (constructor body + field declaration)

- [ ] **Step 1: Replace the `slot` field declaration + constructor body**

Replace the existing field declaration (lines 98-104):

```ts
	readonly slot: {
		container: Slot
		block: Slot
		span: Slot
		overlay: OverlaySlot
		mark: MarkSlot
	}
```

With the initialized field:

```ts
	readonly slot = {
		container: createNamedSlot(this.state.slots, this.state.slotProps, 'container'),
		block: createNamedSlot(this.state.slots, this.state.slotProps, 'block'),
		span: createNamedSlot(this.state.slots, this.state.slotProps, 'span'),
		overlay: createOverlaySlot(this.state.Overlay),
		mark: createMarkSlot(this.state.options, this.state.Mark, this.state.Span, () => this._defaultSpan),
	}
```

- [ ] **Step 2: Remove the slot assignment from the constructor**

Delete the entire `this.slot = { ... }` block from the constructor (approximately lines 137-200 in current file). The constructor body should now be just:

```ts
	constructor(options: StoreOptions) {
		this._defaultSpan = options.defaultSpan
	}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm run typecheck`
Expected: PASS

---

### Task 4: Verify all existing tests pass

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 2: Run the full check suite**

Run: `pnpm run build && pnpm run typecheck && pnpm run lint && pnpm run format`
Expected: All PASS

---

### Task 5: Add slot-specific tests

**Files:**

- Modify: `packages/core/src/features/store/Store.spec.ts`

- [ ] **Step 1: Add tests for slot behavior**

Add a new `describe('slot', ...)` block inside the existing `describe('Store', ...)` in `Store.spec.ts`:

```ts
describe('slot', () => {
    it('should return default container slot', () => {
        const store = new Store({defaultSpan: null})
        expect(store.slot.container.get()).toEqual(['div', undefined])
    })

    it('should return default block slot', () => {
        const store = new Store({defaultSpan: null})
        expect(store.slot.block.get()).toEqual(['div', undefined])
    })

    it('should return default span slot', () => {
        const store = new Store({defaultSpan: null})
        expect(store.slot.span.get()).toEqual(['span', undefined])
    })

    it('should resolve custom container slot', () => {
        const store = new Store({defaultSpan: null})
        store.state.slots.set({container: 'section'})
        expect(store.slot.container.get()).toEqual(['section', undefined])
    })

    it('should resolve custom slot with props', () => {
        const store = new Store({defaultSpan: null})
        store.state.slots.set({span: 'strong'})
        store.state.slotProps.set({span: {className: 'bold'}})
        const [, props] = store.slot.span.get()
        expect(props).toEqual({className: 'bold'})
    })

    it('should resolve mark slot for text token using defaultSpan', () => {
        const store = new Store({defaultSpan: 'span'})
        const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
        const [component, props] = store.slot.mark.get(token)
        expect(component).toBe('span')
        expect(props).toEqual({value: 'hello'})
    })

    it('should throw for mark token without Mark component', () => {
        const store = new Store({defaultSpan: null})
        const token = {
            type: 'mark',
            value: '@john',
            meta: undefined,
            descriptor: {index: 0},
            position: {start: 0, end: 5},
        } as any
        expect(() => store.slot.mark.get(token)).toThrow('No mark component found')
    })
})
```

- [ ] **Step 2: Run the tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/store/Store.spec.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/store/Store.ts packages/core/src/features/store/Store.spec.ts
git commit -m "refactor(core): simplify Store.slot initialization with factory functions"
```
