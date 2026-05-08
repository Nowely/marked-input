# CaretModel rethink — design

Date: 2026-05-08
Branch: b0
Owner: @nowely

## Goals

1. Replace the rudimentary `CaretModel` (two raw signals + five verbose
   `start*/clear*` methods) with a single coherent class that owns caret
   state, the DOM listeners that produce caret events, and the imperative
   DOM commands that act on the caret.
2. Delete the parallel static `Caret` utility class — its responsibilities
   collapse into `CaretModel` instance methods so that all caret behavior
   has a single owner.
3. Keep dependencies honest: only `lifecycle` and `dom` remain. The current
   ad-hoc cross-references to `parsing`, `value`, and `slots` move to the
   features they actually belong to.
4. Preserve all observable behaviors: focus tracking, drag-select, Ctrl+A,
   restoration after re-render, drag-mode suppression of restoration. This
   is a refactor, not a feature change.

## Non-goals

- Adding `caret` / `onCaretChange` props (no controlled mode). `model()`
  primitive earns its keep when controlled-vs-internal indirection exists;
  caret has none today.
- Splitting state from behavior into `CaretModel` + `CaretController`. The
  class is named `CaretModel` and owns both. Naming convention isn't strict
  — deps are acceptable when justified.
- Changing the `RawRange` type, the `selecting` mode literals
  (`'drag' | 'all'`), or the `lifecycle` / `dom` public API beyond the
  specific tweaks listed below.
- Block-mode keyboard semantics. Ctrl+A behavior in block mode stays
  identical, only its bail check moves out of caret.

## File structure

```
packages/core/src/features/caret/
  CaretModel.ts          (rewritten; absorbs Caret.ts, focus.ts, selection.ts, selectionHelpers.ts)
  CaretModel.spec.ts     (rewritten to cover new surface)
  TriggerFinder.ts       (updated callers; no other change)
  TriggerFinder.spec.ts  (unchanged)
  index.ts               (re-exports CaretModel and TriggerFinder only)
  README.md              (rewritten)
```

Deleted:

- `Caret.ts` and `Caret.spec.ts`
- `focus.ts` and `focus.spec.ts`
- `selection.ts` and `selection.spec.ts`
- `selectionHelpers.ts`

`focus.spec.ts` and `selection.spec.ts` test cases relevant to the new
listener wiring fold into `CaretModel.spec.ts`.

## API — `CaretModel`

```ts
class CaretModel {
  // ----- state -----
  readonly range: Signal<RawRange | undefined>
  readonly mode:  Signal<'drag' | 'all' | undefined>

  // ----- derived -----
  readonly isCollapsed: Computed<boolean>
  readonly position:    Computed<number | undefined>
  readonly selection:   Computed<RawRange | undefined>

  constructor(lifecycle: Lifecycle, dom: DomController)

  // ----- pure commands (no DOM) -----
  setAt(pos: number): void
  select(range: RawRange): void
  collapse(side: 'start' | 'end'): void
  clear(): void                                // range = undefined, mode = undefined

  // ----- semantic (DOM-touching) -----
  selectAll(): void                            // unconditional; caller decides eligibility
  isFullSelection(): boolean

  // ----- DOM commands (replace static Caret) -----
  setAtElement(el: HTMLElement, offset: number): void
  setAtX(el: HTMLElement, x: number, y?: number): void
  getCaretIndex(el: HTMLElement): number
  getRect(): DOMRect | null
  isOnFirstLine(el: HTMLElement): boolean
  isOnLastLine(el: HTMLElement): boolean
}
```

### State

| Signal | Definition | Purpose |
| --- | --- | --- |
| `range` | `signal<RawRange \| undefined>(undefined, {equals: structural})` | Source of truth. Collapsed (start === end) or extended. Single signal covers both cursor and selection. |
| `mode`  | `signal<'drag' \| 'all' \| undefined>(undefined)` | Interaction mode. Replaces today's `selecting`. `'drag'` = active mouse drag-select; `'all'` = active Ctrl+A; `undefined` = no special mode. |

`range` keeps the structural-equality dedupe from today's implementation
to preserve "no spurious notify when start/end unchanged" semantics covered
by `CaretModel.spec.ts`.

### Derived

| Computed | Definition |
| --- | --- |
| `isCollapsed` | `() => { const r = range(); return !!r && r.start === r.end }` |
| `position`    | `() => isCollapsed() ? range()?.start : undefined` |
| `selection`   | `() => isCollapsed() ? undefined : range()` |

