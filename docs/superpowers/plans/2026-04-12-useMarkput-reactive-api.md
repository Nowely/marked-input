# useMarkput Reactive API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `signal.use()` with a proper `useMarkput(selector)` hook that lives in framework adapter packages, enforces hook rules, and supports single and object selectors.

**Architecture:** Remove `.use()` and the hook-factory plumbing from core signals entirely. Each framework adapter (`@markput/react`, `@markput/vue`) provides its own `useMarkput(selector)` hook that subscribes to signals using the framework's native mechanism. The selector receives the Store and returns a Signal/Computed (single) or a plain object of Signals/Computeds (multi); the hook unwraps them and returns the current value(s).

**Tech Stack:** alien-signals (reactive core), React `useSyncExternalStore`, Vue `shallowRef` + alien-signals `effect`, TypeScript.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `packages/core/src/shared/signals/signal.ts` | Remove `.use()` from interfaces and factory implementations |
| Delete | `packages/core/src/shared/signals/registry.ts` | Hook factory registry no longer needed |
| Modify | `packages/core/src/shared/signals/index.ts` | Remove registry exports |
| Modify | `packages/core/index.ts` | Remove `UseHookFactory`, `setUseHookFactory`, `getUseHookFactory` exports |
| Modify | `packages/core/src/shared/signals/computed.spec.ts` | Remove `.use()` test and `setUseHookFactory` setup |
| Create | `packages/react/markput/src/lib/hooks/useMarkput.ts` | New subscription hook for React |
| Delete | `packages/react/markput/src/lib/hooks/createUseHook.ts` | Old hook-factory registration |
| Modify | `packages/react/markput/src/lib/providers/StoreContext.ts` | Remove module augmentation adding `.use()` to slot types |
| Modify | `packages/react/markput/src/components/MarkedInput.tsx` | Remove side-effect import of `createUseHook` |
| Modify | `packages/react/markput/index.ts` | Export `useMarkput` |
| Modify | `packages/react/markput/src/components/Container.tsx` | Migrate `.use()` → `useMarkput` |
| Modify | `packages/react/markput/src/components/Block.tsx` | Migrate `.use()` → `useMarkput` |
| Modify | `packages/react/markput/src/components/Token.tsx` | Migrate `.use()` → `useMarkput` |
| Modify | `packages/react/markput/src/lib/hooks/useMark.tsx` | Migrate `.use()` → `useMarkput` |
| Modify | `packages/react/markput/src/lib/hooks/useOverlay.tsx` | Migrate `.use()` → `useMarkput` |
| Create | `packages/vue/markput/src/lib/hooks/useMarkput.ts` | New subscription hook for Vue |
| Delete | `packages/vue/markput/src/lib/hooks/createUseHook.ts` | Old hook-factory registration |
| Modify | `packages/vue/markput/src/lib/hooks/useStore.ts` | Remove module augmentation adding `.use()` to signal/slot types |
| Modify | `packages/vue/markput/src/components/MarkedInput.vue` | Remove side-effect import of `createUseHook` |
| Modify | `packages/vue/markput/index.ts` | Export `useMarkput` |
| Modify | `packages/vue/markput/src/components/Container.vue` | Migrate `.use()` → `useMarkput` |
| Modify | `packages/vue/markput/src/components/Block.vue` | Migrate `.use()` → `useMarkput` |
| Modify | `packages/vue/markput/src/components/Token.vue` | Migrate `.use()` → `useMarkput` |
| Modify | `packages/vue/markput/src/lib/hooks/useMark.ts` | Migrate `.use()` → `useMarkput` |
| Modify | `packages/vue/markput/src/lib/hooks/useOverlay.ts` | Migrate `.use()` → `useMarkput` |

---

## Task 1: Strip `.use()` from core signals

Remove `.use()` from `Signal<T>`, `Computed<T>`, `Event<T>`, delete the registry, and clean up the spec.

**Files:**
- Modify: `packages/core/src/shared/signals/signal.ts`
- Delete: `packages/core/src/shared/signals/registry.ts`
- Modify: `packages/core/src/shared/signals/index.ts`
- Modify: `packages/core/index.ts`
- Modify: `packages/core/src/shared/signals/computed.spec.ts`

- [ ] **Step 1: Write a failing test proving `.use()` no longer exists on Signal**

Add this test at the bottom of `packages/core/src/shared/signals/computed.spec.ts`:

```ts
it('Signal should not have a .use() method', () => {
  const s = signal(1)
  // @ts-expect-error -- .use() must not exist on Signal after this refactor
  expect(typeof s.use).toBe('undefined')
})
```

- [ ] **Step 2: Run test to confirm it currently passes for the wrong reason**

```bash
pnpm --filter @markput/core test --run packages/core/src/shared/signals/computed.spec.ts
```

Expected: the new test FAILS (ts-expect-error suppresses the type error, but `.use` exists at runtime — actually it will PASS ts-expect-error since `.use` currently exists, meaning `@ts-expect-error` is satisfied. The runtime check `typeof s.use` will be `'function'`, not `'undefined'` — test FAILS). This confirms the test is meaningful.

- [ ] **Step 3: Replace `signal.ts` — remove `.use()` from interfaces and all factory paths**

Write `packages/core/src/shared/signals/signal.ts`:

