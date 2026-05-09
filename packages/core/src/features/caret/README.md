# Caret Feature

The caret feature owns caret/selection state and DOM-coordinate helpers used by
overlay positioning and block-edit navigation.

## Components

- **CaretModel**: Reactive caret/selection state. Owns:
    - `range: Signal<Range | undefined>` — the single source of truth for
      caret/selection position.
    - `position: Signal<number | undefined>` — writable computed bound to
      `range.start`; writing collapses the range to `{start: pos, end: pos}`.
    - `isUserSelecting: Signal<boolean>` — flips while the user is actively
      drag-selecting; drives `dom.reconcile({isUserSelecting})` so structural text
      surfaces become non-editable during drags.
    - `isFullSelection()` / `selectAll()` — imperative helpers for whole-editor
      selection.

    Document mouse + selectionchange listeners and focus tracking are wired in
    the constructor and tear down with the lifecycle scope. Range is re-applied
    to the DOM after every render via `watch(dom.indexed, ...)`.

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
