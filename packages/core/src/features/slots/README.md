# Slots Feature

Resolver utilities that implement the component slot/customization system — allowing framework wrappers to override default HTML elements (`container`, `block`, `overlay`, `mark`) with custom components.

## Resolver Functions

- **resolveSlot**: Resolves a named slot to its component (defaulting to `'div'` or `'span'`)
- **resolveSlotProps**: Resolves named slot props with data-attribute conversion
- **resolveMarkSlot**: Resolves the mark component for a given token (text → Span, mark → option's Mark or global Mark)
- **resolveOverlaySlot**: Resolves the overlay component from option/global/default (internal; `OverlayController` imports it directly from `resolveSlot.ts`)

## Usage

Named slot computeds live on `store.slots` as separate `component` and `props` values:

```typescript
// Named slots — component and fully-resolved props are separate computeds
const Component = store.slots.containerComponent()
const props = store.slots.containerProps()
// props includes className, style (with drag paddingLeft when drag is enabled),
// and data-* slotProps

const BlockComponent = store.slots.blockComponent()
const blockProps = store.slots.blockProps() // raw slotProps only

// Mark resolver — call() returns a resolver function, call it with the token
const resolveMark = store.slots.mark()
const [MarkComponent, markProps] = resolveMark(token)

// Overlay resolver — same shape, takes an option and a default
const resolveOverlay = store.overlay.slot()
const [Overlay, overlayProps] = resolveOverlay(option, defaultComponent)
```

Consumed by framework wrappers (React/Vue) to render customizable components.
