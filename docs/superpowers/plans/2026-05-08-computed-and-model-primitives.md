# Computed and Model Primitives — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current writable `computed` into a pure writable `computed` (no internal state, Vue style) and a new `model` primitive (Vue `defineModel`-inspired) that owns the controlled/uncontrolled value pattern. Migrate `ValueModel.current` to use `model`.

**Architecture:** All changes live in `packages/core/src/shared/signals/signal.ts` and its sibling test files. No new files. The writable `computed` callbacks lose the `field: Signal<T>` argument; `model` exposes `(value)` to `get` and `(next, previous) => T` to `set`. `set`'s return value is what gets written to the internal signal — `previous` means no-op, `next` means write.

**Tech Stack:** TypeScript, Vitest, alien-signals reactive system (existing).

---

## Pre-flight

Read the design spec before starting: [docs/superpowers/specs/2026-05-08-computed-and-model-primitives-design.md](docs/superpowers/specs/2026-05-08-computed-and-model-primitives-design.md). The spec is the contract — every task here implements a piece of it.

Verify the working tree is clean and tests pass on the current branch:

```bash
git status
pnpm --filter @markput/core test --run
```

Expected: clean tree; Core 313 tests pass.

---

## File map

| File | Role | Touched in |
|---|---|---|
| `packages/core/src/shared/signals/signal.ts` | All signal/computed/event/effect primitives. We add `model()`, reshape writable `computed`, drop `makeWritableComputed`. | Tasks 1, 3 |
| `packages/core/src/shared/signals/index.ts` | Re-exports. Add `model`. | Task 1 |
| `packages/core/src/shared/signals/model.spec.ts` | NEW. Unit tests for `model()`. | Task 1 |
| `packages/core/src/shared/signals/computed.spec.ts` | Rewrite the `computed — writable` describe block to match the new shape. Readonly tests unchanged. | Task 3 |
| `packages/core/src/features/value/ValueModel.ts` | Migrate `current` from writable `computed` to `model`. | Task 2 |
| `packages/core/src/features/value/ValueModel.spec.ts` | Unchanged — assertions verify behavior preservation. | Verified in Tasks 2, 4 |

---

## Task 1: Add `model()` primitive (TDD)

**Files:**
- Create: `packages/core/src/shared/signals/model.spec.ts`
- Modify: `packages/core/src/shared/signals/signal.ts` — add new section after `makeWritableComputed`
- Modify: `packages/core/src/shared/signals/index.ts` — add `model` to re-exports

### Step 1.1: Write the failing tests

- [ ] **Step 1.1.1: Create `model.spec.ts`**

Write `packages/core/src/shared/signals/model.spec.ts`:

```ts
import {describe, it, expect, vi} from 'vitest'

import {signal, effect, model, isReactive} from './signal'

describe('model', () => {
	it('returns get(internal) on first read using default seed', () => {
		const m = model<string>({
			default: () => 'seed',
			get: value => value,
			set: (next, previous) => next ?? previous,
		})
		expect(m()).toBe('seed')
	})

	it('runs default lazily on first read', () => {
		let calls = 0
		const m = model<string>({
			default: () => {
				calls++
				return 'seed'
			},
			get: value => value,
			set: (_next, previous) => previous,
		})
		expect(calls).toBe(0)
		m()
		expect(calls).toBe(1)
		m()
		expect(calls).toBe(1)
	})

	it('runs default in untracked scope — dep change does not invalidate reader', () => {
		const dep = signal('x')
		let getCalls = 0
		const m = model<string>({
			default: () => dep(),
			get: value => {
				getCalls++
				return value
			},
			set: (_next, previous) => previous,
		})
		expect(m()).toBe('x')
		expect(getCalls).toBe(1)
		dep('y')
		// Reader is memoized and dep is not one of its deps (default ran untracked),
		// so neither get nor the underlying internal signal re-evaluates.
		expect(m()).toBe('x')
		expect(getCalls).toBe(1)
	})

	it('passes (next, previous) to set', () => {
		const setSpy = vi.fn((_next: string | undefined, previous: string) => previous)
		const m = model<string>({
			default: () => 'init',
			get: value => value,
			set: setSpy,
		})
		m() // ensure default ran
		m('updated')
		expect(setSpy).toHaveBeenCalledWith('updated', 'init')
	})

	it('writes set return value to internal', () => {
		const m = model<string>({
			default: () => 'a',
			get: value => value,
			set: (next, previous) => next ?? previous,
		})
		m('b')
		expect(m()).toBe('b')
	})

	it('keeps internal unchanged when set returns previous', () => {
		const m = model<string>({
			default: () => 'a',
			get: value => value,
			set: (_next, previous) => previous,
		})
		m('b')
		expect(m()).toBe('a')
	})

	it('controlled-style: get reads external; set returning previous keeps internal stable', () => {
		const external = signal('controlled')
		const m = model<string>({
			default: () => 'fallback',
			get: _value => external(),
			set: (_next, previous) => previous,
		})
		expect(m()).toBe('controlled')
		m('attempted')
		expect(m()).toBe('controlled')
	})

	it('uncontrolled-style: get reads internal; set returning next writes internal', () => {
		const m = model<string>({
			default: () => 'init',
			get: value => value,
			set: (next, previous) => next ?? previous,
		})
		expect(m()).toBe('init')
		m('updated')
		expect(m()).toBe('updated')
	})

	it('propagates external dep changes to effects via get', () => {
		const external = signal('a')
		const m = model<string>({
			default: () => '',
			get: _value => external(),
			set: (_next, previous) => previous,
		})
		const results: string[] = []
		const dispose = effect(() => {
			results.push(m())
		})
		expect(results).toEqual(['a'])
		external('b')
		expect(results).toEqual(['a', 'b'])
		dispose()
	})

	it('propagates internal writes to effects', () => {
		const m = model<number>({
			default: () => 0,
			get: value => value,
			set: (next, previous) => next ?? previous,
		})
		const results: number[] = []
		const dispose = effect(() => {
			results.push(m())
		})
		expect(results).toEqual([0])
		m(1)
		expect(results).toEqual([0, 1])
		dispose()
	})

	it('isReactive returns true for model', () => {
		const m = model<string>({
			default: () => '',
			get: value => value,
			set: (_next, previous) => previous,
		})
		expect(isReactive(m)).toBe(true)
	})
})
```

- [ ] **Step 1.1.2: Run the spec to verify it fails**

```bash
pnpm -w exec vitest run packages/core/src/shared/signals/model.spec.ts
```

Expected: FAIL with `model is not exported` (or similar import-time error). All test cases should fail.

### Step 1.2: Implement `model()` in signal.ts

- [ ] **Step 1.2.1: Add `model()` factory**

Open `packages/core/src/shared/signals/signal.ts`. After the `makeWritableComputed` function (currently the last function before `listen()`), insert:

```ts
// ---------------------------------------------------------------------------
// model<T> — controlled/uncontrolled value primitive (Vue defineModel-inspired)
// ---------------------------------------------------------------------------

export function model<T>(opts: {
	default: () => T
	get: (value: T) => T
	set: (next: T | undefined, previous: T) => T
}): Signal<T> {
	let internal: Signal<T> | undefined
	const ensureInternal = (): Signal<T> => {
		if (internal === undefined) {
			internal = signal(untracked(opts.default))
		}
		return internal
	}

	// Reads go through computed so opts.get is memoized and external signals
	// read inside opts.get propagate to subscribers.
	const reader = computed(() => opts.get(ensureInternal()()))

	const callable = function modelOper(...args: [T | undefined] | []): T | void {
		if (args.length === 0) return reader()
		const sig = ensureInternal()
		sig(opts.set(args[0], sig()))
	}

	Object.defineProperty(callable, 'name', {value: 'bound ' + computedOper.name})

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
	return callable as unknown as Signal<T>
}
```

Why the `'bound ' + computedOper.name` rename: `isReactive` checks for that exact name, so the model is recognized as reactive.

- [ ] **Step 1.2.2: Add `model` to the index re-exports**

Open `packages/core/src/shared/signals/index.ts`. Update:

```ts
export {
	signal,
	computed,
	effect,
	effectScope,
	event,
	watch,
	batch,
	trigger,
	untracked,
	listen,
	isReactive,
	model,
} from './signal'
export type {Signal, Computed, Event, SignalValues} from './signal'
```

(Add `model,` after `isReactive,`.)

- [ ] **Step 1.2.3: Run the spec to verify it passes**

```bash
pnpm -w exec vitest run packages/core/src/shared/signals/model.spec.ts
```

Expected: PASS — 11 tests pass.

- [ ] **Step 1.2.4: Run the full signals suite to confirm nothing else broke**

```bash
pnpm -w exec vitest run packages/core/src/shared/signals/
```

Expected: PASS — all signals tests including `signals.spec.ts`, `computed.spec.ts`, `model.spec.ts`.

### Step 1.3: Commit

