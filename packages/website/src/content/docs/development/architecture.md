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
2. KeyboardFeature detects input
        ↓
3. store.dom maps the DOM selection or input target range to a raw value range
        ↓
4. KeyboardFeature calls store.value.replaceRange() or replaceAll()
        ↓
5. ValueFeature updates uncontrolled state or records a pending controlled echo
        ↓
6. ParsingFeature reparses store.value.current()
        ↓
7. store.parsing.tokens updated (Signal)
        ↓
8. React/Vue re-renders via Signal.use()
        ↓
9. DomFeature applies pending caret recovery after the adapter registers the new DOM
```

There is one serialized value edit path for user mutations: features describe the raw range and replacement text, then `ValueFeature` schedules optional `caret.recovery`. `DomFeature` owns DOM-to-raw boundary mapping and recovery application, while `ParsingFeature` owns parser selection and string-to-token parsing.

### Trigger Flow (Overlay Opens)

```
1. User types trigger character (e.g., '@')
        ↓
2. OverlayFeature runs a trigger probe after value edits, or on `selectionchange` when `showOverlayOn` includes `selectionChange`
        ↓
3. If found:
   - store.overlay.match set
        ↓
4. Overlay component receives match via useOverlay()
        ↓
5. Overlay renders at cursor position
        ↓
6. User selects item:
   - Overlay calls select({ value, meta })
        ↓
7. store.overlay.select() emitted
        ↓
8. Markup inserted, onChange called with new text
        ↓
9. store.overlay.close() closes overlay
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

| Event           | Feature        | When Fired                  | Payload                          |
| --------------- | -------------- | --------------------------- | -------------------------------- |
| `change`        | value          | Text content changes        | `void`                           |
| `reparse`       | parsing        | Re-parse triggered          | `void`                           |
| `close`         | overlay        | Close overlay               | `void`                           |
| `select`        | overlay        | Overlay item selected       | `{ mark: Token, match: OverlayMatch }` |
| `remove`        | mark           | Mark removed                | `{ token: Token }`               |
| `rendered`      | lifecycle      | After tokens render         | `void`                           |
| `mounted`       | lifecycle      | Framework initial mount      | `void`                           |
| `unmounted`     | lifecycle      | Framework unmount           | `void`                           |
| `action`        | drag           | Drag-and-drop action        | `DragAction`                     |

`DomFeature.reconcile()` is a method called by reactive effects and by the post-render focus workflow; it is not a store event.

### Event Usage

```typescript
// Commit a raw value edit
store.value.replaceRange({start: 0, end: 5}, 'hello')

// Emit a payload event
store.mark.remove({ token })

// Emit a drag action event
store.drag.action({ type: 'delete', index: 0 })

// Subscribe to an event
import {watch, effectScope} from '@markput/core'

const dispose = effectScope(() => {
    watch(
        store.value.change,
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

    readonly props: {
        value: Signal<string | undefined>
        defaultValue: Signal<string | undefined>
        onChange: Signal<((value: string) => void) | undefined>
        options: Signal<CoreOption[]>
        readOnly: Signal<boolean>
        layout: Signal<'inline' | 'block'>
        draggable: Signal<boolean | DraggableConfig>
        showOverlayOn: Signal<OverlayTrigger>
        Span: Signal<Slot | undefined>
        Mark: Signal<Slot | undefined>
        Overlay: Signal<Slot | undefined>
        className: Signal<string | undefined>
        style: Signal<CSSProperties | undefined>
        slots: Signal<CoreSlots | undefined>
        slotProps: Signal<CoreSlotProps | undefined>
    }

    readonly feature: {
        lifecycle: LifecycleFeature    // mounted, unmounted, rendered events
        value: ValueFeature            // current, replaceRange(), replaceAll(), controlled echo
        parsing: ParsingFeature        // tokens, parser, token index, parse generation
        mark: MarkFeature              // mark slot resolution
        overlay: OverlayFeature        // match, element, slot, select, close
        slots: SlotsFeature            // container ref, isBlock, isDraggable, slot computeds
        caret: CaretFeature            // location, recovery, selecting
        keyboard: KeyboardFeature      // input, block edit, arrow nav (merged Input + BlockEdit + ArrowNav)
        dom: DomFeature                // DOM registration, raw mapping, reconciliation, recovery
        drag: DragFeature              // action event
        clipboard: ClipboardFeature    // copy/cut handling
    }
}
```

