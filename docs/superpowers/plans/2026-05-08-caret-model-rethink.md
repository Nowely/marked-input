# CaretModel Rethink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate caret state, DOM listeners, and DOM commands into a refactored `CaretModel` (2 deps: `lifecycle`, `dom`), delete the static `Caret` class (splitting DOM-coordinate helpers into `caretDom.ts` and overlay positioning into `OverlayController`), and rename `DomController`'s placement API.

**Architecture:** Four independent phases, each shippable on its own. Phase 1 adds semantic commands to `CaretModel` and migrates callers. Phase 2 moves DOM listeners and restoration into `CaretModel`, flips the `caret`/`dom` dependency direction. Phase 3 deletes `Caret.ts`, creates `caretDom.ts`, moves overlay positioning, and updates public exports. Phase 4 renames `placeCaretAtRawPosition` → `placeAt` and promotes `#placeSelection` → `placeRange`.

**Tech Stack:** TypeScript, Vitest, alien-signals (custom reactive). Test command: `pnpm --filter @markput/core test --run`. Current baseline: **545 passing + 1 todo**.

---

## File Map

### Phase 1

| Action | File |
|---|---|
| Modify | `packages/core/src/features/caret/CaretModel.ts` |
| Modify | `packages/core/src/features/caret/CaretModel.spec.ts` |
| Modify | `packages/core/src/features/caret/selection.ts` |
| Modify | `packages/core/src/features/keyboard/input.ts` |
| Modify | `packages/core/src/features/keyboard/arrowNav.ts` |
| Modify | `packages/core/src/features/overlay/OverlayController.ts` |
| Modify | `packages/core/src/features/keyboard/blockEdit.ts` |
| Modify | `packages/core/src/features/clipboard/ClipboardController.ts` |
| Modify | `packages/core/src/features/dom/DomController.ts` |
| Delete | `packages/core/src/features/caret/selectionHelpers.ts` |

### Phase 2

| Action | File |
|---|---|
| Modify | `packages/core/src/features/dom/DomController.ts` |
| Modify | `packages/core/src/features/caret/CaretModel.ts` |
| Modify | `packages/core/src/features/caret/CaretModel.spec.ts` |
| Modify | `packages/core/src/features/caret/focus.spec.ts` → cases fold in |
| Modify | `packages/core/src/features/caret/selection.spec.ts` → cases fold in |
| Modify | `packages/core/src/store/Store.ts` |
| Delete | `packages/core/src/features/caret/focus.ts` |
| Delete | `packages/core/src/features/caret/focus.spec.ts` |
| Delete | `packages/core/src/features/caret/selection.ts` |
| Delete | `packages/core/src/features/caret/selection.spec.ts` |

### Phase 3

| Action | File |
|---|---|
| Create | `packages/core/src/features/caret/caretDom.ts` |
| Create | `packages/core/src/features/caret/caretDom.spec.ts` |
| Modify | `packages/core/src/features/caret/TriggerFinder.ts` |
| Modify | `packages/core/src/features/caret/TriggerFinder.spec.ts` |
| Modify | `packages/core/src/features/caret/index.ts` |
| Modify | `packages/core/src/features/keyboard/blockEdit.ts` |
| Modify | `packages/core/src/features/overlay/OverlayController.ts` |
| Modify | `packages/react/markput/src/lib/hooks/useOverlay.tsx` |
| Modify | `packages/vue/markput/src/lib/hooks/useOverlay.ts` |
| Modify | `packages/core/index.ts` |
| Modify | `packages/core/README.md` |
| Delete | `packages/core/src/features/caret/Caret.ts` |
| Delete | `packages/core/src/features/caret/Caret.spec.ts` |

### Phase 4

| Action | File |
|---|---|
| Modify | `packages/core/src/features/dom/DomController.ts` |
| Modify | `packages/core/src/features/dom/DomController.spec.ts` |
| Modify | `packages/core/src/features/caret/CaretModel.ts` |
| Modify | `packages/core/src/features/keyboard/arrowNav.ts` |

---

## Phase 1 — `CaretModel` API surface

Goal: add semantic commands and derived signals; migrate all 10 `selecting` wrapper-method call sites and all 14 collapsed-range write sites.

---

### Task 1.1 — Add computed signals and pure commands to `CaretModel`

