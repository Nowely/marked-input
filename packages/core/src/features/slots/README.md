# Slots Feature

Implements the component slot/customization system that allows framework wrappers to override default HTML elements (container, block, span, overlay, mark) with custom components.

## Components

- **createSlots**: Factory function that creates slot objects for `container`, `block`, `span`, `overlay`, and `mark`. Each slot has `use()` (reactive) and `get()` (non-reactive) methods returning `[Component, props]` tuples
- **resolveSlot**: Resolves a named slot to its component (defaulting to `'div'` or `'span'`)
- **resolveSlotProps**: Resolves named slot props with data-attribute conversion
- **resolveMarkSlot**: Resolves the mark component for a given token (text → Span, mark → option's Mark or global Mark)
- **resolveOverlaySlot**: Resolves the overlay component from option/global/default
- **resolveOptionSlot**: Resolves slot prop configs that can be either an object or a function `(baseProps) => props`

## Usage

```typescript
import {createSlots} from '@markput/core'

const slots = createSlots(options, store)
const [Container, containerProps] = slots.container.use()
```

Slots are created by the Store and consumed by framework wrappers (React/Vue) to render customizable components.
