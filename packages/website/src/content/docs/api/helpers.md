---
title: Helpers API
description: Utility functions for working with markup text
---

This page documents helper functions for creating, parsing, and transforming annotated text.

## annotate

Create annotated text from a markup pattern.

### Signature

```tsx
function annotate(
  markup: Markup,
  params: {
    value?: string
    meta?: string
    nested?: string
  }
): string
```

### Parameters

- **markup** - Markup pattern with placeholders (`__value__`, `__meta__`, `__nested__`)
- **params** - Object with replacement values

### Returns

String with placeholders replaced by provided values.

### Usage

#### Basic value

```tsx
import { annotate } from 'rc-marked-input'

const result = annotate('@[__value__]', {
  value: 'Alice'
})
// '@[Alice]'
```

#### Value with metadata

```tsx
const result = annotate('@[__value__](__meta__)', {
  value: 'Alice',
  meta: '123'
})
// '@[Alice](123)'
```

#### Nested content

```tsx
const result = annotate('**__nested__**', {
  nested: 'bold text'
})
// '**bold text**'
```

#### HTML-like tags

```tsx
const result = annotate('<__value__>__nested__</__value__>', {
  value: 'strong',
  nested: 'important'
})
// '<strong>important</strong>'
```

#### Partial replacement

```tsx
// Only replace specified placeholders
const result = annotate('@[__value__](__meta__)', {
  value: 'Alice'
  // meta not provided - remains as placeholder
})
// '@[Alice](__meta__)'
```

### Examples

#### Building mentions

```tsx
function createMention(username: string, userId: string): string {
  return annotate('@[__value__](__meta__)', {
    value: username,
    meta: userId
  })
}

createMention('alice', '123') // '@[alice](123)'
```

#### Building nested marks

```tsx
function createBold(content: string): string {
  return annotate('**__nested__**', {
    nested: content
  })
}

const mention = createMention('alice', '123')
const boldMention = createBold(mention)
// '**@[alice](123)**'
```

#### Dynamic markup builder

```tsx
function buildMarkup(
  pattern: Markup,
  data: Record<string, string>
): string {
  return annotate(pattern, {
    value: data.value,
    meta: data.meta,
    nested: data.nested
  })
}

buildMarkup('#[__value__]', { value: 'react' })
// '#[react]'

buildMarkup('@[__value__](__meta__)', {
  value: 'Alice',
  meta: '123'
})
// '@[Alice](123)'
```

#### Building complex structures

```tsx
function createColoredText(text: string, color: string): string {
  const innerMark = annotate('@[__value__]', { value: text })
  return annotate('<color=__meta__>__nested__</color>', {
    meta: color,
    nested: innerMark
  })
}

createColoredText('Hello', 'red')
// '<color=red>@[Hello]</color>'
```

## denote

Transform annotated text by processing marks.

### Signature

```tsx
function denote(
  value: string,
  callback: (mark: MarkToken) => string,
  markups: Markup[]
): string
```

### Parameters

- **value** - Annotated text to process
- **callback** - Function that transforms each mark token to string
- **markups** - Array of markup patterns to parse

### Returns

Transformed text with all marks processed by callback.

### Usage

#### Extract values

```tsx
import { denote } from 'rc-marked-input'

const text = 'Hello @[Alice](123) and @[Bob](456)'

const result = denote(
  text,
  (mark) => mark.value,
  ['@[__value__](__meta__)']
)
// 'Hello Alice and Bob'
```

#### Extract metadata

```tsx
const text = 'Users: @[Alice](123) and @[Bob](456)'

const result = denote(
  text,
  (mark) => mark.meta || '',
  ['@[__value__](__meta__)']
)
// 'Users: 123 and 456'
```

#### Convert to HTML

```tsx
const text = 'Hello @[Alice](123)!'

const result = denote(
  text,
  (mark) => `<a href="/users/${mark.meta}">${mark.value}</a>`,
  ['@[__value__](__meta__)']
)
// 'Hello <a href="/users/123">Alice</a>!'
```

#### Transform marks

```tsx
const text = 'Follow @[Alice] and @[Bob]'

const result = denote(
  text,
  (mark) => `**${mark.value}**`,
  ['@[__value__]']
)
// 'Follow **Alice** and **Bob**'
```

#### Handle nested content

```tsx
const text = 'Text with **bold @[mention]** inside'

const result = denote(
  text,
  (mark) => {
    if (mark.descriptor.markup === '**__nested__**') {
      // Recursively process nested content
      return `<strong>${mark.nested?.content || ''}</strong>`
    }
    if (mark.descriptor.markup === '@[__value__]') {
      return `<span class="mention">${mark.value}</span>`
    }
    return mark.content
  },
  ['**__nested__**', '@[__value__]']
)
// 'Text with <strong>bold <span class="mention">mention</span></strong> inside'
```

