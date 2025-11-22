---
title: TypeScript Usage
description: Type-safe Markput with TypeScript best practices
version: 1.0.0
---

Markput is written in TypeScript and provides comprehensive type definitions. This guide covers everything from basic typing to advanced generic patterns.

## Basic Component Typing

### Typing the Mark Component

The simplest way to type your Mark component:

```tsx
import { MarkedInput } from 'rc-marked-input'
import type { FC } from 'react'

interface MarkProps {
  value: string
  meta?: string
}

const MyMark: FC<MarkProps> = ({ value, meta }) => {
  return (
    <span className="mark" data-meta={meta}>
      {value}
    </span>
  )
}

function Editor() {
  const [value, setValue] = useState('')

  return (
    <MarkedInput<MarkProps>
      value={value}
      onChange={setValue}
      Mark={MyMark}
    />
  )
}
```

### Using Inline Types

For simple cases, inline the types:

```tsx
<MarkedInput
  value={value}
  onChange={setValue}
  Mark={({ value, meta }: { value: string; meta?: string }) => (
    <span>{value}</span>
  )}
/>
```

## Generic Props with slotProps

### Function Form slotProps

Type the transformation function:

```tsx
import type { Option } from 'rc-marked-input'

interface MentionProps {
  username: string
  userId: string
  avatarUrl: string
  onClick: () => void
}

const mentionOption: Option<MentionProps> = {
  markup: '@[__value__](__meta__)',
  slotProps: {
    mark: ({ value, meta }) => ({
      username: value || '',
      userId: meta || '',
      avatarUrl: `/avatars/${meta}.png`,
      onClick: () => console.log('Clicked', meta)
    })
  }
}

const MentionMark: FC<MentionProps> = ({ username, userId, avatarUrl, onClick }) => {
  return (
    <button onClick={onClick} className="mention">
      <img src={avatarUrl} alt={username} />
      @{username}
    </button>
  )
}

function Editor() {
  return (
    <MarkedInput<MentionProps>
      Mark={MentionMark}
      options={[mentionOption]}
      value=""
      onChange={() => {}}
    />
  )
}
```

### Object Form slotProps

Type static props:

```tsx
interface ChipProps {
  variant: 'filled' | 'outlined'
  color: 'primary' | 'secondary'
  size: 'small' | 'medium'
  label: string
}

const chipOption: Option<ChipProps> = {
  markup: '@[__value__]',
  slotProps: {
    mark: {
      variant: 'filled',
      color: 'primary',
      size: 'small',
      label: '' // Will be overridden by mark data
    }
  }
}
```

## Type Inference

TypeScript can infer types from your component props:

```tsx
// Mark component with explicit props
const TagMark = ({ label, color }: { label: string; color: string }) => (
  <span style={{ backgroundColor: color }}>{label}</span>
)

// TypeScript infers the generic type from Mark prop
function Editor() {
  return (
    <MarkedInput
      Mark={TagMark}
      // TypeScript knows options need { label: string; color: string }
      options={[
        {
          markup: '#[__value__](__meta__)',
          slotProps: {
            mark: ({ value, meta }) => ({
              label: value || '',
              color: meta || 'blue' // Type-safe!
            })
          }
        }
      ]}
      value=""
      onChange={() => {}}
    />
  )
}
```

## Exported Types Reference

### Core Component Types

```tsx
import type {
  MarkedInputProps,
  MarkProps,
  OverlayProps,
  Option,
  Slots,
  SlotProps
} from 'rc-marked-input'

// MarkedInputProps - Main component props
interface MarkedInputProps<TMarkProps = any, TOverlayProps = any> {
  value: string
  onChange: (value: string) => void
  Mark: ComponentType<TMarkProps>
  Overlay?: ComponentType<TOverlayProps>
  options?: Option<TMarkProps, TOverlayProps>[]
  readOnly?: boolean
  defaultValue?: string
  slots?: Slots
  slotProps?: SlotProps
}

// MarkProps - Props passed to Mark components (before transformation)
interface MarkProps {
  value?: string
  meta?: string
  nested?: string
  children?: ReactNode
}

// OverlayProps - Props for custom overlay components
interface OverlayProps {
  style: CSSProperties
  match: {
    value: string
    source: string
    trigger: string
  }
  select: (item: { value: string; meta?: string }) => void
  close: () => void
  ref: RefObject<HTMLElement>
}
```

