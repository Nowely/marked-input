# Reactive Names Clarity Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename 12 reactive symbols across 4 core features so each name reads clearly within its feature namespace, per `docs/superpowers/specs/2026-04-23-reactive-names-clarity-design.md`.

**Architecture:** Pure renaming — no behavioural changes. For each feature, modify the class's field names in its `*Feature.ts` file, then propagate the rename through every call site and doc via ripgrep + substitution. TypeScript's type system catches anything missed. One task per feature; each task produces a green, standalone commit.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, oxlint, oxfmt, ripgrep.

---

## Pre-flight verification

Before any code changes, confirm baseline is green:

```bash
pnpm test
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
```

If any fail on `HEAD`, stop and surface the failure — do not mix a broken baseline into the rename.

## Note on repo state

The flattening refactor (`docs/superpowers/plans/2026-04-23-flatten-feature-api.md`) is in progress. Some features are already flat (`ValueFeature` — no `state`/`computed`/`emit` containers; `store.feature.value.previousValue()` at call sites). Others are still nested (`MarkFeature` — `store.feature.mark.computed.hasMark()`). Each task below handles both shapes: ripgrep patterns tolerate an optional container segment, and the class edit respects whatever the file currently uses.

---

## Task 1: Rename `value` feature (3 symbols)

**Renames:** `previousValue → last`, `innerValue → next`, `currentValue → current`. (`change` unchanged.)

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.ts`
- Modify: `packages/core/src/features/value/ValueFeature.spec.ts`
- Modify: `packages/core/src/features/value/README.md`
- Modify: all call sites returned by ripgrep below

### Step 1: Update `ValueFeature.ts` class fields

In `packages/core/src/features/value/ValueFeature.ts`, rename the three reactive fields. The file is already flat (no `state`/`computed` containers):

```ts
export class ValueFeature implements Feature {
	readonly last = signal<string | undefined>(undefined)
	readonly next = signal<string | undefined>(undefined)

	readonly current = computed(() => this.last() ?? this._store.props.value() ?? '')

	readonly change = event()

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			watch(this.change, () => {
				const onChange = this._store.props.onChange()
				const {focus} = this._store.nodes

				if (!focus.target || !focus.target.isContentEditable) {
					const tokens = this._store.feature.parsing.state.tokens()
					const serialized = toString(tokens)
					onChange?.(serialized)
					this.last(serialized)
					trigger(this._store.feature.parsing.state.tokens)
					return
				}

				const tokens = this._store.feature.parsing.state.tokens()
				if (focus.index >= tokens.length) return
				const token = tokens[focus.index]
				if (token.type === 'text') {
					token.content = focus.content
				} else {
					token.value = focus.content
				}

				onChange?.(toString(tokens))
				this._store.feature.parsing.emit.reparse()
			})

