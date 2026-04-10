# ParseFeature Extraction Design

## Problem

Lifecycle currently contains parser orchestration logic that doesn't belong there:

1. **`syncParser()`** — initial parse on mount / value change (parsing concern, not lifecycle)
2. **`#subscribeParse()`** — dispatch between `parseWithParser`, `getTokensByUI`, `getTokensByValue` based on recovery/focus state (parsing strategy, not lifecycle)
3. **`#lastValue` / `#lastParser` / `#initialized`** — caching state used only to decide when to re-parse
4. **`#onUpdated()` value/parser change detection** — exists only to trigger re-parse

This violates single-responsibility: Lifecycle should manage mount/unmount/re-render, not decide parsing strategies.

## Approach

**Minimal extraction (Approach B)**: Create a new `ParseFeature` class that takes over all parser orchestration from Lifecycle. SystemListenerFeature and `store.computed.parser` remain unchanged.

## Design

### New: `ParseFeature`

**File**: `packages/core/src/features/parsing/ParseFeature.ts`

Owns the parse dispatch strategy — deciding *when* and *how* to re-parse tokens.

```typescript
export class ParseFeature {
    #scope?: () => void
    #initialized = false
    #lastValue: string | undefined
    #lastParser: Parser | undefined

    constructor(private store: Store) {}

    enable() {
        this.#scope = effectScope(() => {
            this.#subscribeParse()
        })
    }

    disable() {
        this.#scope?.()
        this.#scope = undefined
        this.#initialized = false
    }

    sync() {
        const {store} = this
        const inputValue = store.state.value.get() ?? store.state.defaultValue.get() ?? ''
        store.state.tokens.set(parseWithParser(store, inputValue))
        store.state.previousValue.set(inputValue)
        this.#lastValue = store.state.value.get()
        this.#lastParser = store.computed.parser.get()
        this.#initialized = true
    }

    hasChanged(): boolean {
        const value = this.store.state.value.get()
        const parser = this.store.computed.parser.get()
        if (this.#initialized && value === this.#lastValue && parser === this.#lastParser) return false
        this.#lastValue = value
        this.#lastParser = parser
        return true
    }

    #subscribeParse() {
        const {store} = this
        watch(store.event.parse, () => {
            if (store.state.recovery.get()) {
                const text = toString(store.state.tokens.get())
                store.state.tokens.set(parseWithParser(store, text))
                store.state.previousValue.set(text)
                return
            }
            store.state.tokens.set(store.nodes.focus.target ? getTokensByUI(store) : getTokensByValue(store))
        })
    }
}
```

### Modified: `Lifecycle`

After extraction, Lifecycle becomes a thin orchestrator:

- Constructor: permanent watches on `store.event.updated`, `store.event.afterTokensRendered`, `store.event.unmounted`
- `#onUpdated()`: calls `enable()` + `store.features.parse.sync()` on first mount; on updates, checks `store.features.parse.hasChanged()` and emits `store.event.parse()`
- `enable()` / `disable()`: manage features and scope lifetime
- `recoverFocus()`: emits `sync` and `recoverFocus` events

Removed: `syncParser()`, `#subscribeParse()`, `#lastValue`, `#lastParser`, `#initialized`, `parseWithParser`/`getTokensByUI`/`getTokensByValue` imports.

### Modified: `Store`

Add `parse: new ParseFeature(this)` to `store.features` and import `ParseFeature`.

### Unchanged

- `SystemListenerFeature` — keeps its `innerValue` watch and `parseWithParser` call
- `store.computed.parser` — stays in Store
- All parsing utilities in `features/parsing/utils/` — unchanged

## File changes

| File | Change |
|------|--------|
| `features/parsing/ParseFeature.ts` | **New** — extracted parse orchestration logic |
| `features/parsing/index.ts` | Export `ParseFeature` |
| `features/lifecycle/Lifecycle.ts` | Remove parse logic, delegate to `store.features.parse` |
| `features/store/Store.ts` | Add `parse` to `store.features` |

## Testing

- Existing tests pass unchanged (same behavior)
- New `ParseFeature.spec.ts` co-located next to `ParseFeature.ts`:
  - `sync()` sets tokens and previousValue from value/defaultValue
  - `sync()` updates `#lastValue`/`#lastParser`/`#initialized`
  - `hasChanged()` returns false when value and parser unchanged
  - `hasChanged()` returns true when value changes
  - `hasChanged()` returns true when parser changes (options updated)
  - `#subscribeParse` dispatches `parseWithParser` in recovery mode
  - `#subscribeParse` dispatches `getTokensByUI` when focus target exists
  - `#subscribeParse` dispatches `getTokensByValue` when no focus target
