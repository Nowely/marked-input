---
title: Glossary
description: Comprehensive glossary of Markput terminology - marks, tokens, markup patterns, and key concepts
keywords: [glossary, terminology, definitions, concepts, marks, tokens, markup, parser]
---

This glossary defines key terms used throughout Markput's documentation and codebase.

## Core Concepts

### Mark

A **mark** is a React component that renders a matched pattern in your text as an interactive element.

**Example:**
```tsx
'Hello @[World](user:123)!'
//      └─────────────┘
//        This becomes a Mark component
```

**Key characteristics:**
- Rendered as a React component you define
- Created from markup patterns in plain text
- Can be static or dynamic (editable, removable, focusable)
- May contain other marks (nested marks)

**Related:** Token, Markup Pattern, Dynamic Mark

---

### Markup

**Markup** refers to the text-based format used to denote marks in plain text.

**Example:**
```
@[Alice](user:1)     ← Markup for a mention
#[react]             ← Markup for a hashtag
**bold text**        ← Markup for bold formatting
```

**Key characteristics:**
- Plain text representation
- Easy to serialize and store
- Human-readable
- Parsed into tokens by the parser

**Related:** Markup Pattern, Mark, Token

---

### Markup Pattern

A **markup pattern** is a template that defines how to match and parse marks in text.

**Example:**
```tsx
'@[__value__](__meta__)'   // Pattern for mentions
'#[__value__]'             // Pattern for hashtags
'**__nested__**'           // Pattern for bold text
```

**Placeholders:**
- `__value__` - Main content (plain text)
- `__meta__` - Metadata (plain text)
- `__nested__` - Content that can contain other marks

**Related:** Mark, Parser, Token

---

### Token

A **token** is the internal representation of text used by Markput's parser.

**Types:**
- **TextToken** - Plain text segments
- **MarkToken** - Marked segments that render as components

**Example:**
```tsx
'Hello @[World](meta)!'

// Becomes token array:
[
  { type: 'text', content: 'Hello ' },
  { type: 'mark', value: 'World', meta: 'meta' },
  { type: 'text', content: '!' }
]
```

**Related:** Parser, Mark, Token Tree

---

### Token Tree

A **token tree** is the hierarchical structure of tokens created by the parser. For nested marks, tokens can have children, forming a tree structure.

**Example:**
```tsx
'**bold with *italic***'

// Token tree:
{
  type: 'mark',
  nested: 'bold with *italic*',
  children: [
    { type: 'text', content: 'bold with ' },
    {
      type: 'mark',
      nested: 'italic',
      children: [
        { type: 'text', content: 'italic' }
      ]
    }
  ]
}
```

**Related:** Token, Nested Marks, Parser

---

## Component Types

### Mark Component

The React component you provide to render marks.

**Example:**
```tsx
function MyMark({ value, meta }) {
  return <span className="mark">{value}</span>
}

<MarkedInput Mark={MyMark} />
```

**Props received:**
- `value` - From `__value__` placeholder
- `meta` - From `__meta__` placeholder
- `nested` - Raw content from `__nested__`
- `children` - Rendered children (for nested marks)

**Related:** Mark, Dynamic Mark

---

### Overlay Component

The component that renders autocomplete/suggestion UI when a trigger is detected.

**Example:**
```tsx
function MyOverlay() {
  const { match, select, close } = useOverlay()

  return (
    <div>
      {/* Suggestion list */}
    </div>
  )
}
```

**Related:** useOverlay hook, Trigger

---

## Mark Types

### Static Mark

A **static mark** is a non-interactive mark component that only displays content.

**Example:**
```tsx
function StaticMark({ value }) {
  return <span>{value}</span>
}
```

**Related:** Mark, Dynamic Mark

---

### Dynamic Mark

A **dynamic mark** is an interactive mark that uses the `useMark()` hook to access methods for editing, removing, or focusing.

**Example:**
```tsx
function DynamicMark() {
  const { label, change, remove } = useMark()

  return (
    <span>
      {label}
      <button onClick={remove}>×</button>
    </span>
  )
}
```

**Capabilities:**
- Editable (via `change()`)
- Removable (via `remove()`)
- Focusable (via `ref`)

