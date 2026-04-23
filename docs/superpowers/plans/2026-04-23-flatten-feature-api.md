# Flatten Feature API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flatten each feature's public API (drop `state`/`computed`/`emit` containers) and promote features from `store.feature.<name>` to `store.<name>`, so that call sites read `store.parsing.tokens()` instead of `store.feature.parsing.state.tokens()`.

**Architecture:** Each `Feature` class today exposes three grouped containers (`state`, `computed`, `emit`) whose entries are signals/computeds/events. Because all three primitives are callable with `()` and their semantic kind is already encoded in the TS type, the containers are redundant noise at call sites. The plan removes the containers, lifts every entry to a direct class field, resolves two pre-existing naming collisions that currently depend on the containers to disambiguate, and finally promotes the 11 feature instances from the `store.feature.*` sub-object to the `Store` root.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest (unit + browser), oxlint, oxfmt, core reactive primitives (`signal`, `computed`, `event`).

---

## Out of scope

- Optional tautology renames (`mark.mark` → `mark.markSlot`, `overlay.overlay` state → `overlayNode`). The user said these come in a follow-up pass.
- `PropsFeature` — already flat, unchanged.
- `editing` and `navigation` folders — utility modules, no `Feature` instance.

## Pre-flight verification

Before any code changes, confirm baseline is green:

```bash
pnpm test
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
```

If any of these fail on `HEAD`, stop and surface the failure — do not mix a broken baseline into the refactor.

---

### Task 1: Resolve `overlay.overlay` collision (rename computed → `overlaySlot`)

`OverlayFeature` has `state.overlay` (HTMLElement) and `computed.overlay` (slot resolver). Once we flatten, both would try to live on `this.overlay`. Rename the computed first, while the containers still exist, so the diff is small and isolated.

**Files:**
- Modify: `packages/core/src/features/overlay/OverlayFeature.ts`
- Modify: call sites returned by ripgrep (see Step 2)

- [ ] **Step 1: Rename the computed entry**

In `packages/core/src/features/overlay/OverlayFeature.ts`, change the `computed` block:

```ts
readonly computed: {
	overlaySlot: OverlaySlot
} = {
	overlaySlot: computed(() => {
		const Overlay = this._store.props.Overlay()
		return (option?: CoreOption, defaultComponent?: Slot) =>
			resolveOverlaySlot(Overlay, option, defaultComponent)
	}),
}
```

- [ ] **Step 2: Find every external reference**

```bash
rg -n 'feature\.overlay\.computed\.overlay\b' packages
```

- [ ] **Step 3: Update every hit to `overlaySlot`**

Each hit of the form `store.feature.overlay.computed.overlay` (or `this._store.feature.overlay.computed.overlay`) becomes `…computed.overlaySlot`. No behavioural change.

- [ ] **Step 4: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/overlay
```

Expected: PASS (no type errors, overlay tests green).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): rename OverlayFeature computed.overlay to overlaySlot"
```

---

### Task 2: Remove `dom.emit.reconcile` collision

`DomFeature` exposes both an `emit.reconcile` event and a `reconcile()` method. After flattening, both would want to live on `this.reconcile`. The event is only used as an indirect trigger — the watcher's handler simply calls `this.reconcile()`. Delete the event, call the method directly from the one external emitter (`caret/focus.ts`).

**Files:**
- Modify: `packages/core/src/features/dom/DomFeature.ts`
- Modify: `packages/core/src/features/caret/focus.ts:29`

- [ ] **Step 1: Update `caret/focus.ts` to call the method directly**

Replace `store.feature.dom.emit.reconcile()` with `store.feature.dom.reconcile()`. This is the only external firing site.

- [ ] **Step 2: Remove the event and its watcher from `DomFeature.ts`**

Drop the `reconcile: event()` entry (leaving `emit = {} as const`) and delete the `watch(this.emit.reconcile, () => { this.reconcile() })` block inside `#scope`. The two existing `effect(() => { this.reconcile() })` blocks stay — they already trigger reconciliation from reactive dependencies.

Resulting `DomFeature.ts` shape:

```ts
readonly state = {} as const
readonly computed = {} as const
readonly emit = {} as const

#scope?: () => void

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
	})
}
```