```ts
import {
	signal as alienSignal,
	effect as alienEffect,
	computed as alienComputed,
	setActiveSub,
	startBatch,
	endBatch,
} from './alien-signals'

export {alienEffect as effect}

// ---------------------------------------------------------------------------
// Signal<T> — reactive state value
// ---------------------------------------------------------------------------

export interface Signal<T> {
	(): T
	(value: T | undefined): void
}

/**
 * Derives a plain-value object type from an object of signals.
 * `{ foo: Signal<string>, bar: Signal<number> }` → `{ foo: string, bar: number }`
 */
export type SignalValues<T> = {
	[K in keyof T]: T[K] extends Signal<infer V> | Computed<infer V> ? V : never
}

interface SignalOptions<T> {
	equals?: false | ((a: T, b: T) => boolean)
	readonly?: boolean
}

let writableScope = false

export function signal<T>(initial: T, opts?: SignalOptions<T>): Signal<T> {
	const hasCustomEquals = opts?.equals !== undefined

	// oxlint-disable-next-line no-non-null-assertion, no-unnecessary-type-assertion -- opts is defined when hasCustomEquals is true; TS does not narrow opts from the boolean variable
	const equalsOpt = hasCustomEquals ? opts!.equals : undefined
	if (hasCustomEquals && equalsOpt === false) {
		const _default = initial
		const hasDefault = initial !== undefined
		let seq = 0
		const inner = alienSignal<{v: T; seq: number} | undefined>(undefined)

		const read = (): T => {
			const box = inner()
			if (box === undefined) {
				// oxlint-disable-next-line no-unsafe-type-assertion -- when hasDefault is false, T includes undefined so returning undefined is safe
				return hasDefault ? _default : (undefined as T)
			}
			return box.v
		}

		const isReadonly = !!opts?.readonly
		// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
		const callable = function signalCallable(...args: [T | undefined] | []) {
			if (args.length) {
				if (isReadonly && !writableScope) return
				if (args[0] === undefined) {
					if (hasDefault && inner() === undefined) return
					inner(undefined)
				} else {
					inner({v: args[0], seq: seq++})
				}
			} else {
				return read()
			}
		} as unknown as Signal<T>

		return callable
	}

	if (hasCustomEquals && typeof equalsOpt === 'function') {
		const equalsFn = equalsOpt
		const _default = initial
		const hasDefault = initial !== undefined
		const inner = alienSignal<T | undefined>(undefined)

		const read = (): T => {
			const v = inner()
			if (v === undefined && hasDefault) return _default
			// oxlint-disable-next-line no-unsafe-type-assertion -- when hasDefault is false, T includes undefined so the cast is safe
			return v as T
		}

		const isReadonly = !!opts?.readonly
		// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
		const callable = function signalCallable(...args: [T | undefined] | []) {
			if (args.length) {
				if (isReadonly && !writableScope) return
				if (args[0] === undefined) {
					if (hasDefault && inner() === undefined) return
					inner(undefined)
				} else {
					if (!equalsFn(read(), args[0])) {
						inner(args[0])
					}
				}
			} else {
				return read()
			}
		} as unknown as Signal<T>

		return callable
	}

	const _default = initial
	const hasDefault = initial !== undefined
	const inner = alienSignal<T | undefined>(undefined)

	const read = (): T => {
		const v = inner()
		if (v === undefined && hasDefault) return _default
		// oxlint-disable-next-line no-unsafe-type-assertion -- when hasDefault is false, T includes undefined so the cast is safe
		return v as T
	}

	const isReadonly = !!opts?.readonly
	// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
	const callable = function signalCallable(...args: [T | undefined] | []) {
		if (args.length) {
			if (isReadonly && !writableScope) return
			const v = args[0]
			if (v === undefined && hasDefault) {
				if (inner() === undefined) return
				inner(undefined)
			} else {
				const current = inner()
				const effectiveCurrent = current === undefined && hasDefault ? _default : current
				if (effectiveCurrent !== v) {
					inner(v)
				}
			}
		} else {
			return read()
		}
	} as unknown as Signal<T>

	return callable
}

// ---------------------------------------------------------------------------
// Computed<T> — derived reactive value
// ---------------------------------------------------------------------------

export interface Computed<T> {
	(): T
}

export function computed<T>(getter: (previousValue?: T) => T): Computed<T> {
	const inner = alienComputed(getter)

	// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Computed<T> interface but TS can't verify the call signature
	const callable = function computedCallable(): T {
		return inner()
	} as unknown as Computed<T>

	return callable
}

// ---------------------------------------------------------------------------
// Event<T> — unified reactive event primitive
// ---------------------------------------------------------------------------

export interface Event<T = void> {
	/** Emit — always fires even when payload reference is unchanged. */
	(payload: T): void
	/** Read/subscribe — auto-tracks inside effects. Returns latest payload or undefined. */
	read(): T | undefined
}

export function event<T = void>(): Event<T> {
	let seq = 0
	const inner = alienSignal<{v: T; id: number} | undefined>(undefined)

	// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Event<T> interface but TS can't verify the call signature
	const callable = function eventCallable(payload: T) {
		inner({v: payload, id: ++seq})
	} as unknown as Event<T>

	callable.read = () => {
		const box = inner()
		return box !== undefined ? box.v : undefined
	}

	return callable
}

// ---------------------------------------------------------------------------
// watch() — skip-first-run helper for event subscriptions
// ---------------------------------------------------------------------------

/**
 * Creates an effect that skips its first execution.
 * Useful for subscribing to signals/events without firing on initial creation.
 * The callback receives `(newValue, oldValue)` on each subsequent run.
 *
 * Accepts a signal, event, or getter function as the dependency source:
 *   watch(store.event.delete, (payload) => { ... })
 *   watch(store.state.name,    (next, prev) => { ... })
 *   watch(() => computed(),    (next, prev) => { ... })  // getter form still valid
 *
 * @param dep - dependency source (signal, event, or getter function)
 * @param fn  - callback invoked on subsequent runs with (newValue, oldValue)
 * @returns dispose function
 */
export function watch<T>(dep: Signal<T>, fn: (newValue: T, oldValue: T | undefined) => void): () => void
export function watch<T>(dep: Event<T>, fn: (newValue: T, oldValue: T | undefined) => void): () => void
export function watch<T>(dep: () => T, fn: (newValue: T, oldValue: T | undefined) => void): () => void
export function watch<T>(
	dep: Signal<T> | Event<T> | (() => T),
	fn: (newValue: T, oldValue: T | undefined) => void
): () => void {
	let initialized = false
	let oldValue: T | undefined
	return alienEffect(() => {
		// oxlint-disable-next-line no-unsafe-type-assertion -- Event<T> returns T | undefined before first emit, but watch skips the first run so callback always receives T
		const newValue = ('read' in dep ? dep.read() : dep()) as T
		if (!initialized) {
			initialized = true
			oldValue = newValue
			return
		}
		const prev = oldValue
		oldValue = newValue
		const prevSub = setActiveSub(undefined)
		try {
			fn(newValue, prev)
		} finally {
			setActiveSub(prevSub)
		}
	})
}

// ---------------------------------------------------------------------------
// batch() — defer effect flush until callback completes
// ---------------------------------------------------------------------------

interface BatchOptions {
	writable?: boolean
}

export function batch(fn: () => void, opts?: BatchOptions): void {
	const prevWritable = writableScope
	if (opts?.writable) writableScope = true
	startBatch()
	try {
		fn()
	} finally {
		endBatch()
		writableScope = prevWritable
	}
}
```

