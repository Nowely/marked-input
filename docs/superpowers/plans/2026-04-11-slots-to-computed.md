# Slots → store.computed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `store.slot` and `createSlots`; fold all 5 slot derivations into `store.computed` as `Computed<T>` values.

**Architecture:** Named slots (`container`, `block`, `span`) become `Computed<readonly [unknown, props]>`; parameterized slots (`mark`, `overlay`) become `Computed<(arg) => readonly [unknown, unknown]>` — a computed that returns a resolver function. Slot types (`Slot`, `MarkSlot`, `OverlaySlot`) become thin interfaces extending `Computed<T>`, kept as module-augmentation targets for framework packages.

**Tech Stack:** TypeScript, alien-signals (`computed()`), Vitest, React, Vue 3, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-04-11-slots-to-computed-design.md`

---

## File Map

| Action | File |
|--------|------|
| Modify | `packages/core/src/features/slots/types.ts` |
| Modify | `packages/core/src/store/Store.ts` |
| Modify | `packages/core/src/store/Store.spec.ts` |
| Modify | `packages/core/src/features/slots/index.ts` |
| **Delete** | `packages/core/src/features/slots/createSlots.ts` |
| **Delete** | `packages/core/src/features/slots/createSlots.spec.ts` |
| Modify | `packages/react/markput/src/lib/providers/StoreContext.ts` |
| Modify | `packages/react/markput/src/components/Container.tsx` |
| Modify | `packages/react/markput/src/components/Block.tsx` |
| Modify | `packages/react/markput/src/components/Token.tsx` |
| Modify | `packages/react/markput/src/components/OverlayRenderer.tsx` |
| Modify | `packages/vue/markput/src/lib/hooks/useStore.ts` |
| Modify | `packages/vue/markput/src/components/Container.vue` |
| Modify | `packages/vue/markput/src/components/Token.vue` |
| Modify | `packages/vue/markput/src/components/OverlayRenderer.vue` |

---

## Task 1: Write failing slot tests in Store.spec.ts

**Files:**
- Modify: `packages/core/src/store/Store.spec.ts`

- [ ] **Step 1: Add the `describe('computed slots')` block**

Open `packages/core/src/store/Store.spec.ts`. At the very end of the top-level `describe('Store', () => {` block (before its closing `})`), append:

```typescript
	describe('computed slots', () => {
		it('should return default container slot', () => {
			const store = new Store()
			expect(store.computed.container()).toEqual(['div', undefined])
		})

		it('should return default block slot', () => {
			const store = new Store()
			expect(store.computed.block()).toEqual(['div', undefined])
		})

		it('should return default span slot', () => {
			const store = new Store()
			expect(store.computed.span()).toEqual(['span', undefined])
		})

		it('should resolve custom container slot', () => {
			const store = new Store()
			store.setState({slots: {container: 'section'}})
			expect(store.computed.container()).toEqual(['section', undefined])
		})

		it('should resolve slot with props', () => {
			const store = new Store()
			store.setState({
				slots: {span: 'strong'},
				slotProps: {span: {className: 'bold'}},
			})
			const [, props] = store.computed.span()
			expect(props).toEqual({className: 'bold'})
		})

		it('should resolve mark slot for text token using span fallback', () => {
			const store = new Store()
			const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
			const [component, props] = store.computed.mark()(token)
			expect(component).toBe('span')
			expect(props).toEqual({})
		})

		it('should pass value prop to custom Span component for text token', () => {
			const CustomSpan = () => null
			const store = new Store()
			store.setState({Span: CustomSpan})
			const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
			const [component, props] = store.computed.mark()(token)
			expect(component).toBe(CustomSpan)
			expect(props).toEqual({value: 'hello'})
		})

		it('should throw for mark token without Mark component', () => {
			const store = new Store()
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for test
			const token = {
				type: 'mark',
				value: '@john',
				meta: undefined,
				descriptor: {index: 0},
				position: {start: 0, end: 5},
			} as any
			expect(() => store.computed.mark()(token)).toThrow('No mark component found')
		})
	})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @markput/core exec vitest run src/store/Store.spec.ts
```

Expected: 7 failures with `TypeError: store.computed.container is not a function` (or property does not exist). The existing passing tests must remain green.

---

## Task 2: Update `slots/types.ts`

**Files:**
- Modify: `packages/core/src/features/slots/types.ts`

- [ ] **Step 1: Replace the file contents**

Replace the entire file with:

```typescript
import type {Computed} from '../../shared/signals'
import type {CoreOption} from '../../shared/types'
import type {Token} from '../parsing'