- [ ] **Step 3: Remove unused import if applicable**

If `event` is no longer used in `DomFeature.ts`, drop it from the import statement.

- [ ] **Step 4: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/dom
pnpm -w vitest run packages/core/src/features/caret
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): drop redundant DomFeature.emit.reconcile, call method directly"
```

---

### Task 3: Flatten `LifecycleFeature`

Smallest feature, uses only events. Good first flatten to confirm the mechanical shape.

**Files:**
- Modify: `packages/core/src/features/lifecycle/LifecycleFeature.ts`
- Modify: all external references (see Step 2)

- [ ] **Step 1: Rewrite `LifecycleFeature.ts` to flat fields**

```ts
import {event} from '../../shared/signals/index.js'
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'

export class LifecycleFeature implements Feature {
	readonly mounted = event()
	readonly unmounted = event()
	readonly rendered = event()

	constructor(private readonly _store: Store) {}

	enable() {}
	disable() {}
}
```

- [ ] **Step 2: Find every external reference**

```bash
rg -n 'feature\.lifecycle\.(state|computed|emit)\.' packages
```

- [ ] **Step 3: Update every hit**

Replace `feature.lifecycle.emit.mounted` → `feature.lifecycle.mounted`, same for `unmounted` and `rendered`. Also update `Store.ts` constructor lines:

```ts
watch(this.feature.lifecycle.mounted, () => Object.values(this.feature).forEach(f => f.enable()))
watch(this.feature.lifecycle.unmounted, () => Object.values(this.feature).forEach(f => f.disable()))
```

- [ ] **Step 4: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/lifecycle
pnpm -w vitest run packages/core/src/store
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): flatten LifecycleFeature API"
```

---

### Task 4: Flatten `ValueFeature`

Has state + computed + emit — exercises all three kinds in one migration.

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.ts`
- Modify: all external references

- [ ] **Step 1: Rewrite `ValueFeature.ts` to flat fields**

Lift each key up; replace internal `this.state.X` / `this.computed.X` / `this.emit.X` with `this.X`.

```ts
export class ValueFeature implements Feature {
	readonly previousValue = signal<string | undefined>(undefined)
	readonly innerValue = signal<string | undefined>(undefined)

	readonly currentValue = computed(() => this.previousValue() ?? this._store.props.value() ?? '')

	readonly change = event()

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			watch(this.change, () => {
				// body unchanged except `this.state.X` / `this.emit.X` rewrites
				// ... existing handler, with this.state.previousValue → this.previousValue
				//                 this.emit.change → this.change
				//                 referenced tokens via store still use store.feature.parsing.state.tokens
				//                 (those get flattened in their own task)
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}
```

Keep every line of existing handler logic; only rewrite `this.state.*` / `this.computed.*` / `this.emit.*` prefixes.

- [ ] **Step 2: Find every external reference**

```bash
rg -n 'feature\.value\.(state|computed|emit)\.' packages
```

- [ ] **Step 3: Update every hit**

Drop the middle segment:
- `feature.value.state.previousValue` → `feature.value.previousValue`
- `feature.value.state.innerValue` → `feature.value.innerValue`
- `feature.value.computed.currentValue` → `feature.value.currentValue`
- `feature.value.emit.change` → `feature.value.change`

- [ ] **Step 4: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/value
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): flatten ValueFeature API"
```

---

### Task 5: Flatten `MarkFeature`

**Files:**
- Modify: `packages/core/src/features/mark/MarkFeature.ts`
- Modify: all external references

- [ ] **Step 1: Rewrite `MarkFeature.ts` to flat fields**

```ts
export class MarkFeature implements Feature {
	readonly hasMark: Computed<boolean> = computed(() => {
		const Mark = this._store.props.Mark()
		if (Mark) return true
		return this._store.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
	})

	readonly mark: MarkSlot = computed(() => {
		const options = this._store.props.options()
		const Mark = this._store.props.Mark()
		const Span = this._store.props.Span()
		return (token: Token) => resolveMarkSlot(token, options, Mark, Span)
	})

	readonly markRemove = event<{token: Token}>()

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			watch(this.markRemove, payload => {
				const {token} = payload
				const tokens = this._store.feature.parsing.state.tokens()
				if (!findToken(tokens, token)) return
				const value = toString(tokens)
				const nextValue = value.slice(0, token.position.start) + value.slice(token.position.end)
				this._store.feature.value.innerValue(nextValue)
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}
```

Note: `store.feature.value.state.innerValue` becomes `store.feature.value.innerValue` because Task 4 already flattened ValueFeature. `store.feature.parsing.state.tokens` stays (flattened in Task 13).

- [ ] **Step 2: Find every external reference**

```bash
rg -n 'feature\.mark\.(state|computed|emit)\.' packages
```

- [ ] **Step 3: Update every hit**

- `feature.mark.computed.hasMark` → `feature.mark.hasMark`
- `feature.mark.computed.mark` → `feature.mark.mark`
- `feature.mark.emit.markRemove` → `feature.mark.markRemove`

- [ ] **Step 4: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/mark
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): flatten MarkFeature API"
```

---

### Task 6: Flatten `OverlayFeature`

Task 1 already renamed the colliding computed, so flattening is mechanical.

**Files:**
- Modify: `packages/core/src/features/overlay/OverlayFeature.ts`
- Modify: all external references

- [ ] **Step 1: Rewrite `OverlayFeature.ts` to flat fields**

```ts
export class OverlayFeature implements Feature {
	readonly overlayMatch = signal<OverlayMatch | undefined>(undefined)
	readonly overlay = signal<HTMLElement | null>(null)

