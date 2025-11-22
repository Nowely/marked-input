---
title: Nested Marks
description: Creating hierarchical text structures with nested marks
---

Marked Input supports nested marks, allowing you to create rich, hierarchical text structures. Nested marks enable complex formatting scenarios like markdown-style text, HTML-like tags, and multi-level annotations.

## Enabling Nested Marks

To enable nesting, use the `__nested__` placeholder in your markup pattern instead of `__value__`:

```tsx
// ✅ Supports nesting
const NestedMarkup = '@[__nested__]'

// ❌ Does not support nesting (plain text only)
const FlatMarkup = '@[__value__]'
```

**Key Differences:**

- `__value__` - Content is treated as plain text, nested patterns are ignored
- `__nested__` - Content supports nested structures, nested patterns are parsed

## Simple Nesting Example

```tsx
import {MarkedInput} from 'rc-marked-input'
import {useState} from 'react'

const NestedMark = ({children, style}: {value?: string; children?: ReactNode; style?: React.CSSProperties}) => (
    <span style={style}>{children}</span>
)

const App = () => {
    const [value, setValue] = useState('This is **bold with *italic* inside**')

    return (
        <MarkedInput
            Mark={NestedMark}
            value={value}
            onChange={setValue}
            options={[
                {
                    markup: '**__nested__**',
                    slotProps: { mark: ({value, children}) => ({
                        value,
                        children,
                        style: {fontWeight: 'bold'},
                    }),
                },
                {
                    markup: '*__nested__*',
                    slotProps: { mark: ({value, children}) => ({
                        value,
                        children,
                        style: {fontStyle: 'italic'},
                    }),
                },
            ]}
        />
    )
}
```

## HTML-like Tags with Two Values

ParserV2 supports **two values** patterns where a markup contains two `__value__` placeholders that must match. This is perfect for HTML-like tags where opening and closing tags should be identical.

```tsx
const HtmlLikeMark = ({children, value, nested}: {value?: string; children?: ReactNode; nested?: string}) => {
    // Use value as HTML element name (e.g., "div", "span", "mark")
    const Tag = value! as React.ElementType
    return <Tag>{children || nested}</Tag>
}

const App = () => {
    const [value, setValue] = useState(
        '<div>This is a div with <mark>a mark inside</mark> and <b>bold text with <del>nested del</del></b></div>'
    )

    return (
        <MarkedInput
            Mark={HtmlLikeMark}
            value={value}
            onChange={setValue}
            options={[
                // Two values pattern: both __value__ must be identical
                {markup: '<__value__>__nested__</__value__>'},
            ]}
        />
    )
}
```

**Two Values Pattern Rules:**

- Contains exactly two `__value__` placeholders
- Both values must be identical (e.g., `<div>` and `</div>`)
- If values don't match, the pattern won't be recognized
- Perfect for HTML/XML-like structures where tags must match

**Examples of valid two values patterns:**

- `<__value__>__nested__</__value__>` - HTML tags
- `[__value__]__nested__[/__value__]` - BBCode-style tags
- `{{__value__}}__nested__{{/__value__}}` - Template tags

