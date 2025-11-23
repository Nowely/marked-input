---
title: Configuration
description: Complete guide to configuring MarkedInput
version: 1.0.0
---

Markput provides flexible configuration options through the `MarkedInput` component and the `createMarkedInput` factory. This guide covers all configuration patterns from basic to advanced.

## Configuration Methods

There are two main ways to configure Markput:

### Method 1: Inline Configuration

Pass configuration directly to `<MarkedInput>`:

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function Editor() {
  const [value, setValue] = useState('')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={MyMarkComponent}
      options={[/* configuration */]}
    />
  )
}
```

**Use when:**
- Configuration changes based on props or state
- Different instances need different configs
- Building a reusable editor component

### Method 2: Factory Configuration

Create a pre-configured component with `createMarkedInput`:

```tsx
import { createMarkedInput } from 'rc-marked-input'

const ConfiguredEditor = createMarkedInput({
  Mark: MyMarkComponent,
  options: [/* configuration */]
})

// Use anywhere
function App() {
  const [value, setValue] = useState('')
  return <ConfiguredEditor value={value} onChange={setValue} />
}
```

**Use when:**
- Configuration is static across the app
- Want to reuse the same config multiple times
- Prefer a cleaner, more declarative API

**Key Difference:** `createMarkedInput` bakes configuration into the component, while inline config allows runtime changes.

## The Options Array

The `options` array defines how different markup patterns are handled:

```tsx
options={[
  {
    markup: '@[__value__](__meta__)',
    slots: { mark: MentionComponent },
    slotProps: {
      mark: ({ value, meta }) => ({ userId: meta }),
      overlay: { trigger: '@', data: users }
    }
  },
  {
    markup: '#[__value__]',
    slots: { mark: HashtagComponent },
    slotProps: {
      overlay: { trigger: '#', data: hashtags }
    }
  }
]}
```

### Option Structure

Each option has three main properties:

| Property | Type | Purpose |
|----------|------|---------|
| `markup` | `string` | Pattern to match (e.g., `'@[__value__]'`) |
| `slots` | `object` | Per-option components (mark, overlay) |
| `slotProps` | `object` | Props for slot components |

## Markup Patterns

The `markup` property defines what text pattern to match:

```tsx
// Basic mention
markup: '@[__value__]'
// Matches: @[Alice], @[Bob]

// Mention with metadata
markup: '@[__value__](__meta__)'
// Matches: @[Alice](user:1), @[Bob](user:2)

// Reversed pattern
markup: '@(__meta__)[__value__]'
// Matches: @(user:1)[Alice], @(user:2)[Bob]

// Nested marks
markup: '**__nested__**'
// Matches: **bold text**, **bold with *italic***

// HTML-like tags
markup: '<__value__>__nested__</__value__>'
// Matches: <div>content</div>, <span>text</span>
```

**Placeholders:**
- `__value__` - Main content (plain text)
- `__meta__` - Metadata (plain text)
- `__nested__` - Content that can contain other marks

See [Core Concepts](../introduction/core-concepts#markup-patterns) for detailed explanation.

## slotProps.mark

The `slotProps.mark` property transforms markup data into component props. It supports two forms:

### Function Form (Dynamic)

Transform markup data dynamically:

```tsx
slotProps: {
  mark: ({ value, meta, nested, children }) => ({
    // Transform markup data into component props
    label: value,
    userId: meta,
    onClick: () => console.log('Clicked', value)
  })
}
```

**Parameters:**
- `value` - Content from `__value__` placeholder
- `meta` - Content from `__meta__` placeholder
- `nested` - Raw string from `__nested__` placeholder
- `children` - Rendered React nodes for nested marks

**Example:** Twitter-style mentions

```tsx
{
  markup: '@[__value__](__meta__)',
  slotProps: {
    mark: ({ value, meta }) => ({
      username: value,
      userId: meta,
      href: `/users/${meta}`,
      onClick: (e) => {
        e.preventDefault()
        navigateToUser(meta)
      }
    })
  }
}
```

### Object Form (Static)

Pass fixed props to all marks:

```tsx
slotProps: {
  mark: {
    variant: 'outlined',
    color: 'primary',
    size: 'small'
  }
}
```

**Use when:**
- All marks should have the same props
- Props don't depend on markup content
- Working with UI library components (MUI, Chakra)

**Example:** MUI Chip

```tsx
import { Chip } from '@mui/material'

<MarkedInput
  Mark={Chip}
  options={[{
    markup: '@[__value__]',
    slotProps: {
      mark: {
        variant: 'filled',
        color: 'primary',
        size: 'small',
        deleteIcon: <CloseIcon />
      }
    }
  }]}