`position` and `selection` give callers that only care about one shape a
clean read primitive without forcing them to interpret `range`. Internal
implementation reads `range` directly when both shapes are valid (e.g.
restoration).

### Pure commands

| Command | Behavior |
| --- | --- |
| `setAt(pos)` | `range({start: pos, end: pos})`. Mode is unchanged. |
| `select(r)` | `range(r)`. Mode is unchanged. If `r.start === r.end`, equivalent to `setAt`. |
| `collapse(side)` | `range({start: r[side], end: r[side]})` if `r` exists; no-op otherwise. |
| `clear()` | `range(undefined)` and `mode(undefined)`. |

The five start/clear methods (`startDragSelect`, `clearDragSelect`,
`startAllSelect`, `clearAllSelect`, `endSelecting`) are removed. Callers
write `mode('drag')`, `mode('all')`, or `mode(undefined)` directly. The
single signal replaces the verb-based wrapper layer.

### Semantic commands

```ts
selectAll(): void
```

Sets the browser selection across the entire container and writes
`mode('all')`. Unconditional — the caller (KeyboardController) is
responsible for deciding when it's appropriate (e.g. bailing in block mode
to let the browser handle Ctrl+A within the focused block). Steps:

1. Read `dom.container()`. If unavailable, return.
2. Read `container.firstChild` and `container.lastChild`. If either
   missing, return.
3. `window.getSelection()?.setBaseAndExtent(firstChild, 0, lastChild, 1)`.
4. `mode('all')`.

Does not call `event.preventDefault()` — that's a keyboard-event concern
owned by KeyboardController.

```ts
isFullSelection(): boolean
```

Returns true when the active browser selection spans the container with
non-empty text content. Logic mirrors today's `isFullSelection(store)`
helper exactly. Reads `window.getSelection()` and `dom.container()`.

### DOM commands

Replace today's static `Caret` class. Each is an instance method with the
same semantics as its static counterpart:

| New method | Replaces | Notes |
| --- | --- | --- |
| `setAtElement(el, offset)` | `Caret.setIndex` / `Caret.setCaretToEnd` | TreeWalker walk, `Infinity` clamps to end. Wraps the old `try/catch trySetIndex` body internally — callers no longer need a try variant; the method swallows and `console.error`s. |
| `setAtX(el, x, y?)` | `Caret.setAtX` | Coordinate-based positioning via `caretRangeFromPoint` / `caretPositionFromPoint`. |
| `getCaretIndex(el)` | `Caret.getCaretIndex` | Visual offset within `el` via cloned Range. |
| `getRect()` | `Caret.getCaretRect` | Bounding rect of current caret. |
| `isOnFirstLine(el)` | `Caret.isCaretOnFirstLine` | Line-edge check. |
| `isOnLastLine(el)` | `Caret.isCaretOnLastLine` | Line-edge check. |

Removed without replacement (unused after migration):

- `Caret.getCurrentPosition` → TriggerFinder reads `window.getSelection()?.anchorOffset` directly (it needs the DOM-local offset within the text node, not a `RawRange`).
- `Caret.getFocusedSpan` → TriggerFinder reads `node.textContent` directly.
- `Caret.getSelectedNode` → TriggerFinder reads `window.getSelection()?.anchorNode` directly.
- `Caret.isSelectedPosition` → TriggerFinder reads `window.getSelection()?.isCollapsed` directly.
- `Caret.getAbsolutePosition` → unused in current codebase (verified by grep).
- `Caret.getIndex` / `Caret.setIndex1` / `Caret.setCaretRightTo` → unused / dead code (the trailing `//TODO refact caret` block).

## Lifecycle wiring

All listeners attach inside `lifecycle.onMounted`. `listen()` returns
disposers that the effect scope cleans up automatically.

```ts
constructor(lifecycle: Lifecycle, dom: DomController) {
  lifecycle.onMounted(() => {
    this.#enableFocusTracking()
    this.#enableSelectionTracking()
    watch(lifecycle.rendered, () => this.#applyRangeToDOM())
    effect(() => { if (this.mode() === 'drag') dom.reconcile() })
  })
}
```

### `#enableFocusTracking` (was `focus.ts`)

Listens on `dom.container()`:

| Event | Behavior |
| --- | --- |
| `focusin` | If target isn't an HTMLElement → `range(undefined)`. If `dom.locateNode(target)` is `{ok: false, reason: 'control'}` → no-op. Else if `dom.readRawSelection()` succeeds → `range(value.range)`; else `range(undefined)`. |
| `focusout` | Defer via `queueMicrotask`. After defer, if `document.activeElement` is outside the container → `range(undefined)`. |

The empty-editor `click` handler from today's `focus.ts:41-48` is **not**
in this method — see "Logic relocations" below.

### `#enableSelectionTracking` (was `selection.ts`)

Listens on `document` for the global selection events:

| Event | Behavior |
| --- | --- |
| `mousedown` | Track pressed node and `isPressed = true`. |
| `mousemove` | If pressed inside container, target diverged, and selection is inside container → `mode('drag')`. |
| `mouseup` | Reset press state. If `mode === 'drag'` and selection collapsed → `mode(undefined)`. |
| `selectionchange` | If `mode === 'drag'` and selection collapsed → `mode(undefined)`. Then resolve selection via `dom.locateNode` + `dom.readRawSelection` and write `range`. Skip when `locateNode` returns `{ok: false, reason: 'control'}`. |

### `#applyRangeToDOM` — restoration

Triggered via `watch(lifecycle.rendered, …)`. Replaces
`DomController.#applyRangeToDOM` exactly.

```ts
#applyRangeToDOM(): void {
  if (this.mode() === 'drag') return                       // preserve user drag
  const range = this.range()
  if (range === undefined) return

  const result = range.start === range.end
    ? this.dom.placeAt(range.start)
    : this.dom.placeRange(range)

  if (!result.ok) {
    this.range(undefined)
    return
  }
  this.range(result.value.applied)
}
```

The unconditional writeback is safe: the `range` signal carries a
structural-equality `equals`, so writing back an `applied` value equal
to the previous `range` is a no-op (no notify, no propagation). When
`applied` differs (clamping changed it), the signal updates as expected.

Subscription order: CaretModel registers its `lifecycle.rendered` watcher
inside its own `onMounted`. Because CaretModel is constructed after
DomController in the Store, DomController's index-rebuild runs first and
the caret restoration sees a fresh DOM index. Same pattern as
`ParseController` registering its `value.current` watcher first.

### Drag-mode reconcile effect

Replaces today's `DomController` watch on `caret.selecting`:

```ts
effect(() => { if (this.mode() === 'drag') dom.reconcile() })
```

The watcher in DomController's constructor that observed
`{readOnly, selecting}` is reduced to just `readOnly`.

## DomController API tweaks

### Constructor

```ts
constructor(
  lifecycle: Lifecycle,
  props: PropsModel,
  parsing: ParseController,
  value: ValueModel,
)
```

`caret` parameter removed. DomController no longer reads or writes caret
state directly.

### Public methods

```ts
placeAt(rawPos: number): Result<{applied: number}, 'notIndexed' | 'invalidBoundary'>
placeRange(range: RawRange): Result<{applied: RawRange}, 'notIndexed' | 'invalidBoundary'>
```

Both clamp internally against `value.current().length` (DomController
already takes `value`) and return the clamped value as `applied`.
`placeAt` is a renamed promotion of today's
`placeCaretAtRawPosition(rawPosition, affinity)` with the affinity
parameter dropped (callers always pass the default `'after'` today —
verified by grep). `placeRange` is a public version of today's private
`#placeSelection`.

