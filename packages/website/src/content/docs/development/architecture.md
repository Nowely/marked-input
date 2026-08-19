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
  │ │   └─ <Token node={n} />       # Unified renderer for text & mark nodes
  │ │       └─ <TokenChildren>      # Internal host for __slot__ child sequence
  │ │           └─ <Token node={child}>
  │ │
  │ └─ (drag=true)
  │     └─ <Block node={n}>         # Drag-mode wrapper per root node
  │         ├─ <DropIndicator position="before" />
  │         ├─ <DragHandle />
  │         ├─ <Token node={n} />
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
3. store.tokens.domAnchors() resolves the DOM selection (or the input target range) to a pair of node anchors in the live tree
        ↓
4. KeyboardController calls store.edit.replace(from, to, text) for every user edit; a whole-value rewrite (block reorder, row merge) calls store.edit.setValue(text, caretOffset?) instead
        ↓
5. The string boundary decides commit policy — uncontrolled commits straight through; controlled emits onChange and waits for the echo it spliced
        ↓
6. Adoption folds the fresh parse back into the persistent nodes, and the commit pipeline routes to the text path (DOM patch, no re-render) or the structural path (publish new tree reference)
        ↓
7. On the structural path: React/Vue re-renders via the framework `useMarkput()` hook (tree reference changed); on the text path, no re-render fires
        ↓
8. SelectionDriver applies the stored anchors to the DOM after the adapter registers the new DOM
```

All user mutations go through `store.edit.replace(from, to, text)`: features name the two NODE ANCHORS that bound the span, and the edit coordinator applies the post-edit caret the token layer answers with, inside a single batch. `store.edit.setValue(text, caretOffset?)` is the whole-value form and the one place an absolute offset survives above the token tree — a whole-value rewriter synthesizes a new string from row positions, so no node exists to name the caret; it is not part of the public export. Programmatic writes go through `store.tokens.replaceBetween()` / `setValue()`, and `store.tokens.value()` reads the current projection. DOM→model boundary mapping lives in `store.tokens` (`anchorFor`, `domSelection()`); its private `SelectionDriver` re-applies the stored anchors to the DOM on `tokens.bound` — the DOM clock, one pulse per bind — and on anchor writes. `TokenModel` owns the token parse, the live node map, and all DOM↔model operations.

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

Each root node renders via the unified `Token` component, taking the live `TreeNode` off `store.tokens.nodes()`:

```jsx
<Container>
    <Token node={textNode} />   {/* renders as <span> */}
    <Token node={markNode} />   {/* renders user's Mark component */}
    <Token node={textNode} />
    <Token node={markNode} />
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
| `action`        | drag           | Drag-and-drop action        | `{type, ...}` (internal `DragAction`)    |

