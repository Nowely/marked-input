# Writable Computed Primitive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `computed()` with a writable overload that owns a lazy-initialised backing signal (`field`), then rewrite `ValueFeature` to use it, collapsing five private helpers into one watcher.

**Architecture:** A new `computed({initial?, get, set})` overload returns `Signal<T>`. The backing `field` signal is a private implementation detail—never exposed—so callers continue to see a plain reactive value. `ValueFeature.current` becomes a writable computed; a single `watch(current, …)` on mount handles every code path (controlled echo, uncontrolled write, mode flip) in place of the current four separate helpers.

**Tech Stack:** TypeScript, alien-signals reactive system (packages/core/src/shared/signals/), Vitest.

---

## Spec

### Primitive API

```ts
// Overload 1 — with initial value (field is Signal<T>)
function computed<T>(opts: {
  initial: () => T
  get: (field: Signal<T>) => T
  set: (next: T | undefined, field: Signal<T>) => void
}): Signal<T>

// Overload 2 — no initial (field is Signal<T | undefined>)
function computed<T>(opts: {
  get: (field: Signal<T | undefined>) => T
  set: (next: T | undefined, field: Signal<T | undefined>) => void
}): Signal<T>

// Existing overload — unchanged
function computed<T>(getter: (prev?: T) => T, opts?: {equals?: (a: T, b: T) => boolean}): Computed<T>
```

### Semantics

**Lazy field init (overload 1 only).** On the first call to `field()` inside `get` or `set`, the primitive calls `untracked(() => initial())` once and writes the result into the backing signal. Subsequent `field()` reads are normal reactive reads. `initial` is never called again.

**Why `untracked`.** `initial()` may read reactive sources (e.g. `props.value()`). Those reads must not become tracked dependencies of the writable computed's getter; otherwise every prop change would re-run `initial`, defeating the "lazy once" contract.

**Reactivity identity.** The returned callable is named `'bound computedOper'` so `isReactive(current)` returns `true`, matching existing computed behaviour.

**Write path.** Calling the returned `Signal<T>` with one argument dispatches to `set(next, field)`. The setter is not tracked — side effects inside it (e.g. calling `onChange`) are not reactive dependencies.

**Read path.** Calling with zero arguments delegates to `computedOper`; the `get` callback is re-evaluated whenever its reactive dependencies change (field writes, prop changes, etc.).

**Controlled → uncontrolled transition (semantics A).** When `get` never reads `field` (controlled mode), `initial` never fires. If the consumer switches to uncontrolled, `field()` is read for the first time, triggering `initial()` at that moment. The field returns the initial value, not the last controlled value. This is the chosen semantics; tests must reflect it.

### ValueFeature changes

| Before | After |
|---|---|
| `current = signal('')` | `current = computed({initial, get, set})` |
| `#initializeFromProps()` | absorbed into `initial` callback |
| `#subscribeToControlledValue()` | removed — `watch(current, …)` replaces it |
| `#proposeToParent()` | inlined into `set` |
| `#applyLocally()` | inlined into `set` |
| `#onParentEcho()` | absorbed into the single `watch` callback |
| `#accept(value)` writes `current(value)` | `#accept` only parses + accepts tokens + recovery; does NOT write `current` |
| `change()` called from helpers | called from the watcher, not from `#accept` (not emitted on mount) |
| `pendingEcho` | renamed `#pending`, same structure and purpose |

`#pending` is still required: in controlled mode the setter fires `onChange` but `current()` doesn't change until the parent echoes back via `props.value`. The watcher fires then, and `#accept` matches `#pending.value === v` to decide whether to apply caret recovery.

---

## Files

| File | Change |
|---|---|
| `packages/core/src/shared/signals/signal.ts` | Add writable overload, backing-field factory, lazy-init wrapper |
| `packages/core/src/shared/signals/index.ts` | No change needed — `Signal<T>` is already exported |
| `packages/core/src/shared/signals/computed.spec.ts` | New `describe('computed — writable', …)` block |
| `packages/core/src/features/value/ValueFeature.ts` | Full rewrite |
| `packages/core/src/features/value/ValueFeature.spec.ts` | Update one test for semantics-A transition |

---

## Task 1 — Writable computed: TypeScript overloads

**Files:**
- Modify: `packages/core/src/shared/signals/signal.ts:380-393`

- [ ] **Step 1: Add overload signatures above the existing `computed` implementation**

Replace the existing single signature:

```ts
export function computed<T>(getter: (previousValue?: T) => T, opts?: ComputedOptions<T>): Computed<T> {
```

with:

