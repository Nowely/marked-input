---
title: Testing
description: Comprehensive guide to testing Markput components
---

This guide covers testing strategies for Markput-based editors, from unit testing individual Mark components to integration testing complete editor workflows.

## Testing Setup

### Install Testing Dependencies

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom
```

Or with other test runners:

```bash
# Jest
npm install --save-dev jest @testing-library/react @testing-library/jest-dom

# Vitest (recommended)
npm install --save-dev vitest @vitest/ui jsdom
```

### Configure Vitest

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true
  }
})
```

### Test Setup File

```ts
// test/setup.ts
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

afterEach(() => {
  cleanup()
})
```

## Testing Mark Components

### Basic Mark Component Test

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

const SimpleMark = ({ value }: { value: string }) => (
  <span data-testid="mark">{value}</span>
)

describe('SimpleMark', () => {
  it('renders the value', () => {
    render(<SimpleMark value="test" />)
    expect(screen.getByTestId('mark')).toHaveTextContent('test')
  })

  it('renders with metadata', () => {
    const Mark = ({ value, meta }: { value: string; meta?: string }) => (
      <span data-testid="mark" data-meta={meta}>
        {value}
      </span>
    )

    render(<Mark value="test" meta="info" />)
    expect(screen.getByTestId('mark')).toHaveAttribute('data-meta', 'info')
  })
})
```

### Testing Interactive Marks

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

const InteractiveMark = ({
  value,
  onClick
}: {
  value: string
  onClick: () => void
}) => (
  <button onClick={onClick}>{value}</button>
)

describe('InteractiveMark', () => {
  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<InteractiveMark value="test" onClick={handleClick} />)

    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is keyboard accessible', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<InteractiveMark value="test" onClick={handleClick} />)

    const button = screen.getByRole('button')
    button.focus()
    await user.keyboard('{Enter}')

    expect(handleClick).toHaveBeenCalled()
  })
})
```

### Testing Marks with useMark Hook

```tsx
import { render, screen } from '@testing-library/react'
import { MarkedInput } from 'rc-marked-input'
import { describe, it, expect, vi } from 'vitest'

// Create a test wrapper that provides context
function renderWithEditor(markComponent: React.ComponentType, value: string) {
  const onChange = vi.fn()

  const result = render(
    <MarkedInput
      value={value}
      onChange={onChange}
      Mark={markComponent}
    />
  )

  return { ...result, onChange }
}

describe('DynamicMark with useMark', () => {
  it('renders mark value', () => {
    const DynamicMark = () => {
      const { label } = useMark()
      return <span data-testid="mark">{label}</span>
    }

    renderWithEditor(DynamicMark, 'Text @[test]!')

    expect(screen.getByTestId('mark')).toHaveTextContent('test')
  })

  it('removes mark when clicking remove button', async () => {
    const user = userEvent.setup()

    const RemovableMark = () => {
      const { label, remove } = useMark()
      return (
        <span>
          {label}
          <button onClick={remove}>Remove</button>
        </span>
      )
    }

    const { onChange } = renderWithEditor(RemovableMark, '@[test]')

    await user.click(screen.getByRole('button', { name: /remove/i }))

    // Check that onChange was called with mark removed
    expect(onChange).toHaveBeenCalled()
    const newValue = onChange.mock.calls[0][0]
    expect(newValue).not.toContain('@[test]')
  })
})
```

## Testing MarkedInput Component

### Basic Rendering

```tsx
import { render, screen } from '@testing-library/react'
import { MarkedInput } from 'rc-marked-input'
import { describe, it, expect, vi } from 'vitest'

describe('MarkedInput', () => {
  it('renders plain text', () => {
    const Mark = ({ value }: { value: string }) => <span>{value}</span>

    render(
      <MarkedInput
        value="Hello World"
        onChange={vi.fn()}
        Mark={Mark}
      />
    )

    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('renders marks', () => {
    const Mark = ({ value }: { value: string }) => (
      <span data-testid="mark">{value}</span>
    )

    render(
      <MarkedInput
        value="Hello @[World]!"
        onChange={vi.fn()}
        Mark={Mark}
      />
    )

    expect(screen.getByTestId('mark')).toHaveTextContent('World')
  })

  it('renders multiple marks', () => {
    const Mark = ({ value }: { value: string }) => (
      <span className="mark">{value}</span>
    )

    render(
      <MarkedInput
        value="@[Alice] and @[Bob]"
        onChange={vi.fn()}
        Mark={Mark}
      />
    )

    const marks = screen.getAllByText((content, element) =>
      element?.classList.contains('mark') ?? false
    )
    expect(marks).toHaveLength(2)
  })
})
```

