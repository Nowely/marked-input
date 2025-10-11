# ParserV2

Высокопроизводительный древовидный парсер для обработки вложенных markup конструкций в тексте с однопроходным алгоритмом построения дерева.

## 📋 Содержание

- [🚀 Быстрый старт](#-быстрый-старт)
- [📊 Производительность](#-производительность)
- [🏗️ Архитектура](#️-архитектура)
- [📋 API](#-api)
- [📚 Правила работы](#-правила-работы)

## 🚀 Быстрый старт

```typescript
import { ParserV2 } from './ParserV2'

const markups = ['@[__label__](__value__)', '#[__label__]']
const parser = new ParserV2(markups)

const result = parser.split('Hello @[world](test) and #[tag]')
// result: [TextToken, MarkToken{label: 'world', value: 'test'}, TextToken, MarkToken{label: 'tag'}]
```

## 📊 Производительность

**Benchmark результаты (nested structures):**

| Depth | Operations/sec |
|-------|----------------|
| 1 | 65,710 ops/sec |
| 2 | 40,092 ops/sec |
| 3 | 47,923 ops/sec |

**Характеристики:**
- **Сложность**: O(N log N) для nested parsing
- **Алгоритм**: Single-pass tree building + Aho-Corasick

## 🏗️ Архитектура

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
├── ParserV2.ts              # Главный класс парсера (60 строк)
├── types.ts                 # Типы и интерфейсы
├── index.ts                 # Публичные экспорты
├── README.md                # 📖 Документация и правила работы парсера
├── core/                    # Ядро функциональности
│   ├── PatternMatcher.ts    # Поиск всех matches
│   ├── PatternProcessor.ts  # Обработка цепочек паттернов
│   ├── MarkupDescriptor.ts  # Создание дескрипторов разметки
│   ├── SegmentMatcher.ts    # Матчинг сегментов (Aho-Corasick)
│   ├── TokenBuilder.ts      # Создание токенов
│   └── TreeBuilder.ts       # 🆕 Single-pass tree building
├── utils/                   # Утилиты
│   ├── AhoCorasick.ts       # Эффективный multi-pattern поиск
│   ├── PatternBuilder.ts    # Построение паттернов из цепочек
│   └── PatternChainManager.ts # Управление активными цепочками
└── tests/                   # Тесты
```

## 📋 API

```typescript
class ParserV2 {
  constructor(markups: Markup[])
  split(input: string): NestedToken[]
}

// Статический метод
ParserV2.split(input: string, markups: Markup[]): NestedToken[]
```

## 📚 Правила работы

### 1. Архитектурные принципы

#### Однопроходной алгоритм
- **Один проход** для поиска всех совпадений
- **Один проход** для построения дерева токенов
- **Нет рекурсивного парсинга** содержимого токенов

#### Позиционная семантика
- Все позиции относятся к **оригинальному тексту**
- `start` - **inclusive** (указывает на первый символ)
- `end` - **exclusive** (указывает на символ после последнего)
- Совместимость с `substring(start, end)`

#### Структура токенов
```typescript
TextToken: { type: 'text', content, position: {start, end} }
MarkToken: { type: 'mark', content, children: [], data: {label, value?, optionIndex}, position: {start, end} }
```

### 2. Markup Pattern Rules

#### Формат паттернов
Паттерн состоит из **статических сегментов** и **плейсхолдеров**:
- **Плейсхолдеры**: `__label__` и `__value__`
- **Примеры валидных паттернов**:
  - `@[__label__]` - один label
  - `@[__label__](__value__)` - label и value
  - `<__label__>__value__</__label__>` - два label (полностью поддерживается)

#### Валидация паттернов
- `__label__` может встречаться **1 или 2 раза**
- `__value__` может встречаться **0 или 1 раз**
- `__value__` **не может** появляться раньше первого `__label__`
- Паттерн должен содержать **хотя бы один статический сегмент**

#### Trigger и симметрия
- **Trigger** = первый символ первого сегмента (используется для группировки)
- **Symmetric pattern** = первый и последний сегменты одинаковые (`**text**`, `*text*`)

### 3. Алгоритм поиска совпадений

#### Segment Matching (Aho-Corasick)
- Все статические сегменты из всех паттернов собираются в единый список
- Алгоритм **Aho-Corasick** находит все вхождения сегментов в тексте
- Результат: `UniqueMatch[]` - уникальные сегменты по позиции+значению
- **Сложность:** O(N + M), где N = длина текста, M = количество паттернов

#### Pattern Building (Chain Management)
- **Pattern Chain** = цепочка сегментов, формирующая один паттерн
- Цепочка создается при нахождении **первого сегмента** паттерна
- Цепочка расширяется при нахождении **следующих сегментов**
- Цепочка завершается при нахождении **последнего сегмента**

#### Правила приоритетов паттернов
**При старте новой цепочки:**
- **Более длинные первые сегменты** имеют приоритет (избежание конфликтов `*` vs `**`)
- При равной длине - **меньше сегментов** = выше приоритет

**При расширении/завершении цепочки:**
- **Цепочки, завершающиеся на текущем сегменте** имеют приоритет (закрываются первыми)
- **Цепочки без вложений** имеют приоритет (закрываются первыми)
- **Lookahead**: если следующий сегмент доступен сразу - приоритет расширению
- При прочих равных: **LIFO** - позже начатая = выше приоритет (вложенная)

#### Pattern Exclusivity
- Паттерн **не может** начать новое совпадение, пока активна его цепочка
- Пример: `@[simple]` и `@[simple](value)` не могут быть активны одновременно
- Короткий паттерн, завершившись, **отменяет** более длинный с той же стартовой позицией

#### Фильтрация overlaps
После построения всех совпадений удаляются:
- **Partial matches** - совпадения, являющиеся частью более длинного с тем же началом/концом
- **Matches inside __value__** - совпадения внутри value-секции другого совпадения
- **Overlapping matches** - конфликтующие совпадения одного descriptor, начинающиеся в одной позиции

Сохраняются:
- **Вложенные совпадения** в label-секциях (для построения дерева)

### 4. Построение дерева токенов

#### Single-Pass Tree Building
Алгоритм обходит отсортированные совпадения **один раз** с использованием стека:

```
for each match in sorted_matches:
  1. Pop completed parents (match не содержится в их label)
  2. Skip если match начинается раньше текущей позиции (конфликт)
  3. Push match в стек для потенциальных children

Finalize remaining stack
```

**Сложность:** O(N log N) для сортировки + O(N) для построения

#### Правила вложенности
- **Parent-child связь**: child полностью содержится в **labelStart..labelEnd** родителя
- **Value-секции не парсятся**: совпадения внутри value игнорируются
- **Self-nesting не поддерживается**: паттерн не может быть вложен сам в себя

#### Структура children
- `children` содержит **чередование** TextToken и MarkToken
- Всегда начинается и заканчивается TextToken (даже пустыми)
- `children` **пустой массив** если нет вложенных MarkToken (только text)

#### Позиции текстовых токенов
- TextToken создается **между** MarkToken
- Пустые TextToken создаются на границах (совместимость с legacy)
- Позиции: `{start: prevMarkEnd, end: currentMarkStart}`

### 5. Edge Cases & Guarantees

#### Обработка граничных случаев
- ✅ **Пустой ввод** → `[TextToken("", 0, 0)]`
- ✅ **Текст без markup** → `[TextToken(text, 0, length)]`
- ✅ **Пустые label/value** → `""` (валидно)
- ✅ **Adjacent marks** → корректная позиционная семантика
- ✅ **Unicode/Emoji** → полная поддержка
- ✅ **Вложенные скобки в content** → `@[text [with] brackets]` работает

#### Гарантии безопасности
- 🛡️ **XSS защита** - валидация опасных паттернов
- 🛡️ **DoS prevention** - защита от бесконечных циклов
- 🛡️ **Валидация структуры** - проверка корректности дескрипторов
- 🛡️ **Position validation** - start ≤ end для всех токенов

#### Не поддерживается
- ❌ **Self-nesting** - `@[outer @[inner]]` не создаст вложенность для одного паттерна
- ❌ **Parsing inside __value__** - value рассматривается как plain text
- ❌ **Bracket counting** - паттерн закрывается первым закрывающим сегментом

### 6. Примеры

#### Простой случай
```typescript
Input:  "Hello @[world](test)"
Markup: "@[__label__](__value__)"
Output: [
  TextToken("Hello ", 0, 6),
  MarkToken("@[world](test)", 6, 20, children=[], data={label:"world", value:"test"}),
  TextToken("", 20, 20)
]
```

#### Вложенность
```typescript
Input:  "@[hello #[world]]"
Markups: ["@[__label__]", "#[__label__]"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[hello #[world]]", 0, 17, children=[
    TextToken("hello ", 2, 8),
    MarkToken("#[world]", 8, 16, children=[], data={label:"world"}),
    TextToken("", 16, 16)
  ], data={label:"hello #[world]"}),
  TextToken("", 17, 17)
]
```

#### HTML-подобные паттерны с двумя labels
```typescript
Input:  "Check <img>photo.jpg</img> image"
Markup: "<__label__>__value__</__label__>"
Output: [
  TextToken("Check ", 0, 6),
  MarkToken("<img>photo.jpg</img>", 6, 26, children=[], data={label:"img", value:"photo.jpg"}),
  TextToken(" image", 26, 32)
]
```