	readonly overlaySlot: OverlaySlot = computed(() => {
		const Overlay = this._store.props.Overlay()
		return (option?: CoreOption, defaultComponent?: Slot) =>
			resolveOverlaySlot(Overlay, option, defaultComponent)
	})

	readonly overlaySelect = event<{mark: Token; match: OverlayMatch}>()
	readonly overlayClose = event()

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	#probeTrigger() {
		const match = TriggerFinder.find(this._store.props.options(), option => option.overlay?.trigger)
		this.overlayMatch(match)
	}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			watch(this.overlayClose, () => {
				this.overlayMatch(undefined)
			})
			watch(this._store.feature.value.change, () => {
				const showOverlayOn = this._store.props.showOverlayOn()
				const type: OverlayTrigger = 'change'
				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.#probeTrigger()
				}
			})
			// (keep the rest of the existing enable() body, rewritten to drop .state/.computed/.emit)
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}
```

- [ ] **Step 2: Find every external reference**

```bash
rg -n 'feature\.overlay\.(state|computed|emit)\.' packages
```

- [ ] **Step 3: Update every hit**

- `feature.overlay.state.overlayMatch` → `feature.overlay.overlayMatch`
- `feature.overlay.state.overlay` → `feature.overlay.overlay`
- `feature.overlay.computed.overlaySlot` → `feature.overlay.overlaySlot`
- `feature.overlay.emit.overlaySelect` → `feature.overlay.overlaySelect`
- `feature.overlay.emit.overlayClose` → `feature.overlay.overlayClose`

- [ ] **Step 4: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/overlay
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): flatten OverlayFeature API"
```

---

### Task 7: Flatten `SlotsFeature`

Largest feature (9 computeds + 1 state). Mechanical.

**Files:**
- Modify: `packages/core/src/features/slots/SlotsFeature.ts`
- Modify: all external references

- [ ] **Step 1: Rewrite `SlotsFeature.ts` to flat fields**

Lift `container` state and all nine computeds up. Each computed keeps its type annotation and its body. Example:

```ts
export class SlotsFeature implements Feature {
	readonly container = signal<HTMLDivElement | null>(null)

	readonly isBlock: Computed<boolean> = computed(() => this._store.props.layout() === 'block')
	readonly isDraggable: Computed<boolean> = computed(() => !!this._store.props.draggable())
	readonly containerComponent: Computed<Slot> = computed(() => resolveSlot('container', this._store.props.slots()))
	readonly containerProps: Computed<{className: string | undefined; style?: CSSProperties; [key: string]: unknown}> = computed(
		() =>
			buildContainerProps(
				this.isDraggable() && this.isBlock(),
				this._store.props.readOnly(),
				this._store.props.className(),
				this._store.props.style(),
				this._store.props.slotProps()
			),
		{equals: shallow}
	)
	readonly blockComponent: Computed<Slot> = computed(() => resolveSlot('block', this._store.props.slots()))
	readonly blockProps: Computed<Record<string, unknown> | undefined> = computed(() =>
		resolveSlotProps('block', this._store.props.slotProps())
	)
	readonly spanComponent: Computed<Slot> = computed(() => resolveSlot('span', this._store.props.slots()))
	readonly spanProps: Computed<Record<string, unknown> | undefined> = computed(() =>
		resolveSlotProps('span', this._store.props.slotProps())
	)

	constructor(private readonly _store: Store) {}
	enable() {}
	disable() {}
}
```

