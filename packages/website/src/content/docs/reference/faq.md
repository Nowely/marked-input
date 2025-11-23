---
title: FAQ (Frequently Asked Questions)
description: Answers to common questions about Markput
version: 1.0.0
---

This page answers the most frequently asked questions about Markput.

## General Questions

### What is Markput?

React library for building rich text editors with custom markup patterns (@mentions, #hashtags, /commands).

**Learn more:** [Why Markput?](../introduction/why-markput)

### How is Markput different from other editors?

| Feature | Markput | Draft.js | Slate | ProseMirror |
|---------|---------|----------|-------|-------------|
| **Markup-based** | ✅ | ❌ | ❌ | ❌ |
| **Custom patterns** | ✅ | Limited | Limited | Limited |
| **Bundle size** | ~15KB | ~100KB | ~150KB | ~200KB |
| **Learning curve** | Easy | Steep | Steep | Very steep |
| **TypeScript** | ✅ First-class | ✅ | ✅ | ⚠️ Limited |
| **Accessibility** | ✅ Built-in | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual |

**Best for:** Lightweight editors with custom markup (mentions, tags, commands).

**Not for:** Complex WYSIWYG editors with rich formatting toolbar.

### Can I use Markput with Vue/Svelte/Angular?

The React package (`rc-marked-input`) is React-only. However, the core package (`@markput/core`) is framework-agnostic and can be used with any framework.

**Example with Vue:**
```vue
<script setup>
import { Parser } from '@markput/core'

const parser = new Parser(['@[__value__]'])
const tokens = parser.parse(text)
// Render tokens in Vue template
</script>
```


### Is Markput production-ready?

Yes! Markput is stable and used in production applications.

**Stability:**
- ✅ Well-tested (unit, integration, accessibility tests)
- ✅ TypeScript with strict types
- ✅ Semantic versioning
- ✅ Active maintenance

**However:**
- API may change in minor versions (pre-1.0)
- Some advanced features are experimental

### How do I migrate from another editor?

**From Draft.js:**
1. Convert Draft.js content state to plain text with markup
2. Configure Markput options to match your entity types
3. Replace Draft.js components with Markput

**From Slate:**
1. Serialize Slate nodes to markup text
2. Create corresponding markup patterns
3. Migrate editor component

**Example migration:**
```typescript
// Draft.js entity
{ type: 'mention', data: { id: '123', name: 'Alice' } }

// Becomes Markput markup
'@[Alice](123)'
```

## Setup & Installation

### What are the system requirements?

**Browser support:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Node.js:**
- Node 16+ (for development)

**React:**
- React 16.8+ (hooks support required)
- React 17+ recommended
- React 18+ fully supported


### Do I need TypeScript?

No, TypeScript is optional. Markput works with JavaScript, but provides excellent TypeScript support.

**JavaScript:**
```javascript
import { MarkedInput } from 'rc-marked-input'

<MarkedInput
  value={value}
  onChange={setValue}
  Mark={MyMark}
/>
```

**TypeScript (with types):**
```typescript
import { MarkedInput } from 'rc-marked-input'
import type { MarkProps, Option } from 'rc-marked-input'

const options: Option<MyMarkProps>[] = [...]

<MarkedInput<MyMarkProps>
  value={value}
  onChange={setValue}
  Mark={MyMark}
  options={options}
/>
```

### How do I add it to an existing project?

```bash
# Install
npm install rc-marked-input

# Import and use
import { MarkedInput } from 'rc-marked-input'

function App() {
  const [value, setValue] = useState('')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={(props) => <span>{props.value}</span>}
    />
  )
}
```

**Learn more:** [Quick Start](../introduction/quick-start)

## Usage Questions

### How do I create @mentions?

```typescript
import { MarkedInput } from 'rc-marked-input'

const MentionMark = ({ value }) => (
  <span className="mention">@{value}</span>
)

function Editor() {
  const [value, setValue] = useState('')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
      Mark={MentionMark}
      options={[
        {
          markup: '@[__value__](__meta__)',
          slotProps: {
            overlay: {
              trigger: '@',
              data: ['alice', 'bob', 'charlie']
            }
          }
        }
      ]}
    />
  )
}
```

**Learn more:** [Mention System Example](../examples/mention-system)

### How do I add autocomplete?

Autocomplete is built-in! Just provide `slotProps.overlay`:

```typescript
<MarkedInput
  Mark={MyMark}
  options={[
    {
      markup: '@[__value__]',
      slotProps: {
        overlay: {
          trigger: '@',
          data: ['alice', 'bob', 'charlie']
        }
      }
    }
  ]}
/>
```

**Custom overlay:**
```typescript
const CustomOverlay = () => {
  const { match, select } = useOverlay()
  return <div>{/* Custom suggestions */}</div>
}

<MarkedInput
  Mark={MyMark}
  Overlay={CustomOverlay}
/>
```

**Learn more:** [Overlay Customization](../guides/overlay-customization)

### How do I make marks editable?

Use the `useMark()` hook:

```typescript
const EditableMark = () => {
  const { value, change } = useMark()

  return (
    <span
      contentEditable
      onInput={(e) => {
        const newValue = e.currentTarget.textContent || ''
        change({ value: newValue }, { silent: true })
      }}
      suppressContentEditableWarning
    >
      {value}
    </span>
  )
}
```

**Learn more:** [Dynamic Marks Guide](../guides/dynamic-marks)

### How do I handle nested marks?

Use the `__nested__` placeholder in your markup:

```typescript
const options = [
  { markup: '**__nested__**' },  // Bold
  { markup: '@[__value__]' }     // Mention
]

// Now this works:
// "**bold @[mention]**"
```

**Render nested content:**
```typescript
const BoldMark = ({ children }) => (
  <strong>{children}</strong>
)
```

**Learn more:** [Nested Marks Guide](../guides/nested-marks)

### How do I style marks?

**Option 1: CSS classes**
```typescript
const MyMark = ({ value }) => (
  <span className="my-mark">{value}</span>
)
```

**Option 2: Inline styles**
```typescript
const MyMark = ({ value }) => (
  <span style={{ background: '#e3f2fd' }}>{value}</span>
)
```

**Option 3: CSS-in-JS**
```typescript
import styled from 'styled-components'

const StyledMark = styled.span`
  background: #e3f2fd;
  padding: 2px 8px;
`

const MyMark = ({ value }) => <StyledMark>{value}</StyledMark>
```

### How do I get the plain text without markup?

Use the `denote()` helper:

```typescript
import { denote } from 'rc-marked-input'

const marked = 'Hello @[Alice](123)!'
const plain = denote(marked, mark => mark.value, ['@[__value__](__meta__)'])
// 'Hello Alice!'
```

**Learn more:** [Helpers API - denote](../api/helpers#denote)

## Advanced Questions

### Can I use multiple markup patterns?

Yes! Provide multiple options:

```typescript
<MarkedInput
  Mark={UniversalMark}
  options={[
    { markup: '@[__value__](__meta__)' },  // Mentions
    { markup: '#[__value__]' },            // Hashtags
    { markup: '/[__value__]' }             // Commands
  ]}
/>
```

Each pattern can have its own mark component:

```typescript
options={[
  {
    markup: '@[__value__](__meta__)',
    slots: { mark: MentionMark }
  },
  {
    markup: '#[__value__]',
    slots: { mark: HashtagMark }
  }
]}
```

**Learn more:** [Configuration Guide](../guides/configuration)

### How do I validate marks?

**Client-side validation:**
```typescript
const handleChange = (newValue) => {
  // Extract marks
  const marks = extractMarks(newValue)

  // Validate
  const invalid = marks.find(mark =>
    mark.value.length > 50
  )

  if (invalid) {
    setError('Mark too long')
    return
  }

  setValue(newValue)
}
```

**Server-side validation:**
```typescript
const handleSubmit = async () => {
  const response = await fetch('/api/validate', {
    method: 'POST',
    body: JSON.stringify({ content: value })
  })

  const { valid, errors } = await response.json()
  if (!valid) {
    setErrors(errors)
  }
}
```

### How do I implement undo/redo?

**Option 1: Browser built-in**
```typescript
// Ctrl+Z and Ctrl+Y work automatically with contenteditable
```

**Option 2: Custom history**
```typescript
function useHistory(initialValue) {
  const [history, setHistory] = useState([initialValue])
  const [index, setIndex] = useState(0)

  const setValue = (newValue) => {
    const newHistory = history.slice(0, index + 1)
    setHistory([...newHistory, newValue])
    setIndex(newHistory.length)
  }

  const undo = () => {
    if (index > 0) {
      setIndex(index - 1)
    }
  }

  const redo = () => {
    if (index < history.length - 1) {
      setIndex(index + 1)
    }
  }

  return {
    value: history[index],
    setValue,
    undo,
    redo,
    canUndo: index > 0,
    canRedo: index < history.length - 1
  }
}
```

### How do I handle large documents?

**Performance tips:**

1. **Debounce onChange:**
```typescript
const debouncedSave = useMemo(
  () => debounce(saveToServer, 500),
  []
)
```

2. **Memoize components:**
```typescript
const MemoizedMark = memo(MyMark)
```

3. **Use virtualization:**
```typescript
import { FixedSizeList } from 'react-window'
// Render only visible portion
```

4. **Lazy load marks:**
```typescript
const LazyMark = ({ meta }) => {
  const [data, setData] = useState(null)
  useEffect(() => {
    if (isVisible) fetchData(meta).then(setData)
  }, [isVisible])
  return data ? <FullMark data={data} /> : <PlaceholderMark />
}
```

**Learn more:** [Performance Guide](../advanced/performance)

### Can I integrate with form libraries?

Yes! Markput works with any form library.

**React Hook Form:**
```typescript
import { useForm, Controller } from 'react-hook-form'

function Form() {
  const { control } = useForm()

  return (
    <Controller
      name="message"
      control={control}
      render={({ field }) => (
        <MarkedInput
          value={field.value}
          onChange={field.onChange}
          Mark={MyMark}
        />
      )}
    />
  )
}
```

**Formik:**
```typescript
import { Formik, Field } from 'formik'

<Formik initialValues={{ message: '' }}>
  <Field name="message">
    {({ field }) => (
      <MarkedInput
        value={field.value}
        onChange={value => field.onChange({ target: { name: 'message', value } })}
        Mark={MyMark}
      />
    )}
  </Field>
</Formik>
```

### How do I test Markput components?

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

test('user can type and create marks', async () => {
  const user = userEvent.setup()
  const onChange = jest.fn()

  render(
    <MarkedInput
      value=""
      onChange={onChange}
      Mark={MyMark}
    />
  )

  const editor = screen.getByRole('textbox')
  await user.click(editor)
  await user.keyboard('Hello @[Alice]')

  expect(onChange).toHaveBeenCalled()
  expect(screen.getByText('Alice')).toBeInTheDocument()
})
```

## Troubleshooting

### Why isn't my mark rendering?

**Common causes:**

1. **Markup pattern doesn't match:**
```typescript
// Pattern
markup: '@[__value__](__meta__)'

// Text doesn't match (missing meta)
text: '@[Alice]' // ❌

// Text matches
text: '@[Alice](123)' // ✅
```

2. **Mark component not provided:**
```typescript
// ❌ Missing Mark prop
<MarkedInput value={value} onChange={setValue} />

// ✅ Mark provided
<MarkedInput value={value} onChange={setValue} Mark={MyMark} />
```

3. **Check browser console for errors**

### Why is the overlay not showing?

**Common causes:**

1. **Missing trigger in slotProps:**
```typescript
// ❌ No trigger
slotProps: { overlay: { data: users } }

// ✅ With trigger
slotProps: { overlay: { trigger: '@', data: users } }
```

2. **Trigger character not typed:**
- Type `@` to see overlay

3. **CSS z-index issues:**
```css
.overlay {
  z-index: 1000; /* Make sure it's above other elements */
}
```

### Why is typing slow?

**Common causes:**

1. **Missing memoization:**
```typescript
// ❌ New options every render
<MarkedInput options={[{ markup: '...' }]} />

// ✅ Memoized options
const options = useMemo(() => [{ markup: '...' }], [])
<MarkedInput options={options} />
```

2. **Heavy mark components:**
```typescript
// ❌ API call in mark component
const MyMark = ({ meta }) => {
  const user = fetchUser(meta) // Called for every mark!
  return <span>{user.name}</span>
}

// ✅ Batch fetch in parent
const users = useFetchAllUsers()
const MyMark = ({ value }) => <span>{value}</span>
```

3. **Large documents** - See [Performance Guide](../advanced/performance)

## Getting Help

### Where can I get help?

- **Documentation:** [markput.dev](https://markput.dev)
- **GitHub Issues:** [github.com/Nowely/marked-input/issues](https://github.com/Nowely/marked-input/issues)
- **Discussions:** [github.com/Nowely/marked-input/discussions](https://github.com/Nowely/marked-input/discussions)

### How do I report a bug?

1. Check [existing issues](https://github.com/Nowely/marked-input/issues)
2. Create a minimal reproduction
3. Open a new issue with:
   - Markput version
   - React version
   - Browser and OS
   - Code example
   - Expected vs actual behavior

### How do I request a feature?

1. Check [existing discussions](https://github.com/Nowely/marked-input/discussions)
2. Open a discussion describing:
   - Use case
   - Proposed API
   - Why existing features don't work

---

**Still have questions?** Open a [discussion on GitHub](https://github.com/Nowely/marked-input/discussions)!