### Token Types

```tsx
import type { Token, MarkToken, TextToken } from 'rc-marked-input'

// Base token type
type Token = MarkToken | TextToken

// Mark token
interface MarkToken {
  type: 'mark'
  content: string
  value?: string
  meta?: string
  nested?: string
  children?: Token[]
  start: number
  end: number
}

// Text token
interface TextToken {
  type: 'text'
  content: string
  start: number
  end: number
}
```

### Hook Return Types

```tsx
import type { MarkHandler, OverlayHandler } from 'rc-marked-input'

// useMark() return type
interface MarkHandler {
  value: string | undefined
  meta: string | undefined
  nested: string | undefined
  label: string
  ref: RefObject<HTMLElement>
  change: (data: { value: string; meta?: string }, options?: { silent?: boolean }) => void
  remove: () => void
  readOnly: boolean | undefined
  depth: number
  hasChildren: boolean
  parent: MarkToken | undefined
  children: Token[]
}

// useOverlay() return type
interface OverlayHandler {
  style: CSSProperties
  match: {
    value: string
    source: string
    trigger: string
  }
  select: (item: { value: string; meta?: string }) => void
  close: () => void
  ref: RefObject<HTMLElement>
}
```

### Option Type

```tsx
import type { Option, Markup } from 'rc-marked-input'

interface Option<TMarkProps = any, TOverlayProps = any> {
  markup: Markup | string
  slots?: {
    mark?: ComponentType<TMarkProps>
    overlay?: ComponentType<TOverlayProps>
  }
  slotProps?: {
    mark?:
      | TMarkProps
      | ((data: {
          value?: string
          meta?: string
          nested?: string
          children?: ReactNode
        }) => TMarkProps)
    overlay?: TOverlayProps
  }
}

// Markup type
interface Markup {
  pattern: string
  value?: string
  meta?: string
  nested?: string
}
```

## Advanced Generic Patterns

### Multiple Mark Types

Handle different mark types with discriminated unions:

```tsx
type MarkType =
  | { type: 'mention'; username: string; userId: string }
  | { type: 'hashtag'; tag: string }
  | { type: 'command'; cmd: string }

const UniversalMark: FC<MarkType> = (props) => {
  switch (props.type) {
    case 'mention':
      return <span className="mention">@{props.username}</span>
    case 'hashtag':
      return <span className="hashtag">#{props.tag}</span>
    case 'command':
      return <span className="command">/{props.cmd}</span>
  }
}

function Editor() {
  return (
    <MarkedInput<MarkType>
      Mark={UniversalMark}
      options={[
        {
          markup: '@[__value__](__meta__)',
          slotProps: {
            mark: ({ value, meta }) => ({
              type: 'mention' as const,
              username: value || '',
              userId: meta || ''
            })
          }
        },
        {
          markup: '#[__value__]',
          slotProps: {
            mark: ({ value }) => ({
              type: 'hashtag' as const,
              tag: value || ''
            })
          }
        }
      ]}
      value=""
      onChange={() => {}}
    />
  )
}
```

### Strict Option Typing

Create type-safe option builders:

```tsx
function createOption<TMarkProps>(
  config: Option<TMarkProps>
): Option<TMarkProps> {
  return config
}

// Usage with type inference
const mentionOption = createOption<MentionProps>({
  markup: '@[__value__](__meta__)',
  slotProps: {
    mark: ({ value, meta }) => ({
      username: value || '',
      userId: meta || '',
      // TypeScript error if missing required props!
    })
  }
})
```

### Generic Mark Components

Create reusable typed mark components:

```tsx
interface GenericMarkProps<T> {
  data: T
  render: (data: T) => ReactNode
}

function GenericMark<T>({ data, render }: GenericMarkProps<T>) {
  return <span className="mark">{render(data)}</span>
}

// Usage
interface UserData {
  name: string
  avatar: string
}

const UserMark = (props: { data: UserData }) => (
  <GenericMark<UserData>
    data={props.data}
    render={(user) => (
      <span>
        <img src={user.avatar} />
        {user.name}
      </span>
    )}
  />
)
```

## Type Guards

### Token Type Guards

```tsx
import type { Token, MarkToken, TextToken } from 'rc-marked-input'

function isMarkToken(token: Token): token is MarkToken {
  return token.type === 'mark'
}

function isTextToken(token: Token): token is TextToken {
  return token.type === 'text'
}

// Usage
function processTokens(tokens: Token[]) {
  tokens.forEach((token) => {
    if (isMarkToken(token)) {
      console.log('Mark:', token.value)
    } else if (isTextToken(token)) {
      console.log('Text:', token.content)
    }
  })
}
```

### Props Type Guards

```tsx
function hasValue<T extends { value?: string }>(
  props: T
): props is T & { value: string } {
  return typeof props.value === 'string' && props.value.length > 0
}

function SafeMark(props: { value?: string; meta?: string }) {
  if (hasValue(props)) {
    return <span>{props.value.toUpperCase()}</span> // Safe to use
  }
  return <span>No value</span>
}
```

## Utility Types

### Extract Mark Props from Component

```tsx
import type { ComponentProps } from 'react'

const MyMark = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}>{label}</button>
)

// Extract props type
type MyMarkProps = ComponentProps<typeof MyMark>
// Result: { label: string; onClick: () => void }

// Use in options
const option: Option<MyMarkProps> = {
  markup: '@[__value__]',
  slotProps: {
    mark: ({ value }) => ({
      label: value || '',
      onClick: () => console.log('Clicked')
    })
  }
}
```

### Partial Props for Defaults

```tsx
interface FullMarkProps {
  label: string
  color: string
  size: 'small' | 'medium' | 'large'
  onClick: () => void
}

// Allow partial props with defaults
const MarkWithDefaults: FC<Partial<FullMarkProps>> = ({
  label = 'Default',
  color = 'blue',
  size = 'medium',
  onClick = () => {}
}) => {
  return (
    <span style={{ color, fontSize: size === 'small' ? '12px' : '16px' }}>
      {label}
    </span>
  )
}
```

### Readonly Props

```tsx
interface ReadonlyMarkProps {
  readonly value: string
  readonly meta?: string
}

const ImmutableMark: FC<ReadonlyMarkProps> = ({ value, meta }) => {
  // TypeScript prevents mutations
  // value = 'new' // Error!
  return <span>{value}</span>
}
```

## Common Patterns

### Props with Callbacks

```tsx
interface InteractiveMarkProps {
  value: string
  onEdit: (newValue: string) => void
  onRemove: () => void
  onFocus: () => void
}

const InteractiveMark: FC<InteractiveMarkProps> = ({
  value,
  onEdit,
  onRemove,
  onFocus
}) => {
  const [editing, setEditing] = useState(false)

  return editing ? (
    <input
      value={value}
      onChange={(e) => onEdit(e.target.value)}
      onBlur={() => setEditing(false)}
    />
  ) : (
    <span onFocus={onFocus} onClick={() => setEditing(true)}>
      {value}
      <button onClick={onRemove}>×</button>
    </span>
  )
}
```

### Props with Children

```tsx
interface NestedMarkProps {
  children?: ReactNode
  depth: number
}

const NestedMark: FC<NestedMarkProps> = ({ children, depth }) => {
  return (
    <div style={{ marginLeft: depth * 20 }}>
      {children}
    </div>
  )
}
```

### Props with Discriminated Unions

```tsx
type MarkState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: string }
  | { status: 'error'; error: string }

interface StatefulMarkProps {
  value: string
  state: MarkState
}

const StatefulMark: FC<StatefulMarkProps> = ({ value, state }) => {
  return (
    <span>
      {value}
      {state.status === 'loading' && <Spinner />}
      {state.status === 'success' && <Check />}
      {state.status === 'error' && <Error message={state.error} />}
    </span>
  )
}
```

