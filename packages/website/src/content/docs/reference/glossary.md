---
title: Glossary
description: Complete glossary of terms used in Markput documentation
---

This glossary defines key terms and concepts used throughout Markput documentation.

## A

### Annotate
The process of adding markup syntax to plain text. See [annotate() function](../api/helpers#annotate).

**Example:** Converting `"Alice"` to `"@[Alice](123)"`

### ARIA (Accessible Rich Internet Applications)
Web accessibility standards for assistive technologies. See [Accessibility Guide](../advanced/accessibility).

**Example:** `aria-label="Message editor"`

## C

### Caret
The text cursor position in the editor. Used for overlay positioning.

**Related:** [Caret utilities](../api/core-package#caret-utilities)

### contenteditable
HTML attribute that makes an element editable. Markput uses `contenteditable="true"` for the editor container.

**Example:**
```html
<div contenteditable="true">Editable content</div>
```

### Core Package
Framework-agnostic foundation package (`@markput/core`) containing the parser and state management.

**Related:** [Core Package API](../api/core-package)

## D

### Denote
The process of extracting or transforming marked-up text. Opposite of annotate. See [denote() function](../api/helpers#denote).

**Example:** Converting `"@[Alice](123)"` to `"Alice"`

### Descriptor
Metadata about a markup pattern including its index and structure.

**Type:**
```typescript
interface MarkupDescriptor {
  index: number
  markup: Markup
}
```

## E

### EventBus
Internal event system for inter-component communication.

**Example:**
```typescript
store.bus.on(SystemEvent.Change, handler)
```

### Extensibility
Ability to customize Markput through slots, hooks, and custom components.

**Related:** [Architecture - Extensibility Points](../advanced/architecture#extensibility-points)

## H

### Hook
React hooks for accessing mark and overlay context:
- `useMark()` - Access mark data and operations
- `useOverlay()` - Control autocomplete overlay
- `useListener()` - Subscribe to events

**Related:** [Hooks API](../api/hooks)

## M

### Mark
An annotated piece of text with special meaning (mention, hashtag, etc.).

**Visual representation:** In `"Hello @[Alice]"`, `@[Alice]` is a mark.

### Mark Component
React component that renders a mark. Passed via `Mark` prop.

**Example:**
```typescript
const MyMark: FC<MarkProps> = ({ value }) => <span>{value}</span>
```

### MarkToken
Token representing a mark in the parsed tree.

**Type:**
```typescript
interface MarkToken {
  type: 'mark'
  content: string
  value: string
  meta?: string
  nested?: { content: string; start: number; end: number }
  children: Token[]
  position: { start: number; end: number }
  descriptor: MarkupDescriptor
}
```

### Markup
Template string defining how marks are structured using placeholders.

**Examples:**
- `@[__value__]` - Simple value
- `@[__value__](__meta__)` - Value with metadata
- `**__nested__**` - Nested content

### Meta (Metadata)
Additional data associated with a mark, often used for IDs or parameters.

**Example:** In `@[Alice](123)`, `"123"` is the meta value.

## N

### Nested Mark
A mark that contains other marks inside it.

**Example:** `**bold @[mention]**` - The bold mark contains a mention mark.

**Related:** [Nested Marks Guide](../guides/nested-marks)

## O

### Option
Configuration object defining markup pattern and rendering behavior.

**Type:**
```typescript
interface Option<TMarkProps, TOverlayProps> {
  markup: Markup
  slots?: {
    mark?: ComponentType<TMarkProps>
    overlay?: ComponentType<TOverlayProps>
  }
  slotProps?: {
    mark?: TMarkProps | ((props: MarkProps) => TMarkProps)
    overlay?: TOverlayProps
  }
}
```

### Overlay
Autocomplete/suggestions dropdown that appears when typing trigger characters.

**Example:** Typing `@` shows user suggestions.

**Related:** [Overlay Customization](../guides/overlay-customization)

### OverlayMatch
Information about the current overlay trigger and query.

**Type:**
```typescript
interface OverlayMatch {
  trigger: string  // '@'
  value: string    // 'alic'
  index: number    // Position in text
  span: string     // '@alic'
}
```

## P

### Parser
Component that converts markup text to token trees and vice versa.

**Example:**
```typescript
const parser = new Parser(['@[__value__]'])
const tokens = parser.parse('Hello @[Alice]')
```

**Related:** [Parser API](../api/core-package#parser-api)

### Placeholder
Special markers in markup patterns:
- `__value__` - Main content
- `__meta__` - Metadata
- `__nested__` - Nested content

### POUR
Accessibility principles: Perceivable, Operable, Understandable, Robust.

**Related:** [Accessibility Guide](../advanced/accessibility)

## R

### readOnly
Mode where marks are displayed but not editable.

**Example:**
```typescript
<MarkedInput readOnly={true} />
```

## S

### Slot
Customizable component positions in MarkedInput (container, span, mark, overlay).

**Example:**
```typescript
<MarkedInput
  slots={{
    container: CustomContainer,
    span: CustomSpan
  }}
/>
```

**Related:** [Slots Customization](../guides/slots-customization)

### slotProps
Props passed to slot components.

**Example:**
```typescript
<MarkedInput
  slotProps={{
    container: { className: 'editor' },
    mark: { color: 'blue' }
  }}
/>
```

### Store
Internal state management object containing tokens, overlay state, and DOM references.

**Related:** [Store API](../api/core-package#store)

### SystemEvent
Predefined event constants for the event bus.

**Events:**
- `STORE_UPDATED` - Store changed
- `Change` - Content changed
- `CheckTrigger` - Check for overlay trigger
- `ClearTrigger` - Close overlay
- `Select` - Overlay item selected
- `Delete` - Mark deleted

## T

### TextToken
Token representing plain text in the parsed tree.

**Type:**
```typescript
interface TextToken {
  type: 'text'
  content: string
  position: { start: number; end: number }
}
```

### Token
Union type of TextToken and MarkToken.

**Type:**
```typescript
type Token = TextToken | MarkToken
```

### Token Tree
Hierarchical structure of tokens representing parsed text.

**Example:**
```typescript
[
  { type: 'text', content: 'Hello ' },
  { type: 'mark', value: 'Alice', children: [] },
  { type: 'text', content: '!' }
]
```

### Trigger
Character(s) that activate the overlay (e.g., `@`, `#`, `/`).

**Example:**
```typescript
slotProps: {
  overlay: { trigger: '@' }
}
```

### Two Values Pattern
Markup pattern where opening and closing tags must match.

**Example:** `<__value__>__nested__</__value__>`

**Usage:** `<color>text</color>` - both values must be `"color"`

**Related:** [HTML-like Tags Example](../examples/html-like-tags)

## V

### Value
The main content of a mark, extracted from `__value__` placeholder.

**Example:** In `@[Alice](123)`, `"Alice"` is the value.

## W

### WCAG (Web Content Accessibility Guidelines)
International accessibility standards (Level A, AA, AAA).

**Related:** [Accessibility Guide](../advanced/accessibility)

## Usage Examples

### Complete Flow

```typescript
// 1. Define markup pattern
const markup = '@[__value__](__meta__)'

// 2. Create mark with annotate
const text = annotate(markup, { value: 'Alice', meta: '123' })
// '@[Alice](123)'

// 3. Parse with Parser
const parser = new Parser([markup])
const tokens = parser.parse(text)

// 4. Token structure
const mark = tokens[0] as MarkToken
console.log(mark.value)  // 'Alice'
console.log(mark.meta)   // '123'

// 5. Render with React
<MarkedInput
  value={text}
  onChange={setValue}
  Mark={MyMark}
  options={[{ markup }]}
/>

// 6. Extract plain text with denote
const plain = denote(text, mark => mark.value, [markup])
// 'Alice'
```

### Terminology Relationships

```
MarkedInput (component)
  ├─ uses Parser → produces Token Tree
  │   ├─ TextToken (plain text)
  │   └─ MarkToken (annotated text)
  │       ├─ value (from __value__)
  │       ├─ meta (from __meta__)
  │       └─ nested (from __nested__)
  │
  ├─ renders Mark (component)
  │   └─ uses useMark() hook
  │
  └─ shows Overlay (component)
      └─ uses useOverlay() hook
```

## See Also

### Core Concepts
- [Introduction](../introduction/introduction)
- [Core Concepts](../introduction/core-concepts)

### API Reference
- [Components API](../api/components)
- [Hooks API](../api/hooks)
- [Types API](../api/types)

### Guides
- [Configuration](../guides/configuration)
- [Dynamic Marks](../guides/dynamic-marks)
- [Nested Marks](../guides/nested-marks)

---

**Need more help?** Check the [FAQ](./faq) or [Troubleshooting](./troubleshooting) guides.
