---
title: Accessibility
description: Build accessible editors with Markput following WCAG guidelines
---

This guide covers accessibility (a11y) best practices for Markput applications following WCAG 2.1 Level AA guidelines.

## Accessibility Overview

### Why Accessibility Matters

- **Legal requirement**: Many jurisdictions require accessible web applications
- **User inclusion**: ~15% of the world population has some form of disability
- **Better UX**: Accessible design benefits all users
- **SEO benefits**: Screen-reader-friendly content improves SEO

### WCAG Principles (POUR)

1. **Perceivable**: Content must be presentable to users
2. **Operable**: UI components must be operable
3. **Understandable**: Information must be understandable
4. **Robust**: Content must work with assistive technologies

## ARIA Attributes

### Basic ARIA Setup

```typescript
<MarkedInput
  Mark={MyMark}
  slotProps={{
    container: {
      role: 'textbox',
      'aria-label': 'Message editor',
      'aria-multiline': true,
      'aria-required': false,
      'aria-invalid': false
    }
  }}
/>
```

### Essential ARIA Roles

| Role | When to Use | Example |
|------|------------|---------|
| `textbox` | For input areas | Editor container |
| `button` | For interactive marks | `<Mark role="button">` |
| `link` | For navigable marks | `<Mark role="link">` |
| `listbox` | For overlay | Suggestions dropdown |
| `option` | For overlay items | Each suggestion |

### ARIA States

```typescript
// Indicate loading state
<div aria-busy={isLoading}>

// Indicate error state
<div aria-invalid={hasError} aria-describedby="error-message">

// Indicate selected state
<div aria-selected={isSelected}>

// Indicate expanded state
<div aria-expanded={isOpen}>
```

### Complete ARIA Example

```typescript
function AccessibleEditor() {
  const [value, setValue] = useState('')
  const [hasError, setHasError] = useState(false)
  const errorId = useId()

  return (
    <>
      <label htmlFor="editor-1">
        Message
        <span aria-label="required">*</span>
      </label>

      <MarkedInput
        value={value}
        onChange={setValue}
        Mark={MyMark}
        slotProps={{
          container: {
            id: 'editor-1',
            role: 'textbox',
            'aria-label': 'Message editor',
            'aria-multiline': true,
            'aria-required': true,
            'aria-invalid': hasError,
            'aria-describedby': hasError ? errorId : undefined
          }
        }}
      />

      {hasError && (
        <div id={errorId} role="alert" aria-live="polite">
          Message is required
        </div>
      )}
    </>
  )
}
```

## Keyboard Navigation

### Built-in Keyboard Support

Markput provides built-in keyboard navigation:

| Key | Action |
|-----|--------|
| `Tab` | Focus next mark |
| `Shift+Tab` | Focus previous mark |
| `Enter` | Edit focused mark |
| `Escape` | Close overlay |
| `ArrowUp` | Navigate overlay up |
| `ArrowDown` | Navigate overlay down |
| `Backspace` | Delete mark (when focused) |

### Custom Keyboard Shortcuts

```typescript
function EditorWithShortcuts() {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault()
      insertMark('**__nested__**')
    }

    // Ctrl/Cmd + K for link
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      openLinkDialog()
    }
  }

  return (
    <MarkedInput
      Mark={MyMark}
      slotProps={{
        container: {
          onKeyDown: handleKeyDown
        }
      }}
    />
  )
}
```

### Accessible Mark Components

```typescript
const AccessibleMark: FC<MarkProps> = ({ value }) => {
  const { remove } = useMark()

  return (
    <button
      className="mark"
      role="button"
      aria-label={`Mention ${value}, press Delete to remove`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          remove()
        }
      }}
    >
      @{value}
    </button>
  )
}
```

### Keyboard-Accessible Overlay

```typescript
const AccessibleOverlay: FC = () => {
  const { style, match, select, close, ref } = useOverlay()
  const [selectedIndex, setSelectedIndex] = useState(0)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, items.length - 1))
        break

      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break

      case 'Enter':
      case 'Tab':
        e.preventDefault()
        select(items[selectedIndex])
        break

      case 'Escape':
        e.preventDefault()
        close()
        break

      case 'Home':
        e.preventDefault()
        setSelectedIndex(0)
        break

      case 'End':
        e.preventDefault()
        setSelectedIndex(items.length - 1)
        break
    }
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label="Suggestions"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{ position: 'absolute', ...style }}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          role="option"
          aria-selected={index === selectedIndex}
          onClick={() => select(item)}
        >
          {item.label}
        </div>
      ))}
    </div>
  )
}
```

## Screen Reader Support

### Semantic HTML

Use proper HTML elements for better screen reader support:

```typescript
// ✅ Good: Semantic HTML
const MentionMark: FC<MarkProps> = ({ value, meta }) => (
  <a href={`/users/${meta}`} className="mention">
    @{value}
  </a>
)

// ❌ Bad: Generic div
const MentionMark: FC<MarkProps> = ({ value, meta }) => (
  <div onClick={() => navigate(`/users/${meta}`)}>
    @{value}
  </div>
)
```

