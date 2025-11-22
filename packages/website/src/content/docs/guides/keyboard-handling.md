---
title: Keyboard Handling
description: Master keyboard navigation, shortcuts, and custom interactions
version: 1.0.0
---

Markput provides built-in keyboard support for common editing operations and allows you to add custom keyboard shortcuts. This guide covers everything from basic navigation to advanced keyboard interactions.

## Built-in Keyboard Support

Markput handles common keyboard operations automatically:

| Key | Action | Context |
|-----|--------|---------|
| **Arrow Left/Right** | Navigate between marks | When mark is focused |
| **Backspace** | Delete previous mark | At mark boundary |
| **Delete** | Delete next mark | At mark boundary |
| **Enter** | Insert line break | In editor |
| **Tab** | Focus next mark | When mark is focused |
| **Esc** | Close overlay | When overlay is open |
| **Arrow Up/Down** | Navigate suggestions | When overlay is open |

These behaviors work out of the box without any configuration.

## Basic Keyboard Events

### Listening to Key Presses

Use `slotProps.container` to listen to keyboard events on the editor:

```tsx
import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

function EditorWithKeyboard() {
  const [value, setValue] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    console.log('Key pressed:', e.key)
    console.log('Modifier keys:', {
      ctrl: e.ctrlKey,
      meta: e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey
    })
  }

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={MyMark}
      slotProps={{
        container: {
          onKeyDown: handleKeyDown,
          onKeyUp: (e) => console.log('Key released:', e.key),
          onKeyPress: (e) => console.log('Character:', e.key)
        }
      }}
    />
  )
}
```

### Key Event Properties

```tsx
interface KeyboardEvent {
  key: string        // 'Enter', 'a', 'Backspace', etc.
  code: string       // Physical key: 'KeyA', 'Enter', etc.
  ctrlKey: boolean   // Ctrl pressed (Cmd on Mac)
  metaKey: boolean   // Meta/Cmd key
  shiftKey: boolean  // Shift pressed
  altKey: boolean    // Alt/Option pressed
  repeat: boolean    // Key is being held down
}
```

## Custom Keyboard Shortcuts

### Save Shortcut (Ctrl/Cmd+S)

```tsx
function EditorWithSave() {
  const [value, setValue] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+S (Windows/Linux) or Cmd+S (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      console.log('Saving:', value)
      // Call your save function here
      saveToServer(value)
    }
  }

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={MyMark}
      slotProps={{
        container: { onKeyDown: handleKeyDown }
      }}
    />
  )
}
```

### Multiple Shortcuts

```tsx
function EditorWithShortcuts() {
  const [value, setValue] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modKey = isMac ? e.metaKey : e.ctrlKey

    if (modKey) {
      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault()
          console.log('Save')
          break

        case 'b':
          e.preventDefault()
          console.log('Bold')
          insertMarkup('**', '**')
          break

        case 'i':
          e.preventDefault()
          console.log('Italic')
          insertMarkup('*', '*')
          break

        case 'k':
          e.preventDefault()
          console.log('Insert link')
          showLinkDialog()
          break

        case 'z':
          e.preventDefault()
          if (e.shiftKey) {
            console.log('Redo')
          } else {
            console.log('Undo')
          }
          break
      }
    }
  }

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={MyMark}
      slotProps={{
        container: { onKeyDown: handleKeyDown }
      }}
    />
  )
}
```

### Shortcut Helper

Create a reusable shortcut matcher:

```tsx
type Shortcut = {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
}

function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  return (e: React.KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = shortcut.ctrl ? e.ctrlKey : true
      const metaMatch = shortcut.meta ? e.metaKey : true
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
      const altMatch = shortcut.alt ? e.altKey : !e.altKey

      if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
        e.preventDefault()
        shortcut.action()
        break
      }
    }
  }
}

// Usage
function Editor() {
  const [value, setValue] = useState('')

  const handleKeyDown = useKeyboardShortcuts([
    { key: 's', ctrl: true, action: () => console.log('Save') },
    { key: 'b', ctrl: true, action: () => console.log('Bold') },
    { key: 'i', ctrl: true, action: () => console.log('Italic') },
    { key: 'z', ctrl: true, shift: true, action: () => console.log('Redo') },
    { key: 'z', ctrl: true, action: () => console.log('Undo') }
  ])

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={MyMark}
      slotProps={{
        container: { onKeyDown: handleKeyDown }
      }}
    />
  )
}
```

## Mark-Specific Keyboard Events

### Handling Keys Within Marks

Use `useMark()` to handle keyboard events specific to marks:

