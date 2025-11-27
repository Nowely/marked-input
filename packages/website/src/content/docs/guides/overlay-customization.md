---
title: 🚧 Overlay Customization
description: Custom autocomplete overlays for Markput - trigger characters, suggestions, positioning, useOverlay hook, and styling
keywords: [overlay, autocomplete, suggestions, trigger characters, useOverlay hook, positioning, custom UI]
---

The overlay system provides autocomplete, suggestions, and contextual menus when users type trigger characters. Markput includes a default Suggestions component, but you can fully customize it to match your needs.

## Overview

Overlays appear when users type a trigger character (e.g., `@`, `/`, `#`):

```
User types '@'
      ↓
Overlay appears with suggestions
      ↓
User selects 'Alice'
      ↓
Text becomes '@[Alice]'
```

## Default Suggestions Overlay

Markput includes a built-in Suggestions component:

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function BasicSuggestions() {
  const [value, setValue] = useState('Type @ to mention someone')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={(props) => <span>{props.value}</span>}
      options={[
        {
          markup: '@[__value__]',
          slotProps: {
            overlay: {
              trigger: '@',
              data: ['Alice', 'Bob', 'Charlie', 'Diana']
            }
          }
        }
      ]}
    />
  )
}
```

**Features:**
- Keyboard navigation (↑↓)
- Filtering as you type
- Enter to select
- Esc to close
- Click to select

## The useOverlay Hook

Build custom overlays with the `useOverlay()` hook:

```tsx
import { useOverlay } from 'rc-marked-input'

function CustomOverlay() {
  const overlay = useOverlay()

  return <div>Custom overlay</div>
}
```

### useOverlay API

| Property | Type | Description |
|----------|------|-------------|
| `style` | `{left, top}` | Absolute position for overlay |
| `close()` | `function` | Close the overlay |
| `select()` | `function` | Insert a mark |
| `match` | `OverlayMatch` | Match details (value, source, trigger) |
| `ref` | `RefObject` | Ref for outside click detection |

**Complete interface:**

```tsx
interface OverlayHandler {
  style: {
    left: number    // X coordinate
    top: number     // Y coordinate
  }
  close: () => void
  select: (value: {value: string; meta?: string}) => void
  match: {
    value: string   // Typed text after trigger
    source: string  // Full matched text including trigger
    trigger: string // The trigger character
    span: string    // Text node content
    node: Node      // DOM node
    index: number   // Position in text
    option: Option  // Matched option config
  }
  ref: RefObject<HTMLElement>
}
```

## Custom Overlay Examples

### Example 1: Simple List

```tsx
import { useOverlay } from 'rc-marked-input'

function SimpleListOverlay() {
  const { select } = useOverlay()

  const items = ['Apple', 'Banana', 'Cherry']

  return (
    <ul className="overlay">
      {items.map(item => (
        <li key={item} onClick={() => select({ value: item })}>
          {item}
        </li>
      ))}
    </ul>
  )
}

// Usage
<MarkedInput
  Overlay={SimpleListOverlay}
  options={[{ slotProps: { overlay: { trigger: '@' } } }]}
/>
```

### Example 2: Positioned Overlay

Position the overlay at the caret:

```tsx
function PositionedOverlay() {
  const { style, select } = useOverlay()

  const items = ['Item 1', 'Item 2', 'Item 3']

  return (
    <div
      style={{
        position: 'absolute',
        left: style.left,
        top: style.top,
        background: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        zIndex: 1000
      }}
    >
      {items.map(item => (
        <div
          key={item}
          onClick={() => select({ value: item })}
          style={{ padding: '8px 12px', cursor: 'pointer' }}
        >
          {item}
        </div>
      ))}
    </div>
  )
}
```

### Example 3: Filtered Suggestions

Filter based on typed text:

```tsx
function FilteredOverlay() {
  const { select, match, close } = useOverlay()

  const allItems = ['Alice', 'Bob', 'Charlie', 'Diana']

  // Filter items based on typed text
  const filtered = allItems.filter(item =>
    item.toLowerCase().includes(match.value.toLowerCase())
  )

  if (filtered.length === 0) {
    return (
      <div className="overlay">
        <div className="empty">No results</div>
      </div>
    )
  }

  return (
    <ul className="overlay">
      {filtered.map(item => (
        <li key={item} onClick={() => select({ value: item })}>
          {item}
        </li>
      ))}
    </ul>
  )
}
```

### Example 4: With Metadata

Include metadata when selecting:

```tsx
function UserOverlay() {
  const { select } = useOverlay()

  const users = [
    { id: '1', name: 'Alice', avatar: '👩' },
    { id: '2', name: 'Bob', avatar: '👨' },
    { id: '3', name: 'Charlie', avatar: '🧑' }
  ]

  return (
    <div className="user-overlay">
      {users.map(user => (
        <div
          key={user.id}
          onClick={() => select({
            value: user.name,
            meta: user.id  // Store user ID in metadata
          })}
          className="user-item"
        >
          <span>{user.avatar}</span>
          <span>{user.name}</span>
        </div>
      ))}
    </div>
  )
}