### ARIA Labels

Provide descriptive labels for screen readers:

```typescript
const MentionMark: FC<MarkProps> = ({ value }) => {
  const { remove } = useMark()

  return (
    <span
      role="link"
      aria-label={`Mention ${value}`}
      className="mention"
    >
      @{value}
      <button
        aria-label={`Remove mention of ${value}`}
        onClick={remove}
      >
        ×
      </button>
    </span>
  )
}
```

### Live Regions

Announce dynamic changes to screen readers:

```typescript
function EditorWithAnnouncements() {
  const [announcement, setAnnouncement] = useState('')

  const handleChange = (value: string) => {
    const marks = extractMarks(value)
    setAnnouncement(`${marks.length} mentions`)
  }

  return (
    <>
      <MarkedInput onChange={handleChange} Mark={MyMark} />

      {/* Screen reader announcement */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </>
  )
}
```

### Screen-Reader-Only Text

```css
/* Screen reader only (visually hidden) */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

```typescript
<span className="sr-only">
  Press @ to mention someone
</span>
```

## Focus Management

### Focus Visible

Style focus indicators clearly:

```css
/* Show focus ring for keyboard users */
.mark:focus-visible {
  outline: 2px solid #2196f3;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Remove focus ring for mouse users */
.mark:focus:not(:focus-visible) {
  outline: none;
}
```

### Focus Trap

Trap focus in overlay:

```typescript
import { useFocusTrap } from '@/hooks/useFocusTrap'

const OverlayWithFocusTrap: FC = () => {
  const overlayRef = useRef<HTMLDivElement>(null)
  useFocusTrap(overlayRef)

  return (
    <div ref={overlayRef}>
      {/* Focus stays within this element */}
    </div>
  )
}

// useFocusTrap implementation
function useFocusTrap(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const element = ref.current
    if (!element) return

    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement?.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement?.focus()
      }
    }

    element.addEventListener('keydown', handleKeyDown)
    firstElement?.focus()

    return () => element.removeEventListener('keydown', handleKeyDown)
  }, [ref])
}
```

### Skip Links

Allow users to skip to editor:

```typescript
function App() {
  return (
    <>
      <a href="#editor" className="skip-link">
        Skip to editor
      </a>

      <nav>{/* ... */}</nav>

      <main>
        <MarkedInput
          Mark={MyMark}
          slotProps={{
            container: { id: 'editor' }
          }}
        />
      </main>
    </>
  )
}
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #2196f3;
  color: white;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

## Color Contrast

### WCAG AA Requirements

- **Normal text**: Minimum contrast ratio of 4.5:1
- **Large text**: Minimum contrast ratio of 3:1
- **UI components**: Minimum contrast ratio of 3:1

### Checking Contrast

```typescript
// Use contrast checker tools:
// - Chrome DevTools → Elements → Accessibility
// - https://webaim.org/resources/contrastchecker/
```

### Accessible Color Examples

```css
/* ✅ Good contrast (WCAG AA) */
.mark {
  background-color: #2196f3; /* Blue */
  color: #ffffff;             /* White */
  /* Contrast ratio: 4.6:1 */
}

/* ❌ Poor contrast */
.mark-bad {
  background-color: #90caf9; /* Light blue */
  color: #ffffff;             /* White */
  /* Contrast ratio: 1.9:1 - fails WCAG */
}

/* ✅ Fixed */
.mark-good {
  background-color: #90caf9;
  color: #000000;             /* Black */
  /* Contrast ratio: 11.1:1 */
}
```

### Dark Mode Support

```typescript
function ThemedMark({ value }: MarkProps) {
  const theme = useTheme()

  return (
    <span
      className="mark"
      style={{
        backgroundColor: theme === 'dark' ? '#1565c0' : '#2196f3',
        color: '#ffffff'
      }}
    >
      {value}
    </span>
  )
}
```

### High Contrast Mode

```css
/* Support Windows High Contrast Mode */
@media (prefers-contrast: high) {
  .mark {
    border: 2px solid currentColor;
  }
}
```

## Form Accessibility

### Labels and Descriptions

```typescript
function AccessibleForm() {
  const editorId = useId()
  const helpId = useId()
  const errorId = useId()

  return (
    <div>
      <label htmlFor={editorId}>
        Message
        <span aria-label="required">*</span>
      </label>

      <p id={helpId} className="help-text">
        Type @ to mention someone
      </p>

      <MarkedInput
        Mark={MyMark}
        slotProps={{
          container: {
            id: editorId,
            'aria-describedby': `${helpId} ${errorId}`,
            'aria-required': true
          }
        }}
      />

      {error && (
        <div id={errorId} role="alert" className="error">
          {error}
        </div>
      )}
    </div>
  )
}
```

### Error Handling

