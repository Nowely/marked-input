---
title: Architecture
description: Markput internal architecture - React layer, parser engine, token renderer, store, component hierarchy and data flow
keywords: [architecture, parser engine, token renderer, React hooks, component design, data flow, system design]
---

This guide explains Markput's internal architecture, data flow, and design decisions.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        MarkedInput                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   React Layer                         │  │
│  │  • Components (MarkedInput, Suggestions)             │  │
│  │  • Hooks (useMark, useOverlay, useListener)          │  │
│  │  • Context Providers                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Core Layer                         │  │
│  │  • Parser (markup → tokens)                           │  │
│  │  • Store (state management)                           │  │
│  │  • EventBus (inter-component communication)           │  │
│  │  • Caret (cursor positioning)                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     DOM Layer                         │  │
│  │  • contenteditable container                          │  │
│  │  • Mark elements (custom components)                  │  │
│  │  • Overlay element (suggestions)                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

### React Component Tree

```
<MarkedInput>
  ├─ <StoreProvider>             # Provides store to child components
  │   ├─ <Container>             # contenteditable element
  │   │   ├─ <TextNode>          # Plain text token
  │   │   ├─ <MarkNode>          # Mark token
  │   │   │   └─ <Mark>          # User's custom Mark component
  │   │   │       └─ uses useMark() hook
  │   │   ├─ <TextNode>
  │   │   └─ <MarkNode>
  │   │       └─ <Mark>
  │   │
  │   └─ <OverlayPortal>         # Portal for overlay
  │       └─ <Overlay>           # User's custom Overlay component
  │           └─ uses useOverlay() hook
  │
  └─ Event Handlers              # Input, focus, blur, keyboard events
```

### Component Responsibilities

| Component         | Responsibility                                      |
| ----------------- | --------------------------------------------------- |
| **MarkedInput**   | Entry point, props validation, store initialization |
| **StoreProvider** | React context for store access                      |
| **Container**     | contenteditable management, event handling          |
| **TextNode**      | Renders plain text tokens                           |
| **MarkNode**      | Renders mark tokens, provides mark context          |
| **Mark**          | User's custom mark component                        |
| **OverlayPortal** | React portal for overlay positioning                |
| **Overlay**       | User's custom overlay component                     |

## Data Flow

### Input Flow (User Types)

```
1. User types in contenteditable
        ↓
2. onInput event fires
        ↓
3. Extract text from DOM
        ↓
4. Call onChange(newText)
        ↓
5. Parent updates value prop
        ↓
6. MarkedInput receives new value
        ↓
7. Parser.parse(value) → tokens
        ↓
8. Store.tokens = newTokens
        ↓
9. React re-renders with new tokens
        ↓
10. DOM updates with new marks
```

### Trigger Flow (Overlay Opens)

```
1. User types trigger character (e.g., '@')
        ↓
2. onInput event fires
        ↓
3. CheckTrigger event sent
        ↓
4. TriggerFinder.find() checks for trigger
        ↓
5. If found:
   - Store.overlayMatch = { trigger, value, ... }
   - SystemEvent.CheckTrigger sent
        ↓
6. Overlay component receives match via useOverlay()
        ↓
7. Overlay renders at cursor position
        ↓
8. User selects item:
   - Overlay calls select({ value, meta })
   - SystemEvent.Select sent
        ↓
9. Markup inserted: annotate(markup, { value, meta })
        ↓
10. onChange called with new text
```

### Selection Flow (Overlay Item Selected)

```
1. User clicks/enters on overlay item
        ↓
2. Overlay.select({ value, meta })
        ↓
3. SystemEvent.Select sent
        ↓
4. Store receives Select event
        ↓
5. Create markup: annotate(markup, { value, meta })
        ↓
6. Replace trigger span with markup
        ↓
7. Update DOM and cursor position
        ↓
8. Call onChange(newText)
        ↓
9. Close overlay (ClearTrigger event)
```

