---
title: 🚧 Dynamic Marks
description: Build interactive React marks - useMark hook tutorial for editable, removable, focusable mentions and marks
keywords: [useMark hook, interactive marks, editable, removable, focusable, mark state, event handling]
---

Dynamic marks are marks that users can interact with - edit, remove, focus, or trigger custom actions. Markput provides the `useMark()` hook to build dynamic mark components.

## The useMark Hook

The `useMark()` hook gives your Mark component access to its internal state and methods:

```tsx
import {useMark} from 'rc-marked-input'

function DynamicMark() {
    const mark = useMark()

    return <span>{mark.value}</span>
}
```

### useMark API

The hook returns an object with these properties:

| Property      | Type                     | Description                            |
| ------------- | ------------------------ | -------------------------------------- |
| `value`       | `string \| undefined`    | Mark's value (from `__value__`)        |
| `meta`        | `string \| undefined`    | Mark's metadata (from `__meta__`)      |
| `nested`      | `string \| undefined`    | Raw nested content (from `__nested__`) |
| `label`       | `string`                 | Display label (value or nested)        |
| `ref`         | `RefObject<T>`           | Ref for keyboard focus                 |
| `change()`    | `function`               | Update the mark                        |
| `remove()`    | `function`               | Remove the mark                        |
| `readOnly`    | `boolean \| undefined`   | Whether editor is read-only            |
| `depth`       | `number`                 | Nesting depth (0 for root)             |
| `hasChildren` | `boolean`                | Whether mark has nested children       |
| `parent`      | `MarkToken \| undefined` | Parent mark (if nested)                |
| `children`    | `Token[]`                | Child tokens (if nested)               |

## Editable Marks

Make marks editable with `contentEditable`:

```tsx
import {MarkedInput, useMark} from 'rc-marked-input'
import {useState} from 'react'

function EditableMark() {
    const {label, change} = useMark()

    const handleInput = e => {
        const newValue = e.currentTarget.textContent || ''
        change(
            {value: newValue, meta: ''},
            {silent: true} // Don't trigger re-render
        )
    }

    return (
        <mark contentEditable suppressContentEditableWarning onInput={handleInput}>
            {label}
        </mark>
    )
}

function Editor() {
    const [value, setValue] = useState('Edit this @[mark]!')

    return <MarkedInput value={value} onChange={setValue} Mark={EditableMark} />
}
```

### The `change()` Method

Update a mark's value and metadata:

```tsx
change(
  {
    value: string,  // New value
    meta?: string   // New metadata (optional)
  },
  {
    silent?: boolean  // Skip re-render (default: false)
  }
)
```

**Parameters:**

- `value` - New mark content
- `meta` - New metadata (optional)
- `options.silent` - If `true`, updates editor state without re-rendering the mark itself. Use for `contentEditable` to prevent cursor jumping.

**Example: Edit with metadata**

```tsx
function EditableTagMark() {
    const {label, meta, change} = useMark()
    const [color, setColor] = useState(meta || 'blue')

    const handleEdit = e => {
        change({value: e.target.value, meta: color})
    }

    const handleColorChange = newColor => {
        setColor(newColor)
        change({value: label, meta: newColor})
    }

    return (
        <div>
            <input value={label} onChange={handleEdit} />
            <ColorPicker value={color} onChange={handleColorChange} />
        </div>
    )
}
```

### Silent Updates

The `silent` option prevents the mark from re-rendering itself:

```tsx
// ❌ Without silent - cursor jumps on each keystroke
change({value: newValue})

// ✅ With silent - smooth editing experience
change({value: newValue}, {silent: true})
```

**When to use `silent: true`:**

- `contentEditable` elements
- Inline editing
- Real-time input updates
- Preventing cursor position loss

**When NOT to use:**

- Button clicks
- Dropdown selections
- Color picker changes
- Any non-text input

## Removable Marks

Allow users to delete marks:

```tsx
import {useMark} from 'rc-marked-input'

function RemovableMark() {
    const {label, remove} = useMark()

    return (
        <span className="mark">
            {label}
            <button onClick={remove} aria-label="Remove">
                ×
            </button>
        </span>
    )
}
```

### The `remove()` Method

Removes the mark from the editor:

```tsx
remove() // No parameters, no return value
```

**Example: Removable tag with confirmation**

```tsx
function ConfirmRemovableMark() {
    const {label, remove} = useMark()

    const handleRemove = () => {
        if (window.confirm(`Remove "${label}"?`)) {
            remove()
        }
    }

    return (
        <div className="tag">
            {label}
            <button onClick={handleRemove}>×</button>
        </div>
    )
}
```

