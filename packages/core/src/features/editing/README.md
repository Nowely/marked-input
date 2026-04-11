# Editing Feature

Provides shared text editing utilities used by other features: creating new block rows, replacing trigger text with annotated markup, and deleting mark tokens.

## Components

- **createRowContent**: Generates the raw string content for a new block row by annotating the first option's markup with empty values
- **createNewSpan**: Replaces a matched trigger in a text span with an annotated markup string
- **deleteMark**: Removes a mark token and its surrounding text spans, merging adjacent text spans, updating token state, and scheduling focus recovery

## Usage

```typescript
import {createRowContent} from '@markput/core'

const content = createRowContent(options)
// Returns annotated markup string for a new empty row
```

These utilities are used internally by InputFeature, BlockEditFeature, and SystemListenerFeature.
