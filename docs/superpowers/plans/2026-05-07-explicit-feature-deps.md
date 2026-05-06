# Explicit Feature Dependencies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Store service-locator pattern with explicit positional constructor dependencies in every feature, after first removing all cycles from the feature dependency graph.

**Architecture:** Three cycles are broken in order — value↔parsing (invert: Parsing subscribes to Value), caret↔dom (delete `CaretFeature.placeAt/focus`, move wiring to Store), parsing→caret (guard deleted as a side-effect of cycle 1). Then every feature constructor is converted from `_store: Store` to positional parameter properties with concrete feature types, and Store is rewritten to construct features top-to-bottom in dependency order.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces. All commands run from the repo root unless noted. Core source lives in `packages/core/src/`.

---

## File Map

Files touched by each phase:

**Phase 0 — dep narrowing (no behavior change)**
- Modify: all feature files listed in Phase 0 tasks

**Phase 1 — invert value↔parsing**
- Modify: `features/value/ValueFeature.ts`
- Modify: `features/parsing/ParseFeature.ts`
- Modify: `features/value/ValueFeature.spec.ts` (add spec)
- Modify: `features/parsing/ParseFeature.spec.ts` (rewrite tests)
- Modify: `features/drag/DragFeature.spec.ts` (migrate one call)

**Phase 2 — remove caret.placeAt/focus**
- Modify: `features/caret/CaretFeature.ts`
- Modify: `features/caret/CaretFeature.spec.ts`
- Modify: `features/keyboard/arrowNav.ts`
- Modify: `features/keyboard/blockEdit.ts`
- Modify: `features/dom/DomFeature.ts`
- Modify: `features/navigation/README.md`
- Modify: `store/Store.ts`

**Phase 3 — explicit positional deps**
- Modify: `store/Store.ts`
- Modify: every feature file (10 files)

**Phase 4 — docs**
- Modify: `packages/website/src/content/docs/development/architecture.md`
- Modify: `features/navigation/README.md`

---

## Task 1: Narrow `PropsFeature` — drop unused Store parameter

**Files:**
- Modify: `packages/core/src/features/props/PropsFeature.ts`
- Modify: `packages/core/src/store/Store.ts`

`PropsFeature` currently accepts `_store: Store` but never reads it.

- [ ] **Step 1: Remove the parameter from `PropsFeature`**

In `packages/core/src/features/props/PropsFeature.ts`, delete line 40:

```ts
// before
constructor(private readonly _store: Store) {}

// after
constructor() {}
```

Also delete the unused import at line 14:
```ts
import type {Store} from '../../store/Store'  // delete this line
```

- [ ] **Step 2: Update the Store construction call**

In `packages/core/src/store/Store.ts`, change:

```ts
// before
readonly props = new PropsFeature(this)

// after
readonly props = new PropsFeature()
```

- [ ] **Step 3: Verify**

```
pnpm -w exec vitest run packages/core/src
pnpm run typecheck
```

Expected: all pass, no errors.

- [ ] **Step 4: Commit**

```
git add packages/core/src/features/props/PropsFeature.ts packages/core/src/store/Store.ts
git commit -m "refactor(core): remove unused Store parameter from PropsFeature"
```

---

## Task 2: Narrow Store parameter in leaf features (MarkFeature, SlotsFeature)

**Files:**
- Modify: `packages/core/src/features/mark/MarkFeature.ts`
- Modify: `packages/core/src/features/slots/SlotsFeature.ts`

Both features only use `props`. Narrow their `_store` type so TypeScript enforces it.

- [ ] **Step 1: Narrow `MarkFeature`**

In `packages/core/src/features/mark/MarkFeature.ts`, change:

```ts
// before
import type {Store} from '../../store/Store'
// ...
constructor(private readonly _store: Store) {}

// after
import type {PropsFeature} from '../props/PropsFeature'
// ...
constructor(private readonly _store: Pick<{props: PropsFeature}, 'props'>) {}
```

- [ ] **Step 2: Narrow `SlotsFeature`**

In `packages/core/src/features/slots/SlotsFeature.ts`, change:

```ts
// before
import type {Store} from '../../store/Store'
// ...
constructor(private readonly _store: Store) {}

// after
import type {PropsFeature} from '../props/PropsFeature'
// ...
constructor(private readonly _store: Pick<{props: PropsFeature}, 'props'>) {}
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
git commit -m "refactor(core): narrow Store dep to props in MarkFeature and SlotsFeature"
```

---

