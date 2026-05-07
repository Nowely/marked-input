# Caret/Value Decouple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `ValueFeature`'s dependency on `CaretFeature`; replace the split `recovery`/`location` signals with a single `caret.range` reactive primitive; replace `DomFeature`'s one-shot `#applyPendingRecovery` with a continuous follow-the-signal effect.

**Non-goals:** No change to parsing, drag-row semantics, `selecting` signal, or React/Vue adapters.

**Tech stack:** TypeScript, alien-signals (internal), Vitest + jsdom (unit tests), pnpm workspaces.  
**Spec:** `packages/core/src/features/caret/SPEC-rethink.md`  
**Test commands:** focused: `pnpm -w exec vitest run <path>` · full: `pnpm test` · all checks: `pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`

---

## Bridging strategy

Every task must typecheck and pass tests. We cannot switch `ValueFeature` and all callers atomically, so we keep three bridges alive until all callers have migrated:

1. `caret.recovery` — kept as a writable signal through Task 10; `#applyPendingRecovery` keeps running. Once all call sites use `caret.range` instead, Task 11 deletes both.
2. `caret.location` (writeable) — kept as a plain signal through Tasks 1–2; replaced with a `Computed` in Task 3. Imperative writes to it continue until Task 11 cleans them.
3. `ValueFeature.replaceRange` `{recover}` option — kept as a valid (accepted but ignored) parameter through Tasks 6–8; removed when `ValueFeature` is purified in Task 9.

The rule: before Task 9, callers can pass `{recover}` or write `caret.range` — both work. After Task 9, only `caret.range` exists.

---

## Decisions

**OOB handling.** Out-of-bounds `range` values are **clamped** to `{start: maxPos, end: maxPos}` where `maxPos = value.current().length`. No `recoveryFailed` is emitted for clamping; `recoveryFailed` is only emitted when DOM placement fails even at the clamped position. `#clearStaleRange` (the "clear on OOB" method present in drafts) is not implemented; `#applyRangeToDOM` is the sole OOB handler.

**Drop `'row'` role.** `deriveLocation` does not produce `'row'`. Top-level marks in drag mode return `'token'`. The only consumer that reads `location.role` is `arrowNav.ts:32`: `const focusedMark = token.value.type === 'mark' && location.role !== 'text'` — `'token'` satisfies `!== 'text'`, so behavior is unchanged.

**Drop controlled-mode echo gating.** Today `ValueFeature` holds `{recover}` in `#pending` until the controlled parent echoes the value. After this plan, `caret.range` is written at call time; if the parent ignores `onChange`, the range refers to positions in the rejected value and `#applyRangeToDOM` places the caret against old DOM (likely close but not precise). The test `"does not set recovery when controlled parent ignores the change"` is removed.

---

## Migration recipe

For every `{recover: {kind: 'caret', rawPosition: P}}` site, apply:

```ts
// Before
store.value.replaceRange(range, x, {recover: {kind: 'caret', rawPosition: P}})

// After
store.caret.range({start: P, end: P})
store.value.replaceRange(range, x)
```

The two lines commute — order does not matter within the same event handler.

---

## Phase → task map

| Spec phase | Tasks |
|---|---|
| S1.1 Types & Contracts | 1 |
| S1.2 CaretFeature restructure | 2, 3 |
| S1.3 DomFeature apply + DOM→signal | 4, 5 |
| S1.5 Call site migration | 6, 7, 8 |
| S1.4 ValueFeature purification | 9 |
| S1.6 Bridge removal + docs | 10 (check), 11 (remove), 12 (docs) |

---

## Task 1: Add `range` signal

*Why: establishes the new primitive alongside existing `recovery`/`location` — no callers yet, just the contract.*

**Files:** `CaretFeature.ts`, `CaretFeature.spec.ts`

- [ ] **Step 1: Replace `CaretFeature.spec.ts`**

```ts
import {describe, it, expect, vi} from 'vitest'
import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('CaretFeature', () => {
  it('exposes range, selecting, location, recovery', () => {
    const store = new Store()
    expect(typeof store.caret.range).toBe('function')
    expect(typeof store.caret.selecting).toBe('function')
    expect(typeof store.caret.location).toBe('function')
    expect(typeof store.caret.recovery).toBe('function') // bridge; removed in Task 11
  })

  it('range starts undefined', () => {
    expect(new Store().caret.range()).toBeUndefined()
  })

  it('range write is structural-equality deduped', () => {
    const store = new Store()
    const notify = vi.fn()
    const stop = watch(store.caret.range, notify)
    store.caret.range({start: 5, end: 5})
    store.caret.range({start: 5, end: 5}) // same values, new object
    expect(notify).toHaveBeenCalledTimes(1)
    stop()
  })

  it('range undefined write is no-op when already undefined', () => {
    const store = new Store()
    const notify = vi.fn()
    const stop = watch(store.caret.range, notify)
    store.caret.range(undefined)
    expect(notify).not.toHaveBeenCalled()
    stop()
  })
})
```

- [ ] **Step 2: Run — expect 2 failures** (`range` missing)

```bash
pnpm -w exec vitest run packages/core/src/features/caret/CaretFeature.spec.ts
```

- [ ] **Step 3: Replace `CaretFeature.ts`**

```ts
import type {CaretLocation, CaretRecovery, RawRange} from '../../shared/editorContracts'
import {signal} from '../../shared/signals'

// CaretRecovery import: bridge, removed in Task 11
export class CaretFeature {
  readonly range = signal<RawRange | undefined>(undefined, {
    equals: (a, b) =>
      a === b ||
      (a !== undefined && b !== undefined && a.start === b.start && a.end === b.end),
  })

  readonly recovery = signal<CaretRecovery | undefined>(undefined) // bridge; removed in Task 11
  readonly location = signal<CaretLocation | undefined>(undefined) // replaced with Computed in Task 3
  readonly selecting = signal<'drag' | 'all' | undefined>(undefined)
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
pnpm -w exec vitest run packages/core/src/features/caret/CaretFeature.spec.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/caret/CaretFeature.ts \
         packages/core/src/features/caret/CaretFeature.spec.ts
git commit -m "feat(caret): add range signal with structural equality (spec §4.1)"
```

---

## Task 2: Create `deriveLocation` pure function

