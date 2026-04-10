# ParseFeature Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract parser orchestration logic from Lifecycle into a dedicated ParseFeature class.

**Architecture:** Create `ParseFeature` in the `features/parsing/` directory. It takes over `sync()`, `hasChanged()`, and the `store.event.parse` subscription from Lifecycle. Lifecycle becomes a thin orchestrator that delegates parse work to `store.features.parse`.

**Tech Stack:** TypeScript, Vitest, reactive signals (effectScope/watch)

---

### Task 1: Create ParseFeature.spec.ts

**Files:**
- Create: `packages/core/src/features/parsing/ParseFeature.spec.ts`

- [ ] **Step 1: Write tests for ParseFeature**

```typescript
import {describe, it, expect, beforeEach, vi} from 'vitest'

import {setUseHookFactory} from '../../shared/signals'
import {Store} from '../store/Store'

describe('ParseFeature', () => {
	let store: Store

	beforeEach(() => {
		setUseHookFactory(() => () => undefined)
		store = new Store()
		const features = store.features as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(features)) {
			if (key === 'parse') continue
			vi.spyOn(features[key], 'enable').mockImplementation(() => {})
			vi.spyOn(features[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('sync()', () => {
		it('sets tokens from value signal', () => {
			store.features.parse.enable()
			store.state.value.set('hello')
			store.features.parse.sync()

			expect(store.state.tokens.get()).toEqual([
				{type: 'text', content: 'hello', position: {start: 0, end: 5}},
			])

			store.features.parse.disable()
		})

		it('falls back to defaultValue when value is undefined', () => {
			store.features.parse.enable()
			store.state.defaultValue.set('default')
			store.features.parse.sync()

			expect(store.state.tokens.get()).toEqual([
				{type: 'text', content: 'default', position: {start: 0, end: 7}},
			])

			store.features.parse.disable()
		})

		it('falls back to empty string when both are undefined', () => {
			store.features.parse.enable()
			store.features.parse.sync()

			expect(store.state.tokens.get()).toEqual([
				{type: 'text', content: '', position: {start: 0, end: 0}},
			])

			store.features.parse.disable()
		})

		it('sets previousValue to the parsed input', () => {
			store.features.parse.enable()
			store.state.value.set('test')
			store.features.parse.sync()

			expect(store.state.previousValue.get()).toBe('test')

			store.features.parse.disable()
		})

		it('skips markup when no Mark override and no per-option Mark', () => {
			store.features.parse.enable()
			store.state.options.set([{markup: '@[__value__]'}])
			store.state.value.set('@hello')
			store.features.parse.sync()

			expect(store.computed.parser.get()).toBeUndefined()
			expect(store.state.tokens.get()).toEqual([
				{type: 'text', content: '@hello', position: {start: 0, end: 6}},
			])

			store.features.parse.disable()
		})

		it('uses markup when Mark override is set', () => {
			store.features.parse.enable()
			store.state.Mark.set(() => null)
			store.state.options.set([{markup: '@[__value__]'}])
			store.state.value.set('@hello')
			store.features.parse.sync()

			expect(store.computed.parser.get()).toBeDefined()

			store.features.parse.disable()
		})
	})

	describe('hasChanged()', () => {
		it('returns true before sync() is called', () => {
			expect(store.features.parse.hasChanged()).toBe(true)
		})

		it('returns false after sync() with no value/parser change', () => {
			store.features.parse.enable()
			store.state.value.set('hello')
			store.features.parse.sync()

			expect(store.features.parse.hasChanged()).toBe(false)

			store.features.parse.disable()
		})

		it('returns true when value changes after sync()', () => {
			store.features.parse.enable()
			store.state.value.set('hello')
			store.features.parse.sync()

			store.state.value.set('world')

			expect(store.features.parse.hasChanged()).toBe(true)

			store.features.parse.disable()
		})

		it('returns true when parser changes after sync()', () => {
			store.features.parse.enable()
			store.state.Mark.set(() => null)
			store.state.options.set([{markup: '@[__value__]'}])
			store.state.value.set('hello')
			store.features.parse.sync()

			store.state.options.set([{markup: '#[__value__]'}])

			expect(store.features.parse.hasChanged()).toBe(true)

			store.features.parse.disable()
		})

		it('updates internal cache as side effect', () => {
			store.features.parse.enable()
			store.state.value.set('hello')
			store.features.parse.sync()

			store.state.value.set('world')
			store.features.parse.hasChanged() // updates cache to 'world'

			// Calling again with same value should return false
			expect(store.features.parse.hasChanged()).toBe(false)

			store.features.parse.disable()
		})
	})

	describe('enable() / disable()', () => {
		it('is idempotent — calling enable twice does not double-subscribe', () => {
			store.features.parse.enable()
			store.features.parse.enable()
			store.state.value.set('hello')
			store.features.parse.sync()

			const setSpy = vi.spyOn(store.state.tokens, 'set')
			store.event.parse()

			expect(setSpy).toHaveBeenCalledTimes(1)

			setSpy.mockRestore()
			store.features.parse.disable()
		})

		it('stops parse subscription after disable', () => {
			store.features.parse.enable()
			store.state.value.set('hello')
			store.features.parse.sync()

			store.features.parse.disable()

			const tokensBefore = store.state.tokens.get()
			store.event.parse()
			expect(store.state.tokens.get()).toBe(tokensBefore)
		})

		it('resets initialized state — re-enable and sync works fresh', () => {
			store.features.parse.enable()
			store.state.value.set('first')
			store.features.parse.sync()
			store.features.parse.disable()

			store.features.parse.enable()
			store.state.value.set('second')
			store.features.parse.sync()

			expect(store.state.tokens.get()).toEqual([
				{type: 'text', content: 'second', position: {start: 0, end: 6}},
			])

			store.features.parse.disable()
		})
	})

	describe('parse handler', () => {
		it('in recovery mode — re-parses from token text', () => {
			store.features.parse.enable()
			store.state.value.set('test')
			store.features.parse.sync()

			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})
			store.event.parse()

			expect(store.state.tokens.get()).toEqual([
				{type: 'text', content: 'test', position: {start: 0, end: 4}},
			])
			expect(store.state.previousValue.get()).toBe('test')

			store.features.parse.disable()
		})

		it('does not re-run parse subscription when recovery changes after parse event', () => {
			store.features.parse.enable()
			store.state.value.set('hello')
			store.features.parse.sync()
			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})

			const setSpy = vi.spyOn(store.state.tokens, 'set')
			store.event.parse()
			expect(setSpy).toHaveBeenCalledTimes(1)

			setSpy.mockClear()
			store.state.recovery.set({caret: 1, anchor: store.nodes.focus})
			expect(setSpy).not.toHaveBeenCalled()

			setSpy.mockRestore()
			store.features.parse.disable()
		})
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/parsing/ParseFeature.spec.ts`
Expected: FAIL — `ParseFeature` does not exist yet.

