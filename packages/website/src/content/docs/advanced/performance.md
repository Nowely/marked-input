---
title: Performance Optimization
description: Optimize Markput for large documents and high-performance applications
version: 1.0.0
---

This guide covers performance optimization techniques for Markput applications.

## Performance Overview

### Baseline Performance

Markput is optimized for typical use cases:

| Scenario | Performance | Notes |
|----------|------------|-------|
| **Text length** | 100-10,000 chars | Excellent performance |
| **Marks count** | 10-100 marks | Fast rendering |
| **Typing speed** | Normal typing | No lag |
| **Parse time** | ~0.01ms per 100 chars | Very fast |
| **Re-render** | ~1-5ms | Optimized with memoization |

### Performance Bottlenecks

Common performance issues:

1. **Large documents** (>10,000 characters)
2. **Many marks** (>100 marks)
3. **Complex mark components** (heavy rendering)
4. **Frequent re-renders** (missing memoization)
5. **Heavy onChange handlers** (blocking updates)

## Large Documents

### Problem: Slow Parsing

**Symptoms:**
- Typing feels sluggish
- Delays when pasting large text
- UI freezes on input

**Solution 1: Debounce onChange**

```typescript
import { useMemo } from 'react'
import { debounce } from 'lodash'

function Editor() {
  const [value, setValue] = useState('')

  // Debounce expensive operations
  const debouncedSave = useMemo(
    () => debounce((value: string) => {
      saveToBackend(value)
    }, 500),
    []
  )

  const handleChange = (newValue: string) => {
    setValue(newValue)           // Update immediately (fast)
    debouncedSave(newValue)      // Save later (slow)
  }

  return (
    <MarkedInput
      value={value}
      onChange={handleChange}
      Mark={MyMark}
    />
  )
}
```

**Solution 2: Virtualization**

For very large documents, use virtualization:

```typescript
import { FixedSizeList } from 'react-window'

function VirtualizedEditor() {
  const [value, setValue] = useState('')
  const lines = value.split('\n')

  return (
    <FixedSizeList
      height={600}
      itemCount={lines.length}
      itemSize={24}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <MarkedInput
            value={lines[index]}
            onChange={(newLine) => {
              const newLines = [...lines]
              newLines[index] = newLine
              setValue(newLines.join('\n'))
            }}
            Mark={MyMark}
          />
        </div>
      )}
    </FixedSizeList>
  )
}
```

**Solution 3: Lazy Parsing**

Parse only visible content:

```typescript
function LazyEditor() {
  const [value, setValue] = useState('')
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 1000 })

  const visibleText = value.substring(visibleRange.start, visibleRange.end)

  return (
    <ScrollContainer onScroll={(range) => setVisibleRange(range)}>
      <MarkedInput
        value={visibleText}
        onChange={(newText) => {
          const newValue =
            value.substring(0, visibleRange.start) +
            newText +
            value.substring(visibleRange.end)
          setValue(newValue)
        }}
        Mark={MyMark}
      />
    </ScrollContainer>
  )
}
```

### Problem: Slow Re-rendering

**Solution: Memoize Mark Components**

```typescript
import { memo } from 'react'

// ❌ Re-renders on every change
const SlowMark: FC<MarkProps> = ({ value }) => (
  <span>{value}</span>
)

// ✅ Only re-renders when props change
const FastMark = memo<MarkProps>(({ value }) => (
  <span>{value}</span>
))

<MarkedInput Mark={FastMark} />
```

**Solution: Memoize Options**

```typescript
function Editor() {
  // ❌ Creates new options object on every render
  return (
    <MarkedInput
      Mark={MyMark}
      options={[
        { markup: '@[__value__]' } // New object every render!
      ]}
    />
  )

  // ✅ Memoized options
  const options = useMemo(() => [
    { markup: '@[__value__]' }
  ], [])

  return <MarkedInput Mark={MyMark} options={options} />
}
```

## Many Marks

### Problem: Too Many DOM Nodes