- [ ] **Step 4: Delete `registry.ts`**

```bash
rm packages/core/src/shared/signals/registry.ts
```

- [ ] **Step 5: Update `signals/index.ts` — remove registry exports**

Write `packages/core/src/shared/signals/index.ts`:

```ts
export {signal, computed, effect, event, watch, batch} from './signal'
export type {Signal, Computed, Event, SignalValues} from './signal'
export {effectScope, setActiveSub} from './alien-signals'
```

- [ ] **Step 6: Update `core/index.ts` — remove registry exports**

Write `packages/core/index.ts`:

```ts
// Shared exports
export {cx, merge} from './src/shared/utils'
export {DEFAULT_OPTIONS} from './src/shared/constants'
export type {
	OverlayMatch,
	OverlayTrigger,
	CoreOption,
	CSSProperties,
	CoreSlots,
	CoreSlotProps,
	DataAttributes,
	DragAction,
	DragActions,
} from './src/shared/types'
export {MarkputHandler} from './src/shared/classes'

// Parsing exports (modern API)
export {annotate, denote} from './src/features/parsing'
export type {Markup, Token, TextToken, MarkToken} from './src/features/parsing'

// Reactive system
export type {Signal, Computed, Event} from './src/shared/signals'
export {effect, event, signal, computed, watch, batch} from './src/shared/signals'

// Store
export {Store} from './src/store'
export type {Slot, MarkSlot, OverlaySlot} from './src/features/slots'

// Overlay
export {createMarkFromOverlay, filterSuggestions, navigateSuggestions} from './src/features/overlay'

// Drag
export {getAlwaysShowHandleDrag} from './src/features/drag'

// Caret
export {Caret} from './src/features/caret'

// Mark Handler
export {MarkHandler, type MarkOptions, type RefAccessor} from './src/features/mark'
```

- [ ] **Step 7: Update `computed.spec.ts` — remove `.use()` test and registry setup, keep the new test**

