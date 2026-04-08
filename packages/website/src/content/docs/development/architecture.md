---
title: Architecture
description: Markput internal architecture - core layer, parser engine, token renderer, store, component hierarchy and data flow
keywords: [architecture, parser engine, token renderer, hooks, component design, data flow, system design]
---

This guide explains Markput's internal architecture, data flow, and design decisions.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Markput                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Framework Layer (React / Vue)             │  │
│  │  • Components (MarkedInput, Container, Token, Block)  │  │
│  │  • Hooks (useMark, useOverlay, useStore)              │  │
│  │  • Context Providers (StoreContext)                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Core Layer                         │  │
│  │  • Parser (markup → tokens)                           │  │
│  │  • Store (state + events + controllers)               │  │
│  │  • Signals (framework-agnostic reactivity)            │  │
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

### Component Tree (React & Vue)

Both framework adapters share the same component structure:

```
<MarkedInput>                        # Root: creates Store, provides context
  <Container>                        # contenteditable element
  │ ├─ (drag=false)
  │ │   └─ <Token mark={t} />       # Unified renderer for text & mark tokens
  │ │       └─ <Token mark={child}> # Recursive for __slot__ children
  │ │
  │ └─ (drag=true)
  │     └─ <Block token={t}>        # Drag-mode wrapper per token
  │         ├─ <DropIndicator position="before" />
  │         ├─ <DragHandle />
  │         ├─ <Token mark={t} />
  │         ├─ <DropIndicator position="after" />
  │         └─ <BlockMenu />
  │
  <OverlayRenderer>                  # Portal for overlay
      └─ <Overlay />                 # User's custom Overlay component
```

### Component Responsibilities

| Component            | Responsibility                                               |
| -------------------- | ------------------------------------------------------------ |
| **MarkedInput**      | Entry point, store initialization, lifecycle management      |
| **Container**        | contenteditable management, renders tokens or blocks         |
| **Token**            | Unified renderer for both text and mark tokens (recursive)   |
| **Block**            | Drag-mode wrapper with handle, menu, and drop indicators     |
| **DragHandle**       | Drag grip UI element                                         |
| **BlockMenu**        | Context menu for block operations (add, delete, duplicate)   |
| **DropIndicator**    | Visual drop target indicator during drag                     |
| **OverlayRenderer**  | Portal renderer for overlay component                        |
| **Span**             | Default text span renderer                                   |

## Data Flow

### Input Flow (User Types)

```
1. User types in contenteditable
        ↓
2. ContentEditableController detects input
        ↓
3. store.events.change() emitted
        ↓
4. SystemListenerController reads DOM, mutates focused token in-place
        ↓
5. store.events.parse() emitted
        ↓
6. getTokensByUI() re-parses that token's content
        ↓
7. store.state.tokens updated (Signal)
        ↓
8. React/Vue re-renders via Signal.use()
        ↓
9. FocusController.recover() restores caret position
```

There are **two parse paths**: `getTokensByUI` (user editing — re-parses only the focused element) and `getTokensByValue` (prop change — diffs old vs new value, re-parses changed range).

### Trigger Flow (Overlay Opens)

```
1. User types trigger character (e.g., '@')
        ↓
2. store.events.checkOverlay() emitted
        ↓
3. OverlayController checks for trigger match
        ↓
4. If found:
   - store.state.overlayMatch set
        ↓
5. Overlay component receives match via useOverlay()
        ↓
6. Overlay renders at cursor position
        ↓
7. User selects item:
   - Overlay calls select({ value, meta })
        ↓
8. store.events.select() emitted
        ↓
9. Markup inserted, onChange called with new text
        ↓
10. store.events.clearOverlay() closes overlay
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
    '#[__value__]',           // Hashtag pattern
])
```

### Stage 3: Tokenization (3-stage pipeline)

1. **SegmentMatcher** — finds all opening/closing bracket positions
2. **PatternMatcher** — groups segments into complete markup matches, resolves nesting
3. **TreeBuilder** — single-pass algorithm builds nested token tree using a parent stack for `__slot__` content

Tokens carry `descriptor.index` pointing back to which option/markup created them.

```typescript
[
    { type: 'text', content: 'Hello ' },
    {
        type: 'mark',
        content: '@[Alice](123)',
        value: 'Alice',
        meta: '123',
        descriptor: { index: 0, markup: '@[__value__](__meta__)' },
        children: [],
    },
    { type: 'text', content: ' and ' },
    {
        type: 'mark',
        content: '#[react]',
        value: 'react',
        descriptor: { index: 1, markup: '#[__value__]' },
        children: [],
    },
]
```

### Stage 4: Rendering

Each token renders via the unified `Token` component:

```jsx
<Container>
    <Token mark={textToken} />   {/* renders as <span> */}
    <Token mark={markToken} />   {/* renders user's Mark component */}
    <Token mark={textToken} />
    <Token mark={markToken} />
</Container>
```

### Nested Parsing

For nested marks like `**bold @[mention]**`:

```
1. Parse outer mark: **__slot__**
   ↓
2. Extract nested content: "bold @[mention]"
   ↓
3. Recursively parse nested content
   ↓
4. Build token tree with children:
   {
     type: 'mark',
     children: [
       { type: 'text', content: 'bold ' },
       { type: 'mark', value: 'mention', ... }
     ]
   }
```

## Event System

### Emitter Architecture

Events use `defineEvents()` which creates typed emitters using reactive signals:

- **`VoidEvent`** — callable with no arguments; subscribable via `watch(() => event(), fn)`
- **`PayloadEvent<T>`** — callable with a payload to emit, or with no arguments to read the last payload inside a reactive context

### Store Events

| Event           | When Fired                  | Payload                          |
| --------------- | --------------------------- | -------------------------------- |
| `change`        | Text content changes        | `void`                           |
| `parse`         | Parsing triggered           | `void`                           |
| `checkOverlay`  | Check for overlay trigger   | `void`                           |
| `clearOverlay`  | Close overlay               | `void`                           |
| `select`        | Overlay item selected       | `{ mark: Token, match: OverlayMatch }` |
| `delete`        | Mark deleted                | `{ token: Token }`               |

### Event Usage

```typescript
// Emit a void event
store.events.change()

// Emit a payload event
store.events.delete({ token })

// Subscribe inside an effectScope (cleanup is automatic when scope disposes)
import {watch, effectScope} from '@markput/core'

const dispose = effectScope(() => {
    watch(
        () => store.events.change(),
        () => {
            console.log('Text changed')
        }
    )
})

// Clean up all subscriptions in the scope
dispose()
```

## State Management

### Reactive Signals

State is managed through `defineState()` with explicit initial keys. Each property is a `Signal<T>`:

```typescript
export interface Signal<T> {
    (): T                 // Read value (also tracks as reactive dependency)
    (value: T): void      // Write value
    get(): T              // Alias for read
    set(value: T): void   // Alias for write
    use(): T              // Framework-specific reactive hook (React/Vue)
}
```

The framework adapter calls `setUseHookFactory()` once at module load (in `createUseHook.ts`) to register a framework-specific subscriber:
- **React**: `use()` calls `useSyncExternalStore`; the subscribe function creates an `effect()` that tracks the signal and calls the store callback on change
- **Vue**: `use()` creates a `shallowRef`, drives it with `effect()`, and disposes on `onUnmounted`

This is the **only framework coupling point**.

### Store Structure

```typescript
class Store {
    readonly key: KeyGenerator
    readonly blocks: BlockRegistry

    readonly nodes: {
        focus: NodeProxy
        input: NodeProxy
    }

    readonly state: StateObject<MarkputState>
    // Properties: tokens, parser, previousValue, recovery, selecting,
    // overlayMatch, value, defaultValue, onChange, readOnly, options,
    // showOverlayOn, Span, Mark, Overlay, className, style, slots,
    // slotProps, drag

    readonly slot: {
        container: { use(): readonly [Component, SlotProps] }
        block: { use(): readonly [Component, SlotProps] }
        span: { use(): readonly [Component, SlotProps] }
    }

    readonly events: {
        change: Emitter<void>
        parse: Emitter<void>
        delete: Emitter<{ token: Token }>
        select: Emitter<{ mark: Token; match: OverlayMatch }>
        clearOverlay: Emitter<void>
        checkOverlay: Emitter<void>
    }

    readonly refs: {
        container: HTMLDivElement | null
        overlay: HTMLElement | null
    }

    readonly controllers: {
        overlay: OverlayController
        focus: FocusController
        keydown: KeyDownController
        system: SystemListenerController
        textSelection: TextSelectionController
        contentEditable: ContentEditableController
        drag: DragController
    }

    readonly lifecycle: Lifecycle
}
```

### State Access

```typescript
// Read state
store.state.tokens.get()

// Write state
store.state.tokens.set(newTokens)

// Batch update
store.state.set({ tokens: newTokens, readOnly: true })

// Use in component (framework-specific reactive binding)
const tokens = store.state.tokens.use()
```

## Controllers

7 controllers, each with `enable()`/`disable()`. They never import each other — all communication goes through `store.state` (signals), `store.events` (emitters), and `store.nodes` (DOM refs):

| Controller                    | Responsibility                                           |
| ----------------------------- | -------------------------------------------------------- |
| **FocusController**           | Caret tracking, focus recovery after re-renders          |
| **KeyDownController**         | Keyboard event handling, navigation between tokens       |
| **OverlayController**         | Overlay trigger detection, position, open/close          |
| **TextSelectionController**   | Text selection state tracking                            |
| **SystemListenerController**  | DOM mutation detection, token content synchronization    |
| **ContentEditableController** | contenteditable attribute management                     |
| **DragController**            | Drag-and-drop reordering of blocks                       |

