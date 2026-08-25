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
  │ └─ (block layout)
  │     ├─ <Block node={n}>         # Row: painted by its KIND's component, or by
  │     │   └─ <Token node={child}> #   slots.block when it has none. The row's own
  │     │                           #   element AND its child-sequence host
  │     └─ <BlockControls />        # ONE per editor, beside the rows, not inside
  │         ├─ grip                 #   them: grip, drop indicator and row menu,
  │         ├─ drop indicator       #   painted at row boxes it measures
  │         └─ row menu
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
| **Block**            | Block layout's row — resolved through `slots.node` to the kind's own component (or `slots.block` for a paragraph); the row's own element and its child-sequence host |
| **BlockControls**    | ONE per editor: the grip, the drop indicator and the row menu, painted at measured row boxes |
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
4. KeyboardController calls store.edit.replace(from, to, text) for every user edit; a whole-value rewrite calls store.edit.setValue(text) instead. Block row edits name the row the caret enters — store.tokens.setValue(text, enterRoot) — rather than a character offset
        ↓
5. The string boundary decides commit policy — uncontrolled commits straight through; controlled emits onChange and waits for the echo it spliced
        ↓
6. Adoption folds the fresh parse back into the persistent nodes, and apply() binds the tree to the painted DOM, then announces the commit
        ↓
7. The pipeline does not route: what re-renders is decided by what changed. A text edit writes one node's `text` signal, which its own bound surface effect writes to the DOM — no component re-renders. A structural change publishes new roots, so React/Vue re-render through `useMarkput()`
        ↓
8. SelectionDriver applies the stored anchors to the DOM after the adapter registers the new DOM
```

All user mutations go through `store.edit.replace(from, to, text)`: features name the two NODE ANCHORS that bound the span, and the edit coordinator applies the post-edit caret the token layer answers with, inside a single batch. `store.edit.setValue(text)` is the whole-value form; it is not part of the public export. No absolute offset survives above the token tree — a whole-value rewriter that must place the caret names the ROW it enters (`store.tokens.setValue(text, enterRoot)`), an index into the result's rows in PRE-ORDER — falling back to its roots when nothing parses as a row — which the caller genuinely knows. Programmatic writes go through `store.tokens.replaceBetween()` / `setValue()`, and `store.tokens.value()` reads the current projection. DOM→model boundary mapping lives in `store.tokens` (`anchorFor`); its private `SelectionDriver` re-applies the stored anchors to the DOM on `tokens.bound` — the DOM clock, one pulse per bind — and on anchor writes. `TokenModel` owns the token parse, the live node map, and all DOM↔model operations.

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

`new Parser` and `createMarkupDescriptor` THROW on a markup that breaks the placeholder rules —
which is right for `denote` and any other caller that constructs a parser in its own stack.
`TokenModel.#parser` does not construct one that way: it asks `markupError` first and maps an
invalid `option.markup` to `undefined`, the hole `MarkupRegistry` already skips while preserving
the original indices, then reports through `reportBadProp`. The props boundary must not throw
because both adapters push props from a per-render lifecycle hook (see the re-parse paragraph
below). The check sits in `#parser` rather than `#markups` deliberately: `props.options` compares
array elements by reference, so an inline `options={[…]}` prop differs on every render, while
`#markups` compares the markup STRINGS — reporting downstream of that gate is what makes it once
per distinct markup set instead of once per render.

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

| Event   | Feature | When Fired    | Payload |
| ------- | ------- | ------------- | ------- |
| `close` | overlay | Close overlay | `void`  |

Block row operations are NOT an event. `store.block.action({...})` and its four-verb
`DragAction` payload are gone: `BlockController` resolves the menu's row id to its node and calls
that node's own verbs, so there is no action to lower onto them.

