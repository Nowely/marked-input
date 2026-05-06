# Unify Mount Lifecycle Setup via `lifecycle.onMounted()`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the repeated `#scope` / `#disposers` + `mounted`/`unmounted` boilerplate in five features with a single `store.lifecycle.onMounted(setup)` call. Push auto-disposal into `LifecycleFeature` so every feature's mount-time setup looks identical.

**Architecture:** `LifecycleFeature` gains one method, `onMounted(setup)`. It wires a `mounted` watcher that creates an `effectScope` running `setup`, and an `unmounted` watcher that disposes the scope. Any `watch()` / `listen()` / `effect()` made inside `setup` (directly or transitively) is automatically cleaned up on unmount and re-created on the next mount. `ValueFeature`, `DomFeature`, `KeyboardFeature`, `CaretFeature`, `ClipboardFeature` migrate. The inner `enable*` helpers (`enableFocus`, `enableSelection`, `enableInput`, `enableBlockEdit`, `enableArrowNav`) drop their own `effectScope` wrapper and disposer return — they rely on the parent scope from `onMounted`.

`OverlayFeature` and `ParsingFeature` use a different pattern (scope toggled by an arbitrary boolean signal, not lifecycle events) and stay untouched.

**Tech Stack:** TypeScript, custom signals library (`packages/core/src/shared/signals/`), Vitest.

---

## File Structure

| File | Action |
|------|--------|
| `packages/core/src/features/lifecycle/LifecycleFeature.ts` | Add `onMounted` method |
| `packages/core/src/features/lifecycle/LifecycleFeature.spec.ts` | Add tests for `onMounted` |
| `packages/core/src/features/value/ValueFeature.ts` | Migrate to `onMounted` |
| `packages/core/src/features/dom/DomFeature.ts` | Migrate to `onMounted` |
| `packages/core/src/features/keyboard/KeyboardFeature.ts` | Migrate to `onMounted` |
| `packages/core/src/features/caret/CaretFeature.ts` | Migrate to `onMounted` |
| `packages/core/src/features/clipboard/ClipboardFeature.ts` | Migrate to `onMounted` |
| `packages/core/src/features/caret/focus.ts` | Drop `effectScope` + disposer return |
| `packages/core/src/features/caret/selection.ts` | Drop `effectScope` + disposer return; preserve `selecting('drag')` reset via `effect()` cleanup |
| `packages/core/src/features/keyboard/arrowNav.ts` | Drop `effectScope` + disposer return |
| `packages/core/src/features/keyboard/blockEdit.ts` | Drop `effectScope` + disposer return |
| `packages/core/src/features/keyboard/input.ts` | Drop `effectScope` + disposer return |
| `docs/superpowers/plans/2026-05-06-remove-value-unmount-disposal.md` | Delete (superseded by this plan) |

---

### Task 1: Add `onMounted` to `LifecycleFeature` with tests

**Files:**
- Modify: `packages/core/src/features/lifecycle/LifecycleFeature.ts`
- Modify: `packages/core/src/features/lifecycle/LifecycleFeature.spec.ts`

- [ ] **Step 1: Write failing tests for `onMounted`**

Replace the current contents of `packages/core/src/features/lifecycle/LifecycleFeature.spec.ts` with:

```ts
import {describe, expect, it, vi} from 'vitest'

import {signal, watch} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('LifecycleFeature', () => {
	it('exposes mounted, unmounted, rendered events', () => {
		const store = new Store()
		expect(typeof store.lifecycle.mounted).toBe('function')
		expect(typeof store.lifecycle.unmounted).toBe('function')
		expect(typeof store.lifecycle.rendered).toBe('function')
	})

	describe('onMounted()', () => {
		it('runs setup once on mounted', () => {
			const store = new Store()
			const setup = vi.fn()
			store.lifecycle.onMounted(setup)

			expect(setup).not.toHaveBeenCalled()
			store.lifecycle.mounted()
			expect(setup).toHaveBeenCalledTimes(1)
		})

		it('does not re-run setup if mounted fires again without an unmount', () => {
			const store = new Store()
			const setup = vi.fn()
			store.lifecycle.onMounted(setup)

			store.lifecycle.mounted()
			store.lifecycle.mounted()

			expect(setup).toHaveBeenCalledTimes(1)
		})

		it('disposes inner watchers on unmount', () => {
			const store = new Store()
			const source = signal(0)
			const observed = vi.fn()
			store.lifecycle.onMounted(() => {
				watch(source, value => observed(value))
			})

			store.lifecycle.mounted()
			source(1)
			expect(observed).toHaveBeenCalledTimes(1)
			expect(observed).toHaveBeenLastCalledWith(1)

			store.lifecycle.unmounted()
			source(2)
			expect(observed).toHaveBeenCalledTimes(1)
		})

		it('re-runs setup with a fresh scope on remount', () => {
			const store = new Store()
			const source = signal(0)
			const observed = vi.fn()
			const setup = vi.fn(() => {
				watch(source, value => observed(value))
			})
			store.lifecycle.onMounted(setup)

			store.lifecycle.mounted()
			source(1)
			store.lifecycle.unmounted()
			store.lifecycle.mounted()
			source(2)

			expect(setup).toHaveBeenCalledTimes(2)
			expect(observed).toHaveBeenCalledTimes(2)
			expect(observed).toHaveBeenNthCalledWith(1, 1)
			expect(observed).toHaveBeenNthCalledWith(2, 2)
		})
	})
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm -w exec vitest run packages/core/src/features/lifecycle/
```

Expected: failures for all four `onMounted` tests (`store.lifecycle.onMounted is not a function`).

- [ ] **Step 3: Implement `onMounted`**

Replace the current contents of `packages/core/src/features/lifecycle/LifecycleFeature.ts` with:

```ts
import {effectScope, event, watch} from '../../shared/signals'

export class LifecycleFeature {
	readonly mounted = event()
	readonly unmounted = event()
	readonly rendered = event()

	/**
	 * Run `setup` when the editor is mounted. Any reactive subscription
	 * created inside `setup` (`watch`, `listen`, `effect`, nested
	 * `effectScope`) is automatically disposed on `unmounted` and re-created
	 * on the next `mounted`.
	 */
	onMounted(setup: () => void): void {
		let scope: (() => void) | undefined
		watch(this.mounted, () => {
			if (scope) return
			scope = effectScope(setup)
		})
		watch(this.unmounted, () => {
			scope?.()
			scope = undefined
		})
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm -w exec vitest run packages/core/src/features/lifecycle/
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/lifecycle/
git commit -m "feat(lifecycle): add onMounted helper for scoped mount setup"
```

---

### Task 2: Migrate `ValueFeature`

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.ts`

- [ ] **Step 1: Replace mount/unmount boilerplate with `onMounted`**

Replace lines 1–33 of `packages/core/src/features/value/ValueFeature.ts` (imports through end of constructor) with:

```ts
import type {CaretRecovery, RawRange} from '../../shared/editorContracts'
import {signal, computed, event, batch, watch} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {ControlledEcho} from './ControlledEcho'

export class ValueFeature {
	readonly current = signal('')
	readonly isControlledMode = computed(() => this._store.props.value() !== undefined)
	readonly change = event()

	readonly #controlledEcho = new ControlledEcho()

