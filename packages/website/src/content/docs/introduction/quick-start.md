---
title: Quick Start
description: Build your first annotated text editor in 5 minutes
version: 1.0.0
---

This guide will walk you through creating your first working example with Markput. By the end, you'll have a functional editor with clickable mentions.

## Prerequisites

- React 17 or later
- Basic knowledge of React hooks
- Node.js and npm/yarn/pnpm installed

## Step 1: Install Markput

```bash
npm install rc-marked-input
```

Or with yarn:
```bash
yarn add rc-marked-input
```

Or with pnpm:
```bash
pnpm add rc-marked-input
```

## Step 2: Create Your First Editor

Create a new React component with the following code:

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function MyEditor() {
  const [value, setValue] = useState('Hello @[World](meta)!')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={(props) => <mark>{props.value}</mark>}
    />
  )
}

export default MyEditor
```

**Congratulations!** You've created your first annotated text editor.

## How It Works

**Value string:** `'Hello @[World](meta)!'` — plain text with markup pattern `@[value](meta)`.

**MarkedInput:** Controlled component. `value` — text to display, `onChange` — update handler, `Mark` — component for rendering annotations.

**Mark component:** Receives `props.value` (text inside `@[...]`) and `props.meta` (optional metadata). Returns any React element.

## Step 3: Make it Interactive

Let's make the mentions clickable:

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function MyEditor() {
  const [value, setValue] = useState('Click on @[Alice](user:1) or @[Bob](user:2)!')

  const ClickableMention = (props) => (
    <button
      onClick={() => alert(`User ID: ${props.meta}`)}
      style={{
        background: '#e3f2fd',
        border: '1px solid #2196f3',
        borderRadius: '4px',
        padding: '2px 6px',
        cursor: 'pointer',
      }}
    >
      @{props.value}
    </button>
  )

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={ClickableMention}
    />
  )
}
```

**Try it out!** Click on the mentions to see the alert with the user ID.

## Step 4: Add Autocomplete

Let's add a suggestion overlay that appears when you type `@`:

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function MyEditor() {
  const [value, setValue] = useState('Type @ to mention someone!')

  const users = ['Alice', 'Bob', 'Charlie', 'Diana']

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={(props) => (
        <span style={{ background: '#e3f2fd', padding: '2px 4px' }}>
          @{props.value}
        </span>
      )}
      options={[
        {
          markup: '@[__value__](user)',
          slotProps: {
            overlay: {
              trigger: '@',
              data: users,
            },
          },
        },
      ]}
    />
  )
}
```

**Try typing `@` in the editor!** A suggestion list will appear when you type the trigger character.

## Common Patterns

### Pattern 1: Simple Mark (No Metadata)
```tsx
// Pattern: @[__value__]
const value = 'Hello @[World]!'
// Renders: Hello <Mark value="World" />!
```

### Pattern 2: Mark with Metadata
```tsx
// Pattern: @[__value__](__meta__)
const value = 'Hello @[World](meta-info)!'
// Renders: Hello <Mark value="World" meta="meta-info" />!
```

### Pattern 3: Reversed Pattern
```tsx
// Pattern: @(__value__)[__meta__]
const value = 'Hello @(World)[meta-info]!'
// Renders: Hello <Mark value="World" meta="meta-info" />!
```

### Pattern 4: Nested Marks
```tsx
// Pattern: **__nested__**
const value = 'This is **bold with *italic* inside**'
// More on this in the Nested Marks guide
```

## TypeScript Support

For TypeScript users, you can type your Mark component:

```tsx
import { MarkedInput } from 'rc-marked-input'
import type { MarkProps } from 'rc-marked-input'

interface MyMarkProps {
  userId: string
  label: string
}

function MyEditor() {
  const [value, setValue] = useState('Hello @[World](user:123)!')

  const TypedMark = (props: MyMarkProps) => (
    <button onClick={() => console.log(props.userId)}>
      @{props.label}
    </button>
  )

  return (
    <MarkedInput<MyMarkProps>
      value={value}
      onChange={setValue}
      Mark={TypedMark}
      options={[
        {
          markup: '@[__value__](__meta__)',
          slotProps: {
            mark: ({ value, meta }) => ({
              label: value || '',
              userId: meta || '',
            }),
          },
        },
      ]}
    />
  )
}
```

## What's Next?

Now that you have a working editor, explore these topics:

### Learn the Fundamentals
- **[Core Concepts](./core-concepts)** - Deep dive into marks, tokens, and parsing
- **[Configuration](../guides/configuration)** - Learn all configuration options

### Add More Features
- **[Dynamic Marks](../guides/dynamic-marks)** - Make marks editable and removable
- **[Nested Marks](../guides/nested-marks)** - Support complex hierarchical structures
- **[Overlay Customization](../guides/overlay-customization)** - Build custom autocomplete UIs

### See Real Examples
- **[Mention System](../examples/mention-system)** - Production-ready @mentions
- **[Slash Commands](../examples/slash-commands)** - Notion-like /commands
- **[Markdown Editor](../examples/markdown-editor)** - Bold, italic, and more

## Troubleshooting

### Marks Not Rendering?
Make sure your markup pattern matches your value string:
```tsx
// ❌ Mismatch
value: '@[World]'
markup: '#[__value__]' // Wrong trigger!

// ✅ Match
value: '@[World]'
markup: '@[__value__]'
```

### onChange Not Firing?
Ensure you're using a controlled component:
```tsx
// ❌ Missing onChange
<MarkedInput value={value} />

// ✅ Controlled
<MarkedInput value={value} onChange={setValue} />
```

### TypeScript Errors?
Make sure React types are installed:
```bash
npm install --save-dev @types/react @types/react-dom
```

## Try it Online

Want to experiment without setting up a project? Try these CodeSandbox templates:

- [Basic Example](https://codesandbox.io/s/marked-input-x5wx6k) - Simple clickable marks
- [With Autocomplete](https://codesandbox.io/s/configured-marked-input-305v6m) - Suggestion overlay
- [Dynamic Marks](https://codesandbox.io/s/dynamic-mark-w2nj82) - Editable and removable

---

**Need help?** Join the [GitHub Discussions](https://github.com/Nowely/marked-input/discussions) or check the [FAQ](#).
