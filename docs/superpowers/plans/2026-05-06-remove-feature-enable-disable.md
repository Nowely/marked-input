# Remove enable/disable from Feature interface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `enable()`/`disable()` from the mandatory `Feature` interface. Always-on features self-subscribe to lifecycle events in their constructors. Conditional features (drag, overlay, parsing) use reactive enable/disable gated by props.

**Architecture:** Each feature owns its lifecycle. The `Feature` interface becomes an empty marker (or is removed entirely). Store.ts drops the features array and batch enable/disable calls. Three features (drag, overlay, parsing) keep `enable()`/`disable()` methods called reactively when gating props change — no manual unmount wiring needed.

**Tech Stack:** TypeScript, `@markput/core` signals (`signal`, `watch`, `effectScope`)

---

### Task 1: Drop enable/disable from Feature interface

**Files:**
- Modify: `packages/core/src/shared/types.ts:155-158`

- [ ] **Step 1: Remove methods from Feature interface**

Make `Feature` an empty interface (or remove it if nothing references it).

```ts
// BEFORE:
export interface Feature {
	enable(): void
	disable(): void
}

// AFTER:
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Feature {}
```

- [ ] **Step 2: Check for type errors**

Run: `pnpm -w exec tsc --noEmit -p packages/core/tsconfig.json 2>&1 | head -80`
Expected: No type errors from the interface change itself (remaining errors come from Store.ts and feature files still using enable/disable, which will be fixed in later tasks).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/shared/types.ts
git commit -m "refactor: drop enable/disable from Feature interface"
```

---

### Task 2: Update Store.ts — remove features array and batch lifecycle calls

**Files:**
- Modify: `packages/core/src/store/Store.ts`

- [ ] **Step 1: Remove batch enable/disable in Store constructor**

```ts
// BEFORE (lines 39-55):
constructor() {
    const features: Feature[] = [
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
    watch(this.lifecycle.mounted, () => features.forEach(f => f.enable()))
    watch(this.lifecycle.unmounted, () => features.forEach(f => f.disable()))
}

// AFTER:
constructor() {}
```

Remove unused imports `watch` and `Feature` from lines 14 and 15.

```ts
// Remove line 14:
import {watch} from '../shared/signals'
// Remove line 15:
import type {Feature} from '../shared/types'
```

- [ ] **Step 2: Check for type errors**

Run: `pnpm -w exec tsc --noEmit -p packages/core/tsconfig.json 2>&1 | head -40`
Expected: Some existing errors from features still importing/enforcing `implements Feature`, but no errors in Store.ts itself.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/store/Store.ts
git commit -m "refactor: remove batch feature enable/disable from Store"
```

---

### Task 3: Always-on features — self-wire lifecycle in constructors

**Files:**
- Modify: `packages/core/src/features/caret/CaretFeature.ts`
- Modify: `packages/core/src/features/keyboard/KeyboardFeature.ts`
- Modify: `packages/core/src/features/clipboard/ClipboardFeature.ts`
- Modify: `packages/core/src/features/value/ValueFeature.ts`
- Modify: `packages/core/src/features/dom/DomFeature.ts`
- Modify: `packages/core/src/features/slots/SlotsFeature.ts`
- Modify: `packages/core/src/features/lifecycle/LifecycleFeature.ts`

All features below drop `implements Feature` and `import type {Feature}`. Slots and Lifecycle drop empty enable/disable entirely.

- [ ] **Step 1: Update CaretFeature**

```ts
// BEFORE (full file):
import type {CaretLocation, CaretRecovery, Result, TokenAddress} from '../../shared/editorContracts'
import {signal} from '../../shared/signals'
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'
import {enableFocus} from './focus'
import {enableSelection} from './selection'

export class CaretFeature implements Feature {
    readonly recovery = signal<CaretRecovery | undefined>(undefined)
    readonly location = signal<CaretLocation | undefined>(undefined)
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

    placeAt(...) { ... }
    focus(...) { ... }
}

// AFTER:
import type {CaretLocation, CaretRecovery, Result, TokenAddress} from '../../shared/editorContracts'
import {signal, watch} from '../../shared/signals'
import type {Store} from '../../store/Store'
import {enableFocus} from './focus'
import {enableSelection} from './selection'

export class CaretFeature {
    readonly recovery = signal<CaretRecovery | undefined>(undefined)
    readonly location = signal<CaretLocation | undefined>(undefined)
    readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

    #disposers: Array<() => void> = []

    constructor(private readonly _store: Store) {
        watch(this._store.lifecycle.mounted, () => {
            if (this.#disposers.length) return
            this.#disposers = [enableFocus(this._store), enableSelection(this._store)]
        })
        watch(this._store.lifecycle.unmounted, () => {
            this.#disposers.forEach(d => d())
            this.#disposers = []
        })
    }

    placeAt(...) { ... }
    focus(...) { ... }
}
```

- [ ] **Step 2: Update KeyboardFeature**

```ts
// BEFORE (full file):
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'
import {enableArrowNav} from './arrowNav'
import {enableBlockEdit} from './blockEdit'
import {enableInput} from './input'

export class KeyboardFeature implements Feature {
    #disposers: Array<() => void> = []

    constructor(private readonly _store: Store) {}

    enable() {
        if (this.#disposers.length) return
        this.#disposers = [enableInput(this._store), enableBlockEdit(this._store), enableArrowNav(this._store)]
    }

    disable() {
        this.#disposers.forEach(d => d())
        this.#disposers = []
    }
}

// AFTER:
import {watch} from '../../shared/signals'
import type {Store} from '../../store/Store'
import {enableArrowNav} from './arrowNav'
import {enableBlockEdit} from './blockEdit'
import {enableInput} from './input'

export class KeyboardFeature {
    #disposers: Array<() => void> = []

    constructor(private readonly _store: Store) {
        watch(this._store.lifecycle.mounted, () => {
            if (this.#disposers.length) return
            this.#disposers = [enableInput(this._store), enableBlockEdit(this._store), enableArrowNav(this._store)]
        })
        watch(this._store.lifecycle.unmounted, () => {
            this.#disposers.forEach(d => d())
            this.#disposers = []
        })
    }
}
```

- [ ] **Step 3: Update ClipboardFeature**

```ts
// Remove `import type {Feature} from '../../shared/types'` after the existing imports.
// Remove `implements Feature`.

// BEFORE:
export class ClipboardFeature {
    // ...fields...

    constructor(private readonly store: Store) {}

    enable() {
        if (this.#scope) return
        // ...sets up copy/cut listeners...
    }
    disable() { ... }
}

// AFTER:
import {watch, effectScope, listen} from '../../shared/signals/index.js'
// (effectScope and listen already imported)

export class ClipboardFeature {
    // ...fields...

    constructor(private readonly store: Store) {
        watch(this.store.lifecycle.mounted, () => {
            if (this.#scope) return
            const container = this.store.dom.container()
            if (!container) return
            this.#scope = effectScope(() => {
                listen(container, 'copy', e => { this.#handleCopy(e) })
                listen(container, 'cut', e => {
                    if (!this.#handleCopy(e)) return
                    const raw = this.store.dom.readRawSelection()
                    if (!raw.ok || raw.value.range.start === raw.value.range.end) return
                    this.store.value.replaceRange(raw.value.range, '', {
                        source: 'cut',
                        recover: {kind: 'caret', rawPosition: raw.value.range.start},
                    })
                })
            })
        })
        watch(this.store.lifecycle.unmounted, () => {
            this.#scope?.()
            this.#scope = undefined
        })
    }

    // enable() and disable() are REMOVED
    // #handleCopy stays as-is

    #handleCopy(e: ClipboardEvent): boolean { ... }
}
```

- [ ] **Step 4: Update ValueFeature**

```ts
// BEFORE (constructor + enable/disable):
constructor(private readonly _store: Store) {}

enable() {
    if (this.#scope) return
    this.#commitAccepted(this._store.props.value() ?? this._store.props.defaultValue() ?? '')
    this.#scope = effectScope(() => {
        watch(this._store.props.value, value => {
            if (value === undefined) return
            if (value === this.current()) return
            const recovery = this.#controlledEcho.onEcho(value)
            this.#commitAccepted(value)
            if (recovery) this._store.caret.recovery(recovery)
            this.change()
        })
    })
}

disable() {
    this.#scope?.()
    this.#scope = undefined
}

// AFTER:
import {signal, computed, event, batch, effectScope, watch} from '../../shared/signals/index.js'

constructor(private readonly _store: Store) {
    watch(this._store.lifecycle.mounted, () => {
        if (this.#scope) return
        this.#commitAccepted(this._store.props.value() ?? this._store.props.defaultValue() ?? '')
        this.#scope = effectScope(() => {
            watch(this._store.props.value, value => {
                if (value === undefined) return
                if (value === this.current()) return
                const recovery = this.#controlledEcho.onEcho(value)
                this.#commitAccepted(value)
                if (recovery) this._store.caret.recovery(recovery)
                this.change()
            })
        })
    })
    watch(this._store.lifecycle.unmounted, () => {
        this.#scope?.()
        this.#scope = undefined
    })
}
```

Remove `implements Feature` and `import type {Feature}` from imports.

- [ ] **Step 5: Update DomFeature**

```ts
// BEFORE:
constructor(private readonly _store: Store) {}

enable() {
    if (this.#scope) return
    this.#scope = effectScope(() => {
        watch(this._store.lifecycle.rendered, () => {
            this.#handleRendered()
        })
        watch(
            computed(() => ({
                readOnly: this._store.props.readOnly(),
                selecting: this._store.caret.selecting(),
            })),
            () => this.reconcile()
        )
    })
}

disable() {
    this.#scope?.()
    this.#scope = undefined
}

// AFTER:
constructor(private readonly _store: Store) {
    watch(this._store.lifecycle.mounted, () => {
        if (this.#scope) return
        this.#scope = effectScope(() => {
            watch(this._store.lifecycle.rendered, () => {
                this.#handleRendered()
            })
            watch(
                computed(() => ({
                    readOnly: this._store.props.readOnly(),
                    selecting: this._store.caret.selecting(),
                })),
                () => this.reconcile()
            )
        })
    })
    watch(this._store.lifecycle.unmounted, () => {
        this.#scope?.()
        this.#scope = undefined
    })
}
```

- [ ] **Step 6: Update SlotsFeature — drop empty stubs and interface**

```ts
// BEFORE (class declaration):
export class SlotsFeature implements Feature {
    // ...computed fields...
    constructor(private readonly _store: Store) {}
    enable() {}
    disable() {}
}

// AFTER:
export class SlotsFeature {
    // ...computed fields...
    constructor(private readonly _store: Store) {}
}
```

Remove `Feature` from imports, remove `implements Feature`.

- [ ] **Step 7: Update LifecycleFeature — drop empty stubs and interface**

```ts
// BEFORE:
import {event} from '../../shared/signals'
import type {Feature} from '../../shared/types'

export class LifecycleFeature implements Feature {
    readonly mounted = event()
    readonly unmounted = event()
    readonly rendered = event()

    enable() {}
    disable() {}
}

// AFTER:
import {event} from '../../shared/signals'

export class LifecycleFeature {
    readonly mounted = event()
    readonly unmounted = event()
    readonly rendered = event()
}
```

- [ ] **Step 8: Check typecheck**

Run: `pnpm run typecheck`
Expected: No errors from these feature changes. Some existing pre-existing errors may remain (not from this change).

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/features/caret/CaretFeature.ts \
    packages/core/src/features/keyboard/KeyboardFeature.ts \
    packages/core/src/features/clipboard/ClipboardFeature.ts \
    packages/core/src/features/value/ValueFeature.ts \
    packages/core/src/features/dom/DomFeature.ts \
    packages/core/src/features/slots/SlotsFeature.ts \
    packages/core/src/features/lifecycle/LifecycleFeature.ts
git commit -m "refactor: self-wire lifecycle for always-on features"
```

---

### Task 4: DragFeature — reactive enable/disable by props

**Files:**
- Modify: `packages/core/src/features/drag/DragFeature.ts`

- [ ] **Step 1: Add reactive gating to DragFeature**

```ts
// BEFORE (class + enable/disable):
import type {DragAction} from '../../shared/types'
import type {Store} from '../../store/Store'
import {event, watch} from '../../shared/signals'
// ...other imports...

export class DragFeature {
    readonly action = event<DragAction>()

    constructor(private readonly store: Store) {}

    #unsub?: () => void

    enable() {
        if (this.#unsub) return
        this.#unsub = watch(this.action, action => {
            switch (action.type) {
                // ...cases...
            }
        })
    }

    disable() {
        this.#unsub?.()
        this.#unsub = undefined
    }
    // ...#reorder, #add, #delete, #duplicate, #recoverAfterDrag...
}