// Usage with markup that includes metadata
<MarkedInput
  Overlay={UserOverlay}
  options={[{
    markup: '@[__value__](__meta__)',
    slotProps: { overlay: { trigger: '@' } }
  }]}
/>
```

### Example 5: Keyboard Navigation

Add keyboard support:

```tsx
import { useOverlay } from 'rc-marked-input'
import { useState, useEffect } from 'react'

function KeyboardOverlay() {
  const { select, close, ref } = useOverlay()
  const [selected, setSelected] = useState(0)

  const items = ['Alice', 'Bob', 'Charlie']

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(prev => (prev + 1) % items.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(prev => (prev - 1 + items.length) % items.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        select({ value: items[selected] })
      } else if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected, items, select, close])

  return (
    <div ref={ref} className="overlay">
      {items.map((item, index) => (
        <div
          key={item}
          onClick={() => select({ value: item })}
          className={index === selected ? 'selected' : ''}
        >
          {item}
        </div>
      ))}
    </div>
  )
}
```

## Outside Click Detection

Use the `ref` to detect clicks outside the overlay:

```tsx
function ClickOutsideOverlay() {
  const { select, ref } = useOverlay()

  const items = ['Item 1', 'Item 2']

  return (
    <div
      ref={ref}  // Important for outside click detection
      className="overlay"
    >
      {items.map(item => (
        <div key={item} onClick={() => select({ value: item })}>
          {item}
        </div>
      ))}
    </div>
  )
}
```

**How it works:**
- Markput tracks clicks
- If click is outside elements with `ref`, overlay closes
- Always attach `ref` to your root overlay element

## Trigger Configuration

### Single Trigger

```tsx
options={[
  {
    markup: '@[__value__]',
    slotProps: {
      overlay: {
        trigger: '@',
        data: ['Alice', 'Bob']
      }
    }
  }
]}
```

### Multiple Triggers

Different triggers for different mark types:

```tsx
options={[
  {
    markup: '@[__value__](user)',
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
```

### Multi-Character Triggers

```tsx
options={[
  {
    markup: '{{__value__}}',
    slotProps: {
      overlay: {
        trigger: '{{',
        data: ['name', 'email', 'date']
      }
    }
  }
]}
```

## Per-Option Custom Overlays

Use different overlay components for different triggers:

```tsx
import { MarkedInput } from 'rc-marked-input'

function UserOverlay() {
  const { select } = useOverlay()
  return (
    <div className="user-overlay">
      <div onClick={() => select({ value: 'Alice' })}>👩 Alice</div>
      <div onClick={() => select({ value: 'Bob' })}>👨 Bob</div>
    </div>
  )
}

function CommandOverlay() {
  const { select } = useOverlay()
  return (
    <div className="command-overlay">
      <div onClick={() => select({ value: 'heading' })}>📝 Heading</div>
      <div onClick={() => select({ value: 'bold' })}>🔤 Bold</div>
    </div>
  )
}

function Editor() {
  const [value, setValue] = useState('')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={(props) => <span>{props.value}</span>}
      options={[
        {
          markup: '@[__value__]',
          slots: { overlay: UserOverlay },  // Custom overlay for @
          slotProps: { overlay: { trigger: '@' } }
        },
        {
          markup: '/[__value__]',
          slots: { overlay: CommandOverlay },  // Custom overlay for /
          slotProps: { overlay: { trigger: '/' } }
        }
      ]}
    />
  )
}
```

## Overlay with Data Loading

Load data asynchronously:

```tsx
import { useOverlay } from 'rc-marked-input'
import { useState, useEffect } from 'react'

function AsyncOverlay() {
  const { select, match } = useOverlay()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    // Fetch users based on typed text
    fetch(`/api/users?q=${match.value}`)
      .then(res => res.json())
      .then(data => {
        setUsers(data)
        setLoading(false)
      })
  }, [match.value])

  if (loading) {
    return <div className="overlay">Loading...</div>
  }

  if (users.length === 0) {
    return <div className="overlay">No users found</div>
  }

  return (
    <div className="overlay">
      {users.map(user => (
        <div
          key={user.id}
          onClick={() => select({ value: user.name, meta: user.id })}
        >
          {user.name}
        </div>
      ))}
    </div>
  )
}
```

## Controlling Overlay Visibility

Use `showOverlayOn` prop:

```tsx
<MarkedInput
  value={value}
  onChange={setValue}
  Mark={Mark}
  showOverlayOn="change"  // Default: show on text change
  // or
  showOverlayOn="selectionChange"  // Show on cursor move
  // or
  showOverlayOn={['change', 'selectionChange']}  // Both
  // or
  showOverlayOn="none"  // Never show automatically
