---
title: 🚧 Slots Customization
description: Customize Markput components with slots pattern - replace container, text rendering, styling without forking
keywords: [slots pattern, component customization, container, rendering, styling, slotProps]
---

Markput uses the **slots pattern** (popularized by Material-UI) to give you fine-grained control over internal components. This guide covers how to customize the container and text rendering without losing built-in functionality.

## What are Slots?

Slots are a component customization pattern that separates structure from styling and behavior. Instead of wrapping or forking components, you customize them through props:

```tsx
<MarkedInput
    slots={{
        container: CustomContainer, // Replace component
        span: CustomSpan, // Replace component
    }}
    slotProps={{
        container: {className: 'my-editor'}, // Pass props to default
        span: {style: {color: 'red'}}, // Pass props to default
    }}
/>
```

**Key Concepts:**

- **`slots`** - Replace the default component entirely
- **`slotProps`** - Pass props to the default (or custom) component

## Available Slots

Markput exposes two slots:

| Slot        | Default Component | Purpose                 |
| ----------- | ----------------- | ----------------------- |
| `container` | `<div>`           | Root editable container |
| `span`      | `<span>`          | Plain text segments     |

**What's NOT a slot:**

- Mark components (use `Mark` prop)
- Overlay components (use `Overlay` prop)

## Using slotProps (Customize Defaults)

The simplest way to customize slots is through `slotProps`. This passes props to the default components without replacing them.

### Basic Styling

```tsx
import {MarkedInput} from 'rc-marked-input'

function StyledEditor() {
    const [value, setValue] = useState('')

    return (
        <MarkedInput
            value={value}
            onChange={setValue}
            Mark={MyMark}
            slotProps={{
                container: {
                    style: {
                        border: '2px solid #e0e0e0',
                        borderRadius: '8px',
                        padding: '12px',
                        minHeight: '120px',
                        fontSize: '16px',
                        lineHeight: '1.6',
                    },
                },
                span: {
                    style: {
                        whiteSpace: 'pre-wrap', // Preserve whitespace
                    },
                },
            }}
        />
    )
}
```

### CSS Classes

```tsx
<MarkedInput
    Mark={MyMark}
    slotProps={{
        container: {
            className: 'editor-container',
        },
        span: {
            className: 'editor-text',
        },
    }}
/>
```

```css
/* styles.css */
.editor-container {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 16px;
    font-family: 'Inter', sans-serif;
}

.editor-container:focus {
    outline: 2px solid #2196f3;
    border-color: transparent;
}

.editor-text {
    color: #333;
    letter-spacing: 0.01em;
}
```

### Event Handlers

Add event handlers through `slotProps`:

```tsx
function EditorWithEvents() {
    const [value, setValue] = useState('')
    const [isFocused, setIsFocused] = useState(false)

    return (
        <MarkedInput
            value={value}
            onChange={setValue}
            Mark={MyMark}
            slotProps={{
                container: {
                    onFocus: e => {
                        console.log('Editor focused')
                        setIsFocused(true)
                    },
                    onBlur: e => {
                        console.log('Editor blurred')
                        setIsFocused(false)
                    },
                    onKeyDown: e => {
                        if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            console.log('Save triggered')
                        }
                    },
                    onPaste: e => {
                        console.log('Pasted:', e.clipboardData.getData('text'))
                    },
                    style: {
                        outline: isFocused ? '2px solid blue' : 'none',
                    },
                },
            }}
        />
    )
}
```

### Accessibility Attributes

Improve accessibility with ARIA attributes:

```tsx
<MarkedInput
  Mark={MyMark}
  slotProps={{
    container: {
      role: 'textbox',
      'aria-label': 'Message input',
      'aria-multiline': true,
      'aria-required': true,
      'aria-describedby': 'editor-help-text'
    }
  }}
/>

<p id="editor-help-text" className="help-text">
  Type @ to mention someone
</p>
```

### Data Attributes

Add custom data attributes for testing or analytics:

```tsx
<MarkedInput
    Mark={MyMark}
    slotProps={{
        container: {
            'data-testid': 'editor-input',
            'data-editor-type': 'mention-editor',
            'data-track': 'user-input',
        },
        span: {
            'data-text-node': true,
        },
    }}
/>
```