// These interfaces exist as module-augmentation targets for framework packages (React, Vue).
// Core implements them via computed() and casts with `as unknown as Slot` etc.

export interface Slot extends Computed<readonly [unknown, Record<string, unknown> | undefined]> {}

export interface MarkSlot extends Computed<(token: Token) => readonly [unknown, unknown]> {}

export interface OverlaySlot
	extends Computed<(option?: CoreOption, defaultComponent?: unknown) => readonly [unknown, unknown]> {}
```

---

## Task 3: Update `Store.ts` — add slot computeds, remove `slot` property

**Files:**
- Modify: `packages/core/src/store/Store.ts`

- [ ] **Step 1: Update the import for the slots feature**

Find this line (~line 14):
```typescript
import {createSlots} from '../features/slots'
```

Replace it with:
```typescript
import {resolveMarkSlot, resolveOverlaySlot, resolveSlot, resolveSlotProps} from '../features/slots'
import type {MarkSlot, OverlaySlot, Slot} from '../features/slots'
```

- [ ] **Step 2: Add 5 computed entries to `readonly computed`**

Find the closing `}` of the `readonly computed` block (~line 108):
```typescript
		containerStyle: computed(prev => {
			const next = merge(this.state.style(), this.state.slotProps()?.container?.style)
			return prev && shallow(prev, next) ? prev : next
		}),
	}
```

Replace with:
```typescript
		containerStyle: computed(prev => {
			const next = merge(this.state.style(), this.state.slotProps()?.container?.style)
			return prev && shallow(prev, next) ? prev : next
		}),
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

- [ ] **Step 3: Remove `readonly slot = createSlots(...)`**

Find and delete this block (~lines 110-117):
```typescript
	readonly slot = createSlots({
		slots: this.state.slots,
		slotProps: this.state.slotProps,
		Overlay: this.state.Overlay,
		options: this.state.options,
		Mark: this.state.Mark,
		Span: this.state.Span,
	})
```

- [ ] **Step 4: Run core tests — verify new tests now pass**

```bash
pnpm --filter @markput/core exec vitest run src/store/Store.spec.ts
```

Expected: All tests in Store.spec.ts pass, including the 7 new `computed slots` tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/slots/types.ts packages/core/src/store/Store.ts packages/core/src/store/Store.spec.ts
git commit -m "feat(core): fold slot computeds into store.computed, replace Slot types with Computed<T> interfaces"
```

---

## Task 4: Update `slots/index.ts` and delete createSlots files

**Files:**
- Modify: `packages/core/src/features/slots/index.ts`
- Delete: `packages/core/src/features/slots/createSlots.ts`
- Delete: `packages/core/src/features/slots/createSlots.spec.ts`

- [ ] **Step 1: Remove `createSlots` and `SlotSignals` from index.ts**

Replace the entire file with:

```typescript
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

- [ ] **Step 2: Delete `createSlots.ts` and `createSlots.spec.ts`**

```bash
rm packages/core/src/features/slots/createSlots.ts
rm packages/core/src/features/slots/createSlots.spec.ts
```

- [ ] **Step 3: Run full core test suite**

```bash
pnpm --filter @markput/core test --run
```

Expected: All tests pass. The deleted spec file is gone; its coverage is now in Store.spec.ts. Zero failures.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/slots/index.ts
git rm packages/core/src/features/slots/createSlots.ts
git rm packages/core/src/features/slots/createSlots.spec.ts
git commit -m "chore(core): remove createSlots factory, clean up slots index exports"
```

---

## Task 5: Update React framework augmentations

**Files:**
- Modify: `packages/react/markput/src/lib/providers/StoreContext.ts`

- [ ] **Step 1: Update the module augmentation block**

The current `declare module '@markput/core'` block augments `MarkSlot`, `OverlaySlot`, and `Slot`. Replace the entire block:

```typescript
// Before (lines 7-17):
declare module '@markput/core' {
	interface MarkSlot {
		use(token: Token): readonly [ComponentType<MarkProps>, MarkProps]
	}
	interface OverlaySlot {
		use(option?: CoreOption, defaultComponent?: unknown): readonly [ComponentType<OverlayProps>, OverlayProps]
	}
	interface Slot {
		use(): readonly [ElementType, Record<string, unknown> | undefined]
	}
}
```

With:

```typescript
declare module '@markput/core' {
	interface MarkSlot {
		use(): (token: Token) => readonly [ComponentType<MarkProps>, MarkProps]
	}
	interface OverlaySlot {
		use(): (option?: CoreOption, defaultComponent?: unknown) => readonly [ComponentType<OverlayProps>, OverlayProps]
	}
}
```

Also remove the `ElementType` import from `react` if it's no longer used elsewhere in the file. The `import type {ComponentType, ElementType} from 'react'` line changes to `import type {ComponentType} from 'react'`.

The full updated file:

```typescript
import type {CoreOption, Store, Token} from '@markput/core'
import type {ComponentType} from 'react'
import {createContext, useContext} from 'react'