### Testing User Input

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MarkedInput } from 'rc-marked-input'
import { describe, it, expect, vi } from 'vitest'

describe('MarkedInput typing', () => {
  it('calls onChange when typing', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()

    const Mark = ({ value }: { value: string }) => <span>{value}</span>

    render(
      <MarkedInput
        value=""
        onChange={handleChange}
        Mark={Mark}
      />
    )

    const editor = screen.getByRole('textbox')
    await user.click(editor)
    await user.keyboard('Hello')

    expect(handleChange).toHaveBeenCalled()
  })

  it('updates value prop', () => {
    const Mark = ({ value }: { value: string }) => <span>{value}</span>

    const { rerender } = render(
      <MarkedInput
        value="initial"
        onChange={vi.fn()}
        Mark={Mark}
      />
    )

    expect(screen.getByText('initial')).toBeInTheDocument()

    rerender(
      <MarkedInput
        value="updated"
        onChange={vi.fn()}
        Mark={Mark}
      />
    )

    expect(screen.getByText('updated')).toBeInTheDocument()
  })
})
```

## Testing Overlay Interactions

### Testing Overlay Appearance

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MarkedInput } from 'rc-marked-input'
import { describe, it, expect, vi } from 'vitest'

describe('Overlay', () => {
  it('shows overlay on trigger character', async () => {
    const user = userEvent.setup()
    const Mark = ({ value }: { value: string }) => <span>{value}</span>

    render(
      <MarkedInput
        value=""
        onChange={vi.fn()}
        Mark={Mark}
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
      />
    )

    const editor = screen.getByRole('textbox')
    await user.click(editor)
    await user.keyboard('@')

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })
  })

  it('filters suggestions based on input', async () => {
    const user = userEvent.setup()
    const Mark = ({ value }: { value: string }) => <span>{value}</span>

    render(
      <MarkedInput
        value=""
        onChange={vi.fn()}
        Mark={Mark}
        options={[
          {
            markup: '@[__value__]',
            slotProps: {
              overlay: {
                trigger: '@',
                data: ['Alice', 'Bob', 'Charlie']
              }
            }
          }
        ]}
      />
    )

    const editor = screen.getByRole('textbox')
    await user.click(editor)
    await user.keyboard('@Ali')

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.queryByText('Bob')).not.toBeInTheDocument()
    })
  })

  it('inserts selected suggestion', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()
    const Mark = ({ value }: { value: string }) => <span>{value}</span>

    render(
      <MarkedInput
        value=""
        onChange={handleChange}
        Mark={Mark}
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
      />
    )

    const editor = screen.getByRole('textbox')
    await user.click(editor)
    await user.keyboard('@')

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Alice'))

    expect(handleChange).toHaveBeenCalledWith(
      expect.stringContaining('@[Alice]')
    )
  })
})
```

### Testing Overlay Keyboard Navigation

```tsx
describe('Overlay keyboard navigation', () => {
  it('navigates suggestions with arrow keys', async () => {
    const user = userEvent.setup()
    const Mark = ({ value }: { value: string }) => <span>{value}</span>

    render(
      <MarkedInput
        value=""
        onChange={vi.fn()}
        Mark={Mark}
        options={[
          {
            markup: '@[__value__]',
            slotProps: {
              overlay: {
                trigger: '@',
                data: ['Alice', 'Bob', 'Charlie']
              }
            }
          }
        ]}
      />
    )

    const editor = screen.getByRole('textbox')
    await user.click(editor)
    await user.keyboard('@')

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    // Arrow down to select next
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowDown}')

    // Enter to select
    await user.keyboard('{Enter}')

    // Should have inserted second item (Bob)
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('closes overlay on Escape', async () => {
    const user = userEvent.setup()
    const Mark = ({ value }: { value: string }) => <span>{value}</span>

    render(
      <MarkedInput
        value=""
        onChange={vi.fn()}
        Mark={Mark}
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
      />
    )

    const editor = screen.getByRole('textbox')
    await user.click(editor)
    await user.keyboard('@')

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    })
  })
})
```

