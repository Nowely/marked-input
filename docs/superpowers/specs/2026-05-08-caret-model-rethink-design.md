# CaretModel rethink — design

Date: 2026-05-08
Branch: b0
Owner: @nowely

## Goals

1. Replace the rudimentary `CaretModel` (two raw signals + five verbose
   `start*/clear*` methods) with a single coherent class that owns caret
   state, the DOM listeners that produce caret events, and the
   semantic-level commands that operate on caret state.
2. Delete the parallel static `Caret` utility class. Its responsibilities
   split into two homes: caret-state semantics on `CaretModel`, and
   stateless DOM-coordinate primitives in a new `caretDom.ts` module.
   Keeping these at distinct abstraction levels avoids the
   `setAt(pos)` (writes signal) vs `setAtElement(el, offset)` (writes
   browser selection, ignores model) footgun.
3. Keep dependencies honest: only `lifecycle` and `dom` remain. The current
   ad-hoc cross-references to `parsing`, `value`, and `slots` move to the
   features they actually belong to.
4. Land the change as four reviewable phases. Each phase is independently
   testable, shippable, and revertible.
5. Preserve all observable behaviors: focus tracking, drag-select, Ctrl+A,
   restoration after re-render, drag-mode suppression of restoration.

## Non-goals

- Adding `caret` / `onCaretChange` props (no controlled mode).
- Splitting state from behavior into `CaretModel` + `CaretController`.
- Renaming the `selecting` signal to `mode`. The new shape collapses the
  five `start*/clear*` wrapper methods into direct signal writes; the
  signal itself keeps its name to minimize call-site churn.
- Block-mode keyboard semantics. Ctrl+A behavior in block mode stays
  identical, only its bail check moves out of caret.
- Designing a long-term home for the DOM-coordinate helpers used by
  `blockEdit.ts`. They land as plain function exports in `caretDom.ts`;
  promoting them into a future block-navigation module is a separate
  decision.

## Final file structure

```
packages/core/src/features/caret/
  CaretModel.ts          (rewritten; owns state + listeners + restoration)
  CaretModel.spec.ts     (rewritten)
  caretDom.ts            (NEW; stateless DOM-coordinate helpers)
  caretDom.spec.ts       (NEW; ports relevant Caret.spec.ts cases)
  TriggerFinder.ts       (caller-update only, no caret dep)
  TriggerFinder.spec.ts  (unchanged)
  index.ts               (re-exports CaretModel, caretDom helpers, TriggerFinder)
  README.md              (rewritten)
```

Deleted (across the four phases):

- `Caret.ts` and `Caret.spec.ts`
- `focus.ts` and `focus.spec.ts`
- `selection.ts` and `selection.spec.ts`
- `selectionHelpers.ts`

## Final API — `CaretModel`

```ts
class CaretModel {
  // ----- state -----
  readonly range:     Signal<RawRange | undefined>
  readonly selecting: Signal<'drag' | 'all' | undefined>     // name preserved

  // ----- derived -----
  readonly isCollapsed: Computed<boolean>
  readonly position:    Computed<number | undefined>          // collapsed position; undefined when extended
  readonly selection:   Computed<RawRange | undefined>        // extended range; undefined when collapsed

  constructor(lifecycle: Lifecycle, dom: DomController)

  // ----- pure commands -----
  setAt(pos: number): void
  select(range: RawRange): void
  collapse(side: 'start' | 'end'): void

  // ----- semantic (DOM-touching) -----
  selectAll(): void                                           // unconditional; caller decides eligibility
  isFullSelection(): boolean
}
```

The five start/clear methods are removed. Mode transitions become direct
signal writes (`caret.selecting('drag')`, `caret.selecting(undefined)`).
There is no `clear()` — no call site resets both `range` and `selecting`
atomically (verified by grep).

`selectAll()` is defined explicitly to avoid the implicit-dependency
footgun the review flagged:

1. Read `dom.container()`. Abort if missing.
2. Read `container.firstChild` and `container.lastChild`. Abort if either missing.
3. `window.getSelection()?.setBaseAndExtent(firstChild, 0, lastChild, 1)`.
4. `selecting('all')`.
5. Read `dom.readRawSelection()`. If `ok`, write `range(value.range)`. This
   is the explicit step — without it, the new `range` arrives only when
   the global `selectionchange` listener fires, which is a hidden contract.