**Symptoms:**
- Slow scrolling
- High memory usage
- Browser becomes unresponsive

**Solution: Simplify Mark Components**

```typescript
// ❌ Heavy mark component
const HeavyMark: FC<MarkProps> = ({ value, meta }) => {
  const user = useFetchUser(meta)           // API call per mark!
  const avatar = useFetchAvatar(user.id)    // Another API call!

  return (
    <div className="mark">
      <img src={avatar} />
      <span>{value}</span>
      <Tooltip content={user.bio} />
    </div>
  )
}

// ✅ Lightweight mark component
const LightMark: FC<MarkProps> = ({ value }) => (
  <span className="mark">{value}</span>
)
```

**Solution: Batch Data Fetching**

```typescript
// Fetch all user data at once
function Editor() {
  const [value, setValue] = useState('')
  const marks = extractMarks(value)
  const userIds = marks.map(m => m.meta)

  // Single batch request
  const users = useFetchUsers(userIds)

  const options = useMemo(() => [{
    markup: '@[__value__](__meta__)',
    slotProps: {
      mark: ({ value, meta }: MarkProps) => ({
        value,
        user: users[meta] // Pass cached data
      })
    }
  }], [users])

  return <MarkedInput value={value} onChange={setValue} options={options} />
}
```

### Problem: Expensive Mark Rendering

**Solution: Lazy Loading**

```typescript
const LazyMark: FC<MarkProps> = ({ value, meta }) => {
  const [data, setData] = useState(null)
  const isVisible = useIntersectionObserver(ref)

  useEffect(() => {
    if (isVisible && !data) {
      fetchData(meta).then(setData)
    }
  }, [isVisible, meta])

  return (
    <span ref={ref}>
      {data ? <DetailedView data={data} /> : value}
    </span>
  )
}
```

## Memoization Strategies

### Strategy 1: Component-Level Memoization

```typescript
// Memoize entire mark component
const MemoizedMark = memo<MarkProps>(
  ({ value, meta }) => <span>{value}</span>,
  (prev, next) => {
    // Custom comparison
    return prev.value === next.value && prev.meta === next.meta
  }
)
```

### Strategy 2: Hook-Level Memoization

```typescript
const MyMark: FC = () => {
  const { value, meta } = useMark()

  // Memoize expensive computations
  const displayName = useMemo(() => {
    return formatName(value) // Expensive operation
  }, [value])

  const userLink = useMemo(() => {
    return `/users/${meta}`
  }, [meta])

  return <a href={userLink}>{displayName}</a>
}
```

### Strategy 3: Data-Level Memoization

```typescript
// Cache parsed tokens
const tokens = useMemo(() => {
  return parser.parse(value)
}, [value, parser])

// Cache mark data
const markData = useMemo(() => {
  return tokens
    .filter(t => t.type === 'mark')
    .map(t => ({ value: t.value, meta: t.meta }))
}, [tokens])
```

### Strategy 4: Callback Memoization

```typescript
function Editor() {
  // ❌ New function on every render
  const handleMarkClick = (id: string) => {
    console.log(id)
  }

  // ✅ Memoized callback
  const handleMarkClick = useCallback((id: string) => {
    console.log(id)
  }, [])

  return <MarkedInput Mark={MyMark} />
}
```

## Debouncing

### Debounce onChange

```typescript
import { useMemo } from 'react'
import debounce from 'lodash/debounce'

function Editor() {
  const [value, setValue] = useState('')

  const debouncedOnChange = useMemo(
    () => debounce((newValue: string) => {
      // Heavy operations: API calls, validation, etc.
      saveToServer(newValue)
      validateContent(newValue)
      updateAnalytics(newValue)
    }, 300),
    []
  )

  const handleChange = (newValue: string) => {
    setValue(newValue)              // Immediate update (UI)
    debouncedOnChange(newValue)     // Delayed operations
  }

  return (
    <MarkedInput
      value={value}
      onChange={handleChange}
      Mark={MyMark}
    />
  )
}
```

### Debounce Overlay Search

