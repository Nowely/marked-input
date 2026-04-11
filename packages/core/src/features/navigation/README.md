# Navigation Feature

Provides focus navigation between editor elements. Walks forward or backward from the current element to find the nearest focusable element, skipping non-editable marks.

## Components

- **shiftFocusPrev**: On left arrow, walks backward from the current element to find the nearest focusable element and focuses it with caret at the end
- **shiftFocusNext**: On right arrow, walks forward from the current element to find the nearest focusable element and focuses it with caret at the beginning

## Usage

```typescript
import {shiftFocusNext, shiftFocusPrev} from '@markput/core'

// Move focus to next focusable element
shiftFocusNext(currentElement, container)

// Move focus to previous focusable element
shiftFocusPrev(currentElement, container)
```

Used by `ArrowNavFeature` and `FocusFeature` for keyboard navigation and focus recovery.
