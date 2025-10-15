# Parser (Legacy)

⚠️ **Deprecated**: Этот парсер использует устаревшие плейсхолдеры и не поддерживает вложенность. Для новых проектов используйте **ParserV2**.

## Устаревшие плейсхолдеры

Parser использует старую схему плейсхолдеров:
- `__label__` - основное содержимое (deprecated, используйте `__value__` в ParserV2)
- `__value__` - дополнительное значение (deprecated, используйте `__meta__` в ParserV2)

## Структура файлов

Для изоляции от новой схемы именования, Parser имеет свою структуру файлов:
- `constants.ts` - PLACEHOLDER enum с LABEL и VALUE
- `types.ts` - типы: Markup, MarkStruct, PieceType, MarkMatch

## Миграция на ParserV2

Для миграции на новый ParserV2:

```typescript
// ❌ Старый код (Parser)
const parser = new Parser(['@[__label__](__value__)'])
// result: {label: 'text', value: 'meta'}

// ✅ Новый код (ParserV2)
const parser = new ParserV2(['@[__value__](__meta__)'])
// result: {value: 'text', meta: 'meta'}
```

## Преимущества ParserV2

1. **Поддержка вложенности** через `__nested__` плейсхолдер
2. **Улучшенная производительность** - O(N log N) вместо экспоненциальной
3. **Правильная семантика** - `value` для основного контента, `meta` для метаданных
4. **Древовидная структура** - полное дерево токенов с children
5. **Более точный парсинг** - устранены конфликты между паттернами

## Документация

См. [ParserV2 README](../ParserV2/README.md) для подробной документации о новом парсере.

