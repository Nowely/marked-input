# Mark Feature

Provides the API for framework-level mark components to interact with their token. `MarkHandler` is instantiated by React/Vue wrappers to expose reactive getters/setters for mark token properties.

## Components

- **MarkHandler**: Class instantiated per mark component with reactive access to `content`, `value`, `meta`, `slot`, `readOnly`, plus computed `depth`, `hasChildren`, `parent`, `tokens`. Methods:
    - `change({content, value?, meta?})` — batch update multiple fields and emit change event
    - `remove()` — delete the mark from the value
- **MarkOptions**: Configuration type (`controlled` flag for controlled mode)
- **RefAccessor**: Generic interface for framework ref objects (`{ current: T | null }`)

## Usage

```typescript
import {MarkHandler} from '@markput/core'

// Used internally by framework wrappers:
const handler = new MarkHandler(refAccessor, store)
handler.change({content: 'new content', value: 'new value'})
```

Framework users interact with marks through React/Vue wrapper components, not directly with `MarkHandler`.
