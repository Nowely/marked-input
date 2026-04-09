# watch() newValue/oldValue + direct signal/event source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `watch()` so it passes `(newValue, oldValue)` to its callback and accepts signals/events directly as the dependency (not just getter wrappers).

**Architecture:** The `watch()` helper in `signal.ts` currently discards the dep return value. We track `oldValue` between runs and pass both `newValue` and `oldValue` to the callback. Signal<T> and Event<T> are already callable `() => T`, so passing them directly already satisfies the type — no overloads needed, just a generic signature. All controller call sites are migrated to the new pattern; the old getter-wrapper form `watch(() => ev(), fn)` remains valid and backwards-compatible.

**Tech Stack:** TypeScript, alien-signals (internal reactivity), Vitest

---

## File Map

| File                                                            | Change                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/core/src/shared/signals/signal.ts`                    | Update `watch` — generic, track oldValue, pass `(newValue, oldValue)` to callback |
| `packages/core/src/shared/signals/signals.spec.ts`              | Add tests for newValue/oldValue; update stale-payload test                        |
| `packages/core/src/features/events/SystemListenerController.ts` | Migrate 3 watch calls to new pattern                                              |
| `packages/core/src/features/overlay/OverlayController.ts`       | Migrate 3 watch calls to new pattern                                              |
| `packages/core/src/features/lifecycle/Lifecycle.ts`             | Migrate 2 watch calls to new pattern                                              |

---

### Task 1: Update `watch()` implementation

**Files:**

- Modify: `packages/core/src/shared/signals/signal.ts:151-166`

- [ ] **Step 1: Write the failing test** — add to the `watch()` describe block in `signals.spec.ts`

```typescript
it('should pass newValue and oldValue to callback', () => {
    const s = signal(0)
    const calls: Array<[number, number | undefined]> = []

    const dispose = watch(s, (newVal, oldVal) => {
        calls.push([newVal, oldVal])
    })
    disposers.push(dispose)

    s(1)
    s(2)
    s(3)

    expect(calls).toEqual([
        [1, 0],
        [2, 1],
        [3, 2],
    ])
})

it('should pass newValue and oldValue for events', () => {
    const ev = event<number>()
    const calls: Array<[number | undefined, number | undefined]> = []

    const dispose = watch(ev, (newVal, oldVal) => {
        calls.push([newVal, oldVal])
    })
    disposers.push(dispose)

    ev.emit(10)
    ev.emit(20)

    expect(calls).toEqual([
        [10, undefined],
        [20, 10],
    ])
})