---

### Task 2: Create ParseFeature.ts

**Files:**
- Create: `packages/core/src/features/parsing/ParseFeature.ts`

- [ ] **Step 1: Write the ParseFeature implementation**

```typescript
import {effectScope, watch} from '../../shared/signals/index.js'
import {toString} from './parser/utils/toString'
import {getTokensByUI, getTokensByValue, parseWithParser} from './utils/valueParser'
import type {Parser} from './parser/Parser'
import type {Store} from '../store/Store'

export class ParseFeature {
	#scope?: () => void
	#initialized = false
	#lastValue: string | undefined
	#lastParser: Parser | undefined

	constructor(private store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			this.#subscribeParse()
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
		this.#initialized = false
	}

	sync() {
		const {store} = this
		const inputValue = store.state.value.get() ?? store.state.defaultValue.get() ?? ''
		store.state.tokens.set(parseWithParser(store, inputValue))
		store.state.previousValue.set(inputValue)
		this.#lastValue = store.state.value.get()
		this.#lastParser = store.computed.parser.get()
		this.#initialized = true
	}

	hasChanged(): boolean {
		const value = this.store.state.value.get()
		const parser = this.store.computed.parser.get()
		if (this.#initialized && value === this.#lastValue && parser === this.#lastParser) return false
		this.#lastValue = value
		this.#lastParser = parser
		return true
	}

	#subscribeParse() {
		const {store} = this

		watch(store.event.parse, () => {
			if (store.state.recovery.get()) {
				const text = toString(store.state.tokens.get())
				store.state.tokens.set(parseWithParser(store, text))
				store.state.previousValue.set(text)
				return
			}
			store.state.tokens.set(store.nodes.focus.target ? getTokensByUI(store) : getTokensByValue(store))
		})
	}
}
```

- [ ] **Step 2: Run the ParseFeature tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/parsing/ParseFeature.spec.ts`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/parsing/ParseFeature.ts packages/core/src/features/parsing/ParseFeature.spec.ts
git commit -m "feat(core): add ParseFeature with extracted parse orchestration logic"
```

---

### Task 3: Wire ParseFeature into Store and exports

**Files:**
- Modify: `packages/core/src/features/store/Store.ts` (line 29 — add import, line 151 — add to features)
- Modify: `packages/core/src/features/parsing/index.ts` (add export)

- [ ] **Step 1: Add ParseFeature to Store.features**

