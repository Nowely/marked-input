# ParserV2

Древовидный парсер для обработки вложенных markup конструкций в тексте.

## Обзор

`ParserV2` представляет собой новую архитектуру парсера, способную обрабатывать вложенные markup конструкции. В отличие от плоского парсера v1, который работает с линейной последовательностью tokens, ParserV2 строит древовидную структуру, позволяющую корректно обрабатывать вложенность.

## Основные возможности

- **Древовидный разбор**: Поддержка произвольной глубины вложенности
- **Безопасность**: Встроенная защита от XSS и DoS атак
- **Валидация**: Полная проверка корректности структуры
- **Производительность**: Оптимизированные алгоритмы для больших документов
- **Расширяемость**: Простое добавление новых типов markup

## Архитектура

### Основные компоненты

```typescript
type NestedToken = TextToken | MarkToken

interface TextToken {
  type: 'text'
  content: string
  position: {
    start: number
    end: number
  }
}

interface MarkToken {
  type: 'mark'
  content: string
  children: NestedToken[]
  data: {
    label: string        // Текст без вложенных маркеров
    value?: string
    optionIndex: number
  }
  position: {
    start: number
    end: number
  }
}

interface MatchResult {
  start: number
  end: number
  content: string
  label: string
  value?: string
  descriptor: MarkupDescriptor
}

interface TokenCandidate {
  match: MatchResult
  conflicts: Set<TokenCandidate>
}
```

### Компонентная архитектура

ParserV2 использует принципы **Composition over Inheritance** и **Single Responsibility Principle**:

```
ParserV2 (главный класс)
├── PatternMatcher - находит все матчи маркеров в тексте
├── ConflictResolver - разрешает конфликты между пересекающимися маркерами
├── TokenSequenceBuilder - строит гарантированную последовательность токенов
└── GenericMarkupStrategy - универсальная стратегия для всех типов маркеров
```

### Эволюция архитектуры

После рефакторинга v2.0.1 архитектура была значительно упрощена:

**Убрано:**
- ❌ `BracketMarkupStrategy` - для маркеров типа `#[__label__]`
- ❌ `ParenMarkupStrategy` - для маркеров типа `@[__label__](__value__)`
- ❌ Папка `strategies/` и сложная структура
- ❌ `Map<MarkupDescriptor, MarkupStrategy>` в `PatternMatcher`
- ❌ Сложная логика выбора стратегии

**Улучшено:**
- ✅ Единая `GenericMarkupStrategy` для всех типов маркеров
- ✅ Упрощенная структура файлов (убрана папка strategies)
- ✅ Один экземпляр стратегии вместо Map
- ✅ Лучшая читаемость и поддерживаемость кода
- ✅ Меньше накладных расходов на создание объектов

### Алгоритм работы

1. **Поиск матчей**: `PatternMatcher` находит все потенциальные маркеры в тексте
2. **Разрешение конфликтов**: `ConflictResolver` выбирает непересекающиеся маркеры, предпочитая более длинные
3. **Построение последовательности**: `TokenSequenceBuilder` создает гарантированную структуру `text-mark-text-mark-text...`

### Стратегия парсинга

ParserV2 использует единую универсальную стратегию парсинга для всех типов маркеров:

```typescript
interface MarkupStrategy {
  matches(descriptor: MarkupDescriptor, input: string, position: number): MatchResult | null
  extractContent(match: MatchResult): { label: string; value?: string }
}
```

**GenericMarkupStrategy** интеллектуально обрабатывает все поддерживаемые форматы маркеров:

**Поддерживаемые форматы:**
- **Bracket маркеры**: `#[__label__]`, `@[__label__](__value__)` - с подсчетом скобок для вложенности
- **HTML-подобные теги**: `<tag>__label__</tag>`, `<img>__value__</img>` - с поддержкой двух лейблов
- **Кастомные форматы**: `**[__label__]**`, `{{__label__}}`, `___[__label__]___` и т.д.
- **Markdown**: `[text](url)`, `![alt](src)`, `` `code` `` и т.д.

**Интеллектуальная обработка:**
- Автоматическое определение типа маркера по структуре
- Специальная логика для bracket-based маркеров (с подсчетом скобок)
- Поддержка паттернов с двумя лейблами (opening/closing теги)
- Универсальный поиск endPattern для всех остальных форматов

## Использование

### Базовый пример

