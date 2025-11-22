---
title: Core Package API
description: Framework-agnostic @markput/core package reference
---

This page documents the `@markput/core` package - the framework-agnostic foundation that powers Markput.

## Overview

The `@markput/core` package provides:

- **Parser** - High-performance markup parser
- **Store** - State management system
- **Event System** - Inter-component communication
- **Caret** - Cursor position utilities
- **Text Manipulation** - Low-level text operations

## When to Use Core

### Use `rc-marked-input` (React package) when:
- Building React applications ✅
- Need React hooks and components ✅
- Want batteries-included experience ✅

### Use `@markput/core` directly when:
- Building framework integrations (Vue, Svelte, Angular)
- Creating custom editor implementations
- Need parser-only functionality
- Want maximum control over rendering

## Installation

```bash
npm install @markput/core
```

The core package has zero dependencies and works in any JavaScript environment.

## Parser API

The Parser class converts text with markup patterns into token trees.

### Basic Usage

```tsx
import { Parser } from '@markput/core'

const parser = new Parser(['@[__value__](__meta__)'])
const tokens = parser.parse('Hello @[Alice](123)!')

console.log(tokens)
// [
//   { type: 'text', content: 'Hello ', position: { start: 0, end: 6 } },
//   { type: 'mark', value: 'Alice', meta: '123', position: { start: 6, end: 19 } },
//   { type: 'text', content: '!', position: { start: 19, end: 20 } }
// ]
```

### Constructor

```tsx
new Parser(markups: (Markup | undefined)[])
```

**Parameters:**
- `markups` - Array of markup patterns (undefined values are skipped)

**Example:**

```tsx
const parser = new Parser([
  '@[__value__](__meta__)',  // Mentions
  '#[__value__]',            // Hashtags
  '**__nested__**'           // Bold
])
```

### Methods

#### parse

Convert text to tokens.

```tsx
parse(value: string): Token[]
```

**Example:**

```tsx
const tokens = parser.parse('Hello @[Alice]!')
```

#### stringify

Convert tokens back to text.

```tsx
stringify(tokens: Token[]): string
```

**Example:**

```tsx
const text = parser.stringify(tokens)
```

### Static Methods

#### Parser.parse

One-off parsing without creating instance.

```tsx
Parser.parse(value: string, options?: { markup: Markup[] }): Token[]
```

**Example:**

```tsx
const tokens = Parser.parse('Hello @[Alice]', {
  markup: ['@[__value__]']
})
```

#### Parser.stringify

One-off stringification.

```tsx
Parser.stringify(tokens: Token[]): string
```

### Complete Example

```tsx
import { Parser, annotate } from '@markput/core'
import type { MarkToken } from '@markput/core'

// Create parser
const parser = new Parser([
  '@[__value__](__meta__)',
  '#[__value__]'
])

// Parse text
const text = 'Hello @[Alice](123) #[react]'
const tokens = parser.parse(text)

// Process marks
function extractMentions(tokens: Token[]): string[] {
  const mentions: string[] = []

  function traverse(tokens: Token[]) {
    for (const token of tokens) {
      if (token.type === 'mark' && token.descriptor.markup === '@[__value__](__meta__)') {
        mentions.push(token.value)
      }
      if (token.type === 'mark') {
        traverse(token.children)
      }
    }
  }

  traverse(tokens)
  return mentions
}

const mentions = extractMentions(tokens)
// ['Alice']

// Build new markup
const newMention = annotate('@[__value__](__meta__)', {
  value: 'Bob',
  meta: '456'
})

const updatedText = text + ' ' + newMention
const updatedTokens = parser.parse(updatedText)
```

## Text Manipulation Utilities

### annotate

Create annotated text from markup pattern.

```tsx
import { annotate } from '@markput/core'

const text = annotate('@[__value__](__meta__)', {
  value: 'Alice',
  meta: '123'
})
// '@[Alice](123)'
```