### State and props access

Internal feature state, computeds, and events live directly on `store.<name>.*`. Values and options passed from React/Vue live on `store.props` and are updated via `store.props.set()`.

```typescript
// Read internal state
store.parsing.tokens()

// Write internal state
store.parsing.tokens(newTokens)

// Batch multiple internal writes so dependents run once (same pattern features use)
import {batch} from '@markput/core'
batch(() => {
	store.parsing.tokens(newTokens)
})

// Accepted serialized value state is owned by ValueFeature.
// Route edits through raw positions.
store.value.replaceRange({start: 0, end: 5}, 'Hello')
store.value.replaceAll('Hello @[World]')

// Framework-provided props (MarkedInput calls store.props.set on each render)
store.props.set({readOnly: true})

// Use in component (framework-specific reactive binding)
const tokens = store.parsing.tokens.use()
```

## Features

11 features, each with `enable()`/`disable()`. They never import each other — all communication goes through `store.<name>.*` (internal signals), `store.props` (framework-provided signals), `store.dom` (registered DOM structure and raw mapping), and `store.caret` (location/recovery):

| Feature                       | Responsibility                                           |
| ----------------------------- | -------------------------------------------------------- |
| **LifecycleFeature**          | Mount/unmount/render lifecycle events                     |
| **ValueFeature**              | Accepted serialized value state, edit commands, change event |
| **ParsingFeature**            | Token parsing, parser selection, reparse event            |
| **MarkFeature**               | Mark slot resolution                                      |
| **OverlayFeature**            | Overlay trigger detection, position, open/close           |
| **SlotsFeature**              | Container ref, slot component/props resolution            |
| **CaretFeature**              | Caret tracking, focus recovery, text selection state      |
| **KeyboardFeature**           | Text input, block editing, arrow navigation               |
| **DomFeature**                | DOM registration, raw selection mapping, recovery         |
| **DragFeature**               | Drag-and-drop reordering of blocks                       |
| **ClipboardFeature**          | Clipboard copy/cut handling                              |

`KeyboardFeature` internally composes three modules: input handling, block editing, and arrow navigation. `CaretFeature` composes focus recovery and text selection tracking.

## Lifecycle Timing

React/Vue render asynchronously, so initialization order matters:

```typescript
// 1. Framework emits store.lifecycle.mounted() on initial mount
//    → Store enables all features (DOM listeners, reactive subscriptions)

// 2. After mount, ValueFeature accepts props.value/defaultValue and parses tokens.
//    ParsingFeature watches parser shape changes and reparses from value.current.

// 3. Sync contenteditable attributes (layout effect)
//    → DomFeature reconciles DOM state

// 4. Framework emits store.lifecycle.rendered() after tokens render

// 5. Framework emits store.lifecycle.unmounted() on unmount
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

## Core-Owned DOM And Cursor Management

Core owns token addresses, DOM registration, raw selection mapping, raw value mutation, and caret recovery. React and Vue render adapter-owned structural DOM and register it with core through private refs. Features communicate through `store.<name>.*`, `store.props`, and `store.dom`/`store.caret`; production code must not infer token identity from DOM child order.

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

### DomFeature

`DomFeature` indexes registered structure after each render:

- `container` — editor root
- `row` — block layout row
- `token` — token shell
- `text` — editable text surface for text tokens
- `slotRoot` — rendered children root for slot marks
- `control` — adapter controls such as drag handles and menus

It exposes raw boundary helpers used by keyboard, clipboard, overlay, block editing, drag, and mark commands. It also applies pending `caret.recovery` after renders; failed recovery is cleared after one attempt and reported through DOM diagnostics.

## Framework Hooks

### useMark

Available in both React and Vue. Returns a `MarkController` for the current mark token:

```typescript
const mark = useMark()
mark.update({value: 'updated'})
mark.remove()
```

Use `useMarkInfo()` for structural metadata such as `depth`, `hasNestedMarks`, `address`, and `key`.

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