### Examples

#### Convert markup to plain text

```tsx
function toPlainText(annotatedText: string, markups: Markup[]): string {
  return denote(
    annotatedText,
    (mark) => mark.value || mark.nested?.content || '',
    markups
  )
}

toPlainText('Hello @[Alice](123)!', ['@[__value__](__meta__)'])
// 'Hello Alice!'

toPlainText('**bold text**', ['**__nested__**'])
// 'bold text'
```

#### Convert to Markdown

```tsx
function convertToMarkdown(text: string): string {
  return denote(
    text,
    (mark) => {
      const markup = mark.descriptor.markup

      if (markup === '@[__value__](__meta__)') {
        return `[@${mark.value}](/users/${mark.meta})`
      }

      if (markup === '#[__value__]') {
        return `#${mark.value}`
      }

      return mark.content
    },
    ['@[__value__](__meta__)', '#[__value__]']
  )
}

convertToMarkdown('Hello @[Alice](123) #[react]')
// 'Hello [@Alice](/users/123) #react'
```

#### Extract mentions

```tsx
function extractMentions(text: string): Array<{ name: string; id: string }> {
  const mentions: Array<{ name: string; id: string }> = []

  denote(
    text,
    (mark) => {
      mentions.push({
        name: mark.value,
        id: mark.meta || ''
      })
      return '' // Return empty, we're just collecting
    },
    ['@[__value__](__meta__)']
  )

  return mentions
}

extractMentions('Hey @[Alice](1) and @[Bob](2)!')
// [{ name: 'Alice', id: '1' }, { name: 'Bob', id: '2' }]
```

#### Sanitize markup

```tsx
function sanitizeMarkup(text: string, markups: Markup[]): string {
  return denote(
    text,
    (mark) => {
      // Remove potentially dangerous marks
      if (mark.value.includes('<script>')) {
        return '[removed]'
      }

      // Keep safe marks
      return mark.content
    },
    markups
  )
}
```

#### Count marks

```tsx
function countMarks(text: string, markups: Markup[]): number {
  let count = 0

  denote(
    text,
    (mark) => {
      count++
      return mark.content
    },
    markups
  )

  return count
}

countMarks('Hey @[Alice] and @[Bob]', ['@[__value__]'])
// 2
```

## toString

Convert tokens back to annotated text.

### Signature

```tsx
function toString(tokens: Token[]): string
```

### Parameters

- **tokens** - Array of tokens from `Parser.parse()`

### Returns

Reconstructed annotated string.

### Usage

#### Basic reconstruction

```tsx
import { Parser, toString } from '@markput/core'

const parser = new Parser(['@[__value__](__meta__)'])
const tokens = parser.parse('@[Alice](123)')

const result = toString(tokens)
// '@[Alice](123)'
```

#### Round-trip conversion

```tsx
const original = 'Hello @[Alice](123)!'
const tokens = new Parser(['@[__value__](__meta__)']).parse(original)
const reconstructed = toString(tokens)

console.log(original === reconstructed) // true
```

#### Nested marks

```tsx
const text = '**bold @[mention]**'
const tokens = new Parser(['**__nested__**', '@[__value__]']).parse(text)

toString(tokens)
// '**bold @[mention]**'
```

### Examples

#### Modify and reconstruct

```tsx
function updateMarkValues(
  text: string,
  markups: Markup[],
  updater: (value: string) => string
): string {
  const parser = new Parser(markups)
  const tokens = parser.parse(text)

  // Modify tokens
  function modifyTokens(tokens: Token[]): Token[] {
    return tokens.map(token => {
      if (token.type === 'mark') {
        return {
          ...token,
          value: updater(token.value),
          children: modifyTokens(token.children)
        }
      }
      return token
    })
  }

  const modifiedTokens = modifyTokens(tokens)
  return toString(modifiedTokens)
}

updateMarkValues(
  'Hello @[alice]',
  ['@[__value__]'],
  (name) => name.toUpperCase()
)
// 'Hello @[ALICE]'
```

#### Filter marks

```tsx
function filterMarks(
  text: string,
  markups: Markup[],
  predicate: (mark: MarkToken) => boolean
): string {
  const parser = new Parser(markups)
  const tokens = parser.parse(text)

  function filterTokens(tokens: Token[]): Token[] {
    return tokens.flatMap(token => {
      if (token.type === 'text') {
        return [token]
      }

      if (!predicate(token)) {
        // Replace mark with its text representation
        return [{
          type: 'text',
          content: token.value,
          position: token.position
        }]
      }

      return [{
        ...token,
        children: filterTokens(token.children)
      }]
    })
  }

  const filtered = filterTokens(tokens)
  return toString(filtered)
}