// AFTER:
import type {DragAction} from '../../shared/types'
import type {Store} from '../../store/Store'
import {computed, event, watch} from '../../shared/signals'
// ...other imports...

export class DragFeature {
    readonly action = event<DragAction>()

    #unsub?: () => void

    constructor(private readonly store: Store) {
        watch(
            computed(() => this.store.props.layout() === 'block' && !!this.store.props.draggable()),
            (enabled) => {
                if (enabled && !this.#unsub) {
                    this.#unsub = watch(this.action, action => {
                        switch (action.type) {
                            case 'reorder': this.#reorder(action); break
                            case 'add': this.#add(action); break
                            case 'delete': this.#delete(action); break
                            case 'duplicate': this.#duplicate(action); break
                        }
                    })
                }
                if (!enabled && this.#unsub) {
                    this.#unsub()
                    this.#unsub = undefined
                }
            }
        )
    }

    // enable() and disable() are REMOVED
    // #reorder, #add, #delete, #duplicate, #recoverAfterDrag stay as-is
}
```

- [ ] **Step 2: Check typecheck**

Run: `pnpm -w exec tsc --noEmit -p packages/core/tsconfig.json 2>&1 | head -40`
Expected: No errors in DragFeature.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/drag/DragFeature.ts
git commit -m "refactor: reactive enable/disable for DragFeature via layout+ draggable props"
```

