# ParserV2

Высокопроизводительный древовидный парсер для обработки вложенных markup конструкций в тексте с однопроходным алгоритмом построения дерева.

**📋 RFC:** [Nested marks](docs/RFC.%20Nested%20marks.md) - подробное описание требований и архитектурных решений.

## 📋 Содержание

- [🚀 Быстрый старт](#-быстрый-старт)
- [📊 Производительность](#-производительность)
- [🏗️ Архитектура](#️-архитектура)
- [📋 API](#-api)
- [📚 Правила работы](#-правила-работы)
- [🎯 Примеры работы с конфликтующими паттернами](#-примеры-работы-с-конфликтующими-паттернами)

## 🚀 Быстрый старт

```typescript
import { ParserV2 } from './ParserV2'

// Patterns with __meta__ - no nesting support
const simpleMarkups = ['@[__meta__](__meta__)', '#[__meta__]']
const parser = new ParserV2(simpleMarkups)

const result = parser.split('Hello @[world](test) and #[tag]')
// result: [TextToken('Hello '), MarkToken{meta: 'world', meta: 'test'}, TextToken(' and '), MarkToken{meta: 'tag'}]

// Patterns with __nested__ - supports nesting
const nestedMarkups = ['@[__nested__]', '#[__nested__]']
const nestedParser = new ParserV2(nestedMarkups)

const nestedResult = nestedParser.split('@[hello #[world]]')
// result: [TextToken(''), MarkToken{meta: 'hello #[world]', children: [...]}, TextToken('')]
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
  optionIndex: number         // Индекс markup descriptor
  value: string               // Текст между сегментами
  meta?: string               // Дополнительные метаданные
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
│   ├── PatternProcessor.ts  # Координатор обработки паттернов
│   ├── ChainMatcher.ts      # Построение цепочек паттернов
│   ├── MatchValidator.ts    # Валидация и фильтрация matches
│   ├── MatchPostProcessor.ts # Конверсия в MatchResult
│   ├── TokenBuilder.ts      # Создание токенов
│   └── TreeBuilder.ts       # Single-pass tree building
└── utils/                   # Утилиты
    ├── MarkupRegistry.ts    # Реестр дескрипторов + дедуплицированные сегменты
    ├── AhoCorasick.ts       # Эффективный multi-pattern поиск (использует дедуплицированные сегменты)
    ├── PatternBuilder.ts    # Построение паттернов из цепочек
    ├── PatternSorting.ts    # Статические методы сортировки
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
  MarkToken("@[world](test)", 6, 20, data={meta:"world", meta:"test"}, children=[]),
  TextToken(" and ", 20, 25),
  MarkToken("#[tag]", 25, 31, data={meta:"tag"}, children=[]),
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
  MarkToken("@[hello #[world]]", 0, 17, data={meta:"hello #[world]"}, children=[
    TextToken("hello ", 2, 8),
    MarkToken("#[world]", 8, 16, data={meta:"world"}, children=[
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
Input Text → Aho-Corasick → SegmentMatches
                              ↓
                    PatternProcessor
                    (координатор)
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
   ChainMatcher      MatchValidator       PriorityResolver
   (build chains)    (validate+filter)    (sort)
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              ↓
                   Validated PatternMatches
                              ↓
                   MatchPostProcessor
                   (convert to MatchResult)
                              ↓
                       MatchResults
                              ↓
                TreeBuilder (single-pass)
                - Stack-based parent-child detection
                - Position containment check
                              ↓
                      NestedToken[]
```

### Разделение ответственностей

**PatternProcessor** - минимальный координатор (всего 3 строки логики):
- `ChainMatcher` - построение цепочек паттернов из сегментов
- `MatchValidator` - валидация и фильтрация matches
- `PatternSorting` - статические методы для сортировки

**ChainMatcher** - полная изоляция логики построения цепочек:
- Создает `PatternBuilder` и `PatternChainManager` внутри себя
- Обработка ожидающих цепочек с `PatternSorting.sortWaitingChains()`
- Запуск новых цепочек с `PatternSorting.sortDescriptors()`
- Отслеживание вложенности через `nestingStack`

**PatternSorting** - статические методы сортировки:
- `sortWaitingChains()` - приоритизация цепочек при расширении
- `sortDescriptors()` - приоритизация паттернов при старте
- `sortPatternMatches()` - финальная сортировка для tree building

**MatchValidator** - пятиэтапный pipeline фильтрации:
1. Фильтрация matches внутри non-nested gaps (`__meta__`, `__value__`)
2. Фильтрация конфликтов одного descriptor на одной позиции
3. Материализация gaps из текста
4. Фильтрация partial matches (с общими границами)
5. Валидация двух `__value__` для HTML-подобных паттернов

**MatchPostProcessor** - конверсия в финальный формат:
- Извлечение контента (value, nested, meta)
- Создание `MatchResult[]` с позициями

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
MarkToken: { type: 'mark', content, children: [], optionIndex, value, meta?, position: {start, end} }
```

### 2. Markup Pattern Rules

#### Формат паттернов
Паттерн состоит из **статических сегментов** и **плейсхолдеров**:
- **Плейсхолдеры**: `__meta__`, `__meta__`, и `__nested__`
- **Примеры валидных паттернов**:
  - `@[__meta__]` - value без поддержки вложенности
  - `@[__nested__]` - content с поддержкой вложенности
  - `@[__meta__](__meta__)` - value и value
  - `@[__nested__](__meta__)` - nested content и value
  - `@[__meta__](__nested__)` - value и nested content (комбинированный паттерн)
  - `<__meta__>__meta__</__meta__>` - два value (HTML-подобный)
  - `<__meta__ __meta__>__nested__</__meta__>` - HTML-подобный с вложенностью
  - `(__meta__)@[__meta__]` - value перед content (любой порядок разрешен)

#### Валидация паттернов
- `__meta__` может встречаться **0, 1 или 2 раза**
- `__nested__` может встречаться **0 или 1 раз**
- `__meta__` и `__nested__` **могут использоваться вместе** в одном паттерне (например, `@[__meta__](__nested__)`)
- Паттерн должен содержать **хотя бы один** `__meta__` или `__nested__`
- `__meta__` может встречаться **0 или 1 раз**
- `__meta__` **может появляться в любой позиции** - до, между или после контент-плейсхолдеров
- Паттерн должен содержать **хотя бы один статический сегмент**
- **Для паттернов с двумя `__meta__`** (например, `<__meta__>__nested__</__meta__>`): оба value должны быть **идентичны**, иначе паттерн не матчится

**Примеры ошибок валидации:**
```typescript
// ❌ Нет контент-плейсхолдера
"@[](__meta__)"  // Error: Must have at least one "__meta__" or "__nested__" placeholder

// ❌ Слишком много __nested__ плейсхолдеров
"@[__nested__](__nested__)"  // Error: Expected 0 or 1 "__nested__" placeholder, but found 2

// ❌ Слишком много __meta__ плейсхолдеров
"@[__meta__](__meta__)(__meta__)"  // Error: Expected 0 or 1 "__meta__" placeholder, but found 2

// ❌ Нет статических сегментов
"__meta__"  // Error: Must have at least one static segment
```

**Примеры валидных комбинаций:**
```typescript
// ✅ Комбинация __meta__ и __nested__
"@[__meta__](__nested__)"  // value для идентификации, nested для вложенного контента

// ✅ Комбинация __meta__ и __meta__
"@[__meta__](__meta__)"   // value для идентификации, value для простого значения

// ✅ Комбинация __nested__ и __meta__
"@[__nested__](__meta__)"  // nested контент и простое значение

// ✅ HTML-подобный с label, value и nested
"<__meta__ __meta__>__nested__</__meta__>"  // полноценный HTML-подобный тег с атрибутами и контентом

// ✅ Value перед контент-плейсхолдером
"(__meta__)@[__meta__]"   // value может быть в любой позиции
"[__meta__](__meta__)(__nested__)"  // value между value и nested
```

#### Trigger и симметрия
- **Trigger** = первый символ первого сегмента (используется для группировки)
- **Symmetric pattern** = первый и последний сегменты одинаковые (`**text**`, `*text*`)

### 3. Алгоритм поиска совпадений

#### Segment Matching (Aho-Corasick)
- Все статические сегменты из всех паттернов дедуплицируются в `MarkupRegistry`
- Алгоритм **Aho-Corasick** находит все вхождения сегментов в тексте
- Результат: `SegmentMatch[]` - найденные сегменты с позициями и индексами
- **Сложность:** O(N + M), где N = длина текста, M = количество паттернов

#### Pattern Building (Chain Management)
- **Pattern Chain** = цепочка сегментов, формирующая один паттерн
- Цепочка создается при нахождении **первого сегмента** паттерна
- Цепочка расширяется при нахождении **следующих сегментов**
- Цепочка завершается при нахождении **последнего сегмента**

#### Правила приоритетов паттернов

**При старте новой цепочки:**
- **Более длинные первые сегменты** имеют приоритет (избежание конфликтов `*` vs `**`)
- При равной длине - **больше сегментов** = выше приоритет (более специфичные паттерны первыми)

**При расширении/завершении цепочки:**
- **Цепочки, завершающиеся на текущем сегменте** имеют приоритет (закрываются первыми)
- **Цепочки без вложений** имеют приоритет (закрываются первыми)
- **Lookahead**: если следующий сегмент доступен сразу - приоритет расширению
- **Для цепочек с одинаковой стартовой позицией** (конфликтующих):
  - **Больше собранных сегментов** = выше приоритет (более специфичный паттерн)
  - При равенстве - **больше общее количество сегментов** = выше приоритет
- При прочих равных: **LIFO** - позже начатая = выше приоритет (вложенная)

#### Pattern Exclusivity
- Паттерн **не может** начать новое совпадение, пока активна его цепочка
- Пример: `@[simple]` и `@[simple](value)` не могут быть активны одновременно
- Короткий паттерн, завершившись, **отменяет** более длинный с той же стартовой позицией

#### Фильтрация overlaps
После построения всех совпадений удаляются:
- **Partial matches** - совпадения, являющиеся частью более длинного с тем же началом/концом
- **Matches inside __meta__** - совпадения внутри value-секции другого совпадения
- **Matches inside __meta__** - совпадения внутри label-секции другого совпадения (values не поддерживают вложенность)
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
Совпадения внутри `__meta__` и `__meta__` секций фильтруются, потому что они рассматриваются как plain text.
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
- **__meta__ и __meta__ секции не парсятся**: совпадения внутри этих секций игнорируются
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
- ❌ **Parsing inside __meta__** - value рассматривается как plain text
- ❌ **Parsing inside __meta__** - value рассматривается как plain text (используйте `__nested__` для вложенности)
- ❌ **Bracket counting** - паттерн закрывается первым закрывающим сегментом

#### __nested__ vs __meta__
**Ключевое различие:**
- `__meta__` - содержимое рассматривается как **plain text**, вложенные паттерны игнорируются
- `__nested__` - содержимое **поддерживает вложенность**, вложенные паттерны парсятся

**Когда использовать `__meta__`:**
- Для простого текстового контента без вложенности
- Для ссылок, тегов, меток, имен
- Когда нужна гарантия, что контент будет plain text

**Когда использовать `__nested__`:**
- Для форматированного текста (markdown, HTML)
- Когда нужна поддержка вложенных конструкций
- Для контейнеров с произвольным контентом

**Пример:**
```typescript
// ❌ С __meta__ - вложенность НЕ работает
const parser1 = new ParserV2(['@[__meta__]', '#[__meta__]'])
parser1.split('@[hello #[world]]')
// → [MarkToken{meta: "hello #[world]", children: []}] - нет вложенности

// ✅ С __nested__ - вложенность работает
const parser2 = new ParserV2(['@[__nested__]', '#[__nested__]'])
parser2.split('@[hello #[world]]')
// → [MarkToken{meta: "hello #[world]", children: [MarkToken{meta: "world"}]}] - есть вложенность
```

### 6. Примеры

#### Простой случай
```typescript
Input:  "Hello @[world](test)"
Markup: "@[__meta__](__meta__)"
Output: [
  TextToken("Hello ", 0, 6),
  MarkToken("@[world](test)", 6, 20, children=[], data={meta:"world", meta:"test"}),
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
    MarkToken("#[world]", 8, 16, children=[], data={meta:"world"}),
    TextToken("", 16, 16)
  ], data={meta:"hello #[world]"}),
  TextToken("", 17, 17)
]
```

#### Без вложенности (с __meta__)
```typescript
Input:  "@[hello #[world]]"
Markups: ["@[__meta__]", "#[__meta__]"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[hello #[world]]", 0, 17, children=[], data={meta:"hello #[world]"}),
  TextToken("", 17, 17)
]
// Обратите внимание: children пустой, #[world] остался plain text в label
```

#### HTML-подобные паттерны с двумя values
```typescript
Input:  "Check <img>photo.jpg</img> image"
Markup: "<__meta__>__meta__</__meta__>"
Output: [
  TextToken("Check ", 0, 6),
  MarkToken("<img>photo.jpg</img>", 6, 26, children=[], data={meta:"img", meta:"photo.jpg"}),
  TextToken(" image", 26, 32)
]
```

#### Комбинированный паттерн (__meta__ и __nested__)
```typescript
Input:  "@[user](Hello #[world])"
Markups: ["@[__meta__](__nested__)", "#[__nested__]"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[user](Hello #[world])", 0, 23, children=[
    TextToken("Hello ", 7, 13),
    MarkToken("#[world]", 13, 21, children=[], data={meta:"world"}),
    TextToken("", 21, 21)
  ], data={meta:"user"}),
  TextToken("", 23, 23)
]
// Обратите внимание: value="user" идентифицирует токен, а nested контент содержит вложенную разметку
```

#### HTML-подобный паттерн с label, value и nested
```typescript
Input:  "<div class>Content with **bold**</div>"
Markups: ["<__meta__ __meta__>__nested__</__meta__>", "**__nested__**"]
Output: [
  TextToken("", 0, 0),
  MarkToken("<div class>Content with **bold**</div>", 0, 39, children=[
    TextToken("Content with ", 11, 24),
    MarkToken("**bold**", 24, 32, children=[], data={meta:"bold"}),
    TextToken("", 32, 32)
  ], data={meta:"div", meta:"class"}),
  TextToken("", 39, 39)
]
// HTML-подобная разметка с атрибутом (value) и вложенным форматированным контентом
```

#### Value перед контент-плейсхолдером
```typescript
Input:  "(url)@[link]"
Markup: "(__meta__)@[__meta__]"
Output: [
  TextToken("", 0, 0),
  MarkToken("(url)@[link]", 0, 12, children=[], data={meta:"link", meta:"url"}),
  TextToken("", 12, 12)
]
// Value может появляться перед value - порядок не ограничен
```

#### Валидация совпадения открывающих и закрывающих тегов
```typescript
Input:  "<div1>text</div2>"
Markup: "<__meta__>__nested__</__meta__>"
Output: [
  TextToken("<div1>text</div2>", 0, 17)
]
// НЕ матчится - открывающий тег "div1" не совпадает с закрывающим "div2"
// Паттерны с двумя __meta__ требуют идентичности обоих label
```

#### Adjacent marks
```typescript
Input:  "@[first](1)@[second](2)"
Markups: ["@[__meta__](__meta__)"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[first](1)", 0, 11, children=[], data={meta:"first", meta:"1"}),
  TextToken("", 11, 11),
  MarkToken("@[second](2)", 11, 23, children=[], data={meta:"second", meta:"2"}),
  TextToken("", 23, 23)
]
```

#### Empty values and values
```typescript
Input:  "@[] @[content] @[label]() @[another](value)"
Markups: ["@[__meta__]", "@[__meta__](__meta__)"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[]", 0, 3, children=[], data={meta:""}),  // пустой label
  TextToken(" ", 3, 4),
  MarkToken("@[content]", 4, 14, children=[], data={meta:"content"}),
  TextToken(" ", 14, 15),
  MarkToken("@[label]()", 15, 25, children=[], data={meta:"label", meta:""}),  // пустой value
  TextToken(" ", 25, 26),
  MarkToken("@[another](value)", 26, 42, children=[], data={meta:"another", meta:"value"}),
  TextToken("", 42, 42)
]
```

#### Symmetric patterns (Markdown-style)
```typescript
Input:  "**bold text** and *italic text*"
Markups: ["**__meta__**", "*__meta__*"]
Output: [
  TextToken("", 0, 0),
  MarkToken("**bold text**", 0, 13, children=[], data={meta:"bold text"}),
  TextToken(" and ", 13, 19),
  MarkToken("*italic text*", 19, 33, children=[], data={meta:"italic text"}),
  TextToken("", 33, 33)
]
```

## 🎯 Примеры работы с конфликтующими паттернами

ParserV2 использует сложную систему приоритетов для разрешения конфликтов между паттернами, которые могут совпадать на одном сегменте текста.

### Основные принципы приоритетов

1. **Более специфичные паттерны первыми**: Паттерны с большим количеством сегментов получают приоритет
2. **Прогресс имеет значение**: Chain с большим количеством собранных сегментов приоритетнее
3. **Длинные сегменты важнее**: Паттерны с длинными начальными сегментами избегают конфликтов
4. **LIFO для вложенности**: Более поздние (внутренние) паттерны получают приоритет

### Примеры конфликтов

#### Conflicting patterns (shorter wins)
```typescript
Input:  "@[simple] @[with](value)"
Markups: ["@[__meta__]", "@[__meta__](__meta__)"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[simple]", 0, 9, children=[], data={meta:"simple"}),
  TextToken(" ", 9, 10),
  MarkToken("@[with]", 10, 17, children=[], data={meta:"with"}),  // короткий паттерн без value
  TextToken("(value)", 17, 24)  // остаток текста
]
```

#### Приоритет по количеству сегментов
```typescript
Input:  "<div class><p>Text</p></div>"
Markups: [
  "<__meta__>__nested__</__meta__>",        // 4 сегмента
  "<__meta__ __meta__>__nested__</__meta__>" // 5 сегментов - выше приоритет
]
Output: [
  TextToken("", 0, 0),
  MarkToken("<div class><p>Text</p></div>", 0, 28, children=[
    TextToken("", 11, 11),
    MarkToken("<p>Text</p>", 11, 22, children=[], data={meta:"p"}),
    TextToken("", 22, 22)
  ], data={meta:"div", meta:"class"}),
  TextToken("", 28, 28)
]
// Паттерн с 5 сегментами получает приоритет над паттерном с 4 сегментами
```

#### Конфликт с одинаковой стартовой позицией
```typescript
Input:  "<div class><p>Text</p></div>"
Markups: [
  "<__meta__ __meta__>__nested__</__meta__>", // 5 сегментов, 2 собранных в начале
  "<__meta__>__nested__</__meta__>"           // 4 сегмента, 1 собранный в начале
]
Output: [
  TextToken("<div class>", 0, 11),
  MarkToken("<p>Text</p>", 11, 22, children=[], data={meta:"p"}),
  TextToken("</div>", 22, 28)
]
// Паттерн с больше собранными сегментами (2) получает приоритет над паттерном с 1 собранным сегментом
```

#### Разрешение конфликтов при одинаковом прогрессе
```typescript
Input:  "**bold**"
Markups: [
  "**__meta__**",  // 3 сегмента
  "*__meta__*"     // 3 сегмента (симметричный)
]
Output: [
  TextToken("", 0, 0),
  MarkToken("**bold**", 0, 8, children=[], data={meta:"bold"}),
  TextToken("", 8, 8)
]
// При равном прогрессе выбирается первый паттерн из списка
```

### Рекомендации по работе с конфликтами

- **Размещайте более специфичные паттерны перед общими**: Паттерны с `__meta__` или большим количеством сегментов должны идти первыми
- **Используйте `__nested__` для вложенного контента**: Это позволяет создавать иерархическую структуру
- **Используйте `__meta__` для простого текста**: Когда вложенность не нужна
- **Тестируйте порядок паттернов**: При добавлении новых правил разметки проверяйте, как они взаимодействуют с существующими
- **Документируйте приоритеты**: В сложных приложениях документируйте порядок паттернов для будущих разработчиков

## Файлы для изменения

```
Новые файлы:
+ packages/core/src/features/parsing/ParserV2/utils/PatternSorting.ts
+ packages/core/src/features/parsing/ParserV2/core/ChainMatcher.ts
+ packages/core/src/features/parsing/ParserV2/core/MatchValidator.ts

Изменяемые файлы:
~ packages/core/src/features/parsing/ParserV2/core/PatternProcessor.ts
  - Упростить до минимального координатора (3 строки логики)
  - Удалить создание patternBuilder/chainManager (переехало в ChainMatcher)
  - Удалить методы фильтрации (переехали в MatchValidator)
  - Удалить внутренние сортировки (переехали в PatternSorting)
~ packages/core/src/features/parsing/ParserV2/core/MatchPostProcessor.ts
  - Убрать sortByPositionAndLength (переехало в PatternSorting)
  - Убрать логику фильтрации из removeOverlaps (переехала в MatchValidator)
  - Переименовать removeOverlaps → convertToResults
  - Оставить только материализацию и извлечение контента
~ packages/core/src/features/parsing/ParserV2/ParserV2.ts
  - Изменить сигнатуру: processMatches(uniqueMatches, value)
  - Удалить вызов sortByPositionAndLength
  - Переименовать вызов: removeOverlaps → convertToResults
~ packages/core/src/features/parsing/ParserV2/index.ts
  - Добавить экспорт PatternSorting
~ packages/core/src/features/parsing/ParserV2/README.md
  - Обновить архитектуру и разделение ответственностей

Удаленные файлы:
- packages/core/src/features/parsing/ParserV2/core/PriorityResolver.ts
```