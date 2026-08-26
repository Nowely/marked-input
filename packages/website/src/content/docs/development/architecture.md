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
│  │  • Components (MarkedInput, Container, Token, Row)    │  │
│  │  • Hooks (useMark, useOverlay, useMarkput)            │  │
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
  │ └─ (with rows)
  │     ├─ <Row node={n}>           # Row: painted by its KIND's component, or by
  │     │   └─ <Token node={child}> #   slots.paragraph when it has none. The row's own
  │     │                           #   element AND its child-sequence host
  │     └─ <RowControls />          # ONE per editor, beside the rows, not inside
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
| **Row**              | One row — resolved through `slots.node` to the kind's own component (or `slots.paragraph` for a paragraph); the row's own element and its child-sequence host |
| **RowControls**      | ONE per editor: the grip, the drop indicator and the row menu, painted at measured row boxes |
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
4. KeyboardController calls store.edit.replace(from, to, text) for every user edit; a whole-value rewrite calls store.edit.setValue(text) instead. A row edit calls a ROW VERB on the caret's own row, which names its own post-edit caret
        ↓
5. The string boundary decides commit policy — uncontrolled commits straight through; controlled emits onChange and waits for the echo it spliced
        ↓
6. Adoption folds the fresh parse back into the persistent nodes, and apply() binds the tree to the painted DOM, then announces the commit
        ↓
7. The pipeline does not route: what re-renders is decided by what changed. A text edit writes one node's `text` signal, which its own bound surface effect writes to the DOM — no component re-renders. A structural change publishes new roots, so React/Vue re-render through `useMarkput()`
        ↓
8. SelectionDriver applies the stored anchors to the DOM after the adapter registers the new DOM
```

All user mutations go through `store.edit.replace(from, to, text)`: features name the two NODE ANCHORS that bound the span, and the edit coordinator applies the post-edit caret the token layer answers with, inside a single batch. `store.edit.setValue(text)` is the whole-value form; it is not part of the public export. No absolute offset survives above the token tree: a verb that puts a position into the document names the ROW the caret enters, as an index into the result's rows in PRE-ORDER — falling back to its roots when nothing parses as a row — which the verb genuinely knows and a character offset into an unparsed string does not. Programmatic writes go through `store.tokens.replaceBetween()` / `setValue()`, and `store.tokens.value()` reads the current projection. DOM→model boundary mapping lives in `store.tokens` (`anchorFor`); its private `SelectionDriver` re-applies the stored anchors to the DOM on `tokens.bound` — the DOM clock, one pulse per bind — and on anchor writes. `TokenModel` owns the token parse, the live node map, and all DOM↔model operations.

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
   - Overlay calls choose({ value, meta }), or select({ value, meta }) for the same thing
        ↓
7. store.overlay.choose annotates the trigger option's markup and replaces the trigger range
        ↓
8. Markup inserted, onChange called with new text
        ↓
9. store.overlay.close() closes overlay
```

A `/` menu takes the other arm of the same accept path. Options contribute their own entries:
an option carrying a `menu: MenuSpec` is in `store.overlay.list.rows`, already narrowed by what
was typed after the trigger (label plus hidden keywords, through `filterSuggestions`), so no
component holds a list of kinds and none filters one. `choose({option})` then removes the
trigger span and calls `RowNode.turnInto(option, {text})` on the caret's row — ONE splice for
both gestures, because two verbs cannot compose in controlled mode. Which gesture it is lives
in ONE place and is not published: `choose` reads the caret row's body and, if it is empty,
seeds it from the entry's `menu.text`/`menu.meta`; a row that already has text keeps it, since
a turn-into must not discard what was typed. Each adapter ships ONE list component,
`OverlayList`: it is the default overlay, it paints `overlay.data` when the matched option
declares any and the row menu when it declares none, and both get the same ↑↓/Enter protocol
from `OverlayListModel`. `{overlay: {trigger: '/'}}` is therefore the whole wiring of a row
menu — no component named, no filtering, no insert logic.

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

Row operations are NOT an event. `store.rows.action({...})` and its four-verb
`DragAction` payload are gone: `RowController` resolves the menu's row id to its node and calls
that node's own verbs, so there is no action to lower onto them.