## Type-Safe Helpers

### Create Typed Factory Functions

```tsx
function createTypedMarkedInput<TMarkProps>() {
  return {
    Component: MarkedInput as ComponentType<MarkedInputProps<TMarkProps>>,
    createOption: (option: Option<TMarkProps>) => option,
    createMark: (mark: ComponentType<TMarkProps>) => mark
  }
}

// Usage
interface UserMentionProps {
  username: string
  userId: string
}

const { Component, createOption, createMark } = createTypedMarkedInput<UserMentionProps>()

const UserMentionMark = createMark(({ username, userId }) => (
  <a href={`/users/${userId}`}>@{username}</a>
))

const userMentionOption = createOption({
  markup: '@[__value__](__meta__)',
  slotProps: {
    mark: ({ value, meta }) => ({
      username: value || '',
      userId: meta || ''
    })
  }
})

function Editor() {
  return (
    <Component
      Mark={UserMentionMark}
      options={[userMentionOption]}
      value=""
      onChange={() => {}}
    />
  )
}
```

### Type-Safe Event Handlers

```tsx
import type { KeyboardEventHandler, MouseEventHandler } from 'react'

interface MarkEventHandlers {
  onKeyDown: KeyboardEventHandler<HTMLSpanElement>
  onClick: MouseEventHandler<HTMLSpanElement>
  onFocus: () => void
}

const useMarkHandlers = (): MarkEventHandlers => {
  const handleKeyDown: KeyboardEventHandler<HTMLSpanElement> = (e) => {
    if (e.key === 'Delete') {
      e.preventDefault()
      // Handle delete
    }
  }

  const handleClick: MouseEventHandler<HTMLSpanElement> = (e) => {
    e.preventDefault()
    // Handle click
  }

  const handleFocus = () => {
    console.log('Focused')
  }

  return { onKeyDown: handleKeyDown, onClick: handleClick, onFocus: handleFocus }
}
```

## Common TypeScript Errors

### Error: Type 'undefined' is not assignable

**Problem:**
```tsx
const Mark: FC<{ value: string }> = ({ value }) => {
  return <span>{value}</span>
}

// Error: value might be undefined!
```

**Solution:**
```tsx
const Mark: FC<{ value?: string }> = ({ value }) => {
  return <span>{value || 'No value'}</span>
}

// Or with type guard
const Mark: FC<{ value?: string }> = ({ value }) => {
  if (!value) return null
  return <span>{value}</span>
}
```

### Error: Property does not exist on type

**Problem:**
```tsx
const option: Option = {
  markup: '@[__value__](__meta__)',
  slotProps: {
    mark: ({ value, meta }) => ({
      username: value, // Error if Mark expects different props!
      userId: meta
    })
  }
}
```

**Solution:**
```tsx
interface MarkProps {
  username: string
  userId: string
}

const option: Option<MarkProps> = {
  markup: '@[__value__](__meta__)',
  slotProps: {
    mark: ({ value, meta }) => ({
      username: value || '',
      userId: meta || ''
    })
  }
}
```

### Error: Type is not assignable to type 'ComponentType'

**Problem:**
```tsx
const MyMark = (props) => <span>{props.value}</span> // Implicit any

<MarkedInput Mark={MyMark} /> // Error!
```

**Solution:**
```tsx
const MyMark: FC<{ value: string }> = (props) => (
  <span>{props.value}</span>
)

<MarkedInput Mark={MyMark} />
```

### Error: Cannot invoke an object which is possibly 'undefined'

**Problem:**
```tsx
const Mark: FC<{ onClick?: () => void }> = ({ onClick }) => {
  return <button onClick={onClick}>Click</button> // Error!
}
```

**Solution:**
```tsx
const Mark: FC<{ onClick?: () => void }> = ({ onClick }) => {
  return (
    <button onClick={() => onClick?.()}>Click</button>
  )
}
```

