# Explicit Feature Dependencies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Store service-locator pattern with explicit positional constructor dependencies in every feature, after first removing all cycles from the feature dependency graph.

**Architecture:** Three cycles are broken in order — value↔parsing (invert: Parsing subscribes to Value), caret↔dom (delete `CaretFeature.placeAt/focus`, move wiring to Store), parsing→caret (guard deleted as side-effect of cycle 1). Then every feature constructor is converted from `_store: Store` to positional parameter properties with concrete feature types, and Store is rewritten to construct features top-to-bottom in dependency order.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces. All commands run from the repo root unless noted. Core source lives in `packages/core/src/`.

---

## File Map

**Phase 0 — dep narrowing (no behavior change)**
- Modify: `features/props/PropsFeature.ts`, `features/mark/MarkFeature.ts`, `features/slots/SlotsFeature.ts`, `features/value/ValueFeature.ts`, `features/caret/CaretFeature.ts`, `features/dom/DomFeature.ts`, `features/parsing/ParseFeature.ts`
- Modify: `store/Store.ts`

**Phase 1 — invert value↔parsing (TDD order: specs first, impl second)**
- Modify: `features/parsing/ParseFeature.spec.ts` (rewrite)
- Modify: `features/value/ValueFeature.spec.ts` (add two specs)
- Modify: `features/parsing/ParseFeature.ts`
- Modify: `features/value/ValueFeature.ts`

**Phase 2 — remove caret.placeAt/focus + TriggerFinder**
- Modify: `features/caret/CaretFeature.ts`
- Modify: `features/caret/TriggerFinder.ts`
- Modify: `features/keyboard/arrowNav.ts`
- Modify: `features/keyboard/blockEdit.ts`
- Modify: `features/dom/DomFeature.ts`
- Modify: `features/overlay/OverlayFeature.ts`
- Modify: `features/navigation/README.md`
- Modify: `store/Store.ts`

**Phase 3 — parseWithParser + positional deps**
- Modify: `features/parsing/utils/valueParser.ts`
- Modify: `features/parsing/ParseFeature.ts`
- Modify: all 10 feature files
- Modify: `store/Store.ts`

**Phase 4 — docs + verification**
- Modify: `packages/website/src/content/docs/development/architecture.md`

---

## Phase 0 — Dep Narrowing

### Task 1 (Phase 0): Drop unused Store parameter from `PropsFeature`

**Files:**
- Modify: `packages/core/src/features/props/PropsFeature.ts`
- Modify: `packages/core/src/store/Store.ts`

`PropsFeature` accepts `_store: Store` but never reads it.

- [ ] **Step 1: Remove the parameter from `PropsFeature`**

In `packages/core/src/features/props/PropsFeature.ts`, delete the import and constructor body:

```ts
// delete this line:
import type {Store} from '../../store/Store'

// change from:
constructor(private readonly _store: Store) {}
// to:
constructor() {}
```

- [ ] **Step 2: Update Store**

In `packages/core/src/store/Store.ts`:

```ts
// before:
readonly props = new PropsFeature(this)
// after:
readonly props = new PropsFeature()
```

- [ ] **Step 3: Verify**

```
pnpm -w exec vitest run packages/core/src
pnpm run typecheck
```

Expected: all pass.

- [ ] **Step 4: Commit**

```
git add packages/core/src/features/props/PropsFeature.ts packages/core/src/store/Store.ts
git commit -m "refactor(core): remove unused Store parameter from PropsFeature"
```

---

### Task 2 (Phase 0): Narrow `MarkFeature` and `SlotsFeature` to `Pick<Store, 'props'>`

**Files:**
- Modify: `packages/core/src/features/mark/MarkFeature.ts`
- Modify: `packages/core/src/features/slots/SlotsFeature.ts`

- [ ] **Step 1: Narrow `MarkFeature`**

In `packages/core/src/features/mark/MarkFeature.ts`, change:

```ts
// before:
import type {Store} from '../../store/Store'
// ...
constructor(private readonly _store: Store) {}

// after:
import type {Store} from '../../store/Store'
// ...
constructor(private readonly _store: Pick<Store, 'props'>) {}
```

- [ ] **Step 2: Narrow `SlotsFeature`**

In `packages/core/src/features/slots/SlotsFeature.ts`, change:

```ts
// before:
constructor(private readonly _store: Store) {}
// after:
constructor(private readonly _store: Pick<Store, 'props'>) {}
```

- [ ] **Step 3: Verify**

```
pnpm -w exec vitest run packages/core/src
pnpm run typecheck
```

Expected: all pass.

- [ ] **Step 4: Commit**

```
git add packages/core/src/features/mark/MarkFeature.ts packages/core/src/features/slots/SlotsFeature.ts
git commit -m "refactor(core): narrow Store dep to Pick<Store, 'props'> in MarkFeature and SlotsFeature"
```

---