import type {MarkProps, OverlayProps} from '../../types'

declare module '@markput/core' {
	interface MarkSlot {
		use(): (token: Token) => readonly [ComponentType<MarkProps>, MarkProps]
	}
	interface OverlaySlot {
		use(): (option?: CoreOption, defaultComponent?: unknown) => readonly [ComponentType<OverlayProps>, OverlayProps]
	}
}

export const StoreContext = createContext<Store | undefined>(undefined)
StoreContext.displayName = 'StoreContext'

export function useStore(): Store {
	const store = useContext(StoreContext)
	if (store === undefined) {
		throw new Error('Store not found. Make sure to wrap component in StoreContext.')
	}
	return store
}
```

---

## Task 6: Update React components

**Files:**
- Modify: `packages/react/markput/src/components/Container.tsx`
- Modify: `packages/react/markput/src/components/Block.tsx`
- Modify: `packages/react/markput/src/components/Token.tsx`
- Modify: `packages/react/markput/src/components/OverlayRenderer.tsx`

- [ ] **Step 1: Update Container.tsx**

Change line 22 from:
```typescript
	const [ContainerComponent, containerProps] = store.slot.container.use()
```
To:
```typescript
	const [ContainerComponent, containerProps] = store.computed.container.use()
```

- [ ] **Step 2: Update Block.tsx**

Change line 19 from:
```typescript
	const [ContainerComponent, containerProps] = store.slot.block.use()
```
To:
```typescript
	const [ContainerComponent, containerProps] = store.computed.block.use()
```

- [ ] **Step 3: Update Token.tsx**

Change line 9 from:
```typescript
	const [Component, props] = store.slot.mark.use(mark)
```
To:
```typescript
	const resolveMarkSlot = store.computed.mark.use()
	const [Component, props] = resolveMarkSlot(mark)
```

- [ ] **Step 4: Update OverlayRenderer.tsx**

Change line 11 from:
```typescript
	const [Overlay, props] = store.slot.overlay.use(overlayMatch?.option, Suggestions)
```
To:
```typescript
	const resolveOverlay = store.computed.overlay.use()
	const [Overlay, props] = resolveOverlay(overlayMatch?.option, Suggestions)
```

- [ ] **Step 5: Build React package to catch type errors**

```bash
pnpm --filter @markput/react build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add packages/react/markput/src/lib/providers/StoreContext.ts \
        packages/react/markput/src/components/Container.tsx \
        packages/react/markput/src/components/Block.tsx \
        packages/react/markput/src/components/Token.tsx \
        packages/react/markput/src/components/OverlayRenderer.tsx
git commit -m "feat(react): update slot usage to store.computed, update module augmentations"
```

---

## Task 7: Update Vue framework augmentations

**Files:**
- Modify: `packages/vue/markput/src/lib/hooks/useStore.ts`

- [ ] **Step 1: Update the module augmentation block**

The current `declare module '@markput/core'` block has `Signal<T>`, `MarkSlot`, `OverlaySlot`, and `Slot`. Replace the entire block:

```typescript
// Before:
declare module '@markput/core' {
	interface Signal<T> {
		use(): Ref<T>
	}
	interface MarkSlot {
		use(token: Token): readonly [Component, MarkProps]
		get(token: Token): readonly [Component, MarkProps]
	}
	interface OverlaySlot {
		use(option?: Option, defaultComponent?: Component): readonly [Component, OverlayProps]
		get(option?: Option, defaultComponent?: Component): readonly [Component, OverlayProps]
	}
	interface Slot {
		use(): readonly [Component | string, Record<string, unknown> | undefined]
		get(): readonly [Component | string, Record<string, unknown> | undefined]
	}
}
```

With:

```typescript
declare module '@markput/core' {
	interface Signal<T> {
		use(): Ref<T>
	}
	interface Computed<T> {
		use(): Ref<T>
	}
	interface MarkSlot {
		use(): Ref<(token: Token) => readonly [Component, MarkProps]>
	}
	interface OverlaySlot {
		use(): Ref<(option?: Option, defaultComponent?: Component) => readonly [Component, OverlayProps]>
	}
}
```

The `Slot` augmentation is removed — `Computed<T>` covers it. The `get()` overloads on `MarkSlot` and `OverlaySlot` are removed since `.get()` no longer exists.

The full updated file:

```typescript
import type {Computed, Store, Token} from '@markput/core'
import {inject} from 'vue'
import type {Component, Ref} from 'vue'