**Related:** useMark hook, Mark

---

### Nested Mark

A **nested mark** is a mark that can contain other marks, creating hierarchical structures.

**Requirements:**
- Must use `__nested__` placeholder in markup pattern
- Renders `children` prop instead of `value`

**Example:**
```tsx
'**bold with *italic* text**'

// Pattern: '**__nested__**'
// Mark component:
function BoldMark({ children }) {
  return <strong>{children}</strong>
}
```

**Related:** Token Tree, Markup Pattern

---

### Flat Mark

A **flat mark** is a mark that cannot contain other marks. Uses `__value__` placeholder.

**Example:**
```tsx
'@[Alice]'

// Pattern: '@[__value__]'
// Mark component:
function MentionMark({ value }) {
  return <span>@{value}</span>
}
```

**Related:** Nested Mark, Markup Pattern

---

## System Components

### Parser

The **parser** converts plain text with markup into a token tree.

**Responsibilities:**
- Pattern matching
- Tokenization
- Building token tree for nested marks
- Handling multiple markup patterns

**Related:** Token, Markup Pattern, Token Tree

---

### Store

The **store** manages Markput's internal state using a reactive proxy pattern.

**Contains:**
- Current tokens
- Parser instance
- Overlay state
- DOM references
- Event bus

**Related:** Event Bus, State Management

---

### Event Bus

The **event bus** handles inter-component communication using the pub/sub pattern.

**Key events:**
- `Change` - Text content changes
- `CheckTrigger` - Check for overlay trigger
- `Select` - Overlay item selected
- `Delete` - Mark deleted

**Related:** Store, System Events

---

## Features

### Overlay System

The **overlay system** provides autocomplete and suggestion UI for marks.

**Components:**
1. Trigger detection
2. Overlay positioning
3. Suggestion filtering
4. Item selection
5. Mark insertion

**Example:**
```tsx
// User types '@'
// → Overlay opens with suggestions
// → User selects "Alice"
// → Inserts: @[Alice](user:1)
```

**Related:** Trigger, Overlay Component, useOverlay

---

### Trigger

A **trigger** is a character or pattern that opens the overlay.

**Example:**
```tsx
{
  markup: '@[__value__](__meta__)',
  slotProps: {
    overlay: { trigger: '@', data: users }
  }
}
```

**Common triggers:**
- `@` - Mentions
- `#` - Hashtags
- `/` - Slash commands

**Related:** Overlay System

---

## Hooks

### useMark()

Hook that provides mark state and methods to Mark components.

**Returns:**
- `value`, `meta`, `nested` - Mark data
- `label` - Display label
- `ref` - For keyboard focus
- `change()` - Update mark
- `remove()` - Delete mark
- `readOnly` - Editor read-only state
- Nesting info: `depth`, `hasChildren`, `parent`, `children`

**Example:**
```tsx
function MyMark() {
  const { label, remove } = useMark()
  return <span>{label} <button onClick={remove}>×</button></span>
}
```

**Related:** Dynamic Mark, Mark Component

---

### useOverlay()

Hook that provides overlay state and methods to Overlay components.

**Returns:**
- `style` - Positioning (`left`, `top`)
- `match` - Current match info (`value`, `source`, `trigger`)
- `select()` - Insert selected item
- `close()` - Close overlay
- `ref` - For outside click detection

**Example:**
```tsx
function MyOverlay() {
  const { match, select } = useOverlay()
  return (
    <div>
      <button onClick={() => select({ value: 'Alice', meta: 'user:1' })}>
        Alice
      </button>
    </div>
  )
}
```

**Related:** Overlay Component, Trigger

---

### useListener()

Hook for subscribing to system events.

**Example:**
```tsx
function MyMark() {
  useListener('customEvent', (data) => {
    console.log('Event fired:', data)
  }, [])

  return <span>Mark</span>
}
```

**Related:** Event Bus, System Events

---

## Configuration

### Option

An **option** defines how a specific markup pattern should be handled.

**Structure:**
```tsx
{
  markup: string,              // Pattern to match
  slots: {                     // Components
    mark: Component,
    overlay: Component
  },
  slotProps: {                 // Props configuration
    mark: object | function,
    overlay: object
  }
}
```

