---
title: Types API
description: Complete TypeScript type reference for Markput
version: 1.0.0
---

This page documents all TypeScript types and interfaces exported by Markput.

## Component Props

### MarkedInputProps

Props for the main `<MarkedInput>` component.

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

  // HTML attributes (passed to container)
  className?: string
  style?: CSSProperties
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
  id?: string
  name?: string
  tabIndex?: number
  'aria-label'?: string
  'aria-describedby'?: string
  onFocus?: FocusEventHandler
  onBlur?: FocusEventHandler
  onKeyDown?: KeyboardEventHandler
  onKeyUp?: KeyboardEventHandler
  onKeyPress?: KeyboardEventHandler
  onPaste?: ClipboardEventHandler
  onCopy?: ClipboardEventHandler
  onCut?: ClipboardEventHandler
}
```

**Type Parameters:**
- `TMarkProps` - Type of props passed to Mark components
- `TOverlayProps` - Type of props passed to Overlay components

**Usage:**

```tsx
// Typed component
const Editor: FC = () => {
  const [value, setValue] = useState('')

  const props: MarkedInputProps<MentionProps, OverlayProps> = {
    value,
    onChange: setValue,
    Mark: MentionMark,
    options: mentionOptions
  }

  return <MarkedInput {...props} />
}
```

### MarkProps

Default props passed to Mark components via `slotProps.mark`.

```tsx
interface MarkProps {
  /** Main content value of the mark */
  value?: string
  /** Additional metadata for the mark */
  meta?: string
  /** Nested content as string (raw, unparsed) */
  nested?: string
  /** Rendered children content (ReactNode) for nested marks */
  children?: ReactNode
}
```

**Usage:**

```tsx
// Using default MarkProps
const SimpleMark: FC<MarkProps> = ({ value }) => (
  <span>{value}</span>
)

// Extending MarkProps
interface CustomMarkProps extends MarkProps {
  color: string
  onClick: () => void
}

const CustomMark: FC<CustomMarkProps> = ({ value, color, onClick }) => (
  <button style={{ color }} onClick={onClick}>
    {value}
  </button>
)
```

**When to extend:**
- When you need additional props beyond value/meta/nested
- When transforming mark data via `slotProps.mark` function

```tsx
slotProps: {
  mark: ({ value, meta }: MarkProps): CustomMarkProps => ({
    value,
    color: meta === 'important' ? 'red' : 'black',
    onClick: () => handleClick(value)
  })
}
```

### OverlayProps

Default props for Overlay components via `slotProps.overlay`.

```tsx
interface OverlayProps {
  /** Trigger character(s) that activate the overlay */
  trigger?: string
  /** Data array for suggestions/autocomplete */
  data?: string[]
}
```

**Usage:**

```tsx
// Simple overlay with data
options={[
  {
    markup: '@[__value__]',
    slotProps: {
      overlay: {
        trigger: '@',
        data: ['alice', 'bob', 'charlie']
      }
    }
  }
]}

// Custom overlay props
interface CustomOverlayProps extends OverlayProps {
  onSelect: (item: string) => void
  maxResults?: number
}
```

## Configuration Types

### Option

Configuration object for defining mark behavior.

```tsx
interface Option<TMarkProps = MarkProps, TOverlayProps = OverlayProps>
  extends CoreOption {
  /**
   * Per-option slot components.
   */
  slots?: {
    /** Mark component for this option. */
    mark?: ComponentType<TMarkProps>
    /** Overlay component for this option. */
    overlay?: ComponentType<TOverlayProps>
  }

  /**
   * Props for slot components.
   */
  slotProps?: {
    /**
     * Props for the mark component.
     * Can be a static object or a function that transforms MarkProps.
     */
    mark?: TMarkProps | ((props: MarkProps) => TMarkProps)
    /**
     * Props for the overlay component.
     */
    overlay?: TOverlayProps
  }
}
```

**From CoreOption (inherited):**

```tsx
interface CoreOption {
  /** Markup pattern (e.g., "@[__value__](__meta__)") */
  markup: Markup
}
```

**Type Parameters:**
- `TMarkProps` - Type of props for the mark component
- `TOverlayProps` - Type of props for the overlay component

**Usage:**

```tsx
import type { Option } from 'rc-marked-input'

