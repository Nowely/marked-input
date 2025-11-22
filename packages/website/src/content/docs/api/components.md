---
title: Components API
description: Complete API reference for MarkedInput and related components
---

This page documents all React components exported by Markput.

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

### Required Props

#### value

- **Type:** `string`
- **Description:** Current editor content with mark syntax

```tsx
<MarkedInput
  value="Hello @[World]!"
  onChange={setValue}
  Mark={MyMark}
/>
```

#### onChange

- **Type:** `(value: string) => void`
- **Description:** Callback fired when editor content changes

```tsx
const [value, setValue] = useState('')

<MarkedInput
  value={value}
  onChange={(newValue) => {
    console.log('Changed:', newValue)
    setValue(newValue)
  }}
  Mark={MyMark}
/>
```

#### Mark

- **Type:** `ComponentType<TMarkProps>`
- **Description:** Component used to render marks
- **Receives:** Props transformed by `options[].slotProps.mark`

```tsx
interface MarkProps {
  value: string
  onClick: () => void
}

const MyMark: FC<MarkProps> = ({ value, onClick }) => (
  <button onClick={onClick}>{value}</button>
)

<MarkedInput
  value="@[test]"
  onChange={setValue}
  Mark={MyMark}
/>
```

### Optional Props

#### Overlay

- **Type:** `ComponentType<TOverlayProps>`
- **Description:** Global overlay component for suggestions
- **Default:** Built-in `Suggestions` component

```tsx
const CustomOverlay: FC = () => {
  const { style, select, close } = useOverlay()
  return (
    <div style={{ position: 'absolute', ...style }}>
      {/* Custom suggestions */}
    </div>
  )
}

<MarkedInput
  Mark={MyMark}
  Overlay={CustomOverlay}
/>
```

#### options

- **Type:** `Option<TMarkProps, TOverlayProps>[]`
- **Description:** Configuration for different mark patterns
- **Default:** `[]`

```tsx
<MarkedInput
  Mark={MyMark}
  options={[
    {
      markup: '@[__value__](__meta__)',
      slots: {
        mark: MentionMark,
        overlay: MentionOverlay
      },
      slotProps: {
        mark: ({ value, meta }) => ({
          username: value,
          userId: meta
        }),
        overlay: {
          trigger: '@',
          data: users
        }
      }
    }
  ]}
/>
```

#### defaultValue

- **Type:** `string`
- **Description:** Initial value for uncontrolled component
- **Default:** `''`

```tsx
// Uncontrolled
<MarkedInput
  defaultValue="Initial @[text]"
  Mark={MyMark}
/>
```

#### readOnly

- **Type:** `boolean`
- **Description:** Makes editor read-only
- **Default:** `false`

```tsx
<MarkedInput
  value={value}
  onChange={setValue}
  Mark={MyMark}
  readOnly={true}
/>
```

Marks can access this via `useMark()`:

```tsx
const MyMark = () => {
  const { readOnly, remove } = useMark()

  return (
    <span>
      {!readOnly && <button onClick={remove}>×</button>}
    </span>
  )
}
```

#### slots

- **Type:** `Slots`
- **Description:** Replace default slot components

```tsx
interface Slots {
  container?: ComponentType<HTMLAttributes<HTMLDivElement>>
  span?: ComponentType<HTMLAttributes<HTMLSpanElement>>
}
```

```tsx
const CustomContainer = forwardRef<HTMLDivElement>((props, ref) => (
  <div {...props} ref={ref} className="custom-editor" />
))

<MarkedInput
  Mark={MyMark}
  slots={{
    container: CustomContainer
  }}
/>
```

#### slotProps

- **Type:** `SlotProps`
- **Description:** Pass props to slot components

```tsx
interface SlotProps {
  container?: HTMLAttributes<HTMLDivElement>
  span?: HTMLAttributes<HTMLSpanElement>
}
```

```tsx
<MarkedInput
  Mark={MyMark}
  slotProps={{
    container: {
      className: 'editor',
      onKeyDown: (e) => console.log(e.key),
      style: { border: '1px solid #ccc' }
    },
    span: {
      className: 'text-node'
    }
  }}
/>
```

### HTML Attributes

All standard HTML attributes for `contenteditable` elements are supported:

```tsx
<MarkedInput
  Mark={MyMark}
  className="my-editor"
  style={{ minHeight: '200px' }}
  placeholder="Type here..."
  autoFocus
  tabIndex={0}
  id="editor-1"
  aria-label="Message editor"
  onFocus={() => console.log('Focused')}
  onBlur={() => console.log('Blurred')}
  onKeyDown={(e) => console.log('Key:', e.key)}
  onPaste={(e) => console.log('Pasted')}
/>
```

### Complete Example

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'
import type { Option } from 'rc-marked-input'

interface MentionProps {
  username: string
  userId: string
}

const MentionMark: FC<MentionProps> = ({ username, userId }) => (
  <a href={`/users/${userId}`}>@{username}</a>
)

function Editor() {
  const [value, setValue] = useState('')

  const options: Option<MentionProps>[] = [
    {
      markup: '@[__value__](__meta__)',
      slots: { mark: MentionMark },
      slotProps: {
        mark: ({ value, meta }) => ({
          username: value || '',
          userId: meta || ''
        }),
        overlay: {
          trigger: '@',
          data: ['alice', 'bob', 'charlie']
        }
      }
    }
  ]

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={MentionMark}
      options={options}
      placeholder="Type @ to mention"
      className="editor"
      style={{ minHeight: '150px' }}
      autoFocus
    />
  )
}
```

## createMarkedInput

Factory function for creating pre-configured MarkedInput components.

### Signature

```tsx
function createMarkedInput<TMarkProps, TOverlayProps>(
  config: MarkedInputConfig<TMarkProps, TOverlayProps>
): ComponentType<MarkedInputRuntimeProps>

interface MarkedInputConfig<TMarkProps, TOverlayProps> {
  Mark: ComponentType<TMarkProps>
  Overlay?: ComponentType<TOverlayProps>
  options?: Option<TMarkProps, TOverlayProps>[]
  slots?: Slots
  slotProps?: SlotProps
}

interface MarkedInputRuntimeProps {
  value: string
  onChange: (value: string) => void
  // All other MarkedInput props except Mark, Overlay, options
}
```

### Usage

```tsx
import { createMarkedInput } from 'rc-marked-input'

// Create configured component
const MentionEditor = createMarkedInput({
  Mark: MentionMark,
  options: [
    {
      markup: '@[__value__](__meta__)',
      slotProps: {
        mark: ({ value, meta }) => ({
          username: value,
          userId: meta
        }),
        overlay: {
          trigger: '@',
          data: users
        }
      }
    }
  ]
})

// Use like regular component
function App() {
  const [value, setValue] = useState('')

  return (
    <MentionEditor
      value={value}
      onChange={setValue}
      placeholder="Mention someone..."
    />
  )
}
```

### When to Use

**Use `createMarkedInput` when:**
- Configuration is static across the app
- You want to reuse the same config in multiple places
- You prefer declarative component creation

**Use `<MarkedInput>` directly when:**
- Configuration changes based on props/state
- Different instances need different configs
- You want maximum flexibility

### Example: Multiple Configured Editors

```tsx
// Create different editor types
const MentionEditor = createMarkedInput({
  Mark: MentionMark,
  options: [mentionOption]
})

const HashtagEditor = createMarkedInput({
  Mark: HashtagMark,
  options: [hashtagOption]
})

const RichEditor = createMarkedInput({
  Mark: UniversalMark,
  options: [mentionOption, hashtagOption, commandOption]
})

// Use throughout app
function CommentSection() {
  return (
    <>
      <MentionEditor value={comment} onChange={setComment} />
      <HashtagEditor value={tags} onChange={setTags} />
      <RichEditor value={post} onChange={setPost} />
    </>
  )
}
```

## Suggestions

Built-in overlay component for displaying suggestions.

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

interface SuggestionItem {
  label: string
  value: string
  [key: string]: any
}
```

### Usage

The `Suggestions` component is used automatically when you provide `slotProps.overlay`:

```tsx
<MarkedInput
  Mark={MyMark}
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
/>
```

### With Objects

```tsx
interface User {
  label: string
  value: string
  avatar: string
}

const users: User[] = [
  { label: 'Alice Johnson', value: 'alice', avatar: '/alice.jpg' },
  { label: 'Bob Smith', value: 'bob', avatar: '/bob.jpg' }
]

<MarkedInput
  Mark={MyMark}
  options={[
    {
      markup: '@[__value__]',
      slotProps: {
        overlay: {
          trigger: '@',
          data: users,
          renderItem: (user: User) => (
            <div>
              <img src={user.avatar} alt={user.label} />
              <span>{user.label}</span>
            </div>
          )
        }
      }
    }
  ]}
/>
```