- [ ] **Step 1.3.1: Stage and commit**

```bash
git add packages/core/src/shared/signals/signal.ts \
	packages/core/src/shared/signals/index.ts \
	packages/core/src/shared/signals/model.spec.ts
git commit -m "$(cat <<'EOF'
feat(core): add model() primitive to signals

Vue defineModel-inspired primitive that wraps an internal signal for
the controlled/uncontrolled value pattern. get receives the current
internal value; set receives (next, previous) and returns T — the
return value is written to internal (return previous = no-op).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds, working tree clean.

---

## Task 2: Migrate `ValueModel.current` to `model()`

**Files:**
- Modify: `packages/core/src/features/value/ValueModel.ts`
- Verify: `packages/core/src/features/value/ValueModel.spec.ts` (no edits, but must remain green)

This task changes the implementation of `ValueModel.current` from writable `computed` to `model`. All observable behavior must stay identical — `ValueModel.spec.ts` is the contract.

### Step 2.1: Update ValueModel

- [ ] **Step 2.1.1: Rewrite `ValueModel.ts`**

Replace the entire contents of `packages/core/src/features/value/ValueModel.ts` with:

```ts
import type {RawRange} from '../../shared/editorContracts'
import {computed, model} from '../../shared/signals/index.js'
import type {PropsModel} from '../props/PropsModel'

export class ValueModel {
	readonly isControlledMode = computed(() => this.props.value() !== undefined)

	readonly current = model<string>({
		default: () => this.props.value() ?? this.props.defaultValue() ?? '',
		get: value => (this.isControlledMode() ? (this.props.value() ?? '') : value),
		set: (next, previous) => {
			if (next === undefined) return previous
			if (this.props.readOnly()) return previous
			this.props.onChange()?.(next)
			return this.isControlledMode() ? previous : next
		},
	})

	constructor(private readonly props: PropsModel) {}

	replace(range: RawRange, replacement: string): void {
		const current = this.current()
		if (range.start < 0 || range.end < range.start || range.end > current.length) return
		const next = current.slice(0, range.start) + replacement + current.slice(range.end)
		this.current(next)
	}
}
```

Trace each branch of `set` to confirm it matches the spec's behavior table:
- `next === undefined` → returns `previous`, no emit, no internal write. ✓
- `props.readOnly()` true → returns `previous`, no emit, no internal write. ✓
- controlled mode (`isControlledMode()` true) → emit fires, returns `previous` so internal stays stable. ✓
- uncontrolled mode → emit fires, returns `next` so internal updates. ✓

### Step 2.2: Verify ValueModel tests still pass

- [ ] **Step 2.2.1: Run ValueModel.spec.ts**

```bash
pnpm -w exec vitest run packages/core/src/features/value/ValueModel.spec.ts
```

Expected: PASS — all 9 tests in the file (initialize, controlled, uncontrolled, fallback, readOnly behaviors, replace).

If any test fails, do NOT proceed. The failure indicates a behavior regression in either `model()` or the migration code. Diff against the old `ValueModel.ts` (in git history) and reconcile.

- [ ] **Step 2.2.2: Run the full core suite**

```bash
pnpm --filter @markput/core test --run
```

Expected: 313 tests pass. (Same as baseline.)

### Step 2.3: Commit

- [ ] **Step 2.3.1: Stage and commit**

```bash
git add packages/core/src/features/value/ValueModel.ts
git commit -m "$(cat <<'EOF'
refactor(core): migrate ValueModel.current to model() primitive

Replaces the writable computed({initial, get, set}) form with the new
model() primitive. Behavior is preserved — set's (next, previous) =>
T contract makes the controlled/readOnly/uncontrolled branches
explicit via the return value.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds, working tree clean.

---

## Task 3: Reshape writable `computed` (drop `field`, drop `initial`)

**Files:**
- Modify: `packages/core/src/shared/signals/signal.ts`
- Modify: `packages/core/src/shared/signals/computed.spec.ts`

After Task 2, no consumer uses the writable `computed` form. We can safely change its shape.

### Step 3.1: Rewrite the writable describe block in computed.spec.ts (failing first)

- [ ] **Step 3.1.1: Replace the `computed — writable` describe block**

Open `packages/core/src/shared/signals/computed.spec.ts`. The file currently has three describe blocks: `computed`, `computed with equals option`, and `computed — writable` (line 173 onward). Replace ONLY the `computed — writable` block (lines 173–309 in the current file) with:

```ts
describe('computed — writable', () => {
	it('reads via get', () => {
		const c = computed<number>({
			get: () => 42,
			set: () => {},
		})
		expect(c()).toBe(42)
	})

	it('passes previous value to get', () => {
		const trigger = signal(0)
		let receivedPrev: number | undefined = -1
		const c = computed<number>({
			get: prev => {
				receivedPrev = prev
				return trigger() + 1
			},
			set: () => {},
		})
		expect(c()).toBe(1)
		expect(receivedPrev).toBeUndefined()
		trigger(10)
		expect(c()).toBe(11)
		expect(receivedPrev).toBe(1)
	})

	it('calls set with the value being written', () => {
		const setSpy = vi.fn()
		const c = computed<number>({
			get: () => 0,
			set: setSpy,
		})
		c(7)
		expect(setSpy).toHaveBeenCalledWith(7)
	})

	it('skips set when undefined is written', () => {
		const setSpy = vi.fn()
		const c = computed<number>({
			get: () => 0,
			set: setSpy,
		})
		c(undefined)
		expect(setSpy).not.toHaveBeenCalled()
	})

	it('set can write to an external signal that get also reads', () => {
		const backing = signal(1)
		const c = computed<number>({
			get: () => backing() * 2,
			set: next => backing(next / 2),
		})
		expect(c()).toBe(2)
		c(20)
		expect(backing()).toBe(10)
		expect(c()).toBe(20)
	})

	it('external dep change in get propagates to effect', () => {
		const ext = signal(1)
		const results: number[] = []
		const c = computed<number>({
			get: () => ext() * 10,
			set: () => {},
		})
		const dispose = effect(() => {
			results.push(c())
		})
		expect(results).toEqual([10])
		ext(2)
		expect(results).toEqual([10, 20])
		dispose()
	})

	it('equals option suppresses propagation when output unchanged', () => {
		const trigger = signal(0)
		const runs = vi.fn()
		const c = computed<{parity: 'even' | 'odd'}>({
			get: () => ({parity: trigger() % 2 === 0 ? 'even' : 'odd'}),
			set: () => {},
			equals: (a, b) => a.parity === b.parity,
		})
		const dispose = effect(() => {
			c()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)
		trigger(2) // still 'even' — equals suppresses
		expect(runs).toHaveBeenCalledTimes(1)
		trigger(1) // flips to 'odd' — propagates
		expect(runs).toHaveBeenCalledTimes(2)
		dispose()
	})

	it('isReactive returns true for writable computed', () => {
		const c = computed<number>({
			get: () => 0,
			set: () => {},
		})
		expect(isReactive(c)).toBe(true)
	})
})
```

- [ ] **Step 3.1.2: Run the spec to verify it fails**

```bash
pnpm -w exec vitest run packages/core/src/shared/signals/computed.spec.ts
```

Expected: FAIL — TypeScript errors and/or runtime errors in the rewritten describe block. The old writable form still expects `{initial, get, set}` with `field` args; the new tests pass `{get, set, equals?}` without `field`.

### Step 3.2: Reshape writable `computed` in signal.ts

- [ ] **Step 3.2.1: Replace the `computed` overloads and impl**

Open `packages/core/src/shared/signals/signal.ts`. Find the section header `// Computed<T> — derived reactive value`. Below it sit the `Computed<T>` interface, `ComputedOptions<T>` type, three `computed` overloads, and the implementation that delegates to `makeWritableComputed`. Keep the `Computed<T>` interface and `ComputedOptions<T>` type intact. Replace the three overload signatures and the function body (from `export function computed<T>(opts: {` through its closing `}`) with:

```ts
export function computed<T>(opts: {
	get: (prev?: T) => T
	set: (next: T) => void
	equals?: (a: T, b: T) => boolean
}): Signal<T>
export function computed<T>(getter: (previousValue?: T) => T, opts?: ComputedOptions<T>): Computed<T>
export function computed<T>(
	getterOrOpts:
		| ((previousValue?: T) => T)
		| {
				get: (prev?: T) => T
				set: (next: T) => void
				equals?: (a: T, b: T) => boolean
		  },
	opts?: ComputedOptions<T>
): Signal<T> | Computed<T> {
	const isWritable = typeof getterOrOpts !== 'function'
	const node: ComputedNode<T> = {
		value: undefined,
		subs: undefined,
		subsTail: undefined,
		deps: undefined,
		depsTail: undefined,
		flags: ReactiveFlags.None,
		getter: isWritable ? getterOrOpts.get : (getterOrOpts as (previousValue?: T) => T),
		equalsFn: (isWritable ? getterOrOpts.equals : opts?.equals) ?? undefined,
	}
	const readFn = (computedOper as (this: ComputedNode<T>) => T).bind(node)

	if (!isWritable) {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callable matches Computed<T> interface but TS can't verify the call signature
		return readFn as unknown as Computed<T>
	}

	const writableComputed = function writableComputedOper(...args: [T | undefined] | []): T | void {
		if (args.length === 0) return readFn()
		const next = args[0]
		if (next === undefined) return
		getterOrOpts.set(next)
	}
	Object.defineProperty(writableComputed, 'name', {value: 'bound ' + computedOper.name})

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
	return writableComputed as unknown as Signal<T>
}
```