*Why: pure function needed by Task 3's computed; isolated here so Task 3 stays focused on wiring.*

**Files:** `deriveLocation.ts` (new), `deriveLocation.spec.ts` (new)

- [ ] **Step 1: Create `deriveLocation.spec.ts`**

```ts
import {describe, it, expect} from 'vitest'
import {Store} from '../../store/Store'
import {deriveLocation} from './deriveLocation'

describe('deriveLocation', () => {
  it('returns undefined when range is undefined', () => {
    const store = new Store()
    store.lifecycle.mounted()
    store.props.set({value: 'hello'})
    expect(deriveLocation(undefined, store.parsing.tokens(), store.parsing.index())).toBeUndefined()
  })

  it('returns undefined when position is out of bounds', () => {
    const store = new Store()
    store.lifecycle.mounted()
    store.props.set({value: 'hi'})
    expect(
      deriveLocation({start: 999, end: 999}, store.parsing.tokens(), store.parsing.index())
    ).toBeUndefined()
  })

  it('returns text role for position inside a text token', () => {
    const store = new Store()
    store.lifecycle.mounted()
    store.props.set({value: 'hello'})
    const result = deriveLocation({start: 2, end: 2}, store.parsing.tokens(), store.parsing.index())
    expect(result?.role).toBe('text')
  })

  it('returns token role for position inside a mark token', () => {
    const store = new Store()
    store.lifecycle.mounted()
    store.props.set({value: '@[Alice](123)', options: [{markup: '@[__value__](__meta__)'}]})
    const tokens = store.parsing.tokens()
    const mark = tokens.find(t => t.type === 'mark')!
    const mid = Math.floor((mark.position.start + mark.position.end) / 2)
    const result = deriveLocation({start: mid, end: mid}, tokens, store.parsing.index())
    expect(result?.role).toBe('token')
  })
})
```

- [ ] **Step 2: Run — expect 4 failures** (module not found)

```bash
pnpm -w exec vitest run packages/core/src/features/caret/deriveLocation.spec.ts
```

- [ ] **Step 3: Create `deriveLocation.ts`**

```ts
import type {CaretLocation, RawRange} from '../../shared/editorContracts'
import type {Token} from '../parsing'
import type {TokenIndex} from '../parsing/tokenIndex'

export function deriveLocation(
  range: RawRange | undefined,
  tokens: readonly Token[],
  index: TokenIndex,
): CaretLocation | undefined {
  if (range === undefined) return undefined
  return findAt(range.start, tokens, [], index, 0)
}

function findAt(
  pos: number,
  tokens: readonly Token[],
  path: number[],
  index: TokenIndex,
  depth: number,
): CaretLocation | undefined {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (pos < token.position.start || pos > token.position.end) continue
    const tokenPath = [...path, i]
    const address = index.addressFor(tokenPath)
    if (!address) return undefined
    if (token.type === 'mark' && token.children.length > 0) {
      const nested = findAt(pos, token.children, tokenPath, index, depth + 1)
      if (nested) return nested
    }
    if (token.type === 'text') return {address, role: 'text'}
    // depth > 0: nested mark inside a slot → 'markDescendant'
    // depth = 0: top-level mark (incl. drag-mode rows) → 'token'
    // 'row' is not produced; arrowNav only checks role !== 'text' (arrowNav.ts:32)
    return {address, role: depth > 0 ? 'markDescendant' : 'token'}
  }
  return undefined
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
pnpm -w exec vitest run packages/core/src/features/caret/deriveLocation.spec.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/caret/deriveLocation.ts \
         packages/core/src/features/caret/deriveLocation.spec.ts
git commit -m "feat(caret): add deriveLocation pure function (spec §4.3)"
```

---

## Task 3: Replace `location` signal with computed; wire `CaretFeature` to parsing

*Why: makes `location` a derived view — no more imperative writes scattered across focus/selection/dom. Uses a `wire()` method rather than a constructor arg because `CaretFeature` is declared on line 28 of `Store.ts`, `ParsingFeature` on line 38; field initializers run top-to-bottom before the constructor body, so by the time `constructor() { this.caret.wire(this.parsing) }` runs, both fields exist.*

**Files:** `CaretFeature.ts`, `CaretFeature.spec.ts`, `focus.spec.ts`, `Store.ts`

- [ ] **Step 1: Append to `CaretFeature.spec.ts`** (inside the existing `describe`, after existing tests)

```ts
  describe('location computed (after wire)', () => {
    it('is undefined when range is undefined', () => {
      const store = new Store()
      store.lifecycle.mounted()
      store.props.set({value: 'hello'})
      expect(store.caret.location()).toBeUndefined()
    })

    it('derives text role from position inside text token', () => {
      const store = new Store()
      store.lifecycle.mounted()
      store.props.set({value: 'hello'})
      store.caret.range({start: 2, end: 2})
      expect(store.caret.location()?.role).toBe('text')
    })

    it('updates when range changes', () => {
      const store = new Store()
      store.lifecycle.mounted()
      store.props.set({value: 'hello'})
      store.caret.range({start: 1, end: 1})
      expect(store.caret.location()?.role).toBe('text')
      store.caret.range(undefined)
      expect(store.caret.location()).toBeUndefined()
    })
  })
```

- [ ] **Step 2: Run — expect 3 failures** (`location` is still a plain signal)

```bash
pnpm -w exec vitest run packages/core/src/features/caret/CaretFeature.spec.ts
```

- [ ] **Step 3: Replace `CaretFeature.ts`**

```ts
import type {CaretLocation, CaretRecovery, RawRange} from '../../shared/editorContracts'
import {computed, signal} from '../../shared/signals'
import type {Computed} from '../../shared/signals'
import type {ParsingFeature} from '../parsing/ParseFeature'
import {deriveLocation} from './deriveLocation'

// CaretRecovery import: bridge, removed in Task 11
export class CaretFeature {
  readonly range = signal<RawRange | undefined>(undefined, {
    equals: (a, b) =>
      a === b ||
      (a !== undefined && b !== undefined && a.start === b.start && a.end === b.end),
  })

  // Computed from range + tokens. Read-only. wire() must be called before first read.
  readonly location: Computed<CaretLocation | undefined>

  readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

  readonly recovery = signal<CaretRecovery | undefined>(undefined) // bridge; removed in Task 11

  // wire() exists because CaretFeature is instantiated before ParsingFeature in Store.
  // All field initializers complete before the Store constructor body runs, so by the
  // time wire() is called, both caret and parsing are fully initialized.
  #parsing: ParsingFeature | undefined

  constructor() {
    this.location = computed(() => {
      const p = this.#parsing
      if (!p) return undefined
      return deriveLocation(this.range(), p.tokens(), p.index())
    })
  }

  wire(parsing: ParsingFeature): void {
    this.#parsing = parsing
  }
}
```

