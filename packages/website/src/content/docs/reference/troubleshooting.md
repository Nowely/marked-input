---
title: Troubleshooting
description: Solutions to common problems and errors
version: 1.0.0
---

This guide helps you diagnose and fix common issues with Markput.

## Installation Issues

### Error: Cannot find module 'rc-marked-input'

**Problem:** Module not found after installation.

**Causes:**
1. Package not installed
2. Wrong package name
3. Node modules cache issue

**Solutions:**

```bash
# 1. Verify installation
npm list rc-marked-input

# 2. Reinstall
npm install rc-marked-input

# 3. Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# 4. Check import statement
import { MarkedInput } from 'rc-marked-input' // ✅ Correct
import { MarkedInput } from 'marked-input' // ❌ Wrong package name
```

### TypeScript: Cannot find type definitions

**Problem:** TypeScript can't find types.

**Error:**
```
Could not find a declaration file for module 'rc-marked-input'
```

**Solution:**

```typescript
// 1. Check types are included (they are!)
// rc-marked-input includes TypeScript definitions

// 2. Update tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}

// 3. Restart TypeScript server
// VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Peer dependency warnings

**Warning:**
```
npm WARN peerDependencies The peer dependency react@">=16.8.0" is not satisfied
```

**Solution:**

```bash
# Install peer dependencies
npm install react@^18.0.0 react-dom@^18.0.0

# Check versions
npm list react react-dom
```

## Rendering Issues

### Marks not rendering

**Problem:** Marks appear as plain text instead of custom components.

**Example:** `@[Alice]` shows as text instead of mark component.

**Causes & Solutions:**

#### Cause 1: Markup pattern doesn't match

```typescript
// ❌ Pattern requires meta, but text doesn't have it
options={[{ markup: '@[__value__](__meta__)' }]}
value="@[Alice]" // No meta!

// ✅ Fix: Use pattern without meta
options={[{ markup: '@[__value__]' }]}
value="@[Alice]"

// ✅ Or: Add meta to text
options={[{ markup: '@[__value__](__meta__)' }]}
value="@[Alice](123)"
```

#### Cause 2: Mark component not provided

```typescript
// ❌ Missing Mark prop
<MarkedInput
  value={value}
  onChange={setValue}
/>

// ✅ Provide Mark component
<MarkedInput
  value={value}
  onChange={setValue}
  Mark={(props) => <span>{props.value}</span>}
/>
```

#### Cause 3: Options not configured

```typescript
// ❌ Options array empty or undefined
<MarkedInput Mark={MyMark} options={[]} />

// ✅ Configure options
<MarkedInput
  Mark={MyMark}
  options={[{ markup: '@[__value__]' }]}
/>
```

#### Cause 4: Wrong placeholder in markup

```typescript
// ❌ Wrong placeholder name
markup: '@[__name__]' // Should be __value__

// ✅ Correct placeholder
markup: '@[__value__]'
```

### Overlay not showing

**Problem:** Autocomplete doesn't appear when typing trigger.

**Causes & Solutions:**

#### Cause 1: Trigger not configured

```typescript
// ❌ No trigger specified
options={[{
  markup: '@[__value__]',
  slotProps: {
    overlay: { data: users } // Missing trigger!
  }
}]}

// ✅ Add trigger
options={[{
  markup: '@[__value__]',
  slotProps: {
    overlay: {
      trigger: '@',
      data: users
    }
  }
}]}
```

#### Cause 2: CSS z-index issue

```css
/* ❌ Overlay hidden behind other elements */
.some-modal {
  z-index: 1000;
}

