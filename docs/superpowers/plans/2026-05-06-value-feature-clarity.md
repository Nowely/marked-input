# ValueFeature Clarity Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inline `ControlledEcho` into `ValueFeature`, rename the internal vocabulary to three clear verbs (propose / apply / accept), and split the constructor setup into two named methods — no behavior changes.

**Architecture:** Single-file refactor. `ControlledEcho.ts` is deleted; its one field and match logic move directly into `ValueFeature.ts` as `#pendingEcho` and `#onParentEcho`. The controlled/uncontrolled fork in `replaceRange` becomes two explicitly-named private methods.

**Tech Stack:** TypeScript, Vitest

---

## File Map

| File | Action |
|---|---|
| `packages/core/src/features/value/ValueFeature.ts` | Rewrite |
| `packages/core/src/features/value/ControlledEcho.ts` | Delete |
| `packages/core/src/features/value/README.md` | Update |
| `packages/core/src/features/value/index.ts` | No change |
| `packages/core/src/features/value/ValueFeature.spec.ts` | No change |

---

### Task 1: Verify tests pass before touching anything

**Files:**
- Read: `packages/core/src/features/value/ValueFeature.spec.ts`

- [ ] **Step 1: Run the existing value tests**

```bash
pnpm -w exec vitest run packages/core/src/features/value/ValueFeature.spec.ts
```

Expected: all 11 tests pass, zero failures.

- [ ] **Step 2: Confirm the baseline**

If any test fails, stop and investigate before proceeding. Do not continue with a broken baseline.

---

### Task 2: Rewrite `ValueFeature.ts`

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.ts`

- [ ] **Step 1: Replace the entire file content**

Write `packages/core/src/features/value/ValueFeature.ts` with:

```ts
import type {CaretRecovery, RawRange} from '../../shared/editorContracts'
import {signal, computed, event, batch, watch} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export class ValueFeature {
	readonly current = signal('')
	readonly isControlledMode = computed(() => this._store.props.value() !== undefined)
	readonly change = event()

	#pendingEcho: {value: string; recovery: CaretRecovery | undefined} | undefined

	constructor(private readonly _store: Store) {
		_store.lifecycle.onMounted(() => {
			this.#initializeFromProps()
			this.#subscribeToControlledValue()
		})
	}

	replaceRange(range: RawRange, replacement: string, options?: {recover?: CaretRecovery}): void {
		const current = this.current()
		if (this._store.props.readOnly()) return
		if (range.start < 0 || range.end < range.start || range.end > current.length) return

		const next = current.slice(0, range.start) + replacement + current.slice(range.end)
		if (this.isControlledMode()) {
			this.#proposeToParent(next, options?.recover)
		} else {
			this.#applyLocally(next, options?.recover)
		}
	}

	replaceAll(next: string, options?: {recover?: CaretRecovery}): void {
		return this.replaceRange({start: 0, end: this.current().length}, next, options)
	}

	// --- controlled path ---

	#proposeToParent(next: string, recovery: CaretRecovery | undefined): void {
		this.#pendingEcho = {value: next, recovery}
		this._store.props.onChange()?.(next)
	}

	#onParentEcho(value: string): void {
		if (value === this.current()) return
		const pending = this.#pendingEcho
		this.#pendingEcho = undefined
		const recovery = pending?.value === value ? pending.recovery : undefined
		this.#accept(value)
		if (recovery) this._store.caret.recovery(recovery)
		this.change()
	}

	// --- uncontrolled path ---

	#applyLocally(next: string, recovery: CaretRecovery | undefined): void {
		this._store.props.onChange()?.(next)
		this.#accept(next)
		this._store.caret.recovery(recovery)
		this.change()
	}

	// --- shared ---

	#accept(value: string): void {
		const tokens = this._store.parsing.parseValue(value)
		batch(() => {
			this._store.parsing.acceptTokens(tokens)
			this.current(value)
		})
	}

	// --- setup ---

	#initializeFromProps(): void {
		this.#accept(this._store.props.value() ?? this._store.props.defaultValue() ?? '')
	}

	#subscribeToControlledValue(): void {
		watch(this._store.props.value, value => {
			if (value !== undefined) this.#onParentEcho(value)
		})
	}
}
```

- [ ] **Step 2: Run value tests**

```bash
pnpm -w exec vitest run packages/core/src/features/value/ValueFeature.spec.ts
```

Expected: all 11 tests pass.

---

### Task 3: Delete `ControlledEcho.ts`

**Files:**
- Delete: `packages/core/src/features/value/ControlledEcho.ts`

- [ ] **Step 1: Delete the file**

```bash
rm packages/core/src/features/value/ControlledEcho.ts
```

- [ ] **Step 2: Run value tests again to confirm nothing depends on it**

```bash
pnpm -w exec vitest run packages/core/src/features/value/ValueFeature.spec.ts
```

Expected: all 11 tests pass.

- [ ] **Step 3: Run typecheck to confirm no dangling imports**

```bash
pnpm run typecheck
```

Expected: zero errors.

---

### Task 4: Update `README.md`

**Files:**
- Modify: `packages/core/src/features/value/README.md`

- [ ] **Step 1: Replace the file content**

Write `packages/core/src/features/value/README.md` with:

```markdown
# Value Feature

