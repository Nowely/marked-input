# Caret Feature

The caret feature owns caret/selection state and DOM-coordinate helpers used by
overlay positioning and block-edit navigation.

## Components

- **CaretModel**: Reactive caret/selection state AND the single source of
  truth for applying that state to the DOM. External code should never
  imperatively move the caret; instead, write to `caret.selection` and let the
  auto-apply effect handle DOM placement. Owns:
    - `selection: Signal<Range | undefined>` — the single source of truth for
      caret/selection position.
    - `position: Signal<number | undefined>` — writable computed bound to
      `selection.start`; writing collapses the range to `{start: pos, end: pos}`.
    - `isUserSelecting: Signal<boolean>` — flips while the user is actively
      drag-selecting; drives `dom.reconcile({isUserSelecting})` so structural text
      surfaces become non-editable during drags.
    - `isAllSelected: Signal<boolean>` — computed from `selection` and
      `value.current().length`; true when the selection spans the entire raw value.
    - `selectAll()` — imperative helper for whole-editor selection.

    Document mouse + selectionchange listeners and focus tracking are wired in
    the constructor and tear down with the lifecycle scope. The DOM caret is
    updated whenever `selection` changes (auto-apply effect) and whenever
    `dom.indexed` fires after a re-render. If the current DOM has no resolvable
    target for the selection, placement is deferred (the selection signal is
    retained as user intent until the next render).

- **caretDom**: Stateless DOM helpers (`getCaretIndex`, `setAtElement`,
  `setAtX`, `getRect`, `isOnFirstLine`, `isOnLastLine`). Use these for raw DOM
  caret math.
- **TriggerFinder**: Detects overlay triggers in text based on the current
  selection.

## Usage

```typescript
import {caretDom, TriggerFinder} from '@core/features/caret'

const offset = caretDom.getCaretIndex(element)
const match = TriggerFinder.find(options, opt => opt.overlay?.trigger)
```