/* ✅ Increase overlay z-index */
.overlay {
  z-index: 1001 !important;
}
```

#### Cause 3: Overlay positioned off-screen

```typescript
// ✅ Check overlay positioning
const CustomOverlay = () => {
  const { style, ref } = useOverlay()

  console.log('Overlay position:', style) // Debug

  return (
    <div
      ref={ref} // ✅ Don't forget ref!
      style={{
        position: 'absolute',
        left: style.left,
        top: style.top,
        zIndex: 1000
      }}
    >
      {/* Content */}
    </div>
  )
}
```

#### Cause 4: Data array empty

```typescript
// ❌ No data to show
slotProps: {
  overlay: {
    trigger: '@',
    data: [] // Empty!
  }
}

// ✅ Provide data
slotProps: {
  overlay: {
    trigger: '@',
    data: ['alice', 'bob', 'charlie']
  }
}
```

### Nested marks not working

**Problem:** Nested marks render as plain text.

**Example:** `**bold @[mention]**` doesn't nest properly.

**Solution:**

```typescript
// ❌ Using __value__ (doesn't support nesting)
markup: '**__value__**'

// ✅ Use __nested__ placeholder
markup: '**__nested__**'

// ✅ Render children, not value
const BoldMark = ({ children }) => (
  <strong>{children}</strong> // ✅ children, not value!
)
```

**Learn more:** [Nested Marks Guide](../guides/nested-marks)

## Performance Issues

### Typing feels slow/laggy

**Problem:** Noticeable delay when typing.

**Causes & Solutions:**

#### Cause 1: Missing memoization

```typescript
// ❌ New objects on every render
function Editor() {
  return (
    <MarkedInput
      Mark={MyMark}
      options={[{ markup: '@[__value__]' }]} // ❌ New array!
    />
  )
}

// ✅ Memoize options
function Editor() {
  const options = useMemo(() => [
    { markup: '@[__value__]' }
  ], [])

  return <MarkedInput Mark={MyMark} options={options} />
}
```

#### Cause 2: Heavy mark components

```typescript
// ❌ Expensive operations in render
const MyMark = ({ meta }) => {
  const user = fetchUser(meta) // ❌ Fetches on every render!
  return <span>{user.name}</span>
}

// ✅ Fetch data in parent, pass as props
function Editor() {
  const users = useFetchAllUsers() // Single batch request

  const options = useMemo(() => [{
    markup: '@[__value__](__meta__)',
    slotProps: {
      mark: ({ value, meta }) => ({
        value,
        userName: users[meta]?.name
      })
    }
  }], [users])

  return <MarkedInput Mark={MyMark} options={options} />
}
```

#### Cause 3: Debounce missing

```typescript
// ✅ Debounce expensive operations
const debouncedSave = useMemo(
  () => debounce((value) => {
    saveToServer(value)
  }, 500),
  []
)

const handleChange = (value) => {
  setValue(value) // Immediate
  debouncedSave(value) // Delayed
}
```

**Learn more:** [Performance Guide](../advanced/performance)

### High memory usage

**Problem:** Memory usage keeps increasing.

**Cause:** Event listener leak.

**Solution:**

```typescript
// ❌ No cleanup
useEffect(() => {
  store.bus.on(SystemEvent.Change, handler)
}, [])

// ✅ Clean up listeners
useEffect(() => {
  const handler = (data) => console.log(data)
  store.bus.on(SystemEvent.Change, handler)

  return () => {
    store.bus.off(SystemEvent.Change, handler) // ✅ Cleanup
  }
}, [])
```

## Behavior Issues

### Cursor jumps when editing

**Problem:** Cursor moves to end when typing in editable mark.

**Cause:** Not using `silent` option.

**Solution:**

```typescript
// ❌ Without silent
const EditableMark = () => {
  const { change } = useMark()

  const handleInput = (e) => {
    change({ value: e.currentTarget.textContent })
    // Cursor jumps!
  }

  return <span contentEditable onInput={handleInput} />
}

// ✅ With silent option
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

### onChange not firing

**Problem:** `onChange` callback never called.

**Causes & Solutions:**

#### Cause 1: Controlled component without onChange

