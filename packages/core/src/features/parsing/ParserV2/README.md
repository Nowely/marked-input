# ParserV2

Высокопроизводительный древовидный парсер для обработки вложенных markup конструкций в тексте с однопроходным алгоритмом построения дерева.

## Обзор

ParserV2 - оптимизированный парсер для обработки вложенных markup конструкций. Использует:
- **Aho-Corasick** алгоритм для эффективного multi-pattern поиска
- **Single-pass tree building** для построения вложенной структуры без рекурсивного парсинга
- **Position tracking** для точного отслеживания позиций вложенных элементов

## Возможности

- **Древовидный разбор** с поддержкой произвольной глубины вложенности
- **100x+ улучшенная производительность** для nested structures (vs recursive approach)
- **Однопроходной алгоритм**: O(N log N) complexity вместо O(N × 2^D)
- **Точное отслеживание позиций**: все позиции относятся к оригинальному тексту
- **Чистая архитектура**: ~1100 строк кода, модульная структура
- **Безопасность**: XSS защита и DoS-prevention
- **Расширяемость**: Простое добавление новых типов markup

## Быстрый старт

```typescript
import { ParserV2 } from './ParserV2'

const markups = ['@[__label__](__value__)', '#[__label__]']
const parser = new ParserV2(markups)

const result = parser.split('Hello @[world](test) and #[tag]')
// result: [TextToken, MarkToken{label: 'world', value: 'test'}, TextToken, MarkToken{label: 'tag'}]
```

## Архитектура

### Основные компоненты

```typescript
type NestedToken = TextToken | MarkToken

interface MarkToken {
  type: 'mark'
  content: string
  children: NestedToken[]     // Вложенные токены
  data: {
    label: string             // Текст между сегментами
    value?: string
    optionIndex: number
  }
  position: { start: number, end: number }
}
```

### Структура модуля

```
ParserV2/
├── ParserV2.ts              # Главный класс парсера (32 строки)
├── types.ts                 # Типы и интерфейсы (MatchResult с position tracking)
├── index.ts                 # Публичные экспорты
├── core/                    # Ядро функциональности
│   ├── PatternMatcher.ts    # Поиск всех matches (включая overlapping)
│   ├── PatternProcessor.ts  # Обработка цепочек паттернов
│   ├── MarkupDescriptor.ts  # Создание дескрипторов разметки
│   ├── SegmentMatcher.ts    # Матчинг сегментов (Aho-Corasick)
│   ├── TokenBuilder.ts      # Обертка над TreeBuilder (25 строк)
│   └── TreeBuilder.ts       # 🆕 Single-pass tree building (169 строк)
├── utils/                   # Утилиты
│   ├── AhoCorasick.ts       # Эффективный multi-pattern поиск
│   ├── PatternBuilder.ts    # Построение паттернов из цепочек
│   └── PatternChainManager.ts # Управление активными цепочками
└── tests/                   # Тесты (75 тестов passed)
```

## API

### ParserV2

```typescript
class ParserV2 {
  constructor(markups: Markup[])
  split(input: string): NestedToken[]
}

ParserV2.split(input: string, options: InnerOption[]): NestedToken[] // Статический метод
```


## Производительность

### Benchmark Results (Nested Structures)

| Depth | Before Optimization | After Optimization | Improvement |
|-------|---------------------|-------------------|-------------|
| 1 | 1,849 ops/sec | 65,710 ops/sec | **35.5x faster** ⚡ |
| 2 | 530 ops/sec | 40,092 ops/sec | **75.6x faster** ⚡⚡ |
| 3 | 455 ops/sec | 47,923 ops/sec | **105.3x faster** ⚡⚡⚡ |

### Key Optimizations

- **75 тестов** проходят успешно ✅
- **Single-pass tree building**: O(N log N) вместо O(N × 2^D)
- **Aho-Corasick алгоритм** для O(N + M) pattern matching
- **Position tracking** - прямое отслеживание позиций без повторного парсинга
- **No recursive parsing** - однопроходной алгоритм построения дерева
- **Overlapping matches included** - все matches доступны для tree builder

## Безопасность

- **XSS защита**: Валидация опасных паттернов
- **DoS prevention**: Защита от бесконечных циклов парсинга
- **Валидация структуры**: Проверка корректности markup дескрипторов

## Разработка

```bash
# Запуск тестов
pnpm test

# Запуск бенчмарков
pnpm run bench

# Проверка линтера
pnpm run lint
```

## История изменений

### v2.6 (Текущая - Single-Pass Tree Building) 🚀
- ✅ **Problem #5**: Удален `BaseMarkupDescriptor` - упрощена type hierarchy
- ✅ **Problem #4**: Реализован однопроходной алгоритм построения дерева
  - Добавлен `TreeBuilder.ts` (169 строк) - stack-based tree building
  - Добавлены `labelStart/labelEnd/valueStart/valueEnd` в `MatchResult`
  - Изменен `PatternMatcher` для включения overlapping matches
  - **100x+ улучшение** производительности для nested structures
- ✅ **Position tracking**: Все позиции относятся к оригинальному тексту
- ✅ **No recursive parsing**: O(N log N) complexity вместо O(N × 2^D)
- ✅ **75 тестов passed**: Обновлены snapshots для новых position semantics

**Метрики качества v2.6:**
- Строк кода: ~1100 (было ~1400 в v2.0, **-21%**)
- Количество файлов: 12 (добавлен TreeBuilder.ts)
- Complexity: O(N log N) для nested parsing (было O(N × 2^D))
- Производительность: **35-105x улучшение** для nested structures
- Все тесты: ✅ 75 passed

### v2.5 (Оптимизированная архитектура)
- ✅ Удален мертвый код и упрощена структура
- ✅ Упрощен TokenBuilder: 190 строк → 77 строк
- ✅ Новая структура: utils/ для утилит
- ✅ Материализация gaps только для валидных матчей

### v2.0-v2.4
- ✅ Переход на Aho-Corasick алгоритм
- ✅ 2-3.5x прирост производительности vs v1 (flat structures)
- ✅ Полная реструктуризация архитектуры