import type {MarkProps, Option, OverlayProps} from '../../types'
import {STORE_KEY} from '../providers/storeKey'

declare module '@markput/core' {
	interface Signal<T> {
		use(): Ref<T>
	}
	interface Computed<T> {
		use(): Ref<T>
	}
	interface MarkSlot {
		use(): Ref<(token: Token) => readonly [Component, MarkProps]>
	}
	interface OverlaySlot {
		use(): Ref<(option?: Option, defaultComponent?: Component) => readonly [Component, OverlayProps]>
	}
}

export function useStore(): Store {
	const store = inject(STORE_KEY)
	if (!store) {
		throw new Error('Store not found. Make sure to use this composable inside a MarkedInput component.')
	}
	return store
}
```

Note: the `import type {Computed, ...} from '@markput/core'` import is needed for the module augmentation to reference `Computed<T>`. Check if `Computed` is already exported from `@markput/core/index` — if not, the augmentation still works (TypeScript resolves it from the module) but the import may need to be removed if it causes an unused-import lint error. In that case, just keep the augmentation without the import.

---

## Task 8: Update Vue components

**Files:**
- Modify: `packages/vue/markput/src/components/Container.vue`
- Modify: `packages/vue/markput/src/components/Token.vue`
- Modify: `packages/vue/markput/src/components/OverlayRenderer.vue`

- [ ] **Step 1: Update Container.vue**

The current `<script setup>` block has manual dep-tracking and `.get()`. Replace the slot-related code:

```typescript
// Remove these 3 lines:
const slotsRef = store.state.slots.use()
const slotPropsRef = store.state.slotProps.use()

const containerSlot = computed(() => {
	// Access .value to register reactive dependencies
	slotsRef.value
	slotPropsRef.value
	return store.slot.container.get()
})
```

With:
```typescript
const containerSlot = store.computed.container.use()
```

And update the template: change `:is="containerSlot[0]"` and `v-bind="containerSlot[1]"` to `:is="containerSlot.value[0]"` and `v-bind="containerSlot.value[1]"`.

The full updated `<script setup>`:

```typescript
<script setup lang="ts">
import type {CSSProperties} from '@markput/core'
import {computed, watch, type Ref} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import Block from './Block.vue'
import Token from './Token.vue'

const store = useStore()
const drag = store.state.drag.use()
const readOnly = store.state.readOnly.use()
const tokens = store.state.tokens.use()
watch(tokens, () => store.event.afterTokensRendered(), {flush: 'post', immediate: true})

const className = store.computed.containerClass.use()
const style = store.computed.containerStyle.use() as unknown as Ref<CSSProperties | undefined>
const key = store.key

const containerSlot = store.computed.container.use()
const containerStyle = computed(() => {
	const s = style.value
	if (drag.value && !readOnly.value) {
		return s ? {paddingLeft: 24, ...s} : {paddingLeft: 24}
	}
	return s
})
</script>
```

And the updated template section (replace `containerSlot[0]` and `containerSlot[1]`):
```html
<template>
	<component
		:is="containerSlot.value[0]"
		:ref="
			(el: any) => {
				store.refs.container = el?.$el ?? el
			}
		"
		v-bind="containerSlot.value[1]"
		:class="className"
		:style="containerStyle"
	>
		<template v-if="drag">
			<Block v-for="(token, index) in tokens" :key="key.get(token)" :token="token" :block-index="index" />
		</template>
		<template v-else>
			<Token v-for="token in tokens" :key="key.get(token)" :mark="token" />
		</template>
	</component>
</template>
```

- [ ] **Step 2: Update Token.vue**

In the `setup()` function, replace the manual dep-tracking block:

```typescript
// Remove:
const MarkRef = store.state.Mark.use()
const SpanRef = store.state.Span.use()