filterMarks(
  '@[alice] and @[bob]',
  ['@[__value__]'],
  (mark) => mark.value === 'alice'
)
// '@[alice] and bob'
```

## Parser

Parser class for converting text to tokens and vice versa.

### Constructor

```tsx
class Parser {
  constructor(markups: (Markup | undefined)[])
}
```

**Parameters:**
- **markups** - Array of markup patterns (undefined values are skipped)

### Static Methods

#### Parser.parse

Static convenience method for parsing.

```tsx
static parse(
  value: string,
  options?: { markup: Markup[] }
): Token[]
```

**Usage:**

```tsx
import { Parser } from '@markput/core'

const tokens = Parser.parse('Hello @[Alice]', {
  markup: ['@[__value__]']
})
```

#### Parser.stringify

Static convenience method for stringifying.

```tsx
static stringify(tokens: Token[]): string
```

**Usage:**

```tsx
const text = Parser.stringify(tokens)
```

### Instance Methods

#### parse

Parse text into tokens.

```tsx
parse(value: string): Token[]
```

**Usage:**

```tsx
const parser = new Parser(['@[__value__](__meta__)'])
const tokens = parser.parse('Hello @[Alice](123)')
```

#### stringify

Convert tokens to text (alias for `toString`).

```tsx
stringify(tokens: Token[]): string
```

**Usage:**

```tsx
const parser = new Parser(['@[__value__]'])
const tokens = parser.parse('@[Alice]')
const text = parser.stringify(tokens)
// '@[Alice]'
```

### Examples

#### Reusable parser

```tsx
// Create parser once, reuse multiple times
const mentionParser = new Parser(['@[__value__](__meta__)'])

const tokens1 = mentionParser.parse('Hello @[Alice](1)')
const tokens2 = mentionParser.parse('Hi @[Bob](2)')

const text1 = mentionParser.stringify(tokens1)
const text2 = mentionParser.stringify(tokens2)
```

#### Multiple markup patterns

```tsx
const parser = new Parser([
  '@[__value__](__meta__)', // mentions
  '#[__value__]',            // hashtags
  '**__nested__**'           // bold
])

const tokens = parser.parse('Hello @[Alice](1) #[react] **bold**')
```

#### Undefined patterns

```tsx
// Skip undefined patterns but preserve indices
const parser = new Parser([
  '@[__value__]',  // index 0
  undefined,       // skipped
  '#[__value__]'   // index 2
])

const tokens = parser.parse('@[mention] #[tag]')

tokens.forEach(token => {
  if (token.type === 'mark') {
    console.log(token.descriptor.index) // 0 or 2, never 1
  }
})
```

## Other Utilities

### escape

Escape special characters in text.

```tsx
import { escape } from '@markput/core'

const escaped = escape('Hello @[Alice]')
// Escapes markup characters
```

### findGap

Find gap between positions (internal utility).

```tsx
import { findGap } from '@markput/core'

// Advanced usage for custom parsing
```

## Common Patterns

### Build and parse workflow

```tsx
import { annotate, Parser } from '@markput/core'

// 1. Build annotated text
const markup = '@[__value__](__meta__)'
const text = annotate(markup, { value: 'Alice', meta: '123' })
// '@[Alice](123)'

// 2. Parse it back to tokens
const parser = new Parser([markup])
const tokens = parser.parse(text)

// 3. Extract data
const mark = tokens.find(t => t.type === 'mark')
console.log(mark.value) // 'Alice'
console.log(mark.meta)  // '123'
```

### Transform pipeline

```tsx
import { Parser, denote, toString } from '@markput/core'

function transformMarkup(
  text: string,
  markups: Markup[],
  transformer: (mark: MarkToken) => Partial<MarkToken>
): string {
  // 1. Parse
  const parser = new Parser(markups)
  const tokens = parser.parse(text)

  // 2. Transform
  function transformTokens(tokens: Token[]): Token[] {
    return tokens.map(token => {
      if (token.type === 'mark') {
        const updates = transformer(token)
        return {
          ...token,
          ...updates,
          children: transformTokens(token.children)
        }
      }
      return token
    })
  }

  const transformed = transformTokens(tokens)

  // 3. Stringify
  return toString(transformed)
}