In `Store.ts`, add the import (after the `Parser` import on line 29):

```typescript
import {ParseFeature} from '../parsing/ParseFeature'
```

Add `parse` to the `features` object (after `copy` on line 151):

```typescript
		copy: new CopyFeature(this),
		parse: new ParseFeature(this),
```

- [ ] **Step 2: Export ParseFeature from parsing barrel**

In `packages/core/src/features/parsing/index.ts`, add at the end:

```typescript
export {ParseFeature} from './ParseFeature'
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS (ParseFeature is now wired but not yet used by Lifecycle).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/store/Store.ts packages/core/src/features/parsing/index.ts
git commit -m "feat(core): wire ParseFeature into Store and exports"
```

---

### Task 4: Update Lifecycle to delegate to ParseFeature

**Files:**
- Modify: `packages/core/src/features/lifecycle/Lifecycle.ts`

- [ ] **Step 1: Rewrite Lifecycle.ts**

Replace the entire file with:

```typescript
import {watch} from '../../shared/signals/index.js'
import type {Store} from '../store'

export class Lifecycle {
	#enabled = false
	#featuresEnabled = false

	constructor(private store: Store) {
		watch(store.event.updated, () => this.#onUpdated())
		watch(store.event.afterTokensRendered, () => this.recoverFocus())
		watch(store.event.unmounted, () => this.disable())
	}

	#onUpdated() {
		if (!this.#enabled) {
			this.enable()
			this.store.features.parse.sync()
			return
		}
		if (!this.store.features.parse.hasChanged()) return
		if (!this.store.state.recovery.get()) {
			this.store.event.parse()
		}
	}

	#enableFeatures() {
		if (this.#featuresEnabled) return
		this.#featuresEnabled = true
		const {features} = this.store
		for (const f of Object.values(features)) f.enable()
	}

	#disableFeatures() {
		if (!this.#featuresEnabled) return
		this.#featuresEnabled = false
		const {features} = this.store
		for (const f of Object.values(features)) f.disable()
	}

	enable() {
		if (this.#enabled) return
		const {store} = this
		store.state.overlayTrigger.set(option => option.overlay?.trigger)
		this.#enableFeatures()
		this.#enabled = true
	}

	disable() {
		this.#enabled = false
		this.#disableFeatures()
		this.store.state.overlayTrigger.set(undefined)
	}

	recoverFocus() {
		this.store.event.sync()
		if (!this.store.state.Mark.get()) return
		this.store.event.recoverFocus()
	}
}
```

Key changes:
- Removed: `syncParser()`, `#subscribeParse()`, `#lastValue`, `#lastParser`, `#initialized`, `#scope`, `effectScope` import, all parsing imports
- `#scope` replaced with `#enabled` (simple boolean — no reactive scope needed)
- `syncParser()` → delegates to `store.features.parse.sync()`
- Value/parser change detection → delegates to `store.features.parse.hasChanged()`
- Parse subscription is now in ParseFeature

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/lifecycle/Lifecycle.ts
git commit -m "refactor(core): delegate parse orchestration from Lifecycle to ParseFeature"
```

---

### Task 5: Update Lifecycle.spec.ts

**Files:**
- Modify: `packages/core/src/features/lifecycle/Lifecycle.spec.ts`

- [ ] **Step 1: Update the test file**

The key changes:
1. Don't mock `parse` feature (it's now part of the lifecycle flow)
2. Replace `lifecycle.syncParser()` with `store.features.parse.sync()`

Replace the `beforeEach` block:

```typescript
	beforeEach(() => {
		setUseHookFactory(() => () => undefined)
		store = new Store()
		const features = store.features as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(features)) {
			if (key === 'parse') continue
			vi.spyOn(features[key], 'enable').mockImplementation(() => {})
			vi.spyOn(features[key], 'disable').mockImplementation(() => {})
		}
	})
```

Replace all `lifecycle.syncParser()` calls with `store.features.parse.sync()`:

In `enable()` > "is idempotent" test — change:
```typescript
			lifecycle.syncParser()
```
to:
```typescript
			store.features.parse.sync()
```

In `disable()` > "stops parse subscription" test — change:
```typescript
			lifecycle.syncParser()
```
to:
```typescript
			store.features.parse.sync()
```

In `disable()` > "resets initialized state" test — change both occurrences:
```typescript
			lifecycle.syncParser()
```
to:
```typescript
			store.features.parse.sync()
