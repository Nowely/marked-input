# Parser as Computed — Lifecycle Simplification

## Problem

`Lifecycle.#maybeSyncParser()` manually reimplements signal change detection: it reads 3 signals (`value`, `Mark`, `options`), caches them in private fields, and compares on every `store.on.updated` event. This duplicates what the signal system already provides.

Additionally, parser creation is imperative (inside `syncParser()`), even though the parser is a pure derivation of `Mark`, `options`, and `drag`. There's also a latent bug: changing `drag` doesn't rebuild the parser until the next `on.updated` event.

## Solution

Move `parser` from a `Signal` (manually set by Lifecycle) to a `Computed` (auto-derived from Mark, options, drag). This eliminates manual parser creation and reduces the change-detection burden in Lifecycle.

## Changes

### Store.ts

**Move `parser` from `StoreState` to `StoreComputed`:**

- Remove `parser: signal<Parser | undefined>(undefined)` from `StoreState`
- Add `parser: computed(...)` to `StoreComputed`
- The computed encapsulates the `#getEffectiveOptions()` logic (moved from Lifecycle)
- Dependencies: `Mark`, `options`, `drag`

### Lifecycle.ts

**Remove:**

- `#maybeSyncParser()` method
- `#lastSyncValue`, `#lastSyncMark`, `#lastSyncOptions` fields (3 fields)
- `#getEffectiveOptions()` method

**Replace with:**

- `#lastValue: string | undefined` — tracks value changes
- `#lastParser: Parser | undefined` — tracks parser recomputation

**Simplified `#onUpdated()`:**

1. First call: `enable()` + `syncParser()` (initial parse)
2. Subsequent calls: compare value + parser, emit parse if either changed

**Simplified `syncParser()`:**

- Only handles first-time initialization (parse value into tokens)
- No longer creates parser — computed handles it
- Sets `#lastValue` and `#lastParser` for change tracking

### Type impact

`StoreState.parser` type changes from `Signal<Parser | undefined>` to `Computed<Parser | undefined>`. All consumers use `.get()` — no behavioral change in:

- `InputFeature.ts` (line 269)
- `valueParser.ts` (lines 7, 81)

### Tests

`Lifecycle.spec.ts` requires updates:

- Tests that spy on `syncParser` after `on.updated` need adjustment (watch fires on signal change, not event)
- Tests checking `parser.get()` after `syncParser()` remain valid (parser is computed, always returns latest)
- Init/remount tests remain valid