**Example: Keyboard shortcut (Backspace)**

```tsx
function KeyboardRemovableMark() {
    const {label, remove, ref} = useMark()

    const handleKeyDown = e => {
        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault()
            remove()
        }
    }

    return (
        <span ref={ref} tabIndex={0} onKeyDown={handleKeyDown} className="mark">
            {label}
        </span>
    )
}
```

## Focusable Marks

Make marks focusable for keyboard navigation:

```tsx
import {useMark} from 'rc-marked-input'

function FocusableMark() {
    const {label, ref} = useMark()

    return (
        <span
            ref={ref} // Enable keyboard focus
            tabIndex={0} // Make it keyboard-accessible
            className="mark"
        >
            {label}
        </span>
    )
}
```

### The `ref` Property

The `ref` from `useMark()` enables keyboard focus management:

```tsx
const {ref} = useMark()

return (
    <span ref={ref} tabIndex={0}>
        {content}
    </span>
)
```

**Built-in keyboard behavior with `ref`:**

- **Arrow Left/Right**: Navigate between marks
- **Backspace/Delete**: Remove marks (if handler provided)
- **Tab**: Focus next mark

**Example: Focus with visual feedback**

```tsx
function FocusableMark() {
    const {label, ref} = useMark()
    const [focused, setFocused] = useState(false)

    return (
        <span
            ref={ref}
            tabIndex={0}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                outline: focused ? '2px solid blue' : 'none',
                padding: '2px 4px',
            }}
        >
            {label}
        </span>
    )
}
```

## Read-Only State

Disable interactions when editor is read-only:

```tsx
function InteractiveMark() {
    const {label, remove, readOnly} = useMark()

    return (
        <span className="mark">
            {label}
            {!readOnly && <button onClick={remove}>×</button>}
        </span>
    )
}

// Usage
;<MarkedInput readOnly={true} Mark={InteractiveMark} />
```

## Nested Mark Information

Access parent/child relationships:

```tsx
function NestedAwareMark({children}) {
    const {label, depth, hasChildren, parent} = useMark()

    return (
        <div style={{marginLeft: depth * 20}}>
            <strong>Depth: {depth}</strong>
            {hasChildren && <span> (has children)</span>}
            {parent && <span> (child of {parent.value})</span>}
            <div>{children || label}</div>
        </div>
    )
}
```

### Nesting Properties

| Property      | Type                     | Description              |
| ------------- | ------------------------ | ------------------------ |
| `depth`       | `number`                 | Nesting level (0 = root) |
| `hasChildren` | `boolean`                | Has nested marks         |
| `parent`      | `MarkToken \| undefined` | Parent mark token        |
| `children`    | `Token[]`                | Child token array        |

**Example: Collapse/Expand nested marks**

```tsx
function CollapsibleMark({children}) {
    const {label, hasChildren} = useMark()
    const [collapsed, setCollapsed] = useState(false)

    if (!hasChildren) {
        return <span>{label}</span>
    }

    return (
        <div>
            <button onClick={() => setCollapsed(!collapsed)}>{collapsed ? '▶' : '▼'}</button>
            <span>{label}</span>
            {!collapsed && <div>{children}</div>}
        </div>
    )
}
```

## Complete Examples

### Example 1: Tag Editor

```tsx
import {MarkedInput, useMark} from 'rc-marked-input'
import {useState} from 'react'

function TagMark() {
    const {label, remove, ref} = useMark()

    return (
        <span
            ref={ref}
            className="tag"
            style={{
                background: '#e3f2fd',
                padding: '4px 8px',
                borderRadius: '4px',
                margin: '2px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
            }}
        >
            {label}
            <button
                onClick={remove}
                style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                }}
            >
                ×
            </button>
        </span>
    )
}

function TagEditor() {
    const [value, setValue] = useState('Skills: @[React] @[TypeScript] @[Node.js]')

    return (
        <MarkedInput
            value={value}
            onChange={setValue}
            Mark={TagMark}
            options={[
                {
                    markup: '@[__value__]',
                    slotProps: {
                        overlay: {
                            trigger: '@',
                            data: ['React', 'TypeScript', 'Node.js', 'Python', 'Java'],
                        },
                    },
                },
            ]}
        />
    )
}
```

### Example 2: Inline Editable