Note the internal `this.computed.isDraggable()` / `this.computed.isBlock()` in `containerProps` become `this.isDraggable()` / `this.isBlock()`.

- [ ] **Step 2: Find every external reference**

```bash
rg -n 'feature\.slots\.(state|computed|emit)\.' packages
```

- [ ] **Step 3: Update every hit**

Drop the middle segment for every one of: `container`, `isBlock`, `isDraggable`, `containerComponent`, `containerProps`, `blockComponent`, `blockProps`, `spanComponent`, `spanProps`.

- [ ] **Step 4: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/slots
pnpm -w vitest run packages/storybook
```

Expected: PASS (Slots is touched by React/Vue wrappers — storybook browser tests cover most of it).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): flatten SlotsFeature API"
```

---

### Task 8: Flatten `CaretFeature`

**Files:**
- Modify: `packages/core/src/features/caret/CaretFeature.ts`
- Modify: all external references

- [ ] **Step 1: Rewrite `CaretFeature.ts` to flat fields**

```ts
export class CaretFeature implements Feature {
	readonly recovery = signal<Recovery | undefined>(undefined)
	readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

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

- [ ] **Step 2: Find every external reference**

```bash
rg -n 'feature\.caret\.(state|computed|emit)\.' packages
```

- [ ] **Step 3: Update every hit**

- `feature.caret.state.recovery` → `feature.caret.recovery`
- `feature.caret.state.selecting` → `feature.caret.selecting`

- [ ] **Step 4: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/caret
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): flatten CaretFeature API"
```

---

### Task 9: Flatten `DomFeature`

After Task 2, the reconcile event is gone, so flattening reduces to dropping empty containers. No external refs to rewrite (all three containers are empty).

**Files:**
- Modify: `packages/core/src/features/dom/DomFeature.ts`

- [ ] **Step 1: Remove empty containers**

Delete the three `readonly state / computed / emit = {} as const` lines from `DomFeature.ts`. The class keeps `reconcile()` method and lifecycle.

- [ ] **Step 2: Verify no external refs exist**

```bash
rg -n 'feature\.dom\.(state|computed|emit)\.' packages
```

Expected: no hits.

- [ ] **Step 3: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/dom
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(core): drop empty DomFeature state/computed/emit containers"
```

---

### Task 10: Flatten `DragFeature`

**Files:**
- Modify: `packages/core/src/features/drag/DragFeature.ts`
- Modify: all external references

- [ ] **Step 1: Rewrite `DragFeature.ts` to flat fields**

```ts
export class DragFeature implements Feature {
	readonly drag = event<DragAction>()

	constructor(private readonly store: Store) {}

	#unsub?: () => void

	enable() {
		if (this.#unsub) return
		this.#unsub = watch(this.drag, action => {
			// existing switch body unchanged
		})
	}

	disable() {
		this.#unsub?.()
		this.#unsub = undefined
	}
}
```

Drop the empty `state = {} as const` and `computed = {} as const`.

- [ ] **Step 2: Find every external reference**

```bash
rg -n 'feature\.drag\.(state|computed|emit)\.' packages
```

- [ ] **Step 3: Update every hit**

- `feature.drag.emit.drag` → `feature.drag.drag`

- [ ] **Step 4: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/drag
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): flatten DragFeature API"
```

---

### Task 11: Flatten `KeyboardFeature`

All three containers are empty. Delete them.

**Files:**
- Modify: `packages/core/src/features/keyboard/KeyboardFeature.ts`

- [ ] **Step 1: Remove empty containers**

Drop the three `readonly state / computed / emit = {} as const` lines.

