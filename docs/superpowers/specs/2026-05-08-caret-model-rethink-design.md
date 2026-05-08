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
   split into three homes:
   - caret-state semantics on `CaretModel`,
   - stateless DOM-coordinate primitives in a new `caretDom.ts` module,
   - overlay positioning on `OverlayController` (no longer faked through
     a caret method that didn't really belong on Caret).
3. Keep dependencies honest: only `lifecycle` and `dom` remain. The current
   ad-hoc cross-references to `parsing`, `value`, and `slots` move to the
   features they actually belong to.
4. Land the change as four reviewable phases. Each phase is independently
   testable, shippable, and revertible.
5. Preserve all observable behaviors: focus tracking, drag-select, Ctrl+A,
   restoration after re-render, drag-mode suppression of restoration,
   overlay positioning.

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

## Public API impact (breaking)

`@markput/core` re-exports `Caret` from `packages/core/index.ts:56` and
documents it in `packages/core/README.md`. Phase 3 removes that export.
The `@breaking b0` header at the top of `packages/core/index.ts`
currently lists `CaretRecovery`; it gains a second entry:

```ts
/**
 * @breaking b0: `CaretRecovery` type removed. Replace with `store.caret.range()`.
 *   `MarkputState.recovery` and `value.change` no longer exist — the single source
 *   of truth is `CaretModel.range` (a `Signal<RawRange | undefined>`) applied to
 *   the DOM by `DomController` after every render.
 *
 * @breaking b0: `Caret` static utility class removed. Migration paths:
 *   - `Caret.getCaretIndex(el)`, `setIndex(el, n)`, `setCaretToEnd(el)`,
 *     `trySetIndex(el, n)`, `setAtX(el, x, y)`, `getCaretRect()`,
 *     `isCaretOnFirstLine(el)`, `isCaretOnLastLine(el)` → use the new
 *     `caretDom` module exports (`getCaretIndex`, `setAtElement`, `setAtX`,
 *     `getRect`, `isOnFirstLine`, `isOnLastLine`).
 *   - `Caret.getAbsolutePosition()` → use `store.overlay.position()` (the
 *     positioning math previously duplicated in adapter `useOverlay` hooks
 *     now lives in `OverlayController`).
 *   - `Caret.getCurrentPosition()`, `getSelectedNode()`, `getFocusedSpan()`,
 *     `isSelectedPosition` → call `window.getSelection()` directly; these
 *     were only used internally by `TriggerFinder`.
 *   - `Caret.getIndex`, `setIndex1`, `setCaretRightTo` → unused; no replacement.
 */
```

Phase 3 also:

- Adds `export {caretDom}` to `packages/core/index.ts` (namespace export,
  not flat function exports — keeps call sites self-documenting).
- Updates `packages/core/README.md` to drop `Caret` from the imports
  example (line 24), the `new Caret()` example (line 34), and the
  components list (line 71). Mentions `caretDom` in the new "Caret
  feature" section if useful.

## Final file structure

```
packages/core/src/features/caret/
  CaretModel.ts          (rewritten; owns state + listeners + restoration)
  CaretModel.spec.ts     (rewritten)
  caretDom.ts            (NEW; stateless DOM-coordinate helpers)
  caretDom.spec.ts       (NEW; ports relevant Caret.spec.ts cases)
  TriggerFinder.ts       (caller-update only, no caret dep)
  TriggerFinder.spec.ts  (rewritten — see Phase 3)
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
   The `1` is an offset *inside the container parent* (one position past
   `lastChild`), not inside `lastChild` itself — that's how
   `setBaseAndExtent`'s offset arguments work when the node is a child
   element. The implementation should carry a one-line comment to that
   effect so future readers don't second-guess it.
4. `selecting('all')`.
5. Read `dom.readRawSelection()`. If `ok`, write `range(value.range)`.
   This is the explicit step — without it, the new `range` arrives only
   when the global `selectionchange` listener fires, which is a hidden
   contract.

If `dom.index()` is unset (editor not yet indexed), step 5 returns
`{ok: false, reason: 'notIndexed'}` and `range` is left untouched. In
practice Ctrl+A only fires after mount when the editor is indexed, so
this is a graceful no-op rather than a behavior gap.

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
| `setAtElement(el, offset)` | `Caret.setIndex` / `Caret.setCaretToEnd` / `Caret.trySetIndex` | TreeWalker walk; `Infinity` clamps to end. Body wraps in try/catch and logs to `console.error` so the legacy `try*` variant disappears. **Behavior change called out below.** |
| `setAtX(el, x, y?)` | `Caret.setAtX` | Coordinate-based positioning via `caretRangeFromPoint` / `caretPositionFromPoint`. |
| `getCaretIndex(el)` | `Caret.getCaretIndex` | Visual offset within `el` via cloned Range. |
| `getRect()` | `Caret.getCaretRect` | Bounding rect of current caret. |
| `isOnFirstLine(el)` | `Caret.isCaretOnFirstLine` | Line-edge check. |
| `isOnLastLine(el)` | `Caret.isCaretOnLastLine` | Line-edge check. |

Removed without replacement (verified by grep; not used by any caller
inside core or in the React/Vue adapters):

- `Caret.getCurrentPosition` → `TriggerFinder` reads `window.getSelection()?.anchorOffset` directly.
- `Caret.getFocusedSpan` → `TriggerFinder` reads `node.textContent` directly.
- `Caret.getSelectedNode` → `TriggerFinder` reads `window.getSelection()?.anchorNode` directly.
- `Caret.isSelectedPosition` → `TriggerFinder` reads `window.getSelection()?.isCollapsed` directly.
- `Caret.getIndex`, `Caret.setIndex1`, `Caret.setCaretRightTo` → unused (the trailing `//TODO refact caret` block).

Migrated **out of caret** rather than into `caretDom`:

- `Caret.getAbsolutePosition` → moves to `OverlayController.position` (a
  `Computed<{left: number, top: number}>`). React and Vue adapter
  `useOverlay` hooks read `store.overlay.position()` instead of calling
  the old static method. Math (`{left: rect.left, top: rect.top + rect.height + 1}`)
  is preserved verbatim. See Phase 3.

### Behavior change in `caretDom.setAtElement`

`Caret.setIndex` (today) throws when the selection isn't usable. It is
called from two places:

- `Caret.trySetIndex` — wraps in try/catch and `console.error`s.
- `Caret.setAtX` (line 106) — calls `setIndex(element, Infinity)`
  directly, no try/catch.

The new `caretDom.setAtElement` swallows internally. Callers of
`caretDom.setAtX` (`blockEdit.ts:269,280`) therefore become infallible at
the line that today could theoretically throw. This is strictly
improving — there's no recovery the caller could do — but it is a
behavior change. Captured under "Risks" below.

## Final API — `OverlayController` tweak

`OverlayController` gains a `position` computed that absorbs the math
duplicated across adapters:

```ts
class OverlayController {
  // existing fields …

  readonly position: Computed<{left: number; top: number}> = computed(() => {
    if (!this.match()) return {left: 0, top: 0}
    const rect = caretDom.getRect()
    if (!rect) return {left: 0, top: 0}
    return {left: rect.left, top: rect.top + rect.height + 1}
  })
}
```

Adapters become trivial:

```tsx
// React (useOverlay.tsx)
const style = useMarkput(s => s.overlay.position())

// Vue (useOverlay.ts)
const style = computed(() => store.overlay.position())
```

The `Caret` import vanishes from both adapters. The `match` dependency
is now read inside `position` itself, so the Vue workaround
(`const _ = matchRef.value` for re-evaluation) is no longer needed.

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
  readonly readOnly: Computed<boolean>                         // NEW; exposed for CaretModel's reconcile effect

  reconcile(opts?: {selecting?: boolean}): void                // selecting flag passed in by CaretModel

  placeAt(rawPos: number, affinity: 'before' | 'after' = 'after'): Result<{applied: number}, 'notIndexed' | 'invalidBoundary'>
  // renamed from placeCaretAtRawPosition; affinity is RETAINED (used by arrowNav.ts:63 with 'before' and :66 with 'after')

  placeRange(range: RawRange): Result<{applied: RawRange}, 'notIndexed' | 'invalidBoundary'>
  // promoted from #placeSelection
}
```

Three API contract decisions deserve calling out:

**`indexed` event over watcher-order.** Today
`DomController.#commitRendered()` calls `#applyRangeToDOM()`
synchronously — the dependency is in the call graph. After the refactor,
caret restoration is a separate watcher; relying on it firing after
DomController's own `lifecycle.rendered` watcher is fragile. The
`indexed` event makes the dependency explicit: CaretModel
`watch(dom.indexed, …)` instead of `watch(lifecycle.rendered, …)`. The
event is emitted unconditionally at the end of `#commitRendered`,
including the queued-render branch (verified: `#handleRendered` re-enters
`#commitRendered` synchronously, so a single `this.indexed()` at the
tail fires once per commit).

