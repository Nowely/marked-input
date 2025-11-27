---
title: 🚧 Nested Marks
description: Nested marks tutorial - hierarchical text structures, __nested__ placeholder, markdown formatting, HTML-like tags in Markput
keywords: [nested marks, hierarchical structures, token tree, children, markdown, HTML-like tags, nesting]
---

Nested marks allow you to create rich, hierarchical text structures where marks can contain other marks. This enables complex formatting scenarios like markdown-style text, HTML-like tags, and multi-level mark structures.

## Understanding Nesting

### Flat vs Nested

**Flat marks** (`__value__`): Content is plain text, nested patterns are ignored.

```tsx
markup: '@[__value__]'
value: '@[Hello *world*]'
// Result: One mark with value = "Hello *world*" (literal asterisks)
```

**Nested marks** (`__nested__`): Content can contain other marks.

```tsx
markup: '*__nested__*'
value: '*Hello **world***'
// Result: Italic mark containing "Hello " + bold mark "world"
```

### Key Differences

| Feature | `__value__` | `__nested__` |
|---------|-------------|--------------|
| **Content Type** | Plain text | Supports child marks |
| **Parsing** | No recursive parsing | Recursive parsing |
| **Props** | `value` string | `children` ReactNode + `nested` string |
| **Use Case** | Simple marks | Hierarchical structures |

## Enabling Nested Marks

Use the `__nested__` placeholder instead of `__value__`:

```tsx
// ✅ Supports nesting
const NestedMarkup = '**__nested__**'

// ❌ Does not support nesting
const FlatMarkup = '**__value__**'
```

**Example: Markdown-style formatting**

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

const FormatMark = ({ children, nested }) => {
  // For nested marks, children is ReactNode
  // For flat marks, nested is string
  return <span>{children || nested}</span>
}

function MarkdownEditor() {
  const [value, setValue] = useState('This is **bold with *italic* inside**')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={FormatMark}
      options={[
        {
          markup: '**__nested__**',
          slotProps: {
            mark: ({ children }) => ({
              children,
              style: { fontWeight: 'bold' }
            })
          }
        },
        {
          markup: '*__nested__*',
          slotProps: {
            mark: ({ children }) => ({
              children,
              style: { fontStyle: 'italic' }
            })
          }
        }
      ]}
    />
  )
}
```

## Props for Nested Marks

When using `__nested__`, your Mark component receives:

```tsx
interface MarkProps {
  value?: string      // undefined for nested marks
  meta?: string       // Metadata (if __meta__ used)
  nested?: string     // Raw nested content as string
  children?: ReactNode // Rendered nested children (use this!)
}
```

### children vs nested

| Prop | Type | Description | When to Use |
|------|------|-------------|-------------|
| `children` | `ReactNode` | Rendered child marks | **Recommended** - for rendering |
| `nested` | `string` | Raw text content | Edge cases - for processing raw text |

**Example:**

```tsx
function NestedMark({ children, nested }) {
  // ✅ Recommended: Use children
  return <strong>{children}</strong>

  // ⚠️ Edge case: Use nested for raw text
  // return <strong>{nested?.toUpperCase()}</strong>
}
```

## Simple Nesting Example

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function SimpleMark({ children, style }) {
  return <span style={style}>{children}</span>
}

function SimpleNested() {
  const [value, setValue] = useState(
    'Text with **bold and *italic* formatting**'
  )

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={SimpleMark}
      options={[
        {
          markup: '**__nested__**',
          slotProps: {
            mark: ({ children }) => ({
              children,
              style: { fontWeight: 'bold' }
            })
          }
        },
        {
          markup: '*__nested__*',
          slotProps: {
            mark: ({ children }) => ({
              children,
              style: { fontStyle: 'italic' }
            })
          }
        }
      ]}
    />
  )
}
```

**Output for** `'**bold *italic***'`:
```html
<span style="font-weight: bold">
  bold
  <span style="font-style: italic">italic</span>
</span>
```

## Two Values Pattern (HTML-like Tags)

ParserV2 supports **two values patterns** where opening and closing tags must match:

```tsx
markup: '<__value__>__nested__</__value__>'
```

**How it works:**
- Pattern contains exactly **two** `__value__` placeholders
- Both values must be **identical** to match
- Perfect for HTML/XML-like structures

### HTML-like Tags Example

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function HtmlLikeMark({ value, children, nested }) {
  // Use value as the HTML tag name
  const Tag = (value || 'span') as React.ElementType
  return <Tag>{children || nested}</Tag>
}

