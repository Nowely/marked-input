---
title: Custom Parsers
description: Build custom parsers and extend parsing capabilities
---

This guide covers advanced parser customization, custom markup patterns, and extending Markput's parsing capabilities.

## Parser Architecture

### ParserV2 Overview

```
Input: "Hello @[Alice](123)"
        ↓
┌─────────────────────┐
│  MarkupRegistry     │  Register markup patterns
└─────────────────────┘
        ↓
┌─────────────────────┐
│  SegmentMatcher     │  Find potential mark locations
└─────────────────────┘
        ↓
┌─────────────────────┐
│  PatternMatcher     │  Match patterns against segments
└─────────────────────┘
        ↓
┌─────────────────────┐
│  TreeBuilder        │  Build token tree with nesting
└─────────────────────┘
        ↓
Output: [TextToken, MarkToken, TextToken]
```

### Parser Components

| Component | Responsibility |
|-----------|---------------|
| **MarkupRegistry** | Stores and indexes markup patterns |
| **SegmentMatcher** | Finds potential mark boundaries |
| **PatternMatcher** | Matches patterns to text segments |
| **TreeBuilder** | Builds hierarchical token tree |

## Custom Markup Patterns

### Pattern Syntax

Markput supports three placeholders:

- `__value__` - Plain text value (no nesting)
- `__meta__` - Metadata/parameters (no nesting)
- `__nested__` - Content that can contain nested marks

### Simple Patterns

```typescript
// Value only
'@[__value__]'
// Matches: @[Alice], @[Bob]

// Value with meta
'@[__value__](__meta__)'
// Matches: @[Alice](123), @[Bob](456)

// Nested content
'**__nested__**'
// Matches: **bold text**, **bold @[mention]**
```

### Complex Patterns

```typescript
// Multiple parameters
'<__value__ color="__meta__">'
// Matches: <span color="red">

// Two values pattern (matching tags)
'<__value__>__nested__</__value__>'
// Matches: <color>text</color>, <strong>bold</strong>

// Attributes and nesting
'[__value__ __meta__](__nested__)'
// Matches: [!NOTE info](This is a note)
```

### Pattern Order Matters

Parser tries patterns in order:

```typescript
const parser = new Parser([
  '@[__value__](__meta__)',  // Try first (more specific)
  '@[__value__]',            // Try second (less specific)
  '#[__value__]'             // Try third
])

// "@[Alice](123)" matches first pattern ✅
// "@[Bob]" matches second pattern ✅
// "#[react]" matches third pattern ✅
```

**Best practice:** Order from most specific to least specific.

## Advanced Pattern Examples

### Pattern 1: Wiki-Style Links

```typescript
const wikiLinkPattern = '[[__value__]]'

const parser = new Parser([wikiLinkPattern])

// Usage
const text = 'See [[JavaScript]] and [[TypeScript]]'
const tokens = parser.parse(text)

// Render
const WikiLink: FC<MarkProps> = ({ value }) => (
  <a href={`/wiki/${value}`}>{value}</a>
)
```

### Pattern 2: Mathematical Expressions

```typescript
const mathPattern = '$__value__$'

const parser = new Parser([mathPattern])

// Usage
const text = 'Formula: $E = mc^2$ is famous'

// Render with KaTeX
import katex from 'katex'

const MathMark: FC<MarkProps> = ({ value }) => {
  const html = katex.renderToString(value)
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
```

### Pattern 3: Custom Callouts

```typescript
const calloutPattern = ':::__value__\n__nested__\n:::'

const parser = new Parser([calloutPattern])

// Usage
const text = `
:::warning
This is dangerous!
:::
`

// Render
const CalloutMark: FC<MarkProps> = ({ value, children }) => (
  <div className={`callout callout-${value}`}>
    {children}
  </div>
)
```

### Pattern 4: Code with Language

```typescript
const codePattern = '```__meta__\n__nested__\n```'

const parser = new Parser([codePattern])

// Usage
const text = '```typescript\nconst x = 1\n```'

// Render with syntax highlighting
import Prism from 'prismjs'

const CodeMark: FC<MarkProps> = ({ meta, nested }) => {
  const language = meta || 'plaintext'
  const code = nested || ''
  const html = Prism.highlight(code, Prism.languages[language], language)

  return (
    <pre className={`language-${language}`}>
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  )
}
```