interface MentionProps {
  username: string
  userId: string
}

const mentionOption: Option<MentionProps> = {
  markup: '@[__value__](__meta__)',
  slots: {
    mark: MentionMark
  },
  slotProps: {
    mark: ({ value, meta }) => ({
      username: value || '',
      userId: meta || ''
    }),
    overlay: {
      trigger: '@',
      data: users
    }
  }
}
```

### Slots

Components to replace MarkedInput's internal components.

```tsx
interface Slots {
  /** Root container component */
  container?: ElementType<HTMLAttributes<HTMLDivElement>>
  /** Text span component for rendering text tokens */
  span?: ElementType<HTMLAttributes<HTMLSpanElement>>
}
```

**Usage:**

```tsx
import { forwardRef } from 'react'

const CustomContainer = forwardRef<HTMLDivElement>((props, ref) => (
  <div {...props} ref={ref} className="custom-editor" />
))

<MarkedInput
  Mark={MyMark}
  slots={{
    container: CustomContainer,
    span: 'span' // Can use HTML elements
  }}
/>
```

### SlotProps

Props to pass to slot components.

```tsx
interface SlotProps {
  /** Props to pass to the container slot */
  container?: HTMLAttributes<HTMLDivElement> & DataAttributes
  /** Props to pass to the span slot */
  span?: HTMLAttributes<HTMLSpanElement> & DataAttributes
}

type DataAttributes = Record<
  `data${Capitalize<string>}`,
  string | number | boolean | undefined
>
```

**Usage:**

```tsx
<MarkedInput
  Mark={MyMark}
  slotProps={{
    container: {
      className: 'editor',
      'data-testid': 'editor-container',
      onKeyDown: (e) => console.log(e.key)
    },
    span: {
      className: 'text-node',
      'data-type': 'text'
    }
  }}
/>
```

## Token Types

Types representing parsed text structure.

### Token

Union type for all token types.

```tsx
type Token = TextToken | MarkToken
```

### TextToken

Represents plain text.

```tsx
interface TextToken {
  type: 'text'
  content: string
  position: {
    start: number
    end: number
  }
}
```

**Example:**

```tsx
const textToken: TextToken = {
  type: 'text',
  content: 'Hello ',
  position: { start: 0, end: 6 }
}
```

### MarkToken

Represents a mark (annotated text).

```tsx
interface MarkToken {
  type: 'mark'
  content: string
  position: {
    start: number
    end: number
  }
  descriptor: MarkupDescriptor
  value: string
  meta?: string
  nested?: {
    content: string
    start: number
    end: number
  }
  children: Token[]
}
```

**Properties:**
- `content` - Original markup text (e.g., `"@[Alice](123)"`)
- `value` - Parsed value (e.g., `"Alice"`)
- `meta` - Parsed metadata (e.g., `"123"`)
- `nested` - Nested content range (only for `__nested__` marks)
- `children` - Parsed child tokens (for nested marks)
- `descriptor` - Markup pattern information

**Example:**

```tsx
const markToken: MarkToken = {
  type: 'mark',
  content: '@[Alice](123)',
  position: { start: 0, end: 13 },
  descriptor: { /* ... */ },
  value: 'Alice',
  meta: '123',
  children: []
}
```

**Nested mark example:**

```tsx
// Text: "**Hello @[Alice]**"
const nestedMarkToken: MarkToken = {
  type: 'mark',
  content: '**Hello @[Alice]**',
  position: { start: 0, end: 18 },
  descriptor: { /* ... */ },
  value: '', // No value for nested-only marks
  nested: {
    content: 'Hello @[Alice]',
    start: 2,
    end: 16
  },
  children: [
    { type: 'text', content: 'Hello ', position: { start: 2, end: 8 } },
    {
      type: 'mark',
      content: '@[Alice]',
      position: { start: 8, end: 16 },
      value: 'Alice',
      children: []
      // ...
    }
  ]
}
```

### PositionRange

Position range in text.

```tsx
interface PositionRange {
  start: number
  end: number
}
```

**Usage:**

```tsx
function getTextBetween(text: string, range: PositionRange): string {
  return text.substring(range.start, range.end)
}
```

## Markup Types

Types for markup patterns.

### Markup

Template literal type for valid markup patterns.

```tsx
type Markup =
  | `${ValueMarkup}`
  | `${ValueMarkup}${MetaMarkup}`
  | `${ValueMarkup}${MetaMarkup}${NestedMarkup}`
  | `${ValueMarkup}${NestedMarkup}`
  | `${NestedMarkup}`
  | `${NestedMarkup}${MetaMarkup}`
  // ... other valid combinations

