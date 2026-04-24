# Value Feature

Owns accepted serialized editor value state and its primary mutation event.

## State

| Signal    | Purpose                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `current` | Accepted serialized editor value. Controlled mode updates it from `props.value`; uncontrolled edits update it directly. |
| `next`    | Internal full-value edit command used by drag, clipboard, overlay, mark removal, and block editing.                     |

## Computed

| Computed           | Purpose                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `isControlledMode` | `props.value() !== undefined`; controlled edits emit `onChange` and wait for prop echo before committing. |

## Events

| Event    | Fired by                                                            | Listened by                                                                                   |
| -------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `change` | `KeyboardFeature` internals, `MarkHandler` (token mutation changed) | `ValueFeature` itself (serializes candidate tokens, commits or restores accepted value state) |

Full-value edits from drag, clipboard, overlay selection, block editing, and mark removal write `next` instead of mutating accepted value state directly.

## Effects (`enable()`)

- On enable, initialize `current` from `props.value`, `props.defaultValue`, or `''`, then parse tokens from that value.
- Watch `props.value` → accept controlled prop echoes by parsing the new value and updating `current`.
- Watch `next` → controlled mode emits `onChange` only; uncontrolled mode parses and commits the value before emitting `onChange`.
- Watch `change` → serialize candidate tokens. Controlled mode emits `onChange` and restores tokens from `current`; uncontrolled mode accepts the candidate and reparses.