			watch(this.next, newValue => {
				if (newValue === undefined) return
				const newTokens = parseWithParser(this._store, newValue)
				batch(() => {
					this._store.feature.parsing.state.tokens(newTokens)
					this.last(newValue)
				})
				this._store.props.onChange()?.(newValue)
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}
```

### Step 2: Enumerate call sites

```bash
rg -n '\.value\.(state\.)?previousValue\b' packages
rg -n '\.value\.(state\.)?innerValue\b' packages
rg -n '\.value\.(computed\.)?currentValue\b' packages
```

### Step 3: Substitute every hit

For every match, replace:
- `value.previousValue` → `value.last`
- `value.state.previousValue` → `value.last` (if still nested)
- `value.innerValue` → `value.next`
- `value.state.innerValue` → `value.next`
- `value.currentValue` → `value.current`
- `value.computed.currentValue` → `value.current`

Expected files touched (from the greps above):
- `packages/core/src/features/parsing/ParseFeature.ts`
- `packages/core/src/features/parsing/ParseFeature.spec.ts`
- `packages/core/src/features/parsing/utils/valueParser.ts`
- `packages/core/src/features/drag/DragFeature.ts`
- `packages/core/src/features/mark/MarkFeature.ts`
- `packages/core/src/features/keyboard/input.ts`
- `packages/core/src/features/keyboard/input.spec.ts`
- `packages/core/src/features/keyboard/blockEdit.ts`
- `packages/core/src/features/clipboard/ClipboardFeature.ts`
- `packages/core/src/features/value/ValueFeature.spec.ts`
- `packages/core/src/store/Store.spec.ts`

### Step 4: Update README and architecture doc

In `packages/core/src/features/value/README.md`, rewrite the State/Computed tables to use `last`, `next`, `current`:

```markdown
## State

| Signal | Purpose                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `last` | Last serialized value pushed to `onChange`. Used to suppress redundant emissions and to seed the next parse.                                            |
| `next` | Intermediate value used by uncontrolled flows (drag reorder, clipboard cut, mark remove). Written by many features; watched by this feature to reparse. |

## Computed

| Value     | Formula                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------- |
| `current` | `last() ?? props.value() ?? ''` — the editable string view used by paste, block edit, copy/cut.    |
```

In `packages/website/src/content/docs/development/architecture.md`, update any reference to `store.feature.value.state.previousValue` / `store.feature.value.state.innerValue` / `store.feature.value.computed.currentValue` to use the new names.

### Step 5: Typecheck and test

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/value packages/core/src/store
```

Expected: PASS (no type errors; all tests green).

### Step 6: Commit

```bash
git add -A
git commit -m "refactor(core): rename ValueFeature previousValue/innerValue/currentValue to last/next/current"
```

---

## Task 2: Rename `mark` feature (3 symbols)

**Renames:** `hasMark → enabled`, `mark → slot`, `markRemove → remove`.

**Files:**
- Modify: `packages/core/src/features/mark/MarkFeature.ts`
- Modify: `packages/core/src/features/mark/MarkFeature.spec.ts`
- Modify: `packages/core/src/features/mark/MarkHandler.ts`
- Modify: `packages/core/src/features/mark/README.md`
- Modify: call sites returned by ripgrep below

### Step 1: Update `MarkFeature.ts` class fields

Preserve whatever container shape the file currently uses. If containers still exist (`state`/`computed`/`emit`), rename inside them; if already flat, rename the top-level fields. Concretely for the current (still-nested) shape:

```ts
export class MarkFeature implements Feature {
	readonly state = {} as const

	readonly computed: {
		enabled: Computed<boolean>
		slot: MarkSlot
	} = {
		enabled: computed(() => {
			const Mark = this._store.props.Mark()
			if (Mark) return true
			return this._store.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
		}),
		slot: computed(() => {
			const options = this._store.props.options()
			const Mark = this._store.props.Mark()
			const Span = this._store.props.Span()
			return (token: Token) => resolveMarkSlot(token, options, Mark, Span)
		}),
	}

	readonly emit = {
		remove: event<{token: Token}>(),
	}

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			watch(this.emit.remove, payload => {
				const {token} = payload
				const tokens = this._store.feature.parsing.state.tokens()
				if (!findToken(tokens, token)) return
				const value = toString(tokens)
				const nextValue = value.slice(0, token.position.start) + value.slice(token.position.end)
				this._store.feature.value.next(nextValue)
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}
```

If `MarkFeature.ts` has been flattened by the time this task runs, apply the same rename at the top level (`readonly enabled = ...`, `readonly slot = ...`, `readonly remove = ...`).

### Step 2: Enumerate call sites

```bash
rg -n '\.mark\.(computed\.)?hasMark\b' packages
rg -n '\.mark\.(computed\.)?mark\b' packages
rg -n '\.mark\.(emit\.)?markRemove\b' packages
```

### Step 3: Substitute every hit

- `mark.hasMark` / `mark.computed.hasMark` → `mark.enabled`
- `mark.mark` / `mark.computed.mark` → `mark.slot`
- `mark.markRemove` / `mark.emit.markRemove` → `mark.remove`

Expected files (from greps):
- `packages/core/src/features/parsing/ParseFeature.ts`
- `packages/react/markput/src/components/Token.tsx` (`resolveMarkSlot: s.feature.mark.mark` → `s.feature.mark.slot`)
- `packages/vue/markput/src/components/Token.vue`
- `packages/core/src/features/mark/MarkHandler.ts` (`.markRemove({token})` → `.remove({token})`)
- `packages/core/src/features/mark/MarkFeature.spec.ts`
- `packages/core/src/store/Store.spec.ts`

### Step 4: Update README and architecture doc

In `packages/core/src/features/mark/README.md`, update any references to `hasMark`, `mark` (computed), `markRemove` to `enabled`, `slot`, `remove`.

In `packages/website/src/content/docs/development/architecture.md`, update the line `store.feature.mark.emit.markRemove({ token })` → `store.feature.mark.remove({token})` (or the post-flatten shape if applicable).

### Step 5: Typecheck and test

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/mark packages/core/src/features/parsing packages/core/src/store
```

Expected: PASS.

### Step 6: Commit

```bash
git add -A
git commit -m "refactor(core): rename MarkFeature hasMark/mark/markRemove to enabled/slot/remove"
```

---

## Task 3: Rename `overlay` feature (5 symbols)

**Renames:** `overlayMatch → match`, `overlay (HTMLElement) → element`, `overlaySlot → slot`, `overlaySelect → select`, `overlayClose → close`.

**Files:**
- Modify: `packages/core/src/features/overlay/OverlayFeature.ts`
- Modify: `packages/core/src/features/overlay/OverlayFeature.spec.ts`
- Modify: `packages/core/src/features/overlay/README.md`
- Modify: `packages/core/src/shared/classes/MarkputHandler.ts`
- Modify: `packages/react/markput/src/lib/hooks/useOverlay.tsx`
- Modify: `packages/react/markput/src/components/OverlayRenderer.tsx`
- Modify: `packages/vue/markput/src/lib/hooks/useOverlay.ts`
- Modify: `packages/vue/markput/src/components/OverlayRenderer.vue`
- Modify: `packages/core/src/store/Store.spec.ts`
- Modify: `packages/website/src/content/docs/development/architecture.md`

### Step 1: Update `OverlayFeature.ts` class fields

Preserve current container shape (nested at time of writing). Rename:

```ts
export class OverlayFeature implements Feature {
	readonly state = {
		match: signal<OverlayMatch | undefined>(undefined),
		element: signal<HTMLElement | null>(null),
	}

	readonly computed: {
		slot: OverlaySlot
	} = {
		slot: computed(() => {
			const Overlay = this._store.props.Overlay()
			return (option?: CoreOption, defaultComponent?: Slot) =>
				resolveOverlaySlot(Overlay, option, defaultComponent)
		}),
	}

	readonly emit = {
		select: event<{mark: Token; match: OverlayMatch}>(),
		close: event(),
	}

	// ... rest of class unchanged except internal references:
	// this.state.overlayMatch → this.state.match
	// this.state.overlay → this.state.element
	// this.emit.overlaySelect → this.emit.select
	// this.emit.overlayClose → this.emit.close
}
```

Apply the internal rename in `#probeTrigger` and both `enable()` watchers inside the same file.

### Step 2: Enumerate call sites

```bash
rg -n '\.overlay\.(state\.)?overlayMatch\b' packages
rg -n '\.overlay\.(state\.)?overlay\b'       packages
rg -n '\.overlay\.(computed\.)?overlaySlot\b' packages
rg -n '\.overlay\.(emit\.)?overlaySelect\b'  packages
rg -n '\.overlay\.(emit\.)?overlayClose\b'   packages
```

### Step 3: Substitute every hit

- `overlay.overlayMatch` / `overlay.state.overlayMatch` → `overlay.match`
- `overlay.overlay` / `overlay.state.overlay` → `overlay.element`
- `overlay.overlaySlot` / `overlay.computed.overlaySlot` → `overlay.slot`
- `overlay.overlaySelect` / `overlay.emit.overlaySelect` → `overlay.select`
- `overlay.overlayClose` / `overlay.emit.overlayClose` → `overlay.close`

Be precise with the `overlay.overlay` → `overlay.element` substitution — use word boundaries so you don't inadvertently touch `overlay.overlayMatch` or other members. A safe sed pattern: `s/\boverlay\.overlay\b([^A-Za-z])/overlay.element\1/g` (or do it manually per hit).

### Step 4: Update README and architecture doc

In `packages/core/src/features/overlay/README.md`, replace any occurrences of the old names.

In `packages/website/src/content/docs/development/architecture.md`, update:
- `store.feature.overlay.state.overlayMatch` → `store.feature.overlay.match` (or post-flatten shape)
- `store.feature.overlay.emit.overlaySelect()` → `store.feature.overlay.select()`
- `store.feature.overlay.emit.overlayClose()` → `store.feature.overlay.close()`

### Step 5: Typecheck and test

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/overlay packages/core/src/store
pnpm test
```

Expected: PASS (core + storybook tests including React/Vue hook consumers).

### Step 6: Commit

```bash
git add -A
git commit -m "refactor(core): rename OverlayFeature overlayMatch/overlay/overlaySlot/overlaySelect/overlayClose to match/element/slot/select/close"
```

---

## Task 4: Rename `drag` feature (1 symbol)

**Rename:** `drag → action`.

**Files:**
- Modify: `packages/core/src/features/drag/DragFeature.ts`
- Modify: `packages/core/src/features/drag/DragFeature.spec.ts`
- Modify: `packages/core/src/features/drag/README.md`
- Modify: any consumer returned by ripgrep below

### Step 1: Update `DragFeature.ts`

```ts
export class DragFeature {
	readonly state = {} as const
	readonly computed = {} as const
	readonly emit = {
		action: event<DragAction>(),
	}

	// ... rest unchanged, but update the watcher:
	// this.#unsub = watch(this.emit.action, action => { ... })
}
```

### Step 2: Enumerate call sites

```bash
rg -n '\.drag\.(emit\.)?drag\b' packages
```

### Step 3: Substitute every hit

- `drag.drag` / `drag.emit.drag` → `drag.action`

### Step 4: Update README

In `packages/core/src/features/drag/README.md`, rename any reference.

### Step 5: Typecheck and test

```bash
pnpm run typecheck
pnpm -w vitest run packages/core/src/features/drag packages/core/src/store
```

Expected: PASS.

### Step 6: Commit

```bash
git add -A
git commit -m "refactor(core): rename DragFeature emit.drag to action"
```

---

## Post-rename verification

After all four tasks land, run the full gauntlet:

```bash
pnpm test
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
pnpm run build
```

Expected: all green. No functional behaviour changed; this is purely a naming refactor, so tests pass with zero logic updates.

## Self-review checklist (completed)

1. **Spec coverage:** All 12 renames in the spec map to concrete tasks (Task 1: 3, Task 2: 3, Task 3: 5, Task 4: 1 = 12). `change` in `value` is explicitly noted as unchanged.
2. **Placeholder scan:** No TBD / TODO / "implement later" strings. All ripgrep patterns, substitutions, and file paths are concrete.
3. **Type consistency:** New names used in later tasks (`value.next` called from Mark's `remove` handler in Task 2) reference names introduced in earlier tasks (Task 1's `next`). Cross-feature consumers update in their own task.