type ValueMarkup = `${string}__value__${string}`
type MetaMarkup = `${string}__meta__${string}`
type NestedMarkup = `${string}__nested__${string}`
```

**Valid markup patterns:**

```tsx
// ✅ Valid
const m1: Markup = '@[__value__]'
const m2: Markup = '@[__value__](__meta__)'
const m3: Markup = '**__nested__**'
const m4: Markup = '<__value__>__nested__</__value__>'
const m5: Markup = '#[__value__](__meta__)__nested__'

// ❌ Invalid (TypeScript error)
const m6: Markup = 'no placeholders' // Error
const m7: Markup = '@[value]' // Error: must use __value__
```

**Usage:**

```tsx
function validateMarkup(markup: Markup): boolean {
  return markup.includes('__value__') ||
         markup.includes('__nested__')
}
```

### MarkupDescriptor

Internal descriptor for markup patterns (rarely used directly).

```tsx
interface MarkupDescriptor {
  index: number
  markup: Markup
  // Internal implementation details...
}
```

## Hook Return Types

### MarkHandler

Return type of `useMark()` hook.

```tsx
interface MarkHandler<T = HTMLElement> {
  // Data
  label: string
  value?: string
  meta?: string
  nested?: ReactNode

  // Operations
  change: (props: MarkStruct, options?: { silent: boolean }) => void
  remove: () => void

  // DOM
  ref: RefObject<T>

  // State
  readOnly?: boolean
  depth: number
  hasChildren: boolean

  // Hierarchy
  parent?: MarkToken
  children: Token[]
}

interface MarkStruct {
  label: string
  value?: string
}
```

**Type Parameter:**
- `T` - Type of the DOM element (default: `HTMLElement`)

**Usage:**

```tsx
const MyMark: FC = () => {
  const mark = useMark<HTMLButtonElement>()

  mark.ref // RefObject<HTMLButtonElement>
  mark.value // string | undefined
  mark.change({ value: 'new' }) // updates value
  mark.remove() // removes mark

  return <button ref={mark.ref}>{mark.label}</button>
}
```

### OverlayHandler

Return type of `useOverlay()` hook.

```tsx
interface OverlayHandler {
  // Positioning
  style: {
    left: number
    top: number
  }

  // State
  match: OverlayMatch

  // Operations
  select: (value: { value: string; meta?: string }) => void
  close: () => void

  // DOM
  ref: RefObject<HTMLElement>
}
```

**Usage:**

```tsx
const MyOverlay: FC = () => {
  const overlay = useOverlay()

  overlay.style // { left: number, top: number }
  overlay.match // { trigger: string, value: string }
  overlay.select({ value: 'item', meta: 'id' })
  overlay.close()

  return <div ref={overlay.ref} style={{
    position: 'absolute',
    ...overlay.style
  }} />
}
```

### OverlayMatch

Overlay trigger and query information.

```tsx
interface OverlayMatch<TOption = Option> {
  /** Trigger character(s) */
  trigger: string
  /** Text after trigger */
  value: string
  /** Position of trigger in text */
  index: number
  /** Full matched span */
  span: string
  /** Matched option */
  option: TOption
}
```

**Usage:**

```tsx
const MyOverlay: FC = () => {
  const { match } = useOverlay()

  console.log(match.trigger) // '@'
  console.log(match.value) // 'alic' (user typed '@alic')
  console.log(match.index) // 0 (position in text)
  console.log(match.span) // '@alic'

  return <div>{/* ... */}</div>
}
```

## Factory Types

### ConfiguredMarkedInput

Return type of `createMarkedInput()`.

```tsx
type ConfiguredMarkedInput<
  TMarkProps = MarkProps,
  TOverlayProps = OverlayProps
