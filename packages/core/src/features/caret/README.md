# Caret Feature

The caret feature owns caret/selection state and DOM-coordinate helpers used by
overlay positioning and block-edit navigation.

## Components

- **CaretModel**: Reactive caret/selection state plus DOM↔signal sync. Owns:
    - `selection: Signal<Range | undefined>` — the single source of truth for
      caret/selection position.
    - `position: Signal<number | undefined>` — writable computed bound to
      `selection.start`; writing collapses the range to `{start: pos, end: pos}`.
    - `isUserSelecting: Signal<boolean>` — passthrough to
      `UserSelectingTracker.isSelecting`. Drives
      `dom.reconcile({isUserSelecting})` so structural text surfaces become
      non-editable during drags.
    - `isAllSelected: Signal<boolean>` — computed from `selection` and
      `value.current().length`; true when the selection spans the entire raw value.
    - `selectAll()` — imperative helper for whole-editor selection.
    - `focusAddress(address, boundary)` — sets a one-shot address hint and
      writes the selection so the auto-apply effect lands on the right
      element when a position is shared between two adjacent tokens.

    Document `selectionchange` and focus tracking are wired in the constructor
    and tear down with the lifecycle scope. The DOM caret is updated whenever
    `selection` changes (auto-apply effect) and whenever `dom.indexed` fires
    after a re-render. If the current DOM has no resolvable target for the
    selection, placement is deferred (the selection signal is retained as user
    intent until the next render). Caret placement primitives live in
    `caretDom.ts` (`placeAtTextOffset`, `placeAtChildBoundary`,
    `placeRangeAcrossSurfaces`).

- **UserSelectingTracker**: Owns `isSelecting: Signal<boolean>`. Listens on
  `document` for mousedown/mousemove/mouseup/selectionchange and flips the
  signal when a drag sweeps across nodes inside the editor or any non-
  collapsed selection touches the container. Reachable as
  `store.userSelecting`; `CaretModel` re-exports its signal as
  `caret.isUserSelecting` for API compatibility.

- **caretDom**: Stateless DOM helpers — `getCaretIndex`, `setAtElement`,
  `setAtX`, `getRect`, `isOnFirstLine`, `isOnLastLine` for raw DOM caret math,
  plus `placeAtTextOffset`, `placeAtChildBoundary`, `placeRangeAcrossSurfaces`
  used by `CaretModel` for selection placement.
- **TriggerFinder**: Detects overlay triggers in text based on the current
  selection.

## Usage

```typescript
import {caretDom, TriggerFinder} from '@core/features/caret'

const offset = caretDom.getCaretIndex(element)
const match = TriggerFinder.find(options, opt => opt.overlay?.trigger)
```
