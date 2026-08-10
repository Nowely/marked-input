---
title: Dynamic Marks
description: Build interactive React marks with mark node commands.
keywords: [useMark, MarkNode, MarkputApi, interactive marks, removable marks, dynamic marks]
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

The node does not expose a DOM ref. React and Vue own structural DOM and register it privately with core through `store.tokens.control()` and `store.tokens.children(ownerId)`. Keyboard focus and caret placement are handled by `store.tokens` and `store.selection`.

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

The component ref exposes a `MarkputApi` — the whole editor, addressed by nodes rather than
by global offsets:

```tsx
import {useRef} from 'react'
import {MarkedInput} from '@markput/react'
import type {MarkputApi} from '@markput/react'

function Editor() {
    const api = useRef<MarkputApi>(null)

    return (
        <>
            <MarkedInput ref={api} defaultValue="hello" options={[{markup: '@[__value__](__meta__)'}]} />
            {/*
              `onMouseDown` + preventDefault is required, not optional: the editor clears its
              stored selection on blur, so a toolbar button that takes focus makes
              `insertMark('caret')` reject every time.
            */}
            <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => api.current?.insertMark('caret', {markup: '@[__value__](__meta__)', value: 'alice'})}
            >
                Mention
            </button>
        </>
    )
}
```

| Member | Purpose |
| ------ | ------- |
| `container` | The editor's container element, or `null` before mount. |
| `value()` | The current annotated value. |
| `nodes()` | The live root nodes. Reactive. |
| `find(id)` | Resolve a stable id to its live node. |
| `insertMark(at, init)` | Insert a mark at a node anchor or at `'caret'`. Returns the new node, or `undefined` in controlled mode. |
| `replaceText(target, text)` | Replace a range inside one text node. |
| `replaceRange(from, to, text)` | Replace a range spanning nodes. |
| `setValue(text)` | Replace the whole value. `setValue('')` clears it. |
| `tx(fn)` | Compose several verbs into one commit; overlapping ops reject the whole transaction. |
| `focus()` | Focus the first token. |
| `selection()` | The stored `{anchor, head}` node anchors. Reactive. |
| `select(anchor, head?)` / `caret(at)` | Move the selection. `false` for an anchor whose node has left the value. |
| `changed` | Fires once per commit with `{added, removed, updated}` ids. Subscribe with `watch(api.changed, fn)`. |

A node anchor is `{node, offset}` for a text node, `{before: node}` / `{after: node}` for a
boundary, or `'start'` / `'end'` for the document edges.

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