**`reconcile({selecting})` opts param + single-driver effect.** The
previous spec revision left two reconcile drivers — DomController's own
`readOnly` watcher and CaretModel's drag-mode effect. With
`reconcile({selecting})` taking the flag explicitly, the readOnly
watcher would call `reconcile()` with `selecting: undefined`, which is
de-facto safe (because `props.readOnly()` short-circuits the `editable`
computation) but conceptually splits a single truth-bit across two
callers. The cleaner shape: collapse to **one driver**.

DomController's `readOnly` watcher is removed. CaretModel's effect tracks
both signals and drives every reconcile:

```ts
// CaretModel onMounted:
effect(() => {
  const isDrag = this.selecting() === 'drag'
  this.dom.readOnly()                                          // tracked dependency
  this.dom.reconcile({selecting: isDrag})
})
```

DomController exposes `readOnly: Computed<boolean>` so CaretModel can
track it without taking `props` as a dep. With this collapse there is no
multi-driver drift, observable or theoretical.

**Internal clamping.** Both `placeAt` and `placeRange` clamp the input
against `value.current().length` internally and return the clamped value
as `applied`. The previous external-clamping logic in
`#applyRangeToDOM` (lines 781–787) collapses into the `placeAt`/
`placeRange` bodies.

**Removed.** `#applyRangeToDOM` is gone (its logic now lives in
CaretModel). The `{readOnly, selecting}` watcher in DomController's
`onMounted` is removed entirely. The `enableFocus` /
`enableSelection` imports and calls go away.