---

### Task 5: MarkFeature — drop empty stubs

**Files:**
- Modify: `packages/core/src/features/mark/MarkFeature.ts`

- [ ] **Step 1: Remove enable/disable and interface**

```ts
// BEFORE:
import type {Feature} from '../../shared/types'
// ...other imports...

export class MarkFeature implements Feature {
    // ...computed fields...

    constructor(private readonly _store: Store) {}

    enable() {}
    disable() {}
}

// AFTER:
import type {Store} from '../../store/Store'
// ...other imports (no Feature import)...

export class MarkFeature {
    // ...computed fields...

    constructor(private readonly _store: Store) {}
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/features/mark/MarkFeature.ts
git commit -m "refactor: drop empty enable/disable from MarkFeature"
```

---

### Task 6: OverlayFeature — reactive enable/disable

**Files:**
- Modify: `packages/core/src/features/overlay/OverlayFeature.ts`

The overlay feature is always-on in practice (showOverlayOn docs default to 'change' and triggers are check at call sites), but we make it reactive for consistency. The gating is: enabled when there's at least one option with `overlay.trigger`.

- [ ] **Step 1: Add reactive gating to OverlayFeature constructor**

```ts
// Change the constructor to gate on whether any option has overlay.trigger:

import {signal, computed, event, effectScope, effect, watch, listen} from '../../shared/signals/index.js'
import type {CoreOption, OverlayMatch, OverlayTrigger, Slot} from '../../shared/types'

// Remove `implements Feature` and `import type {Feature}` from imports.

constructor(private readonly _store: Store) {
    const hasOverlayTrigger = computed(() =>
        this._store.props.options().some(opt => opt.overlay?.trigger != null)
    )

    watch(hasOverlayTrigger, (enabled) => {
        if (enabled && !this.#scope) {
            this.#scope = effectScope(() => {
                // ... entire current enable() body ...
            })
        }
        if (!enabled && this.#scope) {
            this.#scope()
            this.#scope = undefined
        }
    })
}

// enable() and disable() methods are REMOVED
// #probeTrigger, #probeTriggerFromRecovery stay as-is
```