> = FunctionComponent<MarkedInputRuntimeProps<TMarkProps, TOverlayProps>>

interface MarkedInputRuntimeProps<TMarkProps, TOverlayProps>
  extends Omit<MarkedInputProps<TMarkProps, TOverlayProps>,
    'Mark' | 'Overlay' | 'options'
  > {
  // All MarkedInputProps except Mark, Overlay, options
}
```

**Usage:**

```tsx
const MentionEditor: ConfiguredMarkedInput<MentionProps> =
  createMarkedInput({
    Mark: MentionMark,
    options: [mentionOption]
  })

// Use without Mark or options props
<MentionEditor
  value={value}
  onChange={setValue}
  placeholder="Type here..."
/>
```

## Utility Types

### PropsOf

Extract props type from a component.

```tsx
type PropsOf<T> = T extends ComponentType<infer P>
  ? (P extends object ? P : never)
  : never
```

**Usage:**

```tsx
const MyComponent: FC<{ name: string }> = ({ name }) => <div>{name}</div>

type MyComponentProps = PropsOf<typeof MyComponent>
// { name: string }
```

### MarkedInputHandler

Ref handle for `MarkedInput` component (advanced usage).

```tsx
interface MarkedInputHandler {
  /** Container element */
  readonly container: HTMLDivElement | null
  /** Overlay element if exists */
  readonly overlay: HTMLElement | null

  focus(): void
}
```

**Usage:**

```tsx
function ParentComponent() {
  const editorRef = useRef<MarkedInputHandler>(null)

  const focusEditor = () => {
    editorRef.current?.focus()
  }

  return (
    <>
      <button onClick={focusEditor}>Focus</button>
      <MarkedInput
        ref={editorRef}
        Mark={MyMark}
        value={value}
        onChange={setValue}
      />
    </>
  )
}
```

## Advanced Generic Patterns

### Fully Typed Editor

Complete example with type safety.

```tsx
import type { Option, MarkProps } from 'rc-marked-input'

// 1. Define mark props
interface MentionMarkProps {
  username: string
  userId: string
  avatar: string
  onClick: (userId: string) => void
}

// 2. Define overlay props
interface MentionOverlayProps {
  users: User[]
  onSelect: (user: User) => void
}

// 3. Create typed option
const mentionOption: Option<MentionMarkProps, MentionOverlayProps> = {
  markup: '@[__value__](__meta__)',
  slots: {
    mark: MentionMark,
    overlay: MentionOverlay
  },
  slotProps: {
    mark: ({ value, meta }: MarkProps): MentionMarkProps => {
      const user = findUser(meta)
      return {
        username: value || '',
        userId: meta || '',
        avatar: user?.avatar || '',
        onClick: (id) => navigateToUser(id)
      }
    },
    overlay: {
      users: allUsers,
      onSelect: (user) => console.log('Selected:', user)
    }
  }
}

// 4. Create typed component
const MentionEditor: FC = () => {
  const [value, setValue] = useState('')

  return (
    <MarkedInput<MentionMarkProps, MentionOverlayProps>
      value={value}
      onChange={setValue}
      Mark={MentionMark}
      options={[mentionOption]}
    />
  )
}
```

### Type Inference

Let TypeScript infer types from configuration.

```tsx
// Define mark component with explicit props
const TagMark: FC<{ tag: string; color: string }> = ({ tag, color }) => (
  <span style={{ color }}>#{tag}</span>
)

// TypeScript infers option type
const tagOption = {
  markup: '#[__value__]',
  slots: { mark: TagMark },
  slotProps: {
    mark: ({ value }: MarkProps) => ({
      tag: value || '',
      color: getColorForTag(value)
    })
  }
} satisfies Option

// No need to specify generics
<MarkedInput
  Mark={TagMark}
  options={[tagOption]}
  value={value}
  onChange={setValue}
/>
```

## Type Guards

### Type narrowing utilities

```tsx
// Check if token is mark
function isMarkToken(token: Token): token is MarkToken {
  return token.type === 'mark'
}

// Check if token is text
function isTextToken(token: Token): token is TextToken {
  return token.type === 'text'
}

