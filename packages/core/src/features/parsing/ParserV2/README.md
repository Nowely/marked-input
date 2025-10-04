# ParserV2

Древовидный парсер для обработки вложенных markup конструкций в тексте.

## Обзор

ParserV2 - высокопроизводительный парсер для обработки вложенных markup конструкций с поддержкой древовидной структуры токенов, встроенной валидацией и защитой от XSS/DoS атак.

## Возможности

- **Древовидный разбор** с поддержкой произвольной глубины вложенности
- **Безопасность**: XSS защита и DoS-prevention
- **Производительность**: Aho-Corasick алгоритм, 2-3.5x быстрее предыдущей версии
- **Валидация**: Полная проверка структуры и глубины вложенности
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
├── ParserV2.ts              # Главный класс
├── types.ts                 # Типы и интерфейсы
├── core/                    # Ядро парсера
│   ├── PatternEngine.ts     # Основной движок
│   ├── MarkupMatcher.ts     # Матчинг разметки
│   ├── PatternProcessor.ts  # Обработка цепочек
│   └── GapMaterializer.ts   # Материализация gaps
├── utils/                   # Утилиты
│   ├── AhoCorasick.ts       # Алгоритм поиска
│   ├── TokenBuilder.ts      # Построение токенов
│   └── validation.ts        # Валидация
└── tests/                   # Тесты и бенчмарки
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

- **500+ тестов** проходят успешно
- **2-3.5x прирост** скорости по сравнению с v1
- **Aho-Corasick алгоритм** для эффективного multi-pattern matching
- **Ленивая материализация** gap значений

## Безопасность

- **XSS защита**: Валидация опасных паттернов
- **DoS prevention**: Ограничение максимальной глубины вложенности (по умолчанию 10)
- **Валидация структуры**: Проверка корректности дерева токенов

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

### v2.3 (Текущая)
- ✅ Рефакторинг PatternEngine на меньшие классы (PatternProcessor, GapMaterializer)
- ✅ Удаление дублирующих методов в MarkupMatcher
- ✅ Вынос хардкода в константы
- ✅ Исправление импортов типов

### v2.0-v2.2
- ✅ Переход на Aho-Corasick алгоритм
- ✅ 2-3.5x прирост производительности
- ✅ Полная реструктуризация архитектуры
- ✅ Удаление 700+ строк избыточного кода