The enable body moves literally into the `effectScope(() => { ... })` inside the watcher. Import `computed` if not already imported.

- [ ] **Step 2: Check typecheck**

Run: `pnpm -w exec tsc --noEmit -p packages/core/tsconfig.json 2>&1 | head -40`
Expected: No errors in OverlayFeature.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/overlay/OverlayFeature.ts
git commit -m "refactor: reactive enable/disable for OverlayFeature via overlay.trigger prop"
```

---

### Task 7: ParsingFeature — reactive enable/disable by mark.enabled

**Files:**
- Modify: `packages/core/src/features/parsing/ParseFeature.ts`

ParsingFeature is only needed when marks exist. When no marks are configured, plain text tokenization works fine through `parseValue()`/`acceptTokens()` as utility functions called by ValueFeature. The reactive watchers (reparse, parser changes) are only meaningful when marks drive parser rebuilds.

- [ ] **Step 1: Gate on store.mark.enabled**

```ts
// BEFORE (constructor + enable/disable):
import {signal, computed, event, effectScope, watch, batch} from '../../shared/signals/index.js'
import type {Feature} from '../../shared/types'

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

// AFTER:
import {signal, computed, event, effectScope, watch, batch} from '../../shared/signals/index.js'

constructor(private readonly _store: Store) {
    watch(this._store.mark.enabled, (enabled) => {
        if (enabled && !this.#scope) {
            this.sync()
            this.#scope = effectScope(() => {
                this.#subscribeParse()
                this.#subscribeReactiveParse()
            })
        }
        if (!enabled && this.#scope) {
            this.#scope()
            this.#scope = undefined
        }
    })
}
```

The `parseValue()` and `acceptTokens()` public methods remain available — they're called by ValueFeature on every value change regardless of whether the reactive scope is active. Without marks, they produce text-only tokens.

Remove `implements Feature` and `import type {Feature}` from imports.

- [ ] **Step 2: Check typecheck**

Run: `pnpm -w exec tsc --noEmit -p packages/core/tsconfig.json 2>&1 | head -40`
Expected: No errors in ParsingFeature.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/parsing/ParseFeature.ts
git commit -m "refactor: reactive enable/disable for ParsingFeature via mark.enabled"
```

