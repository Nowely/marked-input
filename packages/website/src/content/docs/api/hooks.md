---
title: Hooks API
description: Complete API reference for useMark, useOverlay, and useListener hooks
version: 1.0.0
---

This page documents all hooks exported by Markput for creating interactive marks and custom overlays.

## useMark

Hook for accessing mark context and operations inside Mark components.

### Signature

```tsx
function useMark<TValue = any, TMeta = any>(): MarkContext<TValue, TMeta>

interface MarkContext<TValue = any, TMeta = any> {
  // Mark data
  value: TValue
  meta: TMeta
  nested: ReactNode
  label: string

  // Operations
  change: (data: Partial<MarkData>, options?: ChangeOptions) => void
  remove: () => void

  // DOM reference
  ref: RefObject<HTMLElement>

  // State
  readOnly: boolean
  depth: number
  hasChildren: boolean

  // Hierarchy (for nested marks)
  parent: MarkContext | null
  children: MarkContext[]
}

interface MarkData {
  value: string
  meta: string
}

interface ChangeOptions {
  silent?: boolean
}
```

### Return Properties

#### value

- **Type:** `TValue`
- **Description:** The mark's value parsed from markup
- **Example:** For `@[Alice](123)`, value is `"Alice"`

```tsx
const MyMark = () => {
  const { value } = useMark()
  return <span>{value}</span>
}
```

#### meta

- **Type:** `TMeta`
- **Description:** The mark's metadata parsed from markup
- **Example:** For `@[Alice](123)`, meta is `"123"`

```tsx
const MentionMark = () => {
  const { value, meta } = useMark()
  return <a href={`/users/${meta}`}>{value}</a>
}
```

#### nested

- **Type:** `ReactNode`
- **Description:** Nested content for marks that support nesting
- **Only available when:** Markup uses `__nested__` placeholder

```tsx
// Markup: '**__nested__**'
const BoldMark = () => {
  const { nested } = useMark()
  return <strong>{nested}</strong>
}

// Usage: **text with @[mention]** renders as:
// <strong>text with <mention>@Alice</mention></strong>
```

#### label

- **Type:** `string`
- **Description:** The plain text representation of the mark
- **Use for:** Display text in readonly mode, accessibility labels

```tsx
const MyMark = () => {
  const { label, readOnly } = useMark()

  return readOnly ? (
    <span>{label}</span>
  ) : (
    <button>{label}</button>
  )
}
```

#### change

- **Type:** `(data: Partial<MarkData>, options?: ChangeOptions) => void`
- **Description:** Update mark's value or meta
- **Options:**
  - `silent?: boolean` - If true, prevents cursor jumping (use for contentEditable)

```tsx
const EditableMark = () => {
  const { value, change } = useMark()

  const handleInput = (e: FormEvent<HTMLSpanElement>) => {
    const newValue = e.currentTarget.textContent || ''
    change({ value: newValue }, { silent: true })
  }

  return (
    <span
      contentEditable
      onInput={handleInput}
      suppressContentEditableWarning
    >
      {value}
    </span>
  )
}
```

**Updating meta:**

```tsx
const MentionMark = () => {
  const { value, meta, change } = useMark()

  const updateUserId = (newId: string) => {
    change({ meta: newId })
  }

  return (
    <span>
      {value}
      <button onClick={() => updateUserId('456')}>
        Change user
      </button>
    </span>
  )
}
```

**Updating both:**

```tsx
change({
  value: 'New Name',
  meta: 'new-id'
})
```

#### remove

- **Type:** `() => void`
- **Description:** Remove this mark from the editor
- **Effect:** Mark is replaced with its plain text value

```tsx
const RemovableMark = () => {
  const { value, remove } = useMark()

  return (
    <span>
      {value}
      <button onClick={remove} aria-label="Remove mark">
        ×
      </button>
    </span>
  )
}
```

#### ref

- **Type:** `RefObject<HTMLElement>`
- **Description:** Reference to the mark's DOM element
- **Use for:** Focus management, measurements, animations

```tsx
const FocusableMark = () => {
  const { value, ref } = useMark()

  const focusMark = () => {
    ref.current?.focus()
  }

  return (
    <button ref={ref} onClick={focusMark}>
      {value}
    </button>
  )
}
```