Write `packages/core/src/shared/signals/computed.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'

import {signal, computed, effect, batch} from './signal'

describe('computed', () => {
	it('should derive value from signal', () => {
		const name = signal<string | undefined>('hello')
		const upper = computed(() => name()!.toUpperCase())
		expect(upper()).toBe('HELLO')
	})

	it('should have .get() method', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		expect(doubled()).toBe(2)
	})

	it('Signal should not have a .use() method', () => {
		const s = signal(1)
		// @ts-expect-error -- .use() must not exist on Signal after this refactor
		expect(typeof s.use).toBe('undefined')
	})

	it('should re-derive when dependency changes', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		expect(doubled()).toBe(2)
		count(5)
		expect(doubled()).toBe(10)
	})

	it('should be lazy — not computed until read', () => {
		const count = signal(1)
		let calls = 0
		const doubled = computed(() => {
			calls++
			return count() * 2
		})
		expect(calls).toBe(0)
		doubled()
		expect(calls).toBe(1)
	})

	it('should cache until dependencies change', () => {
		const count = signal(1)
		let calls = 0
		const doubled = computed(() => {
			calls++
			return count() * 2
		})
		doubled()
		doubled()
		expect(calls).toBe(1)
		count(2)
		doubled()
		doubled()
		expect(calls).toBe(2)
	})

	it('should auto-track inside effect', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		const results: number[] = []
		effect(() => {
			results.push(doubled())
		})
		expect(results).toEqual([2])
		count(3)
		expect(results).toEqual([2, 6])
	})

	it('should support chained computed', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		const quadrupled = computed(() => doubled() * 2)
		expect(quadrupled()).toBe(4)
		count(5)
		expect(quadrupled()).toBe(20)
	})

	it('should receive previous value in getter', () => {
		const count = signal(1)
		const withPrev = computed((prev?: number) => {
			void prev
			return count() + 1
		})
		expect(withPrev()).toBe(2)
	})

	it('should work inside batch', () => {
		const a = signal(1)
		const b = signal(2)
		const sum = computed(() => a() + b())
		const results: number[] = []
		effect(() => {
			results.push(sum())
		})
		expect(results).toEqual([3])
		batch(() => {
			a(10)
			b(20)
		})
		expect(results).toEqual([3, 30])
	})
})
```

- [ ] **Step 8: Run core tests — all must pass**

```bash
pnpm --filter @markput/core test --run
```

Expected: all tests pass, including the new `'Signal should not have a .use() method'` test.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/shared/signals/signal.ts \
        packages/core/src/shared/signals/index.ts \
        packages/core/src/shared/signals/computed.spec.ts \
        packages/core/index.ts
git rm packages/core/src/shared/signals/registry.ts
git commit -m "feat(core): remove .use() from signals — framework hooks no longer in core"
```

---

## Task 2: Add `useMarkput` to React

**Files:**
- Create: `packages/react/markput/src/lib/hooks/useMarkput.ts`
- Delete: `packages/react/markput/src/lib/hooks/createUseHook.ts`
- Modify: `packages/react/markput/src/lib/providers/StoreContext.ts`
- Modify: `packages/react/markput/src/components/MarkedInput.tsx`
- Modify: `packages/react/markput/index.ts`

- [ ] **Step 1: Create `useMarkput.ts`**

Write `packages/react/markput/src/lib/hooks/useMarkput.ts`:

```ts
import {useSyncExternalStore, useRef} from 'react'
import {computed, watch} from '@markput/core'
import type {Signal, Computed, SignalValues, Store} from '@markput/core'

import {useStore} from '../providers/StoreContext'

type Selectable<T> = Signal<T> | Computed<T>
type ObjectSelector = Record<string, Selectable<unknown>>