**Related:** Configuration, Markup Pattern

---

### Slots

**Slots** allow replacing internal components with custom implementations.

**Available slots:**
- `mark` - Per-pattern mark component
- `overlay` - Per-pattern overlay component
- `container` - Editor container
- `span` - Text node wrapper

**Related:** Configuration, Option

---

## Placeholders

### __value__

Placeholder for main content in markup patterns. Extracts plain text only.

**Example:**
```tsx
markup: '@[__value__]'
// Matches: @[Alice]
// Extracts: value = "Alice"
```

**Characteristics:**
- Plain text only
- No nesting support
- Used for flat marks

**Related:** Markup Pattern, Flat Mark

---

### __meta__

Placeholder for metadata in markup patterns. Extracts plain text only.

**Example:**
```tsx
markup: '@[__value__](__meta__)'
// Matches: @[Alice](user:1)
// Extracts: value = "Alice", meta = "user:1"
```

**Use cases:**
- User IDs
- Colors
- URLs
- Any metadata

**Related:** Markup Pattern, Mark Component

---

### __nested__

Placeholder for content that can contain other marks. Enables nesting.

**Example:**
```tsx
markup: '**__nested__**'
// Matches: **bold *italic***
// Supports nested marks inside
```

**Characteristics:**
- Supports nested marks
- Renders as `children` ReactNode
- Recursive parsing
- Creates token tree

**Related:** Nested Mark, Token Tree

---

## API Functions

### annotate()

Function that converts markup pattern and data into markup string.

**Example:**
```tsx
import { annotate } from '@markput/core'

const markup = annotate('@[__value__](__meta__)', {
  value: 'Alice',
  meta: 'user:1'
})
// Returns: '@[Alice](user:1)'
```

**Related:** Markup, Markup Pattern

---

### denote()

Function that extracts data from markup string.

**Example:**
```tsx
import { denote } from '@markput/core'

const data = denote('@[__value__](__meta__)', '@[Alice](user:1)')
// Returns: { value: 'Alice', meta: 'user:1' }
```

**Related:** Markup, Markup Pattern

---

### createMarkedInput()

Factory function that creates a pre-configured MarkedInput component.

**Example:**
```tsx
import { createMarkedInput } from 'rc-marked-input'

const Editor = createMarkedInput({
  Mark: MyMark,
  options: [/* ... */]
})

// Use anywhere:
<Editor value={value} onChange={setValue} />
```

**Use when:**
- Configuration is static
- Want to reuse same config
- Prefer cleaner API

**Related:** Configuration, Factory Pattern

---

## Patterns

### Two Values Pattern

A markup pattern with exactly two `__value__` placeholders that must match.

**Example:**
```tsx
markup: '<__value__>__nested__</__value__>'

// ✅ Matches (tags match):
'<div>content</div>'
'<span>text</span>'

// ❌ Doesn't match (tags don't match):
'<div>content</span>'
```

**Use cases:**
- HTML-like tags
- BBCode
- Custom paired delimiters

**Related:** Markup Pattern, Nested Mark

---

## State Management

### Controlled Component

A component where the parent manages the state.

**Example:**
```tsx
const [value, setValue] = useState('')

<MarkedInput
  value={value}           // Parent controls
  onChange={setValue}     // Parent receives updates
/>
```

**Related:** React Pattern

---

### Uncontrolled Component

A component that manages its own internal state.

**Example:**
```tsx
<MarkedInput
  defaultValue="Initial"  // Component manages state
/>
```

**Related:** React Pattern

---

## Performance

### Memoization

Optimization technique using `React.memo` and `useMemo` to prevent unnecessary re-renders.

**Example:**
```tsx
const Mark = React.memo(({ value }) => <span>{value}</span>)

const tokens = useMemo(() => parser.parse(value), [value])
```

**Related:** Performance, Re-render Optimization

---

## See Also

- [How It Works](/introduction/how-it-works) - Understanding Markput's internals
- [Architecture](/development/architecture) - System design and data flow
- [Configuration](/guides/configuration) - Configuration patterns
- [API Reference](/api/README) - Complete API documentation