const resolved = computed(() => {
	// Access .value to register reactive dependencies
	MarkRef.value
	SpanRef.value
	return store.slot.mark.get(props.mark)
})
```

With:
```typescript
const resolveMarkSlot = store.computed.mark.use()
const resolved = computed(() => resolveMarkSlot.value(props.mark))
```

The full updated `setup()` function in Token.vue:

```typescript
setup(props): () => VNode {
	provide(
		TOKEN_KEY,
		toRef(() => props.mark)
	)

	const store = useStore()
	const key = store.key
	const resolveMarkSlot = store.computed.mark.use()
	const resolved = computed(() => resolveMarkSlot.value(props.mark))

	return () => {
		const [Comp, compProps] = resolved.value

		const mark = props.mark
		const children =
			mark.type === 'mark' && mark.children.length > 0
				? () => mark.children.map(child => h(markRaw(Token), {key: key.get(child), mark: child}))
				: undefined

		return h(Comp as Component, compProps, children)
	}
},
```

- [ ] **Step 3: Update OverlayRenderer.vue**

Replace the manual dep-tracking and `.get()` block:

```typescript
// Remove:
const OverlayRef = store.state.Overlay.use()

const resolved = computed(() => {
	const match = overlayMatchRef.value
	if (!match) return null
	// Access .value to register Overlay as a reactive dependency
	OverlayRef.value
	return store.slot.overlay.get(match.option, Suggestions)
})
```

With:
```typescript
const resolveOverlay = store.computed.overlay.use()

const resolved = computed(() => {
	const match = overlayMatchRef.value
	if (!match) return null
	return resolveOverlay.value(match.option, Suggestions)
})
```

The full updated `<script setup>`:

```typescript
<script setup lang="ts">
import type {OverlayMatch} from '@markput/core'
import {computed, type Ref} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import type {Option} from '../types'
import Suggestions from './Suggestions/Suggestions.vue'

const store = useStore()
const overlayMatchRef = store.state.overlayMatch.use() as Ref<OverlayMatch<Option> | undefined>
const overlayKey = computed(() => (overlayMatchRef.value ? store.key.get(overlayMatchRef.value.option) : undefined))
const resolveOverlay = store.computed.overlay.use()

const resolved = computed(() => {
	const match = overlayMatchRef.value
	if (!match) return null
	return resolveOverlay.value(match.option, Suggestions)
})
</script>
```

- [ ] **Step 4: Build Vue package to catch type errors**

```bash
pnpm --filter @markput/vue build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add packages/vue/markput/src/lib/hooks/useStore.ts \
        packages/vue/markput/src/components/Container.vue \
        packages/vue/markput/src/components/Token.vue \
        packages/vue/markput/src/components/OverlayRenderer.vue
git commit -m "feat(vue): update slot usage to store.computed, update module augmentations"
```

---

## Task 9: Run full test suite and final verification

- [ ] **Step 1: Run all tests across all packages**

```bash
pnpm test
```

Expected: All tests pass. Test counts should be close to pre-refactor counts (core ~313, React ~171, Vue ~157) — the 7 `createSlots.spec.ts` tests have moved into Store.spec.ts, not been removed.

- [ ] **Step 2: Verify `store.slot` no longer appears anywhere**

```bash
grep -r "store\.slot\b" packages/ --include="*.ts" --include="*.tsx" --include="*.vue"
```

Expected: No matches.

- [ ] **Step 3: Final commit if any stray changes remain uncommitted**

```bash
git status
```

If clean, done. If not, commit with an appropriate message.

---

## Self-Review Notes

- **Spec coverage:** All 6 items from the spec's call-site table are covered. All 5 computed slots added to Store. File deletions covered. Framework augmentations covered. Vue components drop manual signal-touching (Container, Token, OverlayRenderer). React components updated. ✓
- **Type consistency:** `store.computed.mark` is `MarkSlot`; `resolveMarkSlot.value(token)` in Vue; `resolveMarkSlot(token)` in React — consistent naming within each task. ✓
- **No placeholders:** All code blocks are complete. ✓
- **Note on `Computed` import in Vue:** The `import type {Computed, ...} from '@markput/core'` in `useStore.ts` — if `Computed` is not re-exported from the core package root, remove it. The `interface Computed<T>` in a `declare module` block augments the type without needing an import. Check `packages/core/index.ts` to confirm.