```ts
export function computed<T>(opts: {
	initial: () => T
	get: (field: Signal<T>) => T
	set: (next: T | undefined, field: Signal<T>) => void
}): Signal<T>
export function computed<T>(opts: {
	get: (field: Signal<T | undefined>) => T
	set: (next: T | undefined, field: Signal<T | undefined>) => void
}): Signal<T>
export function computed<T>(getter: (previousValue?: T) => T, opts?: ComputedOptions<T>): Computed<T>
export function computed<T>(
	getterOrOpts:
		| ((previousValue?: T) => T)
		| {get: (field: Signal<T | undefined>) => T; set: (next: T | undefined, field: Signal<T | undefined>) => void; initial?: () => T},
	opts?: ComputedOptions<T>,
): Signal<T> | Computed<T> {
	if (typeof getterOrOpts === 'function') {
		// existing path — no change inside
		const node: ComputedNode<T> = {
			value: undefined,
			subs: undefined,
			subsTail: undefined,
			deps: undefined,
			depsTail: undefined,
			flags: ReactiveFlags.None,
			getter: getterOrOpts as (previousValue?: T) => T,
			equalsFn: opts?.equals ?? undefined,
		}
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callable matches Computed<T> interface but TS can't verify the call signature
		return (computedOper as (this: ComputedNode<T>) => T).bind(node) as unknown as Computed<T>
	}
	return makeWritableComputed(getterOrOpts)
}
```

- [ ] **Step 2: Verify TypeScript accepts the overloads**

```bash
pnpm run typecheck 2>&1 | head -40
```

Expected: errors only in files that haven't been updated yet (ValueFeature); no errors in signal.ts itself.

---

## Task 2 — Writable computed: implementation (`makeWritableComputed`)

**Files:**
- Modify: `packages/core/src/shared/signals/signal.ts` (add helper before the `computed` export)

- [ ] **Step 1: Add `makeWritableComputed` above the `computed` export**

```ts
// ---------------------------------------------------------------------------
// makeWritableComputed — backing factory for computed({get, set, initial?})
// ---------------------------------------------------------------------------

function makeWritableComputed<T>(opts: {
	get: (field: Signal<T | undefined>) => T
	set: (next: T | undefined, field: Signal<T | undefined>) => void
	initial?: () => T
}): Signal<T> {
	// Backing signal that field reads/writes map to.
	const backing = signal<T | undefined>(undefined)

	// Lazy-init tracking for the `initial` overload.
	let initialized = !('initial' in opts)

	// `field` is a Signal<T> (with initial) / Signal<T | undefined> (without).
	// It intentionally does NOT use bind(signalOper) so we can intercept the
	// first read and run initial() inside untracked().
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed by caller overloads
	const field = function fieldOper(...args: [T | undefined] | []): T | undefined | void {
		if (args.length === 0) {
			if (!initialized) {
				initialized = true
				// Run initial() without tracking so its deps don't pollute
				// the writable computed's reactive graph.
				backing(untracked(() => (opts as {initial: () => T}).initial()))
			}
			return backing()
		}
		return backing(args[0])
	} as unknown as Signal<T | undefined>

	// ComputedNode whose getter reads field (and any other deps the user tracks).
	const node: ComputedNode<T> = {
		value: undefined,
		subs: undefined,
		subsTail: undefined,
		deps: undefined,
		depsTail: undefined,
		flags: ReactiveFlags.None,
		getter: () => opts.get(field),
		equalsFn: undefined,
	}

	const readFn = (computedOper as (this: ComputedNode<T>) => T).bind(node)

	const writableComputed = function writableComputedOper(...args: [T | undefined] | []): T | void {
		if (args.length === 0) return readFn()
		opts.set(args[0], field)
	}

	// Name must match 'bound computedOper' so isReactive() identifies this as reactive.
	Object.defineProperty(writableComputed, 'name', {value: 'bound ' + computedOper.name})

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- interface is satisfied by the callable above
	return writableComputed as unknown as Signal<T>
}
```

- [ ] **Step 2: Run the existing computed tests to confirm nothing regressed**

```bash
pnpm -w exec vitest run packages/core/src/shared/signals/computed.spec.ts
```

Expected: all existing tests pass.

---

## Task 3 — Writable computed: unit tests

**Files:**
- Modify: `packages/core/src/shared/signals/computed.spec.ts`

- [ ] **Step 1: Append a new describe block at the end of the file**