## Testing Keyboard Events

### Testing Keyboard Shortcuts

```tsx
describe('Keyboard shortcuts', () => {
  it('handles custom keyboard shortcuts', async () => {
    const handleSave = vi.fn()
    const user = userEvent.setup()
    const Mark = ({ value }: { value: string }) => <span>{value}</span>

    render(
      <MarkedInput
        value="Test content"
        onChange={vi.fn()}
        Mark={Mark}
        slotProps={{
          container: {
            onKeyDown: (e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                handleSave()
              }
            }
          }
        }}
      />
    )

    const editor = screen.getByRole('textbox')
    await user.click(editor)
    await user.keyboard('{Control>}s{/Control}')

    expect(handleSave).toHaveBeenCalled()
  })

  it('handles Enter key for submission', async () => {
    const handleSubmit = vi.fn()
    const user = userEvent.setup()
    const Mark = ({ value }: { value: string }) => <span>{value}</span>

    render(
      <MarkedInput
        value="Test"
        onChange={vi.fn()}
        Mark={Mark}
        slotProps={{
          container: {
            onKeyDown: (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }
          }
        }}
      />
    )

    const editor = screen.getByRole('textbox')
    await user.click(editor)
    await user.keyboard('{Enter}')

    expect(handleSubmit).toHaveBeenCalled()
  })
})
```

### Testing Mark Keyboard Events

```tsx
describe('Mark keyboard events', () => {
  it('removes mark on Backspace', async () => {
    const user = userEvent.setup()

    const RemovableMark = () => {
      const { label, remove, ref } = useMark()
      return (
        <span
          ref={ref}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault()
              remove()
            }
          }}
        >
          {label}
        </span>
      )
    }

    const { onChange } = renderWithEditor(RemovableMark, '@[test]')

    const mark = screen.getByText('test')
    mark.focus()
    await user.keyboard('{Backspace}')

    expect(onChange).toHaveBeenCalled()
  })
})
```

## Testing Nested Marks

### Rendering Nested Marks

```tsx
describe('Nested marks', () => {
  it('renders nested marks correctly', () => {
    const NestedMark = ({ children }: { children?: React.ReactNode }) => (
      <strong data-testid="bold">{children}</strong>
    )

    render(
      <MarkedInput
        value="**bold with *italic* inside**"
        onChange={vi.fn()}
        Mark={NestedMark}
        options={[
          { markup: '**__nested__**' },
          { markup: '*__nested__*' }
        ]}
      />
    )

    const boldMarks = screen.getAllByTestId('bold')
    expect(boldMarks.length).toBeGreaterThan(0)
  })

  it('handles deep nesting', () => {
    const Mark = ({ children, depth }: { children?: React.ReactNode; depth?: number }) => (
      <span data-testid="mark" data-depth={depth}>
        {children}
      </span>
    )

    render(
      <MarkedInput
        value="**level 1 *level 2 _level 3_*__"
        onChange={vi.fn()}
        Mark={Mark}
        options={[
          { markup: '**__nested__**' },
          { markup: '*__nested__*' },
          { markup: '___nested___' }
        ]}
      />
    )

    const marks = screen.getAllByTestId('mark')
    expect(marks.length).toBeGreaterThan(2)
  })
})
```

## Snapshot Testing

### Basic Snapshot Test

