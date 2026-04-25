# Value Feature

Owns accepted serialized editor value state and the raw-position edit pipeline.

## State

| Signal    | Purpose                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `current` | Accepted serialized editor value. Controlled mode updates it from `props.value`; uncontrolled edits update it directly. |

## Computed

| Computed           | Purpose                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `isControlledMode` | `props.value() !== undefined`; controlled edits emit `onChange` and wait for prop echo before committing. |

## Commands

| Command          | Purpose                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `replaceRange()` | Replace a raw serialized range and optionally schedule caret/selection recovery.           |
| `replaceAll()`   | Replace the whole serialized value through the same controlled/uncontrolled edit pipeline. |

Drag, clipboard, overlay selection, block editing, inline input, and mark commands all use these commands instead of mutating tokens directly.

## Events

| Event    | Fired by                                             | Listened by                                      |
| -------- | ---------------------------------------------------- | ------------------------------------------------ |
| `change` | Accepted immediate edits and controlled prop echoes. | Overlay trigger probing and framework observers. |

## Effects (`enable()`)

- On enable, initialize `current` from `props.value`, `props.defaultValue`, or `''`, then parse tokens from that value.
- Watch `props.value` and accept controlled prop echoes through `ControlledEcho`.
- Controlled edits emit `onChange` and wait for the matching prop echo before accepting recovery.
- Uncontrolled edits parse and commit immediately, then schedule `caret.recovery`.
