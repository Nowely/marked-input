---
title: How It Works
description: Learn how Markput works - marks, tokens, parsing, overlay system, nested marks, and state management for React text editors
keywords:
    [
        how it works,
        architecture,
        marks,
        tokens,
        parsing,
        overlay,
        nested marks,
        state management,
        component design,
        token tree,
    ]
---

This guide explains how Markput works under the hood. Understanding these concepts will help you build more sophisticated editors and troubleshoot issues effectively.

> **TL;DR**: Markput turns text patterns into React components. You define patterns like `@[__value__]`, Markput parses them into tokens, and renders them as your custom components.

## The Big Picture

<details>
<summary><strong>Visual Overview (Optional)</strong></summary>

Markput transforms plain text with special patterns into interactive React components. Here's the flow:

```
Plain Text with Patterns
         ↓
    [Parser]
         ↓
   Token Tree
         ↓
    [Renderer]
         ↓
  React Components
```

This process happens automatically when you type, and the result is a fully interactive editor.

</details>

## Marks vs Tokens

### Marks

A **mark** is a special pattern in your text that gets rendered as a React component. It highlights or transforms specific text segments into interactive elements.

```tsx
'Hello @[World](meta)!'
//     ↑          ↑
//     Mark boundaries
```

**Mark Properties:**

- **Content**: The entire matched pattern `@[World](meta)`
- **Value**: The text to display `"World"`
- **Meta**: Optional metadata `"meta"`
- **Position**: Start and end indices in the original string

### Tokens

A **token** is the internal representation used by Markput's parser. Your text is broken down into tokens:

```tsx
'Hello @[World](meta)!'[
    // Becomes this token tree:
    ({type: 'text', content: 'Hello '},
    {type: 'mark', value: 'World', meta: 'meta', content: '@[World](meta)'},
    {type: 'text', content: '!'})
]
```

**Token Types:**

- **TextToken**: Plain text segments
- **MarkToken**: Marked segments (rendered as your Mark component)

## Markup Patterns

Markup patterns define how marks are identified in your text. They use placeholder syntax:

### Placeholders

| Placeholder  | Description                          | Supports Nesting |
| ------------ | ------------------------------------ | ---------------- |
| `__value__`  | Main content (plain text only)       | ❌ No            |
| `__meta__`   | Metadata (plain text only)           | ❌ No            |
| `__nested__` | Content that can contain other marks | ✅ Yes           |

### Common Patterns

```tsx
// Basic mention
'@[__value__]'
// Matches: @[Alice], @[Bob]

// Mention with metadata
'@[__value__](__meta__)'
// Matches: @[Alice](user:1), @[Bob](user:2)

// Hashtag
'#[__value__]'
// Matches: #[react], #[javascript]

// Bold (supports nesting)
'**__nested__**'
// Matches: **bold text**, **bold with *italic* inside**

// HTML-like (two values pattern)
'<__value__>__nested__</__value__>'
// Matches: <div>content</div>, <span>text</span>
```

### Pattern Matching Rules

1. **Greedy Matching**: Patterns are matched from left to right, longest match first
2. **Non-Overlapping**: A character can only belong to one mark
3. **Escape Sequences**: (Not currently supported - use custom parsers for complex escaping)

## The Parsing Process

<details>
<summary><strong>How Markput Parses Text (Deep Dive)</strong></summary>

Let's walk through how Markput processes your text step-by-step:

### Step 1: Preparsing

The text is scanned for potential mark boundaries.

```tsx
Input: 'Hello @[World](meta) and @[Alice](user:1)!'
       ↓
Identifies: Two potential marks at positions 6-22 and 27-42
```

### Step 2: Pattern Matching

Each potential mark is tested against your markup patterns.

```tsx
Markup: '@[__value__](__meta__)'
       ↓
Test: '@[World](meta)' → ✅ Match!
      value: 'World', meta: 'meta'
       ↓
Test: '@[Alice](user:1)' → ✅ Match!
      value: 'Alice', meta: 'user:1'
```

### Step 3: Tokenization

The text is broken into tokens.

