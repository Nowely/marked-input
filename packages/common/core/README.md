# @markput/core

Core utilities for text annotation and parsing used by [rc-marked-input](https://www.npmjs.com/package/rc-marked-input).

This package provides low-level utilities for working with annotated text, including:

- Text annotation and parsing functions
- Markup processing and tokenization
- Core data structures and types
- Utility classes for text manipulation
- Event handling system
- Caret position management
- Text preprocessing utilities

## Installation

```bash
pnpm add @markput/core
```

## Usage

```typescript
import {annotate, denote, Parser, getTokensByValue, Store, Caret, TriggerFinder, EventBus} from '@markput/core'

// Annotate text with markup
const annotated = annotate('@[__label__](__value__)', 'Hello', 'world')

// Parse annotated text
const parser = new Parser()
const result = parser.parse(annotated)

// Work with text selection and caret position
const caret = new Caret()
const position = caret.getPosition()

// Find trigger positions in text
const triggerFinder = new TriggerFinder('@')
const triggers = triggerFinder.find('Hello @world')

// State management
const store = new Store()
```

## API

### Core Functions

- `annotate(markup, label, value?)` - Create annotated text from markup template
- `denote(value, callback, ...markups)` - Transform annotated text back to plain text
- `escape(text)` - Escape special characters in text
- `toString(pieces)` - Convert piece array to string
- `shallow(obj)` - Create shallow copy of object
- `createNewSpan(text, start, end)` - Create new text span
- `deleteMark(text, mark)` - Remove mark from text

### Parsing & Tokenization

- `Parser` - Main parsing class for markup processing
- `getTokensByValue(value)` - Extract tokens from annotated text
- `getTokensByUI(pieces)` - Convert UI pieces to tokens

### Preprocessing

- `findGap(text, position)` - Find gap positions in text
- `getClosestIndexes(array, target)` - Get closest indexes in array

### Classes

- `Store` - State management for annotated text
- `Caret` - Caret position utilities
- `TriggerFinder` - Find trigger positions in text
- `EventBus` - Event handling system
- `KeyGenerator` - Generate unique keys
- `NodeProxy` - DOM node proxy utilities

### Event System

- `SystemEvent` - System event constants

### Type Guards & Assertions

- `assertNonNullable(value)` - Assert value is not null/undefined
- `isAnnotated(value)` - Check if value is annotated

### Types

- `MarkStruct` - Basic mark structure
- `Markup` - Markup template string
- `OverlayMatch` - Match result for overlay triggers
- `MarkMatch` - Match result for marks
- `OverlayTrigger` - Trigger configuration
- `EventKey` - Event key type
- `Listener` - Event listener type

### Constants

- `DEFAULT_CLASS_NAME` - Default CSS class name
- `DEFAULT_MARKUP` - Default markup template
- `DEFAULT_OVERLAY_TRIGGER` - Default trigger character
- `KEYBOARD` - Keyboard constants
- `PLACEHOLDER` - Placeholder constants (`__label__`, `__value__`, `__nested__`)

> **Note**: Default configuration options are now framework-specific. For React, see `@markput` package.

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run benchmarks
pnpm test:bench:watch
```

## License

MIT