## Final API — `caretDom.ts`

Stateless plain-function exports. Nothing here reads or writes
`CaretModel`. Each takes an `HTMLElement` (or no argument for `getRect`)
and operates on `window.getSelection()`. This is the abstraction level
`blockEdit.ts` and a few keyboard handlers actually need.

```ts
// caretDom.ts
export function setAtElement(el: HTMLElement, offset: number): void
export function setAtX(el: HTMLElement, x: number, y?: number): void
export function getCaretIndex(el: HTMLElement): number
export function getRect(): DOMRect | null
export function isOnFirstLine(el: HTMLElement): boolean
export function isOnLastLine(el: HTMLElement): boolean
```

| `caretDom.*` function | Replaces | Notes |
| --- | --- | --- |
| `setAtElement(el, offset)` | `Caret.setIndex` / `Caret.setCaretToEnd` / `Caret.trySetIndex` | TreeWalker walk; `Infinity` clamps to end. Body wraps in try/catch and logs to `console.error` so the legacy `try*` variant disappears. |
| `setAtX(el, x, y?)` | `Caret.setAtX` | Coordinate-based positioning via `caretRangeFromPoint` / `caretPositionFromPoint`. |
| `getCaretIndex(el)` | `Caret.getCaretIndex` | Visual offset within `el` via cloned Range. |
| `getRect()` | `Caret.getCaretRect` | Bounding rect of current caret. |
| `isOnFirstLine(el)` | `Caret.isCaretOnFirstLine` | Line-edge check. |
| `isOnLastLine(el)` | `Caret.isCaretOnLastLine` | Line-edge check. |

Removed without replacement (unused after migration, verified by grep):

- `Caret.getCurrentPosition` → `TriggerFinder` reads `window.getSelection()?.anchorOffset` directly.
- `Caret.getFocusedSpan` → `TriggerFinder` reads `node.textContent` directly.
- `Caret.getSelectedNode` → `TriggerFinder` reads `window.getSelection()?.anchorNode` directly.
- `Caret.isSelectedPosition` → `TriggerFinder` reads `window.getSelection()?.isCollapsed` directly.
- `Caret.getAbsolutePosition`, `Caret.getIndex`, `Caret.setIndex1`, `Caret.setCaretRightTo` → all unused (the trailing `//TODO refact caret` block).

## Final API — `DomController` tweaks

```ts
class DomController {
  constructor(
    lifecycle: Lifecycle,
    props: PropsModel,
    parsing: ParseController,
    value: ValueModel,
  )                                                            // caret param removed

  readonly indexed = event<void>()                             // NEW; fired at end of #commitRendered

  reconcile(opts?: {selecting?: boolean}): void                // selecting flag passed in by CaretModel

  placeAt(rawPos: number, affinity: 'before' | 'after' = 'after'): Result<{applied: number}, 'notIndexed' | 'invalidBoundary'>
  // renamed from placeCaretAtRawPosition; affinity is RETAINED (used by arrowNav.ts:63,66)

  placeRange(range: RawRange): Result<{applied: RawRange}, 'notIndexed' | 'invalidBoundary'>
  // promoted from #placeSelection
}
```

Two API contract decisions deserve calling out:

**`indexed` event over watcher-order**. Today
`DomController.#commitRendered()` calls `#applyRangeToDOM()`
synchronously — the dependency is in the call graph. After the refactor,
caret restoration is a separate watcher; relying on it firing after
DomController's own `lifecycle.rendered` watcher is fragile. The
`indexed` event makes the dependency explicit: CaretModel
`watch(dom.indexed, …)` instead of `watch(lifecycle.rendered, …)`. The
event is emitted unconditionally at the end of `#commitRendered`,
including the queued-render branch.

**`reconcile({selecting})` opts param**. `#reconcileStructuralTextSurfaces`
at `DomController.ts:625` reads `this.caret.selecting()` to decide
`contentEditable`. Removing the `caret` constructor dep without breaking
this requires either (a) passing the flag in or (b) keeping a
`getSelecting: () => …` callback. Option (a) is cleaner — `reconcile`
is already the seam — and CaretModel calls
`dom.reconcile({selecting: this.selecting() === 'drag'})` from its
drag-mode effect.

