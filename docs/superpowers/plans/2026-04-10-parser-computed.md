# Parser as Computed — Lifecycle Simplification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `parser` from an imperatively-set Signal to a declarative Computed, eliminating `#maybeSyncParser()`, `#getEffectiveOptions()`, and manual change-detection caching from Lifecycle.

**Architecture:** Parser becomes a `computed()` in `Store.computed` that auto-derives from `Mark`, `options`, and `drag`. Lifecycle's `#onUpdated()` uses a 2-field cache (`#lastValue` + `#lastParser`) instead of the previous 3-field cache (`#lastSyncValue/Mark/Options`). `syncParser()` becomes init-only (no parser creation).

**Tech Stack:** TypeScript, alien-signals (computed/watch/effectScope), Vitest

---

### Task 1: Move parser from StoreState Signal to StoreComputed Computed

**Files:**
- Modify: `packages/core/src/features/store/Store.ts`

- [ ] **Step 1: Update StoreState type — remove parser**

In `Store.ts`, remove the `parser` entry from the `StoreState` type (line 21):

```typescript
type StoreState = {
	tokens: Signal<Token[]>
	// parser: Signal<Parser | undefined>  ← REMOVE THIS LINE
	value: Signal<string | undefined>
	// ... rest unchanged
}
```

- [ ] **Step 2: Update StoreComputed type — add parser**

In `Store.ts`, add `parser` to the `StoreComputed` type (around line 43):

```typescript
type StoreComputed = {
	parser: Computed<Parser | undefined>
	containerClass: Computed<string | undefined>
	containerStyle: Computed<CSSProperties | undefined>
}
```

- [ ] **Step 3: Remove parser from state initialization**

Remove line 78 (`parser: signal<Parser | undefined>(undefined),`) from the `state` object.

- [ ] **Step 4: Add parser computed to computed object**

Add `parser` as the first entry in the `computed` object (before `containerClass`). Move the `#getEffectiveOptions` logic from Lifecycle here:

```typescript
readonly computed: StoreComputed = {
	parser: computed(() => {
		const Mark = this.state.Mark.get()
		const coreOptions = this.state.options.get()
		const hasPerOptionMark = (coreOptions as unknown[] | undefined)?.some(
			opt =>
				typeof opt === 'object' &&
				opt !== null &&
				'Mark' in opt &&
				(opt as Record<string, unknown>).Mark != null
		)
		const effectiveOptions = Mark || hasPerOptionMark ? coreOptions : undefined
		const markups = effectiveOptions?.map(opt => opt.markup)
		if (!markups?.some(Boolean)) return undefined
		const isDrag = !!this.state.drag.get()
		return new Parser(markups, isDrag ? {skipEmptyText: true} : undefined)
	}),
	containerClass: computed(() =>
		cx(styles.Container, this.state.className(), this.state.slotProps()?.container?.className)
	),
	containerStyle: computed(prev => {
		const next = merge(this.state.style(), this.state.slotProps()?.container?.style)
		return prev && shallow(prev, next) ? prev : next
	}),
}
```

- [ ] **Step 5: Verify Store compiles**

Run: `pnpm --filter @markput/core exec tsc --noEmit`
Expected: May have errors in Lifecycle.ts (next task fixes those). Store.ts itself should be clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/store/Store.ts
git commit -m "refactor(core): move parser from Signal to Computed in Store"
```

---

### Task 2: Simplify Lifecycle.ts — remove #maybeSyncParser and parser creation

**Files:**
- Modify: `packages/core/src/features/lifecycle/Lifecycle.ts`

- [ ] **Step 1: Remove unused import and replace cache fields**

Remove the `Parser` import (no longer needed — parser is computed) and replace the 3 cache fields with 2:

```typescript
import {effectScope, watch} from '../../shared/signals/index.js'
import {toString, getTokensByUI, getTokensByValue, parseWithParser} from '../parsing'
import type {Store} from '../store'

export class Lifecycle {
	#scope?: () => void
	#featuresEnabled = false
	#initialized = false
	#lastValue: string | undefined
	#lastParser: Parser | undefined

