---
title: Quick Start
description: Build your first annotated text editor in 5 minutes
version: 1.0.0
---

This guide will walk you through creating your first working example with Markput.

## Prerequisites

- React 17 or later
- Node.js and npm/yarn/pnpm installed

## Step 1: Install Markput

```bash
npm install rc-marked-input
```

## Step 2: Create Your First Editor

Create a new React component:

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

### How It Works

1.  **Value String**: `'Hello @[World](meta)!'` contains the markup pattern `@[value](meta)`.
2.  **MarkedInput**: Parses the string and renders text.
3.  **Mark Component**: Renders the annotations. Receives `props.value` ("World") and `props.meta` ("meta").

## Step 3: Make it Interactive

You can use any React component as a Mark.

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function MyEditor() {
  const [value, setValue] = useState('Click on @[Alice](user:1)!')

  const ClickableMention = ({ value, meta }) => (
    <button
      onClick={() => alert(`User ID: ${meta}`)}
      style={{
        background: '#e3f2fd',
        border: '1px solid #2196f3',
        borderRadius: '4px',
        padding: '2px 6px',
        cursor: 'pointer',
      }}
    >
      @{value}
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

## Step 4: Add Autocomplete

Add a suggestion overlay that appears when typing a trigger character (e.g., `@`).

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function MyEditor() {
  const [value, setValue] = useState('Type @ to mention someone!')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={(props) => <span style={{ color: 'blue' }}>@{props.value}</span>}
      options={[
        {
          markup: '@[__value__](user)',
          slotProps: {
            overlay: {
              trigger: '@',
              data: ['Alice', 'Bob', 'Charlie'],
            },
          },
        },
      ]}
    />
  )
}
```

## Common Patterns

| Pattern | Syntax | Example |
|---------|--------|---------|
| **Simple** | `@[__value__]` | `Hello @[World]!` |
| **With Meta** | `@[__value__](__meta__)` | `Hello @[World](id:1)!` |
| **Reversed** | `@(__value__)[__meta__]` | `Hello @(World)[id:1]!` |
| **Markdown** | `**__value__**` | `**Bold text**` |

## TypeScript Support

Define props for your Mark component for type safety:

```tsx
interface MyMarkProps {
  userId: string
  label: string
}

<MarkedInput<MyMarkProps>
  value={value}
  onChange={setValue}
  Mark={(props) => <span data-id={props.userId}>{props.label}</span>}
  // ...
/>
```

## Troubleshooting

-   **Marks Not Rendering?** Check that your `markup` pattern matches the format in your `value` string.
-   **onChange Not Firing?** Ensure you are correctly updating the state in the `onChange` handler (controlled component pattern).

---

**Need help?** Join the [GitHub Discussions](https://github.com/Nowely/marked-input/discussions).
