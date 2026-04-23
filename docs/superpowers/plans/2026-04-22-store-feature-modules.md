# Store Feature Modules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `state`, `computed`, and `emit` off the central `Store` maps into per-feature classes accessed as `store.feature.<name>.<category>.<field>`. `store.props` stays centralized. No behavioral change.

**Architecture:** Class-based feature slices (Approach B in the spec). Each feature class exposes its own public readonly `state` / `computed` / `emit` maps and its existing `enable()` / `disable()` lifecycle. Store aggregates them under `store.feature.*`. Migration shares signal/event references between the old central maps and the new feature slices so both access paths work simultaneously; legacy maps are deleted in the final task.

**Tech Stack:** TypeScript 5, `@markput/core` signals (`signal`, `computed`, `event`, `watch`, `batch`, `effect`, `effectScope`, `listen`), Vitest, pnpm workspaces, oxlint, oxfmt.

**Spec:** `docs/superpowers/specs/2026-04-22-store-feature-modules-design.md`

---

## Ownership Reference (from spec)

| `store.feature.*` | `state` | `computed` | `emit` |
|---|---|---|---|
| `lifecycle` | — | — | `mounted`, `unmounted`, `rendered` |
| `value` | `previousValue`, `innerValue` | `currentValue` | `change` |
| `parsing` | `tokens` | `parser` | `reparse` |
| `mark` | — | `hasMark`, `mark` | `markRemove` |
| `overlay` | `overlayMatch`, `overlay` *(DOM ref)* | `overlay` *(computed)* | `overlaySelect`, `overlayClose` |
| `slots` | `container` *(DOM ref)* | `isBlock`, `isDraggable`, `containerComponent`, `containerProps`, `blockComponent`, `blockProps`, `spanComponent`, `spanProps` | — |
| `drag` | — | — | `drag` |
| `clipboard` | — | — | — |
| `keyboard` | — | — | — |
| `caret` | `recovery`, `selecting` | — | — |
| `dom` | — | — | `reconcile` |

**Stays on `Store` root:** `props`, `key`, `blocks`, `nodes`, `handler`, `feature`, `setProps()`.

**Migration mechanic:** Each task constructs the feature's state/computed/event objects, then passes the SAME signal instances into the legacy `store.state` / `store.computed` / `store.emit` maps so both call paths resolve to the same reactive primitive. Call sites are migrated to `store.feature.<name>.<category>.<field>` inside the same task. Legacy maps are deleted in Task 13 after every call site points at the new location.

**Refactor convention in this plan:** Several tasks instruct the engineer to "COPY the body of `<existing method>`" into a new class with listed path substitutions. This is intentional, not a placeholder — the logic is being relocated verbatim and re-running the thinking risks behavioral drift. The referenced file + method + substitution list is the canonical source; the plan quotes structure but does not re-paste long bodies to avoid stale duplication. When a step says "COPY from X", open X, copy the body, apply the listed substitutions, and commit only after tests pass.

---

## Pre-migration File Map

**Current `packages/core/src/features/`:**

| Folder | Has `*Feature.ts`? | Target feature after refactor |
|---|---|---|
| `arrownav/` | `ArrowNavFeature.ts` | merged into `keyboard/` (as `arrowNav.ts` module) |
| `block-editing/` | `BlockEditFeature.ts` | merged into `keyboard/` (as `blockEdit.ts` module) |
| `caret/` | (helpers only) | unchanged, still holds `TriggerFinder`, `Caret` |
| `clipboard/` | `CopyFeature.ts` | renamed `ClipboardFeature.ts` |
| `drag/` | `DragFeature.ts` | stays; owns `emit.drag` |
| `editable/` | `ContentEditableFeature.ts` | **renamed folder to `dom/`**, class `DomFeature` |
| `editing/` | (utils only) | unchanged, still holds `deleteMark`, etc. |
| `events/` | `SystemListenerFeature.ts` | **deleted**; watchers redistribute to `value`, `mark`, `overlay` |
| `focus/` | `FocusFeature.ts` | merged into `caret/` |
| `input/` | `InputFeature.ts` | merged into `keyboard/` (as `input.ts` module) |
| `lifecycle/` | (README only) | gains `LifecycleFeature.ts` |
| `mark/` | `MarkHandler.ts` | gains `MarkFeature.ts` |
| `navigation/` | (helpers only) | unchanged |
| `overlay/` | `OverlayFeature.ts` | stays; gains owned state/computed/emit |
| `parsing/` | `ParseFeature.ts` | **renamed class to `ParsingFeature`** |
| `selection/` | `TextSelectionFeature.ts` | merged into `caret/` |
| `slots/` | (helpers only) | gains `SlotsFeature.ts` |

**New folders created:**

- `packages/core/src/features/lifecycle/LifecycleFeature.ts`
- `packages/core/src/features/value/` (new folder, new file `ValueFeature.ts`)
- `packages/core/src/features/slots/SlotsFeature.ts`
- `packages/core/src/features/mark/MarkFeature.ts`
- `packages/core/src/features/keyboard/` (new folder — receives merge of input + block-editing + arrownav)
- `packages/core/src/features/dom/` (renamed from `editable/`)
- `packages/core/src/features/caret/CaretFeature.ts` (new file in existing folder)

**Folders deleted at end of migration:**

- `packages/core/src/features/arrownav/` (contents merged into `keyboard/`)
- `packages/core/src/features/block-editing/` (contents merged into `keyboard/`)
- `packages/core/src/features/input/` (contents merged into `keyboard/`)
- `packages/core/src/features/editable/` (renamed to `dom/`)
- `packages/core/src/features/events/` (SystemListener dissolved)
- `packages/core/src/features/focus/` (merged into `caret/`)
- `packages/core/src/features/selection/` (merged into `caret/`)

---

## Baseline Verification (before starting)

- [ ] **Step 0.1: Confirm clean working tree**

Run: `git status`
Expected: clean (no uncommitted changes).

- [ ] **Step 0.2: Confirm baseline green**

Run: `pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`
Expected: all pass. If anything fails on `next`, resolve first — the migration relies on a green baseline as regression anchor.

- [ ] **Step 0.3: Create feature branch**

```bash
git checkout -b refactor/store-feature-modules
```

---

## Task 1: LifecycleFeature

**Files:**
- Create: `packages/core/src/features/lifecycle/LifecycleFeature.ts`
- Create: `packages/core/src/features/lifecycle/index.ts`
- Create: `packages/core/src/features/lifecycle/LifecycleFeature.spec.ts`
- Modify: `packages/core/src/store/Store.ts`
- Modify: `packages/core/src/features/lifecycle/README.md`
- Modify: every call site reading `store.emit.mounted`, `store.emit.unmounted`, `store.emit.rendered` (enumerated in Step 1.4 below)

- [ ] **Step 1.1: Create `LifecycleFeature`**

`packages/core/src/features/lifecycle/LifecycleFeature.ts`:

```ts
import {event} from '../../shared/signals'
import type {Store} from '../../store/Store'

export class LifecycleFeature {
	readonly state = {} as const
	readonly computed = {} as const
	readonly emit = {
		mounted: event(),
		unmounted: event(),
		rendered: event(),
	}

	constructor(private readonly _store: Store) {}

	enable() {}
	disable() {}
}
```

`packages/core/src/features/lifecycle/index.ts`:

```ts
export {LifecycleFeature} from './LifecycleFeature'
```

- [ ] **Step 1.2: Add spec test for shape**

`packages/core/src/features/lifecycle/LifecycleFeature.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {Store} from '../../store/Store'

describe('LifecycleFeature', () => {
	it('should expose mounted, unmounted, rendered events', () => {
		const store = new Store()
		expect(typeof store.feature.lifecycle.emit.mounted).toBe('function')
		expect(typeof store.feature.lifecycle.emit.unmounted).toBe('function')
		expect(typeof store.feature.lifecycle.emit.rendered).toBe('function')
	})

	it('should emit the same event instance that store.emit does during migration', () => {
		const store = new Store()
		expect(store.feature.lifecycle.emit.mounted).toBe(store.emit.mounted)
		expect(store.feature.lifecycle.emit.unmounted).toBe(store.emit.unmounted)
		expect(store.feature.lifecycle.emit.rendered).toBe(store.emit.rendered)
	})
})
```

- [ ] **Step 1.3: Update `Store.ts`**

Modify `packages/core/src/store/Store.ts`:

1. Import the feature: add `import {LifecycleFeature} from '../features/lifecycle'`
2. Remove `mounted`, `unmounted`, `rendered` from the `emit` object literal.
3. Reshape the constructor so features are instantiated BEFORE the legacy `emit` map, and the legacy map reads events from the feature:

```ts
export class Store {
	readonly key = new KeyGenerator()
	readonly blocks = new BlockRegistry()
	readonly nodes = {
		focus: new NodeProxy(undefined, this),
		input: new NodeProxy(undefined, this),
	}
	readonly props = { /* ... unchanged ... */ }
	readonly state = { /* ... unchanged ... */ }
	readonly computed: { /* ... unchanged ... */ } = { /* ... unchanged ... */ }

	// Features must be constructed before `emit` so legacy map can alias from them.
	readonly feature: {
		lifecycle: LifecycleFeature
		overlay: OverlayFeature
		focus: FocusFeature
		input: InputFeature
		blockEditing: BlockEditFeature
		arrowNav: ArrowNavFeature
		system: SystemListenerFeature
		textSelection: TextSelectionFeature
		contentEditable: ContentEditableFeature
		drag: DragFeature
		copy: CopyFeature
		parse: ParseFeature
	}

	readonly emit: {
		change: Event<void>
		reparse: Event<void>
		markRemove: Event<{token: Token}>
		overlaySelect: Event<{mark: Token; match: OverlayMatch}>
		overlayClose: Event<void>
		sync: Event<void>
		drag: Event<DragAction>
		rendered: Event<void>
		mounted: Event<void>
		unmounted: Event<void>
	}

	readonly handler = new MarkputHandler(this)

	constructor() {
		const lifecycle = new LifecycleFeature(this)

		this.feature = {
			lifecycle,
			overlay: new OverlayFeature(this),
			focus: new FocusFeature(this),
			input: new InputFeature(this),
			blockEditing: new BlockEditFeature(this),
			arrowNav: new ArrowNavFeature(this),
			system: new SystemListenerFeature(this),
			textSelection: new TextSelectionFeature(this),
			contentEditable: new ContentEditableFeature(this),
			drag: new DragFeature(this),
			copy: new CopyFeature(this),
			parse: new ParseFeature(this),
		}

		this.emit = {
			change: event(),
			reparse: event(),
			markRemove: event<{token: Token}>(),
			overlaySelect: event<{mark: Token; match: OverlayMatch}>(),
			overlayClose: event(),
			sync: event(),
			drag: event<DragAction>(),
			// Aliases from lifecycle feature:
			rendered: lifecycle.emit.rendered,
			mounted: lifecycle.emit.mounted,
			unmounted: lifecycle.emit.unmounted,
		}

		watch(this.emit.mounted, () => Object.values(this.feature).forEach(f => f.enable()))
		watch(this.emit.unmounted, () => Object.values(this.feature).forEach(f => f.disable()))
	}

	setProps(values: Partial<SignalValues<typeof this.props>>): void { /* ... unchanged ... */ }
}
```

Key changes:
- `feature` and `emit` become non-initialized fields; the constructor populates them in the correct order.
- `lifecycle` is constructed first; its three events are aliased into `this.emit`.
- The rest of `this.emit` still creates its own instances (they move into their features in later tasks).

- [ ] **Step 1.4: Migrate call sites to `store.feature.lifecycle.emit.*`**

Update these files to replace `store.emit.mounted` → `store.feature.lifecycle.emit.mounted`, same for `unmounted` and `rendered`:

- `packages/core/src/features/focus/FocusFeature.ts` — line reading `this.store.emit.rendered` inside `enable()` effectScope
- `packages/react/markput/src/components/MarkedInput.tsx` — `mounted`/`unmounted` calls
- `packages/react/markput/src/components/Container.tsx` — `emit.rendered()` in `useLayoutEffect`
- `packages/vue/markput/src/components/MarkedInput/MarkedInput.vue` — `mounted`/`unmounted`
- `packages/vue/markput/src/components/Container/Container.vue` — `rendered()`
- Any `*.spec.ts` that references `store.emit.mounted|unmounted|rendered` (use `rg 'store\.emit\.(mounted|unmounted|rendered)' packages -l` to list)

Use ripgrep to enumerate exactly:

```bash
rg -l 'store\.emit\.(mounted|unmounted|rendered)' packages
```

Rewrite each occurrence. Because the legacy `store.emit.mounted` is aliased to the same event instance, tests pass whether you finish this step in one file or stretch across several — but DO finish before the commit.

- [ ] **Step 1.5: Run tests + typecheck + lint**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check
```

Expected: PASS. If failures reference the three events, the alias wiring in `Store.ts` is wrong — verify `this.emit.mounted` and `this.feature.lifecycle.emit.mounted` point to the same instance.

- [ ] **Step 1.6: Update `packages/core/src/features/lifecycle/README.md`**

Replace contents with:

```markdown
# Lifecycle Feature

Owns the three framework→core lifecycle events:

| Event | Fired by | Listened by |
|---|---|---|
| `mounted` | Framework adapter on initial mount | `Store` constructor (calls `enable()` on every feature) |
| `unmounted` | Framework adapter on unmount | `Store` constructor (calls `disable()` on every feature) |
| `rendered` | Framework `Container` component via `useLayoutEffect` | `CaretFeature` (post-render caret work), `DomFeature` (via `reconcile`) |

Access: `store.feature.lifecycle.emit.{mounted,unmounted,rendered}`.

The feature has no reactive state or computed values — it is a pure event carrier.
```

- [ ] **Step 1.7: Commit**

```bash
git add packages/core/src/features/lifecycle/ packages/core/src/store/Store.ts packages/core/src/features/focus/ packages/react packages/vue
git commit -m "refactor(core): extract LifecycleFeature owning mounted/unmounted/rendered"
```

Run `pnpm test` again post-hook to verify the lint-staged auto-fix didn't break anything. If it did, amend.

---

## Task 2: ValueFeature

**Files:**
- Create: `packages/core/src/features/value/ValueFeature.ts`
- Create: `packages/core/src/features/value/index.ts`
- Create: `packages/core/src/features/value/ValueFeature.spec.ts`
- Create: `packages/core/src/features/value/README.md`
- Modify: `packages/core/src/store/Store.ts`
- Modify: `packages/core/src/features/events/SystemListenerFeature.ts` (remove `change` + `innerValue` watchers — they move to ValueFeature)
- Modify: call sites reading `store.state.previousValue`, `store.state.innerValue`, `store.computed.currentValue`, `store.emit.change`

- [ ] **Step 2.1: Create `ValueFeature`**

`packages/core/src/features/value/ValueFeature.ts`:

```ts
import {signal, computed, event, effectScope, watch} from '../../shared/signals'
import type {Token} from '../parsing'
import {computeTokensFromValue} from '../parsing/utils/valueParser'
import {findToken} from '../parsing/utils/findToken'
import {toString} from '../parsing/parser/utils/toString'
import type {Store} from '../../store/Store'

export class ValueFeature {
	readonly state = {
		previousValue: signal<string | undefined>(undefined),
		innerValue: signal<string | undefined>(undefined),
	}

	readonly computed = {
		currentValue: computed(
			() => this.state.previousValue() ?? this._store.props.value() ?? ''
		),
	}

	readonly emit = {
		change: event(),
	}

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			watch(this.emit.change, () => {
				const target = this._store.nodes.focus.target
				if (!target) return
				const tokens = this._store.feature.parsing.state.tokens()
				const focused = tokens.find(t => t.position.start <= target.caret && t.position.end >= target.caret)
				// NOTE: re-parse and previousValue update logic previously in SystemListenerFeature.
				// (Full reimplementation copied verbatim from SystemListenerFeature.spec-covered behavior — see original file.)
				// IMPORTANT: the implementer MUST copy the exact handler body from
				// packages/core/src/features/events/SystemListenerFeature.ts `watch(this.store.emit.change, ...)`
				// block, adjusted for: `this.store.state.tokens` → `this._store.feature.parsing.state.tokens`,
				//                       `this.store.state.previousValue` → `this.state.previousValue`,
				//                       `this.store.state.innerValue` → `this.state.innerValue`,
				//                       `this.store.emit.reparse` → `this._store.feature.parsing.emit.reparse` (after Task 3; for now use `this._store.emit.reparse`).
			})