## Parsing Pipeline

### Stage 1: Text Input

```
Input: "Hello @[Alice](123) and #[react]"
```

### Stage 2: Parser Initialization

```typescript
const parser = new Parser([
    '@[__value__](__meta__)', // Mention pattern
    '#[__value__]', // Hashtag pattern
])
```

### Stage 3: Tokenization

Parser converts text into token tree:

```typescript
;[
    {
        type: 'text',
        content: 'Hello ',
        position: {start: 0, end: 6},
    },
    {
        type: 'mark',
        content: '@[Alice](123)',
        position: {start: 6, end: 19},
        value: 'Alice',
        meta: '123',
        descriptor: {index: 0, markup: '@[__value__](__meta__)'},
        children: [],
    },
    {
        type: 'text',
        content: ' and ',
        position: {start: 19, end: 24},
    },
    {
        type: 'mark',
        content: '#[react]',
        position: {start: 24, end: 32},
        value: 'react',
        descriptor: {index: 1, markup: '#[__value__]'},
        children: [],
    },
]
```

### Stage 4: React Rendering

Each token renders as React component:

```jsx
<Container>
    <TextNode>Hello </TextNode>
    <MarkNode>
        <MentionMark value="Alice" meta="123" />
    </MarkNode>
    <TextNode> and </TextNode>
    <MarkNode>
        <HashtagMark value="react" />
    </MarkNode>
</Container>
```

### Nested Parsing

For nested marks like `**bold @[mention]**`:

```
1. Parse outer mark: **__nested__**
   ↓
2. Extract nested content: "bold @[mention]"
   ↓
3. Recursively parse nested content
   ↓
4. Build token tree:
   {
     type: 'mark',
     nested: { content: 'bold @[mention]', ... },
     children: [
       { type: 'text', content: 'bold ' },
       { type: 'mark', value: 'mention', ... }
     ]
   }
```

## Event System

### Event Bus Architecture

```typescript
class EventBus {
    private listeners = new Map<EventKey, Set<Function>>()

    on(event: EventKey, handler: Function): void
    off(event: EventKey, handler: Function): void
    send(event: EventKey, data?: any): void
}
```

### System Events

| Event           | When Fired                | Payload             |
| --------------- | ------------------------- | ------------------- |
| `STORE_UPDATED` | Store state changes       | Updated store       |
| `Change`        | Text content changes      | `{ value: string }` |
| `Parse`         | Parsing triggered         | -                   |
| `CheckTrigger`  | Check for overlay trigger | -                   |
| `ClearTrigger`  | Close overlay             | -                   |
| `Select`        | Overlay item selected     | `{ mark, match }`   |
| `Delete`        | Mark deleted              | `{ token }`         |

### Event Flow Example

```typescript
// Component sends event
store.bus.send(SystemEvent.Change, {value: 'new text'})

// Multiple listeners can subscribe
store.bus.on(SystemEvent.Change, data => {
    console.log('Text changed:', data.value)
})

store.bus.on(SystemEvent.Change, data => {
    saveToLocalStorage(data.value)
})

// Clean up when done
store.bus.off(SystemEvent.Change, handler)
```

## State Management

### Store Structure

```typescript
class Store {
    // Configuration
    props: MarkedInputProps

    // Document state
    tokens: Token[]
    parser: Parser
    previousValue?: string

    // UI state
    refs: {
        container: HTMLDivElement | null
        overlay: HTMLElement | null
    }
    selecting?: boolean

    // Overlay state
    overlayMatch?: OverlayMatch

    // Navigation
    nodes: {
        focus: NodeProxy
        input: NodeProxy
    }
    recovery?: Recovery

    // Event system
    bus: EventBus
    key: KeyGenerator
}
```

### State Updates

Store uses Proxy pattern for reactive updates:

```typescript
const store = new Proxy(new Store(props), {
    set(target, prop, value) {
        if (IMMUTABLE_KEYS.has(prop)) {
            return false // Prevent mutation of immutable properties
        }

        if (target[prop] === value) {
            return true // No change, skip update
        }

        target[prop] = value
        target.bus.send(SystemEvent.STORE_UPDATED, store)
        return true
    },
})
```

### State Access in React

```typescript
// Via hook
const store = useStore()

// Via selector (for performance)
const tokens = useStore(store => store.tokens)
const overlayMatch = useStore(store => store.overlayMatch)
```

## Re-render Optimization

### Token Memoization

Tokens are memoized to prevent unnecessary re-parsing:

```typescript
const tokens = useMemo(() => {
    return parser.parse(value)
}, [value, parser])
```

### Mark Component Memoization

Each mark component is wrapped with React.memo:

```typescript
const MemoizedMark = memo(({ value, meta }) => {
  return <span>{value}</span>
})
```

### Selective Re-rendering

Only changed tokens trigger re-renders:

```typescript
function TokenRenderer({ tokens }) {
  return tokens.map((token, index) => (
    <MemoizedToken
      key={token.position.start} // Stable key prevents re-mount
      token={token}
    />
  ))
}
```

### Store Selectors

Use selectors to subscribe to specific state:

```typescript
// ❌ Re-renders on ANY store change
const store = useStore()

// ✅ Only re-renders when tokens change
const tokens = useStore(store => store.tokens)

// ✅ Only re-renders when overlay state changes
const overlayMatch = useStore(store => store.overlayMatch)
```

## Cursor Management

### Caret Position

Cursor position is managed through:

1. **Before change**: Save current cursor position
2. **After change**: Restore cursor to correct position

```typescript
class Caret {
    static save(): Recovery {
        const selection = window.getSelection()
        // Save range, offset, etc.
    }

    static restore(recovery: Recovery): void {
        // Restore cursor to saved position
    }

    static getAbsolutePosition(): {left: number; top: number} {
        // Get cursor coordinates for overlay
    }
}
```

### Cursor Restoration

After DOM updates, cursor must be restored:

```typescript
function handleInput() {
    const recovery = Caret.save() // 1. Save cursor
    const newText = extractText(dom) // 2. Get new text
    onChange(newText) // 3. Update value (triggers re-render)

    // After re-render:
    useEffect(() => {
        Caret.restore(recovery) // 4. Restore cursor
    })
}
```

## contenteditable Management

### DOM Structure

```html
<div contenteditable="true" class="marked-input">
    <span>Hello </span>
    <span data-mark="mention">
        <MentionMark value="Alice" />
    </span>
    <span> and </span>
    <span data-mark="hashtag">
        <HashtagMark value="react" />
    </span>
</div>
```

### Text Extraction

Extract plain text from DOM, preserving marks:

```typescript
function extractText(element: HTMLElement): string {
    let text = ''

    for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement
            if (el.dataset.mark) {
                // Extract mark syntax from data attributes
                text += el.dataset.markup || ''
            } else {
                text += extractText(el) // Recurse
            }
        }
    }

    return text
}
```

### Mark Synchronization

Ensure DOM marks match token tree:

```typescript
function syncDOMWithTokens(container: HTMLElement, tokens: Token[]) {
    // 1. Build new DOM tree from tokens
    const newDOM = tokensToDOM(tokens)

    // 2. Diff with current DOM
    const patches = diff(container.childNodes, newDOM)

    // 3. Apply minimal patches
    applyPatches(container, patches)
}
```

## Performance Characteristics

### Parsing Performance

| Text Length   | Parse Time | Notes                 |
| ------------- | ---------- | --------------------- |
| 100 chars     | ~0.1ms     | Very fast             |
| 1,000 chars   | ~1ms       | Fast                  |
| 10,000 chars  | ~10ms      | Acceptable            |
| 100,000 chars | ~100ms     | Consider optimization |