function HtmlEditor() {
  const [value, setValue] = useState(
    '<div>Container with <mark>highlighted text</mark> and <b>bold with <i>italic</i></b></div>'
  )

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={HtmlLikeMark}
      options={[
        { markup: '<__value__>__nested__</__value__>' }
      ]}
    />
  )
}
```

**Matching rules:**
```tsx
// ✅ Valid - tags match
'<div>content</div>'
'<span>content</span>'

// ❌ Invalid - tags don't match
'<div>content</span>'  // Won't be recognized
'<b>content</i>'       // Won't be recognized
```

### Custom Two Values Patterns

```tsx
// BBCode-style
markup: '[__value__]__nested__[/__value__]'
// Matches: [b]text[/b], [i]text[/i]

// Template tags
markup: '{{__value__}}__nested__{{/__value__}}'
// Matches: {{section}}content{{/section}}

// Custom brackets
markup: '<<__value__>>__nested__<</value__>>'
// Matches: <<tag>>content<</tag>>
```

## Deep Nesting

Marks can be nested to any depth:

```tsx
'**bold with *italic with ~~strikethrough~~***'

// Renders as:
<bold>
  bold with
  <italic>
    italic with
    <strikethrough>strikethrough</strikethrough>
  </italic>
</bold>
```

**Example: Multi-level formatting**

```tsx
function MultiLevelEditor() {
  const [value, setValue] = useState(
    'Normal **bold *italic ~~strike !!highlight!!~~***'
  )

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={({ children }) => <span>{children}</span>}
      options={[
        {
          markup: '**__nested__**',
          slotProps: { mark: ({ children }) => ({
            children,
            style: { fontWeight: 'bold' }
          })}
        },
        {
          markup: '*__nested__*',
          slotProps: { mark: ({ children }) => ({
            children,
            style: { fontStyle: 'italic' }
          })}
        },
        {
          markup: '~~__nested__~~',
          slotProps: { mark: ({ children }) => ({
            children,
            style: { textDecoration: 'line-through' }
          })}
        },
        {
          markup: '!!__nested__!!',
          slotProps: { mark: ({ children }) => ({
            children,
            style: { background: 'yellow' }
          })}
        }
      ]}
    />
  )
}
```

## Accessing Nesting Information

Use `useMark()` hook to access nesting details:

```tsx
import { useMark } from 'rc-marked-input'

function NestedAwareMark({ children }) {
  const { depth, hasChildren, parent, children: tokens } = useMark()

  return (
    <div style={{ marginLeft: depth * 20, border: '1px solid #ccc' }}>
      <div>
        Depth: {depth} |
        Has children: {hasChildren ? 'Yes' : 'No'} |
        Parent: {parent?.value || 'None'}
      </div>
      <div>{children}</div>
    </div>
  )
}
```

### Nesting Properties

| Property | Type | Description |
|----------|------|-------------|
| `depth` | `number` | Nesting level (0 = root) |
| `hasChildren` | `boolean` | Whether mark has nested children |
| `parent` | `MarkToken \| undefined` | Parent mark token |
| `children` | `Token[]` | Array of child tokens |

**Example: Collapsible nested structure**

```tsx
function CollapsibleMark({ children }) {
  const { label, hasChildren, depth } = useMark()
  const [collapsed, setCollapsed] = useState(false)

  if (!hasChildren) {
    return <span>{label}</span>
  }

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <button onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? '▶' : '▼'}
      </button>
      <strong>{label}</strong>
      {!collapsed && <div className="children">{children}</div>}
    </div>
  )
}
```

## Mixed Nesting and Metadata

Combine `__nested__` with `__meta__`:

```tsx
markup: '@[__nested__](__meta__)'
```

**Example: Colored nested text**

```tsx
function ColoredMark({ children, meta }) {
  const colors = {
    red: '#ffebee',
    blue: '#e3f2fd',
    green: '#e8f5e9'
  }

  return (
    <span style={{ background: colors[meta] || 'transparent' }}>
      {children}
    </span>
  )
}

// Usage
<MarkedInput
  value="@[Red text with **bold**](red) and @[Blue](blue)"
  Mark={ColoredMark}
  options={[
    { markup: '@[__nested__](__meta__)' },
    { markup: '**__nested__**', slotProps: { mark: ({ children }) => ({
      children,
      style: { fontWeight: 'bold' }
    })}}
  ]}