export function useMarkput<T>(selector: (store: Store) => Selectable<T>): T
export function useMarkput<R extends ObjectSelector>(selector: (store: Store) => R): SignalValues<R>
export function useMarkput(selector: (store: Store) => Selectable<unknown> | ObjectSelector): unknown {
	const store = useStore()

	// Holds stable computed + subscribe + snapshot — created once, never recreated.
	// useRef() with no argument returns MutableRefObject<T | undefined>, allowing writes to .current.
	const stableRef = useRef<{
		derived: Computed<unknown>
		subscribe: (cb: () => void) => () => void
		getSnapshot: () => unknown
	}>()

	if (!stableRef.current) {
		const target = selector(store)

		const derived = computed((): unknown => {
			if (typeof target === 'function') {
				// Single Signal<T> or Computed<T>
				return (target as Selectable<unknown>)()
			}
			// Object of signals — unwrap each entry
			const out: Record<string, unknown> = {}
			for (const key in target) {
				out[key] = target[key]()
			}
			return out
		})

		stableRef.current = {
			derived,
			subscribe: (cb) => watch(derived, cb),
			getSnapshot: () => derived(),
		}
	}

	const {subscribe, getSnapshot} = stableRef.current
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
```

- [ ] **Step 2: Delete `createUseHook.ts`**

```bash
git rm packages/react/markput/src/lib/hooks/createUseHook.ts
```

- [ ] **Step 3: Remove module augmentation from `StoreContext.ts`**

Write `packages/react/markput/src/lib/providers/StoreContext.ts`:

```ts
import type {Store} from '@markput/core'
import {createContext, useContext} from 'react'

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

- [ ] **Step 4: Remove side-effect import from `MarkedInput.tsx`**

In `packages/react/markput/src/components/MarkedInput.tsx`, remove lines 6–7:

```ts
// oxlint-disable-next-line no-unassigned-import -- side-effect import: registers the React useHook factory via setUseHookFactory
import '../lib/hooks/createUseHook'
```

The file after removal starts its imports with:

```ts
import type {CoreOption, MarkputHandler, OverlayTrigger} from '@markput/core'
import {Store} from '@markput/core'
import type {ComponentType, CSSProperties, Ref} from 'react'
import {useImperativeHandle, useLayoutEffect, useState} from 'react'

import {StoreContext} from '../lib/providers/StoreContext'
```

- [ ] **Step 5: Export `useMarkput` from the package root**

Write `packages/react/markput/index.ts`:

```ts
export {MarkedInput} from './src/components/MarkedInput'
export {useMark} from './src/lib/hooks/useMark'
export {useOverlay} from './src/lib/hooks/useOverlay'
export {useMarkput} from './src/lib/hooks/useMarkput'

export type {MarkedInputProps} from './src/components/MarkedInput'
export type {OverlayHandler} from './src/lib/hooks/useOverlay'
export type {Option, MarkProps, OverlayProps} from './src/types'

// Re-export from core
export {denote, annotate, MarkHandler, MarkputHandler} from '@markput/core'
export type {Markup, Token, TextToken, MarkToken} from '@markput/core'
```

- [ ] **Step 6: Run React type-check and tests**

```bash
pnpm --filter @markput/react build
```

Expected: build succeeds (TypeScript compilation passes). There will be errors in components still using `.use()` — that is expected and will be fixed in Task 3.

- [ ] **Step 7: Commit**

```bash
git add packages/react/markput/src/lib/hooks/useMarkput.ts \
        packages/react/markput/src/lib/providers/StoreContext.ts \
        packages/react/markput/src/components/MarkedInput.tsx \
        packages/react/markput/index.ts
git rm packages/react/markput/src/lib/hooks/createUseHook.ts
git commit -m "feat(react): add useMarkput hook, remove createUseHook factory"
```

---

## Task 3: Migrate React components

**Files:**
- Modify: `packages/react/markput/src/components/Container.tsx`
- Modify: `packages/react/markput/src/components/Block.tsx`
- Modify: `packages/react/markput/src/components/Token.tsx`
- Modify: `packages/react/markput/src/lib/hooks/useMark.tsx`
- Modify: `packages/react/markput/src/lib/hooks/useOverlay.tsx`

- [ ] **Step 1: Migrate `Container.tsx`**

Write `packages/react/markput/src/components/Container.tsx`:

```tsx
import {memo, useLayoutEffect} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const store = useStore()

	const {drag, tokens, className, style, readOnly, container} = useMarkput(s => ({
		drag:      s.props.drag,
		tokens:    s.state.tokens,
		className: s.computed.containerClass,
		style:     s.computed.containerStyle,
		readOnly:  s.props.readOnly,
		container: s.computed.container,
	}))

	useLayoutEffect(() => {
		store.event.afterTokensRendered()
	}, [tokens])

	const key = store.key
	const refs = store.refs

	const [ContainerComponent, containerProps] = container

	const containerStyle = drag && !readOnly ? (style ? {paddingLeft: 24, ...style} : {paddingLeft: 24}) : style

	return (
		<ContainerComponent
			ref={(el: HTMLDivElement | null) => (refs.container = el)}
			{...containerProps}
			className={className}
			style={containerStyle}
		>
			{drag
				? tokens.map((t, i) => <Block key={key.get(t)} token={t} blockIndex={i} />)
				: tokens.map(t => <Token key={key.get(t)} mark={t} />)}
		</ContainerComponent>
	)
})

Container.displayName = 'Container'
```

- [ ] **Step 2: Migrate `Block.tsx`**

Write `packages/react/markput/src/components/Block.tsx`:

```tsx
import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'
import {BlockMenu} from './BlockMenu'
import {DragHandle} from './DragHandle'
import {DropIndicator} from './DropIndicator'
import {Token} from './Token'

import styles from '@markput/core/styles.module.css'

interface BlockProps {
	token: TokenType
	blockIndex: number
}

export const Block = memo(({token, blockIndex}: BlockProps) => {
	const store = useStore()
	const blockStore = store.blocks.get(token)

	const container = useMarkput(s => s.computed.block)
	const isDragging = useMarkput(() => blockStore.state.isDragging)

	const [ContainerComponent, containerProps] = container

	return (
		<ContainerComponent
			ref={(el: HTMLElement | null) => blockStore.attachContainer(el, blockIndex, store.event)}
			data-testid="block"
			{...containerProps}
			className={styles.Block}
			style={{opacity: isDragging ? 0.4 : 1}}
		>
			<DropIndicator token={token} position="before" />

			<DragHandle token={token} blockIndex={blockIndex} />

			<Token mark={token} />

			<DropIndicator token={token} position="after" />

			<BlockMenu token={token} />
		</ContainerComponent>
	)
})

Block.displayName = 'Block'
```

Note: `useMarkput(() => blockStore.state.isDragging)` uses a selector that ignores the `store` argument and returns a signal from `blockStore` directly. This is valid — the selector receives the store but can return any `Signal<T>`.

- [ ] **Step 3: Migrate `Token.tsx`**

Write `packages/react/markput/src/components/Token.tsx`:

```tsx
import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'
import {TokenContext} from '../lib/providers/TokenContext'

export const Token = memo(({mark}: {mark: TokenType}) => {
	const store = useStore()
	const resolveMarkSlot = useMarkput(s => s.computed.mark)
	const [Component, props] = resolveMarkSlot(mark)

	const children =
		mark.type === 'mark' && mark.children.length > 0
			? mark.children.map(child => <Token key={store.key.get(child)} mark={child} />)
			: undefined

	return (
		<TokenContext value={mark}>
			<Component children={children} {...props} />
		</TokenContext>
	)
})

Token.displayName = 'Token'
```

- [ ] **Step 4: Migrate `useMark.tsx`**

Write `packages/react/markput/src/lib/hooks/useMark.tsx`:

```tsx
import type {MarkOptions, MarkToken} from '@markput/core'
import {MarkHandler} from '@markput/core'
import {useEffect, useMemo, useRef} from 'react'

import {useMarkput} from './useMarkput'
import {useStore} from '../providers/StoreContext'
import {useToken} from '../providers/TokenContext'

export const useMark = <T extends HTMLElement = HTMLElement>(options: MarkOptions = {}): MarkHandler<T> => {
	const store = useStore()
	const token = useToken()
	if (token.type !== 'mark') throw new Error('useMark must be called within a mark token context')
	const ref = useRef<T>(null)

	const mark = useMemo(() => new MarkHandler<T>({ref, store, token}), [store, token])

	useUncontrolledInit(ref, options, token)

	const readOnly = useMarkput(s => s.props.readOnly)
	useEffect(() => {
		mark.readOnly = readOnly
	}, [mark, readOnly])

	return mark
}

function useUncontrolledInit(ref: {readonly current: HTMLElement | null}, options: MarkOptions, token: MarkToken) {
	useEffect(() => {
		if (!options.controlled && ref.current) ref.current.textContent = token.content
	}, [])
}
```

- [ ] **Step 5: Migrate `useOverlay.tsx`**

Write `packages/react/markput/src/lib/hooks/useOverlay.tsx`:

```tsx
import type {OverlayMatch} from '@markput/core'
import {Caret, createMarkFromOverlay} from '@markput/core'
import type {RefObject} from 'react'
import {useCallback, useMemo} from 'react'

import type {Option} from '../../types'
import {useMarkput} from './useMarkput'
import {useStore} from '../providers/StoreContext'

export interface OverlayHandler {
	style: {
		left: number
		top: number
	}
	close: () => void
	select: (value: {value: string; meta?: string}) => void
	match: OverlayMatch<Option>
	ref: RefObject<HTMLElement | null>
}

export function useOverlay(): OverlayHandler {
	const store = useStore()
	const match = useMarkput(s => s.state.overlayMatch)
	if (!match) throw new Error('useOverlay requires an active overlay match')
	const style = useMemo(() => Caret.getAbsolutePosition(), [match])

	const close = useCallback(() => store.event.clearOverlay(), [])
	const select = useCallback(
		(value: {value: string; meta?: string}) => {
			const mark = createMarkFromOverlay(match, value.value, value.meta)
			store.event.select({mark, match})
			store.event.clearOverlay()
		},
		[match]
	)

	const ref = useMemo(
		(): RefObject<HTMLElement | null> => ({
			get current() {
				return store.refs.overlay
			},
			set current(v: HTMLElement | null) {
				store.refs.overlay = v
			},
		}),
		[]
	)

	return {match, style, select, close, ref}
}
```

- [ ] **Step 6: Run React build and tests**

```bash
pnpm --filter @markput/react build
pnpm --filter @markput/react test --run
```

Expected: build succeeds, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/react/markput/src/components/Container.tsx \
        packages/react/markput/src/components/Block.tsx \
        packages/react/markput/src/components/Token.tsx \
        packages/react/markput/src/lib/hooks/useMark.tsx \
        packages/react/markput/src/lib/hooks/useOverlay.tsx
git commit -m "feat(react): migrate components to useMarkput"
```

---

## Task 4: Add `useMarkput` to Vue

**Files:**
- Create: `packages/vue/markput/src/lib/hooks/useMarkput.ts`
- Delete: `packages/vue/markput/src/lib/hooks/createUseHook.ts`
- Modify: `packages/vue/markput/src/lib/hooks/useStore.ts`
- Modify: `packages/vue/markput/src/components/MarkedInput.vue`
- Modify: `packages/vue/markput/index.ts`

Note: Vue's `computed()` does **not** track alien-signals dependencies — Vue and alien-signals are separate reactivity systems. The correct bridge is alien-signals `effect` + Vue `shallowRef`, matching the pattern used in the old `createUseHook.ts`.

- [ ] **Step 1: Create Vue `useMarkput.ts`**

Write `packages/vue/markput/src/lib/hooks/useMarkput.ts`:

```ts
import {effect as alienEffect} from '@markput/core'
import type {Signal, Computed, SignalValues, Store} from '@markput/core'
import {shallowRef, onUnmounted, type Ref} from 'vue'

import {useStore} from './useStore'

type Selectable<T> = Signal<T> | Computed<T>
type ObjectSelector = Record<string, Selectable<unknown>>

export function useMarkput<T>(selector: (store: Store) => Selectable<T>): Ref<T>
export function useMarkput<R extends ObjectSelector>(selector: (store: Store) => R): Ref<SignalValues<R>>
export function useMarkput(selector: (store: Store) => Selectable<unknown> | ObjectSelector): Ref<unknown> {
	const store = useStore()

	// Run selector once to capture the signal reference(s).
	// The selector is NOT re-run reactively — it is a stable signal picker.
	const target = selector(store)

	const getValue = (): unknown => {
		if (typeof target === 'function') {
			return (target as Selectable<unknown>)()
		}
		const out: Record<string, unknown> = {}
		for (const key in target) {
			out[key] = target[key]()
		}
		return out
	}

	// shallowRef + alien-signals effect bridges the two reactive systems.
	// The effect re-runs whenever tracked signals change, updating the ref.
	const r = shallowRef(getValue())
	const stop = alienEffect(() => {
		r.value = getValue()
	})
	onUnmounted(stop)

	return r
}
```

- [ ] **Step 2: Delete Vue's `createUseHook.ts`**

```bash
git rm packages/vue/markput/src/lib/hooks/createUseHook.ts
```

- [ ] **Step 3: Remove module augmentation from `useStore.ts`**

Write `packages/vue/markput/src/lib/hooks/useStore.ts`:

```ts
import type {Store} from '@markput/core'
import {inject} from 'vue'

import {STORE_KEY} from '../providers/storeKey'

export function useStore(): Store {
	const store = inject(STORE_KEY)
	if (!store) {
		throw new Error('Store not found. Make sure to use this composable inside a MarkedInput component.')
	}
	return store
}
```

- [ ] **Step 4: Remove side-effect import from `MarkedInput.vue`**

In `packages/vue/markput/src/components/MarkedInput.vue`, remove lines 5–6:

```ts
// oxlint-disable-next-line no-unassigned-import -- side-effect import: registers the Vue useHook factory via setUseHookFactory
import '../lib/hooks/createUseHook'
```

The `<script setup>` imports after removal begin with:

```ts
import {Store} from '@markput/core'
import {onMounted, onUnmounted, onUpdated, provide, shallowRef, watch} from 'vue'

import {STORE_KEY} from '../lib/providers/storeKey'
```

- [ ] **Step 5: Export `useMarkput` from the package root**

Write `packages/vue/markput/index.ts`:

```ts
export {default as MarkedInput} from './src/components/MarkedInput.vue'
export {useMark} from './src/lib/hooks/useMark'
export {useOverlay} from './src/lib/hooks/useOverlay'
export {useMarkput} from './src/lib/hooks/useMarkput'

export type {OverlayHandler} from './src/lib/hooks/useOverlay'
export type {MarkedInputProps, Option, MarkProps, OverlayProps} from './src/types'

// Re-export from core
export {denote, annotate, MarkHandler, MarkputHandler} from '@markput/core'
export type {Markup, Token, TextToken, MarkToken} from '@markput/core'
```

- [ ] **Step 6: Commit**

```bash
git add packages/vue/markput/src/lib/hooks/useMarkput.ts \
        packages/vue/markput/src/lib/hooks/useStore.ts \
        packages/vue/markput/src/components/MarkedInput.vue \
        packages/vue/markput/index.ts
git rm packages/vue/markput/src/lib/hooks/createUseHook.ts
git commit -m "feat(vue): add useMarkput hook, remove createUseHook factory"
```

---

## Task 5: Migrate Vue components

**Files:**
- Modify: `packages/vue/markput/src/components/Container.vue`
- Modify: `packages/vue/markput/src/components/Block.vue`
- Modify: `packages/vue/markput/src/components/Token.vue`
- Modify: `packages/vue/markput/src/lib/hooks/useMark.ts`
- Modify: `packages/vue/markput/src/lib/hooks/useOverlay.ts`

- [ ] **Step 1: Migrate `Container.vue`**

Write `packages/vue/markput/src/components/Container.vue`:

```vue
<script setup lang="ts">
import type {CSSProperties} from '@markput/core'
import {computed, watch} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import Block from './Block.vue'
import Token from './Token.vue'

const store = useStore()

const drag          = useMarkput(s => s.props.drag)
const readOnly      = useMarkput(s => s.props.readOnly)
const tokens        = useMarkput(s => s.state.tokens)
const className     = useMarkput(s => s.computed.containerClass)
const style         = useMarkput(s => s.computed.containerStyle)
const containerSlot = useMarkput(s => s.computed.container)

watch(tokens, () => store.event.afterTokensRendered(), {flush: 'post', immediate: true})

const key = store.key

const containerStyle = computed(() => {
	const s = style.value as CSSProperties | undefined
	if (drag.value && !readOnly.value) {
		return s ? {paddingLeft: 24, ...s} : {paddingLeft: 24}
	}
	return s
})
</script>

<template>
	<component
		:is="containerSlot[0]"
		:ref="
			(el: any) => {
				store.refs.container = el?.$el ?? el
			}
		"
		v-bind="containerSlot[1]"
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

- [ ] **Step 2: Migrate `Block.vue`**

Write `packages/vue/markput/src/components/Block.vue`:

```vue
<script setup lang="ts">
import type {Token as TokenType} from '@markput/core'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import BlockMenu from './BlockMenu.vue'
import DragHandle from './DragHandle.vue'
import DropIndicator from './DropIndicator.vue'
import Token from './Token.vue'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{token: TokenType; blockIndex: number}>()

const store = useStore()
const blockStore = store.blocks.get(props.token)

const isDragging = useMarkput(() => blockStore.state.isDragging)
</script>

<template>
	<div
		:ref="el => blockStore.attachContainer(el as HTMLElement | null, props.blockIndex, store.event)"
		v-bind="{'data-testid': 'block'}"
		:class="styles.Block"
		:style="{opacity: isDragging ? 0.4 : 1}"
	>
		<DropIndicator :token="token" position="before" />
		<DragHandle :token="token" :block-index="blockIndex" />
		<Token :mark="token" />
		<DropIndicator :token="token" position="after" />
		<BlockMenu :token="token" />
	</div>
</template>
```

- [ ] **Step 3: Migrate `Token.vue`**

Write `packages/vue/markput/src/components/Token.vue`:

```vue
<script lang="ts">
import type {Token as TokenType} from '@markput/core'
import {defineComponent, h, markRaw, provide, toRef, type Component, type PropType, type VNode} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'

const Token = defineComponent({
	name: 'Token',
	props: {
		mark: {type: Object as PropType<TokenType>, required: true},
	},
	setup(props): () => VNode {
		provide(
			TOKEN_KEY,
			toRef(() => props.mark)
		)

		const store = useStore()
		const key = store.key
		const resolveMarkSlot = useMarkput(s => s.computed.mark)

		return () => {
			const [Comp, compProps] = resolveMarkSlot.value(props.mark)

			const mark = props.mark
			const children =
				mark.type === 'mark' && mark.children.length > 0
					? () => mark.children.map(child => h(markRaw(Token), {key: key.get(child), mark: child}))
					: undefined

			return h(Comp as Component, compProps, children)
		}
	},
})

export default Token
</script>
```

- [ ] **Step 4: Migrate `useMark.ts`**

Write `packages/vue/markput/src/lib/hooks/useMark.ts`:

```ts
import type {MarkOptions, RefAccessor} from '@markput/core'
import {MarkHandler} from '@markput/core'
import {inject, ref, watch, onMounted} from 'vue'

import {TOKEN_KEY} from '../providers/tokenKey'
import {useMarkput} from './useMarkput'
import {useStore} from './useStore'

export const useMark = <T extends HTMLElement = HTMLElement>(options: MarkOptions = {}): MarkHandler<T> => {
	const store = useStore()
	const tokenRef = inject(TOKEN_KEY)

	if (!tokenRef) {
		throw new Error('Token not found. Make sure to use useMark inside a Token provider.')
	}

	const token = tokenRef.value
	if (token.type !== 'mark') throw new Error('useMark must be called within a mark token context')

	const elRef = ref<T | null>(null)
	const refAccessor: RefAccessor<T> = {
		get current() {
			// oxlint-disable-next-line no-unsafe-return
			return elRef.value
		},
		set current(v: T | null) {
			elRef.value = v
		},
	}

	const mark = new MarkHandler<T>({ref: refAccessor, store, token})

	onMounted(() => {
		const el = elRef.value
		if (el instanceof HTMLElement && !options.controlled) {
			el.textContent = token.content
		}
	})

	const readOnly = useMarkput(s => s.props.readOnly)
	watch(readOnly, val => {
		mark.readOnly = val
	})

	return mark
}
```

- [ ] **Step 5: Migrate `useOverlay.ts`**

Write `packages/vue/markput/src/lib/hooks/useOverlay.ts`:

```ts
import type {OverlayMatch} from '@markput/core'
import {Caret, createMarkFromOverlay} from '@markput/core'
import {computed, type Ref, type ComputedRef} from 'vue'

import type {Option} from '../../types'
import {useMarkput} from './useMarkput'
import {useStore} from './useStore'

export interface OverlayHandler {
	style: ComputedRef<{
		left: string
		top: string
	}>
	close: () => void
	select: (value: {value: string; meta?: string}) => void
	match: Ref<OverlayMatch<Option> | undefined>
	ref: {
		get current(): HTMLElement | null
		set current(v: HTMLElement | null)
	}
}

export function useOverlay(): OverlayHandler {
	const store = useStore()
	const matchRef = useMarkput(s => s.state.overlayMatch) as Ref<OverlayMatch<Option> | undefined>

	const style = computed(() => {
		// Depend on matchRef so position recalculates as user types/moves caret
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _ = matchRef.value
		const pos = Caret.getAbsolutePosition()
		return {
			left: `${pos.left}px`,
			top: `${pos.top}px`,
		}
	})

	const close = () => store.event.clearOverlay()
	const select = (value: {value: string; meta?: string}) => {
		const match = matchRef.value
		if (!match) return
		const mark = createMarkFromOverlay(match, value.value, value.meta)
		store.event.select({mark, match})
		store.event.clearOverlay()
	}

	const ref = {
		get current() {
			return store.refs.overlay
		},
		set current(v: HTMLElement | null) {
			store.refs.overlay = v
		},
	}

	return {match: matchRef, style, select, close, ref}
}
```

- [ ] **Step 6: Run Vue build and tests**

```bash
pnpm --filter @markput/vue build
pnpm --filter @markput/vue test --run
```

Expected: build succeeds, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/vue/markput/src/components/Container.vue \
        packages/vue/markput/src/components/Block.vue \
        packages/vue/markput/src/components/Token.vue \
        packages/vue/markput/src/lib/hooks/useMark.ts \
        packages/vue/markput/src/lib/hooks/useOverlay.ts
git commit -m "feat(vue): migrate components to useMarkput"
```

---

## Final Verification

- [ ] **Run all package tests**

```bash
pnpm --filter @markput/core test --run
pnpm --filter @markput/react test --run
pnpm --filter @markput/vue test --run
```

Expected: all tests pass across all three packages.
