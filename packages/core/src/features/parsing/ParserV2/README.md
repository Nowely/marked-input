# ParserV2

Высокопроизводительный древовидный парсер для обработки вложенных markup конструкций в тексте.

## Обзор

ParserV2 - оптимизированный парсер с чистой архитектурой для обработки вложенных markup конструкций. Использует алгоритм Aho-Corasick для эффективного поиска паттернов, обеспечивая производительность в 2-3.5x выше предыдущей версии.

## Возможности

- **Древовидный разбор** с поддержкой произвольной глубины вложенности
- **Производительность**: Aho-Corasick алгоритм + оптимизированная материализация gaps
- **Чистая архитектура**: ~1000 строк кода (было ~1400, -28%), простая структура файлов
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
├── ParserV2.ts              # Главный класс парсера
├── types.ts                 # Типы и интерфейсы
├── index.ts                 # Публичные экспорты
├── PatternMatcher.ts        # Стратегия матчинга паттернов
├── PatternProcessor.ts      # Обработка цепочек паттернов
├── MarkupDescriptor.ts      # Создание дескрипторов разметки
├── SegmentMatcher.ts        # Матчинг сегментов текста
├── TokenBuilder.ts          # Построение токенов (77 строк)
├── utils.ts                 # Утилиты (materializeGaps, extractContent)
├── algorithms/              # Алгоритмы
│   ├── AhoCorasick.ts       # Эффективный поиск паттернов
│   └── PatternBuilder.ts    # Построение паттернов из цепочек
├── structures/              # Структуры данных
│   └── PatternChainManager.ts # Управление активными цепочками
└── tests/                   # Тесты (62 теста, 533+ строки)
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

- **62 теста** проходят успешно (56 passed | 6 skipped)
- **2-3.5x прирост** скорости по сравнению с v1
- **Aho-Corasick алгоритм** для эффективного multi-pattern matching
- **Оптимизированная материализация gaps** - только для не-overlapping матчей
- **Shallow copy** для клонирования цепочек (вместо deep copy)
- **Single pass** экстракция контента (вместо multiple find операций)

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

### v2.5 (Текущая - Оптимизированная)
- ✅ **Удален мертвый код**: ParseContext, ValidationResult, extractContent fallback
- ✅ **Упрощен ContentExtractor**: 3 дублирующиеся функции → 1 single-pass функция
- ✅ **Убран PatternEngine**: Лишний проксирующий слой удален
- ✅ **GapMaterializer → функция**: Класс из 5 строк преобразован в утилиту
- ✅ **Упрощен TokenBuilder**: 190 строк → 77 строк (60% сокращение)
- ✅ **Переименование**: MarkupMatcher → PatternMatcher (точнее отражает назначение)
- ✅ **Новая структура**: algorithms/ и structures/ для лучшей организации
- ✅ **Оптимизации**: Материализация gaps только для валидных матчей, shallow copy

**Метрики качества v2.5:**
- Строк кода: ~1008 (было ~1400, **-28%**)
- Количество файлов: 12 (было 14, **-14%**)
- Классов: 7 (было 11, **-36%**)
- Средняя CC: 1.5 (было 1.9, **-21%**)
- Линтер ошибок: 0
- Все тесты: ✅ 56 passed | 6 skipped

### v2.0-v2.4
- ✅ Переход на Aho-Corasick алгоритм
- ✅ 2-3.5x прирост производительности
- ✅ Полная реструктуризация архитектуры
- ✅ Удаление 700+ строк избыточного кода