---

### Task 8: Update Store.spec.ts — remove lifecycle orchestration test

**Files:**
- Modify: `packages/core/src/store/Store.spec.ts`

- [ ] **Step 1: Remove tests that verify batch enable/disable**

Remove the two test blocks that spy on all features' enable/disable:

**Remove "enables all features on mount"** (approximately lines 30-52):
```ts
// DELETE this entire test:
it('enables all features on mount', () => {
    const features = [
        store.lifecycle,
        store.value,
        store.mark,
        store.overlay,
        store.slots,
        store.caret,
        store.keyboard,
        store.dom,
        store.drag,
        store.clipboard,
        store.parsing,
    ]
    const spies = features.map(feature => vi.spyOn(feature, 'enable').mockImplementation(() => {}))
    store.lifecycle.mounted()
    for (const spy of spies) {
        expect(spy).toHaveBeenCalledOnce()
    }
})
```

**Remove "disables all features on unmount"** (approximately lines 55-77):
```ts
// DELETE this entire test:
it('disables all features on unmount', () => {
    const features = [...]
    const spies = features.map(feature => vi.spyOn(feature, 'disable').mockImplementation(() => {}))
    store.lifecycle.unmounted()
    for (const spy of spies) {
        expect(spy).toHaveBeenCalledOnce()
    }
})
```