**Scrolling to mark:**

```tsx
const ScrollableMark = () => {
  const { value, ref } = useMark()

  useEffect(() => {
    if (someCondition) {
      ref.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [someCondition])

  return <mark ref={ref}>{value}</mark>
}
```

#### readOnly

- **Type:** `boolean`
- **Description:** Whether the editor is in read-only mode
- **Inherited from:** `<MarkedInput readOnly={...} />`

```tsx
const InteractiveMark = () => {
  const { value, remove, readOnly } = useMark()

  return (
    <span>
      {value}
      {!readOnly && (
        <button onClick={remove}>×</button>
      )}
    </span>
  )
}
```

#### depth

- **Type:** `number`
- **Description:** Nesting depth (0 for root level)
- **Use for:** Styling nested marks, limiting nesting depth

```tsx
const NestedMark = () => {
  const { nested, depth } = useMark()

  const opacity = Math.max(0.3, 1 - depth * 0.2)

  return (
    <span style={{ opacity }}>
      {nested}
    </span>
  )
}
```

**Limiting nesting depth:**

```tsx
const LimitedNestedMark = () => {
  const { value, nested, depth, hasChildren } = useMark()

  if (depth > 3) {
    return <span>{value}</span> // Render as plain text
  }

  return <mark>{hasChildren ? nested : value}</mark>
}
```

#### hasChildren

- **Type:** `boolean`
- **Description:** Whether this mark contains nested marks
- **Use for:** Conditional rendering logic

```tsx
const SmartMark = () => {
  const { value, nested, hasChildren } = useMark()

  return (
    <span className={hasChildren ? 'has-children' : 'leaf'}>
      {hasChildren ? nested : value}
    </span>
  )
}
```

#### parent

- **Type:** `MarkContext | null`
- **Description:** Parent mark context (null if root level)
- **Use for:** Accessing parent mark data, hierarchical operations

```tsx
const ChildAwareMark = () => {
  const { value, parent } = useMark()

  const parentValue = parent?.value || 'none'

  return (
    <span title={`Parent: ${parentValue}`}>
      {value}
    </span>
  )
}
```

**Removing parent:**

```tsx
const ParentRemoverMark = () => {
  const { value, parent } = useMark()

  return (
    <span>
      {value}
      {parent && (
        <button onClick={parent.remove}>
          Remove parent
        </button>
      )}
    </span>
  )
}
```

#### children

- **Type:** `MarkContext[]`
- **Description:** Array of child mark contexts
- **Use for:** Iterating over child marks, bulk operations

```tsx
const ParentMark = () => {
  const { nested, children } = useMark()

  const removeAllChildren = () => {
    children.forEach(child => child.remove())
  }

  return (
    <div>
      {nested}
      {children.length > 0 && (
        <button onClick={removeAllChildren}>
          Remove {children.length} children
        </button>
      )}
    </div>
  )
}
```

**Analyzing children:**

```tsx
const AnalyzerMark = () => {
  const { nested, children } = useMark()

  const childValues = children.map(c => c.value).join(', ')

  return (
    <div>
      <div>{nested}</div>
      <small>Children: {childValues || 'none'}</small>
    </div>
  )
}
```

### Complete Example

```tsx
import { useMark } from 'rc-marked-input'
import { useState } from 'react'
import type { FC } from 'react'

const AdvancedMark: FC = () => {
  const {
    value,
    meta,
    nested,
    label,
    change,
    remove,
    ref,
    readOnly,
    depth,
    hasChildren,
    parent,
    children
  } = useMark<string, string>()

  const [editing, setEditing] = useState(false)

  const handleEdit = () => {
    if (readOnly) return
    setEditing(true)
    setTimeout(() => ref.current?.focus(), 0)
  }

  const handleSave = () => {
    setEditing(false)
  }

  const handleInput = (e: FormEvent<HTMLSpanElement>) => {
    const newValue = e.currentTarget.textContent || ''
    change({ value: newValue }, { silent: true })
  }

  if (editing) {
    return (
      <span
        ref={ref}
        contentEditable
        onInput={handleInput}
        onBlur={handleSave}
        suppressContentEditableWarning
        style={{
          background: '#fff3cd',
          outline: '2px solid #ffc107'
        }}
      >
        {value}
      </span>
    )
  }

  return (
    <span
      ref={ref}
      className={`mark depth-${depth} ${hasChildren ? 'has-children' : ''}`}
      title={`Meta: ${meta}, Parent: ${parent?.value || 'none'}, Children: ${children.length}`}
      style={{
        marginLeft: depth * 8,
        opacity: 1 - depth * 0.15
      }}
    >
      {hasChildren ? nested : label}
      {!readOnly && (
        <>
          <button onClick={handleEdit}>✎</button>
          <button onClick={remove}>×</button>
        </>
      )}
    </span>
  )
}
```

