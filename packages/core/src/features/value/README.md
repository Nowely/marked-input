# Value Feature

Owns accepted serialized editor value state and the raw-position edit pipeline.

## State

| Signal    | Purpose                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `current` | Accepted serialized editor value. Controlled mode updates it from `props.value`; uncontrolled edits update it directly. |

## Computed

| Computed           | Purpose                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `isControlledMode` | `props.value() !== undefined`; controlled edits propose to `onChange` and wait for prop echo before committing. |

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

## Internal flow

**Uncontrolled edit** (`props.value` is `undefined`):

1. `replaceRange` calls `#applyLocally`
2. `#applyLocally` calls `onChange`, `#accept`, schedules `caret.recovery`, fires `change`

**Controlled edit** (`props.value` is defined):

1. `replaceRange` calls `#proposeToParent`
2. `#proposeToParent` stashes `{value, recovery}` in `#pendingEcho` and calls `onChange`
3. Parent echoes updated `props.value` → `#onParentEcho` runs
4. If echo matches the proposed value, recovery is applied; otherwise discarded
5. `#accept` commits the echoed value; `change` fires

**Setup** (`onMounted`):

- `#initializeFromProps` accepts `props.value ?? props.defaultValue ?? ''` once
- `#subscribeToControlledValue` watches `props.value` for subsequent controlled echoes