**Update "mounts features in an order that supports initial render indexing"** (approximately lines 79-93):
```ts
// BEFORE:
it('mounts features in an order that supports initial render indexing', () => {
    store.props.set({...})
    store.lifecycle.mounted()
    store.lifecycle.rendered()
    // ...assertions...
})

// AFTER: Remove store.lifecycle.mounted() from this test — it's no longer the trigger.
// Features now self-subscribe in their constructors, so lifecycle events happen automatically
// when the adapter calls them. Tests that need mounted state can call mounted() directly.
it('mounts features in an order that supports initial render indexing', () => {
    store.props.set({...})
    store.lifecycle.mounted()  // features self-wired, this triggers their internal setup
    store.lifecycle.rendered()
    // ...assertions...
})
```

Keep the `store.lifecycle.mounted()` call — it still triggers the features' internal `watch` callbacks.

- [ ] **Step 2: Update test helper that mocks enable/disable on all features**

Find the pattern where all features are mocked and update it (used in ParseFeature.spec.ts, DragFeature.spec.ts, CaretFeature.spec.ts).

Remove the `vi.spyOn(features[key], 'enable').mockImplementation(() => {})` / `vi.spyOn(features[key], 'disable').mockImplementation(() => {})` blocks in these files:

1. `packages/core/src/features/parsing/ParseFeature.spec.ts` — lines ~10-25
2. `packages/core/src/features/drag/DragFeature.spec.ts` — lines ~17-32
3. `packages/core/src/features/caret/focus.spec.ts` — lines ~18-33

In each file, replace the mass spy block with individual feature mocks for features that still have side effects (e.g., mock only the specific methods that cause interference).

For ParseFeature.spec.ts:
```ts
// BEFORE (approximately):
const features = {lifecycle: store.lifecycle, value: store.value, ...}
for (const key of Object.keys(features)) {
    vi.spyOn(features[key], 'enable').mockImplementation(() => {})
    vi.spyOn(features[key], 'disable').mockImplementation(() => {})
}

// AFTER: Individual mocks for features with side-effects
// Key issue: the Store constructor now self-wires features, so we need to mock
// the side effects before construction or in the test setup.
// Strategy: spy on individual methods/lifecycle events instead.
// Since enable/disable no longer exist on most features, these mass mocks are no-ops.
// Remove the block entirely. If specific side-effects are needed, mock individually.
```

For DragFeature.spec.ts:
```ts
// The existing pattern disabled all features except drag via mass spy.
// Now that only drag has enable/disable, and it reacts to props rather than lifecycle,
// we can set props and observe the drag action listener directly.
// Remove the mass spy block.
```

For focus.spec.ts:
```ts
// Remove mass spy block. If CaretFeature focus tests need DOM setup,
// they already call store.lifecycle.mounted() / store.lifecycle.rendered() explicitly.
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/store/Store.spec.ts \
    packages/core/src/features/parsing/ParseFeature.spec.ts \
    packages/core/src/features/drag/DragFeature.spec.ts \
    packages/core/src/features/caret/focus.spec.ts
git commit -m "test: update tests for removed enable/disable lifecycle"
```

---