/>
```

### Function vs Object Comparison

```tsx
// ✅ Function - Access markup data
mark: ({ value, meta }) => ({
  label: value,        // From markup
  userId: meta,        // From markup
  onClick: () => {}    // Custom logic
})

// ✅ Object - Fixed props
mark: {
  variant: 'outlined', // Static
  color: 'primary',    // Static
  size: 'small'        // Static
}

// ❌ Cannot mix forms
mark: {
  label: value,  // Error: 'value' is not defined
  color: 'primary'
}
```

## slotProps.overlay

Configure the suggestion overlay:

```tsx
slotProps: {
  overlay: {
    trigger: '@',              // Character that shows overlay
    data: ['Alice', 'Bob']     // Suggestion data
  }
}
```

### Common Configurations

**Basic suggestions:**
```tsx
overlay: {
  trigger: '@',
  data: ['Alice', 'Bob', 'Charlie']
}
```

**With objects:**
```tsx
overlay: {
  trigger: '/',
  data: [
    { label: 'Heading', value: 'h1' },
    { label: 'Bold', value: 'bold' },
    { label: 'Italic', value: 'italic' }
  ]
}
```

**Dynamic data (from API):**
```tsx
const [users, setUsers] = useState([])

useEffect(() => {
  fetchUsers().then(setUsers)
}, [])

// In options:
overlay: {
  trigger: '@',
  data: users.map(u => u.username)
}
```

**Multiple triggers:**
```tsx
options={[
  {
    markup: '@[__value__]',
    slotProps: {
      overlay: { trigger: '@', data: users }
    }
  },
  {
    markup: '#[__value__]',
    slotProps: {
      overlay: { trigger: '#', data: hashtags }
    }
  },
  {
    markup: '/[__value__]',
    slotProps: {
      overlay: { trigger: '/', data: commands }
    }
  }
]}
```

## Slots: Global vs Per-Option

You can specify components at two levels:

### Global Components

Apply to all marks/overlays unless overridden:

```tsx
<MarkedInput
  Mark={GlobalMark}           // Used by all options
  Overlay={GlobalOverlay}     // Used by all options
  options={[...]}
/>
```

### Per-Option Components

Override global components for specific patterns:

```tsx
<MarkedInput
  Mark={DefaultMark}          // Fallback
  options={[
    {
      markup: '@[__value__]',
      slots: {
        mark: MentionMark,    // Overrides DefaultMark
        overlay: MentionOverlay
      }
    },
    {
      markup: '#[__value__]',
      slots: {
        mark: HashtagMark     // Overrides DefaultMark
      }
      // Uses global Overlay
    }
  ]}
/>
```

### Component Resolution Priority

For **each** option, components are resolved in this order:

```
1. option.slots.mark       (highest priority)
2. MarkedInput.Mark prop
3. undefined               (error if no Mark)

1. option.slots.overlay    (highest priority)
2. MarkedInput.Overlay prop
3. Default Suggestions     (built-in)
```

**Example:**

```tsx
<MarkedInput
  Mark={DefaultMark}
  Overlay={DefaultOverlay}
  options={[
    {
      markup: '@[__value__]',
      slots: { mark: MentionMark }
      // ✅ Uses: MentionMark (option.slots)
      // ✅ Uses: DefaultOverlay (global)
    },
    {
      markup: '#[__value__]'
      // ✅ Uses: DefaultMark (global)
      // ✅ Uses: DefaultOverlay (global)
    }
  ]}
/>
```

## Complete Examples

### Example 1: Multi-Trigger Editor

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function MultiTriggerEditor() {
  const [value, setValue] = useState('')

  const users = ['Alice', 'Bob', 'Charlie']
  const hashtags = ['react', 'javascript', 'typescript']
  const commands = ['heading', 'bold', 'italic']

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={({ value, meta }) => (
        <span style={{ background: meta === 'mention' ? '#e3f2fd' : '#f3e5f5' }}>
          {value}
        </span>
      )}
      options={[
        {
          markup: '@[__value__](mention)',
          slotProps: {
            overlay: { trigger: '@', data: users }
          }
        },
        {
          markup: '#[__value__](hashtag)',
          slotProps: {
            overlay: { trigger: '#', data: hashtags }
          }
        },
        {
          markup: '/[__value__](command)',
          slotProps: {
            overlay: { trigger: '/', data: commands }
          }
        }
      ]}
    />
  )
}
```

### Example 2: Per-Pattern Components

