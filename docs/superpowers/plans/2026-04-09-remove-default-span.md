# Remove `defaultSpan` from Store — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `defaultSpan` constructor parameter from `Store`, making it framework-agnostic and argument-less.

**Architecture:** Hardcode `'span'` string as the fallback in `resolveMarkSlot()` instead of passing a framework component through the Store constructor. Remove `StoreOptions`, `_defaultSpan`, and `getDefaultSpan` from core. Remove `Span` component files from react/vue packages.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Update `resolveMarkSlot` to hardcode `'span'` fallback

**Files:**
- Modify: `packages/core/src/features/slots/resolveSlot.ts:48-61`
- Test: `packages/core/src/features/slots/createSlots.spec.ts`

- [ ] **Step 1: Update `resolveMarkSlot` signature and body**

In `packages/core/src/features/slots/resolveSlot.ts`, remove the `defaultSpan` parameter from `resolveMarkSlot` and replace the fallback with `'span'`:

```typescript
export function resolveMarkSlot(
	token: Token,
	tokenOptions: SlotOption[] | undefined,
	GlobalMark: unknown,
	GlobalSpan: unknown
) {
	if (token.type === 'text') return [GlobalSpan ?? 'span', {value: token.content}] as const
	const option = tokenOptions?.[token.descriptor.index]
	const baseProps = {value: token.value, meta: token.meta}
	const props = resolveOptionSlot(option?.mark, baseProps)
	const Component = option?.Mark ?? GlobalMark
	if (!Component) throw new Error('No mark component found. Provide either option.Mark or global Mark.')
	return [Component, props] as const
}
```

- [ ] **Step 2: Run tests to verify**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/slots/createSlots.spec.ts`
Expected: FAIL — `createSlots` still passes `getDefaultSpan`

---

### Task 2: Remove `getDefaultSpan` from `createSlots`

**Files:**
- Modify: `packages/core/src/features/slots/createSlots.ts:30-61`

- [ ] **Step 1: Remove `getDefaultSpan` from `createMarkSlot` and `SlotSignals`**

In `packages/core/src/features/slots/createSlots.ts`:

1. Remove `getDefaultSpan: () => unknown` from the `SlotSignals` interface (line 50)
2. Remove `getDefaultSpan` parameter from `createMarkSlot` function (line 34):
```typescript
function createMarkSlot(
	options: Signal<CoreOption[]>,
	mark: Signal<GenericComponent | undefined>,
	span: Signal<GenericComponent | undefined>
): MarkSlot {
	return {
		use: (token: Token) => resolveMarkSlot(token, options.get(), mark.use(), span.use()),
		get: (token: Token) => resolveMarkSlot(token, options.get(), mark.get(), span.get()),
	} as unknown as MarkSlot
}
```
3. Remove `getDefaultSpan` from `createSlots` function call to `createMarkSlot` (line 59):
```typescript
mark: createMarkSlot(signals.options, signals.Mark, signals.Span),
```

- [ ] **Step 2: Run tests to verify**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/slots/createSlots.spec.ts`
Expected: FAIL — test setup still passes `getDefaultSpan`

---

### Task 3: Update `createSlots.spec.ts` to remove `getDefaultSpan`

**Files:**
- Modify: `packages/core/src/features/slots/createSlots.spec.ts`

- [ ] **Step 1: Update the `setup` helper and inline `createSlots` calls**

In `packages/core/src/features/slots/createSlots.spec.ts`:

1. Change `setup` function to remove `defaultSpan` param and `getDefaultSpan`:
```typescript
function setup(): ReturnType<typeof createSlots> {
	return createSlots({
		slots: signal<CoreSlots | undefined>(undefined),
		slotProps: signal<CoreSlotProps | undefined>(undefined),
		Overlay: signal<GenericComponent | undefined>(undefined),
		options: signal<CoreOption[]>([]),
		Mark: signal<GenericComponent | undefined>(undefined),
		Span: signal<GenericComponent | undefined>(undefined),
	})
}
```

2. Remove `getDefaultSpan: () => defaultSpan` from both inline `createSlots` calls (lines 50 and 66).

3. Update the "should resolve mark slot for text token using defaultSpan" test — since `'span'` is now hardcoded, the test should verify the string fallback:
```typescript
it('should resolve mark slot for text token using hardcoded span fallback', () => {
	const slot = setup()
	const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
	const [component, props] = slot.mark.get(token)
	expect(component).toBe('span')
	expect(props).toEqual({value: 'hello'})
})
```

