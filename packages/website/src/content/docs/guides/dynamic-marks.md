---
title: Dynamic Marks
description: Build interactive React marks with MarkController commands.
keywords: [useMark, MarkController, interactive marks, removable marks, dynamic marks]
---

Dynamic marks are custom components rendered for parsed mark tokens. Use `useMark()` inside a Mark component to read the current mark snapshot and issue commands through the core value pipeline.

## Controller API

```tsx
import {useMark} from '@markput/react'

function Mention() {
    const mark = useMark()

    return (
        <span>
            @{mark.value}
            <button type="button" onClick={() => mark.remove()}>
                Remove
            </button>
        </span>
    )
}
```

`useMark()` returns a `MarkController`:

| Property or method | Purpose |
| ------------------ | ------- |
| `value` | Current `__value__` snapshot. |
| `meta` | Current `__meta__` snapshot. |
| `slot` | Current `__slot__` raw content snapshot. |
| `readOnly` | Whether the editor is read-only for this snapshot. |
| `update(patch)` | Serialize a patch and replace the mark raw range. |
| `remove()` | Delete the mark raw range. |

The controller does not expose a DOM ref. React and Vue own structural DOM and register it privately with core. Keyboard focus and caret recovery are handled by `store.dom` and `store.caret`.

## Updating Marks

```tsx
function EditableMention() {
    const mark = useMark()

    return (
        <button type="button" onClick={() => mark.update({value: 'updated'})}>
            @{mark.value}
        </button>
    )
}
```

Optional fields use explicit set/clear patches:

```tsx
mark.update({meta: {kind: 'set', value: 'user:1'}})
mark.update({meta: {kind: 'clear'}})
mark.update({slot: {kind: 'set', value: 'nested text'}})
```

All commands go through `store.value.replaceRange()`. In controlled mode, Markput emits `onChange` and waits for the matching `value` prop echo before applying recovery.

## Read-Only Marks

```tsx
function RemovableMark() {
    const mark = useMark()

    return (
        <button type="button" disabled={mark.readOnly} onClick={() => mark.remove()}>
            {mark.value}
        </button>
    )
}
```

`remove()` and `update()` return an edit result. A read-only editor returns `{ok: false, reason: 'readOnly'}`.

## Nesting Info

Use `useMarkInfo()` for structural information. This keeps commands separate from debug/layout metadata.

```tsx
import {useMark, useMarkInfo} from '@markput/react'

function NestedAwareMark({children}: {children?: React.ReactNode}) {
    const mark = useMark()
    const info = useMarkInfo()

    return (
        <span data-depth={info.depth} data-key={info.key}>
            {info.hasNestedMarks ? children : mark.value}
        </span>
    )
}
```

`useMarkInfo()` returns `address`, `depth`, `hasNestedMarks`, and `key`.
