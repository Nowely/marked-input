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

## Core Editor Engine

Markput's core owns the editor-engine primitives:

- token addresses and token index validation
- adapter DOM registration through the ref registries (`store.tokens.control()` / `store.tokens.children(ownerId)`), with token-DOM lookup via `store.tokens`
- raw DOM selection to serialized value ranges
- value edits through `store.edit.replace(from, to, text)` (or `store.tokens.replaceBetween()` / `setValue()`), read back with `store.tokens.value()`
- caret range application to the DOM after framework renders
- mark commands through the live `MarkNode` (`mark.update()` / `mark.remove()`)

React and Vue render structural token shells, text surfaces, slot roots, rows, and controls, then register them with core through private refs. Features do not rely on DOM child order or on public data attributes to locate tokens.

A Mark's own element belongs to you, so core never asks for it and never writes to it. Each Mark is rendered inside one element markput owns — a `span` with `display: contents`, which generates no box and so is invisible to layout. That wrapper is what core registers, and it is where the `contenteditable="false"` that makes a value-only Mark atomic is written. Your Mark component needs to forward nothing, which is what lets a third-party component be passed straight through as `Mark`.

## Marks vs Tokens

### Marks

A **mark** is a special pattern in your text that gets rendered as a React component. It highlights or transforms specific text segments into interactive elements.

```tsx fragment
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

```text
'Hello @[World](meta)!'[
    // Becomes this token tree:
    ({type: 'text', content: 'Hello '},
    {type: 'mark', value: 'World', meta: 'meta', content: '@[World](meta)'},
    {type: 'text', content: '!'})
]
```

**Token Types:**

- **Text**: Plain text segments
- **Mark**: Marked segments (rendered as your Mark component)
- **Row**: The node the separator carves out — three kinds, not two. A row holds its own inline
  tokens and then its child rows, in one list. See [Rows and Nesting](/guides/rows).

Where the value splits into rows — it does by default — the skeleton is scanned FIRST, from each
row's own leading bytes, and the inline pass then runs per row. An inline match can never reach past
the row it is inside.

## Markup Patterns

Markup patterns define how marks are identified in your text. They use placeholder syntax:

### Placeholders

| Placeholder  | Description                          | Supports Nesting |
| ------------ | ------------------------------------ | ---------------- |
| `__value__`  | Main content (plain text only)       | ❌ No            |
| `__meta__`   | Metadata (plain text only)           | ❌ No            |
| `__slot__` | Content that can contain other marks | ✅ Yes           |

### Common Patterns

```tsx fragment
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
'**__slot__**'
// Matches: **bold text**, **bold with *italic* inside**

// HTML-like (two values pattern)
'<__value__>__slot__</__value__>'
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

```text
Input: 'Hello @[World](meta) and @[Alice](user:1)!'
       ↓
Identifies: Two potential marks at positions 6-22 and 27-42
```

### Step 2: Pattern Matching

Each potential mark is tested against your markup patterns.

```text
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

```tsx value elide
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

```text
TextToken → <span>Hello </span>
MarkToken → <Mark value="World" meta="meta" />
TextToken → <span> and </span>
MarkToken → <Mark value="Alice" meta="user:1" />
TextToken → <span>!</span>
```

**Key insight**: This happens for every keystroke, keeping tokens in sync with your text.

</details>

## Nested Marks

Nested marks allow hierarchical structures. Use `__slot__` to enable nesting:

```tsx fragment
// Flat (no nesting)
markup: '*__value__*'
value: '*bold with *italic* inside*'
// Result: One mark with value = "bold with *italic* inside"

// Nested (supports hierarchy)
markup: '*__slot__*'
value: '*bold with *italic* inside*'
// Result: Parent mark contains child mark
```

### Token Tree for Nested Marks

<details>
<summary><strong>Token Structure Example (Advanced)</strong></summary>

