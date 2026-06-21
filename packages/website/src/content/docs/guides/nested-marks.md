---
title: Nested Marks
description: Render marks that contain other marks through __slot__ and useMarkInfo.
keywords: [nested marks, __slot__, useMarkInfo, token tree]
---

Use `__slot__` when a mark should contain parsed child tokens.

```tsx
const options = [{markup: '**__slot__**'}]
```

A slot mark receives rendered child tokens as `children`. Render those children to preserve nested content.

```tsx
function Bold({children}: {children?: React.ReactNode}) {
    return <strong>{children}</strong>
}
```

## Structural Info

Use `useMarkInfo()` for nesting metadata:

```tsx
import {useMark, useMarkInfo} from '@markput/react'

function TreeMark({children}: {children?: React.ReactNode}) {
    const mark = useMark()
    const info = useMarkInfo()

    return (
        <span data-depth={info.depth}>
            {info.hasNestedMarks ? children : mark.slot ?? mark.value}
        </span>
    )
}
```

| Property | Purpose |
| -------- | ------- |
| `depth` | Nesting depth, where top-level marks are `0`. |
| `hasNestedMarks` | Whether any child token is a mark. |

Parent and child traversal is intentionally not exposed through `useMark()`. Core owns token addresses and validates them through the token index.

## Opaque Children

React and Vue wrap nested slot content in an internal child-sequence host. Custom Mark components should treat `children` as opaque rendered content and render it exactly once.

```tsx
function Highlight({children}: {children?: React.ReactNode}) {
    return <mark>{children}</mark>
}
```

Marks can render controls, icons, or layout elements around children:

```tsx
function TodoItem({children}: {children?: React.ReactNode}) {
    return (
        <label>
            <input type="checkbox" />
            {children}
        </label>
    )
}
```

Do not inspect DOM child order to infer token identity. Use `useMarkInfo()` for structure and `useMark()` for commands.

## Missing Children

If a Mark component ignores `children`, nested content is not rendered. This is valid for value-only marks, but slot marks should render children or explicitly provide a fallback.

```tsx
function SlotMark({children}: {children?: React.ReactNode}) {
    const mark = useMark()
    const info = useMarkInfo()

    return <span>{info.hasNestedMarks ? children : mark.slot}</span>
}
```
