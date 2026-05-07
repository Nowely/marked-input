# Value Feature

Owns accepted serialized editor value state and the raw-position edit pipeline.

## State

| Signal    | Purpose                                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| `current` | Accepted serialized editor value. Controlled mode reads it from `props.value`; uncontrolled edits update it directly. |

## Computed

| Computed           | Purpose                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `isControlledMode` | `props.value() !== undefined`; controlled edits call `onChange` and wait for prop echo before `current` reflects the new value. |

## Commands

| Command          | Purpose                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `replace()`      | Replace a raw serialized range with bounds validation. Callers that want a specific post-edit caret write `store.caret.range({start, end})` in the same handler. |

Drag, clipboard, overlay, block editing, inline input, and mark commands use
`replace()` or write `current()` directly instead of mutating tokens
directly.

## Internal flow

**Uncontrolled edit** (`props.value` is `undefined`):

1. `replace()` validates the range and computes the next value
2. `current(next)` updates the internal field, calls `props.onChange`, and notifies subscribers (e.g. `ParsingFeature`)

**Controlled edit** (`props.value` is defined):

1. `replace()` validates the range and computes the next value
2. `current(next)` calls `props.onChange` only — the internal field is not written
3. The parent echoes updated `props.value`, which makes `current` reflect the new value on the next read

There is no separate `change` event; downstream consumers subscribe to `value.current` directly. `ParsingFeature` registers its `value.current` watcher first inside `onMounted`, so any other watcher observes a fresh `parsing.tokens()` when it reads.