```tsx
import { useMark } from 'rc-marked-input'

function KeyboardAwareMark() {
  const { label, remove, ref } = useMark()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Backspace':
      case 'Delete':
        e.preventDefault()
        remove()
        break

      case 'Enter':
        e.preventDefault()
        console.log('Edit mark:', label)
        break

      case 'Escape':
        e.preventDefault()
        // Blur the mark
        e.currentTarget.blur()
        break
    }
  }

  return (
    <span
      ref={ref}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="mark"
    >
      {label}
    </span>
  )
}
```

### Editable Mark with Enter Key

```tsx
function EditableMark() {
  const { label, change, ref } = useMark()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(label)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault()
        change({ value: editValue })
        setIsEditing(false)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setEditValue(label)
        setIsEditing(false)
      }
    } else {
      if (e.key === 'Enter') {
        e.preventDefault()
        setIsEditing(true)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        remove()
      }
    }
  }

  if (isEditing) {
    return (
      <input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setIsEditing(false)}
        autoFocus
      />
    )
  }

  return (
    <span
      ref={ref}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="mark"
    >
      {label}
    </span>
  )
}
```

## Navigation Between Marks

### Arrow Key Navigation

Built-in arrow key navigation works when marks have `ref` and `tabIndex`:

```tsx
function NavigableMark() {
  const { label, ref } = useMark()

  return (
    <span
      ref={ref}
      tabIndex={0}
      className="mark"
      style={{
        outline: 'none',
        border: '1px solid transparent'
      }}
      onFocus={(e) => {
        e.currentTarget.style.border = '1px solid blue'
      }}
      onBlur={(e) => {
        e.currentTarget.style.border = '1px solid transparent'
      }}
    >
      {label}
    </span>
  )
}
```

**Keyboard behavior:**
- **Arrow Right** - Focus next mark
- **Arrow Left** - Focus previous mark
- **Tab** - Focus next mark
- **Shift+Tab** - Focus previous mark

### Custom Navigation Logic

Override default navigation:

```tsx
function CustomNavigationMark() {
  const { label, ref } = useMark()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      // Custom logic: jump to end of editor
      const editor = e.currentTarget.closest('[contenteditable]')
      if (editor) {
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(editor)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
  }

  return (
    <span
      ref={ref}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="mark"
    >
      {label}
    </span>
  )
}
```

## Overlay Keyboard Interactions

The overlay handles keyboard events automatically:

| Key | Action |
|-----|--------|
| **Arrow Up** | Select previous item |
| **Arrow Down** | Select next item |
| **Enter** | Insert selected item |
| **Esc** | Close overlay |
| **Tab** | Insert selected item (if configured) |

### Custom Overlay Keyboard Behavior

```tsx
import { useOverlay } from 'rc-marked-input'

function CustomOverlay() {
  const { select, close, match } = useOverlay()
  const [selectedIndex, setSelectedIndex] = useState(0)

  const items = ['Alice', 'Bob', 'Charlie']

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1))
        break

      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break

      case 'Enter':
      case 'Tab':
        e.preventDefault()
        select({ value: items[selectedIndex] })
        break

      case 'Escape':
        e.preventDefault()
        close()
        break

      // Custom: Ctrl+Number for quick selection
      case '1':
      case '2':
      case '3':
        if (e.ctrlKey) {
          e.preventDefault()
          const index = parseInt(e.key) - 1
          if (items[index]) {
            select({ value: items[index] })
          }
        }
        break
    }
  }

  return (
    <div
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      {items.map((item, index) => (
        <div
          key={item}
          className={index === selectedIndex ? 'selected' : ''}
          onClick={() => select({ value: item })}
        >
          {item}
          {e.ctrlKey && index < 3 && <span> (Ctrl+{index + 1})</span>}
        </div>
      ))}
    </div>
  )
}
```

## Preventing Default Behavior

### When to Prevent Default

```tsx
function Editor() {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent browser shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 's': // Save
        case 'b': // Bold
        case 'i': // Italic
        case 'u': // Underline
        case 'k': // Link
          e.preventDefault()
          // Your custom logic
          break
      }
    }

    // Prevent Enter if you want single-line input
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Handle submission
    }

    // Prevent Tab if you want custom behavior
    if (e.key === 'Tab') {
      e.preventDefault()
      // Custom tab handling
    }
  }

  return (
    <MarkedInput
      Mark={MyMark}
      slotProps={{
        container: { onKeyDown: handleKeyDown }
      }}
    />
  )
}
```

### Allowing Specific Defaults

