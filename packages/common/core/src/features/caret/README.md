# Caret Feature

The Caret feature provides utilities for working with DOM caret position, text selection, and trigger detection in editable content.

## Components

- **Caret**: Static class for DOM caret manipulation, position tracking, and selection management
- **TriggerFinder**: Class for detecting overlay triggers in text based on caret position

## Usage

```typescript
import {Caret, TriggerFinder} from '@core/features/caret'

// Get current caret position
const position = Caret.getCurrentPosition()

// Find triggers in text
const triggerFinder = TriggerFinder.find(options)
```
