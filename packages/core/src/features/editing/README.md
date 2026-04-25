# Editing Feature

Provides shared string-editing utilities used by the core input pipeline.

## Components

- **createRowContent**: Generates the raw string content for a new block row by annotating the first option's markup with empty values
- **createNewSpan**: Replaces a matched trigger in a text span with an annotated markup string

## Usage

```typescript
import {createRowContent} from '@markput/core'

const content = createRowContent(options)
// Returns annotated markup string for a new empty row
```

Mark deletion now goes through raw ranges and `store.value.replaceRange()` so the same controlled-mode echo and caret recovery path handles text, mark, clipboard, block, and drag edits.