- [ ] **Step 4: Add a constructor to `Store.ts`**

After the last field declaration (`readonly handler = ...`), add:

```ts
  constructor() {
    this.caret.wire(this.parsing)
  }
```

- [ ] **Step 5: Fix `focus.spec.ts`** — the test at line 48 writes `store.caret.location({...})` which is now a type error (Computed is read-only)

Replace the `describe('disable()')` block:

```ts
  describe('focusout clears range', () => {
    it('range is undefined after focusout', () => {
      const store = new Store()
      const container = document.createElement('div')
      store.dom.container(container)
      store.lifecycle.mounted()

      store.caret.range({start: 2, end: 2})
      container.dispatchEvent(new FocusEvent('focusout', {bubbles: true}))

      expect(store.caret.range()).toBeUndefined()
    })
  })
```

- [ ] **Step 6: Run — expect all pass**

```bash
pnpm -w exec vitest run packages/core/src/features/caret/CaretFeature.spec.ts
pnpm -w exec vitest run packages/core/src/features/caret/focus.spec.ts
pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/features/caret/CaretFeature.ts \
         packages/core/src/features/caret/CaretFeature.spec.ts \
         packages/core/src/features/caret/focus.spec.ts \
         packages/core/src/store/Store.ts
git commit -m "feat(caret): location computed via wire(); Store calls wire after parsing init"
```

---

## Task 4: Add `#applyRangeToDOM` to `DomFeature`

*Why: establishes the continuous apply effect inside `#commitRendered()` (not `reconcile()` — that method only does text-surface reconciliation). Both `#applyPendingRecovery` and `#applyRangeToDOM` run during the bridge period; the last writer wins. Once call sites migrate to `caret.range`, `recovery` stays `undefined` and `#applyPendingRecovery` is a no-op.*

**Files:** `DomFeature.ts`, `DomFeature.spec.ts`

- [ ] **Step 1: Write failing tests** (add after the existing recovery tests around line 387)

```ts
it('applies caret.range to DOM after render', () => {
  const {store, container, textNode} = mountStructuralInline('hello')

  store.caret.range({start: 3, end: 3})
  store.lifecycle.rendered()

  const sel = window.getSelection()
  expect(sel?.focusNode).toBe(textNode)
  expect(sel?.focusOffset).toBe(3)
  container.remove()
})

it('clamps OOB range and places caret at clamped position', () => {
  const {store, container, textNode} = mountStructuralInline('hello') // length 5
  store.caret.range({start: 999, end: 999})
  store.lifecycle.rendered()

  // clamped to maxPos (5); structural equality prevents re-fire
  expect(store.caret.range()).toEqual({start: 5, end: 5})
  container.remove()
})

it('skips apply when drag-selecting', () => {
  const {store, container} = mountStructuralInline('hello')
  store.caret.range({start: 2, end: 2})
  store.caret.selecting('drag')
  store.lifecycle.rendered()

  expect(store.caret.range()).toEqual({start: 2, end: 2})
  container.remove()
})
```

- [ ] **Step 2: Run — expect 3 failures**

```bash
pnpm -w exec vitest run packages/core/src/features/dom/DomFeature.spec.ts
```

- [ ] **Step 3: Add `#applyRangeToDOM` to `DomFeature.ts`**

Add the method after `#applyPendingRecovery` (around line 800):

```ts
#applyRangeToDOM(): void {
  if (this.caret.selecting() === 'drag') return
  const range = this.caret.range()
  if (range === undefined) return

  const maxPos = this.value.current().length
  const clampedStart = Math.min(range.start, maxPos)
  const clampedEnd   = Math.min(range.end,   maxPos)

  // Write back clamped values; structural equality prevents re-propagation if unchanged.
  if (clampedStart !== range.start || clampedEnd !== range.end) {
    this.caret.range({start: clampedStart, end: clampedEnd})
  }

  if (clampedStart === clampedEnd) {
    const result = this.placeCaretAtRawPosition(clampedStart)
    if (!result.ok) {
      this.caret.range(undefined)
      this.diagnostics({kind: 'recoveryFailed', reason: `caret placement failed: ${result.reason}`})
    }
    return
  }

  const result = this.#placeSelection({range: {start: clampedStart, end: clampedEnd}, direction: undefined})
  if (!result.ok) {
    this.caret.range(undefined)
    this.diagnostics({kind: 'recoveryFailed', reason: `selection placement failed: ${result.reason}`})
  }
}
```

`DomFeature` does not currently receive `value` — add it to the constructor parameters and update `Store.ts`:

In `DomFeature.ts` constructor signature, add `private readonly value: ValueFeature` and the import.

In `Store.ts`:
```ts
readonly dom = new DomFeature(this.lifecycle, this.props, this.caret, this.parsing, this.value)
```

Then in `#commitRendered()`, add the call after `#applyPendingRecovery()`:

```ts
this.#clearStaleCaretLocation()
this.#applyPendingRecovery()
this.#applyRangeToDOM()      // ← add this line
```

- [ ] **Step 4: Run — expect all pass**

```bash
pnpm -w exec vitest run packages/core/src/features/dom/DomFeature.spec.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/dom/DomFeature.ts \
         packages/core/src/features/dom/DomFeature.spec.ts \
         packages/core/src/store/Store.ts
git commit -m "feat(dom): add #applyRangeToDOM in #commitRendered (spec §4.4, AC-2.2)"
```

---

## Task 5: Wire DOM events to `caret.range`

*Why: closes the read loop — DOM events now write `range` so `#applyRangeToDOM` can restore it after re-renders. Structural equality on `range` prevents the loop: apply writes DOM → `selectionchange` reads same `{start,end}` → `equals` returns true → no re-propagation.*

**Files:** `focus.ts`, `selection.ts`