```tsx
import { render } from '@testing-library/react'
import { MarkedInput } from 'rc-marked-input'
import { describe, it, expect } from 'vitest'

describe('MarkedInput snapshots', () => {
  it('matches snapshot for simple marks', () => {
    const Mark = ({ value }: { value: string }) => (
      <span className="mark">{value}</span>
    )

    const { container } = render(
      <MarkedInput
        value="Hello @[World]!"
        onChange={() => {}}
        Mark={Mark}
      />
    )

    expect(container).toMatchSnapshot()
  })

  it('matches snapshot for complex editor', () => {
    const Mark = ({ value, meta }: { value: string; meta?: string }) => (
      <span className="mark" data-meta={meta}>
        {value}
      </span>
    )

    const { container } = render(
      <MarkedInput
        value="@[Alice](user:1) mentioned @[Bob](user:2) and #[react]"
        onChange={() => {}}
        Mark={Mark}
        options={[
          { markup: '@[__value__](__meta__)' },
          { markup: '#[__value__]' }
        ]}
      />
    )

    expect(container).toMatchSnapshot()
  })
})
```

## Integration Testing

### Complete Editor Workflow

```tsx
describe('Editor integration', () => {
  it('completes full mention workflow', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    const Mark = ({ value }: { value: string }) => (
      <span className="mention">@{value}</span>
    )

    render(
      <div>
        <MarkedInput
          value=""
          onChange={() => {}}
          Mark={Mark}
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
        />
        <button onClick={onSubmit}>Submit</button>
      </div>
    )

    // Type trigger
    const editor = screen.getByRole('textbox')
    await user.click(editor)
    await user.keyboard('Hello @')

    // Wait for overlay
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    // Select suggestion
    await user.click(screen.getByText('Alice'))

    // Verify mark is rendered
    expect(screen.getByText('Alice', { selector: '.mention' })).toBeInTheDocument()

    // Submit
    await user.click(screen.getByRole('button', { name: /submit/i }))
    expect(onSubmit).toHaveBeenCalled()
  })
})
```

## Mocking and Test Utilities

### Mock MarkedInput for Testing Parent Components

```tsx
// test/mocks/MarkedInput.tsx
import { vi } from 'vitest'

export const MockMarkedInput = vi.fn(({ value, onChange, Mark }) => {
  return (
    <div data-testid="marked-input-mock">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid="editor"
      />
      {Mark && <Mark value="mocked" />}
    </div>
  )
})
```

Usage:

```tsx
vi.mock('rc-marked-input', () => ({
  MarkedInput: MockMarkedInput
}))

describe('Parent component', () => {
  it('uses MarkedInput', () => {
    render(<ParentComponent />)
    expect(screen.getByTestId('marked-input-mock')).toBeInTheDocument()
  })
})
```

### Test Utilities

```tsx
// test/utils.tsx
import { render } from '@testing-library/react'
import { MarkedInput } from 'rc-marked-input'
import type { ReactElement } from 'react'

export function renderEditor(
  Mark: React.ComponentType<any>,
  value: string,
  options?: any[]
) {
  const onChange = vi.fn()

  const result = render(
    <MarkedInput
      value={value}
      onChange={onChange}
      Mark={Mark}
      options={options}
    />
  )

  return {
    ...result,
    onChange,
    getEditor: () => result.container.querySelector('[contenteditable]')
  }
}

// Usage
const { onChange, getEditor } = renderEditor(MyMark, '@[test]')
```

## Accessibility Testing

### Testing ARIA Attributes

```tsx
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { MarkedInput } from 'rc-marked-input'

expect.extend(toHaveNoViolations)

describe('Accessibility', () => {
  it('has no accessibility violations', async () => {
    const Mark = ({ value }: { value: string }) => <span>{value}</span>

    const { container } = render(
      <MarkedInput
        value="Hello @[World]"
        onChange={vi.fn()}
        Mark={Mark}
        slotProps={{
          container: {
            'aria-label': 'Text editor',
            role: 'textbox'
          }
        }}
      />
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has proper ARIA labels', () => {
    const Mark = ({ value }: { value: string }) => <span>{value}</span>

    render(
      <MarkedInput
        value=""
        onChange={vi.fn()}
        Mark={Mark}
        slotProps={{
          container: {
            'aria-label': 'Message input',
            'aria-describedby': 'help-text'
          }
        }}
      />
    )

    const editor = screen.getByRole('textbox', { name: /message input/i })
    expect(editor).toHaveAttribute('aria-describedby', 'help-text')
  })
})
```