```tsx
[
  { type: 'text', content: 'Hello ' },
  { type: 'mark', value: 'World', meta: 'meta', ... },
  { type: 'text', content: ' and ' },
  { type: 'mark', value: 'Alice', meta: 'user:1', ... },
  { type: 'text', content: '!' }
]
```

### Step 4: Rendering

Each token is rendered as a React element.

```tsx
TextToken → <span>Hello </span>
MarkToken → <Mark value="World" meta="meta" />
TextToken → <span> and </span>
MarkToken → <Mark value="Alice" meta="user:1" />
TextToken → <span>!</span>
```

**Key insight**: This happens for every keystroke, keeping tokens in sync with your text.

</details>

## Nested Marks

Nested marks allow hierarchical structures. Use `__nested__` to enable nesting:

```tsx
// Flat (no nesting)
markup: '*__value__*'
value: '*bold with *italic* inside*'
// Result: One mark with value = "bold with *italic* inside"

// Nested (supports hierarchy)
markup: '*__nested__*'
value: '*bold with *italic* inside*'
// Result: Parent mark contains child mark
```

### Token Tree for Nested Marks

<details>
<summary><strong>Token Structure Example (Advanced)</strong></summary>

```tsx
'**bold with *italic* text**'

// Token tree:
{
  type: 'mark',
  value: undefined,
  nested: 'bold with *italic* text',
  children: [
    { type: 'text', content: 'bold with ' },
    {
      type: 'mark',
      value: undefined,
      nested: 'italic',
      children: [
        { type: 'text', content: 'italic' }
      ]
    },
    { type: 'text', content: ' text' }
  ]
}
```

Notice the `children` array - this is what makes nesting possible. Each mark can contain text and other marks.

</details>

### Rendering Nested Marks

When a mark has `children`, they're rendered as React children:

```tsx
const Mark = ({children, nested}) => {
    // For nested marks, use children (ReactNode)
    if (children) {
        return <strong>{children}</strong>
    }
    // For flat marks, use nested string
    return <strong>{nested}</strong>
}
```

## The Overlay System

The overlay system handles autocomplete and suggestion menus.

### Trigger Flow

```
User types '@'
      ↓
Trigger detected
      ↓
Overlay rendered
      ↓
User selects 'Alice'
      ↓
Text updated: '@[Alice]'
      ↓
Overlay closed
```

### Overlay Lifecycle

1. **Detection**: Text change matches a trigger character
2. **Rendering**: Overlay component is rendered with suggestions
3. **Positioning**: Overlay is positioned at caret location
4. **Selection**: User selects an item or closes overlay
5. **Insertion**: Selected value is inserted as a mark
6. **Cleanup**: Overlay is unmounted

### Overlay Props

The `useOverlay()` hook provides:

```tsx
{
  style: { left: 120, top: 45 }, // Caret position
  close: () => {...},             // Close the overlay
  select: (item) => {...},        // Insert a mark
  match: {                        // Match details
    value: 'ali',                 // Current typed text
    source: '@ali',               // Full matched string
    trigger: '@'                  // The trigger character
  },
  ref: overlayRef                 // For outside click detection
}
```

## Component Architecture

<details>
<summary><strong>Internal Architecture (For Curious Minds)</strong></summary>

### High-Level Structure

```
<MarkedInput>
  └── <Container> (editable div)
      ├── <TextSpan> (plain text)
      ├── <Mark> (your component)
      ├── <TextSpan> (plain text)
      └── <Overlay> (if triggered)
```

### Props Flow

```
MarkedInput Props
       ↓
[Configuration Layer]
       ↓
[Parser + Store]
       ↓
[Token Renderer]
       ↓
React Components
       ↓
User Interaction
       ↓
Events → onChange
       ↓
Update State
```

The key insight: Everything flows through the store, which triggers re-renders only when tokens change.

</details>

## State Management

Markput uses an internal store for managing editor state:

```tsx
Store State:
{
  value: string,              // Current text
  tokens: Token[],            // Parsed token tree
  selection: Range,           // Cursor/selection position
  overlay: OverlayState,      // Overlay visibility & data
  focused: boolean            // Focus state
}
```