### Error: Argument of type is not assignable to parameter

**Problem:**
```tsx
const handleChange = (value: string | undefined) => {
  // Error when passing to onChange which expects string
}
```

**Solution:**
```tsx
const handleChange = (value: string) => {
  // Type matches onChange signature
}

// Or with type assertion
<MarkedInput onChange={(value) => handleChange(value as string)} />
```

## TypeScript Configuration

### Recommended tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",

    // Strict type checking
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // Additional checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,

    // Module resolution
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## Best Practices

### ✅ Do

```tsx
// Always type your Mark components
const Mark: FC<MarkProps> = ({ value }) => <span>{value}</span>

// Use generic types for flexibility
<MarkedInput<CustomMarkProps> Mark={CustomMark} />

// Provide default values for optional props
const Mark: FC<{ value?: string }> = ({ value = 'default' }) => (
  <span>{value}</span>
)

// Use type guards for runtime safety
if (typeof value === 'string') {
  return value.toUpperCase()
}

// Export your prop types for reuse
export interface MarkProps {
  value: string
  meta?: string
}
```

### ❌ Don't

```tsx
// Don't use 'any' type
const Mark = (props: any) => <span>{props.value}</span>

// Don't skip type annotations
const Mark = (props) => <span>{props.value}</span> // Implicit any

// Don't ignore null/undefined
const Mark: FC<{ value: string }> = ({ value }) => (
  <span>{value.toUpperCase()}</span> // Might crash!
)

// Don't use type assertions unnecessarily
const value = someValue as string // Unsafe!

// Don't duplicate type definitions
// Define once, import everywhere
```

## Complete Example

### Fully Typed Editor

```tsx
import { MarkedInput } from 'rc-marked-input'
import type { FC } from 'react'
import type { Option, MarkHandler } from 'rc-marked-input'

// Define all prop interfaces
interface MentionMarkProps {
  username: string
  userId: string
  avatarUrl: string
  onSelect: (userId: string) => void
}

interface HashtagMarkProps {
  tag: string
  color: string
}

type UniversalMarkProps = MentionMarkProps | HashtagMarkProps

// Type guard
function isMentionProps(props: UniversalMarkProps): props is MentionMarkProps {
  return 'username' in props
}

// Typed Mark component
const UniversalMark: FC<UniversalMarkProps> = (props) => {
  if (isMentionProps(props)) {
    return (
      <button onClick={() => props.onSelect(props.userId)} className="mention">
        <img src={props.avatarUrl} alt={props.username} />
        @{props.username}
      </button>
    )
  }

  return (
    <span className="hashtag" style={{ color: props.color }}>
      #{props.tag}
    </span>
  )
}

// Typed options
const mentionOption: Option<MentionMarkProps> = {
  markup: '@[__value__](__meta__)',
  slotProps: {
    mark: ({ value, meta }): MentionMarkProps => ({
      username: value || '',
      userId: meta || '',
      avatarUrl: `/avatars/${meta}.png`,
      onSelect: (userId) => console.log('Selected user:', userId)
    })
  }
}

const hashtagOption: Option<HashtagMarkProps> = {
  markup: '#[__value__](__meta__)',
  slotProps: {
    mark: ({ value, meta }): HashtagMarkProps => ({
      tag: value || '',
      color: meta || 'blue'
    })
  }
}

// Typed Editor component
const TypedEditor: FC = () => {
  const [value, setValue] = useState<string>('')

  const handleChange = (newValue: string): void => {
    setValue(newValue)
  }

  return (
    <MarkedInput<UniversalMarkProps>
      value={value}
      onChange={handleChange}
      Mark={UniversalMark}
      options={[mentionOption, hashtagOption]}
    />
  )
}

export default TypedEditor
```

## Next Steps

- **[Configuration](./configuration)** - Type-safe configuration patterns
- **[Dynamic Marks](./dynamic-marks)** - Typing useMark() hook
- **[Testing](./testing)** - Type-safe testing strategies
- **[API Reference](../api/types)** - Complete type definitions

---

**Resources:**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
