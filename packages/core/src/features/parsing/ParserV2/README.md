# ParserV2

Высокопроизводительный древовидный парсер для обработки вложенных markup конструкций в тексте с однопроходным алгоритмом построения дерева.

**📋 RFC:** [Nested marks](docs/RFC.%20Nested%20marks.md) - подробное описание требований и архитектурных решений.

## 📋 Содержание

- [🚀 Быстрый старт](#-быстрый-старт)
- [📊 Производительность](#-производительность)
- [🏗️ Архитектура](#️-архитектура)
- [📋 API](#-api)
- [📚 Правила работы](#-правила-работы)

## 🚀 Быстрый старт

```typescript
import { ParserV2 } from './ParserV2'

// Patterns with __label__ - no nesting support
const simpleMarkups = ['@[__label__](__value__)', '#[__label__]']
const parser = new ParserV2(simpleMarkups)

const result = parser.split('Hello @[world](test) and #[tag]')
// result: [TextToken('Hello '), MarkToken{label: 'world', value: 'test'}, TextToken(' and '), MarkToken{label: 'tag'}]

// Patterns with __nested__ - supports nesting
const nestedMarkups = ['@[__nested__]', '#[__nested__]']
const nestedParser = new ParserV2(nestedMarkups)

const nestedResult = nestedParser.split('@[hello #[world]]')
// result: [TextToken(''), MarkToken{label: 'hello #[world]', children: [...]}, TextToken('')]
```

## 📊 Производительность

**Benchmark результаты (nested structures):**

| Depth | Operations/sec |
|-------|----------------|
| 1 | 65,710 ops/sec |
| 2 | 40,092 ops/sec |
| 3 | 47,923 ops/sec |

**Характеристики:**
- **Сложность**: O(N log N) для nested parsing (sorting + single-pass building)
- **Алгоритм**: Single-pass tree building + Aho-Corasick multi-pattern matching
- **Memory**: O(N) space complexity (no duplicate parsing)

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
├── ParserV2.ts              # Главный класс парсера
├── ParserV2.bench.ts        # Бенчмарки производительности
├── ParserV2.spec.ts         # Тесты
├── README.md                # 📖 Документация и правила работы парсера
├── index.ts                 # Публичные экспорты
├── types.ts                 # Типы и интерфейсы
├── core/                    # Ядро функциональности
│   ├── MarkupDescriptor.ts  # Создание дескрипторов разметки
│   ├── PatternMatcher.ts    # Поиск всех matches
│   ├── PatternProcessor.ts  # Обработка цепочек паттернов
│   ├── SegmentMatcher.ts    # Матчинг сегментов (Aho-Corasick)
│   ├── TokenBuilder.ts      # Создание токенов
│   └── TreeBuilder.ts       # Single-pass tree building
└── utils/                   # Утилиты
    ├── AhoCorasick.ts       # Эффективный multi-pattern поиск
    ├── PatternBuilder.ts    # Построение паттернов из цепочек
    └── PatternChainManager.ts # Управление активными цепочками
```

## 🎨 Визуализация

### Структура NestedToken

```typescript
// Простое дерево токенов
"Hello @[world](test) and #[tag]"
     ↓
[
  TextToken("Hello ", 0, 6),
  MarkToken("@[world](test)", 6, 20, data={label:"world", value:"test"}, children=[]),
  TextToken(" and ", 20, 25),
  MarkToken("#[tag]", 25, 31, data={label:"tag"}, children=[]),
  TextToken("", 31, 31)
]
```

### Дерево с вложенностью

```typescript
// Вложенная структура: @[hello #[world]]
"@[hello #[world]]"
     ↓
[
  TextToken("", 0, 0),
  MarkToken("@[hello #[world]]", 0, 17, data={label:"hello #[world]"}, children=[
    TextToken("hello ", 2, 8),
    MarkToken("#[world]", 8, 16, data={label:"world"}, children=[
      TextToken("", 10, 10),
      // ... пустые TextToken по краям
    ]),
    TextToken("", 16, 16)
  ]),
  TextToken("", 17, 17)
]
```

### Position Semantics

```typescript
// Пример: "@[world](test)"
// Индексы:  012345678901234 (длина 15)
// Текст:    @[world](test)
// Match:    ^^^^^^^^^^^^^^^
// Label:       ^^^^^
// Value:             ^^^^

// Все позиции exclusive (JavaScript convention)
match.start = 0, match.end = 15      // substring(0, 15) = "@[world](test)"
match.labelStart = 2, match.labelEnd = 7  // substring(2, 7) = "world"
match.valueStart = 9, match.valueEnd = 14 // substring(9, 14) = "test"
```

### Алгоритм Flow

```
Input Text → Aho-Corasick → UniqueMatches
                              ↓
                      PatternProcessor
                              ↓
              PatternChain Management (LIFO stack)
                              ↓
                      Filter Overlaps
                      - Remove matches inside __value__
                      - Remove partial matches
                              ↓
                        MatchResults
                              ↓
                TreeBuilder (single-pass)
                - Stack-based parent-child detection
                - Position containment check
                              ↓
                      NestedToken[]
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
- **Все позиции следуют JavaScript convention**: `start` - inclusive, `end` - **exclusive**
- Совместимы с `substring(start, end)` для всех типов позиций

**Пример:**
```typescript
// Текст: "@[world](test)"
// Индексы:  012345678901234 (длина 15)

// Match позиции:
match.start = 0, match.end = 15  // substring(0, 15) = "@[world](test)"

// Label позиции:
match.labelStart = 2, match.labelEnd = 7  // substring(2, 7) = "world"

// Value позиции:
match.valueStart = 9, match.valueEnd = 14  // substring(9, 14) = "test"
```

#### Структура токенов
```typescript
TextToken: { type: 'text', content, position: {start, end} }
MarkToken: { type: 'mark', content, children: [], data: {label, value?, optionIndex}, position: {start, end} }
```

### 2. Markup Pattern Rules

#### Формат паттернов
Паттерн состоит из **статических сегментов** и **плейсхолдеров**:
- **Плейсхолдеры**: `__label__`, `__value__`, и `__nested__`
- **Примеры валидных паттернов**:
  - `@[__label__]` - label без поддержки вложенности
  - `@[__nested__]` - content с поддержкой вложенности
  - `@[__label__](__value__)` - label и value
  - `@[__nested__](__value__)` - nested content и value
  - `<__label__>__value__</__label__>` - два label (полностью поддерживается)

#### Валидация паттернов
- `__label__` может встречаться **0, 1 или 2 раза**
- `__nested__` может встречаться **0 или 1 раз**
- `__label__` и `__nested__` **взаимоисключающие** - нельзя использовать оба в одном паттерне
- Паттерн должен содержать **хотя бы один** `__label__` или `__nested__`
- `__value__` может встречаться **0 или 1 раз**
- `__value__` **не может** появляться раньше первого контент-плейсхолдера (`__label__` или `__nested__`)
- Паттерн должен содержать **хотя бы один статический сегмент**

**Примеры ошибок валидации:**
```typescript
// ❌ Использование __label__ и __nested__ вместе
"@[__label__](__nested__)"  // Error: Cannot use both "__label__" and "__nested__" in the same pattern

// ❌ Нет контент-плейсхолдера
"@[](__value__)"  // Error: Must have at least one "__label__" or "__nested__" placeholder

// ❌ Слишком много __nested__ плейсхолдеров
"@[__nested__](__nested__)"  // Error: Expected 0 or 1 "__nested__" placeholder, but found 2

// ❌ Слишком много __value__ плейсхолдеров
"@[__label__](__value__)(__value__)"  // Error: Expected 0 or 1 "__value__" placeholder, but found 2

// ❌ __value__ перед контент-плейсхолдером
"(__value__)@[__label__]"  // Error: "__value__" cannot appear before the first content placeholder

// ❌ Нет статических сегментов
"__label__"  // Error: Must have at least one static segment
```

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
- **Matches inside __label__** - совпадения внутри label-секции другого совпадения (labels не поддерживают вложенность)
- **Overlapping matches** - конфликтующие совпадения одного descriptor, начинающиеся в одной позиции

Сохраняются:
- **Вложенные совпадения** в __nested__ секциях (для построения дерева)

#### Advanced Algorithm Details

**Lazy Gap Materialization:**
```typescript
// Gaps в PatternMatch изначально undefined для оптимизации памяти
part.value === undefined  // еще не материализован

// При необходимости выполняется materialization:
if (part.start > part.end) {
  part.value = ''  // пустой gap (смежные сегменты)
} else {
  part.value = input.slice(part.start, part.end + 1)
}
```

**Non-Nested Gap Filtering Strategy:**
Совпадения внутри `__value__` и `__label__` секций фильтруются, потому что они рассматриваются как plain text.
Только `__nested__` секции поддерживают вложенность:
```typescript
// Проверка: matchB начинается внутри non-nested gap (value или label) matchA?
for (const part of matchA.parts) {
  if (part.type === 'gap' && (part.gapType === 'value' || part.gapType === 'label')) {
    if (matchB.start >= part.start && matchB.start <= part.end) {
      // matchB фильтруется - он внутри non-nested gap
    }
  }
  // Если gapType === 'nested', вложенность разрешена
}
```

**Nesting Stack Management:**
PatternProcessor использует LIFO stack для отслеживания активных цепочек:
```typescript
const nestingStack: PatternChain[] = []

for (const match of uniqueMatches) {
  // 1. Обработать завершенные цепочки
  processWaitingChains(match, results, nestingStack)

  // 2. Начать новые цепочки
  startNewChains(match, results, nestingStack)
}
```
Цепочки управляются по принципу "последний вошел - первый вышел" для правильной обработки вложенности.

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
- **Parent-child связь**: child полностью содержится в **nestedStart..nestedEnd** родителя (или **labelStart..labelEnd** для обратной совместимости)
- **__nested__ секции поддерживают вложенность**: совпадения внутри `__nested__` сохраняются и формируют дерево
- **__label__ и __value__ секции не парсятся**: совпадения внутри этих секций игнорируются
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

#### Не поддерживается
- ❌ **Self-nesting** - `@[outer @[inner]]` не создаст вложенность для одного паттерна
- ❌ **Parsing inside __value__** - value рассматривается как plain text
- ❌ **Parsing inside __label__** - label рассматривается как plain text (используйте `__nested__` для вложенности)
- ❌ **Bracket counting** - паттерн закрывается первым закрывающим сегментом

#### __nested__ vs __label__
**Ключевое различие:**
- `__label__` - содержимое рассматривается как **plain text**, вложенные паттерны игнорируются
- `__nested__` - содержимое **поддерживает вложенность**, вложенные паттерны парсятся

**Когда использовать `__label__`:**
- Для простого текстового контента без вложенности
- Для ссылок, тегов, меток, имен
- Когда нужна гарантия, что контент будет plain text

**Когда использовать `__nested__`:**
- Для форматированного текста (markdown, HTML)
- Когда нужна поддержка вложенных конструкций
- Для контейнеров с произвольным контентом

**Пример:**
```typescript
// ❌ С __label__ - вложенность НЕ работает
const parser1 = new ParserV2(['@[__label__]', '#[__label__]'])
parser1.split('@[hello #[world]]')
// → [MarkToken{label: "hello #[world]", children: []}] - нет вложенности

// ✅ С __nested__ - вложенность работает
const parser2 = new ParserV2(['@[__nested__]', '#[__nested__]'])
parser2.split('@[hello #[world]]')
// → [MarkToken{label: "hello #[world]", children: [MarkToken{label: "world"}]}] - есть вложенность
```

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

#### Вложенность (с __nested__)
```typescript
Input:  "@[hello #[world]]"
Markups: ["@[__nested__]", "#[__nested__]"]
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

#### Без вложенности (с __label__)
```typescript
Input:  "@[hello #[world]]"
Markups: ["@[__label__]", "#[__label__]"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[hello #[world]]", 0, 17, children=[], data={label:"hello #[world]"}),
  TextToken("", 17, 17)
]
// Обратите внимание: children пустой, #[world] остался plain text в label
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

#### Adjacent marks
```typescript
Input:  "@[first](1)@[second](2)"
Markups: ["@[__label__](__value__)"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[first](1)", 0, 11, children=[], data={label:"first", value:"1"}),
  TextToken("", 11, 11),
  MarkToken("@[second](2)", 11, 23, children=[], data={label:"second", value:"2"}),
  TextToken("", 23, 23)
]
```

#### Empty labels and values
```typescript
Input:  "@[] @[content] @[label]() @[another](value)"
Markups: ["@[__label__]", "@[__label__](__value__)"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[]", 0, 3, children=[], data={label:""}),  // пустой label
  TextToken(" ", 3, 4),
  MarkToken("@[content]", 4, 14, children=[], data={label:"content"}),
  TextToken(" ", 14, 15),
  MarkToken("@[label]()", 15, 25, children=[], data={label:"label", value:""}),  // пустой value
  TextToken(" ", 25, 26),
  MarkToken("@[another](value)", 26, 42, children=[], data={label:"another", value:"value"}),
  TextToken("", 42, 42)
]
```

#### Symmetric patterns (Markdown-style)
```typescript
Input:  "**bold text** and *italic text*"
Markups: ["**__label__**", "*__label__*"]
Output: [
  TextToken("", 0, 0),
  MarkToken("**bold text**", 0, 13, children=[], data={label:"bold text"}),
  TextToken(" and ", 13, 19),
  MarkToken("*italic text*", 19, 33, children=[], data={label:"italic text"}),
  TextToken("", 33, 33)
]
```

#### Conflicting patterns (shorter wins)
```typescript
Input:  "@[simple] @[with](value)"
Markups: ["@[__label__]", "@[__label__](__value__)"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[simple]", 0, 9, children=[], data={label:"simple"}),
  TextToken(" ", 9, 10),
  MarkToken("@[with]", 10, 17, children=[], data={label:"with"}),  // короткий паттерн без value
  TextToken("(value)", 17, 24)  // остаток текста
]
```