## Using slots (Replace Components)

For deeper customization, replace the default components entirely with `slots`.

### Custom Container Component

Replace the container with a custom component:

```tsx
import {forwardRef} from 'react'
import type {HTMLAttributes} from 'react'

const CustomContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => {
    return (
        <div
            {...props}
            ref={ref}
            style={{
                ...props.style,
                border: '2px dashed #9c27b0',
                borderRadius: '12px',
                padding: '16px',
                backgroundColor: '#f5f5f5',
            }}
        />
    )
})

function Editor() {
    return (
        <MarkedInput
            Mark={MyMark}
            slots={{
                container: CustomContainer,
            }}
        />
    )
}
```

**Important:** Custom slot components MUST:

1. Accept all props with spread (`{...props}`)
2. Forward the ref (`forwardRef`)
3. Be typed correctly for TypeScript

### Custom Span Component

Replace text spans with custom rendering:

```tsx
const CustomSpan = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement>
>((props, ref) => {
  return (
    <span
      {...props}
      ref={ref}
      style={{
        ...props.style,
        fontFamily: 'monospace',
        letterSpacing: '0.5px',
        color: '#666'
      }}
    />
  )
})

<MarkedInput
  Mark={MyMark}
  slots={{
    span: CustomSpan
  }}
/>
```

### Combining slots and slotProps

Use both together - `slots` to replace components, `slotProps` to pass additional props:

```tsx
const CustomContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div {...props} ref={ref} className={`custom-editor ${props.className || ''}`} />
  )
)

<MarkedInput
  Mark={MyMark}
  slots={{
    container: CustomContainer  // Custom component
  }}
  slotProps={{
    container: {
      className: 'with-shadow',  // Props passed to CustomContainer
      onFocus: () => console.log('Focused')
    }
  }}
/>
```

The props from `slotProps.container` will be passed to your `CustomContainer` component.

## Styling Approaches

### Approach 1: Inline Styles

Good for dynamic styles based on state:

```tsx
function ThemedEditor() {
    const [theme, setTheme] = useState('light')

    const containerStyle = {
        backgroundColor: theme === 'light' ? '#fff' : '#1e1e1e',
        color: theme === 'light' ? '#000' : '#fff',
        border: `1px solid ${theme === 'light' ? '#ddd' : '#444'}`,
    }

    return (
        <MarkedInput
            Mark={MyMark}
            slotProps={{
                container: {style: containerStyle},
            }}
        />
    )
}
```

### Approach 2: CSS Classes

Good for static styles and media queries:

```tsx
<MarkedInput
    Mark={MyMark}
    slotProps={{
        container: {className: 'editor-modern'},
    }}
/>
```

```css
.editor-modern {
    border: none;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.editor-modern:focus {
    box-shadow: 0 10px 60px rgba(0, 0, 0, 0.3);
}

@media (max-width: 768px) {
    .editor-modern {
        padding: 12px;
        border-radius: 8px;
    }
}
```

### Approach 3: CSS-in-JS

Good for component libraries and scoped styles:

```tsx
import {styled} from '@mui/material/styles'

const StyledContainer = styled('div')(({theme}) => ({
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    '&:focus': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 2,
    },
}))

const StyledSpan = styled('span')(({theme}) => ({
    color: theme.palette.text.primary,
    fontSize: theme.typography.body1.fontSize,
}))

function MuiEditor() {
    return (
        <MarkedInput
            Mark={MyMark}
            slots={{
                container: StyledContainer,
                span: StyledSpan,
            }}
        />
    )
}
```

### Approach 4: Tailwind CSS

Good for utility-first styling:

```tsx
const TailwindContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div
      {...props}
      ref={ref}
      className={`
        border border-gray-300 rounded-lg p-4
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        bg-white dark:bg-gray-800 dark:border-gray-600
        min-h-[120px]
        ${props.className || ''}
      `}
    />
  )
)

<MarkedInput
  Mark={MyMark}
  slots={{
    container: TailwindContainer
  }}
/>
```

## Common Use Cases

### Use Case 1: Placeholder Text

Show placeholder when editor is empty:

```tsx
const ContainerWithPlaceholder = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & {isEmpty?: boolean}>(
    ({isEmpty, ...props}, ref) => (
        <div {...props} ref={ref} style={{position: 'relative'}}>
            {isEmpty && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        pointerEvents: 'none',
                        color: '#999',
                        padding: 'inherit',
                    }}
                >
                    Type @ to mention someone...
                </div>
            )}
        </div>
    )
)

function EditorWithPlaceholder() {
    const [value, setValue] = useState('')

    return (
        <MarkedInput
            value={value}
            onChange={setValue}
            Mark={MyMark}
            slots={{
                container: ContainerWithPlaceholder,
            }}
            slotProps={{
                container: {
                    isEmpty: value.trim() === '',
                },
            }}
        />
    )
}
```

### Use Case 2: Character Counter

Add a character count overlay:

```tsx
const ContainerWithCounter = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement> & {charCount?: number; maxChars?: number}
>(({charCount = 0, maxChars = 500, ...props}, ref) => (
    <div style={{position: 'relative'}}>
        <div {...props} ref={ref} />
        <div
            style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                fontSize: '12px',
                color: charCount > maxChars ? '#f44336' : '#999',
                pointerEvents: 'none',
            }}
        >
            {charCount} / {maxChars}
        </div>
    </div>
))

function EditorWithCounter() {
    const [value, setValue] = useState('')

    return (
        <MarkedInput
            value={value}
            onChange={setValue}
            Mark={MyMark}
            slots={{
                container: ContainerWithCounter,
            }}
            slotProps={{
                container: {
                    charCount: value.length,
                    maxChars: 500,
                },
            }}
        />
    )
}
```

### Use Case 3: Custom Focus Behavior

Highlight container on focus:

```tsx
const FocusableContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  (props, ref) => {
    const [focused, setFocused] = useState(false)

    return (
      <div
        {...props}
        ref={ref}
        onFocus={(e) => {
          setFocused(true)
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          props.onBlur?.(e)
        }}
        style={{
          ...props.style,
          border: focused ? '2px solid #2196f3' : '1px solid #ddd',
          boxShadow: focused ? '0 0 0 3px rgba(33, 150, 243, 0.1)' : 'none',
          transition: 'all 0.2s ease'
        }}
      />
    )
  }
)

<MarkedInput
  Mark={MyMark}
  slots={{
    container: FocusableContainer
  }}
/>
```

### Use Case 4: Line Numbers

Add line numbers for multi-line content:

```tsx
const ContainerWithLineNumbers = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & {lineCount?: number}>(
    ({lineCount = 1, ...props}, ref) => (
        <div style={{display: 'flex'}}>
            <div
                style={{
                    width: '40px',
                    backgroundColor: '#f5f5f5',
                    padding: '8px',
                    textAlign: 'right',
                    color: '#999',
                    fontSize: '12px',
                    userSelect: 'none',
                    borderRight: '1px solid #ddd',
                }}
            >
                {Array.from({length: lineCount}, (_, i) => (
                    <div key={i}>{i + 1}</div>
                ))}
            </div>
            <div {...props} ref={ref} style={{flex: 1, ...props.style}} />
        </div>
    )
)

function EditorWithLineNumbers() {
    const [value, setValue] = useState('')
    const lineCount = value.split('\n').length

    return (
        <MarkedInput
            value={value}
            onChange={setValue}
            Mark={MyMark}
            slots={{
                container: ContainerWithLineNumbers,
            }}
            slotProps={{
                container: {
                    lineCount,
                },
            }}
        />
    )
}
```

### Use Case 5: Syntax Highlighting for Text

Custom text rendering with highlighting:

```tsx
const HighlightedSpan = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement>
>((props, ref) => {
  const text = props.children as string

  // Highlight specific patterns
  const isUrl = /^https?:\/\//.test(text)
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)

  let style = { ...props.style }
  if (isUrl) {
    style.color = '#2196f3'
    style.textDecoration = 'underline'
  } else if (isEmail) {
    style.color = '#4caf50'
  }

  return <span {...props} ref={ref} style={style} />
})

<MarkedInput
  Mark={MyMark}
  slots={{
    span: HighlightedSpan
  }}
/>
```

## Integration with UI Libraries

### Material-UI (MUI)