### Task 3 (Phase 0): Narrow `ValueFeature`, `CaretFeature`, `DomFeature`, `ParsingFeature`

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.ts`
- Modify: `packages/core/src/features/caret/CaretFeature.ts`
- Modify: `packages/core/src/features/dom/DomFeature.ts`
- Modify: `packages/core/src/features/parsing/ParseFeature.ts`

Narrow `_store: Store` to `Pick<Store, ...>` listing only actually-used store members. This is a pure type change — no logic moves. Use `Pick<Store, '...'>` to pick from the Store type itself (not from a redeclared object literal, which would be redundant).

- [ ] **Step 1: Narrow `ValueFeature`**

In `packages/core/src/features/value/ValueFeature.ts`:

```ts
// change constructor signature from:
constructor(private readonly _store: Store) {
// to:
constructor(private readonly _store: Pick<Store, 'lifecycle' | 'props' | 'parsing' | 'caret'>) {
```

- [ ] **Step 2: Narrow `CaretFeature`**

In `packages/core/src/features/caret/CaretFeature.ts`:

```ts
// change constructor signature from:
constructor(private readonly _store: Store) {
// to:
constructor(private readonly _store: Pick<Store, 'lifecycle' | 'dom'>) {
```

- [ ] **Step 3: Narrow `DomFeature`**

In `packages/core/src/features/dom/DomFeature.ts`:

```ts
// change constructor signature from:
constructor(private readonly _store: Store) {
// to:
constructor(private readonly _store: Pick<Store, 'lifecycle' | 'props' | 'caret' | 'parsing'>) {
```

- [ ] **Step 4: Narrow `ParsingFeature`**

In `packages/core/src/features/parsing/ParseFeature.ts`:

```ts
// change constructor signature from:
constructor(private readonly _store: Store) {
// to:
constructor(private readonly _store: Pick<Store, 'lifecycle' | 'mark' | 'props' | 'slots' | 'value' | 'caret'>) {
```

- [ ] **Step 5: Verify**

```
pnpm -w exec vitest run packages/core/src
pnpm run typecheck
```

Expected: all pass. Any type error means a feature is accessing a store member outside its declared list — fix the `Pick` to match reality.

- [ ] **Step 6: Commit**

```
git add packages/core/src/features/value/ValueFeature.ts packages/core/src/features/caret/CaretFeature.ts packages/core/src/features/dom/DomFeature.ts packages/core/src/features/parsing/ParseFeature.ts
git commit -m "refactor(core): narrow Store parameter types to Pick<Store, ...> in each feature"
```

---

## Phase 1 — Invert value↔parsing

Phase 1 follows TDD order: **write the specs against the new contract first (they will fail), then implement the inversion (they turn green), then commit.** Never commit a failing test.

### Task 4 (Phase 1): Migrate `ParseFeature.spec.ts` to post-inversion contract

**Files:**
- Modify: `packages/core/src/features/parsing/ParseFeature.spec.ts`
- Modify: `packages/core/src/features/value/ValueFeature.spec.ts`

Rewrite the spec so it drives parsing through `store.value.replaceAll / store.lifecycle.mounted()` instead of `store.parsing.sync()`. Add the two guard specs required by the inversion.

After this task those new tests **must fail** (they call APIs that current code doesn't provide). Do not implement anything yet.

- [ ] **Step 1: Rewrite `ParseFeature.spec.ts`**

Replace the entire content of `packages/core/src/features/parsing/ParseFeature.spec.ts`:

```ts
import {describe, it, expect, beforeEach} from 'vitest'
import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'
import type {Token} from './parser/types'

describe('ParsingFeature', () => {
  let store: Store

  beforeEach(() => {
    store = new Store()
  })

  function mountWith(value: string, withMark = true) {
    store.props.set({Mark: () => null, defaultValue: value})
    if (!withMark) store.props.set({Mark: undefined})
    store.lifecycle.mounted()
  }

  describe('auto-parse on value change', () => {
    it('sets tokens from initial value on mount', () => {
      mountWith('hello')
      expect(store.parsing.tokens()).toEqual([
        {type: 'text', content: 'hello', position: {start: 0, end: 5}},
      ])
      store.props.set({Mark: undefined})
    })

    it('updates tokens when value changes via replaceAll', () => {
      mountWith('hello')
      store.value.replaceAll('world')
      expect(store.parsing.tokens()).toEqual([
        {type: 'text', content: 'world', position: {start: 0, end: 5}},
      ])
      store.props.set({Mark: undefined})
    })

    it('falls back to empty string when defaultValue is empty', () => {
      mountWith('')
      expect(store.parsing.tokens()).toEqual([
        {type: 'text', content: '', position: {start: 0, end: 0}},
      ])
      store.props.set({Mark: undefined})
    })

    it('parsing does not write value state', () => {
      mountWith('test')
      expect(store.value.current()).toBe('test')
      store.props.set({Mark: undefined})
    })

    it('parser is undefined when no Mark and no per-option Mark', () => {
      store.props.set({options: [{markup: '@[__value__]'}]})
      store.lifecycle.mounted()
      expect(store.parsing.parser()).toBeUndefined()
    })

    it('parser is defined when Mark override is set', () => {
      store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
      store.lifecycle.mounted()
      expect(store.parsing.parser()).toBeDefined()
    })
  })

  describe('enable / disable', () => {
    it('is idempotent — setting Mark twice does not double-subscribe', () => {
      mountWith('hello')
      store.props.set({Mark: () => null})

      let callCount = 0
      const original = store.parsing.tokens
      const tokensWrapper = (...args: unknown[]) => {
        if (args.length) callCount++
        return (original as (...args: unknown[]) => unknown)(...args)
      }
      // oxlint-disable-next-line no-unsafe-type-assertion -- test spy
      ;(store.parsing as unknown as Record<string, unknown>).tokens = tokensWrapper

      store.parsing.reparse()
      expect(callCount).toBe(1)

      // oxlint-disable-next-line no-unsafe-type-assertion -- test spy restore
      ;(store.parsing as unknown as Record<string, unknown>).tokens = original
      store.props.set({Mark: undefined})
    })

    it('stops parse subscription after removing Mark', () => {
      mountWith('hello')
      const tokensBefore = store.parsing.tokens()
      store.props.set({Mark: undefined})
      store.parsing.reparse()
      expect(store.parsing.tokens()).toBe(tokensBefore)
    })

    it('re-enables and parses fresh after Mark removed and re-added', () => {
      mountWith('first')
      store.props.set({Mark: undefined})
      store.value.replaceAll('second')
      store.props.set({Mark: () => null})
      expect(store.parsing.tokens()).toEqual([
        {type: 'text', content: 'second', position: {start: 0, end: 6}},
      ])
      store.props.set({Mark: undefined})
    })
  })

  describe('reactive parse', () => {
    it('re-parses when parser changes', () => {
      mountWith('hello @[world]')
      store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
      expect(store.parsing.tokens()).toEqual([
        expect.objectContaining({type: 'text', content: 'hello '}),
        expect.objectContaining({type: 'mark', content: '@[world]', value: 'world'}),
        expect.objectContaining({type: 'text', content: ''}),
      ])
      store.props.set({Mark: undefined})
    })
  })

  describe('reparse event', () => {
    it('re-parses from current value on reparse', () => {
      mountWith('test')
      store.parsing.reparse()
      expect(store.parsing.tokens()).toEqual([
        {type: 'text', content: 'test', position: {start: 0, end: 4}},
      ])
      store.props.set({Mark: undefined})
    })
  })

  describe('signal ordering guarantee', () => {
    it('parsing.tokens is updated when value.change fires', () => {
      // Guarantee: ParsingFeature subscribes to value.current at construction
      // time (before lifecycle.mounted). ValueFeature emits change() inside
      // onMounted. So the parsing subscription fires before change().
      // This test pins that contract.
      store.props.set({Mark: () => null, defaultValue: ''})
      store.lifecycle.mounted()

      let tokensAtChangeTime: Token[] | undefined
      const stop = watch(store.value.change, () => {
        tokensAtChangeTime = store.parsing.tokens()
      })

      store.value.replaceAll('hello')

      expect(tokensAtChangeTime).toEqual([
        {type: 'text', content: 'hello', position: {start: 0, end: 5}},
      ])

      stop()
      store.props.set({Mark: undefined})
    })
  })
})
```

- [ ] **Step 2: Add two guard specs to `ValueFeature.spec.ts`**

Append inside the `describe('replaceRange()', ...)` block in `packages/core/src/features/value/ValueFeature.spec.ts`, after the existing last test (line 178, before the closing `}`):

```ts
it('does not set recovery when controlled parent ignores the change', () => {
  const store = new Store()
  const recovery = {kind: 'caret' as const, rawPosition: 3}
  // onChange deliberately does not echo the value back
  store.props.set({value: 'hello', onChange: () => {}})
  store.lifecycle.mounted()

  store.value.replaceRange({start: 0, end: 5}, 'world', {recover: recovery})

  expect(store.caret.recovery()).toBeUndefined()
  expect(store.value.current()).toBe('hello')
})
```

- [ ] **Step 3: Run specs to confirm they FAIL**

```
pnpm -w exec vitest run packages/core/src/features/parsing/ParseFeature.spec.ts
```

Expected: failures in tests that call APIs removed in Task 5 (e.g., `sync` no longer exists). **Failures here are correct.** If all tests pass, the spec is not testing the right contract.

Note: The `DragFeature.spec.ts` test that uses `acceptTokens` is **not changed** — `acceptTokens` stays public (see spec D1).

- [ ] **Step 4: Commit the red specs**

```
git add packages/core/src/features/parsing/ParseFeature.spec.ts packages/core/src/features/value/ValueFeature.spec.ts
git commit -m "test(core): rewrite ParseFeature specs against post-inversion contract (red)"
```

---

### Task 5 (Phase 1): Implement the value↔parsing inversion

**Files:**
- Modify: `packages/core/src/features/parsing/ParseFeature.ts`
- Modify: `packages/core/src/features/value/ValueFeature.ts`

This task turns the red specs from Task 4 green. Implement the inversion: Parsing subscribes to Value; Value stops calling parsing methods.

- [ ] **Step 1: Rewrite `ParsingFeature` constructor and private methods**

In `packages/core/src/features/parsing/ParseFeature.ts`, replace the constructor and the three private methods `#subscribeParse`, `#subscribeReactiveParse`, and the `parseWithParser` call with:

```ts
constructor(private readonly _store: Pick<Store, 'lifecycle' | 'mark' | 'props' | 'slots' | 'value'>) {
  // Note: 'caret' is removed from Pick — no longer needed.
  const toggle = (enabled: boolean) => {
    if (enabled && !this.#scope) {
      // Parse current value immediately so tokens are ready before mounted
      // subscribers (like OverlayFeature) read them.
      this.acceptTokens(this.#parseValue(_store.value.current()))
      this.#scope = effectScope(() => {
        this.#subscribeValue()
        this.#subscribeReactiveParse()
        this.#subscribeReparse()
      })
    }
    if (!enabled && this.#scope) {
      this.#scope()
      this.#scope = undefined
    }
  }

  watch(_store.mark.enabled, toggle)
  toggle(_store.mark.enabled())
}

#parseValue(value: string): Token[] {
  const parser = this.parser()
  if (!parser) {
    return [{type: 'text' as const, content: value, position: {start: 0, end: value.length}}]
  }
  return parser.parse(value)
}

#subscribeValue(): void {
  watch(
    computed(() => this._store.value.current()),
    v => {
      this.acceptTokens(this.#parseValue(v))
    }
  )
}

#subscribeReactiveParse(): void {
  watch(
    computed(() => this.parser()),
    () => {
      this.acceptTokens(this.#parseValue(this._store.value.current()))
    }
  )
}

#subscribeReparse(): void {
  watch(this.reparse, () => {
    this.acceptTokens(this.#parseValue(this._store.value.current()))
  })
}
```

Remove the `import {parseWithParser} from './utils/valueParser'` line — it is no longer used inside `ParseFeature`.

Remove `caret` from the `Pick<Store, ...>` (updated in Step 1 above). The `parseValue` public method is also now deleted (replaced by private `#parseValue`). The `sync` public method is also deleted. `acceptTokens` **stays public** — it is used by tests in `DragFeature.spec.ts` and its removal would break test ergonomics with no way to inject specific token states.

- [ ] **Step 2: Simplify `ValueFeature.#accept`**

In `packages/core/src/features/value/ValueFeature.ts`, replace the `#accept` method:

```ts
// before:
#accept(value: string): void {
  const pending = this.#pending
  this.#pending = undefined
  const tokens = this._store.parsing.parseValue(value)
  batch(() => this._store.parsing.acceptTokens(tokens))
  if (pending?.value === value) {
    this._store.caret.recovery(pending.recovery)
  }
}

// after:
#accept(value: string): void {
  const pending = this.#pending
  this.#pending = undefined
  if (pending?.value === value) {
    this._store.caret.recovery(pending.recovery)
  }
}
```

Remove `parsing` from the `Pick<Store, ...>` in the constructor signature (it is no longer used):

```ts
// before:
constructor(private readonly _store: Pick<Store, 'lifecycle' | 'props' | 'parsing' | 'caret'>) {
// after:
constructor(private readonly _store: Pick<Store, 'lifecycle' | 'props' | 'caret'>) {
```

- [ ] **Step 3: Run specs to confirm they pass**

```
pnpm -w exec vitest run packages/core/src/features/parsing/ParseFeature.spec.ts
pnpm -w exec vitest run packages/core/src/features/value/ValueFeature.spec.ts
pnpm -w exec vitest run packages/core/src
```

Expected: all pass.

- [ ] **Step 4: Run the full suite**

```
pnpm test
pnpm run typecheck
```

Expected: all pass.

- [ ] **Step 5: Commit**

```
git add packages/core/src/features/parsing/ParseFeature.ts packages/core/src/features/value/ValueFeature.ts
git commit -m "refactor(core): make Parsing subscribe to Value — remove value↔parsing cycle"
```

---

## Phase 2 — Remove caret↔dom cycle

### Task 6 (Phase 2): Delete `placeAt/focus`, move wiring to Store, fix TriggerFinder

Tasks 7 and 8 from the original plan are merged here. Splitting them would leave `CaretFeature` calling `enableFocus/enableSelection` with a `Pick<Store, 'lifecycle' | 'dom'>` type that won't satisfy the `Store` parameter those helpers expect — a type error in an intermediate commit.

**Files:**
- Modify: `packages/core/src/features/caret/CaretFeature.ts`
- Modify: `packages/core/src/features/caret/TriggerFinder.ts`
- Modify: `packages/core/src/features/keyboard/arrowNav.ts`
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`
- Modify: `packages/core/src/features/dom/DomFeature.ts`
- Modify: `packages/core/src/features/overlay/OverlayFeature.ts`
- Modify: `packages/core/src/features/navigation/README.md`
- Modify: `packages/core/src/store/Store.ts`

- [ ] **Step 1: Update `arrowNav.ts` — replace `caret.focus/placeAt` with `dom.*`**

In `packages/core/src/features/keyboard/arrowNav.ts`, replace lines 48–58:

```ts
// before:
const result = store.caret.focus(siblingAddress, direction === 'prev' ? 'end' : 'start')
if (!result.ok) return false
const sibling = store.parsing.index().resolve(siblingPath)
if (sibling?.type === 'mark') return true
if (direction === 'prev') {
  store.caret.placeAt(sibling?.position.end ?? 0, 'before')
  return true
}
store.caret.placeAt(sibling?.position.start ?? 0, 'after')
return true

// after:
const result = store.dom.focusAddress(siblingAddress, direction === 'prev' ? 'end' : 'start')
if (!result.ok) return false
const sibling = store.parsing.index().resolve(siblingPath)
if (sibling?.type === 'mark') return true
if (direction === 'prev') {
  store.dom.placeCaretAtRawPosition(sibling?.position.end ?? 0, 'before')
  return true
}
store.dom.placeCaretAtRawPosition(sibling?.position.start ?? 0, 'after')
return true
```

- [ ] **Step 2: Update `blockEdit.ts` — replace `caret.focus` with `dom.focusAddress`**

In `packages/core/src/features/keyboard/blockEdit.ts`, in the `focusRow` function (around line 202):

```ts
// before:
if (address && store.caret.focus(address).ok) return
// after:
if (address && store.dom.focusAddress(address).ok) return
```

- [ ] **Step 3: Fix `DomFeature.#applyPendingRecovery` self-call**

In `packages/core/src/features/dom/DomFeature.ts`, inside `#applyPendingRecovery` (around line 771):

```ts
// before:
const result = this._store.caret.placeAt(recovery.rawPosition, recovery.affinity)
// after:
const result = this.placeCaretAtRawPosition(recovery.rawPosition, recovery.affinity)
```

- [ ] **Step 4: Fix `TriggerFinder` — replace `Store` dep with `DomFeature`**

`TriggerFinder` accepts `store?: Store` but only uses `store.dom.rawPositionFromBoundary`. Change the parameter to `dom?: DomFeature`:

In `packages/core/src/features/caret/TriggerFinder.ts`, at the top and in constructor + `#rawRangeForMatch`:

```ts
// replace:
import type {Store} from '../../store/Store'
// with:
import type {DomFeature} from '../dom/DomFeature'

// replace constructor:
constructor(private readonly store?: Store) {
// with:
constructor(private readonly dom?: DomFeature) {

// replace static find signature:
static find<T>(
  options: T[] | undefined,
  getTrigger: TriggerExtractor<T>,
  store?: Store
): OverlayMatch<T> | undefined {
  if (!options) return
  if (!Caret.isSelectedPosition) return
  try {
    return new TriggerFinder(store).find(options, getTrigger)
  } catch {
    return undefined
  }
}
// with:
static find<T>(
  options: T[] | undefined,
  getTrigger: TriggerExtractor<T>,
  dom?: DomFeature
): OverlayMatch<T> | undefined {
  if (!options) return
  if (!Caret.isSelectedPosition) return
  try {
    return new TriggerFinder(dom).find(options, getTrigger)
  } catch {
    return undefined
  }
}

// replace #rawRangeForMatch:
#rawRangeForMatch(source: string, index: number) {
  if (!this.dom) return {start: index, end: index + source.length}
  const boundary = this.dom.rawPositionFromBoundary(this.node, index + source.length, 'after')
  if (!boundary.ok) return undefined
  return {
    start: boundary.value - source.length,
    end: boundary.value,
  }
}
```

- [ ] **Step 5: Update `OverlayFeature` to pass `dom` instead of `store`**

In `packages/core/src/features/overlay/OverlayFeature.ts`, in `#probeTrigger`:

```ts
// before:
TriggerFinder.find(this._store.props.options(), option => option.overlay?.trigger, this._store)
// after:
TriggerFinder.find(this._store.props.options(), option => option.overlay?.trigger, this._store.dom)
```

- [ ] **Step 6: Make `CaretFeature` pure state — delete `placeAt/focus` and constructor**

Replace `packages/core/src/features/caret/CaretFeature.ts` entirely:

```ts
import type {CaretLocation, CaretRecovery} from '../../shared/editorContracts'
import {signal} from '../../shared/signals'

export class CaretFeature {
  readonly recovery = signal<CaretRecovery | undefined>(undefined)
  readonly location = signal<CaretLocation | undefined>(undefined)
  readonly selecting = signal<'drag' | 'all' | undefined>(undefined)
}
```

No imports from Store. No constructor. No `placeAt`. No `focus`.

- [ ] **Step 7: Move `enableFocus/enableSelection` wiring to `Store`**

In `packages/core/src/store/Store.ts`, add a constructor and imports:

```ts
import {enableFocus} from '../features/caret/focus'
import {enableSelection} from '../features/caret/selection'

// ... (existing fields) ...

constructor() {
  this.lifecycle.onMounted(() => {
    enableFocus(this)
    enableSelection(this)
  })
}
```

- [ ] **Step 8: Update navigation README**

In `packages/core/src/features/navigation/README.md`, replace lines 10–11:

```md
// before:
- Use `store.caret.focus(address, boundary)` for mark focus.
- Use `store.caret.placeAt(rawPosition)` for raw-position text recovery.

// after:
- Use `store.dom.focusAddress(address, boundary)` for mark focus.
- Use `store.dom.placeCaretAtRawPosition(rawPosition, affinity)` for raw-position text recovery.
```

- [ ] **Step 9: Verify**

```
pnpm test
pnpm run typecheck
```

Expected: all pass.

- [ ] **Step 10: Commit**

```
git add packages/core/src/features/caret/CaretFeature.ts packages/core/src/features/caret/TriggerFinder.ts packages/core/src/features/keyboard/arrowNav.ts packages/core/src/features/keyboard/blockEdit.ts packages/core/src/features/dom/DomFeature.ts packages/core/src/features/overlay/OverlayFeature.ts packages/core/src/features/navigation/README.md packages/core/src/store/Store.ts
git commit -m "refactor(core): remove CaretFeature.placeAt/focus, narrow TriggerFinder off Store"
```

---

## Phase 3 — Explicit Positional Deps

### Task 7 (Phase 3): Refactor `parseWithParser` utilities off Store

**Files:**
- Modify: `packages/core/src/features/parsing/utils/valueParser.ts`

`computeTokensFromValue`, `parseUnionLabels`, and `getRangeMap` are public exports from `@markput/core` (verified in `packages/core/README.md`). Their signatures currently take `store: Store`. Change them to take explicit parser/tokens instead.

- [ ] **Step 1: Find all in-repo callers**

```
grep -rn "computeTokensFromValue\|parseUnionLabels\|getRangeMap\|parseWithParser" packages/
```

Record every call site found. Confirmed in-repo: only `ParseFeature.ts` (already removed by Task 5) and `valueParser.ts` itself. Check adapter packages for any external calls.

- [ ] **Step 2: Rewrite `valueParser.ts`**

Replace the entire file content:

```ts
import type {Parser} from '../parser/Parser'
import type {Token} from '../parser/types'

export function parseWithParser(parser: Parser | undefined, value: string): Token[] {
  if (!parser) {
    return [{type: 'text' as const, content: value, position: {start: 0, end: value.length}}]
  }
  return parser.parse(value)
}

export function computeTokensFromValue(parser: Parser | undefined, value: string): Token[] {
  return parseWithParser(parser, value)
}

export function parseUnionLabels(
  parser: Parser | undefined,
  tokens: readonly Token[],
  ...indexes: number[]
): Token[] {
  let span = ''
  for (const index of indexes) {
    span += tokens[index]?.content ?? ''
  }
  return parseWithParser(parser, span)
}

export function getRangeMap(tokens: readonly Token[]): number[] {
  let position = 0
  return tokens.map(token => {
    const length = token.content.length
    position += length
    return position - length
  })
}
```

- [ ] **Step 3: Update every caller found in Step 1**

For each call site, pass `store.parsing.parser()` as first arg where `parser` is needed, and `store.parsing.tokens()` where `tokens` is needed. If a caller was in the adapter packages (`packages/react/` or `packages/vue/`), update it there too.

- [ ] **Step 4: Verify**

```
pnpm test
pnpm run typecheck
pnpm run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```
git add packages/core/src/features/parsing/utils/valueParser.ts
git commit -m "refactor(core): remove Store dependency from parseWithParser utilities"
```

---

### Task 8 (Phase 3): Convert all features to positional parameter properties

**Files:**
- Modify: `packages/core/src/store/Store.ts`
- Modify: all 10 feature files

Replace `_store: Pick<Store, ...>` constructors with positional `private readonly` parameter properties typed as concrete feature classes. Replace every `this._store.X` with `this.X` in each file. Rewrite `Store` to construct features with explicit instances in topological order.

This is one commit because splitting it mid-way would leave Store in a broken state.

- [ ] **Step 1: Convert `PropsFeature`**

Already done (no constructor, no params).

- [ ] **Step 2: Convert `MarkFeature`**

```ts
// packages/core/src/features/mark/MarkFeature.ts
import type {PropsFeature} from '../props/PropsFeature'
// remove Store import

export class MarkFeature {
  readonly enabled: Computed<boolean> = computed(() => {
    const Mark = this.props.Mark()
    if (Mark) return true
    return this.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
  })

  readonly slot: MarkSlot = computed(() => {
    const options = this.props.options()
    const Mark = this.props.Mark()
    const Span = this.props.Span()
    return (token: Token) => resolveMarkSlot(token, options, Mark, Span)
  })

  constructor(private readonly props: PropsFeature) {}
}
```

- [ ] **Step 3: Convert `SlotsFeature`**

```ts
// packages/core/src/features/slots/SlotsFeature.ts
import type {PropsFeature} from '../props/PropsFeature'
// remove Store import

export class SlotsFeature {
  readonly isBlock: Computed<boolean> = computed(() => this.props.layout() === 'block')
  readonly isDraggable: Computed<boolean> = computed(() => !!this.props.draggable())
  readonly containerComponent: Computed<Slot> = computed(() => resolveSlot('container', this.props.slots()))
  readonly containerProps: Computed<{className: string | undefined; style?: CSSProperties; [key: string]: unknown}> =
    computed(
      () =>
        buildContainerProps(
          this.isDraggable() && this.isBlock(),
          this.props.readOnly(),
          this.props.className(),
          this.props.style(),
          this.props.slotProps()
        ),
      {equals: shallow}
    )
  readonly blockComponent: Computed<Slot> = computed(() => resolveSlot('block', this.props.slots()))
  readonly blockProps: Computed<Record<string, unknown> | undefined> = computed(() =>
    resolveSlotProps('block', this.props.slotProps())
  )
  readonly spanComponent: Computed<Slot> = computed(() => resolveSlot('span', this.props.slots()))
  readonly spanProps: Computed<Record<string, unknown> | undefined> = computed(() =>
    resolveSlotProps('span', this.props.slotProps())
  )

  constructor(private readonly props: PropsFeature) {}
}
```

- [ ] **Step 4: Convert `ValueFeature`**

```ts
import type {CaretFeature} from '../caret/CaretFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {PropsFeature} from '../props/PropsFeature'
// remove Store import

export class ValueFeature {
  readonly isControlledMode = computed(() => this.props.value() !== undefined)
  readonly change = event()

  readonly current = computed<string>({
    initial: () => this.props.value() ?? this.props.defaultValue() ?? '',
    get: field => (this.isControlledMode() ? (this.props.value() ?? '') : field()),
    set: (next, field) => {
      if (next === undefined) return
      if (!this.isControlledMode()) field(next)
      this.props.onChange()?.(next)
    },
  })

  #pending: {value: string; recovery: CaretRecovery | undefined} | undefined

  constructor(
    private readonly lifecycle: LifecycleFeature,
    private readonly props: PropsFeature,
    private readonly caret: CaretFeature,
  ) {
    lifecycle.onMounted(() => {
      this.#accept(this.current())
      watch(this.current, v => {
        this.#accept(v)
        this.change()
      })
    })
  }

  replaceRange(range: RawRange, replacement: string, options?: {recover?: CaretRecovery}): void {
    const cur = this.current()
    if (this.props.readOnly()) return
    if (range.start < 0 || range.end < range.start || range.end > cur.length) return
    const next = cur.slice(0, range.start) + replacement + cur.slice(range.end)
    if (next === cur) return
    this.#pending = {value: next, recovery: options?.recover}
    this.current(next)
  }

  replaceAll(next: string, options?: {recover?: CaretRecovery}): void {
    return this.replaceRange({start: 0, end: this.current().length}, next, options)
  }

  #accept(value: string): void {
    const pending = this.#pending
    this.#pending = undefined
    if (pending?.value === value) {
      this.caret.recovery(pending.recovery)
    }
  }
}
```

- [ ] **Step 5: Convert `ParsingFeature`**

```ts
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {MarkFeature} from '../mark/MarkFeature'
import type {PropsFeature} from '../props/PropsFeature'
import type {SlotsFeature} from '../slots/SlotsFeature'
import type {ValueFeature} from '../value/ValueFeature'
// remove Store import

export class ParsingFeature {
  readonly tokens = signal<Token[]>([])
  readonly #generation = signal(0)
  readonly index: Computed<TokenIndex> = computed(() => createTokenIndex(this.tokens(), this.#generation()))

  readonly parser: Computed<Parser | undefined> = computed(() => {
    if (!this.mark.enabled()) return
    const markups = this.props.options().map(opt => opt.markup)
    if (!markups.some(Boolean)) return
    return new Parser(markups, this.slots.isBlock() ? {skipEmptyText: true} : undefined)
  })

  readonly reparse = event()
  #scope?: () => void

  constructor(
    private readonly lifecycle: LifecycleFeature,
    private readonly value: ValueFeature,
    private readonly mark: MarkFeature,
    private readonly props: PropsFeature,
    private readonly slots: SlotsFeature,
  ) {
    const toggle = (enabled: boolean) => {
      if (enabled && !this.#scope) {
        this.acceptTokens(this.#parseValue(value.current()))
        this.#scope = effectScope(() => {
          this.#subscribeValue()
          this.#subscribeReactiveParse()
          this.#subscribeReparse()
        })
      }
      if (!enabled && this.#scope) {
        this.#scope()
        this.#scope = undefined
      }
    }
    watch(mark.enabled, toggle)
    toggle(mark.enabled())
  }

  acceptTokens(tokens: Token[]): void {
    batch(() => {
      this.tokens(tokens)
      this.#generation(this.#generation() + 1)
    }, {mutable: true})
  }

  #parseValue(value: string): Token[] {
    const parser = this.parser()
    if (!parser) {
      return [{type: 'text' as const, content: value, position: {start: 0, end: value.length}}]
    }
    return parser.parse(value)
  }

  #subscribeValue(): void {
    watch(
      computed(() => this.value.current()),
      v => { this.acceptTokens(this.#parseValue(v)) }
    )
  }

  #subscribeReactiveParse(): void {
    watch(
      computed(() => this.parser()),
      () => { this.acceptTokens(this.#parseValue(this.value.current())) }
    )
  }

  #subscribeReparse(): void {
    watch(this.reparse, () => {
      this.acceptTokens(this.#parseValue(this.value.current()))
    })
  }
}
```

- [ ] **Step 6: Convert `DomFeature`**

Change the constructor signature and replace every `this._store.X` → `this.X` throughout the file (~25 occurrences):

```ts
import type {CaretFeature} from '../caret/CaretFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {ParsingFeature} from '../parsing/ParseFeature'
import type {PropsFeature} from '../props/PropsFeature'
// remove Store import

// constructor:
constructor(
  private readonly lifecycle: LifecycleFeature,
  private readonly props: PropsFeature,
  private readonly caret: CaretFeature,
  private readonly parsing: ParsingFeature,
) {
  lifecycle.onMounted(() => {
    watch(lifecycle.rendered, () => { this.#handleRendered() })
    watch(
      computed(() => ({readOnly: props.readOnly(), selecting: caret.selecting()})),
      () => this.reconcile()
    )
  })
}
```

Then do a global replace of `this._store.` → `this.` in this file and verify no `_store` references remain.

- [ ] **Step 7: Convert `OverlayFeature`**

```ts
import type {CaretFeature} from '../caret/CaretFeature'
import type {DomFeature} from '../dom/DomFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {ParsingFeature} from '../parsing/ParseFeature'
import type {PropsFeature} from '../props/PropsFeature'
import type {ValueFeature} from '../value/ValueFeature'

constructor(
  private readonly lifecycle: LifecycleFeature,
  private readonly props: PropsFeature,
  private readonly value: ValueFeature,
  private readonly dom: DomFeature,
  private readonly caret: CaretFeature,
  private readonly parsing: ParsingFeature,
) { ... }
```

Replace every `this._store.X` → `this.X`. The `TriggerFinder.find` call already passes `this._store.dom` (from Task 6 Step 5) — after this step it becomes `this.dom`.

- [ ] **Step 8: Convert `KeyboardFeature`**

`KeyboardFeature` only wires up helpers that take `store: Store` (behavior modules, out of scope per spec). It keeps `store: Store` — no change. Skip this file.

- [ ] **Step 9: Convert `DragFeature`**

```ts
import type {ParsingFeature} from '../parsing/ParseFeature'
import type {PropsFeature} from '../props/PropsFeature'
import type {ValueFeature} from '../value/ValueFeature'
// remove Store import

export class DragFeature {
  readonly action = event<DragAction>()
  #unsub?: () => void

  constructor(
    private readonly props: PropsFeature,
    private readonly value: ValueFeature,
    private readonly parsing: ParsingFeature,
  ) {
    const isDragEnabled = computed(() => this.props.layout() === 'block' && !!this.props.draggable())
    const toggle = (enabled: boolean) => {
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
      if (!enabled && this.#unsub) { this.#unsub(); this.#unsub = undefined }
    }
    watch(isDragEnabled, toggle)
    toggle(isDragEnabled())
  }
  // replace this.store.X → this.X in all private methods
}
```

Note: `DragFeature` does not use `caret` or `dom` directly — only `props`, `value`, `parsing`.

- [ ] **Step 10: Convert `ClipboardFeature`**

```ts
import type {DomFeature} from '../dom/DomFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {ParsingFeature} from '../parsing/ParseFeature'
import type {ValueFeature} from '../value/ValueFeature'

constructor(
  private readonly lifecycle: LifecycleFeature,
  private readonly value: ValueFeature,
  private readonly dom: DomFeature,
  private readonly parsing: ParsingFeature,
) {
  lifecycle.onMounted(() => {
    const container = dom.container()
    if (!container) return
    listen(container, 'copy', e => { this.#handleCopy(e) })
    listen(container, 'cut', e => {
      if (!this.#handleCopy(e)) return
      const raw = dom.readRawSelection()
      if (!raw.ok || raw.value.range.start === raw.value.range.end) return
      value.replaceRange(raw.value.range, '', {
        recover: {kind: 'caret', rawPosition: raw.value.range.start},
      })
    })
  })
}
```

Replace `this.store.X` → `this.X` in `#handleCopy`.

- [ ] **Step 11: Rewrite `Store.ts`**

```ts
import {enableFocus} from '../features/caret/focus'
import {enableSelection} from '../features/caret/selection'
import {CaretFeature} from '../features/caret'
import {ClipboardFeature} from '../features/clipboard'
import {DomFeature} from '../features/dom'
import {DragFeature} from '../features/drag'
import {KeyboardFeature} from '../features/keyboard'
import {LifecycleFeature} from '../features/lifecycle'
import {MarkFeature} from '../features/mark'
import {OverlayFeature} from '../features/overlay'
import {ParsingFeature} from '../features/parsing/ParseFeature'
import {PropsFeature} from '../features/props/PropsFeature'
import {SlotsFeature} from '../features/slots'
import {ValueFeature} from '../features/value'
import {KeyGenerator, MarkputHandler} from '../shared/classes'
import {BlockRegistry} from './BlockRegistry'

export type {DragAction} from '../shared/types'

export class Store {
  readonly key = new KeyGenerator()
  readonly blocks = new BlockRegistry()

  // Layer 0 — no feature deps
  readonly lifecycle = new LifecycleFeature()
  readonly props    = new PropsFeature()
  readonly caret    = new CaretFeature()

  // Layer 1 — props only
  readonly mark  = new MarkFeature(this.props)
  readonly slots = new SlotsFeature(this.props)

  // Layer 2 — lifecycle + props + caret
  readonly value = new ValueFeature(this.lifecycle, this.props, this.caret)

  // Layer 3 — value + mark + slots (+ lifecycle + props)
  readonly parsing = new ParsingFeature(this.lifecycle, this.value, this.mark, this.props, this.slots)

  // Layer 4 — caret + parsing (+ lifecycle + props)
  readonly dom = new DomFeature(this.lifecycle, this.props, this.caret, this.parsing)

  // Layer 5 — everything below
  readonly overlay   = new OverlayFeature(this.lifecycle, this.props, this.value, this.dom, this.caret, this.parsing)
  readonly keyboard  = new KeyboardFeature(this)   // behavior modules; keeps Store
  readonly drag      = new DragFeature(this.props, this.value, this.parsing)
  readonly clipboard = new ClipboardFeature(this.lifecycle, this.value, this.dom, this.parsing)

  readonly handler = new MarkputHandler(this)

  constructor() {
    // Attach caret behavior modules that need dom (constructed after caret).
    this.lifecycle.onMounted(() => {
      enableFocus(this)
      enableSelection(this)
    })
  }
}
```

Verify: every constructor argument refers only to a field declared **above** it. If any argument references a field declared below, it is a cycle — fix it before proceeding.

- [ ] **Step 12: Run full checks**

```
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
```

All must pass. Fix any type error — they are real bugs.

- [ ] **Step 13: Commit**

```
git add packages/core/src/
git commit -m "refactor(core): convert features to positional constructor params, rewrite Store"
```

---

## Phase 4 — Docs and Final Verification

### Task 9 (Phase 4): Update architecture documentation

**Files:**
- Modify: `packages/website/src/content/docs/development/architecture.md`

- [ ] **Step 1: Replace the Features section paragraph**

Find and replace (lines ~356–358):

```md
// before:
11 features, each with `enable()`/`disable()`. They never import each other — all communication goes through `store.<name>.*` (internal signals), `store.props` (framework-provided signals), `store.dom` (registered DOM structure and raw mapping), and `store.caret` (location/recovery):

// after:
Each feature declares its dependencies as positional constructor parameters with concrete feature types. The dependency graph is acyclic — features can only depend on features constructed above them in `Store`. They never import each other directly; all cross-feature access goes through the injected constructor parameters. `MarkputHandler` and `KeyboardFeature` behavior modules retain the full `Store` as an adapter boundary (see architecture guardrails).

Signal subscription order is significant: `ParsingFeature` subscribes to `value.current` at Store construction time, before `lifecycle.mounted()` fires. `ValueFeature` registers its `change()` emission inside `onMounted`. This guarantees that when `value.change` fires, `parsing.tokens()` is already updated.
```

- [ ] **Step 2: Remove stale `store.feature.*` wrapper from Store Structure section**

Find the `readonly feature: { ... }` block in the `Store Structure` section (lines ~309–322). It describes a nested `store.feature.*` namespace that does not exist in the codebase. Replace it with the actual flat structure:

```ts
// The actual store shape — features live directly on store, not nested under .feature
readonly lifecycle: LifecycleFeature
readonly props:     PropsFeature
readonly caret:     CaretFeature
readonly mark:      MarkFeature
readonly slots:     SlotsFeature
readonly value:     ValueFeature
readonly parsing:   ParsingFeature
readonly dom:       DomFeature
readonly overlay:   OverlayFeature
readonly keyboard:  KeyboardFeature
readonly drag:      DragFeature
readonly clipboard: ClipboardFeature
```

- [ ] **Step 3: Update the Lifecycle Timing section**

Find lines ~385–392 (step 2 in Lifecycle Timing). Replace:

```
// 2. After mount, ValueFeature accepts props.value/defaultValue and parses tokens.
//    ParsingFeature watches parser shape changes and reparses from value.current.
```

with:

```
// 2. After mount, ValueFeature accepts props.value/defaultValue and emits change.
//    ParsingFeature has already subscribed to value.current at construction time
//    and updates tokens before the change event fires.
```

- [ ] **Step 4: Update Public API table**

In the Store Events table, add a note that `store.parsing.sync()` and `store.parsing.parseValue()` were removed. Also update the `caret` row to note `placeAt`/`focus` were removed; use `store.dom.*` directly.

- [ ] **Step 5: Build docs to confirm no broken links**

```
pnpm -F @markput/website run build
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```
git add packages/website/src/content/docs/development/architecture.md
git commit -m "docs: update architecture for explicit feature deps and acyclic graph"
```

---

### Task 10 (Phase 4): Final verification

- [ ] **Step 1: Install Playwright (if not already done)**

```
pnpm exec playwright install chromium
```

- [ ] **Step 2: Full check suite**

```
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
```

All must pass with zero suppressions.

- [ ] **Step 3: Storybook browser tests**

```
pnpm -F @markput/storybook test
```

These run against real Chromium. Any failure in caret navigation, keyboard, clipboard or overlay stories is a regression.

- [ ] **Step 4: Verify acyclic construction order**

Open `packages/core/src/store/Store.ts`. For each `new FeatureX(this.A, this.B, ...)` call, confirm that `A` and `B` are declared as `readonly` fields **above** `FeatureX` in the class body. If any argument points to a field declared later, it is a cycle — the refactor is incomplete.

- [ ] **Step 5: Verify no `_store` escapes**

```
grep -rn '\._store\.' packages/core/src/features/
```

Expected: zero results. Any match is a feature that was missed in Task 8.
