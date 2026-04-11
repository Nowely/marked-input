# Slots Feature

Resolver utilities that implement the component slot/customization system — allowing framework wrappers to override default HTML elements (`container`, `block`, `span`, `overlay`, `mark`) with custom components.

## Resolver Functions

- **resolveSlot**: Resolves a named slot to its component (defaulting to `'div'` or `'span'`)
- **resolveSlotProps**: Resolves named slot props with data-attribute conversion
- **resolveMarkSlot**: Resolves the mark component for a given token (text → Span, mark → option's Mark or global Mark)
- **resolveOverlaySlot**: Resolves the overlay component from option/global/default
- **resolveOptionSlot**: Resolves slot prop configs that can be either an object or a function `(baseProps) => props`

## Usage

Slot derivations live on `store.computed` as `Computed<T>` values:

```typescript
// Named slots (parameterless) — return [Component, props] tuples directly
const [Container, containerProps] = store.computed.container.use()
const [Block, blockProps] = store.computed.block.use()
const [Span, spanProps] = store.computed.span.use()

// Parameterized slots — .use() returns a resolver function, call it with the argument
const resolveMarkSlot = store.computed.mark.use()
const [Component, props] = resolveMarkSlot(token)

const resolveOverlay = store.computed.overlay.use()
const [Overlay, overlayProps] = resolveOverlay(option, defaultComponent)
```

Consumed by framework wrappers (React/Vue) to render customizable components.