### Pattern 5: Emoji Shortcodes

```typescript
const emojiPattern = ':__value__:'

const parser = new Parser([emojiPattern])

const emojiMap: Record<string, string> = {
  smile: '😊',
  heart: '❤️',
  rocket: '🚀',
  fire: '🔥'
}

// Usage
const text = 'Hello :smile: :heart:'

// Render
const EmojiMark: FC<MarkProps> = ({ value }) => (
  <span role="img" aria-label={value}>
    {emojiMap[value] || `:${value}:`}
  </span>
)
```

## Validation Rules

### Pattern Validation

Validate patterns before parsing:

```typescript
function validatePattern(markup: string): boolean {
  // Must contain at least one placeholder
  const hasPlaceholder =
    markup.includes('__value__') ||
    markup.includes('__meta__') ||
    markup.includes('__nested__')

  if (!hasPlaceholder) {
    throw new Error('Pattern must contain at least one placeholder')
  }

  // Two values pattern must have matching placeholders
  const valueCount = (markup.match(/__value__/g) || []).length
  if (valueCount > 1) {
    // Check if they're in matching positions
    const openingIndex = markup.indexOf('__value__')
    const closingIndex = markup.lastIndexOf('__value__')

    if (openingIndex === closingIndex) {
      throw new Error('Two values pattern needs two __value__ placeholders')
    }
  }

  return true
}
```

### Content Validation

Validate parsed content:

```typescript
function validateMarkContent(mark: MarkToken): boolean {
  // Example: Validate mention format
  if (mark.descriptor.markup === '@[__value__](__meta__)') {
    // Value must be alphanumeric
    if (!/^[a-zA-Z0-9_]+$/.test(mark.value)) {
      return false
    }

    // Meta must be numeric ID
    if (mark.meta && !/^\d+$/.test(mark.meta)) {
      return false
    }
  }

  return true
}

// Use in parsing
function parseWithValidation(text: string, markups: Markup[]): Token[] {
  const parser = new Parser(markups)
  const tokens = parser.parse(text)

  // Validate all marks
  function validateTokens(tokens: Token[]): void {
    for (const token of tokens) {
      if (token.type === 'mark') {
        if (!validateMarkContent(token)) {
          throw new Error(`Invalid mark: ${token.content}`)
        }
        validateTokens(token.children)
      }
    }
  }

  validateTokens(tokens)
  return tokens
}
```

## Extending the Parser

### Custom Parser Wrapper

```typescript
class CustomParser extends Parser {
  private cache = new Map<string, Token[]>()

  parse(value: string): Token[] {
    // Check cache first
    if (this.cache.has(value)) {
      return this.cache.get(value)!
    }

    // Parse
    const tokens = super.parse(value)

    // Cache result
    this.cache.set(value, tokens)

    return tokens
  }

  clearCache(): void {
    this.cache.clear()
  }
}

// Usage
const parser = new CustomParser(['@[__value__]'])
const tokens = parser.parse('Hello @[Alice]') // Parsed
const tokens2 = parser.parse('Hello @[Alice]') // From cache
```

### Parser with Preprocessing

```typescript
class PreprocessingParser extends Parser {
  private preprocessors: Array<(text: string) => string> = []

  addPreprocessor(fn: (text: string) => string): void {
    this.preprocessors.push(fn)
  }

  parse(value: string): Token[] {
    // Apply preprocessors
    let processed = value
    for (const preprocessor of this.preprocessors) {
      processed = preprocessor(processed)
    }

    // Parse preprocessed text
    return super.parse(processed)
  }
}

// Usage
const parser = new PreprocessingParser(['@[__value__]'])

// Add URL auto-linking preprocessor
parser.addPreprocessor((text) => {
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    '[__link__]($1)'
  )
})

// Add emoji preprocessor
parser.addPreprocessor((text) => {
  return text.replace(
    /:(\w+):/g,
    '[:emoji:]($1)'
  )
})
```

### Parser with Postprocessing