See [Helpers API](./helpers#annotate) for full documentation.

### denote

Transform annotated text by processing marks.

```tsx
import { denote } from '@markput/core'

const text = 'Hello @[Alice](123)'
const plain = denote(
  text,
  (mark) => mark.value,
  ['@[__value__](__meta__)']
)
// 'Hello Alice'
```

See [Helpers API](./helpers#denote) for full documentation.

### toString

Convert tokens to annotated text.

```tsx
import { toString } from '@markput/core'

const tokens = parser.parse('@[Alice](123)')
const text = toString(tokens)
// '@[Alice](123)'
```

See [Helpers API](./helpers#tostring) for full documentation.

## Store

State management system for editor state (advanced usage).

### Overview

The Store manages all editor state including:
- Parsed tokens
- Overlay state
- DOM references
- Event bus
- Focus management

### Basic Usage

```tsx
import { Store } from '@markput/core'

const store = Store.create({
  value: 'Hello @[Alice]',
  onChange: (value) => console.log('Changed:', value),
  options: [
    { markup: '@[__value__]' }
  ]
})
```

### Properties

#### bus

Event bus for inter-component communication.

```tsx
store.bus.send(SystemEvent.Change, { value: 'new text' })
```

#### tokens

Current parsed token tree.

```tsx
console.log(store.tokens)
// [{ type: 'text', ... }, { type: 'mark', ... }]
```

#### overlayMatch

Current overlay trigger and query.

```tsx
if (store.overlayMatch) {
  console.log(store.overlayMatch.trigger) // '@'
  console.log(store.overlayMatch.value)   // 'alic'
}
```

#### refs

DOM element references.

```tsx
store.refs.setContainer(containerElement)
store.refs.setOverlay(overlayElement)

console.log(store.refs.container) // HTMLDivElement | null
console.log(store.refs.overlay)   // HTMLElement | null
```

#### parser

Parser instance used for parsing.

```tsx
const tokens = store.parser?.parse(text)
```

### Example: Custom Editor

```tsx
import { Store, Parser, SystemEvent } from '@markput/core'

class CustomEditor {
  private store: Store

  constructor(container: HTMLDivElement) {
    this.store = Store.create({
      value: '',
      onChange: (value) => this.handleChange(value),
      options: [{ markup: '@[__value__]' }]
    })

    this.store.refs.setContainer(container)
    this.store.parser = new Parser(['@[__value__]'])

    // Listen to events
    this.store.bus.on(SystemEvent.Change, (data) => {
      console.log('Content changed:', data)
    })

    this.render()
  }

  private handleChange(value: string) {
    console.log('New value:', value)
  }

  private render() {
    const tokens = this.store.parser!.parse(this.store.props.value)
    // ... render tokens
  }
}
```

## Event System

### SystemEvent

Event constants for the event bus.

```tsx
import { SystemEvent } from '@markput/core'

const events = {
  STORE_UPDATED: SystemEvent.STORE_UPDATED, // Store state changed
  ClearTrigger: SystemEvent.ClearTrigger,   // Close overlay
  CheckTrigger: SystemEvent.CheckTrigger,   // Check for trigger
  Change: SystemEvent.Change,               // Content changed
  Parse: SystemEvent.Parse,                 // Parse triggered
  Delete: SystemEvent.Delete,               // Mark deleted
  Select: SystemEvent.Select                // Overlay item selected
}
```

### EventBus

```tsx
import { EventBus, SystemEvent } from '@markput/core'

const bus = new EventBus()

// Subscribe to events
bus.on(SystemEvent.Change, (data) => {
  console.log('Changed:', data)
})

// Send events
bus.send(SystemEvent.Change, { value: 'new text' })

// Unsubscribe
bus.off(SystemEvent.Change, handler)
```

### Example: Event Monitoring

```tsx
import { Store, SystemEvent } from '@markput/core'

const store = Store.create({ /* ... */ })

// Monitor all store updates
store.bus.on(SystemEvent.STORE_UPDATED, (updatedStore) => {
  console.log('Store updated:', updatedStore)
})

// Monitor overlay events
store.bus.on(SystemEvent.CheckTrigger, () => {
  console.log('Checking for trigger')
})

store.bus.on(SystemEvent.Select, ({ mark, match }) => {
  console.log('Selected:', mark.value)
  console.log('From trigger:', match.trigger)
})

// Monitor content changes
store.bus.on(SystemEvent.Change, ({ value }) => {
  console.log('Content changed to:', value)
})
```

## Caret Utilities

Cursor position and overlay positioning utilities.

### Caret.getAbsolutePosition

Get cursor position for overlay placement.

```tsx
import { Caret } from '@markput/core'

const position = Caret.getAbsolutePosition()
// { left: 150, top: 200 }

// Position overlay
overlayElement.style.left = `${position.left}px`
overlayElement.style.top = `${position.top}px`
```

### TriggerFinder

Find trigger characters in text.

```tsx
import { TriggerFinder } from '@markput/core'

const finder = new TriggerFinder(['@', '#'])
const match = finder.find(text, cursorPosition)

if (match) {
  console.log('Trigger:', match.trigger)
  console.log('Query:', match.value)
  console.log('Position:', match.index)
}
```

## Type Exports

All core types are exported and documented in [Types API](./types).

```tsx
import type {
  Token,
  TextToken,
  MarkToken,
  Markup,
  OverlayMatch,
  CoreOption,
  EventKey
} from '@markput/core'
```

## Differences from rc-marked-input

| Feature | @markput/core | rc-marked-input |
|---------|---------------|-----------------|
| **Framework** | Framework-agnostic | React only |
| **Components** | No components | MarkedInput, Suggestions |
| **Hooks** | No hooks | useMark, useOverlay, useListener |
| **Parser** | ✅ Parser class | ✅ (re-exported) |
| **Store** | ✅ Store class | ✅ (used internally) |
| **Events** | ✅ EventBus, SystemEvent | ✅ (used internally) |
| **Helpers** | ✅ annotate, denote, toString | ✅ (re-exported) |
| **Types** | ✅ Token, Markup, etc. | ✅ (extended with React types) |
| **Size** | ~10KB | ~15KB |
| **Dependencies** | 0 | react, react-dom |

## Framework Integration Examples

### Vue Integration

```vue
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Parser, Store, SystemEvent } from '@markput/core'

const containerRef = ref<HTMLDivElement>()
const value = ref('Hello @[Alice]')

const parser = new Parser(['@[__value__]'])
const store = Store.create({
  value: value.value,
  onChange: (newValue) => {
    value.value = newValue
  },
  options: [{ markup: '@[__value__]' }]
})

watch(value, (newValue) => {
  const tokens = parser.parse(newValue)
  // Render tokens...
})

onMounted(() => {
  if (containerRef.value) {
    store.refs.setContainer(containerRef.value)
  }
})
</script>

<template>
  <div ref="containerRef" contenteditable>
    {{ value }}
  </div>
</template>
```

### Svelte Integration

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { Parser } from '@markput/core'

  let value = 'Hello @[Alice]'
  let container: HTMLDivElement

  const parser = new Parser(['@[__value__]'])

  function handleInput(e: Event) {
    value = (e.target as HTMLDivElement).textContent || ''
    const tokens = parser.parse(value)
    // Process tokens...
  }

  onMount(() => {
    // Initialize editor
  })
</script>

<div
  bind:this={container}
  contenteditable
  on:input={handleInput}
>
  {value}
</div>
```

### Vanilla JavaScript

```tsx
import { Parser, annotate } from '@markput/core'

class MarkupEditor {
  private container: HTMLDivElement
  private parser: Parser

  constructor(element: HTMLDivElement) {
    this.container = element
    this.parser = new Parser(['@[__value__](__meta__)'])

    this.container.contentEditable = 'true'
    this.container.addEventListener('input', () => this.handleInput())
  }

  private handleInput() {
    const text = this.container.textContent || ''
    const tokens = this.parser.parse(text)

    // Process tokens and update UI
    this.render(tokens)
  }

  private render(tokens: Token[]) {
    let html = ''

    for (const token of tokens) {
      if (token.type === 'text') {
        html += token.content
      } else {
        html += `<span class="mention">${token.value}</span>`
      }
    }

    this.container.innerHTML = html
  }

  insertMention(name: string, id: string) {
    const mention = annotate('@[__value__](__meta__)', {
      value: name,
      meta: id
    })

    this.container.textContent += mention
    this.handleInput()
  }
}

// Usage
const editor = new MarkupEditor(document.getElementById('editor')!)
editor.insertMention('Alice', '123')
```

## Performance Considerations

### Parser Reuse

```tsx
// ❌ Slow - creates new parser each time
function process(texts: string[]) {
  return texts.map(text =>
    new Parser(markups).parse(text)
  )
}

// ✅ Fast - reuses parser
const parser = new Parser(markups)
function process(texts: string[]) {
  return texts.map(text => parser.parse(text))
}
```

### Token Tree Traversal

```tsx
// ✅ Efficient recursive traversal
function findMarks(tokens: Token[], predicate: (mark: MarkToken) => boolean): MarkToken[] {
  const results: MarkToken[] = []

  function traverse(tokens: Token[]) {
    for (const token of tokens) {
      if (token.type === 'mark') {
        if (predicate(token)) {
          results.push(token)
        }
        traverse(token.children)
      }
    }
  }

  traverse(tokens)
  return results
}
```

### Event Bus Usage

```tsx
// ✅ Unsubscribe when done
const handler = (data) => console.log(data)
bus.on(SystemEvent.Change, handler)

// Later...
bus.off(SystemEvent.Change, handler)
```

## Best Practices

### ✅ Do

```tsx
// Cache parser instances
const parser = new Parser(markups)

// Type your code
import type { Token, MarkToken } from '@markput/core'

// Handle edge cases
function safeparse(text: string) {
  if (!text) return []
  return parser.parse(text)
}

// Clean up event listeners
componentWillUnmount() {
  bus.off(SystemEvent.Change, handler)
}
```

### ❌ Don't

```tsx
// Don't create parsers in loops
for (const text of texts) {
  new Parser(markups).parse(text) // ❌
}

// Don't mutate tokens directly
token.value = 'new value' // ❌

// Don't forget to unsubscribe
bus.on(SystemEvent.Change, handler) // ❌ Memory leak
```

## Debugging

### Enable Debug Logging

```tsx
// In development
if (process.env.NODE_ENV === 'development') {
  const store = Store.create({ /* ... */ })

  store.bus.on(SystemEvent.STORE_UPDATED, (s) => {
    console.log('[Store]', s)
  })

  store.bus.on(SystemEvent.Change, (d) => {
    console.log('[Change]', d)
  })

  store.bus.on(SystemEvent.Select, (d) => {
    console.log('[Select]', d)
  })
}
```

### Inspect Token Tree

```tsx
function printTokenTree(tokens: Token[], indent = 0) {
  for (const token of tokens) {
    const prefix = '  '.repeat(indent)

    if (token.type === 'text') {
      console.log(`${prefix}Text: "${token.content}"`)
    } else {
      console.log(`${prefix}Mark: ${token.value} (${token.meta})`)
      if (token.children.length > 0) {
        printTokenTree(token.children, indent + 1)
      }
    }
  }
}

const tokens = parser.parse('Hello @[Alice](123) **bold**')
printTokenTree(tokens)
// Text: "Hello "
// Mark: Alice (123)
// Text: " "
// Mark:  (undefined)
//   Text: "bold"
```

## Migration from React Package

If you're building a framework integration, here's how core concepts map:

```tsx
// React (rc-marked-input)
import { MarkedInput, useMark, useOverlay } from 'rc-marked-input'

<MarkedInput
  value={value}
  onChange={setValue}
  Mark={MyMark}
  options={options}
/>

// Core (@markput/core)
import { Parser, Store, SystemEvent } from '@markput/core'

const parser = new Parser(markups)
const store = Store.create({
  value,
  onChange,
  options
})

// Listen to events
store.bus.on(SystemEvent.Change, handleChange)

// Parse and render
const tokens = parser.parse(value)
// ... render tokens manually
```

## Next Steps

- **[Helpers API](./helpers)** - annotate(), denote(), toString()
- **[Types API](./types)** - All TypeScript types
- **[Parser Deep Dive](../guides/custom-parsers)** - Advanced parsing
- **[Architecture Guide](../advanced/architecture)** - System design

---

**See also:**
- [Core Concepts](../introduction/core-concepts) - Understanding tokens
- [Installation](../introduction/installation) - Setup guide
- [Quick Start](../introduction/quick-start) - Get started with React