Re-parsing is not a store event: it is the string boundary's `reparse()`, driven by a single `watch` over the `(value, parser, isBlock)` tuple in the `TokenModel` constructor. Mount/unmount is not an event either: the adapter writes the `host.container` signal, and `host.onMounted(setup)` runs `setup` (with auto-disposal) whenever a container attaches, swaps, or detaches. The selection driver's `props.readOnly` watch (which writes the container's `contenteditable`) and the token model's bind effect are reactive effect hooks, not store events.

### Event Usage

```typescript
// Commit a value edit between two node anchors
store.tokens.replaceBetween(store.tokens.anchorAt(0), store.tokens.anchorAt(5), 'hello')

// Read the live root nodes (readonly TreeNode[]) — reactive
store.tokens.nodes()

// Emit a drag action event
store.block.action({ type: 'delete', index: 0 })

// Subscribe to an event
import {watch, effectScope} from '@markput/core'

const dispose = effectScope(() => {
    watch(
        store.tokens.value,
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
    readonly slots:     SlotsFeature       // isBlock, isDragEnabled, slot component/props, mark resolver
    readonly edit:      EditController     // replace(from, to, text) / setValue(text, caretOffset?) — single batched write path
    readonly tokens:    TokenModel         // the token tree (the value's source of truth), the SELECTION, live node map, DOM↔model facade, ref registries, caret/selection DOM ops
    readonly overlay:   OverlayController  // match, element, slot, select, close
    readonly keyboard:  KeyboardController // input handling and block editing
    readonly block:     BlockController    // block drag actions and operation helpers
    readonly clipboard: ClipboardController // copy/cut handling
    readonly api:       MarkputApi         // the ref handle: container, focus()
}
```

### State and props access

Internal feature state, computeds, and events live directly on `store.<name>.*`. Values and options passed from React/Vue live on `store.props` and are updated via `store.props.set()`.

```typescript
// Read the live root nodes (readonly TreeNode[]) — reactive, and THE render read
store.tokens.nodes()

// The token tree owns the value; store.tokens.value() is its string projection.
// Route edits through node anchors; setValue() is the whole-value form.
store.tokens.replaceBetween(store.tokens.anchorAt(0), store.tokens.anchorAt(5), 'Hello')
store.tokens.setValue('Hello @[World]')

// Framework-provided props (MarkedInput calls store.props.set on each render)
store.props.set({readOnly: true})

// Use in component (framework-specific reactive binding). `nodes` is the data, and
// the only renderer subscription there is: an adapter re-renders when the tree's
// root list changes by reference, and nothing else tells it to.
const {nodes} = useMarkput(s => ({nodes: s.tokens.nodes}))
```

## Features

11 features, each declaring its dependencies as positional constructor parameters with concrete feature types. The dependency graph is acyclic — features can only depend on features constructed above them in `Store`. They never import each other directly; all cross-feature access goes through the injected constructor parameters. `MarkputApi` — the public host object the component ref exposes — follows the same rule: it owns nothing and delegates every member to the feature that owns the state.

Signal subscription order is significant: inside its constructor `onMounted` hook, `TokenModel` registers a single `watch` over the `(value, parser, isBlock)` tuple before any other consumer registers a watcher in `onMounted`. When any of the three changes, the watch callback runs the private `#reparse`, so by the time downstream listeners observe a `value.current` change, `tokens.nodes()` already reflects the new value.

| Feature                       | Responsibility                                           |
| ----------------------------- | -------------------------------------------------------- |
| **Host**                      | Adapter-fed runtime state: the rendered event and the container HTMLElement |
| **EditController**            | Unified user edit path: `replace(from, to, text)` between node anchors, plus `setValue(text, caretOffset?)` for a whole-value rewrite |
| **TokenModel**                | Parsing, the token tree, the selection (state + DOM driver), live node map (id-keyed), one commit pipeline, DOM↔model facade, adapter ref registries — see `features/tokens/README.md` |
| **OverlayController**         | Overlay trigger detection, position, open/close           |
| **SlotsFeature**              | Container ref, slot component/props resolution, mark resolver |
| **KeyboardController**        | Text input and block editing                             |
| **BlockController**           | Drag-and-drop block reordering and operation helpers     |
| **ClipboardController**       | Clipboard copy/cut handling                              |

`KeyboardController` internally composes two modules: `enableInput` (the `beforeinput` guard, paste, the delete keys and Ctrl/Cmd+A) and `enableBlockEdit` (row split, merge and delete in block layout). Caret navigation is the browser's: the container is the one editing host, so arrows and Home/End move natively and no core keyboard handler intercepts them. (The adapters' `Suggestions` component does claim ArrowUp/ArrowDown/Enter while the overlay is open — see `navigateSuggestions`.) The selection is not a feature of its own: `store.tokens.selection` is the stored anchor pair (see below).

## Lifecycle Timing

React/Vue render asynchronously, so initialization order matters:

```typescript
// 1. Framework writes the container element via store.host.container(el).
//    → Each feature's onMounted callback fires with the live container element.
//      It also re-fires (with auto-disposal of the previous scope) if the
//      framework swaps to a different container.

// 2. After mount, the string boundary accepts props.value/defaultValue.
//    TokenModel's constructor watch over (value, parser, isBlock) subscribed
//    first inside its onMounted hook, so tokens.nodes() reflects the new value
//    before any other onMounted watcher observes it.

// 3. Sync the one-host topology (layout effect)
//    → TokenModel's commit pipeline runs its first bind: walks the DOM, creates
//      TokenHandle instances, applies the editable state (bare text surfaces,
//      ce=false value marks and mark chrome, no tabindex anywhere), and arms one
//      text effect per bound text surface (which writes its textContent)

// 4. Each token's ref fires as it paints → store.tokens.consign(id)(element)
//    → rebind(id): that token's share of the walk, no whole-tree pass per ref

// 5. Framework writes store.host.container(null) on unmount
//    → Each onMounted scope is disposed (DOM listeners removed, watchers torn down)
```

## Block System (Drag Mode)

Normal mode: tokens render inline as alternating `[text, mark, text, ...]`.

Drag mode (`drag={true}`): each token is wrapped in a `<Block>` component with:
- `DragHandle` — grip for initiating drag
- `DropIndicator` — visual feedback for drop position (before/after)
- `BlockMenu` — context menu (add, delete, duplicate)

`BlockController` keeps a `WeakMap<TreeNode, BlockStore>` — one `BlockStore` per row, keyed by the row node itself. Object keying is exactly as stable as id keying: ids come from one tree's private counter, so within an input an id is carried by one object forever, and adoption writes surviving nodes in place. Keying on the object makes the map self-collecting, so there is no prune at all — the id-keyed `Map` it replaced could only shed a dead row on an announcement, and an announcement needs a mounted container, so an unmounted row leaked its store for the lifetime of the input.

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