			watch(this.state.innerValue, nextValue => {
				if (nextValue === undefined) return
				// COPY BODY FROM SystemListenerFeature `watch(this.store.state.innerValue, ...)` block,
				// same path substitutions as above.
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}
```

**Implementation note for the engineer:** The two `watch` bodies above are placeholders showing WHERE the logic goes. The actual bodies come from `packages/core/src/features/events/SystemListenerFeature.ts`. Open that file and copy the `change` watcher body (reads DOM from `this.store.nodes.focus.target`, tokenizes, writes `previousValue`, fires `reparse`) and the `innerValue` watcher body (calls `computeTokensFromValue`, writes `tokens` + `previousValue`). Only the store-path references change.

- [ ] **Step 2.2: Create `value/index.ts`**

```ts
export {ValueFeature} from './ValueFeature'
```

- [ ] **Step 2.3: Write shape spec**

`packages/core/src/features/value/ValueFeature.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {Store} from '../../store/Store'

describe('ValueFeature', () => {
	it('exposes previousValue, innerValue signals', () => {
		const store = new Store()
		expect(typeof store.feature.value.state.previousValue).toBe('function')
		expect(typeof store.feature.value.state.innerValue).toBe('function')
	})

	it('exposes currentValue computed defaulting to empty string', () => {
		const store = new Store()
		expect(store.feature.value.computed.currentValue()).toBe('')
	})

	it('currentValue falls back to props.value when previousValue is unset', () => {
		const store = new Store()
		store.setProps({value: 'hello'})
		expect(store.feature.value.computed.currentValue()).toBe('hello')
	})

	it('currentValue returns previousValue when set', () => {
		const store = new Store()
		store.setProps({value: 'hello'})
		store.feature.value.state.previousValue('world')
		expect(store.feature.value.computed.currentValue()).toBe('world')
	})

	it('aliases the same signal instances as the legacy store.state maps during migration', () => {
		const store = new Store()
		expect(store.feature.value.state.previousValue).toBe(store.state.previousValue)
		expect(store.feature.value.state.innerValue).toBe(store.state.innerValue)
		expect(store.feature.value.computed.currentValue).toBe(store.computed.currentValue)
		expect(store.feature.value.emit.change).toBe(store.emit.change)
	})
})
```

- [ ] **Step 2.4: Update `Store.ts` to alias from `ValueFeature`**

In `packages/core/src/store/Store.ts`:

1. Add `import {ValueFeature} from '../features/value'`.
2. Remove `previousValue` and `innerValue` from the inline `state` object literal — they become aliases.
3. Remove `currentValue` from the inline `computed` object.
4. Remove `change` from the inline `emit` object.
5. Reshape the constructor:

```ts
constructor() {
	const lifecycle = new LifecycleFeature(this)
	const value = new ValueFeature(this)

	// Temporarily keep the non-value state/computed/emit inline:
	this.state = {
		tokens: signal<Token[]>([]),
		previousValue: value.state.previousValue,    // alias
		innerValue: value.state.innerValue,          // alias
		recovery: signal<Recovery | undefined>(undefined),
		container: signal<HTMLDivElement | null>(null),
		overlay: signal<HTMLElement | null>(null),
		selecting: signal<'drag' | 'all' | undefined>(undefined),
		overlayMatch: signal<OverlayMatch | undefined>(undefined),
	}

	this.computed = {
		hasMark: computed(/* ... as before ... */),
		isBlock: computed(/* ... */),
		isDraggable: computed(/* ... */),
		parser: computed(/* ... */),
		currentValue: value.computed.currentValue,    // alias
		containerComponent: computed(/* ... */),
		containerProps: computed(/* ... */, {equals: shallow}),
		blockComponent: computed(/* ... */),
		blockProps: computed(/* ... */),
		spanComponent: computed(/* ... */),
		spanProps: computed(/* ... */),
		overlay: computed(/* ... */),
		mark: computed(/* ... */),
	}

	this.emit = {
		change: value.emit.change,                   // alias
		reparse: event(),
		markRemove: event<{token: Token}>(),
		overlaySelect: event<{mark: Token; match: OverlayMatch}>(),
		overlayClose: event(),
		sync: event(),
		drag: event<DragAction>(),
		rendered: lifecycle.emit.rendered,
		mounted: lifecycle.emit.mounted,
		unmounted: lifecycle.emit.unmounted,
	}

	this.feature = {
		lifecycle,
		value,
		overlay: new OverlayFeature(this),
		focus: new FocusFeature(this),
		input: new InputFeature(this),
		blockEditing: new BlockEditFeature(this),
		arrowNav: new ArrowNavFeature(this),
		system: new SystemListenerFeature(this),
		textSelection: new TextSelectionFeature(this),
		contentEditable: new ContentEditableFeature(this),
		drag: new DragFeature(this),
		copy: new CopyFeature(this),
		parse: new ParseFeature(this),
	}

	watch(this.emit.mounted, () => Object.values(this.feature).forEach(f => f.enable()))
	watch(this.emit.unmounted, () => Object.values(this.feature).forEach(f => f.disable()))
}
```

- [ ] **Step 2.5: Delete migrated watchers from `SystemListenerFeature`**

Open `packages/core/src/features/events/SystemListenerFeature.ts`. Remove the two `watch` blocks: `watch(this.store.emit.change, ...)` and `watch(this.store.state.innerValue, ...)`. Leave the `markRemove` and `overlaySelect` watchers intact — they migrate in later tasks.

- [ ] **Step 2.6: Run the test suite**

```bash
pnpm test
```

Expected: PASS. `SystemListenerFeature.spec.ts` tests for change/innerValue behavior should now be passing against `ValueFeature.enable()` instead (they drive `store.emit.change` and assert on `store.state.previousValue` / `store.state.tokens` — aliases mean the tests see the same signals). If they fail, diff the handler bodies between old SystemListener and new ValueFeature.

- [ ] **Step 2.7: Migrate call sites**

Use `rg` to enumerate:

```bash
rg -l 'store\.state\.(previousValue|innerValue)|store\.computed\.currentValue|store\.emit\.change' packages
```

Rewrite each:

- `store.state.previousValue` → `store.feature.value.state.previousValue`
- `store.state.innerValue` → `store.feature.value.state.innerValue`
- `store.computed.currentValue` → `store.feature.value.computed.currentValue`
- `store.emit.change` → `store.feature.value.emit.change`

Both paths resolve to the same instance, so tests pass throughout.

- [ ] **Step 2.8: Write README**

`packages/core/src/features/value/README.md`:

```markdown
# Value Feature

Owns the editable-value buffer and its primary mutation event.

## State

| Signal | Purpose |
|---|---|
| `previousValue` | Last serialized value pushed to `onChange`. Used to suppress redundant emissions and to seed the next parse. |
| `innerValue` | Intermediate value used by uncontrolled flows (drag reorder, clipboard cut, mark remove). Written by many features; watched by this feature to reparse. |

## Computed

| Value | Formula |
|---|---|
| `currentValue` | `previousValue() ?? props.value() ?? ''` — the editable string view used by paste, block edit, copy/cut. |

## Events

| Event | Fired by | Listened by |
|---|---|---|
| `change` | `KeyboardFeature` internals, `MarkHandler`, `deleteMark` (multi-emitter, semantic "value mutated") | `ValueFeature` itself (reads DOM, writes `previousValue`, fires `reparse`) |

## Effects (`enable()`)

- Watch `emit.change` → read `nodes.focus.target`, tokenize focused span, write `previousValue`, emit `feature.parsing.emit.reparse`.
- Watch `state.innerValue` → reparse via `computeTokensFromValue`, write `tokens` + `previousValue`.

Both handlers were moved here from `SystemListenerFeature`.
```

- [ ] **Step 2.9: Commit**

```bash
git add -A
git commit -m "refactor(core): extract ValueFeature owning previousValue/innerValue/change/currentValue"
```

Run `pnpm test` post-commit to catch lint-staged damage.

---

## Task 3: ParsingFeature (rename `ParseFeature` + promote ownership)

**Files:**
- Rename: `packages/core/src/features/parsing/ParseFeature.ts` → keep filename, rename class inside to `ParsingFeature`
- Modify: `packages/core/src/features/parsing/index.ts` (export both old and new name during migration — see below)
- Create: `packages/core/src/features/parsing/ParsingFeature.spec.ts` (shape tests)
- Modify: `packages/core/src/features/parsing/ParseFeature.spec.ts` (rename describe, update references)
- Modify: `packages/core/src/store/Store.ts`

- [ ] **Step 3.1: Rename class and hoist ownership**

Rewrite `packages/core/src/features/parsing/ParseFeature.ts` (keep file name — rename comes only if Storybook/tests import by path; they don't today). New contents:

```ts
import {signal, computed, event, effectScope, effect, watch, batch} from '../../shared/signals'
import type {Computed} from '../../shared/signals'
import type {Store} from '../../store/Store'
import type {Token} from './types'
import {Parser} from './parser/Parser'
import {computeTokensFromValue} from './utils/valueParser'

export class ParsingFeature {
	readonly state = {
		tokens: signal<Token[]>([]),
	}

	readonly computed: {
		parser: Computed<Parser | undefined>
	} = {
		parser: computed(() => {
			// NOTE: `store.computed.hasMark` / `isBlock` are still the working paths at this
			// point in the migration. Task 4 rewrites hasMark → feature.mark.computed.hasMark;
			// Task 6 rewrites isBlock → feature.slots.computed.isBlock. Do NOT front-run those
			// references here — leave them as `this._store.computed.hasMark()` etc. so the
			// current shape aliases keep working during this task's commit.
			if (!this._store.computed.hasMark()) return
			const markups = this._store.props.options().map(opt => opt.markup)
			if (!markups.some(Boolean)) return
			return new Parser(markups, this._store.computed.isBlock() ? {skipEmptyText: true} : undefined)
		}),
	}

	readonly emit = {
		reparse: event(),
	}

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			// COPY the existing `ParseFeature.enable()` body verbatim.
			// Path substitutions (apply once across the copied block):
			//   this.store.state.tokens        → this.state.tokens
			//   this.store.computed.parser     → this.computed.parser
			//   this.store.emit.reparse        → this.emit.reparse
			//   this.store.state.previousValue → this._store.feature.value.state.previousValue
			//   All other `this.store.*`       → `this._store.*` (unchanged semantics).
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}
```

**Implementer note:** Open the current `packages/core/src/features/parsing/ParseFeature.ts` and copy its `enable()` body into the placeholder above. Perform the substitutions listed in the comment. Everything else (the `sync()` calls, the `watch(emit.reparse, ...)` wiring, the `watch(computed.parser, props.value, emit.reparse)` reactive bundle) stays structurally identical.

- [ ] **Step 3.2: Replace class alias in `parsing/index.ts`**

`packages/core/src/features/parsing/index.ts`:

```ts
export {ParsingFeature, ParsingFeature as ParseFeature} from './ParseFeature'
export type {Token} from './types'
export {Parser} from './parser/Parser'
```

The `as ParseFeature` alias keeps any unmigrated import working; it's removed in Task 13.

- [ ] **Step 3.3: Update `Store.ts` to alias**

In `packages/core/src/store/Store.ts`:

1. Replace `import {ParseFeature} from '../features/parsing/ParseFeature'` with `import {ParsingFeature} from '../features/parsing'`.
2. Replace `parse: new ParseFeature(this)` with `parsing: new ParsingFeature(this)` in the feature record. **Important:** the key renames from `parse` to `parsing` — update any call site using `store.feature.parse` (there shouldn't be any at this point, but `rg 'store\.feature\.parse\b' packages` to confirm).
3. Reshape `state.tokens` / `computed.parser` / `emit.reparse` as aliases:

```ts
const parsing = new ParsingFeature(this)
// ...
this.state = {
	tokens: parsing.state.tokens,   // alias
	previousValue: value.state.previousValue,
	innerValue: value.state.innerValue,
	recovery: signal<Recovery | undefined>(undefined),
	container: signal<HTMLDivElement | null>(null),
	overlay: signal<HTMLElement | null>(null),
	selecting: signal<'drag' | 'all' | undefined>(undefined),
	overlayMatch: signal<OverlayMatch | undefined>(undefined),
}
this.computed = {
	hasMark: /* unchanged */,
	isBlock: /* unchanged */,
	isDraggable: /* unchanged */,
	parser: parsing.computed.parser,   // alias
	currentValue: value.computed.currentValue,
	/* rest unchanged */
}
this.emit = {
	change: value.emit.change,
	reparse: parsing.emit.reparse,   // alias
	/* rest unchanged */
}
this.feature = {
	lifecycle,
	value,
	parsing,
	overlay: new OverlayFeature(this),
	/* ... */
}
```

- [ ] **Step 3.4: Add ParsingFeature shape test**

`packages/core/src/features/parsing/ParsingFeature.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {Store} from '../../store/Store'

describe('ParsingFeature', () => {
	it('exposes tokens signal', () => {
		const store = new Store()
		expect(Array.isArray(store.feature.parsing.state.tokens())).toBe(true)
	})

	it('aliases tokens, parser, reparse with legacy store maps', () => {
		const store = new Store()
		expect(store.feature.parsing.state.tokens).toBe(store.state.tokens)
		expect(store.feature.parsing.computed.parser).toBe(store.computed.parser)
		expect(store.feature.parsing.emit.reparse).toBe(store.emit.reparse)
	})
})
```

- [ ] **Step 3.5: Migrate call sites**

```bash
rg -l 'store\.state\.tokens|store\.computed\.parser|store\.emit\.reparse' packages
```

Rewrite:
- `store.state.tokens` → `store.feature.parsing.state.tokens`
- `store.computed.parser` → `store.feature.parsing.computed.parser`
- `store.emit.reparse` → `store.feature.parsing.emit.reparse`

- [ ] **Step 3.6: Run tests + commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check
git add -A
git commit -m "refactor(core): rename ParseFeature to ParsingFeature and hoist tokens/parser/reparse"
```

---

## Task 4: MarkFeature

**Files:**
- Create: `packages/core/src/features/mark/MarkFeature.ts`
- Create: `packages/core/src/features/mark/MarkFeature.spec.ts`
- Modify: `packages/core/src/features/mark/index.ts` (add export)
- Modify: `packages/core/src/features/mark/README.md`
- Modify: `packages/core/src/store/Store.ts`
- Modify: `packages/core/src/features/events/SystemListenerFeature.ts` (remove `markRemove` watcher)

- [ ] **Step 4.1: Create `MarkFeature`**

`packages/core/src/features/mark/MarkFeature.ts`:

```ts
import {computed, event, effectScope, watch} from '../../shared/signals'
import type {Computed} from '../../shared/signals'
import type {CoreOption} from '../../shared/types'
import {toString} from '../parsing/parser/utils/toString'
import {findToken} from '../parsing/utils/findToken'
import type {Token} from '../parsing'
import {resolveMarkSlot} from '../slots'
import type {MarkSlot} from '../slots'
import type {Store} from '../../store/Store'

export class MarkFeature {
	readonly state = {} as const

	readonly computed: {
		hasMark: Computed<boolean>
		mark: MarkSlot
	} = {
		hasMark: computed(() => {
			const Mark = this._store.props.Mark()
			if (Mark) return true
			return this._store.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
		}),
		mark: computed(() => {
			const options = this._store.props.options()
			const Mark = this._store.props.Mark()
			const Span = this._store.props.Span()
			return (token: Token) => resolveMarkSlot(token, options, Mark, Span)
		}),
	}

	readonly emit = {
		markRemove: event<{token: Token}>(),
	}

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			watch(this.emit.markRemove, payload => {
				const {token} = payload
				const tokens = this._store.feature.parsing.state.tokens()
				if (!findToken(tokens, token)) return
				const value = toString(tokens)
				const nextValue = value.slice(0, token.position.start) + value.slice(token.position.end)
				this._store.feature.value.state.innerValue(nextValue)
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}
```

**Implementer note:** The `markRemove` handler body is copied from `packages/core/src/features/events/SystemListenerFeature.ts` (`watch(this.store.emit.markRemove, ...)` block). Keep semantics identical.

- [ ] **Step 4.2: Update `mark/index.ts`**

Append to `packages/core/src/features/mark/index.ts`:

```ts
export {MarkFeature} from './MarkFeature'
```

- [ ] **Step 4.3: Shape spec**

`packages/core/src/features/mark/MarkFeature.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {Store} from '../../store/Store'

describe('MarkFeature', () => {
	it('hasMark is false when no Mark is configured', () => {
		const store = new Store()
		expect(store.feature.mark.computed.hasMark()).toBe(false)
	})

	it('hasMark is true when Mark prop is set', () => {
		const store = new Store()
		store.setProps({Mark: () => null})
		expect(store.feature.mark.computed.hasMark()).toBe(true)
	})

	it('aliases hasMark, mark, markRemove with legacy maps', () => {
		const store = new Store()
		expect(store.feature.mark.computed.hasMark).toBe(store.computed.hasMark)
		expect(store.feature.mark.computed.mark).toBe(store.computed.mark)
		expect(store.feature.mark.emit.markRemove).toBe(store.emit.markRemove)
	})
})
```

- [ ] **Step 4.4: Wire into Store**

In `packages/core/src/store/Store.ts`:
1. `import {MarkFeature} from '../features/mark'` (add to the existing mark import line or add new).
2. Construct `const mark = new MarkFeature(this)` in the constructor.
3. Alias:
	- `this.computed.hasMark = mark.computed.hasMark`
	- `this.computed.mark = mark.computed.mark`
	- `this.emit.markRemove = mark.emit.markRemove`
4. Add `mark` to the `feature` record.

- [ ] **Step 4.5: Remove `markRemove` watcher from SystemListener**

Delete the `watch(this.store.emit.markRemove, ...)` block from `packages/core/src/features/events/SystemListenerFeature.ts`.

- [ ] **Step 4.6: Migrate call sites**

```bash
rg -l 'store\.computed\.(hasMark|mark)|store\.emit\.markRemove' packages
```

Rewrite:
- `store.computed.hasMark` → `store.feature.mark.computed.hasMark`
- `store.computed.mark` → `store.feature.mark.computed.mark`
- `store.emit.markRemove` → `store.feature.mark.emit.markRemove`

Key spots: `MarkHandler.ts` (`#store.emit.markRemove(...)`), `ParseFeature.ts` (now `ParsingFeature.ts` — uses `hasMark`), React/Vue `Token` components (use `computed.mark`).

- [ ] **Step 4.7: Run tests + commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check
git add -A
git commit -m "refactor(core): extract MarkFeature owning hasMark/mark/markRemove and absorb markRemove watcher"
```

---

## Task 5: OverlayFeature v2 (promote ownership + absorb `overlaySelect` watcher)

**Files:**
- Modify: `packages/core/src/features/overlay/OverlayFeature.ts`
- Modify: `packages/core/src/features/overlay/OverlayFeature.spec.ts`
- Modify: `packages/core/src/store/Store.ts`
- Modify: `packages/core/src/features/events/SystemListenerFeature.ts` (remove `overlaySelect` watcher)

- [ ] **Step 5.1: Add state/computed/emit to `OverlayFeature`**

Open `packages/core/src/features/overlay/OverlayFeature.ts`. Add public members before the existing `#scope` field:

```ts
readonly state = {
	overlayMatch: signal<OverlayMatch | undefined>(undefined),
	overlay: signal<HTMLElement | null>(null),
}

readonly computed: {
	overlay: OverlaySlot
} = {
	overlay: computed(() => {
		const Overlay = this._store.props.Overlay()
		return (option?: CoreOption, defaultComponent?: Slot) =>
			resolveOverlaySlot(Overlay, option, defaultComponent)
	}),
}

readonly emit = {
	overlaySelect: event<{mark: Token; match: OverlayMatch}>(),
	overlayClose: event(),
}
```

Update imports at the top of the file (`signal`, `computed`, `event`, `resolveOverlaySlot`, `CoreOption`, `OverlayMatch`, `Slot`, `OverlaySlot`, `Token`).

Inside existing `enable()`:
- Replace `this.store.state.overlayMatch(match)` → `this.state.overlayMatch(match)`.
- Replace `this.store.state.overlay()` → `this.state.overlay()`.
- Replace `this.store.emit.overlayClose` → `this.emit.overlayClose`.
- Add a new `watch(this.emit.overlaySelect, ...)` block — copy the body from `SystemListenerFeature.ts` (`watch(this.store.emit.overlaySelect, ...)`). Path substitutions: `this.store.state.tokens` → `this._store.feature.parsing.state.tokens`, `this.store.state.innerValue` → `this._store.feature.value.state.innerValue`, `this.store.state.recovery` → `this._store.state.recovery` (still on root — moves in Task 10).

- [ ] **Step 5.2: Update Store wiring**

In `Store.ts`:
- `const overlay = new OverlayFeature(this)` goes before the feature record is populated.
- Alias:
	- `this.state.overlayMatch = overlay.state.overlayMatch`
	- `this.state.overlay = overlay.state.overlay`
	- `this.computed.overlay = overlay.computed.overlay`
	- `this.emit.overlaySelect = overlay.emit.overlaySelect`
	- `this.emit.overlayClose = overlay.emit.overlayClose`

- [ ] **Step 5.3: Remove `overlaySelect` watcher from SystemListener**

Delete the `watch(this.store.emit.overlaySelect, ...)` block from `packages/core/src/features/events/SystemListenerFeature.ts`.

- [ ] **Step 5.4: Update OverlayFeature shape spec**

Append to `packages/core/src/features/overlay/OverlayFeature.spec.ts`:

```ts
describe('OverlayFeature ownership', () => {
	it('owns overlayMatch, overlay (DOM ref), overlay (computed), overlaySelect, overlayClose', () => {
		const store = new Store()
		expect(store.feature.overlay.state.overlayMatch).toBe(store.state.overlayMatch)
		expect(store.feature.overlay.state.overlay).toBe(store.state.overlay)
		expect(store.feature.overlay.computed.overlay).toBe(store.computed.overlay)
		expect(store.feature.overlay.emit.overlaySelect).toBe(store.emit.overlaySelect)
		expect(store.feature.overlay.emit.overlayClose).toBe(store.emit.overlayClose)
	})
})
```

- [ ] **Step 5.5: Migrate call sites**

```bash
rg -l 'store\.state\.(overlayMatch|overlay\()|store\.computed\.overlay\b|store\.emit\.(overlaySelect|overlayClose)' packages
```

Rewrite with `store.feature.overlay.<category>.<field>`. Careful: `store.state.overlay()` (the DOM ref signal call) is distinct from `store.computed.overlay()` (the slot resolver) — grep both.

Framework adapter updates:
- `packages/react/markput/src/lib/hooks/useOverlay.tsx` — update `store.state.overlay(el)` etc.
- `packages/vue/markput/src/lib/hooks/useOverlay.ts` — same.

- [ ] **Step 5.6: Run tests + commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check
git add -A
git commit -m "refactor(core): OverlayFeature owns overlayMatch/overlay/overlaySelect/overlayClose; absorb overlaySelect watcher"
```

---

## Task 6: SlotsFeature

**Files:**
- Create: `packages/core/src/features/slots/SlotsFeature.ts`
- Create: `packages/core/src/features/slots/SlotsFeature.spec.ts`
- Modify: `packages/core/src/features/slots/index.ts`
- Modify: `packages/core/src/features/slots/README.md`
- Modify: `packages/core/src/store/Store.ts` (move `buildContainerProps` into SlotsFeature file)

- [ ] **Step 6.1: Create `SlotsFeature` with all computeds**

`packages/core/src/features/slots/SlotsFeature.ts`:

```ts
import {signal, computed} from '../../shared/signals'
import type {Computed} from '../../shared/signals'
import type {CSSProperties, CoreSlotProps, Slot} from '../../shared/types'
import {cx} from '../../shared/utils/cx'
import {merge} from '../../shared/utils/merge'
import {shallow} from '../../shared/utils/shallow'
import {resolveSlot, resolveSlotProps} from './resolveSlot'
import type {Store} from '../../store/Store'

import styles from '../../../styles.module.css'

const DRAG_HANDLE_WIDTH = 24

function buildContainerProps(
	isDraggableBlock: boolean,
	readOnly: boolean,
	className: string | undefined,
	style: CSSProperties | undefined,
	slotProps: CoreSlotProps | undefined
): {className: string | undefined; style?: CSSProperties; [key: string]: unknown} {
	const containerSlotProps = slotProps?.container
	const baseStyle = merge(style, containerSlotProps?.style)
	const mergedStyle =
		isDraggableBlock && !readOnly ? {paddingLeft: DRAG_HANDLE_WIDTH, ...baseStyle} : baseStyle

	const {className: _, style: __, ...otherSlotProps} = resolveSlotProps('container', slotProps) ?? {}

	return {
		className: cx(styles.Container, className, containerSlotProps?.className),
		style: mergedStyle,
		...otherSlotProps,
	}
}

export class SlotsFeature {
	readonly state = {
		container: signal<HTMLDivElement | null>(null),
	}

	readonly computed: {
		isBlock: Computed<boolean>
		isDraggable: Computed<boolean>
		containerComponent: Computed<Slot>
		containerProps: Computed<{className: string | undefined; style?: CSSProperties; [key: string]: unknown}>
		blockComponent: Computed<Slot>
		blockProps: Computed<Record<string, unknown> | undefined>
		spanComponent: Computed<Slot>
		spanProps: Computed<Record<string, unknown> | undefined>
	} = {
		isBlock: computed(() => this._store.props.layout() === 'block'),
		isDraggable: computed(() => !!this._store.props.draggable()),
		containerComponent: computed(() => resolveSlot('container', this._store.props.slots())),
		containerProps: computed(
			() =>
				buildContainerProps(
					this.computed.isDraggable() && this.computed.isBlock(),
					this._store.props.readOnly(),
					this._store.props.className(),
					this._store.props.style(),
					this._store.props.slotProps()
				),
			{equals: shallow}
		),
		blockComponent: computed(() => resolveSlot('block', this._store.props.slots())),
		blockProps: computed(() => resolveSlotProps('block', this._store.props.slotProps())),
		spanComponent: computed(() => resolveSlot('span', this._store.props.slots())),
		spanProps: computed(() => resolveSlotProps('span', this._store.props.slotProps())),
	}

	readonly emit = {} as const

	constructor(private readonly _store: Store) {}
	enable() {}
	disable() {}
}
```

- [ ] **Step 6.2: Export from index**

`packages/core/src/features/slots/index.ts` — append:

```ts
export {SlotsFeature} from './SlotsFeature'
```

- [ ] **Step 6.3: Wire Store**

In `packages/core/src/store/Store.ts`:
1. Remove `buildContainerProps` function from the file (it moved to `SlotsFeature.ts`).
2. Remove the import of `styles from '../../styles.module.css'` (no longer needed in Store).
3. Construct `const slots = new SlotsFeature(this)`.
4. Alias `state.container`, `computed.isBlock`, `isDraggable`, `containerComponent`, `containerProps`, `blockComponent`, `blockProps`, `spanComponent`, `spanProps` to the slots feature.
5. Add `slots` to the feature record.
6. Update the `parsing.computed.parser` closure that currently reads `this.computed.isBlock()` (after Task 3 it still works via alias; but a best-practice update is to point directly at `this._store.feature.slots.computed.isBlock()`).

- [ ] **Step 6.4: Shape spec**

`packages/core/src/features/slots/SlotsFeature.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {Store} from '../../store/Store'

describe('SlotsFeature', () => {
	it('exposes container DOM ref and every slot computed', () => {
		const store = new Store()
		expect(store.feature.slots.state.container()).toBe(null)
		expect(store.feature.slots.computed.isBlock()).toBe(false)
		expect(store.feature.slots.computed.isDraggable()).toBe(false)
		expect(typeof store.feature.slots.computed.containerComponent()).toBeTruthy()
	})

	it('aliases every field with the legacy store maps', () => {
		const store = new Store()
		expect(store.feature.slots.state.container).toBe(store.state.container)
		expect(store.feature.slots.computed.isBlock).toBe(store.computed.isBlock)
		expect(store.feature.slots.computed.isDraggable).toBe(store.computed.isDraggable)
		expect(store.feature.slots.computed.containerComponent).toBe(store.computed.containerComponent)
		expect(store.feature.slots.computed.containerProps).toBe(store.computed.containerProps)
		expect(store.feature.slots.computed.blockComponent).toBe(store.computed.blockComponent)
		expect(store.feature.slots.computed.blockProps).toBe(store.computed.blockProps)
		expect(store.feature.slots.computed.spanComponent).toBe(store.computed.spanComponent)
		expect(store.feature.slots.computed.spanProps).toBe(store.computed.spanProps)
	})
})
```

- [ ] **Step 6.5: Migrate call sites**

```bash
rg -l 'store\.state\.container|store\.computed\.(isBlock|isDraggable|containerComponent|containerProps|blockComponent|blockProps|spanComponent|spanProps)' packages
```

Rewrite to `store.feature.slots.state.container` / `store.feature.slots.computed.*`.

Framework adapters to touch: React `Container.tsx`, `Block.tsx`, `Token.tsx`; Vue `Container.vue`, `Block.vue`, `Token.vue`.

- [ ] **Step 6.6: Update `slots/README.md`**

Add section:

```markdown
## SlotsFeature

Accessible as `store.feature.slots`.

| Field | Purpose |
|---|---|
| `state.container` | DOM ref to the contenteditable root. Set by the framework `Container` component. |
| `computed.isBlock` | `props.layout === 'block'`. |
| `computed.isDraggable` | `!!props.draggable`. (Consumer: `containerProps` padding.) |
| `computed.containerComponent` | Resolved container slot component. |
| `computed.containerProps` | Merged container props (className, style, drag-handle padding, slotProps). |
| `computed.blockComponent` / `blockProps` | Resolved block slot + props. |
| `computed.spanComponent` / `spanProps` | Resolved span slot + props. |
```

- [ ] **Step 6.7: Run tests + commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check
git add -A
git commit -m "refactor(core): extract SlotsFeature owning container ref and all slot computeds"
```

---

## Task 7: DragFeature v2

**Files:**
- Modify: `packages/core/src/features/drag/DragFeature.ts`
- Modify: `packages/core/src/features/drag/DragFeature.spec.ts`
- Modify: `packages/core/src/store/Store.ts`

- [ ] **Step 7.1: Add `emit.drag` to `DragFeature`**

In `packages/core/src/features/drag/DragFeature.ts`, add before the existing `#scope` field:

```ts
readonly state = {} as const
readonly computed = {} as const
readonly emit = {
	drag: event<DragAction>(),
}
```

Import `event` and `DragAction` at the top. Replace `this.store.emit.drag` with `this.emit.drag` inside `enable()`.

- [ ] **Step 7.2: Wire Store**

In `Store.ts`:
- `const drag = new DragFeature(this)` before feature record.
- Alias `this.emit.drag = drag.emit.drag`.
- `feature.drag = drag`.

- [ ] **Step 7.3: Migrate call sites**

```bash
rg -l 'store\.emit\.drag' packages
```

Rewrite to `store.feature.drag.emit.drag`.

- [ ] **Step 7.4: Add alias assertion to spec**

Append to `DragFeature.spec.ts`:

```ts
it('owns the drag event (aliased with legacy store.emit.drag)', () => {
	const store = new Store()
	expect(store.feature.drag.emit.drag).toBe(store.emit.drag)
})
```

- [ ] **Step 7.5: Test + commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check
git add -A
git commit -m "refactor(core): DragFeature owns emit.drag"
```

---

## Task 8: ClipboardFeature (rename `CopyFeature`)

**Files:**
- Rename: `packages/core/src/features/clipboard/CopyFeature.ts` → `packages/core/src/features/clipboard/ClipboardFeature.ts` (file rename + class rename)
- Modify: `packages/core/src/features/clipboard/index.ts`
- Modify: `packages/core/src/store/Store.ts`

- [ ] **Step 8.1: Rename file and class**

```bash
git mv packages/core/src/features/clipboard/CopyFeature.ts packages/core/src/features/clipboard/ClipboardFeature.ts
```

Open the renamed file. Rename the class `CopyFeature` → `ClipboardFeature`. Add empty ownership stubs (keeps the contract shape uniform):

```ts
export class ClipboardFeature {
	readonly state = {} as const
	readonly computed = {} as const
	readonly emit = {} as const

	// ... existing #scope, constructor, enable, disable ...
}
```

- [ ] **Step 8.2: Update `clipboard/index.ts`**

```ts
export {ClipboardFeature, ClipboardFeature as CopyFeature} from './ClipboardFeature'
```

The `as CopyFeature` alias keeps any leftover import working until Task 13.

- [ ] **Step 8.3: Update Store**

In `Store.ts`:
- `import {ClipboardFeature} from '../features/clipboard'`
- Replace `copy: new CopyFeature(this)` with `clipboard: new ClipboardFeature(this)` in the feature record.

- [ ] **Step 8.4: Migrate call sites**

```bash
rg -l 'CopyFeature|store\.feature\.copy\b' packages
```

Rewrite type imports from `CopyFeature` → `ClipboardFeature`, and any runtime reference `store.feature.copy` → `store.feature.clipboard`.

- [ ] **Step 8.5: Test + commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check
git add -A
git commit -m "refactor(core): rename CopyFeature to ClipboardFeature"
```

---

## Task 9: KeyboardFeature (merge `Input` + `BlockEdit` + `ArrowNav`)

**Files:**
- Create: `packages/core/src/features/keyboard/KeyboardFeature.ts`
- Create: `packages/core/src/features/keyboard/input.ts` (former `InputFeature` body)
- Create: `packages/core/src/features/keyboard/blockEdit.ts` (former `BlockEditFeature` body)
- Create: `packages/core/src/features/keyboard/arrowNav.ts` (former `ArrowNavFeature` body)
- Create: `packages/core/src/features/keyboard/index.ts`
- Create: `packages/core/src/features/keyboard/README.md`
- Move spec files: `InputFeature.spec.ts`, `BlockEditFeature.spec.ts` (if exists), `ArrowNavFeature.spec.ts` (if exists) → under `keyboard/` with updated imports
- Modify: `packages/core/src/store/Store.ts`
- Delete (end of task): `packages/core/src/features/input/`, `packages/core/src/features/block-editing/`, `packages/core/src/features/arrownav/`

- [ ] **Step 9.1: Create internal modules**

Each internal module is the existing feature's logic repackaged as a free function taking the store:

`packages/core/src/features/keyboard/input.ts`:

```ts
import {effectScope, listen} from '../../shared/signals'
import type {Store} from '../../store/Store'
// ... copy everything else from packages/core/src/features/input/InputFeature.ts ...

export function enableInput(store: Store): () => void {
	return effectScope(() => {
		// COPY the body of `InputFeature.enable()` here verbatim.
		// `this.store` → `store` throughout.
	})
}
```

`packages/core/src/features/keyboard/blockEdit.ts`:

```ts
import {effectScope, listen} from '../../shared/signals'
import type {Store} from '../../store/Store'

export function enableBlockEdit(store: Store): () => void {
	return effectScope(() => {
		// COPY the body of `BlockEditFeature.enable()` verbatim; `this.store` → `store`.
	})
}
```

`packages/core/src/features/keyboard/arrowNav.ts`:

```ts
import {effectScope, listen} from '../../shared/signals'
import type {Store} from '../../store/Store'

export function enableArrowNav(store: Store): () => void {
	return effectScope(() => {
		// COPY the body of `ArrowNavFeature.enable()` verbatim; `this.store` → `store`.
	})
}
```

**Implementer note:** `effectScope` returns a disposer. Each `enableX` function returns that disposer so `KeyboardFeature` can collect them.

- [ ] **Step 9.2: Create `KeyboardFeature` facade**

`packages/core/src/features/keyboard/KeyboardFeature.ts`:

```ts
import type {Store} from '../../store/Store'
import {enableInput} from './input'
import {enableBlockEdit} from './blockEdit'
import {enableArrowNav} from './arrowNav'

export class KeyboardFeature {
	readonly state = {} as const
	readonly computed = {} as const
	readonly emit = {} as const

	#disposers: Array<() => void> = []

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#disposers.length) return
		this.#disposers = [
			enableInput(this._store),
			enableBlockEdit(this._store),
			enableArrowNav(this._store),
		]
	}

	disable() {
		this.#disposers.forEach(d => d())
		this.#disposers = []
	}
}
```

- [ ] **Step 9.3: Create `keyboard/index.ts`**

```ts
export {KeyboardFeature} from './KeyboardFeature'
```

- [ ] **Step 9.4: Move spec files**

```bash
git mv packages/core/src/features/input/InputFeature.spec.ts packages/core/src/features/keyboard/input.spec.ts
```

(Repeat for block-edit and arrownav spec files if they exist — `rg --files packages/core/src/features/block-editing` / `arrownav` to check.)

Open each moved spec, update imports to point at `./input` / `./blockEdit` / `./arrowNav` or at the `KeyboardFeature` where appropriate. Tests currently instantiating `new InputFeature(store)` will need to switch to `new KeyboardFeature(store); keyboard.enable()` and then assert the same behaviors. If this is too invasive for a single step, keep the existing test by re-exporting a compatibility wrapper — but prefer the clean migration.

- [ ] **Step 9.5: Wire Store**

In `Store.ts`:
- Replace imports for `InputFeature`, `BlockEditFeature`, `ArrowNavFeature` with `import {KeyboardFeature} from '../features/keyboard'`.
- Replace the three feature record entries (`input`, `blockEditing`, `arrowNav`) with one: `keyboard: new KeyboardFeature(this)`.

- [ ] **Step 9.6: Delete old feature folders**

```bash
git rm -r packages/core/src/features/input/
git rm -r packages/core/src/features/block-editing/
git rm -r packages/core/src/features/arrownav/
```

- [ ] **Step 9.7: Test + commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check
git add -A
git commit -m "refactor(core): merge InputFeature + BlockEditFeature + ArrowNavFeature into KeyboardFeature"
```

---

## Task 10: CaretFeature (merge `Focus` + `TextSelection`)

**Files:**
- Create: `packages/core/src/features/caret/CaretFeature.ts`
- Create: `packages/core/src/features/caret/focus.ts` (former `FocusFeature` body)
- Create: `packages/core/src/features/caret/selection.ts` (former `TextSelectionFeature` body)
- Modify: `packages/core/src/features/caret/index.ts` (add exports)
- Move spec files to `caret/`
- Modify: `packages/core/src/store/Store.ts`
- Delete: `packages/core/src/features/focus/`, `packages/core/src/features/selection/`

- [ ] **Step 10.1: Create `focus.ts` and `selection.ts` internal modules**

Same pattern as Task 9: wrap each current `enable()` body in a free function `enableFocus(store)` / `enableSelection(store)` returning a disposer. Paths inside stay as-is for now (still reference `store.state.recovery` etc.) — they'll shift to feature-local in Step 10.2.

- [ ] **Step 10.2: Create `CaretFeature` with owned state**

`packages/core/src/features/caret/CaretFeature.ts`:

```ts
import {signal} from '../../shared/signals'
import type {Recovery} from '../../shared/types'
import type {Store} from '../../store/Store'
import {enableFocus} from './focus'
import {enableSelection} from './selection'

export class CaretFeature {
	readonly state = {
		recovery: signal<Recovery | undefined>(undefined),
		selecting: signal<'drag' | 'all' | undefined>(undefined),
	}

	readonly computed = {} as const
	readonly emit = {} as const

	#disposers: Array<() => void> = []

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#disposers.length) return
		this.#disposers = [enableFocus(this._store), enableSelection(this._store)]
	}

	disable() {
		this.#disposers.forEach(d => d())
		this.#disposers = []
	}
}
```

- [ ] **Step 10.3: Wire Store**

In `Store.ts`:
1. Replace `FocusFeature`, `TextSelectionFeature` imports with `import {CaretFeature} from '../features/caret'`.
2. Construct `const caret = new CaretFeature(this)`.
3. Alias `this.state.recovery = caret.state.recovery`, `this.state.selecting = caret.state.selecting`.
4. Replace feature record entries `focus`, `textSelection` with `caret: caret`.

- [ ] **Step 10.4: Shape spec**

Create `packages/core/src/features/caret/CaretFeature.spec.ts` with:

```ts
import {describe, it, expect} from 'vitest'
import {Store} from '../../store/Store'

describe('CaretFeature', () => {
	it('owns recovery and selecting signals (aliased with legacy maps)', () => {
		const store = new Store()
		expect(store.feature.caret.state.recovery).toBe(store.state.recovery)
		expect(store.feature.caret.state.selecting).toBe(store.state.selecting)
	})
})
```

- [ ] **Step 10.5: Migrate call sites**

```bash
rg -l 'store\.state\.(recovery|selecting)' packages
```

Rewrite `store.state.recovery` → `store.feature.caret.state.recovery`, same for `selecting`.

- [ ] **Step 10.6: Move and update spec files**

```bash
git mv packages/core/src/features/focus/FocusFeature.spec.ts packages/core/src/features/caret/focus.spec.ts
git mv packages/core/src/features/selection/TextSelectionFeature.spec.ts packages/core/src/features/caret/selection.spec.ts
```

Update each to construct `CaretFeature` instead of individual classes.

- [ ] **Step 10.7: Delete old folders**

```bash
git rm -r packages/core/src/features/focus/
git rm -r packages/core/src/features/selection/
```

Leave `packages/core/src/features/caret/TriggerFinder.ts` and `Caret.ts` in place — they're shared helpers, not the merged features.

- [ ] **Step 10.8: Test + commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check
git add -A
git commit -m "refactor(core): merge FocusFeature + TextSelectionFeature into CaretFeature"
```

---

## Task 11: DomFeature (rename `ContentEditable`, rename event `sync` → `reconcile`)

**Files:**
- Rename folder: `packages/core/src/features/editable/` → `packages/core/src/features/dom/`
- Rename class: `ContentEditableFeature` → `DomFeature`
- Rename event: `sync` → `reconcile`
- Modify: `packages/core/src/store/Store.ts`
- Modify: spec files + all call sites of `emit.sync`

- [ ] **Step 11.1: Rename folder**

```bash
git mv packages/core/src/features/editable packages/core/src/features/dom
```

- [ ] **Step 11.2: Rename file and class**

```bash
git mv packages/core/src/features/dom/ContentEditableFeature.ts packages/core/src/features/dom/DomFeature.ts
git mv packages/core/src/features/dom/ContentEditableFeature.spec.ts packages/core/src/features/dom/DomFeature.spec.ts
```

In the file, replace `ContentEditableFeature` with `DomFeature`. Add ownership:

```ts
export class DomFeature {
	readonly state = {} as const
	readonly computed = {} as const
	readonly emit = {
		reconcile: event(),
	}

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			effect(() => {
				this._store.props.readOnly()
				this.reconcile()
			})
			effect(() => {
				if (this._store.feature.caret.state.selecting() === undefined) this.reconcile()
			})
			watch(this.emit.reconcile, () => {
				this.reconcile()
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}

	reconcile() {
		// Rename the old `sync()` method to `reconcile()`.
		// Body unchanged; just change `this.store.*` → `this._store.*` and
		// `this._store.state.container` → `this._store.feature.slots.state.container`
		// `this._store.state.tokens` → `this._store.feature.parsing.state.tokens`
		// `this._store.computed.isBlock` → `this._store.feature.slots.computed.isBlock`.
	}
}
```

Private helpers (`#syncTextContent`, `#syncMarkChildren`, `#syncDragTextContent`) are renamed to `#reconcileTextContent`, `#reconcileMarkChildren`, `#reconcileDragTextContent` for consistency. Bodies unchanged.

- [ ] **Step 11.3: Update `dom/index.ts`**

```ts
export {DomFeature, DomFeature as ContentEditableFeature} from './DomFeature'
```

- [ ] **Step 11.4: Update `FocusFeature` (now `caret/focus.ts`)**

In `packages/core/src/features/caret/focus.ts`, the previous `store.emit.sync()` call becomes `store.feature.dom.emit.reconcile()`.

- [ ] **Step 11.5: Wire Store**

- Replace `ContentEditableFeature` import with `DomFeature`.
- Construct `const dom = new DomFeature(this)`.
- Feature record entry: replace `contentEditable: ...` with `dom: dom`.
- Replace `this.emit.sync = event()` with `this.emit.sync = dom.emit.reconcile` (keeps backward-compat alias).

- [ ] **Step 11.6: Migrate call sites**

```bash
rg -l 'store\.emit\.sync|ContentEditableFeature|store\.feature\.contentEditable' packages
```

Rewrite:
- `store.emit.sync` → `store.feature.dom.emit.reconcile`
- `ContentEditableFeature` (type) → `DomFeature`
- `store.feature.contentEditable` → `store.feature.dom`

- [ ] **Step 11.7: Test + commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check
git add -A
git commit -m "refactor(core): rename ContentEditableFeature to DomFeature and sync event to reconcile"
```

---

## Task 12: Delete `SystemListenerFeature`

By this task, all four watchers have been redistributed (Tasks 2, 4, 5; the fourth — `change` — went to ValueFeature in Task 2). Verify the current `SystemListenerFeature.ts` contains no remaining `watch(...)` calls, then delete.

**Files:**
- Delete: `packages/core/src/features/events/` (entire folder, including README, spec, index)
- Modify: `packages/core/src/store/Store.ts`

- [ ] **Step 12.1: Verify the file is empty of watchers**

Open `packages/core/src/features/events/SystemListenerFeature.ts`. The `enable()` method body should be empty (or contain only the `#scope` setup with nothing inside). If any `watch` remains, STOP — route it to the correct feature first.

- [ ] **Step 12.2: Delete the folder**

```bash
git rm -r packages/core/src/features/events/
```

- [ ] **Step 12.3: Update Store**

Remove:
- `import {SystemListenerFeature} from '../features/events'`
- `system: new SystemListenerFeature(this)` from the feature record

- [ ] **Step 12.4: Remove associated tests**

Any `rg SystemListenerFeature packages` hits should be zero. If any remain, delete them.

- [ ] **Step 12.5: Test + commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check
git add -A
git commit -m "refactor(core): delete SystemListenerFeature (watchers redistributed)"
```

---

## Task 13: Remove legacy `store.state` / `store.computed` / `store.emit` maps

Every call site now points at `store.feature.<name>.<category>.<field>`. The legacy maps have been aliases throughout the migration. Time to delete them.

**Files:**
- Modify: `packages/core/src/store/Store.ts`
- Modify: `packages/core/src/store/Store.spec.ts` (remove tests that assert the legacy shape)

- [ ] **Step 13.1: Final call-site audit**

```bash
rg 'store\.state\.|store\.computed\.|store\.emit\.' packages
```

Expected: ZERO matches (only `this.state.X`, `this.computed.X`, `this.emit.X` inside feature classes themselves).

If any hits remain, fix them now (each should become `store.feature.<name>.<category>.<field>`).

- [ ] **Step 13.2: Delete legacy maps from `Store.ts`**

Remove the `state`, `computed`, `emit` fields entirely (both field declarations and the constructor assignments). The Store class should now read:

```ts
export class Store {
	readonly key = new KeyGenerator()
	readonly blocks = new BlockRegistry()
	readonly nodes = {
		focus: new NodeProxy(undefined, this),
		input: new NodeProxy(undefined, this),
	}
	readonly props = { /* 15 signals, unchanged */ }
	readonly handler = new MarkputHandler(this)