```tsx
function EditableInlineMark() {
    const {label, change, ref} = useMark()
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(label)

    const handleSave = () => {
        change({value: editValue})
        setIsEditing(false)
    }

    const handleCancel = () => {
        setEditValue(label)
        setIsEditing(false)
    }

    if (isEditing) {
        return (
            <span className="editing">
                <input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleSave()
                        if (e.key === 'Escape') handleCancel()
                    }}
                    autoFocus
                />
                <button onClick={handleSave}>✓</button>
                <button onClick={handleCancel}>✗</button>
            </span>
        )
    }

    return (
        <span ref={ref} onDoubleClick={() => setIsEditing(true)} className="mark" title="Double-click to edit">
            {label}
        </span>
    )
}
```

### Example 3: Color-Coded Tags

```tsx
function ColorTagMark() {
    const {label, meta, change, remove} = useMark()
    const color = meta || 'blue'

    const colors = {
        blue: '#e3f2fd',
        green: '#e8f5e9',
        red: '#ffebee',
        yellow: '#fff9c4',
    }

    return (
        <span className="color-tag" style={{background: colors[color], padding: '4px 8px'}}>
            {label}
            <select
                value={color}
                onChange={e => change({value: label, meta: e.target.value})}
                onClick={e => e.stopPropagation()}
            >
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="red">Red</option>
                <option value="yellow">Yellow</option>
            </select>
            <button onClick={remove}>×</button>
        </span>
    )
}

// Usage
;<MarkedInput
    Mark={ColorTagMark}
    options={[
        {
            markup: '@[__value__](__meta__)',
            slotProps: {
                overlay: {trigger: '@', data: ['Important', 'Todo', 'Done']},
            },
        },
    ]}
/>
```

## Best Practices

### ✅ Do

```tsx
// Use silent for contentEditable
change({ value: newValue }, { silent: true })

// Provide keyboard navigation
<span ref={ref} tabIndex={0}>{label}</span>

// Respect readOnly state
{!readOnly && <button onClick={remove}>×</button>}

// Handle edge cases
const handleRemove = () => {
  if (confirm('Remove?')) remove()
}
```

### ❌ Don't

```tsx
// Don't call change in render
function Bad() {
    const {change} = useMark()
    change({value: 'new'}) // Infinite loop!
    return <span>Bad</span>
}

// Don't forget suppressContentEditableWarning
;<mark contentEditable>{label}</mark> // Warning!

// Don't modify mark during parent render
function Bad() {
    const {remove} = useMark()
    useEffect(() => {
        if (someCondition) remove() // Can cause issues
    })
}
```

## Edge Cases & Troubleshooting

### Cursor Jumping in ContentEditable

**Problem:** Cursor jumps to end on every keystroke

**Solution:** Use `silent: true`

```tsx
change({value: newValue}, {silent: true})
```

### Remove Not Working

**Problem:** `remove()` doesn't do anything

**Checklist:**

1. Is `readOnly` set to `true`?
2. Is the Mark component inside `<MarkedInput>`?
3. Check browser console for errors

### Focus Not Working

**Problem:** Can't focus mark with keyboard

**Solution:** Add both `ref` and `tabIndex`

```tsx
<span ref={ref} tabIndex={0}>
    {label}
</span>
```

### State Not Updating

**Problem:** Mark doesn't re-render after `change()`

**Cause:** Using `silent: true` when you shouldn't

**Solution:** Only use `silent` for `contentEditable`

```tsx
// ✅ For contentEditable
<mark contentEditable onInput={(e) => change({...}, { silent: true })} />

// ✅ For button clicks (no silent)
<button onClick={() => change({ value: 'new' })}>Update</button>
```

## TypeScript Usage

Type your dynamic marks:

```tsx
import {useMark} from 'rc-marked-input'
import type {MarkHandler} from 'rc-marked-input'

interface TagMarkProps {
    // Custom props if needed
}

function TypedDynamicMark(props: TagMarkProps) {
    const mark: MarkHandler = useMark()

    const handleEdit = (newValue: string) => {
        mark.change({value: newValue})
    }

    return (
        <span ref={mark.ref} tabIndex={0}>
            {mark.label}
            <button onClick={mark.remove}>×</button>
        </span>
    )
}
```

## Performance Considerations

### Memoize Event Handlers

```tsx
const handleRemove = useCallback(() => {
    if (confirm('Remove?')) {
        remove()
    }
}, [remove])
```

### Avoid Heavy Computations

```tsx
// ❌ Bad - runs on every render
function Bad() {
    const {label} = useMark()
    const processed = expensiveOperation(label) // Slow!
    return <span>{processed}</span>
}

// ✅ Good - memoized
function Good() {
    const {label} = useMark()
    const processed = useMemo(() => expensiveOperation(label), [label])
    return <span>{processed}</span>
}
```

**Try it:** [CodeSandbox - Dynamic Marks](https://codesandbox.io/s/dynamic-mark-w2nj82)