// Usage
transformMarkup(
  '@[alice](1) @[bob](2)',
  ['@[__value__](__meta__)'],
  (mark) => ({ value: mark.value.toUpperCase() })
)
// '@[ALICE](1) @[BOB](2)'
```

### Validation

```tsx
import { Parser } from '@markput/core'

function validateMarkup(text: string, markups: Markup[]): boolean {
  try {
    const parser = new Parser(markups)
    const tokens = parser.parse(text)

    // Check if any marks were parsed
    return tokens.some(t => t.type === 'mark')
  } catch (error) {
    return false
  }
}

validateMarkup('@[Alice]', ['@[__value__]']) // true
validateMarkup('plain text', ['@[__value__]']) // false
```

### Extract all marks

```tsx
function getAllMarks(text: string, markups: Markup[]): MarkToken[] {
  const marks: MarkToken[] = []

  function collectMarks(tokens: Token[]): void {
    for (const token of tokens) {
      if (token.type === 'mark') {
        marks.push(token)
        collectMarks(token.children)
      }
    }
  }

  const parser = new Parser(markups)
  const tokens = parser.parse(text)
  collectMarks(tokens)

  return marks
}

const marks = getAllMarks(
  'Hello @[Alice](1) and @[Bob](2)',
  ['@[__value__](__meta__)']
)
// [MarkToken, MarkToken]
```

## Best Practices

### ✅ Do

```tsx
// Cache parser instances
const parser = new Parser(markups)

function processMany(texts: string[]) {
  return texts.map(text => parser.parse(text)) // ✅ Reuse parser
}

// Use type-safe markup patterns
const markup: Markup = '@[__value__](__meta__)' // ✅ Type-checked

// Handle edge cases
function safeDenote(text: string, markups: Markup[]) {
  if (!markups.length) return text // ✅ Guard
  return denote(text, mark => mark.value, markups)
}
```

### ❌ Don't

```tsx
// Don't create new parsers repeatedly
function procesMany(texts: string[]) {
  return texts.map(text =>
    new Parser(markups).parse(text) // ❌ Creates parser each time
  )
}

// Don't use invalid patterns
const markup = 'no placeholders' // ❌ Not a valid Markup type

// Don't forget nested content
denote(text, mark => mark.value, markups) // ❌ Loses nested content
denote(text, mark => mark.value || mark.nested?.content, markups) // ✅
```

## Performance Tips

### Reuse parser instances

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

### Minimize markup patterns

```tsx
// ❌ Many patterns = slower parsing
const parser = new Parser([
  '@[__value__]',
  '@[__value__](__meta__)',
  '#[__value__]',
  '#[__value__](__meta__)',
  // ... many more
])

// ✅ Fewer patterns = faster parsing
const parser = new Parser([
  '@[__value__](__meta__)', // Handles both with/without meta
  '#[__value__](__meta__)'
])
```

## Troubleshooting

### annotate() doesn't replace placeholders

**Problem:** Placeholders remain in output.

**Cause:** Parameter name doesn't match placeholder.

```tsx
// ❌ Wrong parameter name
annotate('@[__value__]', { val: 'Alice' })
// '@[__value__]' - not replaced

// ✅ Correct parameter name
annotate('@[__value__]', { value: 'Alice' })
// '@[Alice]'
```

### denote() returns empty string

**Problem:** Output is empty or incomplete.

**Cause:** Callback doesn't return text for all token types.

```tsx
// ❌ Only handles value, loses nested content
denote(text, mark => mark.value, markups)

// ✅ Handles both value and nested
denote(
  text,
  mark => mark.value || mark.nested?.content || '',
  markups
)
```

### toString() produces incorrect output

**Problem:** Reconstructed text doesn't match original.

**Cause:** Token structure was modified incorrectly.

**Solution:** Ensure all token properties remain valid:

```tsx
// ✅ Preserve token structure
function modifyTokens(tokens: Token[]): Token[] {
  return tokens.map(token => {
    if (token.type === 'mark') {
      return {
        ...token, // Keep all properties
        value: modifyValue(token.value),
        children: modifyTokens(token.children) // Process children
      }
    }
    return token
  })
}
```

## Next Steps

- **[Components API](./components)** - MarkedInput and createMarkedInput
- **[Hooks API](./hooks)** - useMark(), useOverlay(), useListener()
- **[Types API](./types)** - TypeScript type reference
- **[Core Package API](./core-package)** - @markput/core overview

---

**See also:**
- [Core Concepts](../introduction/core-concepts) - Understanding tokens
- [Configuration](../guides/configuration) - Using helpers in practice
