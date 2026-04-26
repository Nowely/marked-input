---
title: RFC Nested Marks
description: Historical nested-mark design notes and current implementation status.
---

This RFC is historical. Nested marks now use the core editor engine primitives implemented in `@markput/core`:

- `__slot__` descriptors parse nested token trees.
- `ParsingFeature` owns token paths, token addresses, and parse generations.
- React and Vue render adapter-owned token shells and slot roots.
- `DomFeature` registers those structures and maps DOM selections to raw value ranges.
- `useMark()` returns a `MarkController` for commands.
- `useMarkInfo()` returns structural metadata (`address`, `depth`, `hasNestedMarks`, `key`).

Current authoring pattern:

```tsx
import {useMark, useMarkInfo} from '@markput/react'

function NestedMark({children}: {children?: React.ReactNode}) {
    const mark = useMark()
    const info = useMarkInfo()

    return (
        <span data-depth={info.depth}>
            {info.hasNestedMarks ? children : mark.slot ?? mark.value}
        </span>
    )
}
```

Parent/child traversal is intentionally not part of the public mark command API. Use token addresses for core internals and `useMarkInfo()` for component-level metadata.