it('should accept signal directly (not wrapped in getter)', () => {
    const s = signal('a')
    const seen: string[] = []

    const dispose = watch(s, v => seen.push(v))
    disposers.push(dispose)

    s('b')
    s('c')

    expect(seen).toEqual(['b', 'c'])
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @markput/core exec vitest run packages/core/src/shared/signals/signals.spec.ts
```

Expected: 3 new tests fail (type error or callback receives no args)

- [ ] **Step 3: Update `watch` implementation in `signal.ts`**

Replace the existing `watch` function (lines 151–166):

```typescript
/**
 * Creates an effect that skips its first execution.
 * Useful for subscribing to signals/events without firing on initial creation.
 * The callback receives `(newValue, oldValue)` on each subsequent run.
 *
 * Accepts a signal, event, or getter function as the dependency source:
 *   watch(store.events.delete, (payload) => { ... })
 *   watch(store.state.name,    (next, prev) => { ... })
 *   watch(() => computed(),    (next, prev) => { ... })  // getter form still valid
 *
 * @param dep - dependency source (signal, event, or getter function)
 * @param fn  - callback invoked on subsequent runs with (newValue, oldValue)
 * @returns dispose function
 */
export function watch<T>(dep: () => T, fn: (newValue: T, oldValue: T | undefined) => void): () => void {
    let initialized = false
    let oldValue: T | undefined
    return alienEffect(() => {
        const newValue = dep()
        if (!initialized) {
            initialized = true
            oldValue = newValue
            return
        }
        const prev = oldValue
        oldValue = newValue
        const prevSub = setActiveSub(undefined)
        try {
            fn(newValue, prev)
        } finally {
            setActiveSub(prevSub)
        }
    })
}
```

- [ ] **Step 4: Run the new tests to verify they pass**

```bash
pnpm --filter @markput/core exec vitest run packages/core/src/shared/signals/signals.spec.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shared/signals/signal.ts packages/core/src/shared/signals/signals.spec.ts
git commit -m "feat(core): upgrade watch() to pass (newValue, oldValue) and accept signals/events directly"
```

---

### Task 2: Migrate SystemListenerController

**Files:**

- Modify: `packages/core/src/features/events/SystemListenerController.ts`

- [ ] **Step 1: Replace 3 watch calls**

Full updated `enable()` method body (inside `effectScope`):

```typescript
watch(this.store.events.change, () => {
    const onChange = this.store.state.onChange.get()
    const {focus} = this.store.nodes

    if (!focus.target || !focus.target.isContentEditable) {
        const tokens = this.store.state.tokens.get()
        const serialized = toString(tokens)
        onChange?.(serialized)
        this.store.state.previousValue.set(serialized)
        this.store.state.tokens.set([...tokens])
        return
    }

    const tokens = this.store.state.tokens.get()
    const token = tokens[focus.index]
    if (token.type === 'text') {
        token.content = focus.content
    } else {
        token.value = focus.content
    }

    onChange?.(toString(tokens))
    this.store.events.parse.emit()
})

watch(this.store.events.delete, payload => {
    if (!payload) return

    const {token} = payload
    const tokens = this.store.state.tokens.get()
    if (!findToken(tokens, token)) return

    const value = toString(tokens)
    const nextValue = value.slice(0, token.position.start) + value.slice(token.position.end)
    this.store.applyValue(nextValue)
})

watch(this.store.events.select, event => {
    if (!event) return

    const Mark = this.store.state.Mark.get()
    const onChange = this.store.state.onChange.get()
    const {
        mark,
        match: {option, span, index, source},
    } = event

    const markup = option.markup
    if (!markup) return

    const annotation =
        mark.type === 'mark'
            ? annotate(markup, {
                  value: mark.value,
                  meta: mark.meta,
              })
            : annotate(markup, {
                  value: mark.content,
              })

    const newSpan = createNewSpan(span, annotation, index, source)

    this.store.state.recovery.set(
        Mark
            ? {
                  caret: 0,
                  anchor: this.store.nodes.input.next,
                  isNext: true,
                  childIndex: this.store.nodes.input.index,
              }
            : {caret: index + annotation.length, anchor: this.store.nodes.input}
    )

    if (this.store.nodes.input.target) {
        this.store.nodes.input.content = newSpan
        const tokens = this.store.state.tokens.get()
        const inputToken = tokens[this.store.nodes.input.index]
        if (inputToken.type === 'text') {
            inputToken.content = newSpan
        }

        this.store.nodes.focus.target = this.store.nodes.input.target
        this.store.nodes.input.clear()
        onChange?.(toString(tokens))
        this.store.events.parse.emit()
    }
})
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @markput/core exec vitest run
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/events/SystemListenerController.ts
git commit -m "refactor(core): migrate SystemListenerController watch calls to new (newValue, oldValue) API"
```

---

### Task 3: Migrate OverlayController

**Files:**

- Modify: `packages/core/src/features/overlay/OverlayController.ts`

- [ ] **Step 1: Replace 3 watch calls inside `enableTrigger`**

```typescript
watch(this.store.events.clearOverlay, () => {
    onMatch(undefined)
})

watch(this.store.events.checkOverlay, () => {
    // oxlint-disable-next-line no-unsafe-type-assertion -- state.options is CoreOption[] but callers always pass T[] which extends CoreOption
    const match = TriggerFinder.find(this.store.state.options.get() as T[], getTrigger)
    onMatch(match)
})

watch(this.store.events.change, () => {
    const showOverlayOn = this.store.state.showOverlayOn.get()
    if (!showOverlayOn) return
    const type: OverlayTrigger = 'change'

    if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
        this.store.events.checkOverlay.emit()
    }
})
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @markput/core exec vitest run
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/overlay/OverlayController.ts
git commit -m "refactor(core): migrate OverlayController watch calls to new API"
```

---

### Task 4: Migrate Lifecycle

**Files:**

- Modify: `packages/core/src/features/lifecycle/Lifecycle.ts`

- [ ] **Step 1: Replace 2 watch calls**

In `#subscribeParse()`:

```typescript
watch(store.events.parse, () => {
    if (store.state.recovery.get()) {
        const text = toString(store.state.tokens.get())
        store.state.tokens.set(parseWithParser(store, text))
        store.state.previousValue.set(text)
        return
    }
    store.state.tokens.set(store.nodes.focus.target ? getTokensByUI(store) : getTokensByValue(store))
})
```

In `#subscribeOverlay()`:

```typescript
watch(store.state.overlayMatch, match => {
    if (match) {
        store.nodes.input.target = store.nodes.focus.target
        store.controllers.overlay.enableClose()
    } else {
        store.controllers.overlay.disableClose()
    }
})
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @markput/core exec vitest run
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/lifecycle/Lifecycle.ts
git commit -m "refactor(core): migrate Lifecycle watch calls to new API"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full check suite**

```bash
pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint && pnpm run format
```

Expected: all checks pass with no errors

- [ ] **Step 2: Commit any format/lint fixes if needed**, then confirm all green.
