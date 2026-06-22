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
3. store.selection.readRaw() maps the DOM selection or input target range to a raw value range
        ↓
4. KeyboardController calls store.edit.replace() for every user edit — single-range or whole-value (whole-value writes pass {start: 0, end: -1} as the sentinel and a caretAt for the post-edit caret)
        ↓
5. ValueModel updates uncontrolled state or notifies controlled parents
        ↓
6. TokenModel reactively reparses and reconciles — it had already subscribed to value.current; the commit pipeline routes to the text path (DOM patch, no re-render) or the structural path (publish new tree reference)
        ↓
7. On the structural path: React/Vue re-renders via the framework `useMarkput()` hook (tree reference changed); on the text path, no re-render fires
        ↓
8. SelectionController applies selection.range to the DOM after the adapter registers the new DOM
```

All user mutations go through `store.edit.replace()`: features describe the raw range (or `{start: 0, end: -1}` for whole-value writes) plus replacement text, and the edit coordinator places the post-edit caret — either at `range.start + replacement.length` or at an explicit `caretAt` argument — inside a single batch before delegating to `store.value.replace()`. Programmatic raw mutations may still call `store.value.replace()` or `store.value.current()`. DOM-to-raw boundary mapping lives in `store.tokens` (`boundaryFor`, `selection()`); `SelectionController` re-applies `selection.range` to the DOM on `tokens.changed` (and on `range` writes). `TokenModel` owns the token parse, the live node map, and all DOM↔model operations.

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
7. store.overlay.choose(value, meta) annotates and replaces the trigger range
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

| Event           | Feature        | When Fired                  | Payload                                  |
| --------------- | -------------- | --------------------------- | ---------------------------------------- |
| `close`         | overlay        | Close overlay               | `void`                                   |
| `rendered`      | host           | After each component render  | `void`                                  |
| `action`        | drag           | Drag-and-drop action        | `{type, ...}` (internal `DragAction`)    |

Re-parsing is not a store event: it is the private `TokenModel.#reparse`, driven by a single `watch` over the `(value, parser, isBlock)` tuple in the `TokenModel` constructor. Mount/unmount is not an event either: the adapter writes the `host.container` signal, and `host.onMounted(setup)` runs `setup` (with auto-disposal) whenever a container attaches, swaps, or detaches. `TokenModel.setEditable()` (called by `SelectionController`) and the internal `host.rendered` watcher are reactive effect hooks, not store events.

### Event Usage

```typescript
// Commit a raw value edit
store.value.replace({start: 0, end: 5}, 'hello')

// Read the latest reconciled token tree
store.tokens.current()

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
    readonly host:      Host               // rendered event + container signal + onMounted lifecycle
    readonly props:     PropsModel         // framework-provided configuration
    readonly selection: SelectionController // selection range, isUserSelecting, isAllSelected
    readonly slots:     SlotsFeature       // isBlock, isDragEnabled, slot component/props, mark resolver
    readonly value:     ValueModel         // current, replace()
    readonly edit:      EditController     // replace(range, replacement, caretAt?) — single batched write path
    readonly tokens:    TokenModel         // parsing, live node map, DOM↔model facade, ref registries, caret/selection DOM ops
    readonly overlay:   OverlayController  // match, element, slot, select, close
    readonly keyboard:  KeyboardController // input, block editing, arrow navigation
    readonly block:     BlockController    // block drag actions and operation helpers
    readonly clipboard: ClipboardController // copy/cut handling
}
```

### State and props access

Internal feature state, computeds, and events live directly on `store.<name>.*`. Values and options passed from React/Vue live on `store.props` and are updated via `store.props.set()`.

```typescript
// Read the latest reconciled token tree (readonly Token[])
store.tokens.current()

// Accepted serialized value state is owned by ValueModel.
// Route edits through raw positions.
store.value.replace({start: 0, end: 5}, 'Hello')
store.value.current('Hello @[World]')

// Framework-provided props (MarkedInput calls store.props.set on each render)
store.props.set({readOnly: true})

// Use in component (framework-specific reactive binding). renderTree is the
// adapter-only renderer signal — its reference changes ⇔ the renderer must run.
const tokens = useMarkput(s => s.tokens.renderTree)
```

## Features

11 features, each declaring its dependencies as positional constructor parameters with concrete feature types. The dependency graph is acyclic — features can only depend on features constructed above them in `Store`. They never import each other directly; all cross-feature access goes through the injected constructor parameters. `MarkputHandler` and `KeyboardController` behavior modules retain the full `Store` as an adapter boundary.

Signal subscription order is significant: inside its constructor `onMounted` hook, `TokenModel` registers a single `watch` over the `(value, parser, isBlock)` tuple before any other consumer registers a watcher in `onMounted`. When any of the three changes, the watch callback runs the private `#reparse`, so by the time downstream listeners observe a `value.current` change, `tokens.current()` already reflects the new value.

| Feature                       | Responsibility                                           |
| ----------------------------- | -------------------------------------------------------- |
| **Host**                      | Adapter-fed runtime state: the rendered event and the container HTMLElement |
| **ValueModel**                | Accepted serialized value state, raw range replacement   |
| **EditController**            | Unified user edit path: `replace(range, replacement, caretAt?)`, `{end: -1}` resolves to current value length |
| **TokenModel**                | Parsing, live node map (id-keyed), one commit pipeline (text / structural branches), DOM↔model facade, adapter ref registries, caret/selection DOM operations — see `features/tokens/README.md` |
| **OverlayController**         | Overlay trigger detection, position, open/close           |
| **SlotsFeature**              | Container ref, slot component/props resolution, mark resolver |
| **SelectionController**       | Caret range, derived location, text selection state       |
| **KeyboardController**        | Text input, block editing, arrow navigation               |
| **BlockController**           | Drag-and-drop block reordering and operation helpers     |
| **ClipboardController**       | Clipboard copy/cut handling                              |