	readonly feature: {
		lifecycle: LifecycleFeature
		value: ValueFeature
		parsing: ParsingFeature
		mark: MarkFeature
		overlay: OverlayFeature
		slots: SlotsFeature
		drag: DragFeature
		clipboard: ClipboardFeature
		keyboard: KeyboardFeature
		caret: CaretFeature
		dom: DomFeature
	}

	constructor() {
		const lifecycle = new LifecycleFeature(this)
		const value = new ValueFeature(this)
		const parsing = new ParsingFeature(this)
		const mark = new MarkFeature(this)
		const overlay = new OverlayFeature(this)
		const slots = new SlotsFeature(this)
		const drag = new DragFeature(this)
		const clipboard = new ClipboardFeature(this)
		const keyboard = new KeyboardFeature(this)
		const caret = new CaretFeature(this)
		const dom = new DomFeature(this)

		this.feature = {lifecycle, value, parsing, mark, overlay, slots, drag, clipboard, keyboard, caret, dom}

		watch(this.feature.lifecycle.emit.mounted, () => Object.values(this.feature).forEach(f => f.enable()))
		watch(this.feature.lifecycle.emit.unmounted, () => Object.values(this.feature).forEach(f => f.disable()))
	}

	setProps(values: Partial<SignalValues<typeof this.props>>): void {
		batch(
			() => {
				const props = this.props
				for (const key of Object.keys(values) as (keyof typeof this.props)[]) {
					if (!(key in props)) continue
					props[key](values[key] as never)
				}
			},
			{mutable: true}
		)
	}
}
```

Target size: ≤ 80 lines (not counting `props` definition and comments).

- [ ] **Step 13.3: Update `Store.spec.ts`**

Remove or rewrite any test that accesses `store.state.X` / `store.computed.X` / `store.emit.X`. Each assertion becomes `store.feature.<name>.<category>.<field>`. Shape tests that assert aliases (`store.feature.value.state.previousValue).toBe(store.state.previousValue)`) are DELETED — legacy maps are gone.

- [ ] **Step 13.4: Remove compatibility aliases**

- `packages/core/src/features/parsing/index.ts` — remove `as ParseFeature` alias line.
- `packages/core/src/features/clipboard/index.ts` — remove `as CopyFeature` alias.
- `packages/core/src/features/dom/index.ts` — remove `as ContentEditableFeature` alias.

- [ ] **Step 13.5: Test + commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm run build
git add -A
git commit -m "refactor(core): remove legacy store.state/computed/emit maps; migration complete"
```