### Why the empty-container click handler stays in `DomController`

The handler that focuses the first child of the container when the user
clicks an effectively-empty editor (today at `focus.ts:41-48`) moves
into `DomController` as a private listener. Reasoning:

- `DomController` already owns the container element registration and is
  where the `parsing` dep lives. Putting the handler here is colocation
  with container ownership, not scope creep.
- Alternative homes (`keyboard/input.ts`, a new `caret/emptyEditorFocus.ts`)
  would require a redundant container listener wiring, plus a
  redundant `parsing` dep injection.
- The handler is small (5 lines) and its purpose — recover focus when
  the user clicks a container with no caret-target child — is a default
  DOM-level recovery, not a token-semantic decision.

The condition `tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === ''`
is preserved verbatim; the logic moves files but doesn't change.

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
the new `setAt` ergonomic. Migrate every `selecting`-mode wrapper-method
call to direct signal writes.

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

**Caller migration in this phase (full enumeration):**

`caret.selecting()` writes (10 sites):

| Site | Today | After Phase 1 |
| --- | --- | --- |
| `caret/selection.ts:22` | `store.caret.startDragSelect()` | `store.caret.selecting('drag')` |
| `caret/selection.ts:32` | `store.caret.clearDragSelect()` (already inside `if (selecting() === 'drag')` outer guard) | `store.caret.selecting(undefined)` — no new guard needed |
| `caret/selection.ts:40` | `store.caret.clearDragSelect()` (inline guard `if (selecting() === 'drag' && (!sel \|\| sel.isCollapsed))`) | `store.caret.selecting(undefined)` — guard preserved |
| `caret/selection.ts:63` | `store.caret.clearDragSelect()` (inline guard `if (selecting() === 'drag')`) | `store.caret.selecting(undefined)` — guard preserved |
| `caret/selectionHelpers.ts:35` (selectAllText body) | `store.caret.startAllSelect()` | absorbed into new `caret.selectAll()` |
| `keyboard/input.ts:77` | `store.caret.clearAllSelect()` | `store.caret.selecting(undefined)` |
| `keyboard/input.ts:103` | `store.caret.clearAllSelect()` | `store.caret.selecting(undefined)` |
| `keyboard/input.ts:259` | `store.caret.clearAllSelect()` | `store.caret.selecting(undefined)` |
| `keyboard/input.ts:271` (`replaceAllContentWith`) | `store.caret.endSelecting()` | `store.caret.selecting(undefined)` |
| `dom/DomController.ts` watcher (lines 159–165) | reads `caret.selecting()` | unchanged in Phase 1; reduced in Phase 2 |