Re-parsing is not a store event: it is the string boundary's `reparse()`, driven by a single `watch` over the `(value, parser, rowConfig)` tuple in the `TokenModel` constructor. `rowConfig` is `TokenModel`'s own computed — the row parse policy, `undefined` for a document with no rows — and it is the one place `separator` is read as a policy; everything else asks it, or asks the tree it produced. There is no mode beside it (ADR-0011): a `null` `separator` says the value never splits and answers `undefined`, which is already the seam's word for "no rows", so the row parse, the row-controls gates, the grip gutter and `RowController` turn off together. It carries no equality gate of its own: both adapters push every prop on every render, but the `separator` signal drops an identical write before it propagates, so a per-render prop sync never reaches the computed at all. An EMPTY `separator` answers `undefined` too, but reports first: it separates nothing rather than declining to separate. It is reported through `reportBadProp` rather than thrown, because both adapters push props from a per-render lifecycle hook — React unmounts the whole render root on a throw there, Vue keeps rendering the stale tree — while `Parser.parseRows` keeps refusing `''` for callers that reach it directly. Mount/unmount is not an event either: the adapter writes the `host.container` signal, and `host.onMounted(setup)` runs `setup` (with auto-disposal) whenever a container attaches, swaps, or detaches. The selection driver's `props.readOnly` watch (which writes the container's `contenteditable`) is a reactive effect hook, not a store event; binding is not reactive at all — `apply()` calls it directly on every commit.

### Event Usage

```typescript
// Commit a value edit between two node anchors
store.tokens.replaceBetween(store.tokens.anchorAt(0), store.tokens.anchorAt(5), 'hello')

// Read the live root nodes (readonly TreeNode[]) — reactive
store.tokens.nodes()

// Run a row operation through the editor's row controller — it addresses the row the
// open menu belongs to, so the menu is opened on that row first
store.rows.openMenu(store.tokens.nodes()[0].id, gripElement.getBoundingClientRect())
store.rows.deleteRow()

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
    readonly overlay:   OverlayController  // match, element, slot, entries, choose/select, close
    readonly keyboard:  KeyboardController // input handling and row editing
    readonly rows:      RowController      // the rows' own UI for the whole editor: hover, drag, drop edge, menu
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
| **KeyboardController**        | Text input and row editing                               |
| **RowController**             | The rows for the whole editor: the hovered/dragged row, the drop edge, the open menu, the row verbs the menu triggers, and the row geometry the layer paints at |
| **ClipboardController**       | Clipboard copy/cut handling                              |

`KeyboardController` registers ONE module: `enableInput` owns the whole keyboard tier — the `beforeinput` guard, paste, the delete keys and Ctrl/Cmd+A — and calls `rowKeys.ts`'s row arms after its own shared checks.

THE ROW KEYMAP is those arms, and every one of them resolves the caret's row (`tokens.rowOf(anchor)`) and then calls a ROW VERB, so no keyboard rule exists twice. Enter SPLITS at the caret, which is one call for three gestures: at a row's end the tail is empty and keeps this kind when the kind declares `continues`, mid-row it carries the rest of the body, and at a row's start the empty head stays above. On an EMPTY row Enter DEMOTES instead — the one ladder, depth first and then kind, `setDepth(depth - 1)` falling to `turnInto(undefined)` — and inserts only when the row has neither left to give. Backspace at a row's own ENTRY runs that same ladder, inside the shared delete arm rather than beside it, so a row merge is still the boundary expansion `anchorsForDelete` performs and not a second implementation. Tab and Shift+Tab re-indent when the kind that OWNS ITS LINE declares `indents` — its own, or, for a row with no kind, the row it is nested in — and consume the key for those rows alone, so Tab still leaves the field everywhere else (ADR-0002). What they move is the ROW SELECTION where one stands and the caret's own row otherwise, through the one set verb `tokens.indentRows(rows, steps)`: a caret is the set of one, and a step no named row can take moves none of them. The declaration is asked of EVERY row the key would move, and it is all or none: a set holding one row of a kind that declares nothing leaves the key alone, exactly as a caret in that row does. Asked of the anchor's row alone it was decided by which row happened to be first — the same two rows selected downward indented a heading under a bullet and selected upward moved nothing. Inside a CARVED row Tab walks the pieces instead, and nothing declares that: a piece is a Row in its parent's own child list, so the next cell is that list's next entry, and at the first or last piece there is no neighbour and the key is not consumed. Every other key there names the LINE, because a piece has no line of its own to splice — Enter splits the line and the pieces after the caret move into the row it produces, Backspace at the first piece runs the demote ladder on the line, and a slash menu opened in a piece converts the line. Shift+Enter there is REFUSED — consumed and doing nothing — because a continuation line is a row nested under the one whose kind owns the line and a carved row is granted no children: written anyway, the separator lands inside the row's own body and cuts the line in two. Shift+Enter opens a CONTINUATION LINE: one line is one row, so a second line inside a row has to be a row, and it is written inside the subtree of the row whose kind owns the line — a CHILD of a row that has a kind or is a root, a SIBLING of a nested row that has neither, so N soft breaks are N lines at one level. That is what makes a soft break travel with its row on a drag and copy with it (ADR-0011's amendment). Enter inside a RAW CLOSED body — a fence, frontmatter — is a literal newline instead, derived from the compiled markup rather than declared. Both Enter inputTypes are dropped by the `beforeinput` guard, because the keydown owns them. A PASTE whose clip carries line breaks goes through that same split: `RowNode.writeRows(span, rows)` is the general form — a cut with text written on both sides of it, one row opened per line — and `splitAt` is the degenerate case with two empty pieces. Over a ROW SELECTION the same lines go through `tokens.replaceRows` instead, which opens them at the covered rows' lead and kind, so the two gestures answer one clip the same way. Only a FOREIGN clip is opened either way; this editor's own clipboard entry is the value's own projection, with a lead and an opener already on every line, and is spliced verbatim. A LINE is a piece with no line break AND no document separator in it: the keymap cuts on `\r\n`/`\r`/`\n`, which is the clip's platform's question, and the plan re-cuts on the separator, which is the document's. One SPAN shape is still outside this: a paste whose span runs from one row into another falls back to the ordinary splice, because `splitPlan` refuses a span that leaves the row's own body.

THE ROW SELECTION is the same tier's other half, and it has no store: `store.rows.selected` is a `Computed` over `(tokens.nodes(), selection.anchors())` answering the rows the text selection holds EXACTLY — from a row's own entry to the end of its subtree's content, without the separator that follows it, and nothing at all where the span also names bytes outside them. A second store of selected ids would need pruning on every commit, re-pairing across every adoption and reconciling with the caret; here a row is selected exactly while the selection spans it, and the DOM paints it for free. Three keys widen it, and all four answers come from `tokens.rowScope(anchors, scope)` so no two can disagree: Esc turns a caret into its own row and then climbs a level per press; Shift+Up/Down grow the selection by absorbing the neighbouring row WHOLE, which is what keeps growing past a first child from getting stuck; and Ctrl/Cmd+A gains one rung below select-all, widening a nested row selection to the row it is nested in before it reaches for the document. Shift+arrows are consumed ONLY once a row selection stands, by the same test that decides there is nothing to grow, so an ordinary arrow stays the browser's. The GROWTH rung is the one place the looser test survives, and it is what converts a sweep into a row selection: `rowScope` grows from any span that covers a row whole, and what it writes back is that row's exact span — so `store.rows.selected` paints nothing until the first Shift+arrow, and the row the sweep merely covered is not one any verb acts on before then. At the document's edges the arm answers the span already held rather than declining, so the key is consumed and does nothing: declining there left the browser to move the focus end off the row boundary and collapse the selection the gesture was extending. The widening rung answers the parent UNIONED with what is held, so a selection spanning two parents cannot be narrowed by the key that widens it, and the `'row'` rung runs only while no row selection stands. Esc defers to anything already open — the suggestions overlay and the row menu — since each closes on that press from a listener of its own that cannot see this one's `defaultPrevented`. A COLLAPSED selection holds no rows at all, which is why an empty row cannot be row-selected on its own: its content is zero-width, so a caret resting in one sits at both of its edges.

WHAT A ROW SELECTION HOLDS has one reading — `tokens.rowSelection(anchors)` for the rows and `tokens.replaceRows(anchors, rows)` for the bytes, both answered by the same exactness test — and every gesture asks it: the paint, the drag, Esc's entry rung, paste, cut, Backspace/Delete, Enter and Tab. It is a verb rather than a widened selection because the span starts at the row's LINE — its lead and its opener, structural bytes no anchor may name (ADR-0010) — which is exactly the difference `sliceNodes` already put back when it PROJECTED the same span, so a copy carried an opener a replacement then wrote inside. `null` removes the rows, taking the boundary that held them apart with them so the row count shrinks. What replaces them says WHOSE LANGUAGE it is in, which is the same distinction the `beforeinput` table draws: a STRING is the value's own projection and is spliced verbatim — this editor's own clipboard entry, and the `''` that is Enter's fresh row — while an ARRAY is LINES, each OPENED as a row at the covered rows' lead and kind, which is what a foreign clip is. Written verbatim instead, a foreign clip's `\r` survived into the value and its line break became a row boundary in a document whose separator is not one. It applies only where the selection is exactly a whole number of rows: a span running from mid-row into another one names bytes outside the rows it covers, so it falls through to the ordinary replacement. Typing is deliberately not one of the four — a character replaces the text that was selected and the row keeps its kind.

Caret navigation is otherwise the browser's: the container is the one editing host, so arrows and Home/End move natively and no core keyboard handler intercepts them. (Core's `OverlayListModel` does claim ArrowUp/ArrowDown/Enter while a list component is mounted — the adapter component only activates it.) The selection is not a feature of its own: `store.tokens.selection` is the stored anchor pair (see below).

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

## Rows

A document that never splits (`separator={null}`): tokens render in one flow as alternating `[text, mark, text, ...]`.

With rows (any non-empty `separator`, with `draggable` adding the reorder affordance): each root node
is a ROW, wrapped in a `<Row>` component that renders the row's children and nothing else. The
row controls — grip, drop indicator, row menu — are not in the row. One `<RowControls>` per editor
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

A KIND'S COMPONENT IS A SLOT COMPONENT and it takes three things it must pass on: the `ref` that
binds the row's element, the `className` and the `style` core resolved for it. It also decides
where the row's own inline `children` and its child `rows` go, and a component that paints neither
is a contract rather than a bug — core cannot see whether a component reads a prop, so a kind that
drops `rows` keeps its children in the value and off the screen, and a kind that drops `children`
is an ATOMIC row whose text round-trips and drags and has no editable surface. Anything ELSE such
a component paints is document content until it says otherwise: every element inside the one
editing host is text the caret can enter and the browser can edit, and `bind`'s sibling freeze does
not reach it — that walk runs from a MARK's root down to its slot host, and a row IS its own host.
A checkbox, a toggle arrow or a language `<select>` therefore takes `useControlRef()`, the adapter
hook over `TokenModel.control()`, which writes the `contenteditable="false"` that makes it atomic
and puts it on the path the DOM→model walk stops at.

TAKING NO CARET IS A CALL AND NOT A CONSEQUENCE, and the difference is what a user meets. Dropping
`children` is what makes a row atomic in the VALUE; it does nothing to the DOM, so an unfrozen
atomic row is a panel a click or an ArrowDown parks a blinking caret inside, where every keystroke
is silently swallowed. An atomic kind wraps its whole interior in one element carrying
`useControlRef()`. It also OWES ITS OWN CONTENT A SEED — `menu.text` on its `/` entry — because an
empty atomic body can never be filled through the editor, and after such an insert the caret has
nowhere to go at all: `choose` turns THIS ROW into the kind, so nothing a consumer writes asks for
the empty row underneath.

A ROW MAY CARVE ITS OWN BODY instead of nesting under it. A kind declaring `split: {at, as}` has
its body taken apart at the literal, and each piece is an ordinary Row of the option `as` names —
a table cell is not a node kind of its own. The delimiter a piece was carved at is its `lead`,
exactly as an indent run is, so the round trip is concatenation; `as` may be an option carrying
`row` with no markup at all, an anonymous kind nothing scans. The tree reads this from the
children being inline-then-rows — a row whose FIRST child is a row has no inline content — and
three readings follow: such a row's body IS its children, so `slot()` and `slotRange()` read them
and `lineRange()` covers them; the pre-order walk never names one, so no separator is ever written
between pieces; and the row takes no indent-nested children, since its children are its body. The
carve goes one level, so a kind naming itself terminates, and a piece cannot contain its own
delimiter.

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
refuses a placement INSIDE the moved subtree, because a row cannot become its own descendant. Every
other refusal is one question asked once: the scan is REPLAYED over the span the splice rewrites,
plus the row after it, and a placement whose bytes the scan would read back as a different tree is
declined. That covers a placement under an EMPTY row, a move that would re-lead a row carrying
children into an empty one, and a move that would change where a row it never touched parses — the
last reachable only past a row whose lead carries a surplus indent run, which is held at its depth
by the row above it and by nothing else. Refused rather than widened: normalizing that row's lead
rewrites bytes outside the move, and it cascades into the row after it. A move leaves the caret
alone: every node keeps its content and its identity, and a lead is the ROW's bytes and lives in no
text node, so no anchor can name one.

`setDepth(depth)` re-indents a row and asks the same question the same way. It rewrites the row's
whole lead AND ITS SUBTREE'S, by the same depth delta the mover uses, because nesting is indentation
and nothing else: a child left at its old lead is measured against a parent that moved, so writing
only the row's own lead detached the children of every row a Tab indented. The scan is replayed over
the lines it rewrites plus the row after them, so a re-indent whose bytes the scan would read back as
a different tree is declined — a blank row outdented to a root EMPTIES itself and cannot keep the
children it was carrying, and a surplus-lead row after the subtree cannot be re-parented by a ceiling
this splice raised. What it does NOT refuse is a following SIBLING becoming a child: outdenting a row
leaves the rows after it at a depth its own new depth now grants, which is the encoding's answer and
the outliner's.

Two answers the encoding forces rather than chooses, both from "an empty row takes no children":
retyping a depth-0 row to an empty paragraph PROMOTES its children to roots (their surplus indent
survives verbatim in `lead`), and no verb can write an empty parent.

`RowController` (`store.rows`) owns them for the whole editor, as four signals
addressed by row id:

```typescript
class RowController {
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

The price is geometry: `.Row { position: relative }` made a per-row grip free, while a layer
measures. `boxOf(id)` answers a row's OWN LINE in CONTAINER-LOCAL coordinates (which carry
`scrollTop`, so they are scroll-proof) — the element's box, stopped at its first painted child
row, because a parent's element encloses its subtree and a grip band the height of a subtree
centres its button on the child's line. `rowAt(clientY)` hit-tests a pointer with a binary
search over the vertically tiled ROOTS and then a recursive descent into the hit row's own child
rows — nesting takes the flat search's only sorted axis away, because a parent's box CONTAINS its
children's, and the row under the pointer is the deepest one whose box holds it. Past a root's box
the walk continues to the subtree's LAST painted line, which is the line such a point is actually
below. A row that is not painted has no box at all, so every probe is `getClientRects().length`
and both walks step over a collapsed subtree rather than ordering by a coordinate that does not
exist. Hover is therefore geometric rather than DOM containment: the drag gutter hovers its row,
and a point in the gap between two rows snaps to the nearest.

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
so a row that has left the tree refuses. The drop is addressed by id too: its rows are
`state.dragging` widened to `store.rows.selected` when the gripped row is part of that selection,
each resolved through the live tree, and they are moved as a SET in one splice by
`store.rows.move(placement)`. The placement itself is resolved at `dragover`: the pointer's Y
names a gap, its X names one of the depths that gap legally offers, and every candidate is planned
by the mover before it is offered — so `state.drop` carries the placement that will happen
together with the line that says so.

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
- **DOM I/O — the private `SelectionDriver`** (`dom/SelectionDriver.ts`). It owns the `selectionchange` sync, the `focusout` clear, the caret application and the editing host's `contenteditable`. Its externally-needed members are delegated on the model: `tokens.domAnchors()` (the live browser selection as anchors) and `tokens.focusFirst()`. The same sync the `selectionchange` listener runs is also driven on demand, but INSIDE the layer rather than from the outside: `createTransactions` takes it as its `syncSelection` dep and calls it at the write gate every verb passes, because `selectionchange` is delivered on a task and an edit arriving before it would otherwise be recorded and repaired against the older reading. It runs after the gate's refusals, so an edit that is declined moves nothing.
- The driver's ONE direct DOM write is the editing host itself — `container.contentEditable`, gated by `props.readOnly`. Everything else goes through the model's own `DomModel` — `placeCaret(anchor)` / `selectRange(anchor, head)` — which the driver holds as a dep. DOM→anchor boundary mapping (`dom/domBoundary.ts`) and caret placement (`dom/caret.ts`) live entirely inside the token layer and are not exported from `@markput/core`.
- The selection is re-applied after every bind: the driver's `onMounted` hook watches `tokens.bound` (one pulse per bind, so every handle matches an element in the document) and the stored anchors, re-running the placement against the live surfaces. It is the DOM clock and not the commit clock because a caret landing in a node BORN by the commit has no handle until bind makes one.
- Editable policy is one host deep and nothing sweeps: `props.readOnly` writes the container's own `contenteditable` through the driver, and the topology below it (bare text surfaces, `ce=false` value marks, bare slot marks with frozen controls) is applied once per bind.

### Token layer: `store.tokens`

`TokenModel` is the thin public shell over a live-node core — `dom/TokenHandle.ts` (the per-token live binding), `dom/commit.ts` (the one commit pipeline), and `dom/bind.ts` (the DOM walk that binds freshly rendered DOM). It consolidates the DOM responsibilities that were previously split across separate ref/index/surface modules:

- **Adapter ref registries** — `tokens.control()` and `tokens.children(ownerId, part?)` register non-editable control elements and child-sequence hosts (`'inline'`, the default, is a mark's `__slot__` host or a row's own element; `'rows'` is a row's child-ROWS host), and `tokens.consign(id)` registers a token's own element — a row's own wrapper included, since a row IS a token (ADR-0009). All are keyed by the owning token's stable id. A Mark's registered element is the box-less wrapper markput renders around it, not the consumer's component — so no consumer needs to forward a ref, and core writes attributes only to elements it owns.
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

```typescript fragment
const { style, close, select, choose, rows, active, activate, match, ref } = useOverlay()
```

| Property  | Type                                          | Description                                    |
| --------- | --------------------------------------------- | ---------------------------------------------- |
| `style`   | `{ left, top }`                               | Positioning coordinates                        |
| `close`   | `() => void`                                  | Close the overlay                              |
| `select`  | `(value: { value, meta? }) => void`           | Select an overlay item                         |
| `choose`  | `(pick: OverlayPick) => bool`                 | The one accept path; `{option}` retypes the row |
| `rows`    | `readonly OverlayRow[]`                       | The list on offer, already narrowed by the query |
| `active`  | `number`                                      | Index of the highlighted row; `NaN` for none   |
| `activate`| `() => () => void`                            | Bind ↑↓/Enter; returns the unbind              |
| `match`   | `OverlayMatch`                                | Current trigger match                          |
| `ref`     | `RefObject<HTMLElement>`                      | Ref to attach to overlay DOM                   |

### useMarkput

Subscribes to the store through a selector; `useStore` is the adapters' own internal context read and is not published:

```typescript
const readOnly = useMarkput(s => s.props.readOnly)
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
    paragraph: MyCustomParagraph,  // the row with NO kind; a kind brings its own
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

### Pattern: Rows With Drag

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

- [How It Works](/development/how-it-works) - Understanding how Markput processes text
- [Rows and Nesting](/guides/rows) - The separator, the indent, selection, drag and history
- [Row Kinds](/guides/row-kinds) - Declaring the markup a row is recognised by
- [Performance](/development/performance) - Detailed performance analysis