### Controlled vs Uncontrolled

```tsx
// ✅ Controlled (recommended)
const [value, setValue] = useState('')
<MarkedInput value={value} onChange={setValue} />

// ⚠️ Uncontrolled (less common)
<MarkedInput defaultValue="initial" />
```

## Event System

### Built-in Events

| Event               | When Triggered    | Use Case             |
| ------------------- | ----------------- | -------------------- |
| `onChange`          | Text changes      | Update parent state  |
| `onFocus`           | Editor focused    | Show toolbar         |
| `onBlur`            | Editor blurred    | Hide toolbar         |
| `onKeyDown`         | Key pressed       | Custom shortcuts     |
| `onSelectionChange` | Selection changes | Update toolbar state |

### Custom Event Listeners

Use `useListener` hook for custom events:

```tsx
import {useListener} from '@markput/react'

const Mark = () => {
    useListener(
        'customEvent',
        data => {
            console.log('Custom event:', data)
        },
        []
    )

    return <span>Mark</span>
}
```

## Options System

Options allow per-pattern configuration. Each pattern can have its own Mark component and overlay:

```tsx
<MarkedInput
    options={[
        {
            markup: '@[__value__](__meta__)', // Pattern 1: mentions
            slots: {mark: MentionComponent},
            slotProps: {overlay: {trigger: '@', data: users}},
        },
        {
            markup: '#[__value__]', // Pattern 2: hashtags
            slots: {mark: HashtagComponent},
            slotProps: {overlay: {trigger: '#', data: hashtags}},
        },
    ]}
/>
```

<details>
<summary><strong>Advanced: Full Example with Props Transform</strong></summary>

```tsx
<MarkedInput
    options={[
        {
            markup: '@[__value__](__meta__)',
            slots: {
                mark: MentionComponent,
                overlay: MentionOverlay,
            },
            slotProps: {
                mark: ({value, meta}) => ({
                    // Transform extracted props
                    label: value,
                    userId: meta,
                }),
                overlay: {
                    // Static overlay config
                    trigger: '@',
                    data: users,
                },
            },
        },
    ]}
/>
```

### Option Resolution Priority

```
1. option.slots.mark       (highest priority)
2. MarkedInput.Mark prop
3. undefined               (error if no Mark provided)
```

</details>

## Performance Considerations

<details>
<summary><strong>Performance Tips & Optimization (Optional Reading)</strong></summary>

### Re-render Optimization

Markput minimizes re-renders:

- Token tree is memoized
- Components re-render only when their token changes
- Use `React.memo` for expensive Mark components

```tsx
const ExpensiveMark = React.memo(({value}) => {
    // Complex rendering logic
    return <span>{value}</span>
})
```

### Large Documents

For large documents (1000+ marks):

- Consider debouncing `onChange`
- Use `defaultValue` if possible
- Implement virtualization for mark lists

For more details, see the [Performance Optimization](/development/performance) guide.

</details>

## Debugging Tips

<details>
<summary><strong>Troubleshooting & Debug Tools</strong></summary>

### Visualize Tokens

```tsx
import {parse} from '@markput/core'

const tokens = parse(value, [{markup: '@[__value__]'}])
console.log(JSON.stringify(tokens, null, 2))
```

This is your best friend for understanding what Markput "sees" in your text.

### Check Markup Matching

```tsx
// Enable debug mode (if available)
<MarkedInput debug value={value} onChange={setValue} />
// Check console for parsing logs
```

### Common Issues & Solutions

| Issue               | Cause                          | Solution                                              |
| ------------------- | ------------------------------ | ----------------------------------------------------- |
| Marks not rendering | Markup pattern mismatch        | Check pattern syntax with console.log                 |
| Infinite re-renders | onChange creates new reference | Use `useCallback`                                     |
| TypeScript errors   | Generic type mismatch          | Specify types explicitly in `<MarkedInput<YourType>>` |
| Overlay not showing | Trigger mismatch               | Check that trigger character matches your pattern     |

</details>

---

**Still stuck?** Ask in [GitHub Discussions](https://github.com/Nowely/marked-input/discussions).
