# Value Feature

Owns the editable-value buffer and its primary mutation event.

## State

| Signal          | Purpose                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `previousValue` | Last serialized value pushed to `onChange`. Used to suppress redundant emissions and to seed the next parse.                                            |
| `innerValue`    | Intermediate value used by uncontrolled flows (drag reorder, clipboard cut, mark remove). Written by many features; watched by this feature to reparse. |

## Computed

| Value          | Formula                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `currentValue` | `previousValue() ?? props.value() ?? ''` — the editable string view used by paste, block edit, copy/cut. |

## Events

| Event    | Fired by                                                                                           | Listened by                                                                |
| -------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `change` | `KeyboardFeature` internals, `MarkHandler`, `deleteMark` (multi-emitter, semantic "value mutated") | `ValueFeature` itself (reads DOM, writes `previousValue`, fires `reparse`) |

## Effects (`enable()`)

- Watch `emit.change` → read `nodes.focus.target`, tokenize focused span, write `previousValue`, emit `reparse`.
- Watch `state.innerValue` → reparse via `parseWithParser`, write `tokens` + `previousValue`.

Both handlers were moved here from `SystemListenerFeature`.