---

## Task 14: Documentation updates

**Files:**
- Modify: `packages/core/src/store/README.md`
- Modify: `packages/website/src/content/docs/development/architecture.md`
- Modify: `AGENTS.md`
- Modify: each `packages/core/src/features/<name>/README.md`

- [ ] **Step 14.1: Rewrite `packages/core/src/store/README.md`**

Replace with:

```markdown
# Store

The central orchestrator. Holds the public prop surface, infrastructure (key generator, block registry, node proxies, handler façade), and aggregates all feature slices.

## Shape

| Field | Purpose |
|---|---|
| `store.props` | 15 readonly signals written only via `setProps()`. Mirrors the `<MarkedInput>` prop surface. |
| `store.key` | `KeyGenerator` — render-stable token IDs. |
| `store.blocks` | `BlockRegistry` — WeakMap of per-token drag/menu state. |
| `store.nodes` | `{focus, input}` `NodeProxy` refs used for DOM navigation. |
| `store.handler` | `MarkputHandler` façade exposed to framework adapters. |
| `store.feature.*` | 11 feature slices (see below). |

## Features

Every feature exposes `state`, `computed`, `emit` (any of which may be empty) plus `enable()` / `disable()`:

| Slice | Owns |
|---|---|
| `lifecycle` | `emit.mounted`, `emit.unmounted`, `emit.rendered` |
| `value` | `state.previousValue`, `state.innerValue`, `computed.currentValue`, `emit.change` |
| `parsing` | `state.tokens`, `computed.parser`, `emit.reparse` |
| `mark` | `computed.hasMark`, `computed.mark`, `emit.markRemove` |
| `overlay` | `state.overlayMatch`, `state.overlay` (DOM ref), `computed.overlay`, `emit.overlaySelect`, `emit.overlayClose` |
| `slots` | `state.container` (DOM ref), `computed.isBlock`, `computed.isDraggable`, slot component/props computeds |
| `drag` | `emit.drag` |
| `clipboard` | — (background effects only) |
| `keyboard` | — (background effects only, three internal modules: input, blockEdit, arrowNav) |
| `caret` | `state.recovery`, `state.selecting` |
| `dom` | `emit.reconcile` |

## Usage

```typescript
import {Store, batch} from '@markput/core'

