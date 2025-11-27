---
title: 🚧 HTML-like Tags
description: Custom HTML/BBCode tags tutorial - opening/closing tags, nested attributes, tag rendering, custom markup
keywords: [HTML tags, BBCode, custom tags, closing tags, tag attributes, nesting, XML markup]
---

This example demonstrates how to create custom HTML-like tags with the "two values pattern" for matching opening and closing tags.

## Use Case

**What we're building:**
- Custom XML/HTML-like tags (`<color>text</color>`)
- Matching opening and closing tags
- Nested tags support
- Tag attributes
- Visual tag rendering

**Where to use it:**
- BBCode editors (forums)
- Custom markup languages
- Template systems
- Rich text with semantic markup
- Educational coding platforms

## Complete Implementation

### Step 1: Define Tag Types

```tsx
// types.ts
export type TagType = 'color' | 'size' | 'bg' | 'align' | 'link' | 'box'

export interface TagProps {
  tagName: TagType
  children: React.ReactNode
  attributes?: Record<string, string>
}
```

### Step 2: Tag Component

```tsx
// CustomTag.tsx
import { FC } from 'react'
import type { TagProps } from './types'
import './CustomTag.css'

export const CustomTag: FC<TagProps> = ({ tagName, children, attributes }) => {
  switch (tagName) {
    case 'color':
      return (
        <span className="tag-color" style={{ color: attributes?.value || 'black' }}>
          {children}
        </span>
      )

    case 'size':
      return (
        <span
          className="tag-size"
          style={{ fontSize: `${attributes?.value || '16'}px` }}
        >
          {children}
        </span>
      )

    case 'bg':
      return (
        <span
          className="tag-bg"
          style={{ backgroundColor: attributes?.value || '#ffeb3b', padding: '2px 6px' }}
        >
          {children}
        </span>
      )

    case 'align':
      return (
        <div
          className="tag-align"
          style={{ textAlign: (attributes?.value as any) || 'left' }}
        >
          {children}
        </div>
      )

    case 'link':
      return (
        <a
          href={attributes?.url || '#'}
          className="tag-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      )

    case 'box':
      return (
        <div className="tag-box" style={{ borderColor: attributes?.color || '#2196f3' }}>
          {children}
        </div>
      )

    default:
      return <span>{children}</span>
  }
}
```

```css
/* CustomTag.css */
.tag-color {
  font-weight: 500;
}

.tag-size {
  display: inline-block;
}

.tag-bg {
  border-radius: 4px;
}

.tag-align {
  margin: 8px 0;
}

.tag-link {
  color: #2196f3;
  text-decoration: underline;
  cursor: pointer;
}

.tag-link:hover {
  color: #1976d2;
}

.tag-box {
  border: 2px solid;
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
}
```

### Step 3: Tag Palette

```tsx
// TagPalette.tsx
import { FC } from 'react'
import './TagPalette.css'

interface TagInfo {
  name: string
  syntax: string
  description: string
  example: string
}

const AVAILABLE_TAGS: TagInfo[] = [
  {
    name: 'color',
    syntax: '<color=red>text</color>',
    description: 'Change text color',
    example: '<color=blue>Blue text</color>'
  },
  {
    name: 'size',
    syntax: '<size=20>text</size>',
    description: 'Change font size (px)',
    example: '<size=24>Big text</size>'
  },
  {
    name: 'bg',
    syntax: '<bg=#ffeb3b>text</bg>',
    description: 'Highlight background',
    example: '<bg=#ffeb3b>Highlighted</bg>'
  },
  {
    name: 'align',
    syntax: '<align=center>text</align>',
    description: 'Text alignment',
    example: '<align=center>Centered</align>'
  },
  {
    name: 'link',
    syntax: '<link=url>text</link>',
    description: 'Create hyperlink',
    example: '<link=https://example.com>Click here</link>'
  },
  {
    name: 'box',
    syntax: '<box color=blue>text</box>',
    description: 'Bordered box',
    example: '<box color=red>Important</box>'
  }
]

export const TagPalette: FC<{ onInsert: (syntax: string) => void }> = ({
  onInsert
}) => {
  return (
    <aside className="tag-palette">
      <h3>Available Tags</h3>
      <div className="tag-list">
        {AVAILABLE_TAGS.map((tag) => (
          <div key={tag.name} className="tag-info">
            <div className="tag-header">
              <strong className="tag-name">&lt;{tag.name}&gt;</strong>
              <button
                className="insert-button"
                onClick={() => onInsert(tag.syntax)}
                title="Insert tag"
              >
                +
              </button>
            </div>
            <div className="tag-description">{tag.description}</div>
            <code className="tag-syntax">{tag.syntax}</code>
          </div>
        ))}
      </div>
    </aside>
  )
}
```

```css
/* TagPalette.css */
.tag-palette {
  width: 320px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  max-height: 600px;
  overflow-y: auto;
}

.tag-palette h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #212121;
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tag-info {
  padding: 12px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.tag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tag-name {
  font-family: monospace;
  color: #d32f2f;
  font-size: 14px;
}

.insert-button {
  width: 24px;
  height: 24px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 700;
  transition: background-color 0.2s;
}

.insert-button:hover {
  background-color: #1976d2;
}

.tag-description {
  font-size: 13px;
  color: #616161;
  margin-bottom: 6px;
}

.tag-syntax {
  display: block;
  font-family: monospace;
  font-size: 12px;
  background-color: white;
  padding: 6px 8px;
  border-radius: 4px;
  color: #424242;
}
```