```tsx
function SelectivePreventDefault() {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only prevent on specific conditions
    if (e.key === 'Enter') {
      // Allow Shift+Enter for new lines
      if (e.shiftKey) {
        return // Let default behavior happen
      }

      // Prevent plain Enter
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <MarkedInput
      Mark={MyMark}
      slotProps={{
        container: { onKeyDown: handleKeyDown }
      }}
    />
  )
}
```

## Focus Management

### Programmatic Focus

Focus the editor programmatically:

```tsx
function EditorWithFocus() {
  const editorRef = useRef<HTMLDivElement>(null)

  const focusEditor = () => {
    editorRef.current?.focus()
  }

  return (
    <div>
      <button onClick={focusEditor}>Focus Editor</button>
      <MarkedInput
        Mark={MyMark}
        slotProps={{
          container: {
            ref: editorRef,
            tabIndex: 0
          }
        }}
      />
    </div>
  )
}
```

### Auto-Focus on Mount

```tsx
function AutoFocusEditor() {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    editorRef.current?.focus()
  }, [])

  return (
    <MarkedInput
      Mark={MyMark}
      slotProps={{
        container: {
          ref: editorRef,
          autoFocus: true
        }
      }}
    />
  )
}
```

### Focus Trap

Keep focus within editor:

```tsx
function FocusTrapEditor() {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      // Keep focus in editor, don't tab out
    }
  }

  return (
    <MarkedInput
      Mark={MyMark}
      slotProps={{
        container: { onKeyDown: handleKeyDown }
      }}
    />
  )
}
```

## Complete Examples

### Example 1: Vim-Style Navigation

```tsx
function VimStyleEditor() {
  const [value, setValue] = useState('')
  const [mode, setMode] = useState<'normal' | 'insert'>('insert')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mode === 'normal') {
      switch (e.key) {
        case 'i':
          e.preventDefault()
          setMode('insert')
          break

        case 'h': // Left
          e.preventDefault()
          moveCursor(-1)
          break

        case 'l': // Right
          e.preventDefault()
          moveCursor(1)
          break

        case 'x': // Delete
          e.preventDefault()
          deleteAtCursor()
          break

        case 'u': // Undo
          e.preventDefault()
          undo()
          break
      }
    } else if (mode === 'insert') {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMode('normal')
      }
    }
  }

  return (
    <div>
      <div>Mode: {mode.toUpperCase()}</div>
      <MarkedInput
        value={value}
        onChange={setValue}
        Mark={MyMark}
        slotProps={{
          container: {
            onKeyDown: handleKeyDown,
            style: {
              backgroundColor: mode === 'normal' ? '#ffe0e0' : '#fff'
            }
          }
        }}
      />
    </div>
  )
}
```

### Example 2: Keyboard Shortcuts Legend

```tsx
function EditorWithLegend() {
  const [value, setValue] = useState('')
  const [showLegend, setShowLegend] = useState(false)

  const shortcuts = [
    { keys: 'Ctrl/Cmd + S', action: 'Save' },
    { keys: 'Ctrl/Cmd + B', action: 'Bold' },
    { keys: 'Ctrl/Cmd + I', action: 'Italic' },
    { keys: 'Ctrl/Cmd + K', action: 'Insert Link' },
    { keys: 'Ctrl/Cmd + Z', action: 'Undo' },
    { keys: 'Ctrl/Cmd + Shift + Z', action: 'Redo' },
    { keys: 'Esc', action: 'Close Overlay' }
  ]

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey

    if (e.key === '?' && e.shiftKey) {
      e.preventDefault()
      setShowLegend(!showLegend)
      return
    }

    if (mod) {
      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault()
          save()
          break
        // ... other shortcuts
      }
    }
  }

  return (
    <div>
      <MarkedInput
        value={value}
        onChange={setValue}
        Mark={MyMark}
        slotProps={{
          container: { onKeyDown: handleKeyDown }
        }}
      />

      {showLegend && (
        <div className="keyboard-legend">
          <h3>Keyboard Shortcuts</h3>
          {shortcuts.map((shortcut) => (
            <div key={shortcut.keys}>
              <kbd>{shortcut.keys}</kbd> - {shortcut.action}
            </div>
          ))}
          <p>Press ? to toggle this legend</p>
        </div>
      )}
    </div>
  )
}
```

### Example 3: Single-Line Input with Enter to Submit