```tsx
import {Paper, useTheme} from '@mui/material'
import {styled} from '@mui/material/styles'

const MuiContainer = styled(Paper)(({theme}) => ({
    padding: theme.spacing(2),
    minHeight: 120,
    border: `1px solid ${theme.palette.divider}`,
    '&:focus-within': {
        borderColor: theme.palette.primary.main,
        boxShadow: `0 0 0 2px ${theme.palette.primary.main}25`,
    },
}))

function MuiEditor() {
    return (
        <MarkedInput
            Mark={MyMark}
            slots={{
                container: MuiContainer,
            }}
            slotProps={{
                container: {
                    elevation: 0,
                },
            }}
        />
    )
}
```

### Chakra UI

```tsx
import { Box } from '@chakra-ui/react'
import { forwardRef } from 'react'

const ChakraContainer = forwardRef((props, ref) => (
  <Box
    {...props}
    ref={ref}
    borderWidth="1px"
    borderRadius="md"
    p={4}
    minH="120px"
    _focus={{
      borderColor: 'blue.500',
      boxShadow: 'outline'
    }}
  />
))

<MarkedInput
  Mark={MyMark}
  slots={{
    container: ChakraContainer
  }}
/>
```

### Ant Design

```tsx
import { Input } from 'antd'
import { forwardRef } from 'react'

const AntContainer = forwardRef<HTMLDivElement, any>((props, ref) => (
  <div
    {...props}
    ref={ref}
    className="ant-input"
    style={{
      minHeight: 120,
      ...props.style
    }}
  />
))

<MarkedInput
  Mark={MyMark}
  slots={{
    container: AntContainer
  }}
/>
```

## TypeScript Usage

### Typing Custom Slot Components

```tsx
import {forwardRef} from 'react'
import type {HTMLAttributes, CSSProperties} from 'react'

// Type container with custom props
interface CustomContainerProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'outlined' | 'filled'
    error?: boolean
}

const TypedContainer = forwardRef<HTMLDivElement, CustomContainerProps>(
    ({variant = 'outlined', error = false, ...props}, ref) => {
        const style: CSSProperties = {
            ...props.style,
            border: error ? '2px solid red' : '1px solid #ddd',
            backgroundColor: variant === 'filled' ? '#f5f5f5' : 'transparent',
        }

        return <div {...props} ref={ref} style={style} />
    }
)

// Usage with type safety
function TypedEditor() {
    return (
        <MarkedInput
            Mark={MyMark}
            slots={{
                container: TypedContainer,
            }}
            slotProps={{
                container: {
                    variant: 'filled',
                    error: true,
                },
            }}
        />
    )
}
```

### Generic Slot Props

```tsx
import type {MarkedInputProps} from 'rc-marked-input'

interface EditorProps {
    containerClass?: string
    spanClass?: string
}

function ConfigurableEditor({containerClass, spanClass}: EditorProps) {
    const slotProps: MarkedInputProps['slotProps'] = {
        container: {
            className: containerClass,
        },
        span: {
            className: spanClass,
        },
    }

    return <MarkedInput Mark={MyMark} slotProps={slotProps} />
}
```

## Performance Considerations

### Memoize Custom Components

Prevent unnecessary re-renders:

```tsx
import { memo, forwardRef } from 'react'

const MemoizedContainer = memo(
  forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    (props, ref) => (
      <div {...props} ref={ref} className="editor-container" />
    )
  )
)

<MarkedInput
  Mark={MyMark}
  slots={{
    container: MemoizedContainer
  }}
/>
```

### Avoid Inline Function Creation

```tsx
// ❌ Bad - creates new function each render
;<MarkedInput
    slotProps={{
        container: {
            onKeyDown: e => console.log(e.key),
        },
    }}
/>

// ✅ Good - stable function reference
function Editor() {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        console.log(e.key)
    }, [])

    return (
        <MarkedInput
            slotProps={{
                container: {
                    onKeyDown: handleKeyDown,
                },
            }}
        />
    )
}
```

### Memoize slotProps Object

```tsx
function Editor() {
    const slotProps = useMemo(
        () => ({
            container: {
                className: 'editor',
                style: {padding: '16px'},
            },
            span: {
                className: 'text',
            },
        }),
        []
    ) // Only created once

    return <MarkedInput Mark={MyMark} slotProps={slotProps} />
}
```