```typescript
function EditorWithValidation() {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const handleChange = (newValue: string) => {
    setValue(newValue)

    // Validate
    if (newValue.length === 0) {
      setError('Message is required')
    } else if (newValue.length > 500) {
      setError('Message is too long (max 500 characters)')
    } else {
      setError('')
    }
  }

  return (
    <>
      <MarkedInput
        value={value}
        onChange={handleChange}
        Mark={MyMark}
        slotProps={{
          container: {
            'aria-invalid': !!error,
            'aria-describedby': error ? 'error-msg' : undefined
          }
        }}
      />

      {error && (
        <div
          id="error-msg"
          role="alert"
          aria-live="assertive"
          className="error"
        >
          {error}
        </div>
      )}
    </>
  )
}
```

### Required Fields

```typescript
<MarkedInput
  Mark={MyMark}
  slotProps={{
    container: {
      'aria-required': true,
      'aria-label': 'Message (required)'
    }
  }}
/>
```

## Testing Accessibility

### Automated Testing

```typescript
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

test('MarkedInput has no a11y violations', async () => {
  const { container } = render(
    <MarkedInput Mark={MyMark} value="Hello" onChange={() => {}} />
  )

  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### Keyboard Testing

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

test('keyboard navigation works', async () => {
  const user = userEvent.setup()

  render(<MarkedInput Mark={MyMark} value="@[Alice]" onChange={() => {}} />)

  const editor = screen.getByRole('textbox')

  // Tab to editor
  await user.tab()
  expect(editor).toHaveFocus()

  // Tab to mark
  await user.tab()
  const mark = screen.getByRole('button', { name: /Alice/i })
  expect(mark).toHaveFocus()

  // Delete mark with keyboard
  await user.keyboard('{Backspace}')
  expect(mark).not.toBeInTheDocument()
})
```

### Screen Reader Testing

**Manual testing tools:**
- **macOS**: VoiceOver (Cmd + F5)
- **Windows**: NVDA (free) or JAWS
- **Linux**: Orca
- **Mobile**: TalkBack (Android), VoiceOver (iOS)

**Testing checklist:**
- [ ] All marks are announced correctly
- [ ] Overlay opening is announced
- [ ] Selection changes are announced
- [ ] Error messages are announced
- [ ] Required fields are announced

## Tools and Resources

### Browser Tools

- **Chrome DevTools**: Accessibility pane
- **Firefox DevTools**: Accessibility inspector
- **axe DevTools**: Browser extension for a11y testing

### Testing Libraries

```typescript
// Install testing libraries
npm install --save-dev @axe-core/react jest-axe
npm install --save-dev @testing-library/react @testing-library/user-event
```

### Useful Links

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

## Accessibility Checklist

### ✅ Must Have (Level A)

- [ ] All functionality available via keyboard
- [ ] Sufficient color contrast (4.5:1 minimum)
- [ ] Meaningful alt text for images
- [ ] Proper heading hierarchy
- [ ] Form labels associated with inputs
- [ ] No keyboard traps

### ✅ Should Have (Level AA)

- [ ] Focus visible on all interactive elements
- [ ] ARIA labels for complex components
- [ ] Error messages linked to inputs
- [ ] Consistent navigation
- [ ] Skip links for long pages
- [ ] Status messages use live regions

### ✅ Nice to Have (Level AAA)

- [ ] Enhanced color contrast (7:1)
- [ ] Detailed error suggestions
- [ ] Context-sensitive help
- [ ] Alternative input methods
- [ ] Extended time limits
- [ ] Readable text (no justified text)

## Common A11y Mistakes

### ❌ Missing Labels

```typescript
// Bad
<MarkedInput Mark={MyMark} />

// Good
<MarkedInput
  Mark={MyMark}
  slotProps={{
    container: {
      'aria-label': 'Message editor'
    }
  }}
/>
```

### ❌ Poor Color Contrast

```css
/* Bad: Insufficient contrast */
.mark {
  background: #90caf9;
  color: #fff; /* Only 1.9:1 contrast */
}

/* Good: Sufficient contrast */
.mark {
  background: #1976d2;
  color: #fff; /* 4.5:1 contrast */
}
```

### ❌ No Keyboard Access

```typescript
// Bad: Only mouse accessible
<div onClick={handleClick}>Click me</div>

// Good: Keyboard accessible
<button onClick={handleClick}>Click me</button>
```

### ❌ Missing ARIA States

```typescript
// Bad: No indication of state
<div onClick={toggle}>{isOpen ? 'Close' : 'Open'}</div>

// Good: Proper ARIA state
<button
  onClick={toggle}
  aria-expanded={isOpen}
>
  {isOpen ? 'Close' : 'Open'}
</button>
```

## Next Steps

- **[Architecture Guide](./architecture)** - System design
- **[Performance Guide](./performance)** - Optimization
- **[Testing Guide](../guides/testing)** - A11y testing

---

**See also:**
- [Keyboard Handling Guide](../guides/keyboard-handling) - Keyboard shortcuts
- [Examples](../examples/mention-system) - Accessible implementations