	constructor(private readonly _store: Store) {
		_store.lifecycle.onMounted(() => {
			this.#commitAccepted(_store.props.value() ?? _store.props.defaultValue() ?? '')
			watch(_store.props.value, value => {
				if (value === undefined) return
				if (value === this.current()) return
				const recovery = this.#controlledEcho.onEcho(value)
				this.#commitAccepted(value)
				if (recovery) _store.caret.recovery(recovery)
				this.change()
			})
		})
	}
```

Leave the rest of the file (lines 35 onwards: `replaceRange`, `replaceAll`, `#commitCandidate`, `#commitAccepted`) unchanged.

- [ ] **Step 2: Run feature tests**

```bash
pnpm -w exec vitest run packages/core/src/features/value/
```

Expected: all tests pass (no spec changes needed; existing tests cover initialization, controlled-mode echo, replaceRange, replaceAll).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/value/ValueFeature.ts
git commit -m "refactor(value): use lifecycle.onMounted helper"
```

---

### Task 3: Migrate `DomFeature`

**Files:**
- Modify: `packages/core/src/features/dom/DomFeature.ts:138-160`

- [ ] **Step 1: Drop `#scope` field and replace mount/unmount handlers**

In `packages/core/src/features/dom/DomFeature.ts`:

Remove the `#scope?: () => void` field (line 138).

Replace the constructor body (lines 140–160) with:

```ts
	constructor(private readonly _store: Store) {
		_store.lifecycle.onMounted(() => {
			watch(_store.lifecycle.rendered, () => {
				this.#handleRendered()
			})
			watch(
				computed(() => ({
					readOnly: _store.props.readOnly(),
					selecting: _store.caret.selecting(),
				})),
				() => this.reconcile()
			)
		})
	}
```

Also remove `effectScope` from the imports at the top of the file (it is no longer used here).

- [ ] **Step 2: Run feature tests**

```bash
pnpm -w exec vitest run packages/core/src/features/dom/
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/dom/DomFeature.ts
git commit -m "refactor(dom): use lifecycle.onMounted helper"
```

---

### Task 4: Drop `effectScope` wrappers in `enable*` helpers

The five `enable*` helpers each wrap their `listen()` calls in their own `effectScope` and return a disposer. After the `KeyboardFeature` / `CaretFeature` migrations (Tasks 5–6), they will run inside the parent scope created by `onMounted`. Convert them now so the call sites become trivial.

**Files:**
- Modify: `packages/core/src/features/caret/focus.ts`
- Modify: `packages/core/src/features/caret/selection.ts`
- Modify: `packages/core/src/features/keyboard/arrowNav.ts`
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`
- Modify: `packages/core/src/features/keyboard/input.ts`

- [ ] **Step 1: Convert `enableFocus`**

Replace `packages/core/src/features/caret/focus.ts` with:

```ts
import {firstHtmlChild, isHtmlElement} from '../../shared/checkers'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export function enableFocus(store: Store): void {
	const container = store.dom.container()
	if (!container) return

	listen(container, 'focusin', e => {
		const target = isHtmlElement(e.target) ? e.target : undefined
		if (!target) {
			store.caret.location(undefined)
			return
		}
		const result = store.dom.locateNode(target)
		if (!result.ok) {
			if (result.reason === 'control') return
			store.caret.location(undefined)
			return
		}

		const role = result.value.textElement?.contains(target) ? 'text' : 'markDescendant'
		store.caret.location({address: result.value.address, role})
	})

	listen(container, 'focusout', () => {
		store.caret.location(undefined)
	})

	listen(container, 'click', () => {
		const tokens = store.parsing.tokens()
		if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
			const container = store.dom.container()
			const element = container ? firstHtmlChild(container) : null
			element?.focus()
		}
	})
}
```

- [ ] **Step 2: Convert `enableSelection`**

`enableSelection` currently has manual cleanup that resets `store.caret.selecting('drag')` on unmount. Preserve that by registering an `effect()` whose cleanup runs when the parent scope disposes. The local `pressedNode` / `isPressed` closure variables are now per-mount (each `onMounted` re-run creates fresh ones), so they no longer need explicit reset.

Replace `packages/core/src/features/caret/selection.ts` with:

```ts
import {nodeTarget} from '../../shared/checkers'
import {effect, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export function enableSelection(store: Store): void {
	let pressedNode: Node | null = null
	let isPressed = false

	listen(document, 'mousedown', e => {
		pressedNode = nodeTarget(e)
		isPressed = true
	})

	listen(document, 'mousemove', e => {
		const container = store.dom.container()
		if (!container) return
		const currentIsPressed = isPressed
		const isNotInnerSome = !container.contains(pressedNode) || pressedNode !== e.target
		const isInside = window.getSelection()?.containsNode(container, true)

		if (currentIsPressed && isNotInnerSome && isInside) {
			if (store.caret.selecting() !== 'drag') {
				store.caret.selecting('drag')
			}
		}
	})

	listen(document, 'mouseup', () => {
		isPressed = false
		pressedNode = null
		if (store.caret.selecting() === 'drag') {
			const sel = window.getSelection()
			if (!sel || sel.isCollapsed) {
				store.caret.selecting(undefined)
			}
		}
	})

	listen(document, 'selectionchange', () => {
		const sel = window.getSelection()
		if (store.caret.selecting() === 'drag' && (!sel || sel.isCollapsed)) {
			store.caret.selecting(undefined)
		}
		if (!sel?.focusNode) return

		const result = store.dom.locateNode(sel.focusNode)
		if (!result.ok) {
			if (result.reason === 'control') return
			store.caret.location(undefined)
			return
		}

		const role = result.value.textElement?.contains(sel.focusNode) ? 'text' : 'markDescendant'
		store.caret.location({address: result.value.address, role})
	})

	effect(() => {
		const value = store.caret.selecting()
		if (value === 'drag') store.dom.reconcile()
	})

	// Reset drag-selecting state when this scope tears down (unmount).
	effect(() => () => {
		if (store.caret.selecting() === 'drag') {
			store.caret.selecting(undefined)
		}
	})
}
```

- [ ] **Step 3: Convert `enableArrowNav`**

In `packages/core/src/features/keyboard/arrowNav.ts`, replace the imports and the `enableArrowNav` function (lines 1–24). Keep `shiftFocus` unchanged.

```ts
import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {selectAllText} from '../caret'

export function enableArrowNav(store: Store): void {
	const container = store.dom.container()
	if (!container) return

	listen(container, 'keydown', e => {
		if (store.slots.isBlock()) return

		if (e.key === KEYBOARD.LEFT) {
			shiftFocus(store, e, 'prev')
		} else if (e.key === KEYBOARD.RIGHT) {
			shiftFocus(store, e, 'next')
		}

		selectAllText(store, e)
	})
}
```

- [ ] **Step 4: Convert `enableBlockEdit`**

In `packages/core/src/features/keyboard/blockEdit.ts`, replace lines 1–54 (imports and the `enableBlockEdit` function). Keep everything below `enableBlockEdit` unchanged.

```ts
import {htmlChildren, isHtmlElement} from '../../shared/checkers'
import {KEYBOARD} from '../../shared/constants'
import type {BoundaryPositionResult, RawRange, RawSelectionResult} from '../../shared/editorContracts'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {Caret} from '../caret'
import {consumeMarkupPaste} from '../clipboard'
import {addDragRow, getMergeDragRowJoinPos, mergeDragRows, canMergeRows} from '../drag/operations'
import {createRowContent} from '../editing'
import type {Token} from '../parsing'

type InputTargetRange = {
	readonly startContainer: Node
	readonly startOffset: number
	readonly endContainer: Node
	readonly endOffset: number
}

type RawSelectionFailureReason = Extract<RawSelectionResult, {ok: false}>['reason']

function isTextLikeRow(token: Token): boolean {
	if (token.type === 'text') return true
	return token.descriptor.hasSlot && token.descriptor.segments.length === 1
}

export function enableBlockEdit(store: Store): void {
	const container = store.dom.container()
	if (!container) return

	listen(container, 'keydown', e => {
		if (!store.slots.isBlock()) return

		if (e.key === KEYBOARD.LEFT || e.key === KEYBOARD.RIGHT) {
			handleBlockArrowLeftRight(store, e, e.key === KEYBOARD.LEFT ? 'left' : 'right')
		} else if (e.key === KEYBOARD.UP || e.key === KEYBOARD.DOWN) {
			handleArrowUpDown(store, e)
		}

		handleDelete(store, e)
		handleEnter(store, e)
	})

	listen(
		container,
		'beforeinput',
		e => {
			if (!store.slots.isBlock()) return
			if (e.defaultPrevented) return
			handleBlockBeforeInput(store, e)
		},
		true
	)
}
```

- [ ] **Step 5: Convert `enableInput`**

In `packages/core/src/features/keyboard/input.ts`, replace the imports and the `enableInput` function (lines 1–69). Keep everything below `enableInput` unchanged.

```ts
import {KEYBOARD} from '../../shared/constants'
import type {BoundaryPositionResult, RawRange, RawSelectionResult} from '../../shared/editorContracts'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {isFullSelection} from '../caret'
import {captureMarkupPaste, consumeMarkupPaste} from '../clipboard'
import type {Token} from '../parsing'

type InputTargetRange = {
	readonly startContainer: Node
	readonly startOffset: number
	readonly endContainer: Node
	readonly endOffset: number
}

type SpanInputTarget = {
	content: string
	caret: number
}

type RawSelectionFailureReason = Extract<RawSelectionResult, {ok: false}>['reason']

export function enableInput(store: Store): void {
	const container = store.dom.container()
	if (!container) return
	let compositionRange: RawRange | undefined

	listen(container, 'paste', e => {
		const c = store.dom.container()
		if (c) captureMarkupPaste(e, c)
		handlePaste(store, e)
	})

	listen(container, 'compositionstart', () => {
		const selection = store.dom.readRawSelection()
		compositionRange = selection.ok ? selection.value.range : undefined
		store.dom.compositionStarted()
	})

	listen(container, 'compositionend', e => {
		const range = compositionRange
		compositionRange = undefined
		store.dom.compositionEnded()
		if (store.slots.isBlock()) return
		if (!range) return
		const data = e.data
		store.value.replaceRange(range, data, {
			recover: {kind: 'caret', rawPosition: range.start + data.length},
		})
	})

	listen(
		container,
		'beforeinput',
		e => {
			handleBeforeInput(store, e)
		},
		true
	)

	listen(container, 'keydown', e => {
		handleDeleteKey(store, e)
	})
}
```

- [ ] **Step 6: Run typecheck and feature tests**

The `enable*` callers (`KeyboardFeature`, `CaretFeature`) still expect a `() => void` return value at this point. We will fix them in the next two tasks. Skip running the full test suite here; just verify typecheck reports the expected mismatches.

```bash
pnpm run typecheck
```

Expected: type errors at the call sites in `KeyboardFeature.ts` and `CaretFeature.ts` complaining that `void` is not callable. These will be fixed in Tasks 5 and 6.

- [ ] **Step 7: Do not commit yet** — leave these changes staged for a combined commit with Tasks 5 and 6 to keep `main` green at every commit boundary.

```bash
git add packages/core/src/features/caret/focus.ts \
        packages/core/src/features/caret/selection.ts \
        packages/core/src/features/keyboard/arrowNav.ts \
        packages/core/src/features/keyboard/blockEdit.ts \
        packages/core/src/features/keyboard/input.ts
```

---

### Task 5: Migrate `KeyboardFeature`

**Files:**
- Modify: `packages/core/src/features/keyboard/KeyboardFeature.ts`

- [ ] **Step 1: Replace the whole file**

Replace `packages/core/src/features/keyboard/KeyboardFeature.ts` with:

```ts
import type {Store} from '../../store/Store'
import {enableArrowNav} from './arrowNav'
import {enableBlockEdit} from './blockEdit'
import {enableInput} from './input'

export class KeyboardFeature {
	constructor(store: Store) {
		store.lifecycle.onMounted(() => {
			enableInput(store)
			enableBlockEdit(store)
			enableArrowNav(store)
		})
	}
}
```

- [ ] **Step 2: Stage the change**

```bash
git add packages/core/src/features/keyboard/KeyboardFeature.ts
```

---

### Task 6: Migrate `CaretFeature`

**Files:**
- Modify: `packages/core/src/features/caret/CaretFeature.ts:7-23`

- [ ] **Step 1: Drop `#disposers` and use `onMounted`**

Replace the class body up to (and including) the constructor in `packages/core/src/features/caret/CaretFeature.ts`. Leave `placeAt` and `focus` methods untouched.

```ts
export class CaretFeature {
	readonly recovery = signal<CaretRecovery | undefined>(undefined)
	readonly location = signal<CaretLocation | undefined>(undefined)
	readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

	constructor(private readonly _store: Store) {
		_store.lifecycle.onMounted(() => {
			enableFocus(_store)
			enableSelection(_store)
		})
	}
```

Also remove the unused `watch` import if it is no longer referenced elsewhere in the file (it should not be).

- [ ] **Step 2: Run typecheck, then full test suite**

```bash
pnpm run typecheck
pnpm test
```

Expected: typecheck clean, all tests pass.

- [ ] **Step 3: Commit Tasks 4 + 5 + 6 together**

```bash
git add packages/core/src/features/caret/CaretFeature.ts
git commit -m "refactor(keyboard, caret): use lifecycle.onMounted; drop enable* effectScope"
```

---

### Task 7: Migrate `ClipboardFeature`

**Files:**
- Modify: `packages/core/src/features/clipboard/ClipboardFeature.ts:34-62`

- [ ] **Step 1: Replace constructor**

In `packages/core/src/features/clipboard/ClipboardFeature.ts`, drop the `#scope` field and replace the constructor with:

```ts
export class ClipboardFeature {
	constructor(private readonly store: Store) {
		store.lifecycle.onMounted(() => {
			// The container must be registered before mounted() fires (adapter
			// calls dom.container() in its ref/onMounted, then lifecycle.mounted).
			const container = store.dom.container()
			if (!container) return

			listen(container, 'copy', e => {
				this.#handleCopy(e)
			})
			listen(container, 'cut', e => {
				if (!this.#handleCopy(e)) return
				const raw = store.dom.readRawSelection()
				if (!raw.ok || raw.value.range.start === raw.value.range.end) return
				store.value.replaceRange(raw.value.range, '', {
					recover: {kind: 'caret', rawPosition: raw.value.range.start},
				})
			})
		})
	}
```

Also remove `effectScope` and `watch` from the imports at the top of the file (only `listen` is still needed from the signals module).

- [ ] **Step 2: Run feature tests**

```bash
pnpm -w exec vitest run packages/core/src/features/clipboard/
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/clipboard/ClipboardFeature.ts
git commit -m "refactor(clipboard): use lifecycle.onMounted helper"
```

---

### Task 8: Verify and clean up

- [ ] **Step 1: Confirm no stray `#scope` / `#disposers` lifecycle patterns remain in the migrated features**

```bash
rg -n "lifecycle\.mounted|lifecycle\.unmounted" packages/core/src/features --type ts -g '!*.spec.ts'
```

Expected output (hits only — no other lifecycle features should subscribe directly):

```
packages/core/src/features/lifecycle/LifecycleFeature.ts: ... mounted ...
packages/core/src/features/lifecycle/LifecycleFeature.ts: ... unmounted ...
```

If `ValueFeature`, `DomFeature`, `KeyboardFeature`, `CaretFeature`, or `ClipboardFeature` still appears in the output, revisit the corresponding task.

`OverlayFeature` and `ParsingFeature` are intentionally not in this refactor — they do not use lifecycle events.

- [ ] **Step 2: Run all checks**

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
```

Expected: all green.

- [ ] **Step 3: Delete the superseded plan**

```bash
git rm docs/superpowers/plans/2026-05-06-remove-value-unmount-disposal.md
git commit -m "docs(plans): remove superseded value-unmount-disposal plan"
```

---

## Notes

- **Behavior preserved:** Each migrated feature still re-initializes on every mount (same as the original `#scope = undefined` reset). The `effectScope` inside `onMounted` is created fresh each time `mounted` fires after a prior `unmounted`.
- **`enableSelection` cleanup nuance:** The original `enableSelection` resetting `store.caret.selecting('drag')` on unmount is preserved via an `effect(() => () => { ... })` whose cleanup runs when the parent scope disposes. The `pressedNode` / `isPressed` closure variables become per-mount and need no manual reset.
- **No new tests required for migrated features:** Existing specs already cover their public behavior. The only new tests are for `lifecycle.onMounted` itself (Task 1).
- **Out of scope:** `OverlayFeature` and `ParsingFeature` toggle their scope based on an arbitrary boolean signal (`hasOverlayTrigger`, `mark.enabled`), not lifecycle events. A separate refactor could introduce a `scopeWhile(condition, setup)` helper for them, but that is a different concern and not part of this plan.
