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
  │ │       └─ <TokenChildren>      # Internal host for __slot__ child sequence
  │ │           └─ <Token mark={child}>
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
| **TokenChildren**    | Internal nested token sequence host for slot children        |
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
2. KeyboardController detects input
        ↓
3. store.dom maps the DOM selection or input target range to a raw value range
        ↓
4. KeyboardController calls store.edit.replace() for every user edit — single-range or whole-value (whole-value writes pass {start: 0, end: -1} as the sentinel and a caretAt for the post-edit caret)
        ↓
5. ValueModel updates uncontrolled state or notifies controlled parents
        ↓
6. ParseController reactively reparses — it had already subscribed to value.current; tokens update before downstream watchers fire
        ↓
7. store.parsing.tokens updated (Signal)
        ↓
8. React/Vue re-renders via the framework `useMarkput()` hook
        ↓
9. DomController applies caret.selection to the DOM after the adapter registers the new DOM
```

All user mutations go through `store.edit.replace()`: features describe the raw range (or `{start: 0, end: -1}` for whole-value writes) plus replacement text, and the edit coordinator places the post-edit caret — either at `range.start + replacement.length` or at an explicit `caretAt` argument — inside a single batch before delegating to `store.value.replace()`. Programmatic raw mutations may still call `store.value.replace()` or `store.value.current()`. `DomController` owns DOM-to-raw boundary mapping and applies `caret.selection` to the DOM after every render, while `ParseController` owns parser selection and string-to-token parsing.

### Trigger Flow (Overlay Opens)

```
1. User types trigger character (e.g., '@')
        ↓
2. OverlayController runs a trigger probe after value edits, or on `selectionchange` when `showOverlayOn` includes `selectionChange`
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
| `reparse`       | parsing        | Re-parse triggered          | `void`                           |
| `close`         | overlay        | Close overlay               | `void`                           |
| `select`        | overlay        | Overlay item selected       | `{ mark: Token, match: OverlayMatch }` |
| `rendered`      | host           | After tokens render         | `void`                           |
| `mounted`       | host           | Framework initial mount      | `void`                           |
| `unmounted`     | host           | Framework unmount           | `void`                           |
| `action`        | drag           | Drag-and-drop action        | `DragAction`                     |

`DomController.reconcile()` is a method called by reactive effects and by the post-render focus workflow; it is not a store event.

### Event Usage

```typescript
// Commit a raw value edit
store.value.replace({start: 0, end: 5}, 'hello')

// Emit a void event
store.tokens.invalidate()

// Emit a drag action event
store.block.action({ type: 'delete', index: 0 })

// Subscribe to an event
import {watch, effectScope} from '@markput/core'

const dispose = effectScope(() => {
    watch(
        store.value.current,
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
    (value: T | undefined): void  // Write value (undefined reverts to default)
}
```

Framework adapters subscribe to signals through their own `useMarkput()` hook
(see `packages/react/markput/src/lib/hooks/useMarkput.ts` and the Vue
equivalent). The hook accepts a selector that reads from the store; the
adapter wraps it in an `effect()` that tracks signal reads and notifies the
framework when any tracked signal changes:

- **React**: `useMarkput` is built on `useSyncExternalStore`; the subscribe
  function creates an `effect()` and the snapshot reads the selector
  untracked.
- **Vue**: `useMarkput` returns a `shallowRef`, drives it with `effect()`, and
  disposes on `onUnmounted`.

This is the **only framework coupling point**.

### Store Structure

```typescript
class Store {
    readonly key: KeyGenerator
    readonly blocks: BlockRegistry

    readonly props: {
        // Identity props are declared with `signal<T>({readonly: true})` — no
        // initial, so the type widens to `Signal<T | undefined>`. Default-bearing
        // props use `signal<T>({default: X, readonly: true})` so an incoming
        // `undefined` from the adapter spread reverts to the declared default.
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

    // Features live directly on store, not nested under .feature
    readonly host:      Host               // mounted/unmounted/rendered events + container HTMLElement
    readonly props:     PropsModel         // framework-provided configuration
    readonly caret:     CaretModel         // selection, position (computed), isUserSelecting, isAllSelected
    readonly slots:     SlotsFeature       // isBlock, isDragEnabled, slot component/props, mark resolver
    readonly value:     ValueModel         // current, replace()
    readonly edit:      EditController     // replace(range, replacement, caretAt?) — single batched write path
    readonly parsing:   ParseController    // tokens, parser, token index
    readonly dom:       DomController      // DOM refs, raw mapping, range placement
    readonly overlay:   OverlayController  // match, element, slot, select, close
    readonly keyboard:  KeyboardController // input, block editing, arrow navigation
    readonly drag:      DragController     // drag-and-drop action event
    readonly clipboard: ClipboardController // copy/cut handling
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

// Accepted serialized value state is owned by ValueModel.
// Route edits through raw positions.
store.value.replace({start: 0, end: 5}, 'Hello')
store.value.current('Hello @[World]')

// Framework-provided props (MarkedInput calls store.props.set on each render)
store.props.set({readOnly: true})

// Use in component (framework-specific reactive binding)
const tokens = useMarkput(s => s.parsing.tokens())
```