All three `clearDragSelect` callers in `selection.ts` are already inside
outer `if (selecting() === 'drag')` guards (lines 29, 39, 62). Dropping
the wrapper is a pure simplification — Phase 1 doesn't need to introduce
any new guards.

`caret.range({start: pos, end: pos})` collapsed writes (14 sites) become `setAt`:

| Site | After Phase 1 |
| --- | --- |
| `dom/DomController.ts:787` (clamp write-back; logic itself moves to CaretModel in Phase 2) | `caret.setAt(start)` |
| `overlay/OverlayController.ts:114` | `caret.setAt(pos)` |
| `keyboard/input.ts:50, 87, 118, 272` | `caret.setAt(pos)` |
| `keyboard/blockEdit.ts:92, 104, 127, 143, 185, 193, 329` | `caret.setAt(pos)` |
| `clipboard/ClipboardController.ts:59` | `caret.setAt(raw.value.range.start)` |

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

**Tests.** `CaretModel.spec.ts` extends with: pure-command behavior,
derived-signal correctness, `isFullSelection`, `selectAll`. `selection.spec.ts`
and `focus.spec.ts` keep their current set (they cover wiring still in
`DomController`). Net delta: ≈ +6 to +10 new core tests; total ≥ today's count.

**Risks.** Mechanical refactor; the 14 setAt-migration sites are simple
substitutions. The `selecting` writes preserve current guard semantics
(verified site-by-site).

### Phase 2 — Listener migration + restoration migration

**Scope.** Move all DOM listeners and range restoration into CaretModel.
DomController loses its `caret` constructor dep, gains the `indexed`
event and `readOnly` computed, accepts `{selecting}` opts on `reconcile`,
and stops watching its own `readOnly` (CaretModel's effect drives
reconcile end-to-end).

**Moves into CaretModel:**

- `enableFocus` body → private `#enableFocusTracking()` (focus listeners only — see DomController section for the click handler).
- `enableSelection` body → private `#enableSelectionTracking()`.
- `DomController.#applyRangeToDOM` → private `#applyRangeToDOM()` watching `dom.indexed`.
- Single reconcile-driver effect: `effect(() => { const d = this.selecting() === 'drag'; this.dom.readOnly(); this.dom.reconcile({selecting: d}) })`.

**Moves into DomController:**

- Empty-editor click handler (was `focus.ts:41-48`) → private listener
  attached in `onMounted`. Uses existing `parsing` dep. (Justified
  above; not scope creep.)

**DomController API changes:**

```ts
// constructor
constructor(lifecycle: Lifecycle, props: PropsModel, parsing: ParseController, value: ValueModel)

// new
readonly indexed = event<void>()
readonly readOnly: Computed<boolean> = computed(() => this.props.readOnly())

// changed
reconcile(opts?: {selecting?: boolean}): void

// removed
#applyRangeToDOM()
// previous {readOnly, selecting} watcher → removed entirely
```

`#commitRendered` ends with `this.indexed()`. The queued-render branch
fires `indexed` exactly once per commit because `#handleRendered` re-enters
`#commitRendered` synchronously and each commit ends with one event fire.

**CaretModel constructor:**

```ts
constructor(private readonly lifecycle: Lifecycle, private readonly dom: DomController) {
  lifecycle.onMounted(() => {
    this.#enableFocusTracking()
    this.#enableSelectionTracking()
    watch(dom.indexed, () => this.#applyRangeToDOM())
    effect(() => {
      const isDrag = this.selecting() === 'drag'
      dom.readOnly()                                           // tracked dependency
      dom.reconcile({selecting: isDrag})
    })
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
  current range; reconcile effect re-runs when `dom.readOnly()` flips.

Net delta: deletes ~10 cases from `focus.spec.ts` + `selection.spec.ts`,
adds ~10 cases to `CaretModel.spec.ts` + `DomController.spec.ts`.
Approximately net-zero.

**Risks.**

- Subscription ordering: handled by switching to `dom.indexed`. CaretModel
  no longer races against DomController's `lifecycle.rendered` watcher.
- Two-driver reconcile drift: eliminated by removing DomController's
  `readOnly` watcher and having CaretModel's effect track both signals.
  Single source of truth for reconcile.
- `dom.indexed` from queued-render branch: verified exactly-once per
  commit via `#handleRendered` re-entry pattern.