```ts
describe('computed — writable', () => {
	it('reads through get when no deps change', () => {
		const external = signal('a')
		const c = computed({
			initial: () => '',
			get: (field) => external() + field(),
			set: (_next, _field) => {},
		})
		expect(c()).toBe('a')
	})

	it('field starts undefined when no initial provided', () => {
		const c = computed<string>({
			get: (field) => field() ?? 'fallback',
			set: (_next, _field) => {},
		})
		expect(c()).toBe('fallback')
	})

	it('initial runs lazily on first field read', () => {
		let calls = 0
		const c = computed({
			initial: () => { calls++; return 'seed' },
			get: (field) => field(),
			set: (_next, _field) => {},
		})
		expect(calls).toBe(0)
		c()
		expect(calls).toBe(1)
		c()
		expect(calls).toBe(1) // not called again
	})

	it('initial runs inside untracked — does not leak deps into getter', () => {
		const dep = signal('x')
		let getterCalls = 0
		const c = computed({
			initial: () => dep(), // reads dep — must NOT track
			get: (field) => { getterCalls++; return field()! },
			set: (_next, _field) => {},
		})
		c() // triggers initial
		getterCalls = 0
		dep('y') // dep changes — getter must NOT re-run because of initial's read
		expect(getterCalls).toBe(0)
	})

	it('set routing — set writes field when caller chooses', () => {
		const c = computed({
			initial: () => 'start',
			get: (field) => field(),
			set: (next, field) => { field(next) },
		})
		expect(c()).toBe('start')
		c('updated')
		expect(c()).toBe('updated')
	})

	it('set routing — set can skip field write', () => {
		const external = vi.fn()
		const c = computed({
			initial: () => 'keep',
			get: (field) => field(),
			set: (next, _field) => { external(next) },
		})
		c('propose')
		expect(external).toHaveBeenCalledWith('propose')
		expect(c()).toBe('keep') // field untouched
	})

	it('field write propagates through get to effect', () => {
		const results: string[] = []
		const c = computed({
			initial: () => 'a',
			get: (field) => field(),
			set: (next, field) => { field(next) },
		})
		const dispose = effect(() => { results.push(c()) })
		expect(results).toEqual(['a'])
		c('b')
		expect(results).toEqual(['a', 'b'])
		dispose()
	})

	it('external dep change in get propagates to effect', () => {
		const ext = signal(1)
		const results: number[] = []
		const c = computed({
			initial: () => 0,
			get: (field) => field()! + ext(),
			set: (_next, _field) => {},
		})
		const dispose = effect(() => { results.push(c()) })
		expect(results).toEqual([1])
		ext(10)
		expect(results).toEqual([1, 10])
		dispose()
	})

	it('isReactive returns true for writable computed', () => {
		const c = computed({
			initial: () => '',
			get: (field) => field()!,
			set: (next, field) => { field(next) },
		})
		expect(isReactive(c)).toBe(true)
	})

	it('get can choose external over field, field write does not change result', () => {
		const ext = signal('controlled')
		const c = computed({
			initial: () => 'uncontrolled',
			get: (_field) => ext(), // ignores field
			set: (_next, _field) => {},
		})
		c('ignored')
		expect(c()).toBe('controlled') // still reads ext
	})
})
```

- [ ] **Step 2: Add `isReactive` to the import at the top of computed.spec.ts**

```ts
import {signal, computed, effect, batch, isReactive} from './signal'
```

- [ ] **Step 3: Run the new tests**

```bash
pnpm -w exec vitest run packages/core/src/shared/signals/computed.spec.ts
```

Expected: all tests pass including the new block.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/shared/signals/signal.ts packages/core/src/shared/signals/computed.spec.ts
git commit -m "feat(signals): add writable computed overload with lazy-init backing field"
```

---

## Task 4 — Rewrite ValueFeature

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.ts`

- [ ] **Step 1: Replace the entire file content**

```ts
import type {CaretRecovery, RawRange} from '../../shared/editorContracts'
import {computed, event, batch, watch} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export class ValueFeature {
	readonly isControlledMode = computed(() => this._store.props.value() !== undefined)
	readonly change = event()

	readonly current = computed<string>({
		initial: () =>
			this._store.props.value() ?? this._store.props.defaultValue() ?? '',
		get: (field) =>
			this.isControlledMode() ? this._store.props.value()! : field(),
		set: (next, field) => {
			if (next === undefined) return
			if (this.isControlledMode()) {
				this._store.props.onChange()?.(next)
			} else {
				field(next)
				this._store.props.onChange()?.(next)
			}
		},
	})

	#pending: {value: string; recovery: CaretRecovery | undefined} | undefined

	constructor(private readonly _store: Store) {
		_store.lifecycle.onMounted(() => {
			this.#accept(this.current())
			watch(this.current, v => {
				this.#accept(v)
				this.change()
			})
		})
	}

	replaceRange(range: RawRange, replacement: string, options?: {recover?: CaretRecovery}): void {
		const cur = this.current()
		if (this._store.props.readOnly()) return
		if (range.start < 0 || range.end < range.start || range.end > cur.length) return

		const next = cur.slice(0, range.start) + replacement + cur.slice(range.end)
		if (next === cur) return
		this.#pending = {value: next, recovery: options?.recover}
		this.current(next)
	}

	replaceAll(next: string, options?: {recover?: CaretRecovery}): void {
		return this.replaceRange({start: 0, end: this.current().length}, next, options)
	}

	#accept(value: string): void {
		const pending = this.#pending
		this.#pending = undefined
		const tokens = this._store.parsing.parseValue(value)
		batch(() => this._store.parsing.acceptTokens(tokens))
		if (pending?.value === value) {
			this._store.caret.recovery(pending.recovery)
		}
	}
}
```

