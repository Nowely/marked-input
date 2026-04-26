# Mark Feature

Provides command-oriented mark runtime APIs for framework mark components.

## Components

- **MarkController**: Public class returned by React/Vue `useMark()`. It exposes read-only snapshots (`value`, `meta`, `slot`, `readOnly`) plus commands:
    - `update({value, meta, slot})` — serialize a mark patch through `store.value.replaceRange()`
    - `remove()` — delete the mark through `store.value.replaceRange()`
- **MarkInfo**: Structural/debug information returned by React/Vue `useMarkInfo()` (`address`, `depth`, `hasNestedMarks`, `key`).
- **MarkFeature**: Store feature that resolves mark slots. Mark mutation is handled by `MarkController` and the value pipeline.

## Usage

```typescript
import {MarkController} from '@markput/core'

const controller = MarkController.fromToken(store, markToken)
controller.update({value: 'new value'})
controller.remove()
```

Framework users usually call `useMark()` / `useMarkInfo()` instead of constructing controllers directly.
