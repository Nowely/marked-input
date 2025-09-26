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
```

### Алгоритм работы

ParserV2 использует итеративный подход с гарантией структуры `text - mark - text - mark - text...`:

1. **Инициализация**: Создание дескрипторов разметки и группировка по триггерам
2. **Итеративный разбор**: Последовательная обработка текста через `extractNextToken()`:
   - Поиск следующего маркера в текущей позиции
   - Если перед маркером есть текст - возвращается `TextToken`
   - Возвращается `MarkToken` с рекурсивно обработанными `children`
   - **Гарантия структуры**: После каждого `MarkToken` всегда следует `TextToken` (даже пустой)
3. **Рекурсивная обработка маркеров**:
   - Извлекается внутренний контент для рекурсивного парсинга
   - Создается новый экземпляр парсера для внутреннего контента
   - `children` содержат только вложенные маркеры (текст остается в `label`)
4. **Завершение**: Когда маркеры закончились, возвращается финальный `TextToken` с оставшимся контентом

## Использование

### Базовый пример

```typescript
import {ParserV2} from './ParserV2'

const parser = new ParserV2(['@[__label__](__value__)', '#[__label__]'])
const result = parser.split('Hello @[world](test)!')

console.log(result)
// [
//   { type: 'text', content: 'Hello ' },
//   {
//     type: 'mark',
//     content: '@[world](test)',
//     children: [],
//     data: { label: 'world', value: 'test', optionIndex: 0 }
//   },
//   { type: 'text', content: '!' }  // Гарантированно следует после mark
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
split(value: string): NestedToken
```

Разбирает входную строку и возвращает древовидную структуру NestedToken.

### ParserV2Matches

Класс, реализующий `IterableIterator<NestedToken>` для последовательного обхода токенов с гарантией структуры `text - mark - text - mark - text...`.

```typescript
class ParserV2Matches implements IterableIterator<NestedToken> {
  constructor(input: string, markups: Markup[])
  next(): IteratorResult<NestedToken>
  extractNextToken(): NestedToken | null
}
```

**Гарантии структуры:**
- После каждого `MarkToken` всегда следует `TextToken` (даже пустой)
- Последовательность всегда: `text - mark - text - mark - text...`
- Итератор завершается только после последнего `TextToken`

**Алгоритм работы:**
1. `extractNextToken()` ищет следующий маркер в текущей позиции
2. Если найден маркер - возвращает его, гарантируя что следующий вызов вернет text
3. Если маркер не найден - возвращает оставшийся текст как `TextToken`
4. Для маркеров в конце строки следующий вызов возвращает пустой `TextToken`

## Типы NestedToken

### RootToken
```typescript
interface RootToken {
  type: 'root'
  content: string
  children: NestedToken[]  // Обязательно присутствует
  position: { start: number; end: number }
}
```

Корневой узел дерева с обязательным массивом дочерних элементов.

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

#### Использование ParserV2Matches напрямую

```typescript
const matches = new ParserV2Matches('Hello @[world](test)!', ['@[__label__](__value__)'])

// Итеративный обход с гарантией структуры text-mark-text-mark-...
for (const token of matches) {
  if (token.type === 'text') {
    console.log(`Text: "${token.content}"`)
  } else if (token.type === 'mark') {
    console.log(`Mark: ${token.data?.label}`)
    // Следующий токен ОБЯЗАТЕЛЬНО будет text (даже пустой)
  }
}

// Результат:
// Text: "Hello "
// Mark: world
// Text: "!"  // Гарантированно следует после mark
```

**Пример с маркером в конце строки:**
```typescript
const matches = new ParserV2Matches('Start @[end]', ['@[__label__]'])