/>
```

**Options:**
- `"change"` - Show when text changes (default)
- `"selectionChange"` - Show when cursor moves
- `["change", "selectionChange"]` - Both events
- `"none"` - Manual control only

## Complete Examples

### Example: Rich User Selector

```tsx
import { useOverlay } from 'rc-marked-input'
import { useState, useEffect } from 'react'

function RichUserOverlay() {
  const { select, match, style, ref } = useOverlay()
  const [selected, setSelected] = useState(0)

  const users = [
    { id: '1', name: 'Alice Johnson', avatar: '👩', role: 'Designer' },
    { id: '2', name: 'Bob Smith', avatar: '👨', role: 'Developer' },
    { id: '3', name: 'Charlie Brown', avatar: '🧑', role: 'Manager' }
  ]

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(match.value.toLowerCase())
  )

  useEffect(() => {
    setSelected(0)
  }, [match.value])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(prev => (prev + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(prev => (prev - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' && filtered[selected]) {
        e.preventDefault()
        select({
          value: filtered[selected].name,
          meta: filtered[selected].id
        })
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selected, filtered, select])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: style.left,
        top: style.top,
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        minWidth: '250px',
        maxHeight: '300px',
        overflow: 'auto',
        zIndex: 1000
      }}
    >
      {filtered.length === 0 ? (
        <div style={{ padding: '16px', color: '#999' }}>
          No users found
        </div>
      ) : (
        filtered.map((user, index) => (
          <div
            key={user.id}
            onClick={() => select({ value: user.name, meta: user.id })}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: index === selected ? '#f5f5f5' : 'transparent'
            }}
          >
            <span style={{ fontSize: '24px' }}>{user.avatar}</span>
            <div>
              <div style={{ fontWeight: 500 }}>{user.name}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{user.role}</div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
```

### Example: Notion-style Slash Commands

```tsx
function CommandOverlay() {
  const { select, match, style, ref } = useOverlay()
  const [selected, setSelected] = useState(0)

  const commands = [
    { value: 'h1', label: 'Heading 1', icon: '📝', description: 'Large heading' },
    { value: 'h2', label: 'Heading 2', icon: '📄', description: 'Medium heading' },
    { value: 'bold', label: 'Bold', icon: '🔤', description: 'Make text bold' },
    { value: 'italic', label: 'Italic', icon: '📐', description: 'Italicize text' },
    { value: 'code', label: 'Code', icon: '💻', description: 'Code block' }
  ]

  const filtered = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(match.value.toLowerCase()) ||
    cmd.value.toLowerCase().includes(match.value.toLowerCase())
  )

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: style.left,
        top: style.top,
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        minWidth: '300px',
        zIndex: 1000
      }}
    >
      {filtered.map((cmd, index) => (
        <div
          key={cmd.value}
          onClick={() => select({ value: cmd.value, meta: cmd.label })}
          style={{
            padding: '10px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: index === selected ? '#f0f0f0' : 'transparent'
          }}
        >
          <span style={{ fontSize: '20px' }}>{cmd.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, marginBottom: '2px' }}>
              {cmd.label}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {cmd.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

## Best Practices

### ✅ Do

```tsx
// Attach ref for outside click detection
<div ref={ref}>overlay content</div>

// Position overlay at caret
<div style={{ position: 'absolute', left: style.left, top: style.top }}>

// Filter based on match.value
const filtered = items.filter(item =>
  item.toLowerCase().includes(match.value.toLowerCase())
)

// Handle empty results
{filtered.length === 0 && <div>No results</div>}

// Add keyboard navigation
useEffect(() => {
  const handleKey = (e) => { /* handle arrow keys */ }
  window.addEventListener('keydown', handleKey)
  return () => window.removeEventListener('keydown', handleKey)
}, [])
```

### ❌ Don't

```tsx
// Don't forget ref
<div>overlay</div>  // Won't close on outside click

// Don't use fixed positioning without coordinates
<div style={{ position: 'fixed', top: 0, left: 0 }}>  // Bad UX

// Don't forget to handle empty states
{items.map(item => ...)}  // What if items is empty?

// Don't create memory leaks
useEffect(() => {
  window.addEventListener('keydown', handler)
  // Missing cleanup!
}, [])
```

## TypeScript Support

Type your custom overlays:

```tsx
import { useOverlay } from 'rc-marked-input'
import type { OverlayHandler } from 'rc-marked-input'

function TypedOverlay() {
  const overlay: OverlayHandler = useOverlay()

  const handleSelect = (value: string) => {
    overlay.select({ value, meta: 'optional' })
  }

  return (
    <div ref={overlay.ref}>
      {/* overlay content */}
    </div>
  )
}
```

**Key Takeaways:**
- Use `useOverlay()` hook for custom overlays
- Position with `style.left` and `style.top`
- Attach `ref` for outside click detection
- Use `select()` to insert marks
- Add keyboard navigation for better UX

**Try it live:** [CodeSandbox - Custom Overlay](https://codesandbox.io/s/custom-overlay-1m5ctx)