- [ ] **Step 1: Replace `focus.ts`**

```ts
import {firstHtmlChild, isHtmlElement} from '../../shared/checkers'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export function enableFocus(store: Pick<Store, 'dom' | 'caret' | 'parsing'>): void {
  const container = store.dom.container()
  if (!container) return

  listen(container, 'focusin', e => {
    const target = isHtmlElement(e.target) ? e.target : undefined
    if (!target) {
      store.caret.location(undefined)
      store.caret.range(undefined)
      return
    }
    const result = store.dom.locateNode(target)
    if (!result.ok) {
      if (result.reason === 'control') return
      store.caret.location(undefined)
      store.caret.range(undefined)
      return
    }
    const role = result.value.textElement?.contains(target) ? 'text' : 'markDescendant'
    store.caret.location({address: result.value.address, role}) // bridge; removed in Task 11

    const rawSel = store.dom.readRawSelection()
    if (rawSel.ok) store.caret.range(rawSel.value.range)
  })

  listen(container, 'focusout', () => {
    store.caret.location(undefined)
    store.caret.range(undefined)
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

- [ ] **Step 2: Replace `selection.ts`**

```ts
import {nodeTarget} from '../../shared/checkers'
import {effect, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export function enableSelection(store: Pick<Store, 'dom' | 'caret'>): void {
  let pressedNode: Node | null = null
  let isPressed = false

  listen(document, 'mousedown', e => {
    pressedNode = nodeTarget(e)
    isPressed = true
  })

  listen(document, 'mousemove', e => {
    const container = store.dom.container()
    if (!container) return
    const isNotInnerSome = !container.contains(pressedNode) || pressedNode !== e.target
    const isInside = window.getSelection()?.containsNode(container, true)
    if (isPressed && isNotInnerSome && isInside) {
      if (store.caret.selecting() !== 'drag') store.caret.selecting('drag')
    }
  })

  listen(document, 'mouseup', () => {
    isPressed = false
    pressedNode = null
    if (store.caret.selecting() === 'drag') {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) store.caret.selecting(undefined)
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
      store.caret.location(undefined)  // bridge; removed in Task 11
      store.caret.range(undefined)
      return
    }

    const role = result.value.textElement?.contains(sel.focusNode) ? 'text' : 'markDescendant'
    store.caret.location({address: result.value.address, role}) // bridge; removed in Task 11

    const rawSel = store.dom.readRawSelection()
    // rawSel and result are independent reads; rawSel.ok does not imply result.ok
    if (rawSel.ok) store.caret.range(rawSel.value.range)
    else store.caret.range(undefined)
  })

  effect(() => {
    const value = store.caret.selecting()
    if (value === 'drag') store.dom.reconcile()
  })

  effect(() => () => {
    if (store.caret.selecting() === 'drag') store.caret.selecting(undefined)
  })
}
```

- [ ] **Step 3: Run full suite**

```bash
pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/caret/focus.ts \
         packages/core/src/features/caret/selection.ts
git commit -m "feat(caret): write caret.range from DOM events (bridge: location writes kept)"
```

---

## Task 6: Migrate `keyboard/input.ts`

*Why: self-contained file, no new constructor deps needed.*

Apply the migration recipe (see top) to every `{recover: ...}` site in `input.ts`.

**Files:** `input.ts`, `input.spec.ts`

- [ ] **Step 1: Apply recipe to 4 sites + `replaceAllContentWith` in `input.ts`**

| Anchor (search for) | `P` value |
|---|---|
| `range.start + data.length` in `compositionend` | `range.start + data.length` |
| `rawPosition: range.start` in `handleDeleteKey` | `range.start` |
| `range.start + replacement.length` in `handleBeforeInput` | `range.start + replacement.length` |
| `replaceAllContentWith` function body | `newContent.length` |

Final `replaceAllContentWith`:
```ts
export function replaceAllContentWith(store: KbCtx, newContent: string): void {
  store.caret.selecting(undefined)
  store.caret.range({start: newContent.length, end: newContent.length})
  store.value.replaceAll(newContent)
}
```

- [ ] **Step 2: Update `input.spec.ts`**

Find the assertion checking `replaceRange` was called with `{recover: {kind: 'caret', rawPosition: 2}}` (around line 101). Change to verify the two-call pattern — check `store.caret.range()` equals the expected `{start, end}` and `replaceRange` was called without a third arg. Adjust for whatever the test's actual variable names are.

- [ ] **Step 3: Run**

```bash
pnpm -w exec vitest run packages/core/src/features/keyboard/input.spec.ts
pnpm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/keyboard/input.ts \
         packages/core/src/features/keyboard/input.spec.ts
git commit -m "refactor(keyboard): replace recover option with caret.range in input.ts"
```

---

## Task 7: Migrate `blockEdit.ts`, `MarkController.ts`, `ClipboardFeature.ts`

*Why: grouped because `ClipboardFeature` needs a new `caret` constructor arg, which requires a `Store.ts` edit; `blockEdit.ts` and `MarkController.ts` are pure site migrations with no dep changes.*

**Files:** `blockEdit.ts`, `MarkController.ts`, `ClipboardFeature.ts`, `Store.ts`

- [ ] **Step 1: Apply recipe to 7 sites in `blockEdit.ts`**

Each anchor is a `recover: {kind: 'caret', rawPosition: X}` line. Locate by searching for `recover:` in the file. Positions:

| Handler | `P` expression |
|---|---|
| Backspace delete block | `const pos = previous ? previous.position.end : 0` |
| Backspace merge (first joinPos) | `joinPos` |
| Delete merge | `joinPos` |
| Delete next-row merge | `joinPos` |
| Enter non-text-like row | `token.position.end + newRowContent.length` |
| Enter text-like row (`replaceRange`) | `absolutePos + newRowContent.length` |
| `replaceBlockRange` function | `range.start + replacement.length` |

Write `store.caret.range({start: P, end: P})` on the line immediately before each `store.value.replaceAll/replaceRange` call, then remove the `{recover}` argument.

- [ ] **Step 2: Update `MarkController.ts`**

```ts
// Before:
this.store.value.replaceRange(resolved.position, '', {recover: undefined})