- [ ] **Step 3.2.2: Delete the now-unused `makeWritableComputed` function**

In `signal.ts`, delete the entire block starting at the section header comment `// makeWritableComputed — backing factory for computed({get, set, initial?})` through the end of the `makeWritableComputed` function (the closing `}` of `function makeWritableComputed`). The next section header `// listen() — scope-aware DOM event listener` should remain unchanged. Verify nothing else references `makeWritableComputed`:

```bash
grep -n "makeWritableComputed" packages/core/src/shared/signals/signal.ts
```

Expected: no matches after deletion.

- [ ] **Step 3.2.3: Run the computed spec to verify it passes**

```bash
pnpm -w exec vitest run packages/core/src/shared/signals/computed.spec.ts
```

Expected: PASS — readonly tests (10), equals tests (4), writable tests (8) — 22 total.

- [ ] **Step 3.2.4: Run the full signals suite**

```bash
pnpm -w exec vitest run packages/core/src/shared/signals/
```

Expected: PASS — `signals.spec.ts`, `computed.spec.ts`, `model.spec.ts`, plus any others.

- [ ] **Step 3.2.5: Run the core suite**

```bash
pnpm --filter @markput/core test --run
```

Expected: 313 tests pass.

### Step 3.3: Commit

- [ ] **Step 3.3.1: Stage and commit**

```bash
git add packages/core/src/shared/signals/signal.ts \
	packages/core/src/shared/signals/computed.spec.ts
git commit -m "$(cat <<'EOF'
refactor(core): simplify writable computed signature

Drop the field: Signal<T> argument and initial option from the
writable computed form. Get receives prev?: T (matching the readonly
form). Set receives only the value being written. The lazy backing
signal previously required by the writable form is gone — callers
that need internal state use the new model() primitive instead.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds, working tree clean.

---

## Task 4: Final verification

**Files:** none (verification only).

### Step 4.1: Run the full project test and quality gates

- [ ] **Step 4.1.1: Run the full test suite**

```bash
pnpm test
```

Expected: all packages pass — Core 313, React 171, Vue 157.

- [ ] **Step 4.1.2: Run typecheck**

```bash
pnpm run typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 4.1.3: Run build**

```bash
pnpm run build
```

Expected: clean build for all packages.

- [ ] **Step 4.1.4: Run lint and format checks**

```bash
pnpm run lint:check
pnpm run format:check
```

Expected: both clean. If formatter complains, run `pnpm run format` and amend the most recent commit only if it concerns the files this plan touched (signal.ts, model.spec.ts, computed.spec.ts, ValueModel.ts, index.ts).

### Step 4.2: Spot-check public API

- [ ] **Step 4.2.1: Confirm `model` and reshaped `computed` are exported**

```bash
grep -E "^export.*model|^export.*computed" packages/core/index.ts
```

Verify `model` and `computed` are both exported from the package root. If not, the package's main barrel was missed — open `packages/core/index.ts` and confirm the re-export matches the project's existing pattern for `signal`, `computed`, etc.

---

## Notes for the implementer

- **Do not introduce `equals` on `model`.** YAGNI — the internal signal already de-dupes with `===`. The spec explicitly excludes this.
- **Do not split `signal.ts` into multiple files.** The spec explicitly chose to keep `model` and `computed` in the same file as `signal()` and the reactive system internals. Splitting would force `ComputedNode`, `computedOper`, and `ReactiveFlags` to become module-public.
- **Test counts in the spec are the floor.** If you discover a missing test case while implementing, add it.
- **Behavior preservation in `ValueModel`.** All four branches of the new `set` must trace back to the exact behaviors documented in the spec's behavior trace table. The unchanged `ValueModel.spec.ts` is the contract.
- **Frequent commits.** Each task ends with a commit. If a task's tests fail mid-implementation, fix before committing — never commit broken state.