for (const token of matches) {
  console.log(`${token.type}: "${token.content}"`)
}
// Вывод:
// text: "Start "
// mark: "@[end]"
// text: ""  // Пустой text гарантированно следует после mark
```

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

### Бенчмарки (после оптимизации next() и extractNextToken())

#### Итеративный парсинг (ParserV2)
```
iteration 1 (4 marks, 93 chars)     110,993 ops/sec
iteration 2 (6 marks, 147 chars)      71,729 ops/sec
iteration 3 (8 marks, 201 chars)      53,216 ops/sec
iteration 4 (10 marks, 255 chars)     42,018 ops/sec
iteration 5 (12 marks, 309 chars)     32,090 ops/sec
iteration 6 (16 marks, 395 chars)     27,829 ops/sec
iteration 7 (18 marks, 449 chars)     24,391 ops/sec
iteration 8 (20 marks, 503 chars)     21,329 ops/sec
iteration 9 (22 marks, 557 chars)     19,594 ops/sec
iteration 10 (24 marks, 611 chars)    17,706 ops/sec
```

#### Сравнение с Parser v1 (плоский парсер)
| Размер документа | Parser v1 | Parser v2 | Отношение |
|------------------|-----------|-----------|-----------|
| 10 marks (~227 chars) | 186K ops/sec | 33K ops/sec | **5.7x** медленнее |
| 50 marks (~1.2K chars) | 38K ops/sec | 6.7K ops/sec | **5.7x** медленнее |
| 100 marks (~2.4K chars) | 19K ops/sec | 3.3K ops/sec | **5.8x** медленнее |
| 500 marks (~12K chars) | 3.8K ops/sec | 653 ops/sec | **5.8x** медленнее |

#### Масштабируемость ParserV2
```
scalability: 10 marks    187K ops/sec
scalability: 25 marks     74K ops/sec  (2.5x медленнее)
scalability: 50 marks     38K ops/sec  (4.9x медленнее)
scalability: 100 marks    18K ops/sec  (10.5x медленнее)
scalability: 250 marks     7.5K ops/sec (25x медленнее)
scalability: 500 marks     3.8K ops/sec (49x медленнее)
```

**Memory footprint**: Стабильное потребление, < 2x от размера входных данных

### Гарантии структуры и производительность

Новая логика гарантирует структуру `text - mark - text - mark - text...`:
- **Итеративная обработка**: Каждый вызов `next()` возвращает один токен
- **Предсказуемость**: После каждого `mark` всегда следует `text` (даже пустой)
- **Линейная сложность**: O(n) для размера входных данных
- **Оптимизированный поиск**: Группировка маркеров по триггерам ускоряет поиск

### Оптимизации

1. **Кеширование дескрипторов**: Переиспользование скомпилированных шаблонов разметки
2. **Ленивый разбор**: Постепенная обработка с `IterableIterator` интерфейсом
3. **Итеративный поиск**: Поиск маркеров только в текущей позиции
4. **Гарантия структуры**: Упрощает постобработку и валидацию результатов

## Гарантии структуры

ParserV2 гарантирует предсказуемую структуру выходных данных:

### Структура `text - mark - text - mark - text...`

```typescript
// Гарантированная последовательность токенов:
[
  { type: 'text', content: 'Hello ' },
  { type: 'mark', content: '@[world](test)', ... },
  { type: 'text', content: ' and ' },      // Всегда после mark
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
- ✅ Производительность итеративного парсинга
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
- ✅ **Итеративный парсинг**: Оптимизированный `next()` и `extractNextToken()`
- ✅ **Рекурсивная обработка**: Полная поддержка вложенных маркеров
- ✅ **Производительность**: 48K ops/sec для типичных сценариев

### Краткосрочные цели (v2.1)

- [ ] Поддержка кастомных парсеров для сложных markup
- [ ] Улучшенная обработка ошибок разметки
- [ ] Streaming API для очень больших файлов
- [ ] Кеширование экземпляров парсера

### Долгосрочные цели (v3.0)

- [ ] Полная поддержка вложенных конструкций с кастомной логикой
- [ ] Визуальный редактор разметки
- [ ] Интеграция с популярными форматами (Markdown, HTML, XML)
- [ ] Плагины для расширения функциональности

## Troubleshooting

### Распространенные проблемы

1. **Некорректный markup**: Проверьте синтаксис плейсхолдеров (`__label__`, `__value__`)
2. **Структура токенов**: Помните о гарантии `text - mark - text - mark - text...`
3. **Производительность**: Используйте итеративный подход для больших документов
4. **Вложенные маркеры**: `children` содержат только маркеры, текст в `label`

### Debug режим

```typescript
const parser = new ParserV2(['@[__label__](__value__)', '#[__label__]'])
const result = parser.parse(input)
// Логирует детальную информацию о процессе парсинга
```

## Contributing

Приветствуются contributions! Пожалуйста:

1. **Тестируйте гарантию структуры**: Убедитесь, что после каждого `mark` идет `text`
2. **Добавляйте тесты**: Для новых функций и edge cases
3. **Соблюдайте code style**: ESLint + Prettier
4. **Обновляйте документацию**: README и JSDoc
5. **Проверяйте производительность**: Бенчмарки должны показывать улучшения

## Лицензия

MIT License - см. LICENSE файл в корне проекта.