**Files:**
- Modify: `packages/core/src/features/caret/CaretModel.ts`
- Modify: `packages/core/src/features/caret/CaretModel.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to `CaretModel.spec.ts` inside the existing `describe('CaretModel', …)`:

```ts
import {describe, it, expect, vi} from 'vitest'
import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('CaretModel', () => {
  // ... existing tests ...

  describe('setAt', () => {
    it('writes collapsed range', () => {
      const store = new Store()
      store.caret.setAt(5)
      expect(store.caret.range()).toEqual({start: 5, end: 5})
    })
    it('does not change selecting', () => {
      const store = new Store()
      store.caret.selecting('drag')
      store.caret.setAt(5)
      expect(store.caret.selecting()).toBe('drag')
    })
  })

  describe('select', () => {
    it('writes extended range', () => {
      const store = new Store()
      store.caret.select({start: 2, end: 8})
      expect(store.caret.range()).toEqual({start: 2, end: 8})
    })
    it('collapsed select behaves same as setAt', () => {
      const store = new Store()
      store.caret.select({start: 5, end: 5})
      expect(store.caret.range()).toEqual({start: 5, end: 5})
    })
  })

  describe('collapse', () => {
    it('collapses to start', () => {
      const store = new Store()
      store.caret.range({start: 2, end: 8})
      store.caret.collapse('start')
      expect(store.caret.range()).toEqual({start: 2, end: 2})
    })
    it('collapses to end', () => {
      const store = new Store()
      store.caret.range({start: 2, end: 8})
      store.caret.collapse('end')
      expect(store.caret.range()).toEqual({start: 8, end: 8})
    })
    it('is no-op when range is undefined', () => {
      const store = new Store()
      store.caret.collapse('start')
      expect(store.caret.range()).toBeUndefined()
    })
  })

  describe('isCollapsed', () => {
    it('is false when range is undefined', () => {
      expect(new Store().caret.isCollapsed()).toBe(false)
    })
    it('is true when start equals end', () => {
      const store = new Store()
      store.caret.range({start: 3, end: 3})
      expect(store.caret.isCollapsed()).toBe(true)
    })
    it('is false when start differs from end', () => {
      const store = new Store()
      store.caret.range({start: 2, end: 8})
      expect(store.caret.isCollapsed()).toBe(false)
    })
  })

  describe('position', () => {
    it('is undefined when range is undefined', () => {
      expect(new Store().caret.position()).toBeUndefined()
    })
    it('returns start when collapsed', () => {
      const store = new Store()
      store.caret.range({start: 5, end: 5})
      expect(store.caret.position()).toBe(5)
    })
    it('is undefined when extended', () => {
      const store = new Store()
      store.caret.range({start: 2, end: 8})
      expect(store.caret.position()).toBeUndefined()
    })
  })

  describe('selection', () => {
    it('is undefined when range is undefined', () => {
      expect(new Store().caret.selection()).toBeUndefined()
    })
    it('is undefined when collapsed', () => {
      const store = new Store()
      store.caret.range({start: 5, end: 5})
      expect(store.caret.selection()).toBeUndefined()
    })
    it('returns range when extended', () => {
      const store = new Store()
      store.caret.range({start: 2, end: 8})
      expect(store.caret.selection()).toEqual({start: 2, end: 8})
    })
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @markput/core test --run -- CaretModel
```

Expected: multiple FAIL lines for `setAt`, `select`, `collapse`, `isCollapsed`, `position`, `selection`.

- [ ] **Step 3: Implement the new API in `CaretModel.ts`**

```ts
import {computed, signal} from '../../shared/signals'
import type {RawRange} from '../../shared/editorContracts'

export class CaretModel {
  readonly range = signal<{readonly start: number; readonly end: number} | undefined>(undefined, {
    equals: (a, b) => a === b || (a !== undefined && a.start === b?.start && a.end === b.end),
  })

  readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

  readonly isCollapsed = computed(() => {
    const r = this.range()
    return !!r && r.start === r.end
  })

  readonly position = computed<number | undefined>(() =>
    this.isCollapsed() ? this.range()?.start : undefined
  )

  readonly selection = computed<RawRange | undefined>(() =>
    this.isCollapsed() ? undefined : this.range()
  )

  setAt(pos: number): void {
    this.range({start: pos, end: pos})
  }

  select(r: RawRange): void {
    this.range(r)
  }

  collapse(side: 'start' | 'end'): void {
    const r = this.range()
    if (!r) return
    const at = r[side]
    this.range({start: at, end: at})
  }

  // Legacy methods kept until Phase 1 migration tasks are done
  startDragSelect(): void {
    if (this.selecting() !== 'drag') this.selecting('drag')
  }
  clearDragSelect(): void {
    if (this.selecting() === 'drag') this.selecting(undefined)
  }
  startAllSelect(): void {
    this.selecting('all')
  }
  clearAllSelect(): void {
    if (this.selecting() === 'all') this.selecting(undefined)
  }
  endSelecting(): void {
    this.selecting(undefined)
  }
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
pnpm --filter @markput/core test --run -- CaretModel
```

Expected: all new tests PASS; existing tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/caret/CaretModel.ts packages/core/src/features/caret/CaretModel.spec.ts
git commit -m "feat(caret): add setAt/select/collapse/isCollapsed/position/selection to CaretModel"
```

---

### Task 1.2 — Add `isFullSelection` and `selectAll` to `CaretModel`

**Files:**
- Modify: `packages/core/src/features/caret/CaretModel.ts`
- Modify: `packages/core/src/features/caret/CaretModel.spec.ts`

- [ ] **Step 1: Write failing tests**

Add to `CaretModel.spec.ts`:

```ts
describe('isFullSelection', () => {
  it('returns false when no container', () => {
    expect(new Store().caret.isFullSelection()).toBe(false)
  })
  it('returns false when selection is collapsed', () => {
    const store = new Store()
    const container = document.createElement('div')
    document.body.appendChild(container)
    store.dom.container(container)
    // no active range set
    expect(store.caret.isFullSelection()).toBe(false)
    container.remove()
  })
})

describe('selectAll', () => {
  it('sets selecting to all', () => {
    const store = new Store()
    const container = document.createElement('div')
    container.appendChild(document.createTextNode('hi'))
    document.body.appendChild(container)
    store.dom.container(container)

    const mockSel = {setBaseAndExtent: vi.fn(), rangeCount: 0}
    vi.spyOn(window, 'getSelection').mockReturnValue(mockSel as unknown as Selection)

    store.caret.selectAll()
    expect(store.caret.selecting()).toBe('all')
    expect(mockSel.setBaseAndExtent).toHaveBeenCalledWith(
      container.firstChild, 0, container.lastChild, 1
    )
    container.remove()
    vi.restoreAllMocks()
  })
  it('is no-op when container is missing', () => {
    const store = new Store()
    expect(() => store.caret.selectAll()).not.toThrow()
    expect(store.caret.selecting()).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @markput/core test --run -- CaretModel
```

Expected: FAIL for `isFullSelection` and `selectAll`.

- [ ] **Step 3: Implement in `CaretModel.ts`**

CaretModel needs access to `dom`. Add a setter for now — the constructor wiring comes in Phase 2. Add these methods (and a `#dom` field set via the setter):

```ts
import type {DomController} from '../dom/DomController'

export class CaretModel {
  // ... existing signals and commands ...

  #dom?: DomController

  /** Called by DomController in Phase 2 constructor; temporary bridge until full wiring. */
  _bindDom(dom: DomController): void {
    this.#dom = dom
  }

  isFullSelection(): boolean {
    const sel = window.getSelection()
    const container = this.#dom?.container()
    if (!sel?.rangeCount || !container?.firstChild || !container.lastChild) return false
    try {
      const range = sel.getRangeAt(0)
      return (
        container.contains(range.startContainer) &&
        container.contains(range.endContainer) &&
        range.toString().length > 0
      )
    } catch {
      return false
    }
  }

  selectAll(): void {
    const container = this.#dom?.container()
    if (!container?.firstChild || !container.lastChild) return
    // setBaseAndExtent offsets: 0 = start of firstChild; 1 = one position past lastChild
    // (offset is inside the container parent, not inside lastChild itself)
    window.getSelection()?.setBaseAndExtent(container.firstChild, 0, container.lastChild, 1)
    this.selecting('all')
    const rawSel = this.#dom?.readRawSelection()
    if (rawSel?.ok) this.range(rawSel.value.range)
  }
}
```

Wire `_bindDom` in `DomController.ts` constructor:

```ts
// In DomController constructor, after existing setup:
caret._bindDom(this)
```

- [ ] **Step 4: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: ≥545 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/caret/CaretModel.ts packages/core/src/features/caret/CaretModel.spec.ts packages/core/src/features/dom/DomController.ts
git commit -m "feat(caret): add isFullSelection and selectAll to CaretModel"
```

---

### Task 1.3 — Migrate `selecting` wrapper method call sites

**Files:**
- Modify: `packages/core/src/features/caret/selection.ts`
- Modify: `packages/core/src/features/keyboard/input.ts`

- [ ] **Step 1: Update `caret/selection.ts`** — replace wrapper methods with direct signal writes

```ts
// selection.ts — every caret.startDragSelect/clearDragSelect call:
// Line 22: store.caret.startDragSelect() → store.caret.selecting('drag')
// Line 32: store.caret.clearDragSelect() → store.caret.selecting(undefined)
// Line 40: store.caret.clearDragSelect() → store.caret.selecting(undefined)
// Line 63: store.caret.clearDragSelect() → store.caret.selecting(undefined)
```

In `caret/selection.ts`:

```ts
// mouseup handler (~line 27-35):
listen(document, 'mouseup', () => {
  isPressed = false
  pressedNode = null
  if (store.caret.selecting() === 'drag') {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) {
      store.caret.selecting(undefined)   // was clearDragSelect()
    }
  }
})

// selectionchange handler (~line 37-54):
listen(document, 'selectionchange', () => {
  const sel = window.getSelection()
  if (store.caret.selecting() === 'drag' && (!sel || sel.isCollapsed)) {
    store.caret.selecting(undefined)     // was clearDragSelect()
  }
  // ... rest unchanged
})

// mousemove handler (~line 13-23):
if (currentIsPressed && isNotInnerSome && isInside) {
  store.caret.selecting('drag')          // was startDragSelect()
}

// cleanup effect (~line 61-65):
effect(() => () => {
  if (store.caret.selecting() === 'drag') {
    store.caret.selecting(undefined)     // was clearDragSelect()
  }
})
```

- [ ] **Step 2: Update `keyboard/input.ts`** — replace `clearAllSelect` and `endSelecting`:

```ts
// Line 77: store.caret.clearAllSelect() → store.caret.selecting(undefined)
// Line 103: store.caret.clearAllSelect() → store.caret.selecting(undefined)
// Line 259: store.caret.clearAllSelect() → store.caret.selecting(undefined)
// Line 271: store.caret.endSelecting() → store.caret.selecting(undefined)
```

- [ ] **Step 3: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: ≥545 passing (behavior unchanged — wrapper methods still exist on model, callers now call signal directly).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/caret/selection.ts packages/core/src/features/keyboard/input.ts
git commit -m "refactor(caret): migrate selecting wrapper-method call sites to direct signal writes"
```

---

### Task 1.4 — Migrate Ctrl+A and `isFullSelection` in keyboard layer

**Files:**
- Modify: `packages/core/src/features/keyboard/arrowNav.ts`
- Modify: `packages/core/src/features/keyboard/input.ts`

- [ ] **Step 1: Update `arrowNav.ts`** — replace `selectAllText(store, e)` with inline bail + `caret.selectAll()`:

```ts
// keyboard/arrowNav.ts
// Remove: import {selectAllText} from '../caret'
// Add to keydown handler (after arrow-key handling):
if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
  if (store.slots.isBlock()) return
  e.preventDefault()
  store.caret.selectAll()
}
```

Full updated `enableArrowNav` (relevant section):

```ts
import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'dom' | 'caret' | 'slots' | 'parsing'>

export function enableArrowNav(store: KbCtx): void {
  const container = store.dom.container()
  if (!container) return

  listen(container, 'keydown', e => {
    if (store.slots.isBlock()) return

    if (e.key === KEYBOARD.LEFT) {
      shiftFocus(store, e, 'prev')
    } else if (e.key === KEYBOARD.RIGHT) {
      shiftFocus(store, e, 'next')
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
      if (store.slots.isBlock()) return
      e.preventDefault()
      store.caret.selectAll()
    }
  })
}
```

- [ ] **Step 2: Update `input.ts`** — replace `isFullSelection(store)` with `store.caret.isFullSelection()`:

```ts
// Remove: import {isFullSelection} from '../caret'
// Replace all three usages:
// Line 72: isFullSelection(store)  → store.caret.isFullSelection()
// Line 93: isFullSelection(store)  → store.caret.isFullSelection()
// Line 258: !isFullSelection(store) → !store.caret.isFullSelection()
```

- [ ] **Step 3: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: ≥545 passing.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/keyboard/arrowNav.ts packages/core/src/features/keyboard/input.ts
git commit -m "refactor(keyboard): use caret.selectAll() and caret.isFullSelection() directly"
```

---

### Task 1.5 — Migrate all collapsed-range writes to `setAt`

**Files:**
- Modify: `packages/core/src/features/overlay/OverlayController.ts`
- Modify: `packages/core/src/features/keyboard/input.ts`
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`
- Modify: `packages/core/src/features/clipboard/ClipboardController.ts`
- Modify: `packages/core/src/features/dom/DomController.ts`

- [ ] **Step 1: Apply all 14 call-site migrations**

`overlay/OverlayController.ts:114`:
```ts
// before: this.caret.range({start: pos, end: pos})
this.caret.setAt(pos)
```

`keyboard/input.ts` — four sites:
```ts
// Line 50: store.caret.range({start: pos, end: pos}) → store.caret.setAt(pos)
// Line 87: store.caret.range({start: range.start, end: range.start}) → store.caret.setAt(range.start)
// Line 118: store.caret.range({start: pos, end: pos}) → store.caret.setAt(pos)
// Line 272: store.caret.range({start: newContent.length, end: newContent.length}) → store.caret.setAt(newContent.length)
```

`keyboard/blockEdit.ts` — seven sites:
```ts
// Line 92:  store.caret.range({start: pos, end: pos}) → store.caret.setAt(pos)
// Line 104: store.caret.range({start: joinPos, end: joinPos}) → store.caret.setAt(joinPos)
// Line 127: store.caret.range({start: joinPos, end: joinPos}) → store.caret.setAt(joinPos)
// Line 143: store.caret.range({start: joinPos, end: joinPos}) → store.caret.setAt(joinPos)
// Line 185: store.caret.range({start: pos, end: pos}) → store.caret.setAt(pos)
// Line 193: store.caret.range({start: pos, end: pos}) → store.caret.setAt(pos)
// Line 329: store.caret.range({start: pos, end: pos}) → store.caret.setAt(pos)
```

`clipboard/ClipboardController.ts:59`:
```ts
// before: caret.range({start: raw.value.range.start, end: raw.value.range.start})
caret.setAt(raw.value.range.start)
```

`dom/DomController.ts:787`:
```ts
// before: this.caret.range({start: clampedStart, end: clampedEnd})
// Note: this can be setAt only if clampedStart === clampedEnd; it's inside the collapsed branch
this.caret.setAt(clampedStart)
// (the ranged branch at line 799 writes range directly, not collapsed — leave it or use caret.select())
```

- [ ] **Step 2: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: ≥545 passing.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/overlay/OverlayController.ts packages/core/src/features/keyboard/input.ts packages/core/src/features/keyboard/blockEdit.ts packages/core/src/features/clipboard/ClipboardController.ts packages/core/src/features/dom/DomController.ts
git commit -m "refactor(caret): migrate collapsed range writes to caret.setAt() (14 sites)"
```

---

### Task 1.6 — Delete `selectionHelpers.ts`; remove legacy wrapper methods from `CaretModel`

**Files:**
- Modify: `packages/core/src/features/caret/CaretModel.ts`
- Delete: `packages/core/src/features/caret/selectionHelpers.ts`
- Modify: `packages/core/src/features/caret/index.ts`

- [ ] **Step 1: Verify no remaining callers of `selectionHelpers` or wrapper methods**

```bash
grep -r "selectionHelpers\|selectAllText\|isFullSelection\b\|startDragSelect\|clearDragSelect\|startAllSelect\|clearAllSelect\|endSelecting" packages/core/src --include="*.ts" | grep -v spec
```

Expected: no output (all migrated in earlier tasks).

- [ ] **Step 2: Remove legacy methods from `CaretModel.ts`**

Delete the five legacy wrapper methods (`startDragSelect`, `clearDragSelect`, `startAllSelect`, `clearAllSelect`, `endSelecting`).

- [ ] **Step 3: Delete `selectionHelpers.ts`**

```bash
rm packages/core/src/features/caret/selectionHelpers.ts
```

- [ ] **Step 4: Update `caret/index.ts`** — remove the `selectionHelpers` export:

```ts
// before:
export {Caret} from './Caret'
export {CaretModel} from './CaretModel'
export {isFullSelection, selectAllText} from './selectionHelpers'
export {TriggerFinder} from './TriggerFinder'

// after (Caret and TriggerFinder will move further in Phase 3):
export {Caret} from './Caret'
export {CaretModel} from './CaretModel'
export {TriggerFinder} from './TriggerFinder'
```

- [ ] **Step 5: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: ≥545 passing (one `selectionHelpers.spec.ts` is gone — there is none; count may tick up from new CaretModel tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/caret/ packages/core/src/features/caret/index.ts
git commit -m "refactor(caret): delete selectionHelpers.ts; remove legacy wrapper methods from CaretModel"
```

---

## Phase 2 — Listener migration + restoration

Goal: `CaretModel` attaches its own listeners and drives restoration via `dom.indexed`. `DomController` loses its `caret` constructor dep.

---

### Task 2.1 — Add `indexed` event, `readOnly` computed, and `reconcile` opts to `DomController`

**Files:**
- Modify: `packages/core/src/features/dom/DomController.ts`
- Modify: `packages/core/src/features/dom/DomController.spec.ts`

- [ ] **Step 1: Write failing tests**

Add to `DomController.spec.ts`:

```ts
import {watch} from '../../shared/signals'

it('indexed event fires after commitRendered', () => {
  const store = new Store()
  const container = document.createElement('div')
  document.body.appendChild(container)
  store.props.set({defaultValue: 'hi'})
  store.lifecycle.mounted()
  store.dom.container(container)

  const fired = vi.fn()
  watch(store.dom.indexed, fired)
  store.lifecycle.rendered()
  expect(fired).toHaveBeenCalledTimes(1)
  container.remove()
})

it('reconcile respects selecting flag', () => {
  const store = new Store()
  const container = document.createElement('div')
  const span = document.createElement('span')
  container.appendChild(span)
  document.body.appendChild(container)
  store.props.set({defaultValue: 'hello'})
  store.lifecycle.mounted()
  store.dom.container(container)
  store.lifecycle.rendered()

  // selecting=true → contentEditable should be 'false'
  store.dom.reconcile({selecting: true})
  expect(span.contentEditable).toBe('false')

  // selecting=false → contentEditable should be 'true'
  store.dom.reconcile({selecting: false})
  expect(span.contentEditable).toBe('true')

  container.remove()
})

it('readOnly computed reflects props', () => {
  const store = new Store()
  expect(store.dom.readOnly()).toBe(false)
  store.props.set({readOnly: true})
  expect(store.dom.readOnly()).toBe(true)
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @markput/core test --run -- DomController
```

Expected: FAIL for the three new tests.

- [ ] **Step 3: Implement in `DomController.ts`**

Add to `DomController` class body:

```ts
readonly indexed = event<void>()
readonly readOnly: Computed<boolean> = computed(() => this.props.readOnly())
```

Change `reconcile` signature:

```ts
reconcile(opts?: {selecting?: boolean}): void {
  this.#reconcileStructuralTextSurfaces(opts?.selecting)
}
```

Update `#reconcileStructuralTextSurfaces` to accept `selecting` parameter:

```ts
#reconcileStructuralTextSurfaces(selecting?: boolean): void {
  // ... existing body ...
  // Line 625: replace this.caret.selecting() with the passed-in flag:
  const editable = this.props.readOnly() || selecting ? 'false' : 'true'
  // ...
}
```

Fire `indexed` at the end of `#commitRendered`:

```ts
#commitRendered(): void {
  // ... existing body ...
  batch(() => this.#domIndex({generation: ++this.#generation}), {mutable: true})
  this.indexed()   // ← add this line after the domIndex update
}
```

Change the `{readOnly, selecting}` watcher to `readOnly` only (caret-side drives reconcile in Task 2.3):

```ts
// Replace the existing combined watcher:
watch(
  computed(() => props.readOnly()),
  () => this.reconcile()
)
```

- [ ] **Step 4: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: ≥545 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/dom/DomController.ts packages/core/src/features/dom/DomController.spec.ts
git commit -m "feat(dom): add indexed event, readOnly computed, reconcile({selecting}) opts"
```

---

### Task 2.2 — Move empty-editor click handler into `DomController`

**Files:**
- Modify: `packages/core/src/features/dom/DomController.ts`
- Modify: `packages/core/src/features/dom/DomController.spec.ts`

- [ ] **Step 1: Write a failing test**

Add to `DomController.spec.ts`:

```ts
it('focuses first child on click when editor is empty', () => {
  const store = new Store()
  const container = document.createElement('div')
  const span = document.createElement('span')
  span.contentEditable = 'true'
  container.appendChild(span)
  document.body.appendChild(container)

  store.props.set({defaultValue: ''})
  store.lifecycle.mounted()
  store.dom.container(container)
  store.lifecycle.rendered()

  const focusSpy = vi.spyOn(span, 'focus')
  container.dispatchEvent(new MouseEvent('click', {bubbles: true}))
  expect(focusSpy).toHaveBeenCalledTimes(1)
  container.remove()
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm --filter @markput/core test --run -- DomController
```

Expected: FAIL for the new test.

- [ ] **Step 3: Add the handler inside `DomController`'s `onMounted`**

```ts
// In DomController constructor, lifecycle.onMounted callback, after existing listeners:
listen(container, 'click', () => {
  const tokens = this.parsing.tokens()
  if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
    const element = container ? firstHtmlChild(container) : null
    element?.focus()
  }
})
```

- [ ] **Step 4: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: ≥545 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/dom/DomController.ts packages/core/src/features/dom/DomController.spec.ts
git commit -m "refactor(dom): move empty-editor click→focus handler into DomController"
```

---

### Task 2.3 — Move listeners and restoration into `CaretModel`; update `Store`

**Files:**
- Modify: `packages/core/src/features/caret/CaretModel.ts`
- Modify: `packages/core/src/features/caret/CaretModel.spec.ts`
- Modify: `packages/core/src/store/Store.ts`
- Modify: `packages/core/src/features/dom/DomController.ts`
- Delete: `packages/core/src/features/caret/focus.ts`
- Delete: `packages/core/src/features/caret/focus.spec.ts`
- Delete: `packages/core/src/features/caret/selection.ts`
- Delete: `packages/core/src/features/caret/selection.spec.ts`

- [ ] **Step 1: Write failing tests for new CaretModel behavior**

Add to `CaretModel.spec.ts`:

```ts
import {Store} from '../../store/Store'
import {listen} from '../../shared/signals'

describe('lifecycle wiring', () => {
  it('attaches document listeners on mount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const store = new Store()
    store.lifecycle.mounted()
    expect(addSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), undefined)
    addSpy.mockRestore()
  })

  it('clears drag-selecting on unmount', () => {
    const store = new Store()
    store.lifecycle.mounted()
    store.caret.selecting('drag')
    store.lifecycle.unmounted()
    expect(store.caret.selecting()).toBeUndefined()
  })
})

describe('restoration via dom.indexed', () => {
  it('restores range after indexed fires', () => {
    const store = new Store()
    const container = document.createElement('div')
    document.body.appendChild(container)

    const placeAtSpy = vi.spyOn(store.dom, 'placeAt').mockReturnValue({ok: true, value: {applied: 5}})
    store.props.set({defaultValue: 'hello'})
    store.lifecycle.mounted()
    store.dom.container(container)
    store.caret.setAt(5)

    store.lifecycle.rendered()  // triggers indexed → applyRangeToDOM
    expect(placeAtSpy).toHaveBeenCalledWith(5)
    container.remove()
    placeAtSpy.mockRestore()
  })

  it('skips restoration when mode is drag', () => {
    const store = new Store()
    const placeAtSpy = vi.spyOn(store.dom, 'placeAt')
    store.lifecycle.mounted()
    store.caret.setAt(3)
    store.caret.selecting('drag')
    store.lifecycle.rendered()
    expect(placeAtSpy).not.toHaveBeenCalled()
    placeAtSpy.mockRestore()
  })

  it('clears range when placeAt fails', () => {
    const store = new Store()
    vi.spyOn(store.dom, 'placeAt').mockReturnValue({ok: false, reason: 'notIndexed'})
    store.lifecycle.mounted()
    store.caret.setAt(3)
    store.lifecycle.rendered()
    expect(store.caret.range()).toBeUndefined()
    vi.restoreAllMocks()
  })
})

describe('single reconcile driver', () => {
  it('calls dom.reconcile when selecting changes', () => {
    const store = new Store()
    const reconcileSpy = vi.spyOn(store.dom, 'reconcile')
    store.lifecycle.mounted()
    store.caret.selecting('drag')
    expect(reconcileSpy).toHaveBeenCalledWith({selecting: true})
    reconcileSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @markput/core test --run -- CaretModel
```

Expected: FAIL for all new tests.

- [ ] **Step 3: Rewrite `CaretModel.ts`** with constructor wiring

```ts
import {computed, effect, signal, watch} from '../../shared/signals'
import {listen} from '../../shared/signals'
import {nodeTarget} from '../../shared/checkers'
import type {RawRange} from '../../shared/editorContracts'
import type {DomController} from '../dom/DomController'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import {firstHtmlChild} from '../../shared/checkers'

export class CaretModel {
  readonly range = signal<RawRange | undefined>(undefined, {
    equals: (a, b) => a === b || (a !== undefined && a.start === b?.start && a.end === b.end),
  })

  readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

  readonly isCollapsed = computed(() => {
    const r = this.range()
    return !!r && r.start === r.end
  })

  readonly position = computed<number | undefined>(() =>
    this.isCollapsed() ? this.range()?.start : undefined
  )

  readonly selection = computed<RawRange | undefined>(() =>
    this.isCollapsed() ? undefined : this.range()
  )

  constructor(private readonly lifecycle: Lifecycle, private readonly dom: DomController) {
    lifecycle.onMounted(() => {
      this.#enableFocusTracking()
      this.#enableSelectionTracking()
      watch(dom.indexed, () => this.#applyRangeToDOM())
      effect(() => {
        const isDrag = this.selecting() === 'drag'
        dom.readOnly() // track so effect re-runs when readOnly flips
        dom.reconcile({selecting: isDrag})
      })
    })
  }

  setAt(pos: number): void {
    this.range({start: pos, end: pos})
  }

  select(r: RawRange): void {
    this.range(r)
  }

  collapse(side: 'start' | 'end'): void {
    const r = this.range()
    if (!r) return
    const at = r[side]
    this.range({start: at, end: at})
  }

  isFullSelection(): boolean {
    const sel = window.getSelection()
    const container = this.dom.container()
    if (!sel?.rangeCount || !container?.firstChild || !container.lastChild) return false
    try {
      const range = sel.getRangeAt(0)
      return (
        container.contains(range.startContainer) &&
        container.contains(range.endContainer) &&
        range.toString().length > 0
      )
    } catch {
      return false
    }
  }

  selectAll(): void {
    const container = this.dom.container()
    if (!container?.firstChild || !container.lastChild) return
    // setBaseAndExtent offsets: 0 = start of firstChild; 1 = one position past lastChild
    // (offset is inside the container parent, not inside lastChild itself)
    window.getSelection()?.setBaseAndExtent(container.firstChild, 0, container.lastChild, 1)
    this.selecting('all')
    const rawSel = this.dom.readRawSelection()
    if (rawSel.ok) this.range(rawSel.value.range)
  }

  #enableFocusTracking(): void {
    const container = this.dom.container()
    if (!container) return

    listen(container, 'focusin', e => {
      const target = e.target instanceof HTMLElement ? e.target : undefined
      if (!target) { this.range(undefined); return }
      const result = this.dom.locateNode(target)
      if (!result.ok) {
        if (result.reason === 'control') return
        this.range(undefined)
        return
      }
      const rawSel = this.dom.readRawSelection()
      if (rawSel.ok) this.range(rawSel.value.range)
    })

    listen(container, 'focusout', () => {
      queueMicrotask(() => {
        if (!container.contains(document.activeElement)) {
          this.range(undefined)
        }
      })
    })
  }

  #enableSelectionTracking(): void {
    let pressedNode: Node | null = null
    let isPressed = false

    listen(document, 'mousedown', e => {
      pressedNode = nodeTarget(e)
      isPressed = true
    })

    listen(document, 'mousemove', e => {
      const container = this.dom.container()
      if (!container) return
      const isNotInnerSome = !container.contains(pressedNode) || pressedNode !== e.target
      const isInside = window.getSelection()?.containsNode(container, true)
      if (isPressed && isNotInnerSome && isInside) {
        this.selecting('drag')
      }
    })

    listen(document, 'mouseup', () => {
      isPressed = false
      pressedNode = null
      if (this.selecting() === 'drag') {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) this.selecting(undefined)
      }
    })

    listen(document, 'selectionchange', () => {
      const sel = window.getSelection()
      if (this.selecting() === 'drag' && (!sel || sel.isCollapsed)) {
        this.selecting(undefined)
      }
      if (!sel?.focusNode) return
      const result = this.dom.locateNode(sel.focusNode)
      if (!result.ok) {
        if (result.reason === 'control') return
        this.range(undefined)
        return
      }
      const rawSel = this.dom.readRawSelection()
      if (rawSel.ok) this.range(rawSel.value.range)
      else this.range(undefined)
    })

    effect(() => () => {
      if (this.selecting() === 'drag') this.selecting(undefined)
    })
  }

  #applyRangeToDOM(): void {
    if (this.selecting() === 'drag') return
    const range = this.range()
    if (range === undefined) return

    const result = range.start === range.end
      ? this.dom.placeAt(range.start)
      : this.dom.placeRange(range)

    if (!result.ok) {
      this.range(undefined)
      return
    }
    this.range(result.value.applied)
  }
}
```

Note: `placeAt` and `placeRange` are added to `DomController` in Phase 4. For now,
`#applyRangeToDOM` calls the existing `placeCaretAtRawPosition` and `#placeSelection`
(via a temporary compatibility shim — see Step 4).

- [ ] **Step 4: Add temporary compatibility shims to `DomController.ts`**

Until Phase 4 renames the methods, add aliases:

```ts
// DomController.ts — add these wrappers so CaretModel can call placeAt/placeRange
placeAt(rawPos: number): {ok: boolean; value: {applied: number}} {
  const result = this.placeCaretAtRawPosition(rawPos)
  if (!result.ok) return {ok: false, value: undefined as never}
  return {ok: true, value: {applied: rawPos}}
}

placeRange(range: RawRange): {ok: boolean; value: {applied: RawRange}} {
  const result = this.#placeSelection({range, direction: undefined})
  if (!result.ok) return {ok: false, value: undefined as never}
  return {ok: true, value: {applied: range}}
}
```

Also: **remove** `enableFocus` and `enableSelection` wiring from `DomController.ts`
constructor (`onMounted`). Remove the `#applyRangeToDOM` call from `#commitRendered`
(now replaced by `this.indexed()`). Remove the `caret` param from constructor.

- [ ] **Step 5: Update `Store.ts`** — reorder fields, change `DomController` constructor, add `CaretModel` with 2 deps:

```ts
// packages/core/src/store/Store.ts
readonly lifecycle = new Lifecycle()
readonly props     = new PropsModel()
readonly value     = new ValueModel(this.props)
readonly mark      = new MarkFeature(this.props)
readonly slots     = new SlotsFeature(this.props)
readonly parsing   = new ParseController(this.lifecycle, this.value, this.mark, this.props, this.slots)
readonly dom       = new DomController(this.lifecycle, this.props, this.parsing, this.value)
readonly caret     = new CaretModel(this.lifecycle, this.dom)
readonly overlay   = new OverlayController(this.lifecycle, this.props, this.value, this.dom, this.caret, this.parsing)
readonly keyboard  = new KeyboardController(this.lifecycle, this.dom, this.value, this.caret, this.slots, this.parsing, this.props)
readonly drag      = new DragController(this.props, this.value, this.parsing, this.caret)
readonly clipboard = new ClipboardController(this.lifecycle, this.value, this.dom, this.parsing, this.caret)
readonly handler   = new MarkputHandler(this.dom, this.overlay, this.parsing)
```

- [ ] **Step 6: Remove `focus.ts`, `selection.ts` and their tests**

Verify no remaining callers first:

```bash
grep -r "enableFocus\|enableSelection\|focus\.ts\|selection\.ts" packages/core/src --include="*.ts" | grep -v spec | grep -v "caret/focus\|caret/selection"
```

Expected: no output.

```bash
rm packages/core/src/features/caret/focus.ts packages/core/src/features/caret/focus.spec.ts
rm packages/core/src/features/caret/selection.ts packages/core/src/features/caret/selection.spec.ts
```

- [ ] **Step 7: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: ≥545 passing (some selection/focus spec cases are deleted, new CaretModel tests are added — net approximately equal or slightly up).

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/features/caret/ packages/core/src/features/dom/DomController.ts packages/core/src/store/Store.ts
git commit -m "refactor(caret): move listeners and restoration into CaretModel; flip caret/dom dependency"
```

---

## Phase 3 — Static `Caret` deletion + `caretDom.ts` + overlay positioning

Goal: delete `Caret.ts`, create `caretDom.ts`, move overlay positioning to `OverlayController`, update adapters and public exports.

---

### Task 3.1 — Create `caretDom.ts` with tests

**Files:**
- Create: `packages/core/src/features/caret/caretDom.ts`
- Create: `packages/core/src/features/caret/caretDom.spec.ts`

- [ ] **Step 1: Write tests first**

```ts
// caretDom.spec.ts
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import * as caretDom from './caretDom'

describe('caretDom', () => {
  describe('getCaretIndex', () => {
    it('returns 0 when no selection', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue(null)
      const el = document.createElement('div')
      expect(caretDom.getCaretIndex(el)).toBe(0)
      vi.restoreAllMocks()
    })
    it('returns character count from element start to caret', () => {
      const el = document.createElement('div')
      const text = document.createTextNode('hello')
      el.appendChild(text)
      document.body.appendChild(el)
      const range = document.createRange()
      range.setStart(text, 3)
      range.collapse(true)
      const sel = window.getSelection()!
      sel.removeAllRanges()
      sel.addRange(range)
      expect(caretDom.getCaretIndex(el)).toBe(3)
      document.body.removeChild(el)
    })
  })

  describe('getRect', () => {
    it('returns null when no selection', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue(null)
      expect(caretDom.getRect()).toBeNull()
      vi.restoreAllMocks()
    })
  })

  describe('isOnFirstLine', () => {
    it('returns true when no caret rect', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue(null)
      const el = document.createElement('div')
      expect(caretDom.isOnFirstLine(el)).toBe(true)
      vi.restoreAllMocks()
    })
  })

  describe('isOnLastLine', () => {
    it('returns true when no caret rect', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue(null)
      const el = document.createElement('div')
      expect(caretDom.isOnLastLine(el)).toBe(true)
      vi.restoreAllMocks()
    })
  })

  describe('setAtElement', () => {
    it('does not throw when element has no text nodes', () => {
      const el = document.createElement('div')
      expect(() => caretDom.setAtElement(el, 0)).not.toThrow()
    })
    it('places caret at offset within text', () => {
      const el = document.createElement('div')
      el.appendChild(document.createTextNode('hello world'))
      document.body.appendChild(el)
      caretDom.setAtElement(el, 5)
      expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(5)
      document.body.removeChild(el)
    })
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @markput/core test --run -- caretDom
```

Expected: FAIL (file doesn't exist yet).

- [ ] **Step 3: Create `caretDom.ts`** — exact ports of the static `Caret` methods:

```ts
// caretDom.ts
import {nextText} from '../../shared/checkers'

/** Firefox-only CaretPosition */
interface CaretPosition {
  readonly offsetNode: Node
  readonly offset: number
}
interface DocumentWithCaretFromPoint {
  caretRangeFromPoint?(x: number, y: number): Range | null
  caretPositionFromPoint?(x: number, y: number): CaretPosition | null
}

export function getCaretIndex(element: HTMLElement): number {
  let position = 0
  const selection = window.getSelection()
  if (!selection?.rangeCount) return position
  const range = selection.getRangeAt(0)
  const preCaretRange = range.cloneRange()
  preCaretRange.selectNodeContents(element)
  preCaretRange.setEnd(range.endContainer, range.endOffset)
  position = preCaretRange.toString().length
  return position
}

export function getRect(): DOMRect | null {
  try {
    const range = window.getSelection()?.getRangeAt(0)
    return range?.getBoundingClientRect() ?? null
  } catch {
    return null
  }
}

export function isOnFirstLine(element: HTMLElement): boolean {
  const caretRect = getRect()
  if (!caretRect || caretRect.height === 0) return true
  const elRect = element.getBoundingClientRect()
  return caretRect.top < elRect.top + caretRect.height + 2
}

export function isOnLastLine(element: HTMLElement): boolean {
  const caretRect = getRect()
  if (!caretRect || caretRect.height === 0) return true
  const elRect = element.getBoundingClientRect()
  return caretRect.bottom > elRect.bottom - caretRect.height - 2
}

export function setAtElement(element: HTMLElement, offset: number): void {
  try {
    const selection = window.getSelection()
    if (!selection) return
    const walker = document.createTreeWalker(element, 4 /* NodeFilter.SHOW_TEXT */)
    let node = nextText(walker)
    if (!node) return
    let remaining = isFinite(offset) ? Math.max(0, offset) : Infinity
    for (;;) {
      const next = nextText(walker)
      if (!next || remaining <= node.length) {
        const charOffset = isFinite(remaining) ? Math.min(remaining, node.length) : node.length
        const range = document.createRange()
        range.setStart(node, charOffset)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        return
      }
      remaining -= node.length
      node = next
    }
  } catch (e) {
    console.error(e)
  }
}

export function setAtX(element: HTMLElement, x: number, y?: number): void {
  const elRect = element.getBoundingClientRect()
  const targetY = y ?? elRect.top + elRect.height / 2
  // oxlint-disable-next-line no-unsafe-type-assertion
  const caretDoc = document as unknown as DocumentWithCaretFromPoint
  const caretPos = caretDoc.caretRangeFromPoint?.(x, targetY) ?? caretDoc.caretPositionFromPoint?.(x, targetY)
  if (!caretPos) return
  const sel = window.getSelection()
  if (!sel) return
  let domRange: Range
  if (caretPos instanceof Range) {
    domRange = caretPos
  } else if ('offsetNode' in caretPos) {
    domRange = document.createRange()
    domRange.setStart(caretPos.offsetNode, caretPos.offset)
    domRange.collapse(true)
  } else {
    return
  }
  if (!element.contains(domRange.startContainer)) {
    setAtElement(element, Infinity)
    return
  }
  sel.removeAllRanges()
  sel.addRange(domRange)
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @markput/core test --run -- caretDom
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/caret/caretDom.ts packages/core/src/features/caret/caretDom.spec.ts
git commit -m "feat(caret): create caretDom.ts with stateless DOM-coordinate helpers"
```

---

### Task 3.2 — Migrate `blockEdit.ts` from `Caret` to `caretDom`

**Files:**
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`

- [ ] **Step 1: Replace all `Caret.*` call sites in `blockEdit.ts`**

Remove `import {Caret} from '../caret'` and add `import * as caretDom from '../caret/caretDom'`.

| Today | After |
|---|---|
| `Caret.getCaretIndex(blockDiv)` | `caretDom.getCaretIndex(blockDiv)` |
| `Caret.setCaretToEnd(prevBlock)` | `caretDom.setAtElement(prevBlock, Infinity)` |
| `Caret.setCaretToEnd(row)` | `caretDom.setAtElement(row, Infinity)` |
| `Caret.trySetIndex(row, 0)` | `caretDom.setAtElement(row, 0)` |
| `Caret.trySetIndex(nextBlock, 0)` | `caretDom.setAtElement(nextBlock, 0)` |
| `Caret.isCaretOnFirstLine(blockDiv)` | `caretDom.isOnFirstLine(blockDiv)` |
| `Caret.isCaretOnLastLine(blockDiv)` | `caretDom.isOnLastLine(blockDiv)` |
| `Caret.getCaretRect()` | `caretDom.getRect()` |
| `Caret.setAtX(prevBlockDiv, caretX, prevRect.bottom - 4)` | `caretDom.setAtX(prevBlockDiv, caretX, prevRect.bottom - 4)` |
| `Caret.setAtX(nextBlockDiv, caretX, nextRect.top + 4)` | `caretDom.setAtX(nextBlockDiv, caretX, nextRect.top + 4)` |

- [ ] **Step 2: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: ≥545 passing.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/keyboard/blockEdit.ts
git commit -m "refactor(keyboard): migrate blockEdit.ts from Caret to caretDom"
```

---

### Task 3.3 — Rewrite `TriggerFinder.ts` and `TriggerFinder.spec.ts`

**Files:**
- Modify: `packages/core/src/features/caret/TriggerFinder.ts`
- Modify: `packages/core/src/features/caret/TriggerFinder.spec.ts`

- [ ] **Step 1: Update `TriggerFinder.ts`** — remove `Caret` import; read selection directly:

```ts
// TriggerFinder.ts
import {escape} from '../../shared/escape'
import type {OverlayMatch} from '../../shared/types'
import type {DomController} from '../dom/DomController'

const wordRegex = new RegExp(/^\w*/)
type TriggerExtractor<T> = (option: T, index: number) => string | undefined

export class TriggerFinder {
  span: string
  node: Node
  dividedText: {left: string; right: string}

  constructor(private readonly dom?: DomController) {
    const sel = window.getSelection()
    const node = sel?.anchorNode
    if (!node || !document.contains(node)) throw new Error('Anchor node of selection is not exists!')
    this.node = node
    this.span = node.textContent ?? ''
    this.dividedText = this.getDividedTextBy(sel?.anchorOffset ?? 0)
  }

  static find<T>(
    options: T[] | undefined,
    getTrigger: TriggerExtractor<T>,
    dom?: DomController
  ): OverlayMatch<T> | undefined {
    if (!options) return
    if (!window.getSelection()?.isCollapsed) return
    try {
      return new TriggerFinder(dom).find(options, getTrigger)
    } catch {
      return undefined
    }
  }

  // ... keep all other methods unchanged (getDividedTextBy, find, matchInTextVia, etc.) ...
}
```

- [ ] **Step 2: Rewrite `TriggerFinder.spec.ts`** — stub `window.getSelection` instead of mocking `Caret`:

```ts
// TriggerFinder.spec.ts
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {Markup} from '../parsing'
import {TriggerFinder} from './TriggerFinder'

function mockSelection(text: string, offset: number): void {
  const node = document.createTextNode(text)
  document.body.appendChild(node)
  vi.spyOn(window, 'getSelection').mockReturnValue({
    anchorNode: node,
    anchorOffset: offset,
    isCollapsed: true,
    focusNode: node,
    focusOffset: offset,
    rangeCount: 1,
    getRangeAt: () => ({
      startContainer: node,
      startOffset: offset,
      endContainer: node,
      endOffset: offset,
      cloneRange: () => ({
        selectNodeContents: vi.fn(),
        setEnd: vi.fn(),
        toString: () => text.slice(0, offset),
      }),
    }),
    containsNode: () => false,
    addRange: vi.fn(),
    removeAllRanges: vi.fn(),
  } as unknown as Selection)
  vi.spyOn(document, 'contains').mockReturnValue(true)
}

describe(`Utility: ${TriggerFinder.name}`, () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  describe('constructor', () => {
    it('initialises with selection data', () => {
      mockSelection('Hello @world', 5)
      const finder = new TriggerFinder()
      expect(finder.span).toBe('Hello @world')
      expect(finder.dividedText).toEqual({left: 'Hello', right: ' @world'})
    })

    it('throws when no anchor node', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue({
        anchorNode: null,
        isCollapsed: true,
      } as unknown as Selection)
      expect(() => new TriggerFinder()).toThrow('Anchor node of selection is not exists!')
    })
  })

  describe('find — isCollapsed guard', () => {
    it('returns undefined when selection is not collapsed', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
      } as unknown as Selection)
      expect(TriggerFinder.find([{overlay: {trigger: '@'}} as Markup], o => o.overlay?.trigger)).toBeUndefined()
    })
  })

  describe('matchInTextVia', () => {
    it('matches trigger at caret position', () => {
      mockSelection('@abc', 4)
      const finder = new TriggerFinder()
      const match = finder.matchInTextVia('@')
      expect(match?.word).toBe('abc')
      expect(match?.annotation).toBe('@abc')
    })
  })
})
```

- [ ] **Step 3: Run TriggerFinder tests**

```bash
pnpm --filter @markput/core test --run -- TriggerFinder
```

Expected: all PASS.

- [ ] **Step 4: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: ≥545 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/caret/TriggerFinder.ts packages/core/src/features/caret/TriggerFinder.spec.ts
git commit -m "refactor(caret): remove Caret dependency from TriggerFinder; stub window.getSelection in tests"
```

---

### Task 3.4 — Add `OverlayController.position`; update adapter hooks

**Files:**
- Modify: `packages/core/src/features/overlay/OverlayController.ts`
- Modify: `packages/react/markput/src/lib/hooks/useOverlay.tsx`
- Modify: `packages/vue/markput/src/lib/hooks/useOverlay.ts`

- [ ] **Step 1: Add `position` computed to `OverlayController`**

In `OverlayController.ts`, add the import and field:

```ts
import * as caretDom from '../caret/caretDom'

export class OverlayController {
  // ... existing fields ...

  readonly position: Computed<{left: number; top: number}> = computed(() => {
    if (!this.match()) return {left: 0, top: 0}
    const rect = caretDom.getRect()
    if (!rect) return {left: 0, top: 0}
    return {left: rect.left, top: rect.top + rect.height + 1}
  })
}
```

- [ ] **Step 2: Update React `useOverlay.tsx`**

```tsx
// Remove: import {Caret, createMarkFromOverlay} from '@markput/core'
// Add:    import {createMarkFromOverlay} from '@markput/core'
// Remove the useMemo for style; replace with:
const style = useMarkput(s => s.overlay.position())
```

Full updated hook:

```tsx
import type {OverlayMatch} from '@markput/core'
import {createMarkFromOverlay} from '@markput/core'
import type {RefObject} from 'react'
import {useCallback} from 'react'
import type {Option} from '../../types'
import {useMarkput} from './useMarkput'

export interface OverlayHandler {
  style: {left: number; top: number}
  close: () => void
  select: (value: {value: string; meta?: string}) => void
  match: OverlayMatch<Option> | undefined
  ref: RefObject<HTMLElement | null>
}

export function useOverlay(): OverlayHandler {
  const {match, overlay} = useMarkput(s => ({match: s.overlay.match, overlay: s.overlay}))
  const style = useMarkput(s => s.overlay.position())
  const close = useCallback(() => overlay.close(), [overlay])
  const select = useCallback(
    (value: {value: string; meta?: string}) => {
      if (!match) return
      const mark = createMarkFromOverlay(match, value.value, value.meta)
      overlay.select({mark, match})
      overlay.close()
    },
    [match, overlay]
  )
  const ref = useMemo(
    (): RefObject<HTMLElement | null> => ({
      get current() { return overlay.element() },
      set current(v: HTMLElement | null) { overlay.element(v) },
    }),
    [overlay]
  )
  return {match, style, select, close, ref}
}
```

- [ ] **Step 3: Update Vue `useOverlay.ts`**

```ts
// Remove: import {Caret, createMarkFromOverlay} from '@markput/core'
// Add:    import {createMarkFromOverlay} from '@markput/core'
// Replace the style computed (drop the _ = matchRef.value workaround):
const style = computed(() => store.overlay.position())
```

Full updated hook:

```ts
import type {OverlayMatch} from '@markput/core'
import {createMarkFromOverlay} from '@markput/core'
import {computed, type Ref, type ComputedRef} from 'vue'
import type {Option} from '../../types'
import {useMarkput} from './useMarkput'
import {useStore} from './useStore'

export interface OverlayHandler {
  style: ComputedRef<{left: number; top: number}>
  close: () => void
  select: (value: {value: string; meta?: string}) => void
  match: Ref<OverlayMatch<Option> | undefined>
  ref: { get current(): HTMLElement | null; set current(v: HTMLElement | null) }
}

export function useOverlay(): OverlayHandler {
  const store = useStore()
  const matchRef = useMarkput(s => s.overlay.match) as Ref<OverlayMatch<Option> | undefined>
  const style = computed(() => store.overlay.position())
  const close = () => store.overlay.close()
  const select = (value: {value: string; meta?: string}) => {
    const match = matchRef.value
    if (!match) return
    const mark = createMarkFromOverlay(match, value.value, value.meta)
    store.overlay.select({mark, match})
    store.overlay.close()
  }
  const ref = {
    get current() { return store.overlay.element() },
    set current(v: HTMLElement | null) { store.overlay.element(v) },
  }
  return {match: matchRef, style, select, close, ref}
}
```

- [ ] **Step 4: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: ≥545 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/overlay/OverlayController.ts packages/react/markput/src/lib/hooks/useOverlay.tsx packages/vue/markput/src/lib/hooks/useOverlay.ts
git commit -m "refactor(overlay): move position math into OverlayController.position; remove Caret from adapters"
```

---

### Task 3.5 — Delete `Caret.ts`; update `index.ts` and public exports

**Files:**
- Delete: `packages/core/src/features/caret/Caret.ts`
- Delete: `packages/core/src/features/caret/Caret.spec.ts`
- Modify: `packages/core/src/features/caret/index.ts`
- Modify: `packages/core/index.ts`
- Modify: `packages/core/README.md`

- [ ] **Step 1: Verify no remaining `Caret` callers**

```bash
grep -rn "import.*Caret\b\|from.*Caret\b" packages/ --include="*.ts" --include="*.tsx" | grep -v "caretDom\|CaretModel\|\.spec\."
```

Expected: no output.

- [ ] **Step 2: Delete `Caret.ts` and `Caret.spec.ts`**

```bash
rm packages/core/src/features/caret/Caret.ts packages/core/src/features/caret/Caret.spec.ts
```

- [ ] **Step 3: Update `caret/index.ts`**

```ts
export {CaretModel} from './CaretModel'
export {TriggerFinder} from './TriggerFinder'
export * as caretDom from './caretDom'
```

- [ ] **Step 4: Update `packages/core/index.ts`** — extend `@breaking b0` header and add `caretDom` export:

```ts
/**
 * @breaking b0: `CaretRecovery` type removed. Replace with `store.caret.range()`.
 *   `MarkputState.recovery` and `value.change` no longer exist — the single source
 *   of truth is `CaretModel.range` (a `Signal<RawRange | undefined>`) applied to
 *   the DOM by `DomController` after every render.
 *
 * @breaking b0: `Caret` static utility class removed. Migration paths:
 *   - `Caret.getCaretIndex(el)`, `setIndex(el, n)`, `setCaretToEnd(el)`,
 *     `trySetIndex(el, n)`, `setAtX(el, x, y)`, `getCaretRect()`,
 *     `isCaretOnFirstLine(el)`, `isCaretOnLastLine(el)` → import `caretDom`
 *     from '@markput/core' and call the equivalent function.
 *   - `Caret.getAbsolutePosition()` → use `store.overlay.position()`.
 *   - `Caret.getCurrentPosition()`, `getSelectedNode()`, `getFocusedSpan()`,
 *     `isSelectedPosition` → call `window.getSelection()` directly.
 *   - `Caret.getIndex`, `setIndex1`, `setCaretRightTo` → unused; no replacement.
 */
```

Replace `export {Caret} from './src/features/caret'` with:

```ts
// Caret DOM utilities
export {caretDom} from './src/features/caret'
```

- [ ] **Step 5: Update `packages/core/README.md`**

Remove lines referencing `Caret` (line 12, 24, 34, 71). Replace with:

```md
- Caret utilities: `import {caretDom} from '@markput/core'` — `getCaretIndex`, `setAtElement`, `setAtX`, `getRect`, `isOnFirstLine`, `isOnLastLine`
```

- [ ] **Step 6: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: ≥ previous phase count (Caret.spec.ts deleted, caretDom.spec.ts already present — roughly neutral).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/features/caret/ packages/core/index.ts packages/core/README.md
git commit -m "feat(caret)!: delete Caret static class; export caretDom module; update public API docs"
```

---

## Phase 4 — `DomController` placement API rename

Goal: rename `placeCaretAtRawPosition` → `placeAt` (keep `affinity`); promote `#placeSelection` → `placeRange`; both return `{applied}`.

---

### Task 4.1 — Rename and reshape placement methods

**Files:**
- Modify: `packages/core/src/features/dom/DomController.ts`
- Modify: `packages/core/src/features/dom/DomController.spec.ts`
- Modify: `packages/core/src/features/caret/CaretModel.ts`
- Modify: `packages/core/src/features/keyboard/arrowNav.ts`

- [ ] **Step 1: Write tests for new return shape**

Add to `DomController.spec.ts`:

```ts
it('placeAt returns applied position on success', () => {
  const store = new Store()
  const container = document.createElement('div')
  const span = document.createElement('span')
  span.textContent = 'hello world'
  span.contentEditable = 'true'
  container.appendChild(span)
  document.body.appendChild(container)

  store.props.set({defaultValue: 'hello world'})
  store.lifecycle.mounted()
  store.dom.container(container)
  store.lifecycle.rendered()

  const result = store.dom.placeAt(5)
  expect(result).toEqual({ok: true, value: {applied: 5}})
  container.remove()
})

it('placeAt clamps position to value length', () => {
  const store = new Store()
  const container = document.createElement('div')
  container.appendChild(document.createElement('span'))
  document.body.appendChild(container)

  store.props.set({defaultValue: 'hi'})
  store.lifecycle.mounted()
  store.dom.container(container)
  store.lifecycle.rendered()

  const result = store.dom.placeAt(999)
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.applied).toBeLessThanOrEqual(2)
  container.remove()
})

it('placeRange returns applied range on success', () => {
  const store = new Store()
  const container = document.createElement('div')
  const span = document.createElement('span')
  span.textContent = 'hello world'
  span.contentEditable = 'true'
  container.appendChild(span)
  document.body.appendChild(container)

  store.props.set({defaultValue: 'hello world'})
  store.lifecycle.mounted()
  store.dom.container(container)
  store.lifecycle.rendered()

  const result = store.dom.placeRange({start: 0, end: 5})
  expect(result.ok).toBe(true)
  container.remove()
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm --filter @markput/core test --run -- DomController
```

Expected: FAIL for the three new tests.

- [ ] **Step 3: Rename methods in `DomController.ts`**

Rename `placeCaretAtRawPosition` → `placeAt`. Keep `affinity` parameter. Update return type:

```ts
placeAt(
  rawPosition: number,
  affinity: 'before' | 'after' = 'after'
): Result<{applied: number}, 'notIndexed' | 'invalidBoundary'> {
  if (!this.index()) return {ok: false, reason: 'notIndexed'}
  const maxPos = this.value.current().length
  const clamped = Math.min(rawPosition, maxPos)
  const target = this.#findTextTargetForRawPosition(clamped, affinity)
  if (!target) {
    const boundary = this.#focusMarkBoundaryForRawPosition(clamped)
    if (!boundary.ok) return boundary as Result<never, 'notIndexed' | 'invalidBoundary'>
    return {ok: true, value: {applied: clamped}}
  }
  target.element.focus()
  this.#placeCaretInTextSurface(target.element, clamped - target.start)
  return {ok: true, value: {applied: clamped}}
}
```

Promote `#placeSelection` → `placeRange`:

```ts
placeRange(range: RawRange): Result<{applied: RawRange}, 'notIndexed' | 'invalidBoundary'> {
  const maxPos = this.value.current().length
  const clamped: RawRange = {
    start: Math.min(range.start, maxPos),
    end: Math.min(range.end, maxPos),
  }
  const result = this.#placeSelectionInternal({range: clamped, direction: undefined})
  if (!result.ok) return result as Result<never, 'notIndexed' | 'invalidBoundary'>
  return {ok: true, value: {applied: clamped}}
}

// rename old #placeSelection to #placeSelectionInternal (or inline the body)
```

- [ ] **Step 4: Remove the Phase 2 compatibility shims** from `DomController.ts`

```ts
// Remove these (added in Task 2.3 Step 4):
// placeAt(...) shim
// placeRange(...) shim
```

- [ ] **Step 5: Update `arrowNav.ts`** — rename the calls:

```ts
// Line 63: store.dom.placeCaretAtRawPosition(sibling?.position.end ?? 0, 'before')
store.dom.placeAt(sibling?.position.end ?? 0, 'before')

// Line 66: store.dom.placeCaretAtRawPosition(sibling?.position.start ?? 0, 'after')
store.dom.placeAt(sibling?.position.start ?? 0, 'after')
```

- [ ] **Step 6: Update `CaretModel.#applyRangeToDOM`** — it already calls `placeAt`/`placeRange` (from Phase 2 wiring). Verify it calls correctly and handles the `{applied}` return shape (written in Phase 2 Task 2.3 to use these names).

- [ ] **Step 7: Update `DomController.spec.ts`** — rename `placeCaretAtRawPosition` to `placeAt` in existing tests:

```bash
grep -n "placeCaretAtRawPosition" packages/core/src/features/dom/DomController.spec.ts
```

Update each occurrence to `placeAt`.

- [ ] **Step 8: Remove the `#applyRangeToDOM` method from `DomController.ts`** if it still exists (it should have been removed in Phase 2, but verify):

```bash
grep -n "#applyRangeToDOM\|applyRangeToDOM" packages/core/src/features/dom/DomController.ts
```

Expected: no output (already removed in Phase 2).

- [ ] **Step 9: Run all core tests**

```bash
pnpm --filter @markput/core test --run
```

Expected: all passing; final count ≥ 545.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/features/dom/DomController.ts packages/core/src/features/dom/DomController.spec.ts packages/core/src/features/caret/CaretModel.ts packages/core/src/features/keyboard/arrowNav.ts
git commit -m "refactor(dom): rename placeCaretAtRawPosition→placeAt; promote #placeSelection→placeRange; both return {applied}"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| `setAt`, `select`, `collapse` pure commands | 1.1 |
| `isCollapsed`, `position`, `selection` derived | 1.1 |
| `isFullSelection`, `selectAll` with explicit range write | 1.2 |
| 10 `selecting` wrapper-method sites migrated | 1.3, 1.4 |
| 14 collapsed-range writes migrated | 1.5 |
| Block-mode Ctrl+A bail in `arrowNav.ts` | 1.4 |
| `selectionHelpers.ts` deleted | 1.6 |
| `dom.indexed` event | 2.1 |
| `dom.readOnly` computed | 2.1 |
| `reconcile({selecting})` opts | 2.1 |
| Single reconcile driver (effect tracks both) | 2.3 |
| Empty-editor click handler in `DomController` | 2.2 |
| `focus.ts`, `selection.ts` deleted | 2.3 |
| `#applyRangeToDOM` in `CaretModel` | 2.3 |
| `Store.ts` reordering, new `caret` constructor | 2.3 |
| `caretDom.ts` with 6 functions | 3.1 |
| `blockEdit.ts` migration | 3.2 |
| `TriggerFinder.ts` updated, no caret dep | 3.3 |
| `TriggerFinder.spec.ts` rewritten | 3.3 |
| `OverlayController.position` computed | 3.4 |
| React/Vue adapter hooks updated | 3.4 |
| `Caret.ts` deleted | 3.5 |
| `@breaking b0` header updated | 3.5 |
| `packages/core/index.ts` export update | 3.5 |
| `placeAt` rename (affinity retained) | 4.1 |
| `placeRange` public promotion | 4.1 |
| Both return `{applied}` | 4.1 |
| Clamping internal to `placeAt`/`placeRange` | 4.1 |

All spec requirements covered.

### Placeholder scan

No TBDs or "implement later" notes found.

### Type consistency check

- `RawRange` used consistently in `CaretModel.select()`, `#applyRangeToDOM`, `placeRange`.
- `caretDom.*` function names match between `caretDom.ts`, `blockEdit.ts` migration table, and `index.ts` export.
- `dom.placeAt` / `dom.placeRange` names used in `CaretModel.#applyRangeToDOM` match Phase 4 final API.
- Phase 2 adds compatibility shims for `placeAt`/`placeRange` so Phase 2 tests pass before Phase 4 renames them.
