---
title: Performance Optimization
description: Optimize Markput for large documents and high-performance applications
version: 1.0.0
---

Markput is optimized for typical use cases (up to ~10,000 characters and ~100 marks). For larger documents or complex applications, use the following strategies.

## Performance Overview

**Baseline Performance:**
- **Parse time:** ~0.01ms per 100 chars
- **Re-render:** ~1-5ms (optimized with memoization)

**Common Bottlenecks:**
1. **Large documents** (>10,000 characters)
2. **Many marks** (>100 marks)
3. **Complex mark components** (heavy rendering)
4. **Heavy onChange handlers**

## Optimization Strategies

### 1. Debounce onChange

Prevent expensive operations (API calls, validation) from blocking the UI thread during typing.

```typescript
import { useMemo } from 'react'
import { debounce } from 'lodash'

function Editor() {
  const [value, setValue] = useState('')

  const debouncedSave = useMemo(
    () => debounce((val) => saveToBackend(val), 500),
    []
  )

  const handleChange = (newValue: string) => {
    setValue(newValue)           // Immediate UI update
    debouncedSave(newValue)      // Deferred operation
  }

  return <MarkedInput value={value} onChange={handleChange} Mark={MyMark} />
}
```

### 2. Memoize Mark Components

Ensure your Mark component is memoized to prevent unnecessary re-renders of all marks when typing.

```typescript
import { memo } from 'react'

// ✅ Only re-renders when props change
const FastMark = memo<MarkProps>(({ value }) => (
  <span>{value}</span>
))

<MarkedInput Mark={FastMark} />
```

### 3. Memoize Options

Pass a stable reference for `options` to avoid re-initializing the parser on every render.

```typescript
// ✅ Memoized options
const options = useMemo(() => [
  { markup: '@[__value__]' }
], [])

return <MarkedInput Mark={MyMark} options={options} />
```

### 4. Virtualization (Large Documents)

For very large documents, consider rendering only the visible portion or splitting the content into lines/blocks.

```typescript
import { FixedSizeList } from 'react-window'

function VirtualizedEditor({ lines }) {
  return (
    <FixedSizeList height={600} itemCount={lines.length} itemSize={24}>
      {({ index, style }) => (
        <div style={style}>
          <MarkedInput value={lines[index]} Mark={MyMark} />
        </div>
      )}
    </FixedSizeList>
  )
}
```

### 5. Batch Data Fetching

If your marks need to fetch data (e.g., user details), fetch it in a batch at the parent level instead of initiating a request from each Mark component.

```typescript
// Parent component fetches data for all marks
const users = useFetchUsers(extractUserIds(value))

const options = useMemo(() => [{
  markup: '@[__value__](__meta__)',
  slotProps: {
    mark: ({ value, meta }) => ({
      value,
      user: users[meta] // Pass cached/batched data
    })
  }
}], [users])
```

## Performance Checklist

- [ ] **Memoize Mark components** with `memo()`.
- [ ] **Memoize options array** with `useMemo()`.
- [ ] **Debounce** expensive `onChange` side effects.
- [ ] **Clean up** event listeners in `useEffect`.
- [ ] **Batch API requests** for mark data.