## Features

11 features, each declaring its dependencies as positional constructor parameters with concrete feature types. The dependency graph is acyclic — features can only depend on features constructed above them in `Store`. They never import each other directly; all cross-feature access goes through the injected constructor parameters. `MarkputHandler` and `KeyboardController` behavior modules retain the full `Store` as an adapter boundary.

Signal subscription order is significant: `ParseController` subscribes to `value.current` inside its `onMounted` hook before any other consumer registers a watcher in `onMounted`. This guarantees that when downstream listeners observe a `value.current` change, `parsing.tokens()` already reflects the new value.

| Feature                       | Responsibility                                           |
| ----------------------------- | -------------------------------------------------------- |
| **Host**                      | Adapter-fed runtime state: mount/unmount/render events and the container HTMLElement |
| **ValueModel**                | Accepted serialized value state, raw range replacement   |
| **EditController**            | Unified user edit path: `replace(range, replacement, caretAt?)`, `{end: -1}` resolves to current value length |
| **ParseController**           | Token parsing, parser selection, reparse event            |
| **OverlayController**         | Overlay trigger detection, position, open/close           |
| **SlotsFeature**              | Container ref, slot component/props resolution, mark resolver |
| **CaretModel**                | Caret range, derived location, text selection state       |
| **KeyboardController**        | Text input, block editing, arrow navigation               |
| **DomController**             | DOM registration, raw selection mapping, range placement   |
| **DragController**            | Drag-and-drop reordering of blocks                       |
| **ClipboardController**       | Clipboard copy/cut handling                              |

`KeyboardController` internally composes three modules: input handling, block editing, and arrow navigation. `CaretModel` exposes a `selection: Signal<Range | undefined>` as the single source of truth for the caret/selection position, a writable `position: Signal<number | undefined>` computed bound to `selection.start` (writes collapse the range), an `isUserSelecting: Signal<boolean>` for selection-in-progress state, and `isAllSelected: Signal<boolean>` derived from `selection` and the raw value length.

## Lifecycle Timing

React/Vue render asynchronously, so initialization order matters:

```typescript
// 1. Framework writes the container element via store.host.container(el).
//    → Each feature's onMounted callback fires with the live container element.
//      It also re-fires (with auto-disposal of the previous scope) if the
//      framework swaps to a different container.

// 2. After mount, ValueModel accepts props.value/defaultValue. ParseController
//    subscribed to value.current first inside its onMounted hook, so tokens are
//    updated before any other onMounted watcher observes the new value.

// 3. Sync contenteditable attributes (layout effect)
//    → DomController reconciles DOM state

// 4. Framework emits store.host.rendered() after tokens render

// 5. Framework writes store.host.container(null) on unmount
//    → Each onMounted scope is disposed (DOM listeners removed, watchers torn down)
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

Core owns token addresses, DOM registration, raw selection mapping, raw value mutation, and caret range placement. React and Vue render adapter-owned structural DOM and register it with core through private refs. Features communicate through `store.<name>.*`, `store.props`, and `store.dom`/`store.caret`; production code must not infer token identity from DOM child order.

### CaretModel and caretDom

Caret responsibilities are split into a stateful feature and a stateless helper
module:

- `CaretModel` (feature) owns the reactive caret/selection state — `selection`,
  `position`, `isUserSelecting`, and `isAllSelected` signals — plus document-level mouse and
  selectionchange listeners that keep the signals in sync with the browser
  selection. It is the single source of truth for DOM caret placement: writes
  to `caret.selection` are auto-applied to the DOM through an effect, and the
  same path re-runs after each `dom.indexed`. External features never move the
  caret imperatively; they write the desired range to `caret.selection`.
- `caretDom` (stateless module, exported from `@markput/core`) provides
  pure DOM helpers: `getCaretIndex`, `setAtElement`, `setAtX`, `getRect`,
  `isOnFirstLine`, `isOnLastLine`. These are used for raw DOM caret math in
  block-edit arrow navigation and overlay positioning. They do not consult
  the token index.

```typescript
import {caretDom} from '@markput/core'

const offset = caretDom.getCaretIndex(element)
caretDom.setAtElement(element, 0)
const rect = caretDom.getRect()
```

### DomController

`DomController` owns the root container signal and indexes rendered structure after each render:

- top-level token roots are discovered from the editor container or block rows;
- nested slot children are discovered from adapter-owned `TokenChildren` hosts registered through `childrenFor(path)`;
- block controls are registered through `controlFor(path)` and ignored during token indexing;
- text token roots are reconciled as editable text surfaces;
- mark roots receive focusability state.

It exposes raw boundary helpers used by keyboard, clipboard, overlay, block editing, drag, and mark commands. It also applies `caret.selection` to the DOM after every render; ranges that cannot be placed are cleared and reported through DOM diagnostics.

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

- **Signal-based**: only components subscribing through `useMarkput()` to a changed signal re-render
- **Token changes**: only affected tokens re-render (not the entire tree)
- **Overlay opens**: only the overlay component re-renders

**See also:**

- [How It Works](../introduction/how-it-works) - Understanding how Markput processes text
- [Performance](./performance) - Detailed performance analysis
