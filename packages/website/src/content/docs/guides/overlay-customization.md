---
title: 🚧 Overlay Customization
description: Custom autocomplete overlays for Markput - trigger characters, suggestions, positioning, useOverlay hook, and styling
keywords: [overlay, autocomplete, suggestions, trigger characters, useOverlay hook, positioning, custom UI]
---

The overlay system provides autocomplete, suggestions, and contextual menus when users type trigger characters. Markput includes a default `OverlayList` component — one list for both jobs — but you can fully customize it to match your needs.

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

## The Default Overlay List

Markput includes a built-in `OverlayList` component, and it is what a trigger option resolves to
when it names no `Overlay` of its own. What it offers depends on the matched option and on
nothing else: an option that declares `overlay.data` offers that data, and an option that
declares none offers the ROW MENU (see below). One list, one keyboard, either way.

```tsx
import {MarkedInput} from '@markput/react'
import {useState} from 'react'

function BasicSuggestions() {
    const [value, setValue] = useState('Type @ to mention someone')

    return (
        <MarkedInput
            value={value}
            onChange={setValue}
            Mark={props => <span>{props.value}</span>}
            options={[
                {
                    markup: '@[__value__]',
                    overlay: {
                        trigger: '@',
                        data: ['Alice', 'Bob', 'Charlie', 'Diana'],
                    },
                },
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

### Suggestions with an identity

A row of `data` may be a string or `{value, meta?, label?}`. The object form is what a list with
an id behind it needs — the `__meta__` half of `@[__value__](__meta__)` — so a mention picker no
longer has to abandon the built-in overlay and write its own component:

```tsx
{
    markup: '@[__value__](__meta__)',
    overlay: {
        trigger: '@',
        data: [
            {value: 'Sarah Chen', meta: 'sarah.chen'},
            {value: 'Marcus Kane', meta: 'marcus.kane'},
        ],
    },
}
```

Filtering matches the LABEL and nothing else — `label` when given, otherwise `value` — so an id
the user cannot see never matches a query. A bare string still writes the row's index as its
meta, because a label is the only identity it has.

## The Row Menu

A `/` menu is not a custom overlay: an option that declares a `menu` IS in the menu, and each
adapter ships the paint.

```tsx
const options = [
    {overlay: {trigger: '/'}},
    {markup: '# __slot__', row: {Component: 'h1'}, menu: {label: 'Heading 1', keywords: ['h1', 'title']}},
    {markup: '- __slot__', row: {Component: 'li', continues: true}, menu: {label: 'Bulleted list'}},
    {markup: '> __slot__', row: {Component: 'blockquote'}, menu: {label: 'Quote'}},
]
```

That is the whole wiring, and it names no component: the `/` option carries no markup of its own
— it exists to own the trigger — declares no `overlay.data`, and therefore resolves to the
built-in list showing the row menu. What a choice writes is the ROW KIND the chosen entry names,
by click or by ↑↓ and Enter.

| `MenuSpec` field | Meaning                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `label`          | What the row shows, and the only text the query matches                |
| `keywords`       | Extra query terms that never appear on screen                          |
| `meta`           | Seeds the meta of the row this entry writes                            |
| `text`           | Seeds the body of the row this entry writes                            |

**Two gestures, one splice.** On a row holding nothing but the trigger the entry INSERTS: the
row becomes that kind, seeded from `menu.text`/`menu.meta`. On a row that already has text it
CONVERTS: `'plain row'` + `/` + Heading 1 emits `'# plain row'`, and the seeds are not applied,
because a turn-into must not discard what the user typed. Both run
`RowNode.turnInto(option, {text})` once — a single splice, which is what controlled mode
requires of a gesture that removes a span and retypes a row at the same time.

Which gesture it is is not published, because nothing paints it: `choose` decides it from the
caret row's own body and no menu component asks. An entry that wants to say "Turn into" needs
core to answer, so the member comes back with the reader that needs it and not before.

**Replacing `OverlayList`.** A consumer's own list reads the same things and still writes no
filtering and no insert logic. `activate()` is what buys the keyboard — arrows move `active`,
Enter chooses — and it is opt-in so an overlay that is not a list never swallows those keys:

```tsx fragment
function MyMenu() {
    const {rows, active, activate, choose, style, ref} = useOverlay()
    useEffect(activate, [activate])
    if (rows.length === 0) return null

    return (
        <ul ref={ref as React.Ref<HTMLUListElement>} style={{position: 'absolute', ...style}}>
            {rows.map((row, index) => (
                <li
                    key={row.label}
                    style={index === active ? {background: '#cce9ff'} : undefined}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => choose(row.pick)}
                >
                    {row.label}
                </li>
            ))}
        </ul>
    )
}
```

## The useOverlay Hook

Build custom overlays with the `useOverlay()` hook:

```tsx
import {useOverlay} from '@markput/react'