```typescript
import {ParserV2} from './ParserV2'

const parser = new ParserV2(['@[__label__](__value__)', '#[__label__]'])
const result = parser.split('Hello @[world](test)!')

console.log(result)
// [
//   { type: 'text', content: '' },           // Начальный пустой токен
//   { type: 'text', content: 'Hello ' },
//   {
//     type: 'mark',
//     content: '@[world](test)',
//     children: [],
//     data: { label: 'world', value: 'test', optionIndex: 0 }
//   },
//   { type: 'text', content: '' },           // Гарантированно после mark
//   { type: 'text', content: '!' }           // Гарантированно после mark
 ]
```

**Гарантия структуры**: ParserV2 всегда возвращает последовательность `text - mark - text - mark - text...`, где после каждого `mark` обязательно идет `text` (даже если он пустой).

### Продвинутый пример с валидацией

```typescript
import {ParserV2, validateTreeStructure, validateNestedContent} from './ParserV2'

const parser = new ParserV2(['@[__label__](__value__)', '#[__label__]'])
const input = userInput // потенциально опасный контент

// Проверка безопасности
if (!validateNestedContent(input)) {
  throw new Error('Unsafe content detected')
}

const result = parser.split(input)

// Валидация структуры
const validation = validateTreeStructure(result)
if (!validation.isValid) {
  console.error('Invalid structure:', validation.errors)
}
```

## API Reference

### ParserV2

#### Конструктор

```typescript
constructor(markups: Markup[])
```

**Параметры:**
- `markups`: Массив строк markup (аналогично Parser v1)

#### Методы экземпляра

```typescript
split(value: string): NestedToken[]
```

Разбирает входную строку и возвращает древовидную структуру NestedToken.

**Гарантии структуры:**
- После каждого `MarkToken` всегда следует `TextToken` (даже пустой)
- Последовательность всегда: `text - mark - text - mark - text...`
- Структура поддерживается на всех уровнях рекурсии

### Компоненты

#### PatternMatcher

Отвечает за поиск всех потенциальных матчей маркеров в тексте.

```typescript
class PatternMatcher {
  constructor(input: string, markups: Markup[])
  findAllMatches(): MatchResult[]
}
```

#### ConflictResolver

Разрешает конфликты между пересекающимися маркерами, предпочитая более длинные.

```typescript
class ConflictResolver {
  resolve(matches: MatchResult[]): TokenCandidate[]
}
```

#### TokenSequenceBuilder

Строит гарантированную последовательность токенов из разрешенных кандидатов.

```typescript
class TokenSequenceBuilder {
  constructor(input: string, markups: Markup[])
  buildGuaranteedSequence(candidates: TokenCandidate[]): NestedToken[]
}
```

#### MarkupStrategy

Интерфейс для стратегий парсинга разных типов маркеров.

```typescript
interface MarkupStrategy {
  matches(descriptor: MarkupDescriptor, input: string, position: number): MatchResult | null
  extractContent(match: MatchResult): { label: string; value?: string }
}
```

## Типы NestedToken

### MarkToken
```typescript
interface MarkToken {
  type: 'mark'
  content: string
  children: NestedToken[]   // Обязательно присутствует для вложенности
  data: {               // Обязательно присутствует
    label: string
    value?: string
    optionIndex: number
  }
  position: { start: number; end: number }
}
```

Узел, представляющий распознанный маркер с метаданными. `children` содержит только вложенные маркеры (текст остается в `label`).

### TextToken
```typescript
interface TextToken {
  type: 'text'
  content: string
  position: { start: number; end: number }
}
```

Узел, представляющий обычный текст без маркеров.


### Опции конфигурации

```typescript
interface ParserV2Options {
  // В будущем можно добавить другие опции
}
```

### Утилиты валидации

#### validateTreeStructure

```typescript
validateTreeStructure(root: NestedToken): ValidationResult
```

Проверяет корректность структуры дерева.

#### validateNestedContent

```typescript
validateNestedContent(content: string): boolean
```

Проверяет контент на наличие опасных конструкций.

## Поддерживаемые форматы markup

### Стандартные форматы

1. **С value**: `@[__label__](__value__)` → `@[user](123)`
2. **Без value**: `#[__label__]` → `#[tag]`
3. **Кастомные**: `**[__label__]**` → `**[bold]**`

### Правила разметки

- `__label__` - обязательный плейсхолдер для основного текста
- `__value__` - опциональный плейсхолдер для дополнительной информации
- Плейсхолдеры должны быть уникальными в рамках одного markup
- Markup может содержать статический текст вокруг плейсхолдеров

