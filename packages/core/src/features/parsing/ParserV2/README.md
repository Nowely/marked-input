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

1. **Инициализация**: Создание массива для хранения токенов верхнего уровня
2. **Поиск markup**: Поиск открывающих конструкций в тексте
3. **Рекурсивная обработка**: Для каждого найденного маркера:
   - Извлекается внутренний контент для рекурсивного парсинга
   - Внутренний контент парсится рекурсивно, результат фильтруется (только маркеры попадают в children)
   - Создается MarkToken с children, содержащими только вложенные маркеры
   - label содержит только текст без вложенных маркеров
4. **Предотвращение дублирования**: Внутренние маркеры не появляются в основном результате
5. **Валидация**: Финальная проверка корректности структуры

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
//   { type: 'text', content: '!' }
// ]
```

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

Класс, реализующий `IterableIterator<NestedToken>` для последовательного обхода токенов в разобранном дереве.

```typescript
class ParserV2Matches implements IterableIterator<NestedToken> {
  constructor(input: string, markups: Markup[])
  getRoot(): NestedToken
}
```

Принимает входную строку и настройки разметки, выполняет парсинг и предоставляет доступ к результатам через итератор по NestedToken'ам и метод `getRoot()` для получения полного дерева.

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
const root = matches.getRoot() // Получить полное NestedToken дерево

for (const token of matches) {
  if (token.type === 'text') {
    console.log(`Text token: "${token.content}"`)
  } else if (token.type === 'mark') {
    console.log(`Mark token: ${token.data?.label}`)
  }
}
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

### Бенчмарки

- **100 marks**: < 50ms
- **1000 marks**: < 100ms
- **Memory footprint**: < 2x от размера входных данных

### Оптимизации

1. **Кеширование**: Переиспользование скомпилированных регулярных выражений
2. **Ленивый разбор**: Постепенная обработка больших документов
3. **Инкрементальный парсинг**: Обновление только измененных частей

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
- ✅ Обработка ошибок
- ✅ Валидация и безопасность
- ✅ Производительность
- ✅ Edge cases

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

### Краткосрочные цели (v2.1)

- [ ] Поддержка кастомных парсеров для сложных markup
- [ ] Улучшенная обработка ошибок разметки
- [ ] Streaming API для больших файлов

### Долгосрочные цели (v3.0)

- [ ] Полная поддержка вложенных конструкций
- [ ] Визуальный редактор разметки
- [ ] Интеграция с популярными форматами (Markdown, HTML)

## Troubleshooting

### Распространенные проблемы

1. **Некорректный markup**: Проверьте синтаксис плейсхолдеров
3. **Производительность**: Используйте ленивый разбор для больших документов

### Debug режим

```typescript
const parser = new ParserV2(['@[__label__](__value__)', '#[__label__]'])
const result = parser.parse(input)
// Логирует детальную информацию о процессе парсинга
```

## Contributing

Приветствуются contributions! Пожалуйста:

1. Добавляйте тесты для новых функций
2. Соблюдайте существующие code style
3. Обновляйте документацию
4. Проверяйте производительность

## Лицензия

MIT License - см. LICENSE файл в корне проекта.