- [ ] **Step 2: Run tests to verify**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/slots/createSlots.spec.ts`
Expected: PASS

---

### Task 4: Remove `defaultSpan` from Store

**Files:**
- Modify: `packages/core/src/features/store/Store.ts`

- [ ] **Step 1: Remove `StoreOptions`, `_defaultSpan`, constructor, and `getDefaultSpan`**

In `packages/core/src/features/store/Store.ts`:

1. Remove the entire `StoreOptions` interface (lines 57-59):
```typescript
// DELETE these lines:
export interface StoreOptions {
	defaultSpan: unknown
}
```

2. Remove `getDefaultSpan: () => this._defaultSpan,` from the `slot` creation (line 124).

3. Remove `private readonly _defaultSpan: unknown` (line 156) and the constructor (lines 158-160):
```typescript
// DELETE these lines:
private readonly _defaultSpan: unknown

constructor(options: StoreOptions) {
    this._defaultSpan = options.defaultSpan
}
```

4. In `packages/core/src/features/store/index.ts`, remove `StoreOptions` from the re-export:
```typescript
export {Store} from './Store'
```

- [ ] **Step 2: Run Store tests to verify**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/store/Store.spec.ts`
Expected: FAIL — tests still use `new Store({defaultSpan: null})`

---

### Task 5: Update `Store.spec.ts`

**Files:**
- Modify: `packages/core/src/features/store/Store.spec.ts`

- [ ] **Step 1: Replace all `new Store({defaultSpan: null})` with `new Store()`**

In `packages/core/src/features/store/Store.spec.ts`, replace all occurrences of `new Store({defaultSpan: null})` with `new Store()`. Also update the first test description from "should construct with only defaultSpan option" to "should construct with no arguments".

- [ ] **Step 2: Run tests to verify**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/store/Store.spec.ts`
Expected: PASS

---

### Task 6: Update remaining core spec files**

**Files:**
- Modify: `packages/core/src/features/overlay/OverlayController.spec.ts`
- Modify: `packages/core/src/features/lifecycle/Lifecycle.spec.ts`
- Modify: `packages/core/src/features/events/SystemListenerController.spec.ts`
- Modify: `packages/core/src/features/selection/TextSelectionController.spec.ts`
- Modify: `packages/core/src/features/editable/ContentEditableController.spec.ts`

- [ ] **Step 1: Replace all `new Store({defaultSpan: null})` with `new Store()`**

In each of the 5 files above, replace all `new Store({defaultSpan: null})` with `new Store()`.

- [ ] **Step 2: Run full core tests to verify**

Run: `pnpm --filter @markput/core exec vitest run`
Expected: PASS

---

### Task 7: Update React package

**Files:**
- Modify: `packages/react/markput/src/components/MarkedInput.tsx`

- [ ] **Step 1: Remove `defaultSpan` from Store construction and remove Span import**

In `packages/react/markput/src/components/MarkedInput.tsx`:

1. Remove line 13: `import {Span as DefaultSpan} from './Span'`
2. Change line 92: `const nextStore = new Store({defaultSpan: DefaultSpan})` to `const nextStore = new Store()`

- [ ] **Step 2: Verify Span.tsx can be deleted**

Check that `Span.tsx` is not imported anywhere else (it isn't — confirmed in exploration). Then delete:
```
rm packages/react/markput/src/components/Span.tsx
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

---

### Task 8: Update Vue package

**Files:**
- Modify: `packages/vue/markput/src/components/MarkedInput.vue`

- [ ] **Step 1: Remove `defaultSpan` from Store construction and remove Span import**

In `packages/vue/markput/src/components/MarkedInput.vue`:

1. Remove line 13: `import Span from './Span.vue'`
2. Change line 23: `const store = shallowRef(new Store({defaultSpan: markRaw(Span)}))` to `const store = shallowRef(new Store())`
3. Keep `markRaw` in the Vue import — it's still used in `Token.vue`.

- [ ] **Step 2: Delete Span.vue**

Check that `Span.vue` is not imported anywhere else (it isn't). Then delete:
```
rm packages/vue/markput/src/components/Span.vue
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

---

### Task 9: Run full verification

- [ ] **Step 1: Run all checks**

Run: `pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint && pnpm run format`

Expected: All pass with no errors.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "refactor(core): remove defaultSpan from Store constructor

Hardcode 'span' string in resolveMarkSlot fallback instead of passing
framework-specific Span component through Store. Store is now argument-less.
Remove Span component files from react/vue packages."
```