## Performance Testing

### Testing Re-renders

```tsx
import { renderHook } from '@testing-library/react'
import { useState } from 'react'
import { vi } from 'vitest'

describe('Performance', () => {
  it('does not re-render unnecessarily', () => {
    const Mark = vi.fn(({ value }: { value: string }) => <span>{value}</span>)

    const { rerender } = render(
      <MarkedInput
        value="@[test]"
        onChange={vi.fn()}
        Mark={Mark}
      />
    )

    const initialCallCount = Mark.mock.calls.length

    // Re-render with same value
    rerender(
      <MarkedInput
        value="@[test]"
        onChange={vi.fn()}
        Mark={Mark}
      />
    )

    // Mark should not be called again
    expect(Mark.mock.calls.length).toBe(initialCallCount)
  })
})
```

## Best Practices

### ✅ Do

```tsx
// Use data-testid for reliable selection
<span data-testid="mark">{value}</span>

// Test user interactions, not implementation
await user.click(screen.getByRole('button'))

// Use waitFor for async operations
await waitFor(() => {
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

// Mock only external dependencies
vi.mock('axios')

// Test accessibility
expect(results).toHaveNoViolations()

// Clean up after tests
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
```

### ❌ Don't

```tsx
// Don't test implementation details
expect(component.state).toBe(...)

// Don't use brittle selectors
container.querySelector('.mark-123')

// Don't forget to await async operations
user.click(button) // Missing await!

// Don't test library internals
expect(MarkedInput.prototype.render).toHaveBeenCalled()

// Don't share state between tests
let sharedValue = '' // Bad!

// Don't mock everything
vi.mock('react') // Too much!
```

## Complete Test Suite Example

```tsx
// MyEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MyEditor } from './MyEditor'

describe('MyEditor', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  describe('Rendering', () => {
    it('renders empty editor', () => {
      render(<MyEditor />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('renders with initial value', () => {
      render(<MyEditor initialValue="Hello @[World]" />)
      expect(screen.getByText('World')).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('allows typing', async () => {
      render(<MyEditor />)
      const editor = screen.getByRole('textbox')

      await user.click(editor)
      await user.keyboard('Hello')

      expect(editor).toHaveTextContent('Hello')
    })

    it('shows suggestions on @', async () => {
      render(<MyEditor />)
      const editor = screen.getByRole('textbox')

      await user.click(editor)
      await user.keyboard('@')

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument()
      })
    })

    it('inserts mention on selection', async () => {
      render(<MyEditor />)
      const editor = screen.getByRole('textbox')

      await user.click(editor)
      await user.keyboard('@')

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Alice'))

      expect(screen.getByText('Alice', { selector: '.mention' })).toBeInTheDocument()
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('saves on Ctrl+S', async () => {
      const onSave = vi.fn()
      render(<MyEditor onSave={onSave} />)

      const editor = screen.getByRole('textbox')
      await user.click(editor)
      await user.keyboard('{Control>}s{/Control}')

      expect(onSave).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('is keyboard navigable', async () => {
      render(<MyEditor />)
      const editor = screen.getByRole('textbox')

      await user.tab()
      expect(editor).toHaveFocus()
    })

    it('has proper ARIA labels', () => {
      render(<MyEditor />)
      const editor = screen.getByRole('textbox')

      expect(editor).toHaveAttribute('aria-label')
    })
  })
})
```

## Next Steps

- **[TypeScript Usage](./typescript-usage)** - Type-safe testing
- **[Keyboard Handling](./keyboard-handling)** - Testing keyboard events
- **[API Reference](../api/components)** - Component API for testing
- **[Examples](../examples/mention-system)** - Real-world test examples

---

**Resources:**
- [Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro)
- [Vitest Documentation](https://vitest.dev/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)