```typescript
class PostprocessingParser extends Parser {
  parse(value: string): Token[] {
    const tokens = super.parse(value)
    return this.postprocess(tokens)
  }

  private postprocess(tokens: Token[]): Token[] {
    return tokens.map(token => {
      if (token.type === 'mark') {
        // Add custom properties
        return {
          ...token,
          custom: {
            timestamp: Date.now(),
            validated: this.validateMark(token)
          },
          children: this.postprocess(token.children)
        }
      }
      return token
    })
  }

  private validateMark(mark: MarkToken): boolean {
    // Custom validation logic
    return mark.value.length > 0
  }
}
```

## Parser Plugins

### Plugin Architecture

```typescript
interface ParserPlugin {
  name: string
  preProcess?: (text: string) => string
  postProcess?: (tokens: Token[]) => Token[]
  validate?: (tokens: Token[]) => boolean
}

class PluggableParser extends Parser {
  private plugins: ParserPlugin[] = []

  use(plugin: ParserPlugin): void {
    this.plugins.push(plugin)
  }

  parse(value: string): Token[] {
    // Apply preprocessors
    let processed = value
    for (const plugin of this.plugins) {
      if (plugin.preProcess) {
        processed = plugin.preProcess(processed)
      }
    }

    // Parse
    let tokens = super.parse(processed)

    // Apply postprocessors
    for (const plugin of this.plugins) {
      if (plugin.postProcess) {
        tokens = plugin.postProcess(tokens)
      }
    }

    // Validate
    for (const plugin of this.plugins) {
      if (plugin.validate && !plugin.validate(tokens)) {
        throw new Error(`Validation failed: ${plugin.name}`)
      }
    }

    return tokens
  }
}
```

### Plugin Examples

#### Auto-Link Plugin

```typescript
const autoLinkPlugin: ParserPlugin = {
  name: 'auto-link',
  preProcess: (text) => {
    return text.replace(
      /(https?:\/\/[^\s]+)/g,
      '<link>__nested__</link>'
    )
  }
}
```

#### Sanitization Plugin

```typescript
const sanitizationPlugin: ParserPlugin = {
  name: 'sanitize',
  postProcess: (tokens) => {
    return tokens.map(token => {
      if (token.type === 'mark') {
        // Remove dangerous content
        if (token.value.includes('<script>')) {
          return {
            type: 'text',
            content: '[removed]',
            position: token.position
          }
        }
        return {
          ...token,
          children: sanitizationPlugin.postProcess!(token.children)
        }
      }
      return token
    })
  }
}
```

#### Length Validation Plugin

```typescript
const lengthValidationPlugin: ParserPlugin = {
  name: 'length-validation',
  validate: (tokens) => {
    function checkLength(tokens: Token[]): boolean {
      for (const token of tokens) {
        if (token.type === 'mark') {
          if (token.value.length > 50) {
            return false
          }
          if (!checkLength(token.children)) {
            return false
          }
        }
      }
      return true
    }
    return checkLength(tokens)
  }
}
```

#### Usage

```typescript
const parser = new PluggableParser(['@[__value__]'])

parser.use(autoLinkPlugin)
parser.use(sanitizationPlugin)
parser.use(lengthValidationPlugin)

const tokens = parser.parse('Hello https://example.com')
```

## Advanced Patterns

### Pattern: Conditional Parsing

Parse based on context:

```typescript
class ContextualParser extends Parser {
  private context: 'markdown' | 'html' | 'plain'

  constructor(markups: Markup[], context: 'markdown' | 'html' | 'plain') {
    super(markups)
    this.context = context
  }

  parse(value: string): Token[] {
    switch (this.context) {
      case 'markdown':
        return this.parseMarkdown(value)
      case 'html':
        return this.parseHTML(value)
      case 'plain':
        return this.parsePlain(value)
    }
  }

  private parseMarkdown(value: string): Token[] {
    // Convert markdown to markup
    const converted = value
      .replace(/\*\*(.*?)\*\*/g, '**__nested__**')
      .replace(/\*(.*?)\*/g, '*__nested__*')
    return super.parse(converted)
  }

  private parseHTML(value: string): Token[] {
    // Handle HTML-like syntax
    return super.parse(value)
  }

  private parsePlain(value: string): Token[] {
    // Plain text only
    return [{ type: 'text', content: value, position: { start: 0, end: value.length } }]
  }
}
```

### Pattern: Streaming Parser

Parse incrementally for large documents:

```typescript
class StreamingParser extends Parser {
  private buffer = ''
  private tokens: Token[] = []

  feed(chunk: string): Token[] {
    this.buffer += chunk

    // Try to parse complete marks
    const newTokens = this.parseComplete(this.buffer)

    // Update buffer with remaining text
    if (newTokens.length > 0) {
      const lastToken = newTokens[newTokens.length - 1]
      this.buffer = this.buffer.substring(lastToken.position.end)
      this.tokens.push(...newTokens)
    }

    return newTokens
  }

  flush(): Token[] {
    // Parse remaining buffer
    if (this.buffer.length > 0) {
      const remaining = super.parse(this.buffer)
      this.tokens.push(...remaining)
      this.buffer = ''
    }
    return this.tokens
  }

  private parseComplete(text: string): Token[] {
    // Only return complete tokens
    const allTokens = super.parse(text)
    const complete: Token[] = []

    for (const token of allTokens) {
      if (token.type === 'text' || this.isCompleteMark(token, text)) {
        complete.push(token)
      } else {
        break // Stop at first incomplete mark
      }
    }

    return complete
  }

  private isCompleteMark(token: MarkToken, text: string): boolean {
    // Check if mark is complete based on pattern
    const markup = token.descriptor.markup
    return text.substring(token.position.start).startsWith(token.content)
  }
}

// Usage
const parser = new StreamingParser(['@[__value__]'])

// Feed chunks
parser.feed('Hello @[Al')
parser.feed('ice] and @[')
parser.feed('Bob]')

// Get all tokens
const tokens = parser.flush()
```

## Performance Optimization

### Optimize Pattern Complexity

```typescript
// ❌ Slow: Complex regex-like pattern
'@[__value__(__meta__)]'  // Ambiguous

// ✅ Fast: Clear boundaries
'@[__value__](__meta__)'  // Well-defined
```

### Cache Parser Instances

```typescript
const parserCache = new Map<string, Parser>()

function getParser(markups: Markup[]): Parser {
  const key = markups.join('|')

  if (!parserCache.has(key)) {
    parserCache.set(key, new Parser(markups))
  }

  return parserCache.get(key)!
}
```

### Limit Nesting Depth

```typescript
function limitNestingDepth(tokens: Token[], maxDepth: number): Token[] {
  function limit(tokens: Token[], depth: number): Token[] {
    if (depth >= maxDepth) {
      // Flatten to text
      return [{
        type: 'text',
        content: toString(tokens),
        position: tokens[0]?.position || { start: 0, end: 0 }
      }]
    }

    return tokens.map(token => {
      if (token.type === 'mark') {
        return {
          ...token,
          children: limit(token.children, depth + 1)
        }
      }
      return token
    })
  }

  return limit(tokens, 0)
}
```

## Testing Custom Parsers

### Unit Tests

```typescript
describe('CustomParser', () => {
  it('parses custom pattern', () => {
    const parser = new Parser(['[[__value__]]'])
    const tokens = parser.parse('Link to [[Page]]')

    expect(tokens).toHaveLength(3)
    expect(tokens[1]).toMatchObject({
      type: 'mark',
      value: 'Page'
    })
  })

  it('handles nested marks', () => {
    const parser = new Parser(['**__nested__**', '@[__value__]'])
    const tokens = parser.parse('**bold @[mention]**')

    const boldMark = tokens[0] as MarkToken
    expect(boldMark.children).toHaveLength(2)
  })

  it('validates mark content', () => {
    const parser = new CustomParser(['@[__value__]'])

    expect(() => {
      parser.parse('@[invalid space]')
    }).toThrow('Invalid mark')
  })
})
```

### Fuzzy Testing

```typescript
import { fc } from 'fast-check'

describe('Parser fuzzy tests', () => {
  it('handles arbitrary input', () => {
    const parser = new Parser(['@[__value__]'])

    fc.assert(
      fc.property(fc.string(), (input) => {
        // Should never crash
        const tokens = parser.parse(input)
        expect(Array.isArray(tokens)).toBe(true)
      })
    )
  })
})
```

## Next Steps

- **[Architecture Guide](./architecture)** - System internals
- **[Performance Guide](./performance)** - Parser optimization
- **[Core Package API](../api/core-package)** - Parser API reference

---

**See also:**
- [Configuration Guide](../guides/configuration)** - Using custom patterns
- [Core Concepts](../introduction/core-concepts) - Understanding parsing