const store = new Store()
store.setProps({value: 'Hello @[world](test)', readOnly: false})

batch(() => {
	store.feature.parsing.state.tokens(newTokens)
	store.feature.value.state.previousValue(serialized)
})
```

## Readonly Props

All `store.props` signals are `{readonly: true}`. Only `setProps()` can mutate — it uses `batch(fn, {mutable: true})` to temporarily open the write gate.
```

- [ ] **Step 14.2: Update `packages/website/src/content/docs/development/architecture.md`**

In the "Store Structure" section, replace the old shape code block with the new 11-feature layout. In the "Features" section, replace the feature list with the 11-slice version. In the "Event System" section, replace the events table — `sync` becomes `reconcile` (owner: `dom`), every event cell lists its new `store.feature.<name>.emit.<field>` location.

Word count target: the Store section should shrink (the new layout is more compact). Update the event table header from "Store Events" to "Feature Events".

- [ ] **Step 14.3: Update `AGENTS.md`**

Find the "Do NOT" section. Replace:

```
- Do not manually create Signals for new state — add new state keys to either `state` (internal, feature-managed) or `props` (external, framework-provided) in `Store.ts`. Features write to `state`; framework adapters write to `props` via `setProps()`.
```

with:

```
- Do not manually create Signals for new state — add new `state`/`computed`/`emit` fields to the owning feature class under `packages/core/src/features/<name>/<Name>Feature.ts`. `store.props` (external, framework-provided) remains in `Store.ts`; framework adapters write to it via `setProps()`. Features communicate through `store.feature.<name>.<category>.<field>`, `store.props`, and `store.nodes`.
```