**Internal clamping**. Both `placeAt` and `placeRange` clamp the input
against `value.current().length` internally and return the clamped value
as `applied`. The previous external-clamping logic in
`#applyRangeToDOM` (lines 781–787) collapses into the `placeAt`/
`placeRange` bodies.

**Removed**. `#applyRangeToDOM` is gone (its logic now lives in
CaretModel). The `{readOnly, selecting}` watcher in DomController's
`onMounted` reduces to a `readOnly` watcher. The `enableFocus` /
`enableSelection` imports and calls go away.

## Final Store wiring

```ts
readonly lifecycle = new Lifecycle()
readonly props     = new PropsModel()
readonly value     = new ValueModel(this.props)
readonly mark      = new MarkFeature(this.props)
readonly slots     = new SlotsFeature(this.props)
readonly parsing   = new ParseController(this.lifecycle, this.value, this.mark, this.props, this.slots)
readonly dom       = new DomController(this.lifecycle, this.props, this.parsing, this.value)
readonly caret     = new CaretModel(this.lifecycle, this.dom)
readonly overlay   = new OverlayController(this.lifecycle, this.props, this.value, this.dom, this.caret, this.parsing)
readonly keyboard  = new KeyboardController(this.lifecycle, this.dom, this.value, this.caret, this.slots, this.parsing, this.props)
readonly drag      = new DragController(this.props, this.value, this.parsing, this.caret)
readonly clipboard = new ClipboardController(this.lifecycle, this.value, this.dom, this.parsing, this.caret)
readonly handler   = new MarkputHandler(this.dom, this.overlay, this.parsing)
```

`caret` is constructed after `dom`. `dom` no longer takes `caret`.

## Phasing

The change lands in four reviewable phases. Each phase is shippable and
revertible on its own. Tests pass after each phase.

### Phase 1 — `CaretModel` API surface

**Scope.** Add the new state/derived/command surface to `CaretModel`
without touching listener wiring. Migrate every collapsed-range write to
the new `setAt` ergonomic.

**Adds to `CaretModel`:**

- `setAt(pos)`, `select(r)`, `collapse(side)` methods.
- `isCollapsed`, `position`, `selection` computed signals.
- `isFullSelection()` instance method (was `selectionHelpers.isFullSelection(store)`).
- `selectAll()` instance method (was `selectionHelpers.selectAllText(store, event)` minus the block-mode bail and `preventDefault`).

**Removes from `CaretModel`:**

- `startDragSelect`, `clearDragSelect`, `startAllSelect`, `clearAllSelect`,
  `endSelecting` methods. Callers write `caret.selecting('drag' | 'all' | undefined)` directly.

**Keeps for now:**

- Listener wiring still done via `enableFocus({…})` / `enableSelection({…})`
  in `DomController` — moved into CaretModel in Phase 2.

**Caller migration in this phase:**

Block-mode Ctrl+A bail (was in `selectionHelpers.selectAllText`) moves
into `keyboard/arrowNav.ts`:

```ts
// keyboard/arrowNav.ts (was: selectAllText(store, e))
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

`selectionHelpers.ts` is deleted at the end of this phase.

`selecting` mode writes:

| Today | After Phase 1 |
| --- | --- |
| `caret.startDragSelect()` | `caret.selecting('drag')` |
| `caret.clearDragSelect()` | `caret.selecting(undefined)` (only when current value is `'drag'` — preserve existing guard at call site) |
| `caret.startAllSelect()` | `caret.selecting('all')` |
| `caret.clearAllSelect()` | `caret.selecting(undefined)` |
| `caret.endSelecting()` | `caret.selecting(undefined)` |

Collapsed-range writes (~14 sites) become `setAt`:

| Site | Today | After Phase 1 |
| --- | --- | --- |
| `OverlayController.ts:114` | `caret.range({start: pos, end: pos})` | `caret.setAt(pos)` |
| `keyboard/input.ts:50, 87, 118, 272` | same | `caret.setAt(pos)` |
| `keyboard/blockEdit.ts:92, 104, 127, 143, 185, 193, 329` | same | `caret.setAt(pos)` |
| `ClipboardController.ts:59` | same | `caret.setAt(pos)` |
| `DomController.ts:787` | same | `caret.setAt(start)` |

**Tests.** `CaretModel.spec.ts` extends with: pure-command behavior,
derived-signal correctness, `isFullSelection`, `selectAll`. `selection.spec.ts`
and `focus.spec.ts` keep their current set (they cover wiring still in
`DomController`). Core test count grows from 313 → ≥ 320 in this phase.

**Risks.** Mechanical refactor; the 14 setAt-migration sites are simple
substitutions. The `selecting` writes preserve current guard semantics
(e.g. only-clear-if-currently-drag), since the wrapper methods today
already encode those guards.

### Phase 2 — Listener migration + restoration migration

**Scope.** Move all DOM listeners and range restoration into CaretModel.
DomController loses its `caret` constructor dep, gains the `indexed`
event, and accepts `{selecting}` opts on `reconcile`.

**Moves into CaretModel:**

- `enableFocus` body → private `#enableFocusTracking()`.
- `enableSelection` body → private `#enableSelectionTracking()`.
- `DomController.#applyRangeToDOM` → private `#applyRangeToDOM()` watching `dom.indexed`.
- Drag-mode reconcile effect: `effect(() => dom.reconcile({selecting: this.selecting() === 'drag'}))`.

**Moves into DomController:**

- Empty-editor click handler (was `focus.ts:41-48`) → private listener
  attached in `onMounted`. Uses existing `parsing` dep.

**DomController API changes:**

```ts
// constructor
constructor(lifecycle: Lifecycle, props: PropsModel, parsing: ParseController, value: ValueModel)

// new
readonly indexed = event<void>()

// changed
reconcile(opts?: {selecting?: boolean}): void

// removed
#applyRangeToDOM()
// previous {readOnly, selecting} watcher → readOnly only
```

`#commitRendered` ends with `this.indexed()` (in addition to existing
diagnostics). The queued-render branch fires `indexed` exactly once per
commit.

**CaretModel constructor:**

```ts
constructor(private readonly lifecycle: Lifecycle, private readonly dom: DomController) {
  lifecycle.onMounted(() => {
    this.#enableFocusTracking()
    this.#enableSelectionTracking()
    watch(dom.indexed, () => this.#applyRangeToDOM())
    effect(() => dom.reconcile({selecting: this.selecting() === 'drag'}))
  })
}

#applyRangeToDOM(): void {
  if (this.selecting() === 'drag') return
  const range = this.range()
  if (range === undefined) return

  const result = range.start === range.end
    ? this.dom.placeAt(range.start)
    : this.dom.placeRange(range)

  if (!result.ok) {
    this.range(undefined)
    return
  }
  this.range(result.value.applied)   // structural-equality dedup makes a no-op when applied === range
}
```

**Store reorder.** `caret` field moves below `dom`:

```ts
readonly dom   = new DomController(this.lifecycle, this.props, this.parsing, this.value)
readonly caret = new CaretModel(this.lifecycle, this.dom)
```

**Tests.**

- `focus.spec.ts` and `selection.spec.ts` deleted; relevant cases (mount
  attaches listeners, unmount detaches, drag-mode triggers reconcile)
  fold into `CaretModel.spec.ts`.
- The empty-container click test moves to `DomController.spec.ts`.
- `DomController.spec.ts`: clamping tests at 357–402 are rewritten to
  drive `dom.placeAt`/`dom.placeRange` directly (the `caret.range` write
  path is no longer in DomController). Existing assertions become
  assertions on the returned `applied` value.
- New `CaretModel.spec.ts` tests: `dom.indexed` triggers restoration;
  `selecting === 'drag'` suppresses restoration; failed placement clears
  range; structural-equality dedup prevents notify when applied equals
  current range.

Core test count grows again. Total ≥ 325 after Phase 2.

**Risks.**

- Subscription ordering: handled by switching to `dom.indexed`. CaretModel
  no longer races against DomController's `lifecycle.rendered` watcher.
