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
│  │  • Store (state + events + features)                  │  │
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
| **MarkedInput**      | Entry point, store initialization, mount/unmount signaling    |
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
2. ContentEditableFeature detects input
        ↓
3. store.event.change() emitted
        ↓
4. SystemListenerFeature reads DOM, mutates focused token in-place
        ↓
5. store.event.reparse() emitted
        ↓
6. getTokensByUI() re-parses that token's content
        ↓
7. store.state.tokens updated (Signal)
        ↓
8. React/Vue re-renders via Signal.use()
        ↓
9. FocusFeature restores caret position internally after render
```

There are **two parse paths**: `getTokensByUI` (user editing — re-parses only the focused element) and `computeTokensFromValue` (prop change — diffs old vs new value, re-parses changed range).

### Trigger Flow (Overlay Opens)

```
1. User types trigger character (e.g., '@')
        ↓
2. OverlayFeature runs a trigger probe (on `store.event.change()`, or on `selectionchange` when `showOverlayOn` includes `selectionChange`)
        ↓
3. If found:
   - store.state.overlayMatch set
        ↓
4. Overlay component receives match via useOverlay()
        ↓
5. Overlay renders at cursor position
        ↓
6. User selects item:
   - Overlay calls select({ value, meta })
        ↓
7. store.event.select() emitted
        ↓
8. Markup inserted, onChange called with new text
        ↓
9. store.event.clearOverlay() closes overlay
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

Events use `event<T>()` to create typed emitters backed by reactive signals:

- **`Event<T>`** — call `event(payload)` to fire; use `event.read()` to read/subscribe; subscribable via `watch(event, fn)`

### Store Events

| Event           | When Fired                  | Payload                          |
| --------------- | --------------------------- | -------------------------------- |
| `change`        | Text content changes        | `void`                           |
| `reparse`       | Re-parse triggered          | `void`                           |
| `clearOverlay`  | Close overlay               | `void`                           |
| `select`        | Overlay item selected       | `{ mark: Token, match: OverlayMatch }` |
| `delete`        | Mark deleted                | `{ token: Token }`               |
| `sync`          | Post-render DOM alignment   | `void`                           |
| `afterTokensRendered` | After tokens render  | `void`                           |
| `mounted`       | Framework initial mount      | `void`                           |
| `unmounted`     | Framework unmount           | `void`                           |
| `dragAction`    | Drag-and-drop action        | `{ type: string, token: Token }` |

### Event Usage

```typescript
// Emit a void event
store.event.change()

// Emit a payload event
store.event.delete({ token })

// Subscribe to an event
import {watch, effectScope} from '@markput/core'

const dispose = effectScope(() => {
    watch(
        store.event.change,
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

State is managed through direct signal declarations. Each property is a `Signal<T>`:

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
- **React**: `use()` calls `useSyncExternalStore`; the subscribe function creates an `effect()` that tracks the signal and calls the notify callback on each re-run
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
    // Properties: tokens, previousValue, recovery, selecting,
    // overlayMatch, value, defaultValue, onChange, readOnly, options,
    // showOverlayOn, Span, Mark, Overlay, className, style, slots,
    // slotProps, drag, container, overlay

    readonly computed: {
        hasMark: Computed<boolean>
        parser: Computed<Parser | undefined>
        containerComponent: Computed<Component>
        containerProps: Computed<SlotProps | undefined>
        blockComponent: Computed<Component>
        blockProps: Computed<SlotProps | undefined>
        spanComponent: Computed<Component>
        spanProps: Computed<SlotProps | undefined>
    }

    readonly event: {
        change: Event<void>
        reparse: Event<void>
        delete: Event<{ token: Token }>
        select: Event<{ mark: Token; match: OverlayMatch }>
        clearOverlay: Event<void>
        sync: Event<void>
        dragAction: Event<{ type: string; token: Token }>
        afterTokensRendered: Event<void>
        mounted: Event<void>
        unmounted: Event<void>
    }

    readonly features: {
        input: InputFeature
        blockEdit: BlockEditFeature
        arrowNav: ArrowNavFeature
        overlay: OverlayFeature
        focus: FocusFeature
        system: SystemListenerFeature
        textSelection: TextSelectionFeature
        contentEditable: ContentEditableFeature
        drag: DragFeature
        copy: CopyFeature
    }
}
```

### State and props access

Internal feature state lives on `store.state`. Values and options passed from React/Vue live on `store.props` and are updated via `setProps()`.

```typescript
// Read internal state
store.state.tokens()

// Write internal state
store.state.tokens(newTokens)

// Batch multiple internal writes so dependents run once (same pattern features use)
import {batch} from '@markput/core'
batch(() => {
	store.state.tokens(newTokens)
	store.state.previousValue(serialized)
})

// Framework-provided props (MarkedInput calls setProps on each render)
store.setProps({readOnly: true})

// Use in component (framework-specific reactive binding)
const tokens = store.state.tokens.use()
```

## Features

10 features, each with `enable()`/`disable()`. They never import each other — all communication goes through `store.state` (internal signals), `store.props` (framework-provided signals), `store.event` (emitters), and `store.nodes` (DOM refs):

| Feature                       | Responsibility                                           |
| ----------------------------- | -------------------------------------------------------- |
| **InputFeature**              | Handles text input events, character insertion           |
| **BlockEditFeature**          | Block-level editing operations (delete, split, merge)    |
| **ArrowNavFeature**           | Keyboard navigation between tokens                       |
| **FocusFeature**              | Caret tracking, focus recovery after re-renders          |
| **OverlayFeature**            | Overlay trigger detection, position, open/close          |
| **TextSelectionFeature**      | Text selection state tracking                            |
| **SystemListenerFeature**     | DOM mutation detection, token content synchronization    |
| **ContentEditableFeature**    | contenteditable attribute management                     |
| **DragFeature**               | Drag-and-drop reordering of blocks                       |
| **CopyFeature**               | Clipboard copy/cut handling                              |

The original `KeyDownController` was decomposed into three focused features: `InputFeature` (text input handling), `BlockEditFeature` (block editing operations), and `ArrowNavFeature` (keyboard navigation).

## Lifecycle Timing

React/Vue render asynchronously, so initialization order matters:

```typescript
// 1. Framework emits store.event.mounted() on initial mount
//    → Store enables all features (DOM listeners, reactive subscriptions)

// 2. After mount, ParseFeature reactively watches [props.value, computed.parser]
//    → emits store.event.reparse() when either changes

// 3. Sync contenteditable attributes (layout effect)
//    → ContentEditableFeature.sync()

// 4. Framework emits store.event.afterTokensRendered() after tokens render

// 5. Framework emits store.event.unmounted() on unmount
//    → Store disables all features (cleanup DOM listeners, dispose scopes)
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