```text
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

```tsx fragment
const Mark = ({children, value}: MarkProps) => {
    // For nested marks, use children (ReactNode)
    if (children) {
        return <strong>{children}</strong>
    }
    // For flat marks, the mark's own value is the text
    return <strong>{value}</strong>
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

```text
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
  └── <Container> (the one contenteditable host)
      ├── <Row> (its kind's component, or slots.paragraph when it has none)
      │    ├── <span> (plain text — bare, inherits editability)
      │    ├── <Mark> (your component — contenteditable=false)
      │    └── <Row> … (child rows, nested by indentation)
      ├── <Row> …
      ├── <RowControls> (ONE per editor: grip, drop indicator, row menu)
      └── <Overlay> (if triggered)
```

With `separator={null}` there are no rows and no row controls: the tokens sit directly in the
container.

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

```tsx fragment
store.props      // the declared props, each a signal with its own default
store.tokens     // the token tree (the source of truth), the selection, the DOM↔model map
store.edit       // every user mutation: replace(from, to, text)
store.overlay    // the overlay's match, its entries, and choose()
store.rows       // the rows' own UI: hover, drag, drop edge, the open menu, selected()
store.history    // the editor's own undo stack: canUndo(), undo(), redo()
store.slots      // slot component/props resolution
```

The value is a PROJECTION of the tokens, not the other way round: every write changes tokens and the
value follows.

### Controlled vs Uncontrolled

```tsx fragment
// ✅ Controlled (recommended)
const [value, setValue] = useState('')
const Controlled = () => <MarkedInput value={value} onChange={setValue} />

// ⚠️ Uncontrolled (less common)
const Uncontrolled = () => <MarkedInput defaultValue="initial" />
```

## Event System

### Built-in Events

`onChange` is the editor's own event, and the only one:

| Event      | When Triggered | Use Case            |
| ---------- | -------------- | ------------------- |
| `onChange` | Text changes   | Update parent state |

### DOM Events

Everything else is an ordinary DOM handler on the container, passed through `slotProps.container`:

```tsx markup uses=showToolbar,hideToolbar
<MarkedInput
    slotProps={{
        container: {
            onFocus: () => showToolbar(),
            onBlur: () => hideToolbar(),
            onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
                /* your shortcuts — Markput owns text mutation */
            },
        },
    }}
/>
```

Reading editor state from inside a Mark goes through `useMarkput(selector)`, and the mark's own node
through `useMark()`.

## Options System

Options allow per-pattern configuration. Each pattern can have its own Mark component and overlay —
capitalised keys are components, lowercase ones are their props:

```tsx markup uses=MentionComponent,users,HashtagComponent,hashtags
<MarkedInput
    options={[
        {
            markup: '@[__value__](__meta__)', // Pattern 1: mentions
            Mark: MentionComponent,
            overlay: {trigger: '@', data: users},
        },
        {
            markup: '#[__value__]', // Pattern 2: hashtags
            Mark: HashtagComponent,
            overlay: {trigger: '#', data: hashtags},
        },
    ]}
/>
```

<details>
<summary><strong>Advanced: Full Example with Props Transform</strong></summary>

```tsx markup uses=MentionComponent,MentionOverlay,users
<MarkedInput
    options={[
        {
            markup: '@[__value__](__meta__)',
            Mark: MentionComponent,
            Overlay: MentionOverlay,
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
    ]}
/>
```

An option may also declare `row` — which makes its markup a [row kind](/guides/row-kinds) matched
only at a row's own start — and `menu`, which puts it in the row menu.

### Option Resolution Priority

```
1. option.Mark             (highest priority)
2. MarkedInput.Mark prop
3. error                   (no component to render the mark with)
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

```tsx fragment
const ExpensiveMark = memo(({value}: MarkProps) => {
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

The live tree is on the store, not in a parse helper:

```tsx fragment
// The SIGNAL itself, not its value — the hook subscribes to what the selector names
const nodes = useMarkput(s => s.tokens.nodes)
console.log(nodes.map(node => [node.kind, node.range()]))
```

This is your best friend for understanding what Markput "sees" in your text.

### Check Markup Matching

There is no debug prop. A markup that breaks the [rules](/guides/configuration#markup-patterns) — and
a `separator` of `''`, and a row kind whose opener is already claimed — is REPORTED to the console
and contributes nothing; the console is the first place to look when an option appears to do nothing.

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