### Re-render Performance

With proper memoization:

- **Token changes**: Only changed tokens re-render
- **Overlay opens**: Only overlay component re-renders
- **Store updates**: Only components using affected state re-render

### Memory Usage

Typical memory footprint:

- **Parser**: ~100KB (markup registry, matcher caches)
- **Store**: ~10KB (state objects)
- **Tokens**: ~100 bytes per token
- **React components**: ~50 bytes per mark

## Design Patterns

### Separation of Concerns

```
┌─────────────────┐
│  React Layer    │  UI components, hooks, context
├─────────────────┤
│  Core Layer     │  Parser, Store, EventBus
├─────────────────┤
│  DOM Layer      │  contenteditable, native events
└─────────────────┘
```

### Inversion of Control

User provides custom components:

```typescript
<MarkedInput
  Mark={UserMark}        // User controls mark rendering
  Overlay={UserOverlay}  // User controls overlay rendering
/>
```

### Observer Pattern

Event bus implements pub/sub:

```typescript
bus.on(event, handler) // Subscribe
bus.send(event, data) // Publish
bus.off(event, handler) // Unsubscribe
```

### Proxy Pattern

Store uses Proxy for reactive updates:

```typescript
const store = new Proxy(new Store(), {set})
```

## Extensibility Points

### 1. Custom Mark Components

Replace default mark rendering:

```typescript
const CustomMark: FC<MarkProps> = ({ value }) => (
  <button>{value}</button>
)

<MarkedInput Mark={CustomMark} />
```

### 2. Custom Overlay

Replace autocomplete UI:

```typescript
const CustomOverlay: FC = () => {
  const { match } = useOverlay()
  return <MyCustomSuggestions query={match.value} />
}

<MarkedInput Overlay={CustomOverlay} />
```

### 3. Custom Slots

Replace internal components:

```typescript
<MarkedInput
  slots={{
    container: MyCustomContainer,
    span: MyCustomSpan
  }}
/>
```

### 4. Event Listeners

Hook into system events:

```typescript
useListener('change', data => {
    console.log('Changed:', data)
})
```

## Common Architectural Patterns

### Pattern: Controlled Component

```typescript
function App() {
  const [value, setValue] = useState('')

  return (
    <MarkedInput
      value={value}           // Parent controls state
      onChange={setValue}     // Parent receives updates
      Mark={MyMark}
    />
  )
}
```

### Pattern: Uncontrolled Component

```typescript
function App() {
  return (
    <MarkedInput
      defaultValue="Initial"  // Component manages state
      Mark={MyMark}
    />
  )
}
```

### Pattern: Compound Components

```typescript
<MarkedInput Mark={MyMark}>
  {/* Future: Allow children for toolbars, etc. */}
</MarkedInput>
```

## Debugging Architecture

### Inspect Store

```typescript
// In React DevTools console
const store = useStore()
console.log('Store:', store)
console.log('Tokens:', store.tokens)
console.log('Overlay:', store.overlayMatch)
```

### Monitor Events

```typescript
// Log all events
const events = [SystemEvent.STORE_UPDATED, SystemEvent.Change, SystemEvent.CheckTrigger, SystemEvent.Select]

events.forEach(event => {
    store.bus.on(event, data => {
        console.log(`[Event] ${event.description}`, data)
    })
})
```

### Visualize Token Tree

```typescript
function printTokenTree(tokens: Token[], indent = 0) {
    tokens.forEach(token => {
        const prefix = '  '.repeat(indent)
        if (token.type === 'text') {
            console.log(`${prefix}Text: "${token.content}"`)
        } else {
            console.log(`${prefix}Mark: ${token.value}`)
            printTokenTree(token.children, indent + 1)
        }
    })
}
```

**See also:**

- [How It Works](../introduction/how-it-works) - Understanding how Markput processes text
