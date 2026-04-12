# Slots Feature

Resolver utilities that implement the component slot/customization system — allowing framework wrappers to override default HTML elements (`container`, `block`, `span`, `overlay`, `mark`) with custom components.

## Resolver Functions

- **resolveSlot**: Resolves a named slot to its component (defaulting to `'div'` or `'span'`)
- **resolveSlotProps**: Resolves named slot props with data-attribute conversion
- **resolveMarkSlot**: Resolves the mark component for a given token (text → Span, mark → option's Mark or global Mark)
- **resolveOverlaySlot**: Resolves the overlay component from option/global/default
- **resolveOptionSlot**: Resolves slot prop configs that can be either an object or a function `(baseProps) => props`

## Usage

Named slot computeds live on `store.computed` as separate `component` and `props` values:

```typescript
// Named slots — component and fully-resolved props are separate computeds
const Component = store.computed.containerComponent()
const props = store.computed.containerProps()
// props includes className, style (with drag paddingLeft), and data-* slotProps

const BlockComponent = store.computed.blockComponent()
const blockProps = store.computed.blockProps() // raw slotProps only

const SpanComponent = store.computed.spanComponent()
const spanProps = store.computed.spanProps() // raw slotProps only

// Parameterized slots — call() returns a resolver function, call it with the argument
const resolveMarkSlot = store.computed.mark()
const [MarkComponent, markProps] = resolveMarkSlot(token)

const resolveOverlay = store.computed.overlay()
const [Overlay, overlayProps] = resolveOverlay(option, defaultComponent)
```

Consumed by framework wrappers (React/Vue) to render customizable components.