// After:
this.store.value.replaceRange(resolved.position, '')
```

- [ ] **Step 3: Update `ClipboardFeature.ts`** — add `caret` constructor arg

Add `import type {CaretFeature} from '../caret/CaretFeature'` and add `private readonly caret: CaretFeature` to the constructor. Then migrate the cut handler:

```ts
// Before:
value.replaceRange(raw.value.range, '', {
  recover: {kind: 'caret', rawPosition: raw.value.range.start},
})

// After:
this.caret.range({start: raw.value.range.start, end: raw.value.range.start})
this.value.replaceRange(raw.value.range, '')
```

- [ ] **Step 4: Update `Store.ts`** — pass `this.caret` to `ClipboardFeature`

```ts
readonly clipboard = new ClipboardFeature(this.lifecycle, this.value, this.dom, this.parsing, this.caret)
```

- [ ] **Step 5: Run**

```bash
pnpm test && pnpm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/keyboard/blockEdit.ts \
         packages/core/src/features/mark/MarkController.ts \
         packages/core/src/features/clipboard/ClipboardFeature.ts \
         packages/core/src/store/Store.ts
git commit -m "refactor(keyboard,mark,clipboard): replace recover option with caret.range writes"
```

---

## Task 8: Migrate `DragFeature` and `OverlayFeature`

*Why: grouped because both need a new `caret` constructor arg and `Store.ts` edits. `OverlayFeature` also requires a full method rewrite (`#probeTriggerFromRecovery`) — this must land before Task 11 deletes `caret.recovery`.*

**Files:** `DragFeature.ts`, `DragFeature.spec.ts`, `OverlayFeature.ts`, `OverlayFeature.spec.ts`, `Store.ts`

- [ ] **Step 1: Replace `DragFeature.ts`**

```ts
import {computed, event, watch} from '../../shared/signals'
import type {RawRange} from '../../shared/editorContracts'
import type {DragAction} from '../../shared/types'
import {createRowContent} from '../editing'
import type {Token} from '../parsing'
import type {CaretFeature} from '../caret/CaretFeature'
import type {ParsingFeature} from '../parsing/ParseFeature'
import type {PropsFeature} from '../props/PropsFeature'
import type {ValueFeature} from '../value/ValueFeature'
import {addDragRow, deleteDragRow, duplicateDragRow, reorderDragRows} from './operations'
import {EMPTY_TEXT_TOKEN} from './tokens'

export class DragFeature {
  readonly action = event<DragAction>()
  #unsub?: () => void

  constructor(
    private readonly props: PropsFeature,
    private readonly value: ValueFeature,
    private readonly parsing: ParsingFeature,
    private readonly caret: CaretFeature,
  ) {
    const isDragEnabled = computed(() => this.props.layout() === 'block' && !!this.props.draggable())
    const toggle = (enabled: boolean) => {
      if (enabled && !this.#unsub) {
        this.#unsub = watch(this.action, action => {
          switch (action.type) {
            case 'reorder':   this.#reorder(action);    break
            case 'add':       this.#add(action);        break
            case 'delete':    this.#delete(action);     break
            case 'duplicate': this.#duplicate(action);  break
          }
        })
      }
      if (!enabled && this.#unsub) { this.#unsub(); this.#unsub = undefined }
    }
    watch(isDragEnabled, toggle)
    toggle(isDragEnabled())
  }

  #reorder(action: Extract<DragAction, {type: 'reorder'}>) {
    const value = this.value.current()
    const rows = this.parsing.tokens()
    const newValue = reorderDragRows(value, rows, action.source, action.target)
    if (newValue !== value) {
      const range = this.#rangeAfterDrag(action, rows, newValue)
      if (range) this.caret.range(range)
      this.value.replaceAll(newValue)
    }
  }

  #add(action: Extract<DragAction, {type: 'add'}>) {
    const value = this.value.current()
    const rawRows = this.parsing.tokens()
    const rows = rawRows.length > 0 ? rawRows : [EMPTY_TEXT_TOKEN]
    const newRowContent = createRowContent(this.props.options())
    const newValue = addDragRow(value, rows, action.afterIndex, newRowContent)
    const range = this.#rangeAfterDrag(action, rows, newValue)
    if (range) this.caret.range(range)
    this.value.replaceAll(newValue)
  }

  #delete(action: Extract<DragAction, {type: 'delete'}>) {
    const value = this.value.current()
    const rows = this.parsing.tokens()
    const newValue = deleteDragRow(value, rows, action.index)
    const range = this.#rangeAfterDrag(action, rows, newValue)
    if (range) this.caret.range(range)
    this.value.replaceAll(newValue)
  }

  #duplicate(action: Extract<DragAction, {type: 'duplicate'}>) {
    const value = this.value.current()
    const rows = this.parsing.tokens()
    const newValue = duplicateDragRow(value, rows, action.index)
    const range = this.#rangeAfterDrag(action, rows, newValue)
    if (range) this.caret.range(range)
    this.value.replaceAll(newValue)
  }

  // Faithful port of the original #recoverAfterDrag, returning RawRange instead of CaretRecovery.
  // For 'reorder': places caret at previousRows[source].position.start in the new value, clamped.
  // This approximates the moved row's new position (not perfectly accurate if many rows shift,
  // but matches original behavior).
  #rangeAfterDrag(action: DragAction, previousRows: readonly Token[], nextValue: string): RawRange | undefined {
    let rawPosition: number | undefined
    if (action.type === 'add') {
      const after = previousRows.at(action.afterIndex)
      rawPosition = after ? after.position.end : nextValue.length
    } else if (action.type === 'duplicate') {
      const row = previousRows.at(action.index)
      rawPosition = row ? row.position.end : undefined
    } else if (action.type === 'delete') {
      const next = previousRows.at(action.index + 1) ??
        (action.index > 0 ? previousRows.at(action.index - 1) : undefined)
      rawPosition = next ? Math.min(next.position.start, nextValue.length) : 0
    } else { // reorder
      const moved = previousRows.at(action.source)
      rawPosition = moved ? Math.min(moved.position.start, nextValue.length) : undefined
    }
    return rawPosition !== undefined ? {start: rawPosition, end: rawPosition} : undefined
  }
}
```

- [ ] **Step 2: Update `DragFeature.spec.ts`**

Find the test that asserts `replaceAll` was called with `{recover: {kind: 'caret', rawPosition: 6}}` (around line 51). Change:

```ts
// Before:
expect(replaceAll).toHaveBeenCalledWith('beta\n\n', {recover: {kind: 'caret', rawPosition: 6}})

// After:
expect(replaceAll).toHaveBeenCalledWith('beta\n\n')
// verify caret.range was set — consult the test's mock/store setup for the exact assertion
```

- [ ] **Step 3: Update `Store.ts`** — pass `this.caret` to `DragFeature`

```ts
readonly drag = new DragFeature(this.props, this.value, this.parsing, this.caret)
```

- [ ] **Step 4: Rewrite `OverlayFeature.#probeTriggerFromRecovery`**

This method currently reads `this.caret.recovery()`. Replace the entire method body so it reads a collapsed `caret.range()` instead. Full final body:

```ts
#probeTriggerFromRecovery(): OverlayMatch | undefined {
  const range = this.caret.range()
  if (!range || range.start !== range.end) return  // only probe on a collapsed caret

  const cursor = range.start
  const value = this.value.current()
  const left = value.slice(0, cursor)
  const right = value.slice(cursor)
  const rightWord = right.match(/^\w*/)?.[0] ?? ''

  for (const option of this.props.options()) {
    const trigger = option.overlay?.trigger
    if (!trigger) continue

    const match = left.match(new RegExp(`${escape(trigger)}(\\w*)$`))
    if (!match) continue

    const [sourceLeft, wordLeft] = match
    const source = sourceLeft + rightWord
    const start = cursor - sourceLeft.length
    return {
      value: wordLeft + rightWord,
      source,
      range: {start, end: start + source.length},
      span: value,
      node: window.getSelection()?.anchorNode ?? this.dom.container() ?? document.body,
      option,
    }
  }
}
```

- [ ] **Step 5: Migrate the `{recover}` site in `OverlayFeature.ts`** (around line 113)

```ts
// Before:
this.value.replaceRange(range, annotation, {
  recover: {kind: 'caret', rawPosition: range.start + annotation.length},
})

// After:
const pos = range.start + annotation.length
this.caret.range({start: pos, end: pos})
this.value.replaceRange(range, annotation)
```

- [ ] **Step 6: Switch `watch(this.value.change)` to `watch(this.value.current)` in `OverlayFeature.ts`** (around line 48)

```ts
// Before:
watch(this.value.change, () => {

// After:
watch(this.value.current, () => {
```

- [ ] **Step 7: Update `OverlayFeature.spec.ts`** — replace `store.value.change()` calls

`store.value.change()` directly fires the overlay's change probe. After Task 9 removes `value.change`, these tests will break. Replace each with a real mutation that changes `value.current`:

```ts
// Before:
store.value.change()

// After:
store.value.replaceAll(store.value.current() + ' ')  // triggers watch(current)
```

Review each test's intent — the replacement mutation must actually trigger the overlay probe path the test is exercising.

- [ ] **Step 8: Run**

```bash
pnpm test && pnpm run typecheck
```

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/features/drag/DragFeature.ts \
         packages/core/src/features/drag/DragFeature.spec.ts \
         packages/core/src/features/overlay/OverlayFeature.ts \
         packages/core/src/features/overlay/OverlayFeature.spec.ts \
         packages/core/src/store/Store.ts
git commit -m "refactor(drag,overlay): replace recover option with caret.range; rewrite probeTriggerFromRecovery"
```

---

## Task 9: Purify `ValueFeature`

*Why: all callers already use `caret.range`, so removing `{recover}` and `value.change` is now a clean typecheck-green operation. `lifecycle` is also dropped — it was only needed for the `onMounted` handler that drove `change` and `#pending`, both gone. `ParsingFeature` already subscribes to `value.current` during its own construction, keeping `current` reactive without any explicit watcher in `ValueFeature`.*

**Files:** `ValueFeature.ts`, `ValueFeature.spec.ts`, `ParseFeature.spec.ts`, `Store.ts`, `Store.spec.ts`

- [ ] **Step 1: Replace `ValueFeature.ts`**

```ts
import type {RawRange} from '../../shared/editorContracts'
import {computed} from '../../shared/signals/index.js'
import type {PropsFeature} from '../props/PropsFeature'

export class ValueFeature {
  readonly isControlledMode = computed(() => this.props.value() !== undefined)

  readonly current = computed<string>({
    initial: () => this.props.value() ?? this.props.defaultValue() ?? '',
    get: field => (this.isControlledMode() ? (this.props.value() ?? '') : field()),
    set: (next, field) => {
      if (next === undefined) return
      if (!this.isControlledMode()) field(next)
      this.props.onChange()?.(next)  // fires on every replaceRange/replaceAll call
    },
  })

  constructor(private readonly props: PropsFeature) {}

  replaceRange(range: RawRange, replacement: string): void {
    const cur = this.current()
    if (this.props.readOnly()) return
    if (range.start < 0 || range.end < range.start || range.end > cur.length) return
    const next = cur.slice(0, range.start) + replacement + cur.slice(range.end)
    if (next === cur) return
    this.current(next)
  }

  replaceAll(next: string): void {
    return this.replaceRange({start: 0, end: this.current().length}, next)
  }
}
```

- [ ] **Step 2: Update `Store.ts`**

```ts
readonly value = new ValueFeature(this.props)
```

(Remove `this.lifecycle` and `this.caret` from the constructor args.)

- [ ] **Step 3: Rewrite `ValueFeature.spec.ts`**

Remove every test that asserts on `store.value.change`, `store.caret.recovery`, or the echo-gating behavior (`#pending`). Keep all other tests. The `describe('replaceRange()')` block becomes:

```ts
describe('replaceRange()', () => {
  it('commits uncontrolled range replacement', () => {
    const store = new Store()
    store.props.set({defaultValue: 'hello world'})
    store.lifecycle.mounted()

    store.value.replaceRange({start: 6, end: 11}, 'markput')

    expect(store.value.current()).toBe('hello markput')
  })

  it('rejects invalid ranges without calling onChange', () => {
    const store = new Store()
    const onChange = vi.fn()
    store.props.set({defaultValue: 'hello', onChange})
    store.lifecycle.mounted()

    store.value.replaceRange({start: 4, end: 2}, 'x')

    expect(onChange).not.toHaveBeenCalled()
    expect(store.value.current()).toBe('hello')
  })

  it('calls onChange and keeps old current until controlled echo', () => {
    const store = new Store()
    const onChange = vi.fn()
    store.props.set({value: 'hello', onChange})
    store.lifecycle.mounted()

    store.value.replaceRange({start: 0, end: 5}, 'world')

    expect(onChange).toHaveBeenCalledWith('world')
    expect(store.value.current()).toBe('hello')  // old until echo

    store.props.set({value: 'world'})
    expect(store.value.current()).toBe('world')
  })
})
```