### Task 9: Update remaining test files with enable/disable calls

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.spec.ts`
- Modify: `packages/core/src/features/dom/DomFeature.spec.ts`
- Modify: `packages/core/src/features/parsing/ParseFeature.spec.ts`
- Modify: `packages/core/src/features/overlay/OverlayFeature.spec.ts`
- Modify: `packages/core/src/features/drag/DragFeature.spec.ts`
- Modify: `packages/core/src/features/caret/selection.spec.ts`
- Modify: `packages/core/src/features/caret/focus.spec.ts`
- Modify: `packages/core/src/features/mark/MarkFeature.spec.ts`
- Modify: `packages/core/src/features/mark/MarkController.spec.ts`
- Modify: `packages/core/src/features/keyboard/input.spec.ts`

- [ ] **Step 1: Replace `store.<feature>.enable()` with `store.lifecycle.mounted()`**

In all test files, replace direct enable/disable calls with lifecycle event emissions:

```ts
// INSTEAD OF:
store.value.enable()
// ...test...
store.value.disable()

// USE:
store.lifecycle.mounted()
// ...test...
store.lifecycle.unmounted()
```

For ParseFeature.spec.ts — ParsingFeature now watches `store.mark.enabled` rather than lifecycle.
Disable/re-enable on each test by toggling marks:
```ts
// Enable (set Mark component to trigger mark.enabled):
store.props.set({Mark: () => null})
// ParsingFeature's scope is now active

// Disable (remove Mark):
store.props.set({Mark: undefined})
// ParsingFeature's scope is torn down
```

Tests that call `store.parsing.enable()` / `store.parsing.disable()` need to set `props.Mark` instead. The `parseValue()` and `acceptTokens()` methods remain callable regardless of scope state — they're pure utility functions.

For ValueFeature.spec.ts — replace all `store.value.enable()` / `store.value.disable()`:
```ts
store.lifecycle.mounted()
// ...test...
store.lifecycle.unmounted()
```

For OverlayFeature.spec.ts — OverlayFeature now watches `props.options` for overlay triggers.
Enable by setting an option with overlay.trigger:
```ts
store.props.set({options: [{markup: 'foo', overlay: {trigger: '@'}}]})
// OverlayFeature's scope is now active

// Disable by clearing options:
store.props.set({options: []})
```

For DomFeature.spec.ts — update `enableStructuralStore()` and the line 160 `beforeEach`:
```ts
// enableStructuralStore helper:
// BEFORE:
function enableStructuralStore(store: Store) {
    store.value.enable()
    store.dom.enable()
}

// AFTER:
function enableStructuralStore(store: Store) {
    store.lifecycle.mounted()
}
// Note: do NOT call rendered() here — no container is set yet.
// Individual mount helpers (mountStructuralInline, etc.) call rendered() after setting container.

// Line ~160 in DomFeature.spec.ts structural indexing describe block:
// BEFORE (inside beforeEach):
store.value.enable()

// AFTER:
store.lifecycle.mounted()
```

For DragFeature.spec.ts — update tests that call `store.drag.enable()`:
```ts
// DragFeature no longer has enable/disable. To trigger its action listener,
// set layout and draggable props:
store.props.set({layout: 'block', draggable: true})
// The constructor's watch on computed props will fire on next tick