## useOverlay

Hook for creating custom autocomplete overlays.

### Signature

```tsx
function useOverlay(): OverlayContext

interface OverlayContext {
  // Positioning
  style: {
    left: number
    top: number
  }

  // Current state
  match: OverlayMatch

  // Operations
  select: (data: SelectData) => void
  close: () => void

  // DOM reference
  ref: RefObject<HTMLDivElement>
}

interface OverlayMatch {
  trigger: string
  value: string
}

interface SelectData {
  value: string
  meta?: string
}
```

### Return Properties

#### style

- **Type:** `{ left: number; top: number }`
- **Description:** Absolute positioning coordinates for overlay
- **Units:** Pixels
- **Calculated from:** Trigger character position in editor

```tsx
const CustomOverlay = () => {
  const { style, ref } = useOverlay()

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: style.left,
        top: style.top,
        background: 'white',
        border: '1px solid #ccc',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000
      }}
    >
      {/* Overlay content */}
    </div>
  )
}
```

**Adjusting position:**

```tsx
const AdjustedOverlay = () => {
  const { style, ref } = useOverlay()

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: style.left,
        top: style.top + 24, // Offset below trigger
        transform: 'translateX(-50%)', // Center horizontally
      }}
    >
      {/* Content */}
    </div>
  )
}
```

#### match