```typescript
const MyOverlay: FC = () => {
  const { match } = useOverlay()
  const [results, setResults] = useState([])

  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      searchAPI(query).then(setResults)
    }, 200),
    []
  )

  useEffect(() => {
    debouncedSearch(match.value)
  }, [match.value])

  return <div>{results.map(r => ...)}</div>
}
```

### Throttle vs Debounce

```typescript
// Debounce: Wait for user to stop typing
const debounced = debounce(fn, 300)
// Calls fn 300ms after last keystroke

// Throttle: Call at most once per interval
const throttled = throttle(fn, 300)
// Calls fn at most every 300ms
```

**When to use:**
- **Debounce**: API calls, validation, save operations
- **Throttle**: Scroll events, resize events, frequent updates

## Profiling

### React DevTools Profiler

1. Install React DevTools extension
2. Open DevTools → Profiler tab
3. Click "Record"
4. Type in editor
5. Stop recording
6. Analyze flame graph

**Look for:**
- Long render times (>16ms)
- Frequent re-renders
- Unnecessary component updates

### Chrome Performance Tab

1. Open DevTools → Performance tab
2. Click "Record"
3. Perform actions in editor
4. Stop recording
5. Analyze timeline

**Look for:**
- Long scripting time
- Layout thrashing
- Excessive repaints

### Custom Performance Monitoring

```typescript
function measurePerformance<T>(fn: () => T, label: string): T {
  const start = performance.now()
  const result = fn()
  const end = performance.now()
  console.log(`[${label}] ${(end - start).toFixed(2)}ms`)
  return result
}

// Usage
const tokens = measurePerformance(
  () => parser.parse(value),
  'Parse'
)
```

### Performance Hooks

```typescript
function usePerformanceMonitor(label: string) {
  useEffect(() => {
    const start = performance.now()
    return () => {
      const end = performance.now()
      console.log(`[${label}] Render: ${(end - start).toFixed(2)}ms`)
    }
  })
}

function MyMark() {
  usePerformanceMonitor('MyMark')
  // ... component code
}
```

## Bundle Size Optimization

### Tree Shaking

Ensure proper tree shaking:

```typescript
// ✅ Named imports (tree-shakeable)
import { MarkedInput, useMark } from 'rc-marked-input'

// ❌ Namespace import (not tree-shakeable)
import * as Markput from 'rc-marked-input'
```

### Code Splitting

Split large editors into separate chunks:

```typescript
import { lazy, Suspense } from 'react'

const AdvancedEditor = lazy(() => import('./AdvancedEditor'))

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdvancedEditor />
    </Suspense>
  )
}
```

### Dynamic Imports

Load mark components on demand:

```typescript
function App() {
  const [MarkComponent, setMarkComponent] = useState(null)

  useEffect(() => {
    import('./HeavyMark').then(module => {
      setMarkComponent(() => module.HeavyMark)
    })
  }, [])

  if (!MarkComponent) {
    return <div>Loading...</div>
  }

  return <MarkedInput Mark={MarkComponent} />
}
```

## Memory Management

### Cleanup Event Listeners

```typescript
function MyComponent() {
  useEffect(() => {
    const handler = (e) => console.log(e)
    store.bus.on(SystemEvent.Change, handler)

    return () => {
      store.bus.off(SystemEvent.Change, handler) // ✅ Cleanup
    }
  }, [])
}
```

### Avoid Memory Leaks

```typescript
// ❌ Memory leak: closure captures large object
function Editor() {
  const largeData = fetchLargeData()

  const handleChange = (value: string) => {
    console.log(largeData) // Captures largeData forever!
  }

  return <MarkedInput onChange={handleChange} />
}

// ✅ Fixed: only capture what you need
function Editor() {
  const largeData = fetchLargeData()
  const summary = largeData.summary // Small object

  const handleChange = (value: string) => {
    console.log(summary) // Only captures summary
  }

  return <MarkedInput onChange={handleChange} />
}
```

### WeakMap for Caches