- `reconcile({selecting})` change: callers inside DomController itself
  call `reconcile()` with no args (e.g. the `readOnly` watcher) —
  default-undefined keeps existing behavior. Only CaretModel passes the flag.
- `dom.indexed` from queued-render branch: the spec requires it fire
  exactly once per commit even when rerun is queued. Verified by reading
  `#handleRendered` — the queued branch re-enters `#commitRendered`,
  which itself ends with the event fire.

### Phase 3 — Static `Caret` deletion + `caretDom.ts`

**Scope.** Replace the static `Caret` class with stateless function
exports in `caretDom.ts`. Migrate all callers.

**Adds:**

- `packages/core/src/features/caret/caretDom.ts` with the six functions
  listed earlier.
- `packages/core/src/features/caret/caretDom.spec.ts` porting the
  existing `Caret.spec.ts` cases (TreeWalker math, line-edge edge cases).

**Migrates:**

- `keyboard/blockEdit.ts` — every `Caret.*` call site:

| Today | After |
| --- | --- |
| `Caret.getCaretIndex(blockDiv)` | `caretDom.getCaretIndex(blockDiv)` |
| `Caret.setCaretToEnd(prevBlock)` | `caretDom.setAtElement(prevBlock, Infinity)` |
| `Caret.setCaretToEnd(row)` | `caretDom.setAtElement(row, Infinity)` |
| `Caret.trySetIndex(row, 0)` | `caretDom.setAtElement(row, 0)` (now swallows internally) |
| `Caret.trySetIndex(nextBlock, 0)` | `caretDom.setAtElement(nextBlock, 0)` |
| `Caret.isCaretOnFirstLine(blockDiv)` | `caretDom.isOnFirstLine(blockDiv)` |
| `Caret.isCaretOnLastLine(blockDiv)` | `caretDom.isOnLastLine(blockDiv)` |
| `Caret.getCaretRect()` | `caretDom.getRect()` |
| `Caret.setAtX(prevBlockDiv, …)` | `caretDom.setAtX(prevBlockDiv, …)` |

- `caret/TriggerFinder.ts` — drop `Caret` import, read selection directly:

```ts
constructor(private readonly dom?: DomController) {
  const sel = window.getSelection()
  const node = sel?.anchorNode
  if (!node || !document.contains(node)) throw new Error('Anchor node of selection is not exists!')
  this.node = node
  this.span = node.textContent ?? ''
  this.dividedText = this.getDividedTextBy(sel?.anchorOffset ?? 0)
}

static find<T>(options, getTrigger, dom?: DomController) {
  if (!options) return
  if (!window.getSelection()?.isCollapsed) return     // was Caret.isSelectedPosition
  try { return new TriggerFinder(dom).find(options, getTrigger) } catch { return undefined }
}
```

`TriggerFinder` does not gain a `CaretModel` parameter. Its needs are
DOM-level (selection node + offset within text), which `window.getSelection()`
provides directly.

**Deletes:**

- `caret/Caret.ts`
- `caret/Caret.spec.ts`

**`caret/index.ts` final shape:**

```ts
export {CaretModel} from './CaretModel'
export {TriggerFinder} from './TriggerFinder'
export * as caretDom from './caretDom'
```

Consumers do `import {caretDom} from '@core/features/caret'` and call
`caretDom.setAtElement(el, 0)`. The namespace import keeps the call
sites self-documenting.

**Tests.** `caretDom.spec.ts` ports Caret.spec.ts coverage. Removing
`Caret.spec.ts` keeps the count steady. Total still ≥ 325.

**Risks.** Lowest of the four phases. Mechanical search-and-replace;
each call site changes shape but preserves semantics.

### Phase 4 — `DomController` placement API rename

**Scope.** Rename / promote the placement methods on DomController.
Single, mechanical phase isolated from caret concerns.

**Renames:**

- `placeCaretAtRawPosition(rawPos, affinity = 'after')` → `placeAt(rawPos, affinity = 'after')`. **Affinity parameter retained** (used by `arrowNav.ts:63` with `'before'` and `:66` with `'after'`).
- `#placeSelection(selection: RawSelection)` → public `placeRange(range: RawRange)`.