```typescript
// ❌ Value provided but no onChange
<MarkedInput value={value} Mark={MyMark} />

// ✅ Provide both value and onChange
<MarkedInput
  value={value}
  onChange={setValue}
  Mark={MyMark}
/>
```

#### Cause 2: onChange returns undefined

```typescript
// ❌ onChange doesn't update state
const handleChange = (newValue) => {
  console.log(newValue) // Logs but doesn't update!
}

// ✅ Update state
const handleChange = (newValue) => {
  setValue(newValue) // ✅ Update state
}
```

### Marks duplicating

**Problem:** Marks appear multiple times.

**Cause:** Incorrect key in list rendering.

**Solution:**

```typescript
// ❌ Index as key (causes duplicates on reorder)
{tokens.map((token, index) => (
  <TokenComponent key={index} token={token} />
))}

// ✅ Stable key
{tokens.map((token) => (
  <TokenComponent
    key={token.position.start} // ✅ Stable position-based key
    token={token}
  />
))}
```

## TypeScript Issues

### Type errors with custom props

**Problem:** TypeScript errors when passing custom props.

**Error:**
```
Type '{ username: string; userId: string; }' is not assignable to type 'MarkProps'
```

**Solution:**

```typescript
// ❌ Not specifying generic type
<MarkedInput
  Mark={MyMark}
  options={options}
/>

// ✅ Specify generic type
<MarkedInput<MyMarkProps>
  Mark={MyMark}
  options={options}
/>

// Or use type assertion
const typedOptions: Option<MyMarkProps>[] = [...]
```

**Learn more:** [TypeScript Usage Guide](../guides/typescript-usage)

### Cannot infer option types

**Problem:** TypeScript can't infer types from options.

**Solution:**

```typescript
// ✅ Explicitly type options
interface MentionProps {
  username: string
  userId: string
}

const mentionOption: Option<MentionProps> = {
  markup: '@[__value__](__meta__)',
  slotProps: {
    mark: ({ value, meta }) => ({
      username: value || '',
      userId: meta || ''
    })
  }
}

<MarkedInput<MentionProps>
  Mark={MentionMark}
  options={[mentionOption]}
/>
```

## Browser Compatibility Issues

### contenteditable not working in Safari

**Problem:** Editor not editable in Safari.

**Solution:**

```typescript
// ✅ Ensure contenteditable is "true" (string)
<MarkedInput
  slotProps={{
    container: {
      contentEditable: "true" // ✅ String, not boolean
    }
  }}
/>
```

### Overlay positioning wrong in Firefox

**Problem:** Overlay appears in wrong location.

**Solution:**

```css
/* ✅ Add positioning context */
.editor-container {
  position: relative; /* ✅ Creates positioning context */
}
```

## Error Messages

### Error: "Cannot read property 'parse' of undefined"

**Cause:** Parser not initialized.

**Solution:**

```typescript
// ✅ Ensure options provided
<MarkedInput
  Mark={MyMark}
  options={[{ markup: '@[__value__]' }]} // ✅ Required
/>
```

### Error: "Maximum update depth exceeded"

**Cause:** Infinite re-render loop.

**Solution:**

```typescript
// ❌ Creating new function on every render
<MarkedInput
  onChange={(value) => {
    setValue(value)
  }}
/>

// ✅ Use useCallback
const handleChange = useCallback((value) => {
  setValue(value)
}, [])

<MarkedInput onChange={handleChange} />
```

### Error: "A component is changing an uncontrolled input to be controlled"

**Cause:** Value switches between undefined and string.

**Solution:**

```typescript
// ❌ Value starts as undefined
const [value, setValue] = useState()

// ✅ Initialize with empty string
const [value, setValue] = useState('')

<MarkedInput
  value={value || ''} // ✅ Ensure never undefined
  onChange={setValue}
  Mark={MyMark}
/>
```

### Warning: "Cannot update a component while rendering"

