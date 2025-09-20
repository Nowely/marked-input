# @markput/core

Core utilities for text annotation and parsing used by [rc-marked-input](https://www.npmjs.com/package/rc-marked-input).

This package provides low-level utilities for working with annotated text, including:

- Text annotation and parsing functions
- Markup processing and tokenization
- Core data structures and types
- Utility classes for text manipulation

## Installation

```bash
npm install @markput/core
```

## Usage

```typescript
import {
  annotate,
  denote,
  Parser,
  getTokensByValue,
  Store,
  Caret
} from '@markput/core'

// Annotate text with markup
const annotated = annotate('@[label](value)', 'Hello', 'world')

// Parse annotated text
const parser = new Parser()
const result = parser.parse(annotated)

// Work with text selection and caret position
const caret = new Caret()
const position = caret.getPosition()
```

## API

### Core Functions

- `annotate(markup, label, value?)` - Create annotated text from markup template
- `denote(value, callback, ...markups)` - Transform annotated text back to plain text
- `escape(text)` - Escape special characters in text
- `toString(pieces)` - Convert piece array to string

### Parsing

- `Parser` - Main parsing class for markup processing
- `getTokensByValue(value)` - Extract tokens from annotated text
- `getTokensByUI(pieces)` - Convert UI pieces to tokens

### Classes

- `Store` - State management for annotated text
- `Caret` - Caret position utilities
- `TriggerFinder` - Find trigger positions in text
- `EventBus` - Event handling system

### Types

- `MarkStruct` - Basic mark structure
- `Markup` - Markup template string
- `OverlayMatch` - Match result for overlay triggers

## License

MIT
