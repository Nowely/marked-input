# Caret Feature

The caret feature owns caret/selection state and DOM-coordinate helpers used
by overlay positioning and block-edit navigation.

## Components

- **CaretModel**: Reactive caret/selection state plus DOM↔signal sync. Owns:
    - `selection: Signal<Range | undefined>` — single source of truth for
      caret/selection position. External callers move the caret by writing
      this signal; the auto-apply effect handles DOM placement on the next
      tick (or defers placement when the DOM has no resolvable target yet).
    - `position: Signal<number | undefined>` — writable computed bound to
      `selection.start`; writing collapses the range to `{start: pos, end: pos}`.
    - `isUserSelecting: Signal<boolean>` — pass-through to
      `DomModel.isUserSelecting`. Writes from anywhere drive structural text
      surfaces to `contenteditable="false"` during drags so the browser sees
      one continuous selection instead of fragmenting it per-node.
    - `isAllSelected: Signal<boolean>` — computed; true when the selection
      spans the entire raw value.
    - `selectAll()` — imperative helper for whole-editor selection.
    - `placeAtAddress(address, boundary)` — sets a one-shot address hint and
      writes the selection so the auto-apply effect lands on the right
      element when a position is shared between two adjacent tokens.
      Returns `true` on success, `false` when the address cannot be
      resolved (DOM not indexed yet, or address is stale).

    The user-selecting tracker (mouse/selectionchange listeners that flip
    the signal) lives inside `CaretModel` itself; the signal it writes to is
    owned by `DomModel` so the indexer can watch it directly without an
    extra effect bouncing through `CaretModel`. Caret placement primitives
    live in `caretDom.ts` (`placeAtTextOffset`, `placeAtChildBoundary`,
    `placeRangeAcrossSurfaces`, `focusIfNeeded`).

- **caretDom**: Stateless DOM helpers — `getCaretIndex`, `setAtElement`,
  `setAtX`, `getRect`, `isOnFirstLine`, `isOnLastLine` for raw DOM caret
  math, plus `placeAtTextOffset`, `placeAtChildBoundary`,
  `placeRangeAcrossSurfaces`, `focusIfNeeded` used by `CaretModel` for
  selection placement.
- **TriggerFinder**: Detects overlay triggers in text based on the current
  selection.

## Usage

```typescript
import {caretDom, TriggerFinder} from '@core/features/caret'

const offset = caretDom.getCaretIndex(element)
const match = TriggerFinder.find(options, opt => opt.overlay?.trigger)
```