// Usage
const tokens: Token[] = parseMarkup(text)

tokens.forEach(token => {
  if (isMarkToken(token)) {
    console.log('Mark value:', token.value) // ✅ token.value exists
  } else {
    console.log('Text content:', token.content) // ✅ token.content exists
  }
})
```

### Option type guards

```tsx
function hasMarkSlot<T, U>(
  option: Option<T, U>
): option is Option<T, U> & { slots: { mark: ComponentType<T> } } {
  return !!option.slots?.mark
}

// Usage
options.forEach(option => {
  if (hasMarkSlot(option)) {
    const MarkComponent = option.slots.mark // ✅ Defined
  }
})
```

## Common Type Patterns

### Multiple mark types

```tsx
type MentionProps = { username: string; userId: string }
type HashtagProps = { tag: string; count: number }
type CommandProps = { command: string; icon: string }

type AllMarkProps = MentionProps | HashtagProps | CommandProps

// Universal mark component
const UniversalMark: FC<AllMarkProps> = (props) => {
  if ('username' in props) {
    return <MentionMark {...props} />
  }
  if ('tag' in props) {
    return <HashtagMark {...props} />
  }
  return <CommandMark {...props} />
}

<MarkedInput<AllMarkProps>
  Mark={UniversalMark}
  options={[mentionOption, hashtagOption, commandOption]}
/>
```

### Extending base types

```tsx
interface BaseMarkProps extends MarkProps {
  onClick: () => void
  className?: string
}

interface MentionProps extends BaseMarkProps {
  userId: string
}

interface HashtagProps extends BaseMarkProps {
  count: number
}
```

## Type-Safe Helpers

### Creating typed options

```tsx
function createOption<TMarkProps, TOverlayProps = OverlayProps>(
  config: Option<TMarkProps, TOverlayProps>
): Option<TMarkProps, TOverlayProps> {
  return config
}

// Usage with type inference
const option = createOption({
  markup: '@[__value__](__meta__)',
  slots: { mark: MentionMark },
  slotProps: {
    mark: ({ value, meta }) => ({
      username: value || '',
      userId: meta || ''
    })
  }
})
```

### Typed factory function

```tsx
function createTypedMarkedInput<TMarkProps, TOverlayProps = OverlayProps>(
  Mark: ComponentType<TMarkProps>,
  options: Option<TMarkProps, TOverlayProps>[]
) {
  return (props: MarkedInputRuntimeProps<TMarkProps, TOverlayProps>) => (
    <MarkedInput
      {...props}
      Mark={Mark}
      options={options}
    />
  )
}

// Usage
const MentionEditor = createTypedMarkedInput(
  MentionMark,
  [mentionOption]
)
```

## Type Troubleshooting

### Type 'X' is not assignable to type 'Y'

**Problem:** TypeScript can't match prop types.

```tsx
// ❌ Error
const option: Option<MentionProps> = {
  slotProps: {
    mark: { username: 'Alice' } // ❌ Missing userId
  }
}
```

**Solution:** Ensure all required props are provided:

```tsx
// ✅ Fixed
const option: Option<MentionProps> = {
  slotProps: {
    mark: ({ value, meta }) => ({
      username: value || '',
      userId: meta || '' // ✅ All props included
    })
  }
}
```

### Generic type inference fails

**Problem:** TypeScript can't infer generic types.

```tsx
// Types not inferred
<MarkedInput
  Mark={MyMark}
  options={options} // Type 'any'
/>
```

**Solution:** Explicitly specify generic types:

```tsx
<MarkedInput<MyMarkProps, MyOverlayProps>
  Mark={MyMark}
  options={options}
/>
```

## Next Steps

- **[Components API](./components)** - MarkedInput and createMarkedInput
- **[Hooks API](./hooks)** - useMark(), useOverlay(), useListener()
- **[Helpers API](./helpers)** - annotate(), denote(), and utilities
- **[TypeScript Usage Guide](../guides/typescript-usage)** - Practical TypeScript patterns

---

**See also:**
- [Core Concepts](../introduction/core-concepts) - Understanding tokens
- [Configuration Guide](../guides/configuration) - Option patterns