### Phase 3 — Static `Caret` deletion + `caretDom.ts` + overlay positioning

**Scope.** Replace the static `Caret` class with stateless function
exports in `caretDom.ts`. Move overlay-position math into
`OverlayController`. Update both adapter `useOverlay` hooks. Remove
`Caret` from public exports. Update README and breaking-change header.

**Adds:**

- `packages/core/src/features/caret/caretDom.ts` with the six functions
  listed earlier.
- `packages/core/src/features/caret/caretDom.spec.ts` porting the
  surviving cases from `Caret.spec.ts`.
- `OverlayController.position: Computed<{left, top}>` (uses `caretDom.getRect()`).

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

- `caret/TriggerFinder.spec.ts` — **rewritten** (the spec file's prior
  claim of "unchanged" was wrong). The current file mocks `Caret`
  entirely:

```ts
// today
vi.mock('./Caret', () => ({ Caret: { getCurrentPosition: vi.fn(), … } }))
const mockGetCurrentPosition = vi.mocked(Caret.getCurrentPosition)
```

After Phase 3 there's no `Caret` to mock. Replace with direct
`window.getSelection` stubbing in `beforeEach`:

```ts
beforeEach(() => {
  const node = document.createTextNode('Hello @world')
  vi.spyOn(window, 'getSelection').mockReturnValue({
    anchorNode: node,
    anchorOffset: 5,
    isCollapsed: true,
  } as Selection)
  vi.spyOn(document, 'contains').mockReturnValue(true)
})
```

Test cases (constructor init, `find` matching, `isSelectedPosition`
gating) stay; only the mock plumbing changes.

- `react/markput/src/lib/hooks/useOverlay.tsx`:

```tsx
// before
import {Caret, createMarkFromOverlay} from '@markput/core'
const style = useMemo(() => {
  if (!match) return {left: 0, top: 0}
  return Caret.getAbsolutePosition()
}, [match])

// after
import {createMarkFromOverlay} from '@markput/core'
const style = useMarkput(s => s.overlay.position())
```

- `vue/markput/src/lib/hooks/useOverlay.ts`:

```ts
// before
import {Caret, createMarkFromOverlay} from '@markput/core'
const style = computed(() => {
  const _ = matchRef.value
  if (!matchRef.value) return {left: 0, top: 0}
  return Caret.getAbsolutePosition()
})

// after
import {createMarkFromOverlay} from '@markput/core'
const style = computed(() => store.overlay.position())
```

The Vue `const _ = matchRef.value` workaround is no longer needed — the
`match` dependency is read inside `position()` itself.

- `packages/core/index.ts`:
  - Drop `export {Caret} from './src/features/caret'` (line 56).
  - Add `export {caretDom} from './src/features/caret'` (or
    `export * as caretDom from './src/features/caret/caretDom'` —
    namespace export keeps call sites self-documenting).
  - Extend the `@breaking b0` header (full text in "Public API impact"
    section above).

- `packages/core/README.md`:
  - Remove `Caret` from the import example (line 24).
  - Remove the `new Caret()` example (line 34).
  - Remove `Caret` from the components list (line 71).
  - Update line 12 ("Caret position management") to reference both
    `CaretModel` and `caretDom` if desired, or simplify.

**Deletes:**

- `caret/Caret.ts`
- `caret/Caret.spec.ts`

**`caret/index.ts` final shape:**

```ts
export {CaretModel} from './CaretModel'
export {TriggerFinder} from './TriggerFinder'
export * as caretDom from './caretDom'
```