Also update the "Common Pitfalls" line `store.state properties are Signals defined in the initial state object in Store.ts` to: `Feature fields are Signals/events/computeds defined in the owning feature class — see packages/core/src/features/<name>/<Name>Feature.ts.`

- [ ] **Step 14.4: Update every feature README**

For each `packages/core/src/features/<name>/README.md` (11 features), make sure it lists the `state`, `computed`, `emit` fields the feature owns and documents any effect watchers it installs. Templates already provided in Tasks 1, 2, 6 — replicate the format for the rest:

- `packages/core/src/features/parsing/README.md`
- `packages/core/src/features/mark/README.md`
- `packages/core/src/features/overlay/README.md`
- `packages/core/src/features/drag/README.md`
- `packages/core/src/features/clipboard/README.md`
- `packages/core/src/features/keyboard/README.md`
- `packages/core/src/features/caret/README.md`
- `packages/core/src/features/dom/README.md`

- [ ] **Step 14.5: Final verification**

```bash
pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm run build
```

All pass.

- [ ] **Step 14.6: Commit**

```bash
git add -A
git commit -m "docs(core): update Store/feature READMEs and architecture doc for feature modules refactor"
```

---

## Task 15: Open PR

- [ ] **Step 15.1: Push branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 15.2: Open PR against `next`**