**Return shape extension:** both methods return
`Result<{applied: number | RawRange}, …>`. Internal clamping centralized
inside the methods (no change for `arrowNav` — its inputs are already
valid token boundaries; the clamp is a no-op on the happy path).

**Caller updates:**

| Today | After Phase 4 |
| --- | --- |
| `DomController.ts:791` (was inside `#applyRangeToDOM`, moved to CaretModel in Phase 2) | uses `placeAt`/`placeRange` with `applied` return |
| `arrowNav.ts:63,66` | `placeAt(pos, 'before' | 'after')` — name change only |
| `DomController.spec.ts:337` | assertion updated to new name and return shape |

**Tests.** `DomController.spec.ts` cases for `placeCaretAtRawPosition`
get renamed and gain coverage of the `applied` return value. Net count
neutral or slight growth.

**Risks.** Test assertions need updating across ~6 call sites. The
return-shape change is the only non-mechanical part.

## Block-mode Ctrl+A bail — single phase

The bail check (`if (slots.isBlock()) return`) and `event.preventDefault()`
move from `selectionHelpers.selectAllText` to `keyboard/arrowNav.ts` in
Phase 1. This is a 2-line move tightly coupled to the deletion of
`selectionHelpers.ts`. Splitting it into its own PR (as the review
suggested) was considered and rejected: the move only makes sense once
`caret.selectAll` exists as the unconditional command, and `caret.selectAll`
ships in Phase 1. Keeping the move in the same phase keeps the change
self-consistent.

## README sketch

`caret/README.md` rewrite, summarizing the post-Phase-3 layout:

> # Caret feature
>
> Owns the editor's caret state and the listeners that produce caret
> events. Stateless DOM-coordinate primitives live alongside in
> `caretDom.ts`.
>
> ## CaretModel
>
> | Signal / computed | Purpose |
> | --- | --- |
> | `range` | Source of truth. Collapsed when `start === end`. |
> | `selecting` | Active interaction mode (`'drag'` / `'all'`) or `undefined`. |
> | `isCollapsed`, `position`, `selection` | Derived. Use `position` when only the cursor matters; use `selection` when only the extended range matters. |
>
> | Command | Purpose |
> | --- | --- |
> | `setAt(pos)` | Collapsed write. |
> | `select(range)` | Ranged write. |
> | `collapse(side)` | Collapse current range to `'start'` or `'end'`. |
> | `selectAll()` | Place full-container selection in DOM and write `range` + `selecting('all')`. Caller decides eligibility. |
> | `isFullSelection()` | True when active browser selection spans the container. |
>
> Listeners (focus, selection, mouse-drag) and post-render restoration are
> internal. CaretModel watches `dom.indexed` for restoration.
>
> ## caretDom
>
> Plain functions for DOM-coordinate caret manipulation. No state. Used
> by block-level navigation in `keyboard/blockEdit.ts`:
>
> `setAtElement(el, offset)`, `setAtX(el, x, y?)`, `getCaretIndex(el)`,
> `getRect()`, `isOnFirstLine(el)`, `isOnLastLine(el)`.

## Risks and open questions

### Risks

- **`dom.indexed` semantics.** Must fire exactly once per
  `#commitRendered`, including the queued-render re-entry. Verified by
  reading `#handleRendered`: the queued branch re-enters
  `#commitRendered` synchronously, so a single `this.indexed()` at the
  end of `#commitRendered` is correct.
- **`reconcile({selecting})` opts spread.** Existing callers inside
  DomController call `reconcile()` with no args. Default `undefined` for
  `opts.selecting` produces the same `editable` flag computation today
  (`undefined` is falsy, equivalent to `selecting() === undefined`).
- **Phase 2 store reorder.** `caret` moves below `dom`. The
  `OverlayController` / `KeyboardController` / `DragController` /
  `ClipboardController` constructor lists already accept `caret` —
  reordering field initialization order doesn't change their access
  pattern.
- **`affinity` parameter retention.** Confirmed used at `arrowNav.ts:63,66`
  and `DomController.spec.ts:337`. Phase 4 keeps it.

### Open questions

None. All design decisions resolved.
