# Design: ValueFeature Clarity Refactor

**Date:** 2026-05-06
**Scope:** `packages/core/src/features/value/`

## Problem

`ValueFeature` has three clarity problems:

1. **`ControlledEcho` is a separate class for one field and two methods.** Nothing about the name explains what it does. It looks caret-related but is really a commit-confirmation protocol inside the value pipeline.
2. **The constructor mixes two unrelated concerns** — initial value resolution and controlled-value subscription — without naming either.
3. **Vocabulary is inconsistent.** `commit`, `candidate`, `accepted`, `echo`, `pending` are all used, and each means something slightly different. A reader has to trace the whole file before the terminology makes sense.

## Goal

Make `ValueFeature` readable top-to-bottom without needing to understand `ControlledEcho` internals or trace the controlled/uncontrolled fork. No behavior changes.

## Out of Scope

- Adding `{immediate: true}` to `watch()` — initialization stays explicit.
- Strategy-class split (option 3a) — not justified at current size.
- Any changes to `store.caret`, `store.parsing`, `store.props`, or public `ValueFeature` API.

## Design

### Delete `ControlledEcho`

Inline `ControlledEcho` as a single private field on `ValueFeature`:

```ts
#pendingEcho: {value: string; recovery: CaretRecovery | undefined} | undefined
```

`ControlledEcho.ts` is deleted. The echo-match logic moves into `#onParentEcho()`.

### Rename the vocabulary to three verbs

| Old | New | Meaning |
|---|---|---|
| `#commitAccepted` | `#accept` | Parse value and set `current` synchronously. Always succeeds. |
| controlled branch of `#commitCandidate` | `#proposeToParent` | Send candidate to `onChange`; stash pending echo. Never updates `current`. |
| uncontrolled branch of `#commitCandidate` | `#applyLocally` | Send to `onChange`, `#accept`, schedule caret recovery, fire `change` event. |
| `ControlledEcho.setPending` | `this.#pendingEcho = {…}` | Inlined into `#proposeToParent`. |
| `ControlledEcho.onEcho` | `#onParentEcho` | Match echo to pending; apply recovery only on exact match. |
| `#commitCandidate` | removed | Was a fork; replaced by explicit call site in `replaceRange`. |

### Split the constructor into named steps

```ts
constructor(store: Store) {
  store.lifecycle.onMounted(() => {
    this.#initializeFromProps()
    this.#subscribeToControlledValue()
  })
}
```

`#initializeFromProps` reads `props.value ?? props.defaultValue ?? ''` once.
`#subscribeToControlledValue` sets up the `watch` for subsequent controlled updates.

These two methods explain *why* they are separate: different sources, different lifecycles.

### Final shape of `ValueFeature`

```ts
export class ValueFeature {
  readonly current = signal('')
  readonly change = event()
  readonly isControlledMode = computed(() => ...)

  #pendingEcho: {value: string; recovery: CaretRecovery | undefined} | undefined

  constructor(store)          // onMounted → init + subscribe

  replaceRange(range, replacement, options)   // public
  replaceAll(next, options)                   // public

  #proposeToParent(next, recovery)  // controlled path
  #onParentEcho(value)              // controlled: handle echo from parent
  #applyLocally(next, recovery)     // uncontrolled path
  #accept(value)                    // shared: parse + set current
  #initializeFromProps()            // setup: pick initial value
  #subscribeToControlledValue()     // setup: watch props.value
}
```

File length stays ≈60 lines. `ControlledEcho.ts` is deleted entirely.

## Behavior Preserved

All existing tests pass unchanged. The echo-match rule is identical:
- pending recovery is applied only when `echo === proposed candidate`
- on mismatch or no pending, recovery is discarded
- `change` event fires on both accepted uncontrolled edits and accepted controlled echoes
- `readOnly` blocks `replaceRange`/`replaceAll` but not controlled prop updates

## Files Changed

| File | Change |
|---|---|
| `packages/core/src/features/value/ValueFeature.ts` | Rewrite with new vocabulary and structure |
| `packages/core/src/features/value/ControlledEcho.ts` | Delete |
| `packages/core/src/features/value/index.ts` | No change |
| `packages/core/src/features/value/ValueFeature.spec.ts` | No change (public API unchanged) |
| `packages/core/src/features/value/README.md` | Update method name table; remove narrative reference to `ControlledEcho` |