Re-parsing is not a store event: it is the string boundary's `reparse()`, driven by a single `watch` over the `(value, parser, rowConfig)` tuple in the `TokenModel` constructor. `rowConfig` is `TokenModel`'s own computed — the block parse policy, `undefined` for a document with no rows — and it is the one place `separator` is read as a policy; everything else asks it, or asks the tree it produced. There is no mode beside it (ADR-0011): a `null` `separator` says the value never splits and answers `undefined`, which is already the seam's word for "no rows", so the row parse, the block feature gates, the grip gutter and `BlockController` turn off together. It carries no equality gate of its own: both adapters push every prop on every render, but the `separator` signal drops an identical write before it propagates, so a per-render prop sync never reaches the computed at all. An EMPTY `separator` answers `undefined` too, but reports first: it separates nothing rather than declining to separate. It is reported through `reportBadProp` rather than thrown, because both adapters push props from a per-render lifecycle hook — React unmounts the whole render root on a throw there, Vue keeps rendering the stale tree — while `Parser.parseRows` keeps refusing `''` for callers that reach it directly. Mount/unmount is not an event either: the adapter writes the `host.container` signal, and `host.onMounted(setup)` runs `setup` (with auto-disposal) whenever a container attaches, swaps, or detaches. The selection driver's `props.readOnly` watch (which writes the container's `contenteditable`) is a reactive effect hook, not a store event; binding is not reactive at all — `apply()` calls it directly on every commit.

### Event Usage

```typescript
// Commit a value edit between two node anchors
store.tokens.replaceBetween(store.tokens.anchorAt(0), store.tokens.anchorAt(5), 'hello')

// Read the live root nodes (readonly TreeNode[]) — reactive
store.tokens.nodes()

// Run a row operation through the editor's block controller — it addresses the row the
// open menu belongs to, so the menu is opened on that row first
store.block.openMenu(store.tokens.nodes()[0].id, gripElement.getBoundingClientRect())
store.block.deleteRow()

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
        separator: Signal<string | null>     // the structural row separator (ADR-0009, ADR-0011);
                                             // `null` = the value never splits, so the document has no rows
        indent: Signal<string>               // the indent unit a NESTED row leads with (ADR-0010);
                                             // `''` turns nesting off, and with it row typing on an
                                             // indented line. `TokenModel.rowConfig` derives the parse
                                             // policy from these two and nothing else
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
    readonly tokens:    TokenModel         // the token tree (the value's source of truth), the SELECTION, live node map, DOM↔model facade, ref registries, caret/selection DOM ops, and `rowConfig` — the one place `separator` is read as a parse policy
    readonly slots:     SlotsFeature       // slot component/props, the NODE resolver, and the grip gutter (rowConfig + draggable)
    readonly edit:      EditController     // replace(from, to, text) / setValue(text) — single batched write path
    readonly overlay:   OverlayController  // match, element, slot, select, close
    readonly keyboard:  KeyboardController // input handling and block editing
    readonly block:     BlockController     // Block layout for the whole editor: hover, drag, drop edge, menu
    readonly clipboard: ClipboardController // copy/cut handling
    readonly api:       MarkputHandle         // the ref handle: container, focus()
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

11 features, each declaring its dependencies as positional constructor parameters with concrete feature types. The dependency graph is acyclic — features can only depend on features constructed above them in `Store`. They never import each other directly; all cross-feature access goes through the injected constructor parameters. `MarkputHandle` — the public host object the component ref exposes — follows the same rule: it owns nothing and delegates every member to the feature that owns the state.

Signal subscription order is significant: inside its constructor `onMounted` hook, `TokenModel` registers a single `watch` over the `(value, parser, rowConfig)` tuple before any other consumer registers a watcher in `onMounted`. When any of the three changes, the watch callback runs the private `#reparse`, so by the time downstream listeners observe a `value.current` change, `tokens.nodes()` already reflects the new value.

| Feature                       | Responsibility                                           |
| ----------------------------- | -------------------------------------------------------- |
| **Host**                      | Adapter-fed runtime state: the rendered event and the container HTMLElement |
| **EditController**            | Unified user edit path: `replace(from, to, text)` between node anchors, plus `setValue(text)` for a whole-value rewrite |
| **TokenModel**                | Parsing, the token tree, the selection (state + DOM driver), live node map (id-keyed), one commit pipeline, DOM↔model facade, adapter ref registries — see `features/tokens/README.md` |
| **OverlayController**         | Overlay trigger detection, position, open/close           |
| **SlotsFeature**              | Container ref, slot component/props resolution, mark resolver |
| **KeyboardController**        | Text input and block editing                             |
| **BlockController**           | Block layout for the whole editor: the hovered/dragged row, the drop edge, the open menu, the row verbs the menu triggers, and the row geometry the layer paints at |
| **ClipboardController**       | Clipboard copy/cut handling                              |

`KeyboardController` registers ONE module: `enableInput` owns the whole keyboard tier — the `beforeinput` guard, paste, the delete keys and Ctrl/Cmd+A — and calls `blockEdit.ts`'s two block arms after its own shared checks. Those arms are all block layout still answers differently: Enter splits a row by inserting the separator, and an `insertParagraph` that reaches the guard anyway is dropped rather than mapped to a newline. A row MERGE is not among them — Backspace/Delete at a row boundary expands onto the separator through `anchorsForDelete`, the same arm that swallows an adjacent mark. Caret navigation is the browser's: the container is the one editing host, so arrows and Home/End move natively and no core keyboard handler intercepts them. (Core's `SuggestionsModel` does claim ArrowUp/ArrowDown/Enter while the built-in `Suggestions` component is mounted — the adapter component only activates it.) The selection is not a feature of its own: `store.tokens.selection` is the stored anchor pair (see below).

## Lifecycle Timing

React/Vue render asynchronously, so initialization order matters:

```typescript
// 1. Framework writes the container element via store.host.container(el).
//    → Each feature's onMounted callback fires with the live container element.
//      It also re-fires (with auto-disposal of the previous scope) if the
//      framework swaps to a different container.

// 2. After mount, the string boundary accepts props.value/defaultValue.
//    TokenModel's constructor watch over (value, parser, rowConfig) subscribed
//    first inside its onMounted hook, so tokens.nodes() reflects the new value
//    before any other onMounted watcher observes it.

// 3. Sync the one-host topology (layout effect)
//    → TokenModel's commit pipeline runs its first bind: walks the DOM, creates
//      TokenHandle instances, applies the editable state (bare text surfaces,
//      ce=false value marks and mark controls, no tabindex anywhere), and arms one
//      text effect per bound text surface (which writes its textContent)

// 4. Each token's ref fires as it paints → store.tokens.consign(id)(element)
//    → rebind(id): that token's share of the walk, no whole-tree pass per ref

// 5. Framework writes store.host.container(null) on unmount
//    → Each onMounted scope is disposed (DOM listeners removed, watchers torn down)
```

## Block System (Block Layout)

A document that never splits (`separator={null}`): tokens render in one flow as alternating `[text, mark, text, ...]`.

Block layout (any non-empty `separator`, with `draggable` adding the reorder affordance): each root node
is a ROW, wrapped in a `<Block>` component that renders the row's children and nothing else. The
row controls — grip, drop indicator, row menu — are not in the row. One `<BlockControls>` per editor
paints all three, as the container's last child, `position: absolute; inset: 0` over the rows.

ROWS NEST, and nesting is indentation and nothing else (ADR-0010). A row whose indent run is deeper
than the row before it becomes its child, clamped in the tree to one level deeper while the surplus
bytes stay verbatim in the row's `lead` — so `lead` is the round-trip bytes and depth is the tree,
and there is no function from one to the other. An empty row takes no children. A row's `children`
hold its inline tokens FIRST and its child rows after, in one list, so every generic walk stays
untouched; `inline()` and `rows()` are the two named halves. Its `position` covers its whole
subtree, which is what keeps sibling positions ascending at every depth, and `lineRange()` is the
row's own line. The projection joins rows in PRE-ORDER by the separator and each row emits its own
lead. A sibling list is painted by one `<Rows>` component at every depth.

THE ROW VERBS live on `RowNode` and every one of them is addressed in pre-order, because once rows
nest a root index stops naming a row. `turnInto(option, patch)` retypes a row: it splices inside the
row's own LINE BODY, so the row keeps its id, its element and its child rows, and it takes an OPTION
rather than a markup because only an option the editor compiled a kind from writes bytes the scan
reads back — resolved by that option's MARKUP, the one identity that survives an adapter rebuilding
its option objects. Inside the line the window is trimmed to the bytes that actually change, so the
caret keeps naming its own character instead of collapsing onto the window's end. Its `patch.text`
replaces the body, which is what makes a menu's strip-and-retype one commit. `splitAt(anchor)` opens
the tail as a new row — its kind, and its `meta`, are this row's when the kind declares `continues`,
else a plain row — and places it after the row's whole SUBTREE, because a row written at the
parent's lead directly under it would adopt every child the parent has. The one exception is a head
that EMPTIES: an empty row takes no children, so there the subtree follows the tail instead, which
is Enter at a row's start. `mergeWith(next)` deletes the boundary between two rows adjacent in
pre-order — the separator, the next row's lead and its opener — which is the same span a Backspace
at that boundary removes, so the survivor keeps the FIRST row's kind. `remove()` takes the boundary
BEFORE a row with it, and `duplicate()` puts one back in front of a copy that would otherwise fuse;
both ask the pre-order walk whether the row's SUBTREE ends the document, since a removal takes the
subtree and every ancestor of the last row carries no trailing separator either. `insertAfter(text)`
splices at the row's span end — past its whole subtree — and moves the caret into the row that lands
there. `moveTo(placement)` relocates a row AND its subtree: a `RowPlacement` is `{parent, index}`,
the parent being the row it becomes a child of (`null` for the document's own list) and the index
the position it takes among that parent's child rows once it is out of its old one. The plan is one
splice over the narrowest run of pre-order LINES whose bytes change — a subtree is contiguous in
pre-order, so a move is "cut this run, paste it before that index" — and it re-indents every moved
descendant by the depth delta, which normalizes a surplus indent run exactly as `setDepth` does. It
refuses a placement INSIDE the moved subtree, because a row cannot become its own descendant, and a
placement under an EMPTY row, because an empty row takes no children and the lead it would write
parses back one level shallower. A move leaves the caret alone: every node keeps its content and its
identity, and a lead is the ROW's bytes and lives in no text node, so no anchor can name one.

Two answers the encoding forces rather than chooses, both from "an empty row takes no children":
retyping a depth-0 row to an empty paragraph PROMOTES its children to roots (their surplus indent
survives verbatim in `lead`), and no verb can write an empty parent.

`BlockController` (`store.block`) owns them for the whole editor, as four signals
addressed by row id:

```typescript
class BlockController {
    readonly state = {
        hovered:  signal<number | null>(...),                      // row id under the pointer
        dragging: signal<number | null>(...),                      // row id being dragged
        drop:     signal<{id: number; edge: 'before' | 'after'} | null>(...),
        menu:     signal<{id: number; top: number; left: number} | null>(...),
        geometry: signal(...),                                     // re-measure clock
    }
    // ...five container listeners, and three geometry clocks: a ResizeObserver on each of the
    // container's two boxes (the layer's origin is the PADDING box, which neither one alone reports),
    // a watch on the commit clock, and a rAF loop over the PAINTED rows while the controls are visible
}
```

There is no per-row store and no per-row control DOM. At 200 rows the shape this replaced mounted
201 grip buttons, 201 `control()` roots and 1608 listeners; measured mount was 44 ms and 1005 DOM
nodes, against 18 ms and 403 for one layer.

The price is geometry: `.Block { position: relative }` made a per-row grip free, while a layer
measures. `boxOf(id)` answers a row's box in CONTAINER-LOCAL coordinates (which carry
`scrollTop`, so they are scroll-proof), and `rowAt(clientY)` hit-tests a pointer with a binary
search over the vertically tiled rows. Hover is therefore geometric rather than DOM containment:
the drag gutter hovers its row, and a point in the gap between two rows snaps to the nearest.

A measured box goes stale on any reflow, so the model tells the layer to re-measure on three
clocks: the container's own size, every commit (a row that reflows moves every row BELOW it while
the container's box does not change), and — while the controls are painted — a rAF loop over the painted
rows, for the reflow that is neither. An image or a webfont landing inside a row ABOVE the painted
one moves it without changing its size, so both observers stay silent; measured, the grip sat 66px
off its row and stayed there. The loop reads two rects per painted row per frame (0.9 µs with a
clean layout, 20 µs when every read forces a reflow), bumps the clock only when a box actually
moved, and does not exist while the pointer is away. That last property is also its one gap:
`alwaysShowHandle` paints a grip with no pointer present, so a reflow that moves row 0 while both
container boxes and row 0's own box keep their size leaves that grip behind, and the pointer does
not repair it — hover re-measures only when the hovered ROW changes, and the resting row is
already that row. The container padding change that used to demonstrate this (60px in both
adapters) needed no frames after all and is closed by the second container observation; what
survives is measured at 60px for consumer content growing ABOVE the rows inside a fixed-height
container, and 30px under `display: flex; justify-content: center` when a lower row grows.
Pre-existing, and left open rather than paid for with frames that would run for the editor's whole
lifetime.

Row operations are calls on the row's own node: `addRow`/`deleteRow`/`duplicateRow` resolve the
open menu's id through `tokens.find` and call `insertAfter(separator)`/`remove()`/`duplicate()`,
so a row that has left the tree refuses. The drop is addressed by id too: its source is
`state.dragging`, and both it and the drop edge's row resolve through `rootIndexOf` on the live
tree, which is then handed to `moveTo` as a root-level `RowPlacement` — `rowAt` hit-tests roots
alone, so a drop cannot yet name a depth.

That signal is also the PROVENANCE test. Only `beginDrag` — the grip's own `dragstart` — sets it,
and it is per-editor, so `dragover` paints no drop edge for a drag this editor did not start and
`drop` never claims one; two editors on a page discriminate each other for free, the way
`captureMarkupPaste` already scopes the clipboard per container. A foreign drop falls through to
the browser's own editable drop, where `insertFromDrop` inserts the dragged text. Until 2026-08-23
there was no provenance test at all: the handler parsed `text/plain` as a row index and refused
only `NaN`, so the bare text `0` dragged in from another application reordered the document, and
so did a second markput editor's row. Because the drop no longer reads the payload, `text/plain`
now carries the row's own text — what a drag out of the editor should deliver.

Row controls addressed by position rather than by row identity are the narrow exception to ADR-0007,
amended for it; a row's own state still travels with the row.

## Core-Owned DOM And Cursor Management

Core owns token identity (stable ids and live handles), DOM registration, DOM→anchor selection mapping, value mutation, and caret placement. React and Vue render adapter-owned structural DOM and register it with core through private refs. Features communicate through `store.<name>.*` and `store.props`; production code must not infer token identity from DOM child order. All DOM↔model operations go through `store.tokens` — see `features/tokens/README.md` for the full surface.

### The selection: `store.tokens.selection` plus a private driver

There is no selection feature and no `store.selection`. `TokenModel` owns both halves (split by owner, not by convenience):

- **State — `store.tokens.selection`** (`tree/selection.ts`, DOM-free). The STORED form is a pair of node anchors, never offsets; `anchors()` reads them, `select`/`selectNode`/`selectAll`/`clear` write them, and `repair(result)` applies the post-adoption anchor adoption resolved. `isAllSelected` is the one derived number left, computed inside the tree layer where that arithmetic is legal.
- **DOM I/O — the private `SelectionDriver`** (`dom/SelectionDriver.ts`). It owns the `selectionchange` sync, the `focusout` clear, the caret application and the editing host's `contenteditable`. Its two externally-needed reads are delegated on the model: `tokens.domAnchors()` (the live browser selection as anchors) and `tokens.focusFirst()`.
- The driver's ONE direct DOM write is the editing host itself — `container.contentEditable`, gated by `props.readOnly`. Everything else goes through the model's own `DomModel` — `placeCaret(anchor)` / `selectRange(anchor, head)` — which the driver holds as a dep. DOM→anchor boundary mapping (`dom/domBoundary.ts`) and caret placement (`dom/caret.ts`) live entirely inside the token layer and are not exported from `@markput/core`.
- The selection is re-applied after every bind: the driver's `onMounted` hook watches `tokens.bound` (one pulse per bind, so every handle matches an element in the document) and the stored anchors, re-running the placement against the live surfaces. It is the DOM clock and not the commit clock because a caret landing in a node BORN by the commit has no handle until bind makes one.
- Editable policy is one host deep and nothing sweeps: `props.readOnly` writes the container's own `contenteditable` through the driver, and the topology below it (bare text surfaces, `ce=false` value marks, bare slot marks with frozen controls) is applied once per bind.

### Token layer: `store.tokens`

`TokenModel` is the thin public shell over a live-node core — `dom/TokenHandle.ts` (the per-token live binding), `dom/commit.ts` (the one commit pipeline), and `dom/bind.ts` (the DOM walk that binds freshly rendered DOM). It consolidates the DOM responsibilities that were previously split across separate ref/index/surface modules:

- **Adapter ref registries** — `tokens.control()` and `tokens.children(ownerId, part?)` register non-editable control elements and child-sequence hosts (`'inline'`, the default, is a mark's `__slot__` host or a row's own element; `'rows'` is a row's child-ROWS host), and `tokens.consign(id)` registers a token's own element — a block row's wrapper included, since a row IS a token (ADR-0009). All are keyed by the owning token's stable id. A Mark's registered element is the box-less wrapper markput renders around it, not the consumer's component — so no consumer needs to forward a ref, and core writes attributes only to elements it owns.
- **Live node map and commit pipeline** — one id-keyed `Map<number, TokenHandle>`, mutated only through the pipeline. Elements are CONSIGNED by the adapters through refs, keyed by token id, rather than derived by walking the painted DOM; `bind` projects those registries onto the node layer. Text never reaches the pipeline: binding arms one conditional-write effect per bound text surface, subscribed to that node's `text` signal, so a text edit repaints no component. `nodes()` is the live tree (consistent with `tokens.value()`) and what both adapters render. There are TWO payload-free clocks, because one event was answering two questions: `committed` fires once per commit — including the commits that move no element, such as a row reorder or a mark value change — and `bound` fires once per bind, which is what the caret needs.
- **DOM↔model facade** — `handleAt(node)` resolves a DOM node to its handle (or `'control'`), `handle(id)` resolves a stable id to its live handle, `anchorFor(node, offset)` maps a DOM boundary to a node anchor in the live tree, and `caretRect()` / `selectedContent()` read the live selection. The placement commands (`placeCaret`, `selectRange`) and the raw snapshot read live on their owner, `dom/DomModel`, which nothing outside the token layer holds. No member of this facade takes or returns an absolute document offset — `anchorAt` / `offsetOf` are the tree layer's own boundary, kept because that is the one place a coordinate may be formed.
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

`defaultValue` is read once, to start a tree that holds nothing yet. It is not a
value the editor reverts to: an editor that stops receiving `value` (a parent
passing `undefined` after a string) keeps what is on screen, because the tree —
not a remembered string — is what an arrival without a value falls back to. To go
back to earlier text, pass it.

### Pattern: Block Layout With Drag

```typescript
function App() {
  return (
    <MarkedInput
      separator={'\n'}
      draggable
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