The test `"does not set recovery when controlled parent ignores the change"` is removed — see the "Drop controlled-mode echo gating" decision at the top.

- [ ] **Step 4: Fix `ParseFeature.spec.ts`** — replace `watch(store.value.change, ...)` with `watch(store.value.current, ...)`

```ts
// Before:
const stop = watch(store.value.change, () => {
  tokensAtChangeTime = store.parsing.tokens()
})

// After:
const stop = watch(store.value.current, () => {
  tokensAtChangeTime = store.parsing.tokens()
})
```

The ordering guarantee holds — `ParsingFeature` subscribed to `current` before `ValueFeature` registers any watcher.

- [ ] **Step 5: Fix `Store.spec.ts`** — remove the `value.change` type assertion

Delete: `expect(typeof store.value.change).toBe('function')`

- [ ] **Step 6: Run**

```bash
pnpm test && pnpm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/features/value/ValueFeature.ts \
         packages/core/src/features/value/ValueFeature.spec.ts \
         packages/core/src/features/parsing/ParseFeature.spec.ts \
         packages/core/src/store/Store.ts \
         packages/core/src/store/Store.spec.ts
git commit -m "refactor(value): drop lifecycle, caret deps; remove change event and recover option (spec §4.2)"
```

---

## Task 10: Intermediate check

- [ ] **Step 1: Verify no remaining `{recover}` call sites**

```bash
rg 'recover:\s*\{' packages/core/src --type ts | grep -v SPEC
```

Expected: zero matches.

- [ ] **Step 2: Verify no remaining `value\.change` references**

```bash
rg 'value\.change\b' packages/core/src --type ts
```

Expected: zero matches.

- [ ] **Step 3: Run all checks**

```bash
pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check
```

Run fixers if lint/format fail: `pnpm run lint && pnpm run format`.

---

## Task 11: Remove bridges

*Why: deletes the legacy `recovery` signal, `CaretRecovery` type, `#applyPendingRecovery`, and all imperative `caret.location` writes — these are now dead code.*

Before starting, verify the grep is clean:

```bash
rg 'caret\.recovery\b|CaretRecovery\b|\.recovery\(' packages/core/src --type ts | grep -v SPEC
```

Expected: `CaretFeature.ts`, `CaretFeature.spec.ts`, `DomFeature.ts`, `DomFeature.spec.ts` only. Fix anything else first.

**Files:** `CaretFeature.ts`, `CaretFeature.spec.ts`, `DomFeature.ts`, `DomFeature.spec.ts`, `focus.ts`, `selection.ts`, `editorContracts.ts`, `types.ts`, `index.ts`

- [ ] **Step 1: Final `CaretFeature.ts`**

```ts
import type {CaretLocation, RawRange} from '../../shared/editorContracts'
import {computed, signal} from '../../shared/signals'
import type {Computed} from '../../shared/signals'
import type {ParsingFeature} from '../parsing/ParseFeature'
import {deriveLocation} from './deriveLocation'

export class CaretFeature {
  readonly range = signal<RawRange | undefined>(undefined, {
    equals: (a, b) =>
      a === b ||
      (a !== undefined && b !== undefined && a.start === b.start && a.end === b.end),
  })

  readonly location: Computed<CaretLocation | undefined>
  readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

  // wire() exists because CaretFeature is declared before ParsingFeature in Store;
  // all field initializers complete before the Store constructor body runs.
  #parsing: ParsingFeature | undefined

  constructor() {
    this.location = computed(() => {
      const p = this.#parsing
      if (!p) return undefined
      return deriveLocation(this.range(), p.tokens(), p.index())
    })
  }

  wire(parsing: ParsingFeature): void {
    this.#parsing = parsing
  }
}
```

- [ ] **Step 2: Update `CaretFeature.spec.ts`** — remove the `recovery` assertion

The first test becomes:
```ts
it('exposes range, selecting, and location', () => {
  const store = new Store()
  expect(typeof store.caret.range).toBe('function')
  expect(typeof store.caret.selecting).toBe('function')
  expect(typeof store.caret.location).toBe('function')
})
```

- [ ] **Step 3: Update `DomFeature.ts`**

1. Delete `#applyPendingRecovery()` method entirely.
2. Delete `#clearStaleCaretLocation()` method entirely.
3. In `#commitRendered()`, replace the last two lines of the method body:
   ```ts
   // Before:
   this.#clearStaleCaretLocation()
   this.#applyPendingRecovery()
   this.#applyRangeToDOM()
   
   // After:
   this.#applyRangeToDOM()
   ```
4. Delete the three imperative `caret.location` writes:
   - Inside `focusAddress()` (around line 265): `this.caret.location({address, role})`
   - Inside the mark-descendant path (around line 746): `this.caret.location({address: record.address, role: 'markDescendant'})`
5. Remove the `CaretRecovery` import if it is present.

- [ ] **Step 4: Rewrite `DomFeature.spec.ts` recovery tests**

Replace the two tests asserting on `caret.recovery` (around lines 354–386):

```ts
it('clamps OOB caret range and places at maxPos', () => {
  const {store, container} = mountStructuralInline('hello') // length 5
  store.caret.range({start: 999, end: 999})
  store.lifecycle.rendered()
  expect(store.caret.range()).toEqual({start: 5, end: 5})
  container.remove()
})

it('clamps OOB selection range', () => {
  const {store, container} = mountStructuralInline('hello')
  store.caret.range({start: 999, end: 1000})
  store.lifecycle.rendered()
  expect(store.caret.range()).toEqual({start: 5, end: 5})
  container.remove()
})
```

- [ ] **Step 5: Remove imperative `location` writes from `focus.ts` and `selection.ts`**

Delete every `store.caret.location(...)` call. The `focusin` and `selectionchange` handlers only write `store.caret.range(...)`.