### Custom Filtering

```tsx
<MarkedInput
  Mark={MyMark}
  options={[
    {
      markup: '@[__value__]',
      slotProps: {
        overlay: {
          trigger: '@',
          data: users,
          filterFn: (user, query) =>
            user.label.toLowerCase().includes(query.toLowerCase()) ||
            user.email.toLowerCase().includes(query.toLowerCase()),
          maxItems: 5
        }
      }
    }
  ]}
/>
```

## Type Parameters

Both `MarkedInput` and `createMarkedInput` accept generic type parameters:

```tsx
interface MyMarkProps {
  label: string
  color: string
}

interface MyOverlayProps {
  categories: string[]
}

// Typed MarkedInput
<MarkedInput<MyMarkProps, MyOverlayProps>
  Mark={MyMark}
  Overlay={MyOverlay}
  options={typedOptions}
/>

// Typed factory
const TypedEditor = createMarkedInput<MyMarkProps, MyOverlayProps>({
  Mark: MyMark,
  Overlay: MyOverlay,
  options: typedOptions
})
```

## Ref Access

Access the underlying DOM element:

```tsx
function EditorWithRef() {
  const editorRef = useRef<HTMLDivElement>(null)

  const focusEditor = () => {
    editorRef.current?.focus()
  }

  return (
    <>
      <button onClick={focusEditor}>Focus</button>
      <MarkedInput
        Mark={MyMark}
        slotProps={{
          container: { ref: editorRef }
        }}
      />
    </>
  )
}
```

## Component Lifecycle

### Mount

1. Component mounts
2. Parser initializes with `options`
3. Initial `value` is parsed into tokens
4. Tokens are rendered as React elements

### Update (value changes)

1. New `value` received
2. Text is re-parsed
3. Token tree is compared (memoized)
4. Only changed marks re-render

### Update (user types)

1. User edits contentEditable
2. `onChange` fires with new text
3. Parent updates `value` prop
4. Component re-parses and re-renders

### Unmount

1. Event listeners cleaned up
2. Overlay closed if open
3. Parser disposed

## Performance Tips

### Memoize Options

```tsx
const options = useMemo(() => [
  { markup: '@[__value__]', /* ... */ }
], []) // Only create once

<MarkedInput options={options} />
```

### Memoize Mark Component

```tsx
const MemoizedMark = memo(({ value }) => <span>{value}</span>)

<MarkedInput Mark={MemoizedMark} />
```

### Debounce onChange

```tsx
const debouncedOnChange = useMemo(
  () => debounce((value: string) => {
    // Expensive operation (e.g., API call)
  }, 300),
  []
)

<MarkedInput
  value={value}
  onChange={(newValue) => {
    setValue(newValue)
    debouncedOnChange(newValue)
  }}
  Mark={MyMark}
/>
```

## Accessibility

### ARIA Attributes

```tsx
<MarkedInput
  Mark={MyMark}
  slotProps={{
    container: {
      role: 'textbox',
      'aria-label': 'Message editor',
      'aria-multiline': true,
      'aria-required': true,
      'aria-describedby': 'editor-help'
    }
  }}
/>

<p id="editor-help" className="sr-only">
  Type @ to mention someone
</p>
```

### Keyboard Navigation

Built-in keyboard support:
- Arrow keys navigate between marks
- Tab focuses next mark
- Backspace/Delete remove marks (when focused)
- Escape closes overlay

### Screen Readers

Marks should have meaningful labels:

```tsx
const AccessibleMark: FC<{ username: string }> = ({ username }) => (
  <span
    role="link"
    aria-label={`Mention ${username}`}
  >
    @{username}
  </span>
)
```

## Error Boundaries

Wrap in error boundary to catch rendering errors:

```tsx
import { ErrorBoundary } from 'react-error-boundary'

function App() {
  return (
    <ErrorBoundary
      fallback={<div>Editor failed to load</div>}
      onError={(error) => console.error('Editor error:', error)}
    >
      <MarkedInput Mark={MyMark} />
    </ErrorBoundary>
  )
}
```

## Next Steps

- **[Hooks API](./hooks)** - useMark(), useOverlay(), useListener()
- **[Types API](./types)** - All exported TypeScript types
- **[Configuration Guide](../guides/configuration)** - Detailed configuration patterns

---

**See also:**
- [Quick Start](../introduction/quick-start) - Basic usage examples
- [Examples](../examples/mention-system) - Production-ready implementations