The internal `#applyRangeToDOM` method is removed entirely (its logic
now lives in CaretModel). The `#commitRendered` call to it is replaced by
nothing — restoration is now driven by CaretModel's watcher on
`lifecycle.rendered`, which fires after DomController's own `rendered`
watcher (registered first inside DomController's `onMounted`).

### Empty-editor click handler

Moves into DomController as a private listener on the container. Wired
inside `onMounted`. Mirrors today's `focus.ts:41-48` exactly:

```ts
listen(container, 'click', () => {
  const tokens = parsing.tokens()
  if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
    const element = firstHtmlChild(container)
    element?.focus()
  }
})
```

DomController already has `parsing` as a constructor dep, so no new deps.

## Logic relocations

| Logic today | Today's location | New location | Why |
| --- | --- | --- | --- |
| Empty-editor click → focus first child | `focus.ts:41-48` | DomController private listener | Container interaction, not caret state |
| Range clamp via `value.current().length` | `DomController.#applyRangeToDOM` | `DomController.placeAt`/`placeRange` clamp internally | Index owner clamps; caret writes back applied value |
| Block-mode Ctrl+A bail (`if slots.isBlock() return`) | `selectionHelpers.selectAllText` | KeyboardController (caller of `caret.selectAll`) | Eligibility decision belongs to keyboard layer |
| Ctrl+A `event.preventDefault()` | `selectionHelpers.selectAllText` | KeyboardController (same site as bail) | Event handling stays with the event handler |

## Caller migration

### `TriggerFinder` (`features/caret/TriggerFinder.ts`)

Today reads four static methods on `Caret`. After migration, takes
`caret: CaretModel` instead of `dom?: DomController` (or alongside,
depending on existing call sites — see below) and reads from window
selection directly for the few cases that don't have a model equivalent.

```ts
class TriggerFinder {
  constructor(private readonly caret: CaretModel, private readonly dom?: DomController) {
    const sel = window.getSelection()
    const node = sel?.anchorNode
    if (!node || !document.contains(node)) throw new Error('Anchor node of selection is not exists!')

    this.node = node
    this.span = node.textContent ?? ''
    this.dividedText = this.getDividedTextBy(sel?.anchorOffset ?? 0)
  }

  static find<T>(options, getTrigger, caret: CaretModel, dom?: DomController) {
    if (!options) return
    if (!window.getSelection()?.isCollapsed) return  // was Caret.isSelectedPosition
    try { return new TriggerFinder(caret, dom).find(options, getTrigger) } catch { return undefined }
  }
}
```

Callers of `TriggerFinder.find` are updated to pass `store.caret` as the
new third argument. `OverlayController` is the only call site (verified
by grep).

### `blockEdit.ts` (`features/keyboard/blockEdit.ts`)

| Today | After |
| --- | --- |
| `Caret.getCaretIndex(blockDiv)` | `store.caret.getCaretIndex(blockDiv)` |
| `Caret.setCaretToEnd(prevBlock)` | `store.caret.setAtElement(prevBlock, Infinity)` |
| `Caret.setCaretToEnd(row)` | `store.caret.setAtElement(row, Infinity)` |
| `Caret.trySetIndex(row, 0)` | `store.caret.setAtElement(row, 0)` (now swallows internally) |
| `Caret.trySetIndex(nextBlock, 0)` | `store.caret.setAtElement(nextBlock, 0)` |
| `Caret.isCaretOnFirstLine(blockDiv)` | `store.caret.isOnFirstLine(blockDiv)` |
| `Caret.isCaretOnLastLine(blockDiv)` | `store.caret.isOnLastLine(blockDiv)` |
| `Caret.getCaretRect()` | `store.caret.getRect()` |
| `Caret.setAtX(prevBlockDiv, caretX, prevRect.bottom - 4)` | `store.caret.setAtX(prevBlockDiv, caretX, prevRect.bottom - 4)` |

### `KeyboardController`

Ctrl+A path (`features/keyboard/arrowNav.ts`):

```ts
// before
import {selectAllText} from '../caret'
selectAllText(store, e)

// after
if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
  if (store.slots.isBlock()) return
  e.preventDefault()
  store.caret.selectAll()
}
```

Full-selection check (`features/keyboard/input.ts`):

```ts
// before
import {isFullSelection} from '../caret'
if (selecting === 'all' && isFullSelection(store)) { … }

// after
if (selecting === 'all' && store.caret.isFullSelection()) { … }
```

### `DomController`

- `#applyRangeToDOM` removed.
- `placeCaretAtRawPosition` renamed to `placeAt` with affinity dropped, return type expanded to include `applied`.
- `#placeSelection` promoted to public `placeRange` with same return shape.
- Constructor signature loses the `caret` parameter.
- Imports of `enableFocus` / `enableSelection` from `../caret/focus` and `../caret/selection` removed.
- The `{readOnly, selecting}` watcher reduces to a `readOnly` watcher.

### `Store`

```ts
readonly lifecycle = new Lifecycle()
readonly props     = new PropsModel()
readonly value     = new ValueModel(this.props)
readonly mark      = new MarkFeature(this.props)
readonly slots     = new SlotsFeature(this.props)
readonly parsing   = new ParseController(this.lifecycle, this.value, this.mark, this.props, this.slots)
readonly dom       = new DomController(this.lifecycle, this.props, this.parsing, this.value)
readonly caret     = new CaretModel(this.lifecycle, this.dom)        // moved AFTER dom
readonly overlay   = new OverlayController(this.lifecycle, this.props, this.value, this.dom, this.caret, this.parsing)
readonly keyboard  = new KeyboardController(this.lifecycle, this.dom, this.value, this.caret, this.slots, this.parsing, this.props)
readonly drag      = new DragController(this.props, this.value, this.parsing, this.caret)
readonly clipboard = new ClipboardController(this.lifecycle, this.value, this.dom, this.parsing, this.caret)
readonly handler   = new MarkputHandler(this.dom, this.overlay, this.parsing)
```

`caret` moves down past `dom` because it now takes `dom` in its
constructor. `dom` no longer takes `caret`.

## `index.ts` changes

```ts
// before
export {Caret} from './Caret'
export {CaretModel} from './CaretModel'
export {isFullSelection, selectAllText} from './selectionHelpers'
export {TriggerFinder} from './TriggerFinder'

// after
export {CaretModel} from './CaretModel'
export {TriggerFinder} from './TriggerFinder'
```

## Testing strategy

Existing test counts to preserve: Core 313, React 171, Vue 157.

### `CaretModel.spec.ts` (rewritten)

Covers the new surface in three groups:

1. **State and derived** — range/mode independence, structural-equality
   dedupe (existing test preserved), `isCollapsed`/`position`/`selection`
   computed correctness, `clear()` resets both signals.
2. **Pure commands** — `setAt`, `select`, `collapse('start')`,
   `collapse('end')`, no-op when `range === undefined`.
3. **Lifecycle wiring** — listeners attach on `lifecycle.mounted`,
   detach on `unmounted` (idempotency test from today's
   `selection.spec.ts` preserved); drag-mode reconcile effect calls
   `dom.reconcile()`; restoration watcher fires on `lifecycle.rendered`
   and bails when `mode === 'drag'`.

Folded in from deleted spec files:

- `selection.spec.ts` (5 tests) → cases for `#enableSelectionTracking` +
  drag-mode reconcile.
- `focus.spec.ts` → cases for `#enableFocusTracking`. The
  empty-container click test moves to `DomController.spec.ts` since
  that listener now lives there.

### `DomController.spec.ts`

- New tests for `placeAt` and `placeRange` returning `{applied}` after
  internal clamping. The existing clamping tests at lines 357–402 are
  rewritten to assert on the returned `applied` value rather than on
  `caret.range()`.
- New test for empty-container click → focus first child (moved from
  `focus.spec.ts`).
- Remove the watcher test for `caret.selecting` driving `reconcile` —
  the watcher moved to CaretModel.

### React storybook (`packages/react/storybook/src/pages/Drag/Drag.spec.tsx`)

Drag mode flows touch caret restoration and Ctrl+A. The test count
(171) must remain stable; expected to need only minor selector touch-ups
if any. No semantic changes.

### Vue storybook

Same as React — no semantic changes; should continue to pass at 157.

## Risks and open questions

### Risks

- **TriggerFinder constructor signature change.** `OverlayController`
  is the only caller (verified by grep), so the blast radius is small,
  but the static `TriggerFinder.find` argument list grows by one. The
  spec adds `caret: CaretModel` as a new parameter rather than swapping
  for `dom` to keep diff-noise minimal at the call site.
- **DomController `placeCaretAtRawPosition` rename to `placeAt`.** The
  method name is referenced in tests and in
  `OverlayController`/`ClipboardController`/`KeyboardController` (grep
  confirms ~6 call sites). The rename + return-shape change is a
  mechanical update.
- **`affinity` parameter on `placeAt` dropped.** Today's signature is
  `placeCaretAtRawPosition(rawPosition, affinity = 'after')`. All
  callers use the default — verified by grep finding zero call sites
  passing a second argument. If a future caller needs `'before'`, it
  can be re-added without breaking existing calls.
- **Subscription ordering between DomController and CaretModel.** The
  spec relies on DomController's `lifecycle.rendered` watcher firing
  before CaretModel's. This holds because CaretModel is constructed
  after DomController in `Store`, and watchers fire in registration
  order. This is the same ordering invariant `ParseController` already
  depends on. Any future re-ordering of the Store fields needs to
  preserve it.

### Open questions

None. All design decisions resolved during brainstorming.