```

In `syncParser()` describe block — rename the describe to `sync via ParseFeature` and change all `lifecycle.syncParser()` to `store.features.parse.sync()`:
```typescript
	describe('sync via ParseFeature', () => {
		it('derives options from store.state — reads value and options signals', () => {
			lifecycle.enable()
			store.state.value.set('hello')
			store.features.parse.sync()

			expect(store.state.tokens.get()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			lifecycle.disable()
		})

		it('derives effective options — skips markup when no Mark override and no per-option Mark', () => {
			lifecycle.enable()
			store.state.options.set([{markup: '@[__value__]'}])
			store.features.parse.sync()

			expect(store.computed.parser.get()).toBeUndefined()

			lifecycle.disable()
		})

		it('derives effective options — uses markup when Mark override is set', () => {
			lifecycle.enable()
			store.state.Mark.set(() => null)
			store.state.options.set([{markup: '@[__value__]'}])
			store.features.parse.sync()

			expect(store.computed.parser.get()).toBeDefined()

			lifecycle.disable()
		})

		it('derives effective options — uses markup when option has per-option Mark', () => {
			lifecycle.enable()
			store.state.options.set([{markup: '@[__value__]', Mark: () => null} as Record<string, unknown>])
			store.features.parse.sync()

			expect(store.computed.parser.get()).toBeDefined()

			lifecycle.disable()
		})

		it('skips parse emission when in recovery mode', () => {
			lifecycle.enable()
			store.state.value.set('initial')
			store.features.parse.sync()

			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})

			store.event.parse()

			const tokens = store.state.tokens.get()
			expect(tokens).toEqual([{type: 'text', content: 'initial', position: {start: 0, end: 7}}])
			expect(store.state.previousValue.get()).toBe('initial')

			lifecycle.disable()
		})

		it('parser auto-updates when drag changes (computed reactivity)', () => {
			lifecycle.enable()
			store.state.Mark.set(() => null)
			store.state.options.set([{markup: '@[__value__]'}])
			store.state.value.set('hello')
			store.features.parse.sync()

			const parserBefore = store.computed.parser.get()
			expect(parserBefore).toBeDefined()

			store.state.drag.set(true)
			const parserAfter = store.computed.parser.get()

			expect(parserAfter).toBeDefined()
			expect(parserAfter).not.toBe(parserBefore)

			lifecycle.disable()
		})
	})
```

In `parse handler` describe — update test bodies:
```typescript
	describe('parse handler', () => {
		it('updates state.tokens when parse event fires', () => {
			lifecycle.enable()
			store.state.value.set('hello world')
			store.features.parse.sync()

			expect(store.state.tokens.get()).toEqual([
				{type: 'text', content: 'hello world', position: {start: 0, end: 11}},
			])

			lifecycle.disable()
		})

		it('handles recovery mode — re-parses from token text', () => {
			lifecycle.enable()
			store.state.value.set('test')
			store.features.parse.sync()

			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})
			store.event.parse()

			const tokens = store.state.tokens.get()
			expect(tokens).toEqual([{type: 'text', content: 'test', position: {start: 0, end: 4}}])
			expect(store.state.previousValue.get()).toBe('test')

			lifecycle.disable()
		})

		it('does not re-run the parse subscription when recovery changes after a parse event', () => {
			lifecycle.enable()
			store.state.value.set('hello')
			store.features.parse.sync()
			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})

			const setSpy = vi.spyOn(store.state.tokens, 'set')

			store.event.parse()
			expect(setSpy).toHaveBeenCalledTimes(1)

			setSpy.mockClear()
			store.state.recovery.set({caret: 1, anchor: store.nodes.focus})
			expect(setSpy).not.toHaveBeenCalled()

			lifecycle.disable()
		})
	})
```

In `lifecycle events` > "updated() first call" test — update:
```typescript
		it('updated() first call triggers enable() and parse sync', () => {
			const lifecycle = store.lifecycle
			store.state.value.set('hello')

			const enableSpy = vi.spyOn(lifecycle, 'enable')
			const parseSyncSpy = vi.spyOn(store.features.parse, 'sync')

			store.event.updated()

			expect(enableSpy).toHaveBeenCalledOnce()
			expect(parseSyncSpy).toHaveBeenCalledOnce()
			expect(store.state.tokens.get()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.event.unmounted()
		})
```

The rest of the lifecycle events tests remain unchanged since they don't call `syncParser()` directly.

- [ ] **Step 2: Run Lifecycle tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/lifecycle/Lifecycle.spec.ts`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/lifecycle/Lifecycle.spec.ts
git commit -m "test(core): update Lifecycle tests for ParseFeature delegation"
```

---

### Task 6: Run all checks

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS.

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run build**

Run: `pnpm run build`
Expected: PASS.

- [ ] **Step 4: Run lint**

Run: `pnpm run lint`
Expected: PASS.

- [ ] **Step 5: Run format**

Run: `pnpm run format`
Expected: PASS.