## Task 3: Narrow Store parameter in ValueFeature, CaretFeature, DomFeature, ParsingFeature

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.ts`
- Modify: `packages/core/src/features/caret/CaretFeature.ts`
- Modify: `packages/core/src/features/dom/DomFeature.ts`
- Modify: `packages/core/src/features/parsing/ParseFeature.ts`

Narrow `_store: Store` to a `Pick` listing only actually-used members. This is a pure type change — no logic moves.

- [ ] **Step 1: Narrow `ValueFeature`**

In `packages/core/src/features/value/ValueFeature.ts`, replace:

```ts
import type {Store} from '../../store/Store'
```

with:

```ts
import type {CaretFeature} from '../caret/CaretFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {PropsFeature} from '../props/PropsFeature'
import type {ParsingFeature} from '../parsing/ParseFeature'
```

And change the constructor signature:

```ts
// before
constructor(private readonly _store: Store) {

// after
constructor(
  private readonly _store: Pick<{
    lifecycle: LifecycleFeature
    props: PropsFeature
    parsing: ParsingFeature
    caret: CaretFeature
  }, 'lifecycle' | 'props' | 'parsing' | 'caret'>
) {
```

- [ ] **Step 2: Narrow `CaretFeature`**

In `packages/core/src/features/caret/CaretFeature.ts`, replace:

```ts
import type {Store} from '../../store/Store'
```

with:

```ts
import type {DomFeature} from '../dom/DomFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
```

And change the constructor:

```ts
// before
constructor(private readonly _store: Store) {

// after
constructor(
  private readonly _store: Pick<{
    lifecycle: LifecycleFeature
    dom: DomFeature
  }, 'lifecycle' | 'dom'>
) {
```

- [ ] **Step 3: Narrow `DomFeature`**

In `packages/core/src/features/dom/DomFeature.ts`, replace the Store import with:

```ts
import type {CaretFeature} from '../caret/CaretFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {ParsingFeature} from '../parsing/ParseFeature'
import type {PropsFeature} from '../props/PropsFeature'
```

And change the constructor:

```ts
// before
constructor(private readonly _store: Store) {

// after
constructor(
  private readonly _store: Pick<{
    lifecycle: LifecycleFeature
    props: PropsFeature
    caret: CaretFeature
    parsing: ParsingFeature
  }, 'lifecycle' | 'props' | 'caret' | 'parsing'>
) {
```

- [ ] **Step 4: Narrow `ParsingFeature`**

In `packages/core/src/features/parsing/ParseFeature.ts`, replace the Store import with:

```ts
import type {CaretFeature} from '../caret/CaretFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {MarkFeature} from '../mark/MarkFeature'
import type {PropsFeature} from '../props/PropsFeature'
import type {SlotsFeature} from '../slots/SlotsFeature'
import type {ValueFeature} from '../value/ValueFeature'
```

And change the constructor:

```ts
// before
constructor(private readonly _store: Store) {

// after
constructor(
  private readonly _store: Pick<{
    lifecycle: LifecycleFeature
    mark: MarkFeature
    props: PropsFeature
    slots: SlotsFeature
    value: ValueFeature
    caret: CaretFeature
  }, 'lifecycle' | 'mark' | 'props' | 'slots' | 'value' | 'caret'>
) {
```

- [ ] **Step 5: Verify**

```
pnpm -w exec vitest run packages/core/src
pnpm run typecheck
```

Expected: all pass. Any type error here means a feature is accessing something outside its declared dep list — fix the dep list to match reality.

- [ ] **Step 6: Commit**

```
git add packages/core/src/features/value/ValueFeature.ts packages/core/src/features/caret/CaretFeature.ts packages/core/src/features/dom/DomFeature.ts packages/core/src/features/parsing/ParseFeature.ts
git commit -m "refactor(core): narrow Store parameter types to actual feature deps"
```

---

## Task 4: Add regression spec — controlled rejection must not leak recovery

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.spec.ts`

Before inverting the parsing subscription, add a test that pins the correct behavior: when a controlled parent receives `onChange` but does not echo the value back, `caret.recovery` must remain `undefined`.

- [ ] **Step 1: Add the spec**

In `packages/core/src/features/value/ValueFeature.spec.ts`, append inside the `describe('replaceRange()', ...)` block (after line 178, before the closing `}`):

```ts
it('does not set recovery when controlled parent ignores the change', () => {
  const store = new Store()
  const recovery = {kind: 'caret' as const, rawPosition: 3}
  // onChange receives the new value but deliberately does not update props.value
  store.props.set({value: 'hello', onChange: () => {}})
  store.lifecycle.mounted()

  store.value.replaceRange({start: 0, end: 5}, 'world', {recover: recovery})

  expect(store.caret.recovery()).toBeUndefined()
  expect(store.value.current()).toBe('hello')
})
```

- [ ] **Step 2: Run the new spec to confirm it passes with current code**

```
pnpm -w exec vitest run packages/core/src/features/value/ValueFeature.spec.ts
```

Expected: all pass (this behavior already works; the spec is a regression guard).

- [ ] **Step 3: Commit**

```
git add packages/core/src/features/value/ValueFeature.spec.ts
git commit -m "test(core): guard controlled-rejection does not leak caret recovery"
```

---

## Task 5: Invert value→parsing — make Parsing subscribe to Value

**Files:**
- Modify: `packages/core/src/features/parsing/ParseFeature.ts`
- Modify: `packages/core/src/features/value/ValueFeature.ts`

This is the core inversion. Parsing will watch `value.current` and re-parse automatically. Value stops calling `parsing.parseValue / acceptTokens`.

- [ ] **Step 1: Rewrite `ParsingFeature` constructor**

Replace the entire constructor in `packages/core/src/features/parsing/ParseFeature.ts` with:

```ts
constructor(
  private readonly _store: Pick<{
    lifecycle: LifecycleFeature
    mark: MarkFeature
    props: PropsFeature
    slots: SlotsFeature
    value: ValueFeature
  }, 'lifecycle' | 'mark' | 'props' | 'slots' | 'value'>
) {
  const toggle = (enabled: boolean) => {
    if (enabled && !this.#scope) {
      this.acceptTokens(this.parseValue(_store.value.current()))
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
```

Also remove `caret` from the `Pick` dep list (it is no longer used). Update the import list at the top of the file — delete the `CaretFeature` import.

- [ ] **Step 2: Replace the three private subscribe methods**

Delete `#subscribeParse`, `#subscribeReactiveParse`. Add these three in their place:

```ts
#subscribeValue(): void {
  watch(
    computed(() => this._store.value.current()),
    value => {
      this.acceptTokens(this.parseValue(value))
    }
  )
}

#subscribeReactiveParse(): void {
  watch(
    computed(() => this.parser()),
    () => {
      this.acceptTokens(this.parseValue(this._store.value.current()))
    }
  )
}

#subscribeReparse(): void {
  watch(this.reparse, () => {
    this.acceptTokens(this.parseValue(this._store.value.current()))
  })
}
```

Also remove the `sync` public method — it is now internal behavior and no longer needed as a public entry point. `parseValue` and `acceptTokens` become private:

```ts
// change from:
parseValue(value: string): Token[] {
// to:
#parseValue(value: string): Token[] {

// change from:
acceptTokens(tokens: Token[]): void {
// to:
#acceptTokens(tokens: Token[]): void {
```

Update every internal call site within `ParseFeature` (`this.acceptTokens` → `this.#acceptTokens`, `this.parseValue` → `this.#parseValue`).

The `parseWithParser` import is still used by `#parseValue`. Keep it.

- [ ] **Step 3: Simplify `ValueFeature.#accept`**

In `packages/core/src/features/value/ValueFeature.ts`, replace `#accept`:

```ts
// before
#accept(value: string): void {
  const pending = this.#pending
  this.#pending = undefined
  const tokens = this._store.parsing.parseValue(value)
  batch(() => this._store.parsing.acceptTokens(tokens))
  if (pending?.value === value) {
    this._store.caret.recovery(pending.recovery)
  }
}

// after
#accept(value: string): void {
  const pending = this.#pending
  this.#pending = undefined
  if (pending?.value === value) {
    this._store.caret.recovery(pending.recovery)
  }
}
```

Remove `parsing` from `ValueFeature`'s `Pick` dep list (it is no longer used). Update the import block — delete the `ParsingFeature` import. The constructor in `Store.ts` still passes `parsing` to `ValueFeature` until Task 9; the narrowed type will now reject it there. Fix `Store.ts` at the same time by removing `parsing: this.parsing` from the `ValueFeature` constructor call:

```ts
// before
readonly value = new ValueFeature(this)

// after — still passes `this` for now, narrowed type accepts it
readonly value = new ValueFeature(this)
```

(The `Pick` narrowing means TypeScript accepts `this` because Store still has all the other required fields — `parsing` is just no longer in the `Pick`, so it is silently ignored. No store-side change needed yet.)

- [ ] **Step 4: Verify**

```
pnpm -w exec vitest run packages/core/src/features/value/ValueFeature.spec.ts
pnpm -w exec vitest run packages/core/src/features/parsing/ParseFeature.spec.ts
pnpm run typecheck
```

Expected: ValueFeature specs all pass. ParsingFeature specs will have failures — that is expected and is fixed in Task 6.

- [ ] **Step 5: Commit**

```
git add packages/core/src/features/parsing/ParseFeature.ts packages/core/src/features/value/ValueFeature.ts
git commit -m "refactor(core): make Parsing subscribe to Value instead of being driven by it"
```

---

## Task 6: Migrate ParsingFeature and DragFeature specs

**Files:**
- Modify: `packages/core/src/features/parsing/ParseFeature.spec.ts`
- Modify: `packages/core/src/features/drag/DragFeature.spec.ts`

`sync()`, `acceptTokens()`, and `parseValue()` are now private. Tests must go through `store.value.replaceAll()` + `store.lifecycle.mounted()` to drive parsing. The `caret.recovery` guard tests are deleted because the guard no longer exists.

- [ ] **Step 1: Rewrite `ParseFeature.spec.ts`**

Replace the entire file content with:

```ts
import {describe, it, expect, beforeEach} from 'vitest'

import {Store} from '../../store/Store'

describe('ParsingFeature', () => {
  let store: Store

  beforeEach(() => {
    store = new Store()
  })

  function mountWith(value: string, withMark = true) {
    if (withMark) store.props.set({Mark: () => null, defaultValue: value})
    else store.props.set({defaultValue: value})
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

    it('sets tokens from explicit replaceAll', () => {
      mountWith('')
      store.value.replaceAll('default')

      expect(store.parsing.tokens()).toEqual([
        {type: 'text', content: 'default', position: {start: 0, end: 7}},
      ])

      store.props.set({Mark: undefined})
    })

    it('falls back to empty string when value is empty', () => {
      mountWith('')

      expect(store.parsing.tokens()).toEqual([
        {type: 'text', content: '', position: {start: 0, end: 0}},
      ])

      store.props.set({Mark: undefined})
    })

    it('does not write value state when parsing', () => {
      mountWith('test')

      expect(store.value.current()).toBe('test')
      store.props.set({Mark: undefined})
    })

    it('skips markup when no Mark override and no per-option Mark', () => {
      store.props.set({options: [{markup: '@[__value__]'}], defaultValue: '@hello'})
      store.lifecycle.mounted()

      expect(store.parsing.parser()).toBeUndefined()
      expect(store.parsing.tokens()).toEqual([
        {type: 'text', content: '@hello', position: {start: 0, end: 6}},
      ])
    })

    it('uses markup when Mark override is set', () => {
      store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}], defaultValue: '@hello'})
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
    it('does not react to props.value change without going through ValueFeature', () => {
      mountWith('hello')
      const tokensBefore = store.parsing.tokens()

      // Directly setting props.value without lifecycle does not re-parse
      store.props.set({value: 'world'})

      expect(store.parsing.tokens()).toBe(tokensBefore)

      store.props.set({Mark: undefined})
    })

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
    it('re-parses from current value on reparse event', () => {
      mountWith('test')
      store.parsing.reparse()

      expect(store.parsing.tokens()).toEqual([
        {type: 'text', content: 'test', position: {start: 0, end: 4}},
      ])
      expect(store.value.current()).toBe('test')

      store.props.set({Mark: undefined})
    })
  })
})
```

- [ ] **Step 2: Fix the DragFeature spec**

In `packages/core/src/features/drag/DragFeature.spec.ts`, replace lines 43–46:

```ts
// before
it('commits drag edits through replaceAll with recovery metadata', () => {
  store.props.set({layout: 'block', draggable: true})
  store.lifecycle.mounted()
  store.value.current('alpha\n\nbeta\n\n')
  store.parsing.acceptTokens([text('alpha', 0), text('beta', 7)])

// after
it('commits drag edits through replaceAll with recovery metadata', () => {
  store.props.set({layout: 'block', draggable: true, Mark: () => null, defaultValue: 'alpha\n\nbeta\n\n'})
  store.lifecycle.mounted()
```

Also delete the now-unused `text` helper function (lines 6–8) and its import `import type {TextToken} from '../parsing'` if `TextToken` is no longer referenced.

- [ ] **Step 3: Run all affected specs**

```
pnpm -w exec vitest run packages/core/src/features/parsing/ParseFeature.spec.ts
pnpm -w exec vitest run packages/core/src/features/drag/DragFeature.spec.ts
pnpm -w exec vitest run packages/core/src/features/value/ValueFeature.spec.ts
```

Expected: all pass.

- [ ] **Step 4: Run full test suite**

```
pnpm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```
git add packages/core/src/features/parsing/ParseFeature.spec.ts packages/core/src/features/drag/DragFeature.spec.ts
git commit -m "test(core): migrate parsing and drag specs from sync/acceptTokens to value.replaceAll"
```

---

## Task 7: Remove `CaretFeature.placeAt` and `CaretFeature.focus`

**Files:**
- Modify: `packages/core/src/features/caret/CaretFeature.ts`
- Modify: `packages/core/src/features/caret/CaretFeature.spec.ts`
- Modify: `packages/core/src/features/keyboard/arrowNav.ts`
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`
- Modify: `packages/core/src/features/dom/DomFeature.ts`
- Modify: `packages/core/src/features/navigation/README.md`

- [ ] **Step 1: Update `arrowNav.ts` call sites**

In `packages/core/src/features/keyboard/arrowNav.ts`, replace the two `caret.focus` / `caret.placeAt` calls (lines 48, 54, 57):

```ts
// before (line 48)
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

// after
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

- [ ] **Step 2: Update `blockEdit.ts` call site**

In `packages/core/src/features/keyboard/blockEdit.ts`, in the `focusRow` function (line 202), change:

```ts
// before
if (address && store.caret.focus(address).ok) return

// after
if (address && store.dom.focusAddress(address).ok) return
```

- [ ] **Step 3: Fix the `DomFeature` self-call in `#applyPendingRecovery`**

In `packages/core/src/features/dom/DomFeature.ts`, inside `#applyPendingRecovery` (around line 771), change:

```ts
// before
const result = this._store.caret.placeAt(recovery.rawPosition, recovery.affinity)

// after
const result = this.placeCaretAtRawPosition(recovery.rawPosition, recovery.affinity)
```

- [ ] **Step 4: Remove `placeAt` and `focus` from `CaretFeature`**

In `packages/core/src/features/caret/CaretFeature.ts`, delete the `placeAt` and `focus` methods (lines 19–28). The file becomes:

```ts
import type {CaretLocation, CaretRecovery} from '../../shared/editorContracts'
import {signal} from '../../shared/signals'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {DomFeature} from '../dom/DomFeature'
import {enableFocus} from './focus'
import {enableSelection} from './selection'

export class CaretFeature {
  readonly recovery = signal<CaretRecovery | undefined>(undefined)
  readonly location = signal<CaretLocation | undefined>(undefined)
  readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

  constructor(
    private readonly _store: Pick<{
      lifecycle: LifecycleFeature
      dom: DomFeature
    }, 'lifecycle' | 'dom'>
  ) {
    _store.lifecycle.onMounted(() => {
      enableFocus(_store)
      enableSelection(_store)
    })
  }
}
```

Note: `Result` and `TokenAddress` imports are only needed for the deleted methods — remove them if nothing else in the file uses them.

- [ ] **Step 5: Update `CaretFeature.spec.ts`**

The spec currently tests `placeAt` / `focus` indirectly through type checks that are now removed. The two existing tests in `CaretFeature.spec.ts` do not reference those methods directly, so no change is needed there. Run to confirm:

```
pnpm -w exec vitest run packages/core/src/features/caret/CaretFeature.spec.ts
```

Expected: both tests pass.

- [ ] **Step 6: Update navigation README**

In `packages/core/src/features/navigation/README.md`, replace lines 10–11:

```md
- Use `store.caret.focus(address, boundary)` for mark focus.
- Use `store.caret.placeAt(rawPosition)` for raw-position text recovery.
```

with:

```md
- Use `store.dom.focusAddress(address, boundary)` for mark focus.
- Use `store.dom.placeCaretAtRawPosition(rawPosition, affinity)` for raw-position text recovery.
```

- [ ] **Step 7: Verify**

```
pnpm test
pnpm run typecheck
```

Expected: all pass.

- [ ] **Step 8: Commit**

```
git add packages/core/src/features/caret/CaretFeature.ts packages/core/src/features/caret/CaretFeature.spec.ts packages/core/src/features/keyboard/arrowNav.ts packages/core/src/features/keyboard/blockEdit.ts packages/core/src/features/dom/DomFeature.ts packages/core/src/features/navigation/README.md
git commit -m "refactor(core): remove CaretFeature.placeAt/focus, use store.dom directly"
```

---

## Task 8: Move `enableFocus/enableSelection` wiring to Store

**Files:**
- Modify: `packages/core/src/features/caret/CaretFeature.ts`
- Modify: `packages/core/src/store/Store.ts`

`CaretFeature` currently calls `enableFocus(_store)` / `enableSelection(_store)` in its constructor via `lifecycle.onMounted`. These helpers need `dom`, which is constructed after `caret` — so `caret` must not hold a dep on `dom`. Move the wiring up to `Store`.

- [ ] **Step 1: Strip `CaretFeature` to pure state**

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

No constructor, no deps, no imports beyond signals and types.

- [ ] **Step 2: Wire `enableFocus` and `enableSelection` in `Store`**

In `packages/core/src/store/Store.ts`, add an `init` block at the bottom of the class:

```ts
constructor() {
  this.lifecycle.onMounted(() => {
    enableFocus(this)
    enableSelection(this)
  })
}
```

Add imports at the top of `Store.ts`:

```ts
import {enableFocus} from '../features/caret/focus'
import {enableSelection} from '../features/caret/selection'
```

- [ ] **Step 3: Verify**

```
pnpm test
pnpm run typecheck
```

Expected: all pass.

- [ ] **Step 4: Commit**

```
git add packages/core/src/features/caret/CaretFeature.ts packages/core/src/store/Store.ts
git commit -m "refactor(core): move caret focus/selection wiring to Store, CaretFeature becomes pure state"
```

---

## Task 9: Convert all features to positional parameter properties

**Files:**
- Modify: `packages/core/src/store/Store.ts`
- Modify: `packages/core/src/features/value/ValueFeature.ts`
- Modify: `packages/core/src/features/parsing/ParseFeature.ts`
- Modify: `packages/core/src/features/dom/DomFeature.ts`
- Modify: `packages/core/src/features/mark/MarkFeature.ts`
- Modify: `packages/core/src/features/slots/SlotsFeature.ts`
- Modify: `packages/core/src/features/overlay/OverlayFeature.ts`
- Modify: `packages/core/src/features/keyboard/KeyboardFeature.ts`
- Modify: `packages/core/src/features/drag/DragFeature.ts`
- Modify: `packages/core/src/features/clipboard/ClipboardFeature.ts`

Replace each `_store: Pick<...>` constructor with positional `private readonly` parameter properties typed as concrete feature classes. Replace `this._store.X` with `this.X` throughout each file. Rewrite `Store` to construct features with explicit instances in topological order.

This task is one commit because splitting it would leave the Store in a broken state mid-way.

- [ ] **Step 1: Convert `MarkFeature`**

```ts
// packages/core/src/features/mark/MarkFeature.ts

import type {PropsFeature} from '../props/PropsFeature'
// ... other imports unchanged ...

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

- [ ] **Step 2: Convert `SlotsFeature`**

```ts
// packages/core/src/features/slots/SlotsFeature.ts

import type {PropsFeature} from '../props/PropsFeature'
// ... other imports unchanged ...

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

- [ ] **Step 3: Convert `ValueFeature`**

```ts
// packages/core/src/features/value/ValueFeature.ts

import type {CaretFeature} from '../caret/CaretFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {PropsFeature} from '../props/PropsFeature'
// ... other imports unchanged ...

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

- [ ] **Step 4: Convert `ParsingFeature`**

```ts
// packages/core/src/features/parsing/ParseFeature.ts

import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {MarkFeature} from '../mark/MarkFeature'
import type {PropsFeature} from '../props/PropsFeature'
import type {SlotsFeature} from '../slots/SlotsFeature'
import type {ValueFeature} from '../value/ValueFeature'
// ... other imports unchanged ...

export class ParsingFeature {
  // ... signals unchanged ...

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
        this.#acceptTokens(this.#parseValue(value.current()))
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

  #parseValue(value: string): Token[] {
    return parseWithParser(this.parser(), value)
  }

  #acceptTokens(tokens: Token[]): void {
    batch(
      () => {
        this.tokens(tokens)
        this.#generation(this.#generation() + 1)
      },
      {mutable: true}
    )
  }

  #subscribeValue(): void {
    watch(
      computed(() => this.value.current()),
      v => { this.#acceptTokens(this.#parseValue(v)) }
    )
  }

  #subscribeReactiveParse(): void {
    watch(
      computed(() => this.parser()),
      () => { this.#acceptTokens(this.#parseValue(this.value.current())) }
    )
  }

  #subscribeReparse(): void {
    watch(this.reparse, () => {
      this.#acceptTokens(this.#parseValue(this.value.current()))
    })
  }
}
```

Note: `parseWithParser` in the original file has the signature
`parseWithParser(store: Store, value: string)` reading `store.parsing.parser()` internally.
Task 10 refactors it to `parseWithParser(parser: Parser | undefined, value: string)`.
Do Task 10 **before** committing Task 9 Step 4, or inline the fix here: replace
the `#parseValue` body with:

```ts
#parseValue(value: string): Token[] {
  const parser = this.parser()
  if (!parser) {
    return [{type: 'text' as const, content: value, position: {start: 0, end: value.length}}]
  }
  return parser.parse(value)
}
```

This makes `parseWithParser` / `computeTokensFromValue` from `valueParser.ts`
unused inside `ParseFeature` — they are still used by other callers
(`parseUnionLabels`, etc.), so do not delete the file, just stop importing
`parseWithParser` in `ParseFeature`.

- [ ] **Step 5: Convert `DomFeature`**

Change the constructor signature. Replace every `this._store.X` → `this.X` throughout the file (there are ~25 occurrences). The key change:

```ts
import type {CaretFeature} from '../caret/CaretFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {ParsingFeature} from '../parsing/ParseFeature'
import type {PropsFeature} from '../props/PropsFeature'

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
      computed(() => ({
        readOnly: props.readOnly(),
        selecting: caret.selecting(),
      })),
      () => this.reconcile()
    )
  })
}
```

- [ ] **Step 6: Convert `OverlayFeature`**

```ts
constructor(
  private readonly lifecycle: LifecycleFeature,
  private readonly props: PropsFeature,
  private readonly value: ValueFeature,
  private readonly dom: DomFeature,
  private readonly caret: CaretFeature,
  private readonly parsing: ParsingFeature,
) { ... }
```

Replace `this._store.X` → `this.X` throughout. `TriggerFinder.find(this._store.props.options(), ..., this._store)` — check what the third argument is used for inside `TriggerFinder`. If it uses `store.dom` or `store.caret`, pass `{dom: this.dom, caret: this.caret}` or restructure the call. Keep the same observable behavior.

- [ ] **Step 7: Convert `KeyboardFeature`**

```ts
import type {Store} from '../../store/Store'

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

This feature only calls helpers that each take `store`. Keep `store: Store` here for now — the helpers are behavior modules (out of scope per spec). The improvement is that `KeyboardFeature` itself stops importing anything from `Store` members beyond what the helpers need. No change required to this file in Task 9.

- [ ] **Step 8: Convert `DragFeature`**

```ts
import type {ParsingFeature} from '../parsing/ParseFeature'
import type {PropsFeature} from '../props/PropsFeature'
import type {ValueFeature} from '../value/ValueFeature'

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
        this.#unsub = watch(this.action, action => { ... })
      }
      if (!enabled && this.#unsub) { this.#unsub(); this.#unsub = undefined }
    }
    watch(isDragEnabled, toggle)
    toggle(isDragEnabled())
  }

  // replace this.store.X → this.X in all private methods
}
```

`DragFeature` does not use `caret` or `dom` directly — only `props`, `value`, and `parsing`.

- [ ] **Step 9: Convert `ClipboardFeature`**

```ts
import type {DomFeature} from '../dom/DomFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {ParsingFeature} from '../parsing/ParseFeature'
import type {ValueFeature} from '../value/ValueFeature'

export class ClipboardFeature {
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

  #handleCopy(e: ClipboardEvent): boolean {
    const container = this.dom.container()
    if (!container) return false
    const raw = this.dom.readRawSelection()
    if (!raw.ok || raw.value.range.start === raw.value.range.end) return false
    const sel = window.getSelection()
    const range = sel?.rangeCount ? sel.getRangeAt(0) : undefined
    if (!range) return false
    const plainText = range.toString()
    const html = htmlFromRange(range)
    const markup = serializeRawRange(this.parsing.tokens(), raw.value.range)
    e.preventDefault()
    e.clipboardData?.setData('text/plain', plainText)
    e.clipboardData?.setData('text/html', html)
    e.clipboardData?.setData(MARKPUT_MIME, markup)
    return true
  }
}
```

- [ ] **Step 10: Rewrite `Store.ts`**

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

  // Layer 0 — no deps
  readonly lifecycle = new LifecycleFeature()
  readonly props = new PropsFeature()
  readonly caret = new CaretFeature()

  // Layer 1 — props only
  readonly mark = new MarkFeature(this.props)
  readonly slots = new SlotsFeature(this.props)

  // Layer 2 — lifecycle + props + caret
  readonly value = new ValueFeature(this.lifecycle, this.props, this.caret)

  // Layer 3 — value + mark + slots
  readonly parsing = new ParsingFeature(this.lifecycle, this.value, this.mark, this.props, this.slots)

  // Layer 4 — caret + parsing
  readonly dom = new DomFeature(this.lifecycle, this.props, this.caret, this.parsing)

  // Layer 5 — everything below
  readonly overlay = new OverlayFeature(this.lifecycle, this.props, this.value, this.dom, this.caret, this.parsing)
  readonly keyboard = new KeyboardFeature(this)
  readonly drag = new DragFeature(this.props, this.value, this.parsing)
  readonly clipboard = new ClipboardFeature(this.lifecycle, this.value, this.dom, this.parsing)

  readonly handler = new MarkputHandler(this)

  constructor() {
    this.lifecycle.onMounted(() => {
      enableFocus(this)
      enableSelection(this)
    })
  }
}
```

- [ ] **Step 11: Run the full suite**

```
pnpm test
pnpm run typecheck
pnpm run build
pnpm run lint:check
pnpm run format:check
```

Expected: all pass. Fix any type errors before committing — they are real bugs, not noise.

- [ ] **Step 12: Commit**

```
git add packages/core/src/
git commit -m "refactor(core): pass explicit feature dependencies via positional constructor parameters"
```

---

## Task 10: Refactor `parseWithParser` to not take Store

**Files:**
- Modify: `packages/core/src/features/parsing/utils/valueParser.ts`
- Modify: any callers of `parseWithParser(store, value)` outside `ParseFeature`

`parseWithParser` currently takes `(store: Store, value: string)` and reads
`store.parsing.parser()` internally. Now that `ParseFeature` inlines the logic
(Task 9 Step 4), this utility should also stop taking Store so other callers can
use it without the full Store.

- [ ] **Step 1: Find all callers**

```
pnpm -w exec grep -rn "parseWithParser\|computeTokensFromValue" packages/core/src
```

Note each call site and what it passes as the first argument.

- [ ] **Step 2: Refactor `parseWithParser` signature**

In `packages/core/src/features/parsing/utils/valueParser.ts`:

```ts
// before
export function parseWithParser(store: Store, value: string): Token[] {
  const parser = store.parsing.parser()
  if (!parser) {
    return [{type: 'text' as const, content: value, position: {start: 0, end: value.length}}]
  }
  return parser.parse(value)
}

// after
export function parseWithParser(parser: Parser | undefined, value: string): Token[] {
  if (!parser) {
    return [{type: 'text' as const, content: value, position: {start: 0, end: value.length}}]
  }
  return parser.parse(value)
}
```

Add the `Parser` import at the top:
```ts
import type {Parser} from '../parser/Parser'
```

Remove the `Store` import if it is no longer used in the file.

- [ ] **Step 3: Update `parseUnionLabels` and `computeTokensFromValue`**

These also take `store`. Update them to accept explicit deps:

```ts
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
    const token = tokens[index]
    span += token.content
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

- [ ] **Step 4: Update all callers found in Step 1**

For each call site, pass `store.parsing.parser()` and `store.parsing.tokens()` explicitly instead of `store`.

- [ ] **Step 5: Verify**

```
pnpm -w exec vitest run packages/core/src
pnpm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```
git add packages/core/src/features/parsing/utils/valueParser.ts
git commit -m "refactor(core): remove Store dependency from parseWithParser utilities"
```

---

## Task 11: Update architecture docs

**Files:**
- Modify: `packages/website/src/content/docs/development/architecture.md`

- [ ] **Step 1: Update the Store section**

Find the section describing how features access shared state. Replace any description of "the Store passes `this` to features" with:

> Features declare their dependencies as positional constructor parameters with concrete feature types. `Store` constructs features in topological dependency order, passing already-built instances. The dependency graph is acyclic; a feature can only depend on features constructed before it. `MarkputHandler` retains the full `Store` reference as the adapter boundary.

- [ ] **Step 2: Update caret navigation references**

Search the file for `store.caret.placeAt` or `store.caret.focus`. Replace each with `store.dom.placeCaretAtRawPosition` and `store.dom.focusAddress` respectively.

- [ ] **Step 3: Build docs to verify no broken references**

```
pnpm -F @markput/website run build
```

Expected: exits 0.

- [ ] **Step 4: Format check**

```
pnpm exec oxfmt --check packages/website/src/content/docs/development/architecture.md
```

If the file is excluded by `oxfmt.config.ts`, skip this step.

- [ ] **Step 5: Commit**

```
git add packages/website/src/content/docs/development/architecture.md
git commit -m "docs: update architecture doc to describe explicit feature deps and acyclic graph"
```

---

## Task 12: Final verification

- [ ] **Run full checks**

```
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
```

All must pass. Do not skip any check.

- [ ] **Run Storybook browser tests**

```
pnpm -F @markput/storybook test
```

These are the strongest integration signal — any caret navigation, clipboard, or overlay story exercises the entire refactored pipeline.

- [ ] **Confirm dependency graph is acyclic**

For each feature in `packages/core/src/store/Store.ts`, verify that each constructor argument refers only to a field declared earlier in the file. If anything refers to a later field, it is a cycle — fix it before declaring done.