Managed by `FeatureManager`, which allows selective feature activation.

## Lifecycle Timing

React/Vue render asynchronously, so initialization order matters:

```typescript
// 1. Enable controllers and event subscriptions
lifecycle.enable()

// 2. Sync parser with value/options (layout effect)
lifecycle.syncParser(value, options)

// 3. Sync contenteditable attributes (layout effect)
contentEditable.sync()

// 4. Recover focus after DOM commits (effect)
lifecycle.recoverFocus()
```

## Block System (Drag Mode)

Normal mode: tokens render inline as alternating `[text, mark, text, ...]`.

Drag mode (`drag={true}`): each token is wrapped in a `<Block>` component with:
- `DragHandle` — grip for initiating drag
- `DropIndicator` — visual feedback for drop position (before/after)
- `BlockMenu` — context menu (add, delete, duplicate)

`BlockRegistry` (WeakMap keyed by token) stores per-token UI state via `BlockStore`:

```typescript
interface BlockState {
    isHovered: boolean
    isDragging: boolean
    dropPosition: 'before' | 'after' | null
    menuOpen: boolean
    menuPosition: { top: number; left: number }
}
```

WeakMap keys mean garbage collection frees state when tokens are deleted.

## Cursor Management

### Caret Class

Static helpers for cursor/selection positioning in contenteditable:

```typescript
class Caret {
    // Selection queries
    static get isSelectedPosition(): boolean
    static getCurrentPosition(): number
    static getSelectedNode(): Node

    // Position calculations
    static getAbsolutePosition(): { left: number; top: number }
    static getCaretRect(): DOMRect | null
    static isCaretOnFirstLine(element: HTMLElement): boolean
    static isCaretOnLastLine(element: HTMLElement): boolean

    // Caret positioning
    static setAtX(element: HTMLElement, x: number, y?: number): void
    static setIndex(element: HTMLElement, offset: number): void
    static setCaretToEnd(element: HTMLElement | null | undefined): void

    // Index helpers
    static getCaretIndex(element: HTMLElement): number
    static getIndex(): number
}
```

### NodeProxy — Stateful DOM Navigation

Wraps an HTMLElement with navigation helpers:
- `.next` / `.prev` — sibling navigation
- `.isSpan` / `.isMark` — even/odd index check
- `.caret` — caret position
- `.head` / `.tail` — container bounds

## Framework Hooks

### useMark

Available in both React and Vue. Provides access to the current mark token:

```typescript
const { ref } = useMark<HTMLDivElement>({ controlled: false })
```

### useOverlay

Available in both React and Vue. Provides overlay state and actions:

```typescript
const { style, close, select, match, ref } = useOverlay()
```

| Property | Type                                     | Description                    |
| -------- | ---------------------------------------- | ------------------------------ |
| `style`  | `{ left, top }`                          | Positioning coordinates        |
| `close`  | `() => void`                             | Close the overlay              |
| `select` | `(value: { value, meta? }) => void`      | Select an overlay item         |
| `match`  | `OverlayMatch`                           | Current trigger match          |
| `ref`    | `RefObject<HTMLElement>`                  | Ref to attach to overlay DOM   |

### useStore

Returns the Store instance from context:

```typescript
const store = useStore()
```

## Extensibility Points

### 1. Custom Mark Components

```typescript
<MarkedInput Mark={CustomMark} />
```

### 2. Custom Overlay

```typescript
<MarkedInput Overlay={CustomOverlay} />
```

### 3. Custom Slots

Replace internal rendering components:

```typescript
<MarkedInput
  slots={{
    container: MyCustomContainer,
    span: MyCustomSpan,
    block: MyCustomBlock,       // drag mode only
  }}
/>
```

## Common Architectural Patterns

### Pattern: Controlled Component

```typescript
function App() {
  const [value, setValue] = useState('')

  return (
    <MarkedInput
      value={value}
      onChange={setValue}
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
      defaultValue="Initial"
      Mark={MyMark}
    />
  )
}
```

### Pattern: Drag Mode

```typescript
function App() {
  return (
    <MarkedInput
      drag={true}
      Mark={MyMark}
    />
  )
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

### Re-render Optimization

- **Signal-based**: only components that call `.use()` on a changed signal re-render
- **Token changes**: only affected tokens re-render (not the entire tree)
- **Overlay opens**: only the overlay component re-renders

**See also:**

- [How It Works](../introduction/how-it-works) - Understanding how Markput processes text
- [Performance](./performance) - Detailed performance analysis