Owns accepted serialized editor value state and the raw-position edit pipeline.

## State

| Signal    | Purpose                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `current` | Accepted serialized editor value. Controlled mode updates it from `props.value`; uncontrolled edits update it directly. |

## Computed

| Computed           | Purpose                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `isControlledMode` | `props.value() !== undefined`; controlled edits propose to `onChange` and wait for prop echo before committing. |

## Commands

| Command          | Purpose                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `replaceRange()` | Replace a raw serialized range and optionally schedule caret/selection recovery.           |
| `replaceAll()`   | Replace the whole serialized value through the same controlled/uncontrolled edit pipeline. |

Drag, clipboard, overlay selection, block editing, inline input, and mark commands all use these commands instead of mutating tokens directly.

## Events

| Event    | Fired by                                             | Listened by                                      |
| -------- | ---------------------------------------------------- | ------------------------------------------------ |
| `change` | Accepted immediate edits and controlled prop echoes. | Overlay trigger probing and framework observers. |

## Internal flow

**Uncontrolled edit** (`props.value` is `undefined`):
1. `replaceRange` calls `#applyLocally`
2. `#applyLocally` calls `onChange`, `#accept`, schedules `caret.recovery`, fires `change`

**Controlled edit** (`props.value` is defined):
1. `replaceRange` calls `#proposeToParent`
2. `#proposeToParent` stashes `{value, recovery}` in `#pendingEcho` and calls `onChange`
3. Parent echoes updated `props.value` → `#onParentEcho` runs
4. If echo matches the proposed value, recovery is applied; otherwise discarded
5. `#accept` commits the echoed value; `change` fires

**Setup** (`onMounted`):
- `#initializeFromProps` accepts `props.value ?? props.defaultValue ?? ''` once
- `#subscribeToControlledValue` watches `props.value` for subsequent controlled echoes
```

---

### Task 5: Run full checks and commit

**Files:** all modified files

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: full suite passes with no failures.

- [ ] **Step 2: Build**

```bash
pnpm run build
```

Expected: exits with code 0, no errors.

- [ ] **Step 3: Typecheck**

```bash
pnpm run typecheck
```

Expected: zero errors.

- [ ] **Step 4: Lint**

```bash
pnpm run lint:check
```

Expected: zero errors.

- [ ] **Step 5: Format check**

```bash
pnpm run format:check
```

Expected: zero errors. If format issues exist, run `pnpm run format` first, then re-check.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/value/ValueFeature.ts \
        packages/core/src/features/value/README.md \
        docs/superpowers/specs/2026-05-06-value-feature-clarity-design.md \
        docs/superpowers/plans/2026-05-06-value-feature-clarity.md
git rm packages/core/src/features/value/ControlledEcho.ts
git commit -m "refactor(core): clarify ValueFeature — inline ControlledEcho, rename verbs"
```