- **Type:** `OverlayMatch`
- **Description:** Current trigger and query text
- **Properties:**
  - `trigger: string` - The trigger character (@, #, /, etc.)
  - `value: string` - Text typed after trigger

```tsx
const SearchableOverlay = () => {
  const { match } = useOverlay()

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(match.value.toLowerCase())
  )

  return (
    <div>
      <div>Search: {match.trigger}{match.value}</div>
      {filteredItems.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  )
}
```

**Multiple trigger support:**

```tsx
const MultiTriggerOverlay = () => {
  const { match } = useOverlay()

  let items: any[]
  let placeholder: string

  switch (match.trigger) {
    case '@':
      items = users
      placeholder = 'Search users...'
      break
    case '#':
      items = hashtags
      placeholder = 'Search hashtags...'
      break
    case '/':
      items = commands
      placeholder = 'Search commands...'
      break
    default:
      items = []
      placeholder = ''
  }

  return (
    <div>
      <input placeholder={placeholder} value={match.value} readOnly />
      {/* Render filtered items */}
    </div>
  )
}
```

#### select

- **Type:** `(data: SelectData) => void`
- **Description:** Insert selected item as a mark
- **Parameters:**
  - `value: string` - Mark value
  - `meta?: string` - Mark metadata (optional)

```tsx
const SelectableOverlay = () => {
  const { select, close } = useOverlay()

  const handleSelect = (item: any) => {
    select({
      value: item.name,
      meta: item.id
    })
  }

  return (
    <div>
      {items.map(item => (
        <button key={item.id} onClick={() => handleSelect(item)}>
          {item.name}
        </button>
      ))}
    </div>
  )
}
```

**With additional actions:**

```tsx
const ActionableOverlay = () => {
  const { select } = useOverlay()

  const handleSelect = async (item: any) => {
    // Perform side effects
    await trackSelection(item.id)
    updateRecentItems(item)

    // Insert mark
    select({
      value: item.name,
      meta: item.id
    })
  }

  return (/* ... */)
}
```

#### close

- **Type:** `() => void`
- **Description:** Close the overlay without selecting anything
- **Use for:** Cancel actions, Escape key, outside clicks

```tsx
const CancellableOverlay = () => {
  const { close } = useOverlay()

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  return (
    <div onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Content */}
      <button onClick={close}>Cancel</button>
    </div>
  )
}
```

#### ref

- **Type:** `RefObject<HTMLDivElement>`
- **Description:** Reference to overlay DOM element
- **Required for:** Outside click detection, keyboard event handling

```tsx
const ProperOverlay = () => {
  const { ref } = useOverlay()

  // REQUIRED: Attach ref to root element
  return (
    <div ref={ref}>
      {/* Content */}
    </div>
  )
}
```

### Complete Example

```tsx
import { useOverlay } from 'rc-marked-input'
import { useState, useEffect } from 'react'
import type { FC } from 'react'

interface User {
  id: string
  name: string
  avatar: string
}

interface Props {
  users: User[]
}

const MentionOverlay: FC<Props> = ({ users }) => {
  const { style, match, select, close, ref } = useOverlay()
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Filter users based on query
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(match.value.toLowerCase())
  )

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredUsers.length])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          Math.min(prev + 1, filteredUsers.length - 1)
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
      case 'Tab':
        e.preventDefault()
        if (filteredUsers[selectedIndex]) {
          handleSelect(filteredUsers[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
    }
  }

  const handleSelect = (user: User) => {
    select({
      value: user.name,
      meta: user.id
    })
  }

  if (filteredUsers.length === 0) {
    return (
      <div
        ref={ref}
        style={{
          position: 'absolute',
          left: style.left,
          top: style.top,
          background: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
          padding: 16,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
      >
        No users found for "{match.value}"
      </div>
    )
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: style.left,
        top: style.top,
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        minWidth: 280,
        maxHeight: 320,
        overflow: 'auto',
        zIndex: 1000
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {filteredUsers.map((user, index) => (
        <button
          key={user.id}
          onClick={() => handleSelect(user)}
          onMouseEnter={() => setSelectedIndex(index)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            border: 'none',
            background: index === selectedIndex ? '#f5f5f5' : 'white',
            width: '100%',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <img
            src={user.avatar}
            alt={user.name}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%'
            }}
          />
          <span>{user.name}</span>
        </button>
      ))}
    </div>
  )
}
```

## useListener

Hook for subscribing to editor events outside of marks.

### Signature

```tsx
function useListener(
  event: EditorEvent,
  handler: EventHandler,
  deps?: DependencyList
): void

type EditorEvent =
  | 'change'
  | 'focus'
  | 'blur'
  | 'keydown'
  | 'keyup'
  | 'paste'
  | 'markAdded'
  | 'markRemoved'
  | 'markChanged'
  | 'overlayOpened'
  | 'overlayClosed'

type EventHandler = (event: any) => void
```

### Usage

#### Listening to changes

```tsx
import { useListener } from 'rc-marked-input'

function MyComponent() {
  useListener('change', (event) => {
    console.log('Editor content changed:', event.value)
  })

  return <MarkedInput {...props} />
}
```

#### Listening to mark events

```tsx
function MarkTracker() {
  const [markCount, setMarkCount] = useState(0)

  useListener('markAdded', (event) => {
    console.log('Mark added:', event.mark)
    setMarkCount(count => count + 1)
  })

  useListener('markRemoved', (event) => {
    console.log('Mark removed:', event.mark)
    setMarkCount(count => count - 1)
  })

  return <div>Total marks: {markCount}</div>
}
```

#### Listening to keyboard events

```tsx
function KeyboardListener() {
  useListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      handleSubmit()
    }
  })

  return <MarkedInput {...props} />
}
```

#### With dependencies

```tsx
function ConditionalListener() {
  const [enabled, setEnabled] = useState(false)

  useListener(
    'change',
    (event) => {
      if (enabled) {
        saveContent(event.value)
      }
    },
    [enabled] // Re-subscribe when enabled changes
  )

  return <MarkedInput {...props} />
}
```

### Event Types

#### change

Fired when editor content changes.

```tsx
interface ChangeEvent {
  value: string
  previousValue: string
}

useListener('change', (event: ChangeEvent) => {
  console.log('Changed from:', event.previousValue)
  console.log('Changed to:', event.value)
})
```

#### markAdded

Fired when a mark is added.

```tsx
interface MarkAddedEvent {
  mark: {
    value: string
    meta: string
    position: number
  }
}

useListener('markAdded', (event: MarkAddedEvent) => {
  trackEvent('mark_added', {
    value: event.mark.value,
    position: event.mark.position
  })
})
```

#### markRemoved

Fired when a mark is removed.

```tsx
interface MarkRemovedEvent {
  mark: {
    value: string
    meta: string
    position: number
  }
}

useListener('markRemoved', (event: MarkRemovedEvent) => {
  console.log('Mark removed:', event.mark.value)
})
```

#### overlayOpened

Fired when overlay opens.

```tsx
interface OverlayOpenedEvent {
  trigger: string
  position: { x: number; y: number }
}

useListener('overlayOpened', (event: OverlayOpenedEvent) => {
  console.log('Overlay opened with trigger:', event.trigger)
})
```

### Complete Example

```tsx
import { MarkedInput, useListener } from 'rc-marked-input'
import { useState, useCallback } from 'react'

function EditorWithTracking() {
  const [value, setValue] = useState('')
  const [stats, setStats] = useState({
    changes: 0,
    marksAdded: 0,
    marksRemoved: 0,
    overlayOpens: 0
  })

  useListener('change', useCallback(() => {
    setStats(s => ({ ...s, changes: s.changes + 1 }))
  }, []))

  useListener('markAdded', useCallback(() => {
    setStats(s => ({ ...s, marksAdded: s.marksAdded + 1 }))
  }, []))

  useListener('markRemoved', useCallback(() => {
    setStats(s => ({ ...s, marksRemoved: s.marksRemoved + 1 }))
  }, []))

  useListener('overlayOpened', useCallback(() => {
    setStats(s => ({ ...s, overlayOpens: s.overlayOpens + 1 }))
  }, []))

  useListener('keydown', useCallback((e) => {
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      saveContent(value)
    }
  }, [value]))

  return (
    <div>
      <MarkedInput
        value={value}
        onChange={setValue}
        Mark={MyMark}
      />

      <div className="stats">
        <div>Changes: {stats.changes}</div>
        <div>Marks added: {stats.marksAdded}</div>
        <div>Marks removed: {stats.marksRemoved}</div>
        <div>Overlay opens: {stats.overlayOpens}</div>
      </div>
    </div>
  )
}
```

## Best Practices

### useMark

**✅ Do:**

```tsx
// Memoize mark components
const MemoizedMark = memo(() => {
  const { value } = useMark()
  return <span>{value}</span>
})

// Use silent changes for contentEditable
const EditableMark = () => {
  const { change } = useMark()
  const handleInput = (e) => {
    change({ value: e.currentTarget.textContent }, { silent: true })
  }
  return <span contentEditable onInput={handleInput} />
}

// Check readOnly before operations
const InteractiveMark = () => {
  const { remove, readOnly } = useMark()
  return readOnly ? <span /> : <button onClick={remove} />
}
```

**❌ Don't:**

```tsx
// Don't call hooks conditionally
const BadMark = ({ condition }) => {
  if (condition) {
    const { value } = useMark() // ❌ Conditional hook
    return <span>{value}</span>
  }
  return null
}

// Don't forget silent for contentEditable
const BadEditableMark = () => {
  const { change } = useMark()
  const handleInput = (e) => {
    change({ value: e.currentTarget.textContent }) // ❌ Cursor will jump
  }
  return <span contentEditable onInput={handleInput} />
}

// Don't mutate mark data directly
const BadMutatingMark = () => {
  const mark = useMark()
  mark.value = 'new value' // ❌ Use change() instead
  return <span>{mark.value}</span>
}
```

### useOverlay

**✅ Do:**

```tsx
// Always attach ref
const GoodOverlay = () => {
  const { ref } = useOverlay()
  return <div ref={ref}>{/* content */}</div>
}

// Use absolute positioning
const GoodPositioning = () => {
  const { style, ref } = useOverlay()
  return (
    <div
      ref={ref}
      style={{ position: 'absolute', left: style.left, top: style.top }}
    />
  )
}

// Handle keyboard navigation
const GoodKeyboard = () => {
  const { select, close } = useOverlay()
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') select(items[index])
    if (e.key === 'Escape') close()
  }
  return <div onKeyDown={handleKeyDown} tabIndex={-1} />
}
```

**❌ Don't:**

```tsx
// Don't forget ref
const BadOverlay = () => {
  const { style } = useOverlay()
  return <div>{/* ❌ Missing ref */}</div>
}

// Don't use fixed positioning
const BadPositioning = () => {
  const { ref } = useOverlay()
  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top: 100, left: 100 }} // ❌ Use absolute
    />
  )
}

// Don't forget to close on Escape
const BadKeyboard = () => {
  const { select } = useOverlay()
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') select(items[index])
    // ❌ Missing Escape handler
  }
  return <div onKeyDown={handleKeyDown} />
}
```

### useListener

**✅ Do:**

```tsx
// Wrap handlers in useCallback
function GoodListener() {
  const handler = useCallback((event) => {
    console.log(event)
  }, [])

  useListener('change', handler)
}

// Specify dependencies
function GoodDeps() {
  const [enabled, setEnabled] = useState(false)

  useListener('change', (e) => {
    if (enabled) save(e.value)
  }, [enabled]) // ✅ Include enabled
}
```

**❌ Don't:**

```tsx
// Don't create new handlers on every render
function BadListener() {
  useListener('change', (event) => { // ❌ New function every render
    console.log(event)
  })
}

// Don't forget dependencies
function BadDeps() {
  const [enabled, setEnabled] = useState(false)

  useListener('change', (e) => {
    if (enabled) save(e.value)
  }) // ❌ Missing [enabled] dependency
}
```

## Troubleshooting

### useMark() returns undefined

**Problem:** Hook returns undefined or throws error.

**Cause:** Hook called outside Mark component context.

**Solution:** Only use useMark() inside components passed to `Mark` prop:

```tsx
// ✅ Correct
<MarkedInput Mark={MyMark} />

function MyMark() {
  const { value } = useMark() // ✅ Works
  return <span>{value}</span>
}

// ❌ Wrong
function Parent() {
  const { value } = useMark() // ❌ No context
  return <MarkedInput Mark={MyMark} />
}
```

### useOverlay() returns undefined

**Problem:** Hook returns undefined.

**Cause:** Hook called outside Overlay component context.

**Solution:** Only use inside custom overlay components:

```tsx
<MarkedInput
  Overlay={MyOverlay} // ✅ Hook works here
/>

function MyOverlay() {
  const { style } = useOverlay() // ✅ Works
  return <div />
}
```

### Cursor jumps in contentEditable

**Problem:** Cursor jumps to end when typing.

**Cause:** Not using `silent: true` option.

**Solution:** Add silent option to change():

```tsx
const EditableMark = () => {
  const { change } = useMark()

  const handleInput = (e) => {
    change(
      { value: e.currentTarget.textContent },
      { silent: true } // ✅ Prevents cursor jumping
    )
  }

  return <span contentEditable onInput={handleInput} />
}
```

## TypeScript

### Typed useMark

```tsx
interface MentionMarkProps {
  username: string
  userId: string
}

const MentionMark: FC<MentionMarkProps> = ({ username, userId }) => {
  // Type is inferred from generic
  const { value, meta } = useMark<string, string>()

  return <a href={`/users/${userId}`}>@{username}</a>
}
```

### Typed useOverlay

```tsx
const TypedOverlay: FC = () => {
  const { match, select } = useOverlay()

  const handleSelect = (user: User) => {
    select({
      value: user.name,
      meta: user.id.toString()
    })
  }

  return <div>{/* ... */}</div>
}
```

## Next Steps

- **[Types API](./types)** - All exported TypeScript types
- **[Helpers API](./helpers)** - Utility functions
- **[Components API](./components)** - MarkedInput and createMarkedInput
- **[Dynamic Marks Guide](../guides/dynamic-marks)** - Advanced useMark() patterns
- **[Overlay Customization Guide](../guides/overlay-customization)** - Advanced useOverlay() patterns

---

**See also:**
- [Quick Start](../introduction/quick-start) - Basic usage
- [Examples](../examples/mention-system) - Production implementations
