# Parser (Legacy)

⚠️ **Deprecated**: This parser uses deprecated placeholders and doesn't support nesting. For new projects, use **ParserV2**.

## Deprecated Placeholders

Parser uses the old placeholder scheme:
- `__label__` - main content (deprecated, use `__value__` in ParserV2)
- `__value__` - additional value (deprecated, use `__meta__` in ParserV2)

## File Structure

To isolate from the new naming scheme, Parser has its own file structure:
- `constants.ts` - PLACEHOLDER enum with LABEL and VALUE
- `types.ts` - types: Markup, MarkStruct, PieceType, MarkMatch

## Migration to ParserV2

To migrate to new ParserV2:

```typescript
// ❌ Old code (Parser)
const parser = new Parser(['@[__label__](__value__)'])
// result: {label: 'text', value: 'meta'}

// ✅ New code (ParserV2)
const parser = new ParserV2(['@[__value__](__meta__)'])
// result: {value: 'text', meta: 'meta'}
```

## ParserV2 Advantages

1. **Nesting support** via `__nested__` placeholder
2. **Improved performance** - O(N log N) instead of exponential
3. **Correct semantics** - `value` for main content, `meta` for metadata
4. **Tree structure** - full token tree with children
5. **More precise parsing** - conflicts between patterns eliminated

## Documentation

See [ParserV2 README](../ParserV2/README.md) for detailed documentation about the new parser.