/>
```

## Complete Examples

### Example 1: Markdown Editor

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function MarkdownMark({ children, nested }) {
  return <span>{children || nested}</span>
}

function MarkdownEditor() {
  const [value, setValue] = useState(
    'This is **bold**, this is *italic*, and this is **bold with *italic* inside**.'
  )

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={MarkdownMark}
      options={[
        {
          markup: '**__nested__**',
          slotProps: {
            mark: ({ children }) => ({
              children,
              style: { fontWeight: 'bold' }
            })
          }
        },
        {
          markup: '*__nested__*',
          slotProps: {
            mark: ({ children }) => ({
              children,
              style: { fontStyle: 'italic' }
            })
          }
        }
      ]}
    />
  )
}
```

### Example 2: HTML Tag Editor

```tsx
function HtmlTagMark({ value, children }) {
  // Map tag names to React components or HTML elements
  const tagMap: Record<string, React.ElementType> = {
    div: 'div',
    span: 'span',
    p: 'p',
    b: 'strong',
    i: 'em',
    mark: 'mark',
    code: 'code'
  }

  const Tag = tagMap[value || 'span'] || 'span'

  return <Tag>{children}</Tag>
}

function HtmlEditor() {
  const [value, setValue] = useState(
    '<div>Article with <mark>highlighted <b>bold</b> text</mark></div>'
  )

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={HtmlTagMark}
      options={[
        { markup: '<__value__>__nested__</__value__>' }
      ]}
    />
  )
}
```

### Example 3: Custom BBCode

```tsx
function BBCodeMark({ value, children }) {
  const styles: Record<string, React.CSSProperties> = {
    b: { fontWeight: 'bold' },
    i: { fontStyle: 'italic' },
    u: { textDecoration: 'underline' },
    color: { color: 'red' },
    size: { fontSize: '20px' }
  }

  return (
    <span style={styles[value || '']}>
      {children}
    </span>
  )
}

function BBCodeEditor() {
  const [value, setValue] = useState(
    '[b]Bold [i]and italic[/i][/b] with [color]red text[/color]'
  )

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={BBCodeMark}
      options={[
        { markup: '[__value__]__nested__[/__value__]' }
      ]}
    />
  )
}
```

## Performance Considerations

### Rendering Performance

Nested marks create more React elements:

```tsx
// Flat: 1 mark = 1 React element
'@[simple]' → <Mark>simple</Mark>

// Nested: Multiple React elements
'**bold *italic***' → <Mark><Mark>italic</Mark></Mark>
```

**Optimization tips:**

1. **Memoize Mark component:**
```tsx
const Mark = React.memo(({ children }) => <span>{children}</span>)
```

2. **Limit nesting depth for large documents:**
```tsx
// Set reasonable max depth in parser config (if supported)
maxDepth: 5
```

3. **Use flat marks when possible:**
```tsx
// If you don't need nesting, use __value__
markup: '@[__value__]'  // Faster than __nested__
```

### Parsing Performance

Deep nesting requires recursive parsing:

```tsx
// Fast: 1 level
'**bold**'

// Slower: 5 levels
'**a *b ~~c __d !!e!!__~~***'
```

**Best practices:**
- Avoid unnecessarily deep nesting (>5 levels)
- Use flat marks for simple cases
- Profile with React DevTools for large documents

## Best Practices

### ✅ Do

```tsx
// Use children for rendering
<span>{children}</span>

// Provide fallback for non-nested
<span>{children || nested}</span>

// Memoize expensive Mark components
const Mark = React.memo(({ children }) => <span>{children}</span>)

// Type your component properly
function Mark({ children }: { children?: ReactNode }) {
  return <span>{children}</span>
}
```

### ❌ Don't

```tsx
// Don't modify children directly
function Bad({ children }) {
  return <span>{children.toUpperCase()}</span> // Error!
}

// Don't use value with __nested__
function Bad({ value }) {
  return <span>{value}</span> // value is undefined!
}

// Don't create infinite loops
markup: '**__nested__**'
value: '**text **nested****' // Can cause issues
```

## TypeScript Support

Type your nested Mark components:

```tsx
import type { ReactNode } from 'react'

interface NestedMarkProps {
  value?: string
  meta?: string
  nested?: string
  children?: ReactNode  // Important for nested marks
}

function TypedMark({ children, nested }: NestedMarkProps) {
  return <span>{children || nested}</span>
}
```

**For HTML-like tags:**

```tsx
interface HtmlMarkProps {
  value?: string      // Tag name
  children?: ReactNode
}

function HtmlMark({ value, children }: HtmlMarkProps) {
  const Tag = (value || 'span') as React.ElementType
  return <Tag>{children}</Tag>
}
```

**Key Takeaways:**
- Use `__nested__` placeholder for hierarchical structures
- Render `children` prop in your Mark component
- Two values pattern (`<__value__>...</__value__>`) for matching tags
- Access nesting info with `useMark()` hook
- Optimize with `React.memo` for better performance