function CustomOverlay() {
    const overlay = useOverlay()

    return <div>Custom overlay</div>
}
```

### useOverlay API

| Property    | Type                                | Description                                     |
| ----------- | ----------------------------------- | ----------------------------------------------- |
| `style`     | `{left, top}`                       | Absolute position for overlay                   |
| `close()`   | `function`                          | Close the overlay                               |
| `select()`  | `function`                          | Insert a mark                                   |
| `choose()`  | `function`                          | The one accept path; `{option}` retypes the row |
| `rows`      | `readonly OverlayRow[]`             | The list on offer, already narrowed by the query|
| `active`    | `number`                            | Index of the highlighted row; `NaN` for none    |
| `activate()`| `function`                          | Bind ↑↓/Enter; returns the unbind               |
| `match`     | `OverlayMatch`                      | Match details (value, source, trigger)          |
| `ref`       | `RefObject`                         | Ref for outside click detection                 |

**Complete interface:**

```tsx
interface OverlayHandler {
    style: {
        left: number // X coordinate
        top: number // Y coordinate
    }
    close: () => void
    select: (value: {value: string; meta?: string}) => void
    /** `{option}` turns the caret's row into that option's kind; `{value, meta}` is `select`. */
    choose: (pick: OverlayPick) => boolean
    /** The matched option's `overlay.data`, or the row menu when it declares none. */
    rows: readonly OverlayRow[]
    /** Index into `rows` of the highlighted row; NaN when none is. */
    active: number
    /** Bind ↑↓/Enter to the editing host, and return the unbind. Opt-in. */
    activate: () => () => void
    match: {
        value: string // Typed text after trigger
        source: string // Full matched text including trigger
        span: string // Text of the node the match was found in
        node: Node // DOM node
        range: Anchors // The span `select()` replaces, as node anchors
        option: Option // Matched option config
    }
    ref: RefObject<HTMLElement>
}
```

## Custom Overlay Examples

### Example 1: Simple List

```tsx
import {useOverlay} from '@markput/react'

function SimpleListOverlay() {
    const {select} = useOverlay()

    const items = ['Apple', 'Banana', 'Cherry']

    return (
        <ul className="overlay">
            {items.map(item => (
                <li key={item} onClick={() => select({value: item})}>
                    {item}
                </li>
            ))}
        </ul>
    )
}