```typescript
// Cache mark data without preventing GC
const markCache = new WeakMap<MarkToken, CachedData>()

function getCachedData(mark: MarkToken): CachedData {
  if (markCache.has(mark)) {
    return markCache.get(mark)!
  }

  const data = computeExpensiveData(mark)
  markCache.set(mark, data)
  return data
}
```

## Real-World Optimizations

### Optimization 1: Batch Updates

```typescript
// ❌ Multiple onChange calls
function insertMultipleMarks() {
  marks.forEach(mark => {
    const newValue = value + annotate(markup, mark)
    onChange(newValue) // Triggers re-render each time!
  })
}

// ✅ Single onChange call
function insertMultipleMarks() {
  let newValue = value
  marks.forEach(mark => {
    newValue += annotate(markup, mark)
  })
  onChange(newValue) // Single re-render
}
```

### Optimization 2: Request Deduplication

```typescript
const pendingRequests = new Map<string, Promise<any>>()

function fetchWithDedup(url: string): Promise<any> {
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url)!
  }

  const promise = fetch(url).then(r => r.json())
  pendingRequests.set(url, promise)

  promise.finally(() => {
    pendingRequests.delete(url)
  })

  return promise
}
```

### Optimization 3: Incremental Rendering

```typescript
function IncrementalEditor() {
  const [value, setValue] = useState('')
  const [rendered, setRendered] = useState('')

  useEffect(() => {
    // Render in chunks to avoid blocking
    const chunks = chunkText(value, 1000)
    let currentChunk = 0

    const timer = setInterval(() => {
      if (currentChunk < chunks.length) {
        setRendered(prev => prev + chunks[currentChunk])
        currentChunk++
      } else {
        clearInterval(timer)
      }
    }, 16) // ~60fps

    return () => clearInterval(timer)
  }, [value])

  return <MarkedInput value={rendered} />
}
```

## Performance Checklist

### ✅ Must Do

- [ ] Memoize Mark components with `memo()`
- [ ] Memoize options array with `useMemo()`
- [ ] Debounce expensive onChange operations
- [ ] Use `useCallback` for event handlers
- [ ] Clean up event listeners in `useEffect`

### ✅ Should Do

- [ ] Profile with React DevTools
- [ ] Minimize mark component complexity
- [ ] Batch API requests for mark data
- [ ] Use stable keys for rendered marks
- [ ] Implement lazy loading for heavy marks

### ✅ Consider For Large Apps

- [ ] Implement virtualization for long documents
- [ ] Use code splitting for large editors
- [ ] Implement request deduplication
- [ ] Use WeakMap for caches
- [ ] Consider Web Workers for parsing

## Performance Benchmarks

### Test Setup

```typescript
function benchmark(label: string, fn: () => void, iterations = 1000) {
  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    fn()
  }

  const end = performance.now()
  const avg = (end - start) / iterations
  console.log(`[${label}] Avg: ${avg.toFixed(3)}ms`)
}
```

### Parsing Benchmarks

```typescript
const parser = new Parser(['@[__value__](__meta__)'])

benchmark('Parse 100 chars', () => {
  parser.parse('Hello @[Alice](1) @[Bob](2)')
})

benchmark('Parse 1000 chars', () => {
  parser.parse(longText)
})
```

### Rendering Benchmarks

```typescript
benchmark('Render 10 marks', () => {
  render(
    <MarkedInput
      value={textWith10Marks}
      Mark={MyMark}
    />
  )
})
```

## Common Performance Issues

### Issue 1: Flickering on Type

**Cause:** Re-parsing on every keystroke

**Solution:** Debounce or use controlled input

### Issue 2: Slow Overlay

**Cause:** Heavy filtering/searching on every character

**Solution:** Debounce search, limit results

### Issue 3: Memory Leak

**Cause:** Event listeners not cleaned up

**Solution:** Always clean up in `useEffect`

### Issue 4: Laggy Scrolling

**Cause:** Too many DOM nodes

**Solution:** Virtualization or pagination

## Next Steps

- **[Architecture Guide](./architecture)** - System design

---
