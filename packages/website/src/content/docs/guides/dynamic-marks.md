---
title: Dynamic Marks
description: Build interactive React marks with mark node commands.
keywords: [useMark, MarkNode, MarkputHandle, interactive marks, removable marks, dynamic marks]
---

Dynamic marks are custom components rendered for parsed mark tokens. Use `useMark()` inside a Mark component to read the live mark node and issue commands through the core value pipeline.

## Mark node API

```tsx
import {useMark} from '@markput/react'

function Mention() {
    const mark = useMark()

    return (
        <span>
            @{mark.value()}
            <button type="button" onClick={() => mark.remove()}>
                Remove
            </button>
        </span>
    )
}
```

`useMark()` returns the live `MarkNode`:

| Property or method | Purpose |
| ------------------ | ------- |
| `id` | Stable identity, assigned at birth and never reused. |
| `markup` | The markup this mark was parsed with. |
| `value()` | Current `__value__`. |
| `meta()` | Current `__meta__`. |
| `slot()` | Current `__slot__` text, joined from the live children. |
| `children()` | The mark's child nodes. |
| `range()` | `{start, end}` of the mark in the current value. |
| `update(patch)` | Serialize a patch and replace the mark. `false` when read-only or when the mark has left the value. |
| `remove()` | Delete the mark. `false` under the same conditions. |

The reads are calls, not properties: they are the node's own reactive fields, so calling one inside a reactive scope subscribes to it.

The node does not expose a DOM ref. React and Vue own structural DOM and register it privately with core through `store.tokens.control()` and `store.tokens.children(ownerId)`. Keyboard focus and caret placement are handled by `store.tokens`, which owns the selection.

## Updating Marks

```tsx
function EditableMention() {
    const mark = useMark()

    return (
        <button type="button" onClick={() => mark.update({value: 'updated'})}>
            @{mark.value()}
        </button>
    )
}
```

An omitted key leaves the field alone, a string sets it, and `null` clears it:

```tsx
mark.update({meta: 'user:1'})
mark.update({meta: null})
mark.update({slot: 'nested text'})
```

The patch shape is not an exported type — write the literal, or name it with
`Parameters<MarkNode['update']>[0]`:

```ts
{value?: string; meta?: string | null; slot?: string | null}
```

All commands go through the core write path. In controlled mode, Markput emits `onChange` and waits for the matching `value` prop echo before applying the new caret position.

## Read-Only Marks

Editor state is not on the mark node — read it from the store:

```tsx
import {useMark, useMarkput} from '@markput/react'

function RemovableMark() {
    const mark = useMark()
    const readOnly = useMarkput(s => s.props.readOnly)

    return (
        <button type="button" disabled={readOnly} onClick={() => mark.remove()}>
            {mark.value()}
        </button>
    )
}
```

## Editor API

The component ref exposes a `MarkputHandle` — what the props cannot express:

| Member | Purpose |
| ------ | ------- |
| `container` | The editor's container element, or `null` before mount. |
| `focus()` | Put the caret at the start of the first token. |

Everything else goes through the `value` prop. The parent already owns the string, and a second
imperative path would have to agree with it — so a toolbar builds the new value with `annotate()`
and hands it back:

```tsx
import {useRef, useState} from 'react'
import {annotate, MarkedInput} from '@markput/react'
import type {MarkputHandle} from '@markput/react'

const MARKUP = '@[__value__](__meta__)'

function Editor() {
    const api = useRef<MarkputHandle>(null)
    const [value, setValue] = useState('hello ')

    return (
        <>
            <MarkedInput ref={api} value={value} onChange={setValue} options={[{markup: MARKUP}]} />
            <button type="button" onClick={() => setValue(current => current + annotate(MARKUP, {value: 'alice'}))}>
                Mention
            </button>
        </>
    )
}
```

What a props write cannot place is the caret: appending a mention puts it at the end of the value,
not at the position the user left. The ref used to carry `insertMark`, `replaceText`,
`replaceRange`, `setValue`, `tx`, `select`/`caret`, `selection()`, `nodes()`, `find()` and
`changed`; they are withdrawn. Inside a mark, `useMark()` still gives the live node and its
write verbs.

## Nesting Info

Use `useMarkInfo()` for structural information. This keeps commands separate from debug/layout metadata.

```tsx
import {useMark, useMarkInfo} from '@markput/react'

function NestedAwareMark({children}: {children?: React.ReactNode}) {
    const mark = useMark()
    const info = useMarkInfo()

    return (
        <span data-depth={info.depth}>
            {info.hasNestedMarks ? children : mark.value()}
        </span>
    )
}
```

`useMarkInfo()` returns `depth` and `hasNestedMarks`.