**Tests.** `caretDom.spec.ts` ports the 6 surviving Caret.spec.ts cases
(`getCaretIndex`, `setIndex`, `setAtX`, `getCaretRect`, line-edge
checks). `Caret.spec.ts`'s ≈14 cases for removed methods
(`getCurrentPosition`, `getFocusedSpan`, `getSelectedNode`,
`isSelectedPosition`, `getAbsolutePosition`, `getIndex`, `setIndex1`,
`setCaretRightTo`) are dropped. New tests for `OverlayController.position`
(adds 2–3 cases). Net delta in core: roughly -5 to -8 cases. Adapter
test counts (React 171, Vue 157) should stay constant; the hook
implementation changes shape but its public contract doesn't.

**Risks.**

- `OverlayController.position` reads `caretDom.getRect()` which calls
  `window.getSelection().getRangeAt(0).getBoundingClientRect()`.
  jsdom's `getBoundingClientRect` returns zeros — same constraint the
  current adapter math has. Tests that assert the position rectangle
  numerics already exist or use spies; the migration preserves them.
- `caretDom.setAtElement` swallows errors that today's `Caret.setIndex`
  re-throws when called directly from `Caret.setAtX`. Strictly
  improving (no recovery the caller could do), but a behavior change
  worth listing here.

### Phase 4 — `DomController` placement API rename

**Scope.** Rename / promote the placement methods on DomController.
Single, mechanical phase isolated from caret concerns.

**Renames:**

- `placeCaretAtRawPosition(rawPos, affinity = 'after')` → `placeAt(rawPos, affinity = 'after')`. **Affinity parameter retained** (used by `arrowNav.ts:63` with `'before'` and `:66` with `'after'`, plus `DomController.spec.ts:337` with explicit `'after'`).
- `#placeSelection(selection: RawSelection)` → public `placeRange(range: RawRange)`.

**Return shape extension:** both methods return
`Result<{applied: number | RawRange}, …>`. Internal clamping centralized
inside the methods (no change for `arrowNav` — its inputs are already
valid token boundaries; the clamp is a no-op on the happy path).

**Caller updates:**

| Today | After Phase 4 |
| --- | --- |
| `CaretModel.#applyRangeToDOM` (was at `DomController.ts:791` pre-Phase-2; in CaretModel after Phase 2) | uses `placeAt`/`placeRange` with `applied` return |
| `arrowNav.ts:63,66` | `placeAt(pos, 'before' | 'after')` — name change only |
| `DomController.spec.ts:337` | assertion updated to new name and return shape |

**Tests.** `DomController.spec.ts` cases for `placeCaretAtRawPosition`
get renamed and gain coverage of the `applied` return value. Net count
neutral or slight growth.

**Risks.** Test assertions need updating across ~6 call sites. The
return-shape change is the only non-mechanical part.

## README sketch

`caret/README.md` rewrite, summarizing the post-Phase-3 layout:

> # Caret feature
>
> Owns the editor's caret state and the listeners that produce caret
> events. Stateless DOM-coordinate primitives live alongside in
> `caretDom.ts`. Overlay positioning lives in `OverlayController` (it's
> not a Caret concern).
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
- **`reconcile({selecting})` opts spread.** With the single-driver
  collapse (CaretModel's effect tracks both `selecting` and
  `dom.readOnly()`), there is no multi-driver state and no observable
  drift. Existing internal `dom.reconcile()` callers without
  caret-state semantics (e.g. inside `#commitRendered`) keep their
  zero-arg form; the `opts.selecting` defaults to `undefined`, which is
  the correct value when caret state isn't relevant to the call.
- **`caretDom.setAtElement` error swallowing.** `Caret.setAtX` today
  calls `Caret.setIndex` (throwing) directly at line 106. The new
  `caretDom.setAtX` calls `caretDom.setAtElement` (swallows). Strictly
  improving — `blockEdit.ts:269,280` becomes infallible at lines that
  previously had a theoretical throw path.
- **Phase 2 store reorder.** `caret` moves below `dom`. Other
  controllers (`OverlayController`, `KeyboardController`,
  `DragController`, `ClipboardController`) keep their `caret` constructor
  arg unchanged.
- **`affinity` parameter retention.** Confirmed used at `arrowNav.ts:63,66`
  and `DomController.spec.ts:337`. Phase 4 keeps it.
- **Public API breaking change.** `Caret` removal is a second
  `@breaking b0` entry on top of `CaretRecovery`. Phase 3 documents the
  migration path for every removed surface (see "Public API impact").

### Open questions

None. All design decisions resolved.