```tsx
import { MarkedInput } from 'rc-marked-input'

const MentionMark = ({ value, meta }) => (
  <a href={`/users/${meta}`} className="mention">
    @{value}
  </a>
)

const HashtagMark = ({ value }) => (
  <a href={`/tags/${value}`} className="hashtag">
    #{value}
  </a>
)

function Editor() {
  const [value, setValue] = useState('')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      options={[
        {
          markup: '@[__value__](__meta__)',
          slots: { mark: MentionMark },
          slotProps: {
            mark: ({ value, meta }) => ({ value, meta }),
            overlay: { trigger: '@', data: users }
          }
        },
        {
          markup: '#[__value__]',
          slots: { mark: HashtagMark },
          slotProps: {
            mark: ({ value }) => ({ value }),
            overlay: { trigger: '#', data: hashtags }
          }
        }
      ]}
    />
  )
}
```

### Example 3: createMarkedInput Factory

```tsx
import { createMarkedInput } from 'rc-marked-input'
import { Chip } from '@mui/material'

const MentionEditor = createMarkedInput({
  Mark: Chip,
  options: [
    {
      markup: '@[__value__](__meta__)',
      slotProps: {
        mark: ({ value, meta }) => ({
          label: `@${value}`,
          variant: 'filled',
          color: 'primary',
          size: 'small',
          onClick: () => console.log('Clicked', meta)
        }),
        overlay: {
          trigger: '@',
          data: ['Alice', 'Bob', 'Charlie']
        }
      }
    }
  ]
})

// Use anywhere in your app
function App() {
  const [value, setValue] = useState('')
  return <MentionEditor value={value} onChange={setValue} />
}
```

## TypeScript Configuration

Type your configuration for better IDE support:

```tsx
import { MarkedInput } from 'rc-marked-input'
import type { Option } from 'rc-marked-input'

interface MentionProps {
  username: string
  userId: string
  onClick: () => void
}

const options: Option<MentionProps>[] = [
  {
    markup: '@[__value__](__meta__)',
    slotProps: {
      mark: ({ value, meta }) => ({
        username: value || '',
        userId: meta || '',
        onClick: () => console.log('Clicked')
      }),
      overlay: {
        trigger: '@',
        data: ['Alice', 'Bob']
      }
    }
  }
]

function TypedEditor() {
  return (
    <MarkedInput<MentionProps>
      Mark={MentionComponent}
      options={options}
      value=""
      onChange={() => {}}
    />
  )
}
```

## Common Patterns

### Pattern: Mention System

```tsx
{
  markup: '@[__value__](__meta__)',
  slotProps: {
    mark: ({ value, meta }) => ({
      username: value,
      userId: meta
    }),
    overlay: { trigger: '@', data: users }
  }
}
```

### Pattern: Slash Commands

```tsx
{
  markup: '/[__value__](__meta__)',
  slotProps: {
    mark: ({ value }) => ({ command: value }),
    overlay: {
      trigger: '/',
      data: ['heading', 'bold', 'italic']
    }
  }
}
```

### Pattern: Template Variables

```tsx
{
  markup: '{{__value__}}',
  slotProps: {
    mark: ({ value }) => ({ variable: value }),
    overlay: {
      trigger: '{{',
      data: ['name', 'email', 'date']
    }
  }
}
```

### Pattern: Markdown-style

```tsx
options={[
  {
    markup: '**__nested__**',
    slotProps: {
      mark: ({ children }) => ({ style: { fontWeight: 'bold' }, children })
    }
  },
  {
    markup: '*__nested__*',
    slotProps: {
      mark: ({ children }) => ({ style: { fontStyle: 'italic' }, children })
    }
  }
]}
```

## Best Practices

### ✅ Do

```tsx
// Use createMarkedInput for static configs
const Editor = createMarkedInput({ Mark, options })

// Memoize dynamic options
const options = useMemo(() => [...], [dependencies])

// Type your components
const Mark: React.FC<MarkProps> = ({ value }) => <span>{value}</span>

// Use descriptive metadata
markup: '@[__value__](user:__meta__)'
```

### ❌ Don't

```tsx
// Don't create new functions in render
slotProps: {
  mark: ({ value }) => ({ onClick: () => {} }) // Creates new function each render
}

// Don't use complex logic in slotProps
slotProps: {
  mark: ({ value, meta }) => {
    // Heavy computation
    const result = expensiveOperation(value)
    return { data: result }
  }
}

// Don't mix object and function forms
mark: {
  label: value,  // Error: value not defined
  color: 'blue'
}
```

**Questions?** Ask in [GitHub Discussions](https://github.com/Nowely/marked-input/discussions).