## Производительность

### Преимущества рефакторинга

После последнего рефакторинга ParserV2 демонстрирует значительные улучшения в простоте и эффективности:

- **Упрощение архитектуры**: Убраны избыточные стратегии парсинга
- **Единая точка ответственности**: Одна универсальная стратегия для всех типов маркеров
- **Сокращение кода**: Удалено ~300 строк дублированного кода
- **Улучшенная поддерживаемость**: Меньше компонентов для сопровождения
- **Высокая производительность**: Меньше накладных расходов на создание объектов

### Характеристики производительности

ParserV2 гарантирует структуру `text - mark - text - mark - text...` с следующими характеристиками:

- **Однопроходная обработка**: Каждый символ читается только один раз
- **Линейная сложность**: O(n) для размера входных данных
- **Оптимизированный поиск**: Группировка маркеров по триггерам ускоряет поиск
- **Гарантия структуры**: Упрощает постобработку и валидацию результатов

### Компонентная оптимизация

1. **PatternMatcher**: Эффективный поиск матчей с предварительной группировкой по триггерам
2. **ConflictResolver**: Быстрое разрешение конфликтов с приоритетом длинных маркеров
3. **TokenSequenceBuilder**: Гарантированное построение последовательности без лишних проверок
4. **GenericMarkupStrategy**: Универсальная стратегия, оптимизированная для всех типов маркеров

## Гарантии структуры

ParserV2 гарантирует предсказуемую структуру выходных данных:

### Структура `text - mark - text - mark - text...`

```typescript
// Гарантированная последовательность токенов:
[
  { type: 'text', content: 'Hello ' },
  { type: 'mark', content: '@[world](test)', ... },
  { type: 'text', content: ' and ' },
  { type: 'mark', content: '#[tag]', ... },
  { type: 'text', content: '!' }           // Всегда после mark
]

// Даже для маркеров в конце строки:
'Start @[end]' → [
  { type: 'text', content: 'Start ' },
  { type: 'mark', content: '@[end]', ... },
  { type: 'text', content: '' }            // Пустой, но присутствует
]
```

### Преимущества гарантии структуры

1. **Предсказуемость**: Клиентский код может полагаться на последовательность
2. **Упрощенная обработка**: Нет необходимости проверять "что идет после mark"
3. **Безопасность**: Гарантирует отсутствие "висячих" маркеров
4. **Производительность**: Упрощает постобработку результатов

### Реализация гарантии

Гарантия реализуется на уровне `extractNextToken()`:
- После возврата `MarkToken` следующий вызов всегда вернет `TextToken`
- Для маркеров в конце строки возвращается пустой `TextToken`
- Структура поддерживается на всех уровнях рекурсии

## Безопасность

### XSS защита

Автоматическая проверка контента на наличие опасных конструкций:
- `<script>` теги
- `javascript:` URLs
- Обработчики событий (`on*`)
- Другие потенциально опасные элементы

### DoS защита

- Ограничение максимальной глубины вложенности
- Валидация размера входных данных
- Защита от экспоненциального роста дерева
- **Гарантия структуры**: Предотвращает неожиданные паттерны токенов

## Тестирование

### Запуск тестов

```bash
# Unit тесты
npm test -- src/features/parsing/ParserV2/ParserV2.spec.ts

# Integration тесты
npm test -- src/features/parsing/ParserV2/ParserV2.integration.spec.ts

# Производительность
npm test -- --reporter=verbose
```

### Покрытие

- ✅ Базовый функционал парсинга
- ✅ Гарантия структуры `text - mark - text - mark - text...`
- ✅ Обработка ошибок и edge cases
- ✅ Валидация и безопасность
- ✅ Однопроходный алгоритм парсинга
- ✅ Рекурсивная обработка вложенных маркеров

## Миграция с Parser v1

### Автоматическая конвертация

```typescript
// Старый код
import {Parser} from '../Parser'
const oldParser = new Parser(markups)
const flatTokens = oldParser.split('Hello @[world](test)')

// Новый код
import {ParserV2} from '../ParserV2'
const newParser = new ParserV2(['@[__label__](__value__)', '#[__label__]'])
const tree = newParser.parse('Hello @[world](test)')

// Конвертация в плоский формат (для совместимости)
const flatTokens = flattenTree(tree)
```

### Функция миграции