- [ ] **Step 2: Verify no external refs exist**

```bash
rg -n 'feature\.keyboard\.(state|computed|emit)\.' packages
```

Expected: no hits.

- [ ] **Step 3: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/keyboard
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(core): drop empty KeyboardFeature state/computed/emit containers"
```

---

### Task 12: Flatten `ClipboardFeature`

All three containers are empty. Delete them.

**Files:**
- Modify: `packages/core/src/features/clipboard/ClipboardFeature.ts`

- [ ] **Step 1: Remove empty containers**

Drop the three `readonly state / computed / emit = {} as const` lines.

- [ ] **Step 2: Verify no external refs exist**

```bash
rg -n 'feature\.clipboard\.(state|computed|emit)\.' packages
```

Expected: no hits.

- [ ] **Step 3: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/clipboard
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(core): drop empty ClipboardFeature state/computed/emit containers"
```

---

### Task 13: Flatten `ParsingFeature`

Last feature. This is the one that motivated the refactor.

**Files:**
- Modify: `packages/core/src/features/parsing/ParseFeature.ts`
- Modify: all external references

- [ ] **Step 1: Rewrite `ParseFeature.ts` to flat fields**

```ts
export class ParsingFeature implements Feature {
	readonly tokens = signal<Token[]>([])

	readonly parser: Computed<Parser | undefined> = computed(() => {
		if (!this._store.feature.mark.hasMark()) return

		const markups = this._store.props.options().map(opt => opt.markup)
		if (!markups.some(Boolean)) return

		return new Parser(markups, this._store.feature.slots.isBlock() ? {skipEmptyText: true} : undefined)
	})

	readonly reparse = event()

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.sync()
		this.#scope = effectScope(() => {
			this.#subscribeParse()
			this.#subscribeReactiveParse()
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}

	sync() {
		const inputValue = this._store.props.value() ?? this._store.props.defaultValue() ?? ''
		this.tokens(parseWithParser(this._store, inputValue))
		this._store.feature.value.previousValue(inputValue)
	}

	#subscribeParse() {
		watch(this.reparse, () => {
			if (this._store.feature.caret.recovery()) {
				const text = toString(this.tokens())
				this.tokens(parseWithParser(this._store, text))
				this._store.feature.value.previousValue(text)
				return
			}
			this.tokens(
				this._store.nodes.focus.target ? getTokensByUI(this._store) : computeTokensFromValue(this._store)
			)
		})
	}

	#subscribeReactiveParse() {
		const deps = computed(() => [this._store.props.value(), this.parser()] as const)
		watch(deps, () => {
			if (!this._store.feature.caret.recovery()) {
				this.reparse()
			}
		})
	}
}
```

- [ ] **Step 2: Find every external reference**

```bash
rg -n 'feature\.parsing\.(state|computed|emit)\.' packages
```

- [ ] **Step 3: Update every hit**

- `feature.parsing.state.tokens` → `feature.parsing.tokens`
- `feature.parsing.computed.parser` → `feature.parsing.parser`
- `feature.parsing.emit.reparse` → `feature.parsing.reparse`

- [ ] **Step 4: Typecheck and test**

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/parsing
```

Expected: PASS.

- [ ] **Step 5: Sanity sweep — no `.state/.computed/.emit.` left on features**

```bash
rg -n 'feature\.\w+\.(state|computed|emit)\.' packages
```

Expected: no hits.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(core): flatten ParsingFeature API"
```

---

### Task 14: Promote features from `store.feature.*` to `store.*`

With every feature flattened, move them one level up on `Store`.

**Files:**
- Modify: `packages/core/src/store/Store.ts`
- Modify: all external references

- [ ] **Step 1: Refactor `Store.ts`**