**Cause:** State update during render.

**Solution:**

```typescript
// ❌ Updating state during render
const MyMark = () => {
  setCount(count + 1) // ❌ Side effect in render!
  return <span>Mark</span>
}

// ✅ Use useEffect
const MyMark = () => {
  useEffect(() => {
    setCount(count + 1) // ✅ In effect
  }, [])
  return <span>Mark</span>
}
```

## Testing Issues

### Tests fail: "document is not defined"

**Cause:** Running tests without DOM environment.

**Solution:**

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom' // ✅ Use jsdom
}
```

### Can't find mark elements in tests

**Problem:** `getByRole` can't find marks.

**Solution:**

```typescript
// ❌ Marks don't have default role
screen.getByRole('button', { name: 'Alice' })

// ✅ Add explicit role
const MyMark = ({ value }) => (
  <span role="button" aria-label={value}>
    {value}
  </span>
)

// Or use getByText
screen.getByText('Alice')
```

## Debugging Tips

### Enable debug logging

```typescript
// In development
if (process.env.NODE_ENV === 'development') {
  // Log all events
  store.bus.on(SystemEvent.STORE_UPDATED, (s) => {
    console.log('[Store Updated]', s)
  })

  store.bus.on(SystemEvent.Change, (d) => {
    console.log('[Change]', d)
  })

  // Log parsing
  const originalParse = parser.parse
  parser.parse = (text) => {
    console.log('[Parse Input]', text)
    const tokens = originalParse.call(parser, text)
    console.log('[Parse Output]', tokens)
    return tokens
  }
}
```

### Inspect token tree

```typescript
// Add temporary logging
const handleChange = (value) => {
  console.log('Value:', value)

  const tokens = parser.parse(value)
  console.log('Tokens:', JSON.stringify(tokens, null, 2))

  setValue(value)
}
```

### Check React DevTools

1. Install React DevTools browser extension
2. Open DevTools → Components tab
3. Find `<MarkedInput>` component
4. Inspect props and state
5. Check for warnings in console

## Common Patterns

### Pattern: Debugging mark rendering

```typescript
const DebugMark = (props) => {
  console.log('[Mark Props]', props)

  useEffect(() => {
    console.log('[Mark Mounted]')
    return () => console.log('[Mark Unmounted]')
  }, [])

  return <span>{props.value}</span>
}
```

### Pattern: Validating options

```typescript
function validateOptions(options) {
  options.forEach((option, index) => {
    if (!option.markup) {
      console.error(`Option ${index}: missing markup`)
    }

    if (!option.markup.includes('__value__') &&
        !option.markup.includes('__nested__')) {
      console.error(`Option ${index}: must have __value__ or __nested__`)
    }
  })
}

// Use in development
if (process.env.NODE_ENV === 'development') {
  validateOptions(options)
}
```

## Still Having Issues?

### Before asking for help:

1. ✅ Check this troubleshooting guide
2. ✅ Read the [FAQ](./faq)
3. ✅ Search [existing issues](https://github.com/Nowely/marked-input/issues)
4. ✅ Create minimal reproduction
5. ✅ Check browser console for errors

### Get help:

- **GitHub Issues:** [github.com/Nowely/marked-input/issues](https://github.com/Nowely/marked-input/issues)
- **Discussions:** [github.com/Nowely/marked-input/discussions](https://github.com/Nowely/marked-input/discussions)

### When reporting issues include:

- Markput version (`npm list rc-marked-input`)
- React version (`npm list react`)
- Browser and OS
- Minimal code example
- Expected vs actual behavior
- Error messages and stack traces

## Next Steps

- **[FAQ](./faq)** - Frequently asked questions
- **[Browser Compatibility](./browser-compatibility)** - Browser support details
- **[Glossary](./glossary)** - Term definitions

---

**Found a bug?** [Report it on GitHub](https://github.com/Nowely/marked-input/issues/new)