Core owns token identity (stable ids and live handles), DOM registration, DOM→anchor selection mapping, value mutation, and caret placement. React and Vue render adapter-owned structural DOM and register it with core through private refs. Features communicate through `store.<name>.*` and `store.props`; production code must not infer token identity from DOM child order. All DOM↔model operations go through `store.tokens` — see `features/tokens/README.md` for the full surface.

### The selection: `store.tokens.selection` plus a private driver

There is no selection feature and no `store.selection`. `TokenModel` owns both halves (split by owner, not by convenience):

- **State — `store.tokens.selection`** (`tree/selection.ts`, DOM-free). The STORED form is a pair of node anchors, never offsets; `anchors()` reads them, `select`/`selectNode`/`selectAll`/`clear` write them, and `repair(result)` applies the post-adoption anchor adoption resolved. `isAllSelected` is the one derived number left, computed inside the tree layer where that arithmetic is legal.
- **DOM I/O — the private `SelectionDriver`** (`dom/SelectionDriver.ts`). It owns the `selectionchange` sync, the `focusout` clear, the caret application and the editing host's `contenteditable`. Its three externally-needed reads are delegated on the model: `tokens.domAnchors()` (the live browser selection as anchors), `tokens.focusFirst()` and `tokens.placeAtHandle(handle, boundary)`.
- The driver's ONE direct DOM write is the editing host itself — `container.contentEditable`, gated by `props.readOnly`. Everything else goes through `tokens.placeCaret(anchor)` / `tokens.selectRange(anchor, head)`. DOM→anchor boundary mapping (`dom/domBoundary.ts`) and caret placement (`dom/caret.ts`) live entirely inside the token layer and are not exported from `@markput/core`.
- The selection is re-applied after every bind: the driver's `onMounted` hook watches `tokens.bound` (one pulse per bind, so every handle matches an element in the document) and the stored anchors, re-running the placement against the live surfaces. It is the DOM clock and not the commit clock because a caret landing in a node BORN by the commit has no handle until bind makes one.
- Editable policy is one host deep and nothing sweeps: `props.readOnly` writes the container's own `contenteditable` through the driver, and the topology below it (bare text surfaces, `ce=false` value marks, bare slot marks with frozen chrome) is applied once per bind.

### Token layer: `store.tokens`

`TokenModel` is the thin public shell over a live-node core — `dom/TokenHandle.ts` (the per-token live binding), `dom/commit.ts` (the one commit pipeline), and `dom/bind.ts` (the DOM walk that binds freshly rendered DOM). It consolidates the DOM responsibilities that were previously split across separate ref/index/surface modules:

- **Adapter ref registries** — `tokens.control()` and `tokens.children(ownerId)` register non-editable control elements and `__slot__` child-sequence hosts, and `tokens.consign(id)` / `tokens.consignRow(id)` register a token's own element and its block row wrapper. All are keyed by the owning token's stable id. A Mark's registered element is the box-less wrapper markput renders around it, not the consumer's component — so no consumer needs to forward a ref, and core writes attributes only to elements it owns.
- **Live node map and commit pipeline** — one id-keyed `Map<number, TokenHandle>`, mutated only through the pipeline. Elements are CONSIGNED by the adapters through refs, keyed by token id, rather than derived by walking the painted DOM; `bind` projects those registries onto the node layer. Text never reaches the pipeline: binding arms one conditional-write effect per bound text surface, subscribed to that node's `text` signal, so a text edit repaints no component. `nodes()` is the live tree (consistent with `tokens.value()`) and what both adapters render. There are TWO payload-free clocks, because one event was answering two questions: `committed` fires once per commit — including the commits that move no element, such as a row reorder or a mark value change — and `bound` fires once per bind, which is what the caret needs.
- **DOM↔model facade** — `handleAt(node)` resolves a DOM node to its handle (or `'control'`), `handle(id)` resolves a stable id to its live handle, `anchorFor(node, offset)` maps a DOM boundary to a node anchor in the live tree, `placeCaret(anchor)` / `selectRange(anchor, head)` write the caret, and `domSelection()` / `selectedContent()` read the live window selection. No member of this facade takes or returns an absolute document offset — `anchorAt` / `offsetOf` are the tree layer's own boundary, kept because that is the one place a coordinate may be formed.
- **Editable-state application** — `bind` applies the one-host topology to newly mounted surfaces, and that is the whole of it. The container's `contenteditable` belongs to `props.readOnly`, through the selection driver's `{immediate: true}` watch; there is no second writer and no manual override.

See `packages/core/src/features/tokens/README.md` for the full architecture of the token layer.

## Framework Hooks

### useMark

Available in both React and Vue. Returns the live `MarkNode` for the current mark token:

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