- [ ] **Step 6: Delete `CaretRecovery` from `editorContracts.ts`**

Remove:
```ts
export type CaretRecovery =
  | {readonly kind: 'caret'; readonly rawPosition: number; readonly affinity?: 'before' | 'after'}
  | {readonly kind: 'selection'; readonly selection: RawSelection}
```

- [ ] **Step 7: Update `shared/types.ts`**

Remove `CaretRecovery` from the import and remove `recovery: CaretRecovery | undefined` from `MarkputState`.

- [ ] **Step 8: Update `packages/core/index.ts`**

Remove `CaretRecovery` from the exports.

- [ ] **Step 9: Run**

```bash
pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check
```

- [ ] **Step 10: Commit**

```bash
git add -u
git commit -m "refactor(caret): remove recovery bridge, CaretRecovery type, legacy apply path (spec S1.6)"
```

---

## Task 12: Update docs

**Files:** `architecture.md`, `AGENTS.md`

- [ ] **Step 1: Update `architecture.md`**

Input Flow — replace steps 4–5:
```
-4. KeyboardFeature calls store.value.replaceRange() or replaceAll()
+4. KeyboardFeature writes store.caret.range({start, end}) with the desired post-edit position,
+   then calls store.value.replaceRange() or replaceAll()
```

Store Events table — remove the `change / value` row.

Caret description — replace:
```
-`store.caret`: caret state and recovery.
+`store.caret`: caret state. `range: Signal<RawRange | undefined>` is the single source of
+truth for caret and selection position. `DomFeature` applies `range` to the DOM after
+every render and writes it back from DOM events. `location: Computed<CaretLocation | undefined>`
+is a derived read-only view for token-anchored consumers.
```

- [ ] **Step 2: Update `AGENTS.md`**

Replace:
```
-`store.caret`: caret state and recovery.
+`store.caret`: caret state (`range: Signal<RawRange | undefined>`).
```

Replace:
```
-User value mutations must go through `store.value.replaceRange()` or `store.value.replaceAll()`
-with raw positions and optional caret recovery. Do not write `store.value.current()` directly
-for user edits.
+User value mutations must go through `store.value.replaceRange()` or `store.value.replaceAll()`
+with raw positions. Callers that want a specific post-edit caret write `store.caret.range({start,
+end})` in the same handler. Do not write `store.value.current()` directly for user edits.
```

- [ ] **Step 3: Build docs**

```bash
pnpm -F @markput/website run build
```

- [ ] **Step 4: Final check**

```bash
pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check
```

```bash
rg 'caret\.recovery\b|CaretRecovery\b|value\.change\b|recover:\s*\{' packages/core/src --type ts | grep -v SPEC
```

Expected: zero matches.

- [ ] **Step 5: Commit**

```bash
git add packages/website/src/content/docs/development/architecture.md AGENTS.md
git commit -m "docs: update architecture and AGENTS.md for caret/value decouple (spec S1.6)"
```

---

## Final verification

After Task 12 completes, all acceptance criteria from `SPEC-rethink.md §12` hold. Quick sanity check:

```bash
# No removed APIs remain
rg 'caret\.recovery|CaretRecovery|value\.change\b|recover:\s*\{' packages/core/src --type ts | grep -v SPEC

# No broken imports
pnpm run typecheck

# Full suite green
pnpm test
```

---

## Appendix A: File map

| File | Change | Task |
|------|--------|------|
| `features/caret/CaretFeature.ts` | Add `range`; `location` → Computed via `wire()`; remove `recovery` | 1, 3, 11 |
| `features/caret/CaretFeature.spec.ts` | Rewrite | 1, 3, 11 |
| `features/caret/deriveLocation.ts` | **New** | 2 |
| `features/caret/deriveLocation.spec.ts` | **New** | 2 |
| `features/caret/focus.ts` | Add `range` writes; remove `location` writes | 5, 11 |
| `features/caret/focus.spec.ts` | Rewrite location-write test | 3 |
| `features/caret/selection.ts` | Add `range` writes; remove `location` writes | 5, 11 |
| `features/dom/DomFeature.ts` | Add `value` dep; add `#applyRangeToDOM`; remove `#applyPendingRecovery`, `#clearStaleCaretLocation`, `location` writes | 4, 11 |
| `features/dom/DomFeature.spec.ts` | Add range tests; rewrite recovery tests | 4, 11 |
| `features/keyboard/input.ts` | Replace 4 `{recover}` sites | 6 |
| `features/keyboard/input.spec.ts` | Update mock assertion | 6 |
| `features/keyboard/blockEdit.ts` | Replace 7 `{recover}` sites | 7 |
| `features/mark/MarkController.ts` | Remove `{recover: undefined}` | 7 |
| `features/clipboard/ClipboardFeature.ts` | Add `caret` dep; replace `{recover}` | 7 |
| `features/drag/DragFeature.ts` | Add `caret` dep; `#rangeAfterDrag` returns `RawRange` | 8 |
| `features/drag/DragFeature.spec.ts` | Update mock assertion | 8 |
| `features/overlay/OverlayFeature.ts` | Rewrite `#probeTriggerFromRecovery`; migrate `{recover}`; `watch(current)` | 8 |
| `features/overlay/OverlayFeature.spec.ts` | Replace `store.value.change()` calls | 8 |
| `features/value/ValueFeature.ts` | Drop `lifecycle`+`caret` deps, `change` event, `{recover}` option | 9 |
| `features/value/ValueFeature.spec.ts` | Remove gating tests | 9 |
| `features/parsing/ParseFeature.spec.ts` | Replace `watch(value.change)` | 9 |
| `store/Store.ts` | Add constructor; update ctors for `Clipboard`, `Drag`, `Dom`, `Value` | 3, 4, 7, 8, 9 |
| `store/Store.spec.ts` | Remove `value.change` assertion | 9 |
| `shared/editorContracts.ts` | Delete `CaretRecovery` | 11 |
| `shared/types.ts` | Remove `recovery` from `MarkputState` | 11 |
| `packages/core/index.ts` | Remove `CaretRecovery` export | 11 |
| `docs/development/architecture.md` | Update caret section, input flow, events table | 12 |
| `AGENTS.md` | Update caret bullet, replaceRange description | 12 |