// Usage
;<MarkedInput Overlay={SimpleListOverlay} options={[{overlay: {trigger: '@'}}]} />
```

### Example 2: Positioned Overlay

Position the overlay at the caret:

```tsx
function PositionedOverlay() {
    const {style, select} = useOverlay()

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
                zIndex: 1000,
            }}
        >
            {items.map(item => (
                <div key={item} onClick={() => select({value: item})} style={{padding: '8px 12px', cursor: 'pointer'}}>
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
    const {select, match, close} = useOverlay()

    const allItems = ['Alice', 'Bob', 'Charlie', 'Diana']

    // Filter items based on typed text
    const filtered = allItems.filter(item => item.toLowerCase().includes(match.value.toLowerCase()))

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
                <li key={item} onClick={() => select({value: item})}>
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
    const {select} = useOverlay()

    const users = [
        {id: '1', name: 'Alice', avatar: '👩'},
        {id: '2', name: 'Bob', avatar: '👨'},
        {id: '3', name: 'Charlie', avatar: '🧑'},
    ]

    return (
        <div className="user-overlay">
            {users.map(user => (
                <div
                    key={user.id}
                    onClick={() =>
                        select({
                            value: user.name,
                            meta: user.id, // Store user ID in metadata
                        })
                    }
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
;<MarkedInput
    Overlay={UserOverlay}
    options={[
        {
            markup: '@[__value__](__meta__)',
            overlay: {trigger: '@'},
        },
    ]}
/>
```

### Example 5: Keyboard Navigation

Add keyboard support:

```tsx
import {useOverlay} from '@markput/react'
import {useState, useEffect} from 'react'

function KeyboardOverlay() {
    const {select, close, ref} = useOverlay()
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
                select({value: items[selected]})
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
                <div key={item} onClick={() => select({value: item})} className={index === selected ? 'selected' : ''}>
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
    const {select, ref} = useOverlay()

    const items = ['Item 1', 'Item 2']

    return (
        <div
            ref={ref} // Important for outside click detection
            className="overlay"
        >
            {items.map(item => (
                <div key={item} onClick={() => select({value: item})}>
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
    overlay: {
      trigger: '@',
      data: ['Alice', 'Bob']
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
    overlay: { trigger: '@', data: users }
  },
  {
    markup: '#[__value__](hashtag)',
    overlay: { trigger: '#', data: hashtags }
  },
  {
    markup: '/[__value__](command)',
    overlay: { trigger: '/', data: commands }
  }
]}
```

### Multi-Character Triggers

```tsx
options={[
  {
    markup: '{{__value__}}',
    overlay: {
      trigger: '{{',
      data: ['name', 'email', 'date']
    }
  }
]}
```

## Per-Option Custom Overlays

Use different overlay components for different triggers:

```tsx
import {MarkedInput} from '@markput/react'

function UserOverlay() {
    const {select} = useOverlay()
    return (
        <div className="user-overlay">
            <div onClick={() => select({value: 'Alice'})}>👩 Alice</div>
            <div onClick={() => select({value: 'Bob'})}>👨 Bob</div>
        </div>
    )
}

function CommandOverlay() {
    const {select} = useOverlay()
    return (
        <div className="command-overlay">
            <div onClick={() => select({value: 'heading'})}>📝 Heading</div>
            <div onClick={() => select({value: 'bold'})}>🔤 Bold</div>
        </div>
    )
}

function Editor() {
    const [value, setValue] = useState('')

    return (
        <MarkedInput
            value={value}
            onChange={setValue}
            Mark={props => <span>{props.value}</span>}
            options={[
                {
                    markup: '@[__value__]',
                    overlay: {slot: UserOverlay, trigger: '@'}, // Custom overlay for @
                },
                {
                    markup: '/[__value__]',
                    overlay: {slot: CommandOverlay, trigger: '/'}, // Custom overlay for /
                },
            ]}
        />
    )
}
```

## Overlay with Data Loading

Load data asynchronously:

```tsx
import {useOverlay} from '@markput/react'
import {useState, useEffect} from 'react'

function AsyncOverlay() {
    const {select, match} = useOverlay()
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
                <div key={user.id} onClick={() => select({value: user.name, meta: user.id})}>
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
    showOverlayOn="change" // Default: show on text change
    // or
    showOverlayOn="selectionChange" // Show on cursor move
    // or
    showOverlayOn={['change', 'selectionChange']} // Both
    // or
    showOverlayOn="none" // Never show automatically
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
import {useOverlay} from '@markput/react'
import {useState, useEffect} from 'react'

function RichUserOverlay() {
    const {select, match, style, ref} = useOverlay()
    const [selected, setSelected] = useState(0)

    const users = [
        {id: '1', name: 'Alice Johnson', avatar: '👩', role: 'Designer'},
        {id: '2', name: 'Bob Smith', avatar: '👨', role: 'Developer'},
        {id: '3', name: 'Charlie Brown', avatar: '🧑', role: 'Manager'},
    ]

    const filtered = users.filter(u => u.name.toLowerCase().includes(match.value.toLowerCase()))

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
                    meta: filtered[selected].id,
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
                zIndex: 1000,
            }}
        >
            {filtered.length === 0 ? (
                <div style={{padding: '16px', color: '#999'}}>No users found</div>
            ) : (
                filtered.map((user, index) => (
                    <div
                        key={user.id}
                        onClick={() => select({value: user.name, meta: user.id})}
                        style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            background: index === selected ? '#f5f5f5' : 'transparent',
                        }}
                    >
                        <span style={{fontSize: '24px'}}>{user.avatar}</span>
                        <div>
                            <div style={{fontWeight: 500}}>{user.name}</div>
                            <div style={{fontSize: '12px', color: '#666'}}>{user.role}</div>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}
```

### Example: Notion-style Slash Commands

This one is no longer an example of a custom overlay, because it is not custom any more — see
[The Row Menu](#the-row-menu). The list, the filtering and the write all moved into core:

```tsx
const options = [
    {overlay: {trigger: '/'}},
    {markup: '# __slot__', row: {Component: 'h1'}, menu: {label: 'Heading 1', keywords: ['h1']}},
    {markup: '## __slot__', row: {Component: 'h2'}, menu: {label: 'Heading 2', keywords: ['h2']}},
    {markup: '- __slot__', row: {Component: 'li', continues: true}, menu: {label: 'Bulleted list'}},
    {markup: '```__meta__\n__value__```', row: {Component: 'pre'}, menu: {label: 'Code', keywords: ['fence']}},
]
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
import {useOverlay} from '@markput/react'
import type {OverlayHandler} from '@markput/react'

function TypedOverlay() {
    const overlay: OverlayHandler = useOverlay()

    const handleSelect = (value: string) => {
        overlay.select({value, meta: 'optional'})
    }

    return <div ref={overlay.ref}>{/* overlay content */}</div>
}
```

**Key Takeaways:**

- Use `useOverlay()` hook for custom overlays
- Position with `style.left` and `style.top`
- Attach `ref` for outside click detection
- Use `select()` to insert marks
- Add keyboard navigation for better UX

**Try it live:** [CodeSandbox - Custom Overlay](https://codesandbox.io/s/custom-overlay-1m5ctx)