`KeyboardController` internally composes three modules: input handling, block editing, and arrow navigation. `SelectionController` exposes a `range: Signal<Range | undefined>` as the single source of truth for the caret/selection position (collapse the caret by writing a zero-width range), an `isUserSelecting: Signal<boolean>` for selection-in-progress state, and `isAllSelected: Signal<boolean>` derived from `range` and the raw value length.

## Lifecycle Timing

React/Vue render asynchronously, so initialization order matters:

```typescript
// 1. Framework writes the container element via store.host.container(el).
//    → Each feature's onMounted callback fires with the live container element.
//      It also re-fires (with auto-disposal of the previous scope) if the
//      framework swaps to a different container.

// 2. After mount, ValueModel accepts props.value/defaultValue. TokenModel's
//    constructor watch over (value, parser, isBlock) subscribed first inside its
//    onMounted hook, so tokens.current() reflects the new value before any other
//    onMounted watcher observes it.

// 3. Sync contenteditable attributes (layout effect)
//    → TokenModel's commit pipeline runs its first structural bind:
//      walks the DOM, creates TokenHandle instances, writes contentEditable / tabIndex / textContent

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

`BlockController` keeps an id-keyed `Map<number, BlockStore>` — one `BlockStore` per row, keyed by the row's stable identity id (`tokens.keyOf(token)`). A row suffix-shifted by an edit above it is a new object with an inherited id, so id keying (unlike the old token-WeakMap) preserves its drag/hover state. The map cannot self-collect, so removed ids are pruned on `tokens.changed` via `tokens.removedIds()`.

Each `BlockStore` holds its UI state as a `state` record of signals:

```typescript
class BlockStore {
    readonly state = {
        isHovered: signal({initial: false}),
        isDragging: signal({initial: false}),
        dropPosition: signal<DropPosition>({initial: null}), // 'before' | 'after' | null
        menuOpen: signal({initial: false}),
        menuPosition: signal({initial: {top: 0, left: 0}}),
    }
    // ...attachContainer/attachGrip/attachMenu wire DOM listeners that write this state
}
```

## Core-Owned DOM And Cursor Management

Core owns token identity (stable ids and live handles), DOM registration, raw selection mapping, raw value mutation, and caret range placement. React and Vue render adapter-owned structural DOM and register it with core through private refs. Features communicate through `store.<name>.*`, `store.props`, and `store.selection`; production code must not infer token identity from DOM child order. All DOM↔model operations go through `store.tokens` — see `features/tokens/README.md` for the full surface.

### SelectionController

`SelectionController` is a stateful coordinator that owns the reactive caret/selection state and delegates every DOM read and write to `store.tokens`:

- It owns the `range`, `isUserSelecting`, and `isAllSelected` signals, and exposes public delegations for reading selection state. It is the single source of truth for the caret/selection position.
- It does not touch the DOM directly. To read the live browser selection it calls `tokens.selection()` (and `tokens.selection()?.raw` via `readRaw()`); to write the caret it calls `tokens.placeCaret(...)` / `tokens.selectRange(...)`. DOM↔raw boundary mapping (the internal `boundary.ts`) and caret placement (the internal `caret.ts`) live entirely inside `store.tokens` and are not exported from `@markput/core`.
- It re-applies the selection after every commit: in its `onMounted` hook it watches `tokens.changed` (which fires only once the DOM is consistent) and `range`, re-running `#applyRange()` against the live surfaces.
- Editable policy stays here: it watches `props.readOnly` and `isUserSelecting` and calls `tokens.setEditable({editable, readOnly})`; `store.tokens` owns the application to bound surfaces.

### Token layer: `store.tokens`

`TokenModel` is the thin public shell over a live-node core — `model/TokenHandle` (the per-token live binding), `model/commit` (the one commit pipeline), and `model/bind` (the DOM walk that binds freshly rendered DOM). It consolidates the DOM responsibilities that were previously split across separate ref/index/surface modules:

- **Adapter ref registries** — `tokens.control(path?)` and `tokens.children(ownerPath)` register non-editable control elements and `__slot__` child-sequence hosts.
- **Live node map and commit pipeline** — one id-keyed `Map<number, TokenHandle>`, mutated only through the pipeline; every value change flows through a single `apply(reconcileResult)` that routes to a fast text-path (DOM patch, no re-render) or a structural path (publish a new `renderTree` reference, bind freshly rendered DOM). `current()` returns the latest reconciled tree (consistent with `value.current()`), `renderTree` is the adapter-only renderer signal, and `changed` fires once per commit after the DOM is consistent (with `removedIds()` as the prune feed).
- **DOM↔model facade** — `handleAt(node)` resolves a DOM node to its handle (or `'control'`), `handle(id)` resolves a stable id to its live handle, `boundaryFor(node, offset)` maps a DOM boundary to an absolute raw position, `placeCaret(...)` / `selectRange(...)` write the caret, and `selection()` / `selectedContent()` read the live window selection.
- **Editable-state application** — `setEditable({editable, readOnly})` is called by `SelectionController` whenever `readOnly` or `isUserSelecting` changes; bind applies the same state to newly mounted surfaces.

See `packages/core/src/features/tokens/README.md` for the full architecture of the token layer.

## Framework Hooks

### useMark

Available in both React and Vue. Returns a `MarkController` for the current mark token:

```typescript
const mark = useMark()
mark.update({value: 'updated'})
mark.remove()
```

Use `useMarkInfo()` for structural metadata: `depth` and `hasNestedMarks`.

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