	constructor(private store: Store) {
		watch(store.event.updated, () => this.#onUpdated())
		watch(store.event.afterTokensRendered, () => this.recoverFocus())
		watch(store.event.unmounted, () => this.disable())
	}
```

Note: We still need the `Parser` type for the `#lastParser` field. Keep `import type {Parser} from '../parsing'` or use the existing import. Actually, since `Parser` was imported as a value import (used with `new`), and we no longer use `new Parser`, we only need the type. Change the import line:

```typescript
import {toString, getTokensByUI, getTokensByValue, parseWithParser} from '../parsing'
import type {Parser} from '../parsing'
import type {Store} from '../store'
```

- [ ] **Step 2: Replace #onUpdated — remove #maybeSyncParser call**

```typescript
#onUpdated() {
	if (!this.#scope) {
		this.enable()
		this.syncParser()
		return
	}
	const value = this.store.state.value.get()
	const parser = this.store.computed.parser.get()
	if (this.#initialized && value === this.#lastValue && parser === this.#lastParser) return
	this.#lastValue = value
	this.#lastParser = parser
	if (!this.store.state.recovery.get()) {
		this.store.event.parse()
	}
}
```

- [ ] **Step 3: Simplify syncParser — remove parser creation**

Replace the entire `syncParser()` method. It now only handles initial parse:

```typescript
syncParser() {
	const {store} = this
	const inputValue = store.state.value.get() ?? store.state.defaultValue.get() ?? ''
	store.state.tokens.set(parseWithParser(store, inputValue))
	store.state.previousValue.set(inputValue)
	this.#lastValue = store.state.value.get()
	this.#lastParser = store.computed.parser.get()
	this.#initialized = true
}
```

- [ ] **Step 4: Remove #getEffectiveOptions method**

Delete the entire `#getEffectiveOptions()` method (previously lines 106-117). This logic is now in the Store computed.

- [ ] **Step 5: Verify Lifecycle compiles**

Run: `pnpm --filter @markput/core exec tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/lifecycle/Lifecycle.ts
git commit -m "refactor(core): simplify Lifecycle by removing #maybeSyncParser and #getEffectiveOptions"
```

---

### Task 3: Update Lifecycle tests

**Files:**
- Modify: `packages/core/src/features/lifecycle/Lifecycle.spec.ts`

The tests need updating because `parser` is now a computed (accessed via `store.computed.parser` instead of `store.state.parser`), and `syncParser()` no longer creates the parser.

- [ ] **Step 1: Update parser assertions to use computed**

All tests that check `store.state.parser.get()` must change to `store.computed.parser.get()`. This affects lines 122, 135, 147.

Replace all 3 occurrences:
```typescript
// Before:
expect(store.state.parser.get()).toBeUndefined()
expect(store.state.parser.get()).toBeDefined()
// After:
expect(store.computed.parser.get()).toBeUndefined()
expect(store.computed.parser.get()).toBeDefined()
```

- [ ] **Step 2: Update "skips syncParser" test**

The test at line 244 ("updated() subsequent call with unchanged deps skips syncParser()") currently verifies that `syncParser` is not called when deps are unchanged. After our change, `#onUpdated` no longer calls `syncParser` on subsequent calls — it directly emits parse. Update the test to verify parse is not emitted instead:

```typescript
it('updated() subsequent call with unchanged deps skips parse()', () => {
	store.state.value.set('hello')
	store.event.updated()

	const parseSpy = vi.spyOn(store.event, 'parse')
	store.event.updated()

	expect(parseSpy).not.toHaveBeenCalled()

	store.event.unmounted()
})
```

- [ ] **Step 3: Update "re-runs syncParser when value changes" test**

The test at line 257 verifies `syncParser` is called on value change. After our change, `#onUpdated` directly emits parse. Update:

```typescript
it('updated() emits parse when value changes', () => {
	store.state.value.set('hello')
	store.event.updated()

	store.state.value.set('world')
	const parseSpy = vi.spyOn(store.event, 'parse')
	store.event.updated()

	expect(parseSpy).toHaveBeenCalledOnce()
	parseSpy.mockRestore()

	store.event.unmounted()
})
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/lifecycle/Lifecycle.spec.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/lifecycle/Lifecycle.spec.ts
git commit -m "test(core): update Lifecycle tests for parser-as-computed"
```

---

### Task 4: Add test for parser reactivity to drag changes

**Files:**
- Modify: `packages/core/src/features/lifecycle/Lifecycle.spec.ts`

This tests the bug fix: parser now auto-updates when `drag` changes (previously it was stale until next `on.updated`).

- [ ] **Step 1: Write the test**

Add inside the `syncParser()` describe block (after the existing tests):

```typescript
it('parser auto-updates when drag changes (computed reactivity)', () => {
	const lifecycle = store.lifecycle

	lifecycle.enable()
	store.state.Mark.set(() => null)
	store.state.options.set([{markup: '@[__value__]'}])
	store.state.value.set('hello')
	lifecycle.syncParser()

	const parserBefore = store.computed.parser.get()
	expect(parserBefore).toBeDefined()

	store.state.drag.set(true)
	const parserAfter = store.computed.parser.get()

	expect(parserAfter).toBeDefined()
	expect(parserAfter).not.toBe(parserBefore)

	lifecycle.disable()
})
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/lifecycle/Lifecycle.spec.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/lifecycle/Lifecycle.spec.ts
git commit -m "test(core): add parser reactivity test for drag changes"
```

---

### Task 5: Run full verification

- [ ] **Step 1: Run all core tests**

Run: `pnpm --filter @markput/core exec vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: No errors.

- [ ] **Step 4: Run lint**

Run: `pnpm run lint`
Expected: No errors.

- [ ] **Step 5: Run build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 6: Run format check**

Run: `pnpm run format`
Expected: No errors.
