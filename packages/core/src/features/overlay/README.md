# Overlay Feature

Manages the autocomplete/suggestion overlay. Detects overlay triggers using `TriggerFinder`, manages the overlay open/close lifecycle, and provides utilities for filtering suggestions and keyboard navigation.

## Components

- **OverlayFeature**: Reactive feature that checks for overlay triggers on text/selection changes, manages overlay open/close (Escape key, outside click), and tracks the input span for overlay operations
- **createMarkFromOverlay**: Creates a `MarkToken` from an `OverlayMatch` result
- **filterSuggestions**: Filters a string array by case-insensitive substring match
- **navigateSuggestions**: Keyboard navigation (up/down/enter) through suggestion lists with wrap-around

## Usage

```typescript
import {filterSuggestions, navigateSuggestions} from '@markput/core'

const filtered = filterSuggestions(['Apple', 'Banana', 'Cherry'], 'ap')
// Returns: ['Apple']

const result = navigateSuggestions(action, {index: 0, total: 3})
// Returns: {index: 1} for 'next' action
```

The `OverlayFeature` is registered by the Store. It uses `TriggerFinder` from the caret feature for trigger detection.