```ts
export class Store {
	readonly key = new KeyGenerator()
	readonly blocks = new BlockRegistry()

	readonly nodes = {
		focus: new NodeProxy(undefined, this),
		input: new NodeProxy(undefined, this),
	}

	readonly props = new PropsFeature(this)
	readonly handler = new MarkputHandler(this)

	readonly lifecycle = new LifecycleFeature(this)
	readonly value = new ValueFeature(this)
	readonly mark = new MarkFeature(this)
	readonly overlay = new OverlayFeature(this)
	readonly slots = new SlotsFeature(this)
	readonly caret = new CaretFeature(this)
	readonly keyboard = new KeyboardFeature(this)
	readonly dom = new DomFeature(this)
	readonly drag = new DragFeature(this)
	readonly clipboard = new ClipboardFeature(this)
	readonly parsing = new ParsingFeature(this)

	readonly #features: Feature[] = [
		this.lifecycle,
		this.value,
		this.mark,
		this.overlay,
		this.slots,
		this.caret,
		this.keyboard,
		this.dom,
		this.drag,
		this.clipboard,
		this.parsing,
	]

	constructor() {
		watch(this.lifecycle.mounted, () => this.#features.forEach(f => f.enable()))
		watch(this.lifecycle.unmounted, () => this.#features.forEach(f => f.disable()))
	}

	setProps(values: Parameters<PropsFeature['set']>[0]): void {
		this.props.set(values)
	}
}
```

Import `Feature` from `../shared/types`.

- [ ] **Step 2: Find every external `feature.` reference**

```bash
rg -n '\bstore\.feature\.' packages
rg -n '\b_store\.feature\.' packages
rg -n '\bthis\._store\.feature\.' packages
rg -n '\bthis\.feature\.' packages/core/src
```

- [ ] **Step 3: Drop the `feature.` segment at every hit**

Examples:
- `store.feature.parsing.tokens()` → `store.parsing.tokens()`
- `this._store.feature.value.change` → `this._store.value.change`
- `this.feature.lifecycle.mounted` (inside Store.ts) → `this.lifecycle.mounted`

- [ ] **Step 4: Typecheck and run the full suite**

```bash
pnpm run typecheck
pnpm test
```

Expected: PASS — both core unit tests and storybook browser tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): promote features from store.feature.* to store.*"
```

---

### Task 15: Update architecture docs

The architecture docs and contributor guides describe the old `store.feature.<name>.state/computed/emit` pattern. Update them to match the new API.

**Files:**
- Modify: `packages/website/src/content/docs/development/architecture.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md` (if it mirrors AGENTS.md wording)
- Modify: `packages/core/src/features/lifecycle/README.md`

- [ ] **Step 1: Find every doc mention**

```bash
rg -n 'feature\.\w+\.(state|computed|emit)' packages/website AGENTS.md CLAUDE.md packages/core/src/features/lifecycle/README.md
rg -n 'store\.feature\.' packages/website AGENTS.md CLAUDE.md packages/core/src/features/lifecycle/README.md
```

- [ ] **Step 2: Rewrite prose and code samples**

Any text of the form "features communicate through `store.feature.<name>.state/.computed/.emit`" becomes "features communicate through `store.<name>.*`, `store.props`, and `store.nodes`". Any code fence using the old path updates to the new flat path.

Specifically in `AGENTS.md` lines 58 and 79:
- Line 58: "`store.feature.<name>.state`/`.computed`/`.emit`" → "`store.<name>.*`"
- Line 79: same rewrite
- Line 168 (Testing section): "`store.feature.<name>.state`/`.computed`/`.emit`" → "`store.<name>.*`"

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: update feature API references to flat store.<name> path"
```

---

### Task 16: Final verification

- [ ] **Step 1: Confirm no `feature.` path survives**

```bash
rg -n '\.feature\.' packages
```

Expected: zero hits in source (except possibly in release notes / changelog which we do not rewrite).

- [ ] **Step 2: Run the full check suite**

```bash
pnpm test
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
pnpm run build
```

Expected: every command exits 0.

- [ ] **Step 3: Manual smoke check in Storybook**

```bash
pnpm run dev:sb
```

Open `http://localhost:6006` (React) and `http://localhost:6007` (Vue). Exercise a nested-marks story and an overlay story; confirm typing, caret behaviour, overlay open/close, and drag reordering all still work. If anything regresses, bisect by `git log` of the refactor commits.

---

## Rollback strategy

Every task ends with an isolated commit. If a later task surfaces a regression that was silently introduced earlier, `git bisect` over the 14 refactor commits pinpoints the bad one immediately. Each commit message uses the `refactor(core):` or `docs:` scope so they are easy to filter.
