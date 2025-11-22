---
title: Components API
description: Complete API reference for MarkedInput and related components
version: 1.0.0
---

## MarkedInput

The main component for creating annotated text editors.

### Props

```tsx
interface MarkedInputProps<TMarkProps = any, TOverlayProps = any> {
  // Required
  value: string
  onChange: (value: string) => void
  Mark: ComponentType<TMarkProps>

  // Optional
  Overlay?: ComponentType<TOverlayProps>
  options?: Option<TMarkProps, TOverlayProps>[]
  defaultValue?: string
  readOnly?: boolean
  slots?: Slots
  slotProps?: SlotProps

  // Container props (passed through)
  className?: string
  style?: CSSProperties
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
  // ... other HTML attributes
}
```

### Required Props

#### value
**Type:** `string`
The current editor content containing the mark syntax.

#### onChange
**Type:** `(value: string) => void`
Callback fired when the editor content changes.

#### Mark
**Type:** `ComponentType<TMarkProps>`
Component used to render the annotations. Receives props derived from the parsed token (typically `value` and `meta`).

### Optional Props

#### Overlay
**Type:** `ComponentType<TOverlayProps>`
Global overlay component for suggestions. Defaults to the built-in `Suggestions` component.

#### options
**Type:** `Option<TMarkProps, TOverlayProps>[]`
Configuration for different mark patterns (markup syntax, specific slot props, triggers).

#### readOnly
**Type:** `boolean`
**Default:** `false`
Disables editing. Marks can access this state via `useMark()`.

#### slots
**Type:** `Slots`
Allows replacing internal components:
- `container`: The wrapper `div`.
- `span`: The text node wrapper.

#### slotProps
**Type:** `SlotProps`
Passes props to internal components (`container`, `span`, `mark`, `overlay`).

### HTML Attributes
All standard HTML attributes for `contenteditable` elements (like `className`, `style`, `placeholder`, `onFocus`, `onKeyDown`) are supported and passed to the container.

## createMarkedInput

Factory function for creating pre-configured `MarkedInput` components. Useful for reusing configuration across the application.

```tsx
const MentionEditor = createMarkedInput({
  Mark: MentionMark,
  options: [/* ... */]
})

// Usage
<MentionEditor value={value} onChange={setValue} />
```

## Suggestions

Built-in overlay component for displaying suggestions. Automatically used when `slotProps.overlay` is provided in `options`.

### Props

```tsx
interface SuggestionsProps {
  trigger: string
  data: string[] | SuggestionItem[]
  onSelect?: (item: string | SuggestionItem) => void
  maxItems?: number
  filterFn?: (item: any, query: string) => boolean
  renderItem?: (item: any, index: number) => ReactNode
}
```

### Usage

Configure via `options`:

```tsx
options={[
  {
    markup: '@[__value__]',
    slotProps: {
      overlay: {
        trigger: '@',
        data: ['Alice', 'Bob'],
        // Custom render
        renderItem: (user) => <div>{user.name}</div>
      }
    }
  }
]}
```

## Type Parameters

Both `MarkedInput` and `createMarkedInput` accept generic type parameters for `MarkProps` and `OverlayProps` to ensure type safety.

```tsx
<MarkedInput<MyMarkProps, MyOverlayProps> ... />
```