- [ ] **Step 2: Run only the ValueFeature spec to see which tests need updating**

```bash
pnpm -w exec vitest run packages/core/src/features/value/ValueFeature.spec.ts
```

Expected: one failure — `'preserves current when controlled value becomes undefined'` (line 47). All other tests pass.

---

## Task 5 — Update ValueFeature spec for semantics-A

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.spec.ts:47-57`

The old test locked in semantics-B (preserve last controlled value after switching to uncontrolled). With semantics-A, switching to uncontrolled falls back to `initial()`, which evaluates `props.value() ?? props.defaultValue() ?? ''`. At the moment of the switch, `props.value()` is `undefined`, so the field initialises from `defaultValue`.

- [ ] **Step 1: Replace the test**

Old:
```ts
it('preserves current when controlled value becomes undefined', () => {
	const store = new Store()
	store.props.set({value: 'hello', defaultValue: 'default'})
	store.lifecycle.mounted()

	store.props.set({value: undefined})

	expect(store.value.isControlledMode()).toBe(false)
	expect(store.value.current()).toBe('hello')
	expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
})
```

New:
```ts
it('falls back to defaultValue when controlled value becomes undefined', () => {
	const store = new Store()
	store.props.set({value: 'hello', defaultValue: 'default'})
	store.lifecycle.mounted()

	store.props.set({value: undefined})

	expect(store.value.isControlledMode()).toBe(false)
	expect(store.value.current()).toBe('default')
	expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'default', position: {start: 0, end: 7}}])
})
```

- [ ] **Step 2: Run ValueFeature spec again — all must pass**

```bash
pnpm -w exec vitest run packages/core/src/features/value/ValueFeature.spec.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/value/ValueFeature.ts packages/core/src/features/value/ValueFeature.spec.ts
git commit -m "refactor(value): replace signal+helpers with writable computed"
```

---

## Task 6 — Full verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass. If any test outside `ValueFeature.spec.ts` fails, investigate — likely a test that was relying on `current(x)` writing through in controlled mode. Fix by switching the test setup to uncontrolled mode (remove `value` prop, use `defaultValue` or no prop).

- [ ] **Step 2: Build**

```bash
pnpm run build
```

Expected: no errors.

- [ ] **Step 3: Typecheck**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Lint and format**

```bash
pnpm run lint:check && pnpm run format:check
```

Expected: clean. If `lint:check` reports `oxlint` violations on the new writable computed implementation (e.g. `no-unsafe-type-assertion`), add inline suppression comments matching the pattern used elsewhere in `signal.ts`.

- [ ] **Step 5: Final commit if fixups were needed**

```bash
git add -A
git commit -m "fix: address lint and type issues after writable-computed refactor"
```

---

## Self-Review

**Spec coverage:**
- New overload signatures ✓ (Task 1)
- `initial` lazy + untracked semantics ✓ (Task 2 + Task 3 tests)
- No-`initial` overload ✓ (Task 3: `'field starts undefined when no initial provided'`)
- `isReactive` compatibility ✓ (Task 3: `'isReactive returns true'`)
- Set routing: write field vs skip ✓ (Task 3: two routing tests)
- ValueFeature refactor — all helpers removed ✓ (Task 4)
- `#pending` recovery semantics preserved ✓ (existing tests, unchanged)
- Semantics-A transition test updated ✓ (Task 5)
- Full suite verification ✓ (Task 6)

**Placeholder scan:** None found. All steps include code or commands.

**Type consistency:**
- `makeWritableComputed` uses `Signal<T | undefined>` for `field` internally; caller overloads narrow to `Signal<T>` when `initial` is present. Consistent throughout.
- `writableComputedOper` named function matches `'bound ' + computedOper.name` check in `isReactive`. Consistent.
- `#pending` / `#accept` signatures match between Task 4 (implementation) and the recovery tests (unchanged).