## Complete Examples

### Example 1: GitHub-Style Editor

```tsx
import {MarkedInput} from 'rc-marked-input'
import {useState, forwardRef} from 'react'
import type {HTMLAttributes} from 'react'

const GitHubContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => (
    <div
        {...props}
        ref={ref}
        style={{
            ...props.style,
            border: '1px solid #d0d7de',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
            minHeight: '100px',
            backgroundColor: '#fff',
        }}
    />
))

function GitHubEditor() {
    const [value, setValue] = useState('')

    return (
        <div style={{maxWidth: '800px'}}>
            <div
                style={{
                    border: '1px solid #d0d7de',
                    borderRadius: '6px',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        backgroundColor: '#f6f8fa',
                        padding: '8px 12px',
                        borderBottom: '1px solid #d0d7de',
                        fontSize: '14px',
                        color: '#57606a',
                    }}
                >
                    Write a comment
                </div>
                <MarkedInput
                    value={value}
                    onChange={setValue}
                    Mark={({value}) => <span style={{color: '#0969da', fontWeight: 600}}>@{value}</span>}
                    slots={{
                        container: GitHubContainer,
                    }}
                    slotProps={{
                        container: {
                            'aria-label': 'Comment body',
                        },
                    }}
                    options={[
                        {
                            markup: '@[__value__]',
                            slotProps: {
                                overlay: {trigger: '@', data: ['octocat', 'github', 'copilot']},
                            },
                        },
                    ]}
                />
            </div>
        </div>
    )
}
```

### Example 2: Notion-Style Editor

```tsx
const NotionContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => {
    const [placeholder, setPlaceholder] = useState("Type '/' for commands")

    return (
        <div
            {...props}
            ref={ref}
            style={{
                ...props.style,
                fontSize: '16px',
                lineHeight: '1.6',
                fontFamily:
                    'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
                padding: '12px 96px',
                minHeight: '300px',
                outline: 'none',
            }}
            onFocus={() => setPlaceholder('')}
            onBlur={e => {
                if (!e.currentTarget.textContent) {
                    setPlaceholder("Type '/' for commands")
                }
                props.onBlur?.(e)
            }}
        >
            {!props.children && (
                <div
                    style={{
                        position: 'absolute',
                        color: '#9b9a97',
                        pointerEvents: 'none',
                    }}
                >
                    {placeholder}
                </div>
            )}
        </div>
    )
})

function NotionEditor() {
    const [value, setValue] = useState('')

    return (
        <MarkedInput
            value={value}
            onChange={setValue}
            Mark={({value}) => (
                <span
                    style={{
                        backgroundColor: '#f1f1ef',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '85%',
                        fontFamily: 'monospace',
                    }}
                >
                    {value}
                </span>
            )}
            slots={{
                container: NotionContainer,
            }}
        />
    )
}
```

## Best Practices

### ✅ Do

```tsx
// Always forward refs
const CustomContainer = forwardRef((props, ref) => <div {...props} ref={ref} />)

// Spread all props
const CustomContainer = forwardRef((props, ref) => (
    <div {...props} ref={ref} className={`custom ${props.className || ''}`} />
))

// Preserve existing style
const CustomContainer = forwardRef((props, ref) => (
    <div {...props} ref={ref} style={{...props.style, padding: '16px'}} />
))

// Memoize stable components
const StableContainer = memo(forwardRef((props, ref) => <div {...props} ref={ref} />))

// Type custom components properly
const TypedContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => (
    <div {...props} ref={ref} />
))
```

### ❌ Don't

```tsx
// Don't forget forwardRef
const Bad = (props) => <div {...props} />  // Missing ref!

// Don't forget to spread props
const Bad = forwardRef((props, ref) => (
  <div ref={ref} className="custom" />  // Lost all props!
))

// Don't override style completely
const Bad = forwardRef((props, ref) => (
  <div {...props} ref={ref} style={{ padding: '16px' }} />  // Lost original style!
))

// Don't use inline components
<MarkedInput
  slots={{
    container: (props) => <div {...props} />  // Creates new component each render!
  }}
/>

// Don't forget TypeScript types
const Bad = forwardRef((props, ref) => (  // Any types!
  <div {...props} ref={ref} />
))
```
