# Caret Feature

The caret feature owns caret/selection state and DOM-coordinate helpers used by
overlay positioning and block-edit navigation.

## Components

- **CaretModel**: Reactive caret/selection state. Owns `range`, `selecting`,
  derived `isCollapsed` / `position` / `selection`, the document mouse +
  selectionchange listeners, focus tracking, and post-render restoration.
  Drives `dom.reconcile({selecting})` whenever the drag state flips.
- **caretDom**: Stateless DOM helpers (`getCaretIndex`, `setAtElement`,
  `setAtX`, `getRect`, `isOnFirstLine`, `isOnLastLine`). Use these for raw DOM
  caret math; never reach for the deprecated `Caret` static class.
- **TriggerFinder**: Detects overlay triggers in text based on the current
  selection.

## Usage

```typescript
import {caretDom, TriggerFinder} from '@core/features/caret'

const offset = caretDom.getCaretIndex(element)
const match = TriggerFinder.find(options, opt => opt.overlay?.trigger)
```