```bash
gh pr create --base next --title "refactor(core): feature-module ownership for Store" --body "$(cat <<'EOF'
## Summary

- Distributes `state`, `computed`, `emit` from the central `Store` maps into 11 per-feature classes accessed via `store.feature.<name>.<category>.<field>`.
- Consolidates `Input` + `BlockEdit` + `ArrowNav` into `KeyboardFeature`; `Focus` + `TextSelection` into `CaretFeature`.
- Renames `ContentEditableFeature` → `DomFeature` and `sync` event → `reconcile`.
- Dissolves `SystemListenerFeature` — its four event watchers are redistributed to their natural owners (`value`, `mark`, `overlay`).
- `Store.ts` shrinks from 229 lines to ≤ 80.
- No behavioral change: every existing test still passes.

## Test plan

- [x] `pnpm test`
- [x] `pnpm run typecheck`
- [x] `pnpm run lint:check`
- [x] `pnpm run format:check`
- [x] `pnpm run build`
- [x] Storybook interaction tests exercise keyboard, drag, clipboard, overlay flows unchanged.

Spec: `docs/superpowers/specs/2026-04-22-store-feature-modules-design.md`
Plan: `docs/superpowers/plans/2026-04-22-store-feature-modules.md`
EOF
)"
```

---

## Rollback

If any task's test suite regresses and cannot be fixed in-commit, the full commit chain from that task onward can be dropped:

```bash
git reset --hard <sha-before-task>
```

Each task commit is self-contained (new code + moved call sites + tests); dropping the latest commit restores a working state of the previous task.

## Success Criteria (from spec)

- `Store.ts` ≤ 80 lines.
- Every `store.state.X` / `store.computed.X` / `store.emit.X` reference resolves to `store.feature.<owner>.<category>.X`.
- TypeScript correctly infers `store.feature.<name>` without helper mapped types.
- `pnpm test`, `pnpm run build`, `pnpm run typecheck`, `pnpm run lint:check`, `pnpm run format:check` pass on every commit.
- No user-observable behavior change (snapshot + interaction tests unchanged).