### Step 4: HTML-like Tag Editor

```tsx
// HtmlLikeEditor.tsx
import { FC, useState } from 'react'
import { MarkedInput } from 'rc-marked-input'
import { CustomTag } from './CustomTag'
import { TagPalette } from './TagPalette'
import type { TagType, TagProps } from './types'
import './HtmlLikeEditor.css'

export const HtmlLikeEditor: FC = () => {
  const [value, setValue] = useState(
    'Try these tags:\n\n<color=blue>Blue text</color>\n<size=24>Large text</size>\n<bg=#ffeb3b>Highlighted</bg>\n\nNested: <color=red>Red with <size=20>large</size> inside</color>'
  )

  const handleInsert = (syntax: string) => {
    setValue((prev) => prev + '\n' + syntax)
  }

  // Parse attributes from meta string
  const parseAttributes = (meta: string): Record<string, string> => {
    const attrs: Record<string, string> = {}

    // Handle single value: "red" or "20"
    if (!meta.includes('=') && !meta.includes(' ')) {
      attrs.value = meta
      return attrs
    }

    // Handle key=value pairs: "color=red size=20"
    const pairs = meta.match(/(\w+)=([^\s]+)/g) || []
    pairs.forEach((pair) => {
      const [key, val] = pair.split('=')
      attrs[key] = val
    })

    return attrs
  }

  const tagOptions = [
    {
      markup: '<__value__>__nested__</__value__>',
      slots: {
        mark: (props: any) => {
          const tagName = props.value as TagType
          const attributes = parseAttributes(props.meta || '')

          return (
            <CustomTag tagName={tagName} attributes={attributes}>
              {props.children}
            </CustomTag>
          )
        }
      },
      slotProps: {
        mark: ({ value, meta, children }: any) => ({
          value,
          meta,
          children
        })
      }
    }
  ]

  return (
    <div className="html-like-editor-layout">
      <main className="html-like-editor-main">
        <h2>HTML-like Tags Demo</h2>
        <p className="hint">
          Use custom tags like &lt;color=red&gt;text&lt;/color&gt;
        </p>

        <MarkedInput
          value={value}
          onChange={setValue}
          Mark={CustomTag}
          options={tagOptions}
          slotProps={{
            container: {
              className: 'html-like-editor',
              placeholder: 'Type here...'
            }
          }}
        />

        <div className="editor-help">
          <strong>Two Values Pattern:</strong> Opening and closing tags must match.
          Use &lt;tagName=value&gt;content&lt;/tagName&gt; syntax.
        </div>
      </main>

      <TagPalette onInsert={handleInsert} />
    </div>
  )
}
```

```css
/* HtmlLikeEditor.css */
.html-like-editor-layout {
  display: flex;
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.html-like-editor-main {
  flex: 1;
  min-width: 0;
}

.html-like-editor-main h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #212121;
}

.hint {
  margin: 0 0 16px 0;
  color: #757575;
  font-size: 14px;
}

.html-like-editor {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  min-height: 400px;
  font-size: 16px;
  line-height: 1.8;
  outline: none;
  transition: border-color 0.2s ease;
}

.html-like-editor:focus {
  border-color: #2196f3;
}

.html-like-editor:empty::before {
  content: attr(placeholder);
  color: #bdbdbd;
  pointer-events: none;
}

.editor-help {
  margin-top: 16px;
  padding: 12px;
  background-color: #e3f2fd;
  border-radius: 8px;
  font-size: 14px;
  color: #1565c0;
}

@media (max-width: 1024px) {
  .html-like-editor-layout {
    flex-direction: column;
  }

  .tag-palette {
    width: 100%;
  }
}
```

## Variations

### Variation 1: Self-Closing Tags

```tsx
const selfClosingOptions = [
  {
    markup: '<__value__ />',
    slots: {
      mark: (props: any) => {
        switch (props.value) {
          case 'br':
            return <br />
          case 'hr':
            return <hr />
          default:
            return null
        }
      }
    }
  }
]

// Usage: <br /> or <hr />
```

### Variation 2: Complex Attributes

```tsx
const parseComplexAttributes = (meta: string) => {
  // Supports: <tag color="red" size="20" border>
  const attrs: Record<string, string | boolean> = {}

  const regex = /(\w+)(?:=(?:"([^"]*)"|(\S+)))?/g
  let match

  while ((match = regex.exec(meta))) {
    const [, key, quotedValue, unquotedValue] = match
    attrs[key] = quotedValue || unquotedValue || true
  }

  return attrs
}
```

### Variation 3: Tag Validation

```tsx
const validateTag = (
  opening: string,
  closing: string
): { valid: boolean; error?: string } => {
  if (opening !== closing) {
    return {
      valid: false,
      error: `Mismatched tags: <${opening}> and </${closing}>`
    }
  }

  const allowedTags = ['color', 'size', 'bg', 'link', 'box']
  if (!allowedTags.includes(opening)) {
    return {
      valid: false,
      error: `Unknown tag: <${opening}>`
    }
  }

  return { valid: true }
}
```