```typescript
function flattenTree(root: NestedToken): PieceType[] {
  const result: PieceType[] = []

  function traverse(node: NestedToken) {
    if (node.type === 'text') {
      if (node.content) result.push(node.content)
    } else if (node.type === 'mark' && node.data) {
      result.push({
        annotation: node.content,
        label: node.data.label,
        value: node.data.value,
        input: node.content,
        index: node.position.start,
        optionIndex: node.data.optionIndex
      })
    }

    node.children?.forEach(traverse)
  }

  traverse(root)
  return result
}
```

## Roadmap

### Достигнуто в v2.0

- ✅ **Гарантия структуры**: `text - mark - text - mark - text...`
- ✅ **Однопроходный парсинг**: Каждый символ читается только один раз
- ✅ **Древовидная структура**: Оптимизированная обработка вложенных маркеров
- ✅ **Рекурсивная обработка**: Полная поддержка вложенных маркеров
- ✅ **Компонентная архитектура**: Разделение на PatternMatcher, ConflictResolver, TokenSequenceBuilder
- ✅ **Стратегии парсинга**: BracketMarkupStrategy и ParenMarkupStrategy для разных типов маркеров

### Достигнуто в v2.0.1 (рефакторинг архитектуры)

- ✅ **Универсальная стратегия**: GenericMarkupStrategy для всех типов маркеров
- ✅ **Упрощенная архитектура**: Убраны избыточные стратегии парсинга
- ✅ **Чистая структура файлов**: Убрана папка strategies/
- ✅ **Оптимизированный PatternMatcher**: Один экземпляр стратегии вместо Map
- ✅ **Сокращение кода**: Удалено ~300 строк дублированного кода
- ✅ **Улучшенная поддерживаемость**: Единая точка ответственности
- ✅ **Высокая производительность**: Меньше накладных расходов на создание объектов

### Краткосрочные цели (v2.1)

- [ ] Улучшенная обработка ошибок разметки с детальными сообщениями
- [ ] Streaming API для очень больших файлов
- [ ] Кеширование экземпляров парсера и стратегий
- [ ] Расширенные тесты производительности
- [ ] Оптимизация GenericMarkupStrategy для специфических форматов

### Долгосрочные цели (v3.0)

- [ ] Полная поддержка вложенных конструкций с кастомной логикой
- [ ] Визуальный редактор разметки
- [ ] Интеграция с популярными форматами (Markdown, HTML, XML)
- [ ] Плагины для расширения функциональности
- [ ] WebAssembly версия для браузера

## Troubleshooting

### Распространенные проблемы

1. **Некорректный markup**: Проверьте синтаксис плейсхолдеров (`__label__`, `__value__`)
2. **Гарантия структуры**: Помните о последовательности `text - mark - text - mark - text...`
3. **Вложенные маркеры**: Рекурсивная обработка через отдельные экземпляры парсера в TokenSequenceBuilder
4. **Кастомные форматы**: GenericMarkupStrategy поддерживает большинство форматов, но проверьте синтаксис

### Debug компонентов

Для отладки отдельных компонентов:

```typescript
// Отладка поиска матчей
const patternMatcher = new PatternMatcher(input, markups)
const matches = patternMatcher.findAllMatches()
console.log('Найденные матчи:', matches)

// Отладка разрешения конфликтов
const conflictResolver = new ConflictResolver()
const resolved = conflictResolver.resolve(matches)
console.log('Разрешенные кандидаты:', resolved)

// Отладка построения последовательности
const tokenBuilder = new TokenSequenceBuilder(input, markups)
const tokens = tokenBuilder.buildGuaranteedSequence(resolved)
console.log('Итоговые токены:', tokens)
```

## Contributing

Приветствуются contributions! Пожалуйста:

1. **Тестируйте гарантию структуры**: Убедитесь, что после каждого `mark` идет `text`
2. **Улучшайте GenericMarkupStrategy**: Для новых типов маркеров расширяйте универсальную стратегию
3. **Тестируйте компоненты**: Каждый компонент должен иметь полное покрытие unit тестами
4. **Соблюдайте архитектуру**: Следуйте принципам Single Responsibility и Composition over Inheritance
5. **Добавляйте тесты**: Для новых функций и edge cases
6. **Соблюдайте code style**: ESLint + Prettier
7. **Обновляйте документацию**: README и JSDoc
8. **Проверяйте интеграцию**: Убедитесь, что изменения корректно работают со всеми форматами маркеров

## Лицензия

MIT License - см. LICENSE файл в корне проекта.