```tsx
function SingleLineInput() {
  const [value, setValue] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(value)
      setValue('') // Clear after submit
    }
  }

  const handleSubmit = (text: string) => {
    console.log('Submitted:', text)
    // Your submit logic here
  }

  return (
    <div>
      <MarkedInput
        value={value}
        onChange={setValue}
        Mark={MyMark}
        slotProps={{
          container: {
            onKeyDown: handleKeyDown,
            style: {
              minHeight: 'auto',
              maxHeight: '40px'
            }
          }
        }}
      />
      <small>Press Enter to submit</small>
    </div>
  )
}
```

## Best Practices

### ✅ Do

```tsx
// Use useCallback for stable event handlers
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  // Handler logic
}, [dependencies])

// Check for both Ctrl and Meta for cross-platform support
if (e.ctrlKey || e.metaKey) {
  // Shortcut logic
}

// Prevent default when handling shortcuts
if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
  e.preventDefault()
  save()
}

// Use lowercase for key comparison
if (e.key.toLowerCase() === 'a') {
  // Handle 'A' or 'a'
}

// Add visual feedback for focused marks
<span
  ref={ref}
  tabIndex={0}
  style={{
    outline: 'none'
  }}
  onFocus={(e) => e.currentTarget.classList.add('focused')}
>
  {label}
</span>
```

### ❌ Don't

```tsx
// Don't forget preventDefault for custom shortcuts
if (e.key === 's' && e.ctrlKey) {
  save() // Browser will still open save dialog!
}

// Don't hardcode Cmd/Ctrl
if (e.metaKey) { // Only works on Mac!
  // Wrong
}

// Don't compare key codes (deprecated)
if (e.keyCode === 13) { // Use e.key === 'Enter' instead
  // Wrong
}

// Don't block all keyboard events
e.preventDefault() // Prevents typing!
e.stopPropagation() // Breaks event bubbling

// Don't forget accessibility
<span onClick={selectMark}> // Missing keyboard support!
  {label}
</span>
```

## Accessibility Considerations

### Keyboard-Only Navigation

Ensure all functionality is accessible via keyboard:

```tsx
function AccessibleMark() {
  const { label, remove, ref } = useMark()

  return (
    <span
      ref={ref}
      tabIndex={0}
      role="button"
      aria-label={`Mark: ${label}. Press Delete to remove`}
      onKeyDown={(e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          remove()
        }
      }}
      onClick={(e) => {
        e.preventDefault()
        // Visual selection
      }}
    >
      {label}
    </span>
  )
}
```

### Announce Keyboard Shortcuts

```tsx
function AccessibleEditor() {
  return (
    <div>
      <div
        role="region"
        aria-label="Text editor with mention support"
        aria-describedby="keyboard-help"
      >
        <MarkedInput Mark={MyMark} />
      </div>

      <div id="keyboard-help" className="sr-only">
        Type @ to mention someone. Use arrow keys to navigate.
        Press Enter to select. Press Escape to cancel.
      </div>
    </div>
  )
}
```

## TypeScript Types

```tsx
import type { KeyboardEvent, KeyboardEventHandler } from 'react'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description?: string
}

type KeyHandler = (e: KeyboardEvent<HTMLElement>) => void

const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (e) => {
  // Type-safe event handler
}
```

## Troubleshooting

### Shortcuts Not Working

**Problem:** Keyboard shortcuts being ignored

**Solutions:**
1. Check `preventDefault()` is called
2. Verify event handler is attached to correct element
3. Check for conflicting browser shortcuts
4. Ensure focus is in the editor

```tsx
// Debug shortcuts
const handleKeyDown = (e: React.KeyboardEvent) => {
  console.log('Key:', e.key, 'Ctrl:', e.ctrlKey, 'Meta:', e.metaKey)
  // Your logic
}
```

### Focus Issues

**Problem:** Editor loses focus unexpectedly

**Solutions:**
```tsx
// Keep focus after operations
const handleAction = () => {
  doSomething()
  editorRef.current?.focus() // Restore focus
}

// Prevent blur on certain interactions
<button onMouseDown={(e) => e.preventDefault()}>
  Action
</button>
```

### Enter Key Not Working

**Problem:** Enter creates marks instead of new lines

**Solution:** Check for mark boundaries in overlay logic

```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  // Allow Enter when not in overlay context
  if (e.key === 'Enter' && !overlayOpen) {
    // Default behavior (new line) will work
  }
}
```

## Next Steps

- **[Dynamic Marks](./dynamic-marks)** - Make marks interactive with useMark()
- **[Overlay Customization](./overlay-customization)** - Custom suggestion menus
- **[Slots Customization](./slots-customization)** - Customize container behavior
- **[API Reference](../api/components)** - Complete keyboard event API

---

**Try it:** [CodeSandbox - Keyboard Shortcuts](https://codesandbox.io/s/keyboard-shortcuts-example)