// To disable:
store.props.set({layout: 'inline'})
```

For MarkFeature.spec.ts — remove the idempotency test:
```ts
// REMOVE:
it('is safe to call after enable', () => {
    store.mark.enable()
    expect(() => store.mark.disable()).not.toThrow()
})
```

For selection.spec.ts — CaretFeature now wires via `lifecycle.mounted()`, which also triggers other features:
```ts
store.lifecycle.mounted()
// ...test...
store.lifecycle.unmounted()
```

WARNING: The test at ~line 23-24 (`enable() sets up the selecting subscription via effect`) asserts
`expect(addSpy).toHaveBeenCalledTimes(4)` against `document.addEventListener`. After the change,
`lifecycle.mounted()` triggers ALL features' setup, adding more listeners. Update expected count
or restructure the test to verify selection behavior specifically (e.g., assert `store.caret.selecting`
changes rather than counting document-level listeners).

For focus.spec.ts — replace `store.caret.enable()` / `store.caret.disable()`:
```ts
store.lifecycle.mounted()
// ...test...
store.lifecycle.unmounted()
```

For MarkController.spec.ts — replace `store.value.enable()`:
```ts
store.lifecycle.mounted()
```

For input.spec.ts — replace `store.value.enable()` / `store.dom.enable()`:
```ts
store.lifecycle.mounted()
store.lifecycle.rendered()
```

- [ ] **Step 2: Update idempotency tests**

For tests that verify double-enable is safe (ParseFeature.spec.ts line 93, OverlayFeature.spec.ts line 80, selection.spec.ts line 29, etc.):

Since enable/disable guard with `if (this.#scope) return` / `if (this.#disposers.length) return`, the watch callback in the constructor has the same property — calling `lifecycle.mounted()` twice is safe. Keep these tests but change them to call `store.lifecycle.mounted()` twice:

```ts
it('is safe to call enable twice', () => {
    store.lifecycle.mounted()
    expect(() => store.lifecycle.mounted()).not.toThrow()
})
```

- [ ] **Step 3: Run tests to verify**

Run: `pnpm -w exec vitest run packages/core/src/ 2>&1 | tail -40`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/value/ValueFeature.spec.ts \
    packages/core/src/features/dom/DomFeature.spec.ts \
    packages/core/src/features/parsing/ParseFeature.spec.ts \
    packages/core/src/features/overlay/OverlayFeature.spec.ts \
    packages/core/src/features/drag/DragFeature.spec.ts \
    packages/core/src/features/caret/selection.spec.ts \
    packages/core/src/features/caret/focus.spec.ts \
    packages/core/src/features/mark/MarkFeature.spec.ts \
    packages/core/src/features/mark/MarkController.spec.ts \
    packages/core/src/features/keyboard/input.spec.ts
git commit -m "test: replace enable/disable calls with lifecycle events"
```

---

### Task 10: Remove Feature interface if nothing references it

**Files:**
- Check: `packages/core/src/shared/types.ts`
- Possibly modify: any remaining imports of `Feature`

- [ ] **Step 1: Search for remaining Feature references**

Run: `rg "Feature" packages/core/src/shared/types.ts`
Expected: Only the interface declaration line.

Run: `rg "implements Feature" packages/core/src/`
Expected: No matches (all removed in earlier tasks).

Run: `rg "from '.*types'.*Feature" packages/core/src/`
Expected: No matches importing Feature from types.

- [ ] **Step 2: Remove Feature interface if unused**

If no references remain:
```ts
// REMOVE lines 155-157 from types.ts:
export interface Feature {}
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/shared/types.ts
git commit -m "refactor: remove Feature interface"
```

---

### Task 11: Remove Feature from public API if exported

**Files:**
- Check: `packages/core/package.json` (exports/typesVersions), `packages/core/tsconfig.json`

- [ ] **Step 1: Check if Feature is publicly exposed**

Run: `rg "Feature" packages/core/src/index.ts 2>/dev/null || echo "no index.ts"`

Run: `rg "Feature" packages/core/package.json`

If `Feature` is not exported anywhere, this task is a no-op. If it is exported (e.g., via `typesVersions` or barrel re-export), check and remove it. Per YAGNI, remove if unused.

- [ ] **Step 2: Commit (if needed)**

```bash
git add packages/core/package.json  # if changed
git commit -m "refactor: remove Feature from public API exports"
```

---

### Task 12: Full verification

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```
Expected: All tests pass.

- [ ] **Step 2: Run typecheck**

```bash
pnpm run typecheck
```
Expected: No new errors.

- [ ] **Step 3: Run build**

```bash
pnpm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Run lint**

```bash
pnpm run lint:check
pnpm run format:check
```
Expected: No lint/format errors.

- [ ] **Step 5: Update docs if architecture docs reference enable/disable**

Check `packages/website/src/content/docs/development/architecture.md` for any mention of enable/disable lifecycle and update if needed.

- [ ] **Step 6: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: verify build, typecheck, lint, and docs after enable/disable removal"
```
