# RFC: Nested Marks

## Статус: Предложение

## Обзор

Данная RFC описывает введение поддержки вложенных (nested) marks в библиотеку `rc-marked-input`. Текущая реализация поддерживает только плоскую обработку текста, где marks не могут содержать другие marks. Предлагается перейти к древовидной структуре, позволяющей создавать вложенные конструкции.

## Мотивация

### Текущие ограничения

1. **Плоская структура**: Marks обрабатываются как линейная последовательность без возможности вложенности
2. **Ограниченная выразительность**: Невозможно создать конструкции вроде `@[bold @[italic](text)](formatted)`
3. **Простой парсер**: Текущий парсер `Parser` работает с регулярными выражениями и не поддерживает контекстно-зависимый разбор

### Преимущества вложенных marks

1. **Более богатый синтаксис**: Поддержка сложного форматирования текста
2. **Гибкость**: Возможность комбинировать различные типы marks
3. **Расширяемость**: Легче добавлять новые типы marks с произвольной вложенностью

## Текущее API

### Основные компоненты

```typescript
interface MarkedInputProps<T = MarkStruct> {
  value?: string
  Mark?: ComponentType<T>
  options?: Option<T>[]
  // ...
}

interface Option<T = Record<string, any>> {
  markup?: Markup  // "@[__label__](__value__)" | "@[__label__]"
  trigger?: string
  data?: string[]
  initMark?: (props: MarkStruct) => T
}

interface MarkStruct {
  label: string
  value?: string
}

interface MarkHandler<T> extends MarkStruct {
  ref: RefObject<T>
  change: (props: MarkStruct) => void
  remove: () => void
  readOnly?: boolean
}
```

### Парсер

```typescript
class Parser {
  split(value: string): PieceType[]  // PieceType = string | MarkMatch
  iterateMatches(value: string): PieceType[]
}

interface MarkMatch extends MarkStruct {
  annotation: string
  input: string
  index: number
  optionIndex: number
}
```

### useMark хук

```typescript
const useMark = <T extends HTMLElement>(): MarkHandler<T> => {
  // Управление состоянием отдельного mark
}
```

## Предлагаемое решение

### Древовидное решение

#### Архитектура

Полный переход на древовидный парсер с использованием рекурсивного разбора.

**Парсер:**
- Использовать стек для отслеживания вложенности
- Рекурсивно обрабатывать содержимое marks
- Поддерживать произвольную глубину вложенности

**Хранение:**
```typescript
interface NestedToken {
  type: 'text' | 'mark'
  content: string
  children?: NestedToken[]
  data?: {
    label: string
    value?: string
    optionIndex: number
  }
}
```

#### API изменения

```typescript
// Новый тип для древовидной структуры
interface NestedMarkStruct {
  label: string
  value?: string
  children?: NestedMarkStruct[]
  parent?: NestedMarkStruct
  depth: number
}

// Обновленный MarkedInput
interface NestedMarkedInputProps<T = NestedMarkStruct> extends MarkedInputProps<T> {
  nested?: boolean  // Флаг включения вложенности
  maxDepth?: number  // Максимальная глубина вложенности
}

// Обновленный useMark
interface NestedMarkHandler<T> extends MarkHandler<T> {
  children: NestedMarkHandler<T>[]
  parent?: NestedMarkHandler<T>
  depth: number

  // Методы для управления детьми
  addChild: (child: NestedMarkStruct, position?: number) => NestedMarkHandler<T>
  removeChild: (child: NestedMarkHandler<T>) => void
  moveChild: (child: NestedMarkHandler<T>, newPosition: number) => void

  // Навигация
  getRoot: () => NestedMarkHandler<T>
  getSiblings: () => NestedMarkHandler<T>[]
  findByPath: (path: number[]) => NestedMarkHandler<T> | null
}
```

## Детальная спецификация

### Парсер

#### Текущая реализация (плоский разбор)

```typescript
class Parser {
  split(value: string): PieceType[] {
    // Возвращает: ['text', MarkMatch, 'text', MarkMatch, ...]
  }
}
```

#### Предлагаемая реализация (древовидный разбор)

```typescript
class NestedParser extends Parser {
  parse(value: string): NestedToken {
    // Рекурсивный разбор с учетом вложенности
    // Возвращает дерево NestedToken
  }

  private parseRecursive(
    content: string,
    parentMarkup?: Markup
  ): NestedToken[] {
    // Стек для отслеживания открывающих тегов
    // Рекурсивная обработка содержимого
  }
}
```

### Рендеринг

#### Текущий рендеринг (плоский)

```tsx
// Container рендерит линейный массив tokens
{tokens.map(token => (
  <Token key={key.get(token)} mark={token} />
))}
```

#### Предлагаемый рендеринг (древовидный)

```tsx
// Рекурсивный рендеринг дерева
const renderToken = (token: NestedToken): ReactElement => {
  if (token.type === 'text') {
    return <EditableSpan>{token.content}</EditableSpan>
  }

  return (
    <TokenProvider value={token.data}>
      <Piece>
        {token.children?.map(renderToken)}
      </Piece>
    </TokenProvider>
  )
}
```

### useMark API

#### Текущий API

```typescript
const useMark = (): MarkHandler => {
  // Управление одиночным mark
}
```

#### Предлагаемый API

```typescript
const useMark = (): NestedMarkHandler => {
  const mark = useNestedMark()

  // Доступ к древовидной структуре
  const children = mark.children
  const parent = mark.parent

  // Управление вложенностью
  const addChild = (childData) => {
    mark.addChild(childData)
  }

  return mark
}
```

## Миграционный план

### Этап 1: Плоское решение (3-4 недели)

1. Добавить постобработку в парсер для определения вложенности
2. Обновить типы `MarkStruct` → `NestedMarkStruct`
3. Модифицировать `useMark` для поддержки children/parent
4. Обновить рендеринг для обработки вложенных структур
5. Написать тесты и документацию

### Этап 2: Древовидный парсер (4-6 недель)

1. Реализовать `NestedParser` с рекурсивным разбором
2. Переработать хранение tokens в дереве
3. Обновить рендеринг на рекурсивный подход
4. Расширить `useMark` API новыми методами
5. Оптимизировать производительность

### Этап 3: Оптимизации и полировка (2-3 недели)

1. Кеширование разобранных структур
2. Ленивая загрузка для глубоких деревьев
3. Дополнительные утилиты для работы с деревом
4. Финальное тестирование и документация

## Риски и соображения

### Производительность

- Древовидный парсер может быть медленнее для простых случаев
- Необходимость кеширования для больших документов
- Потенциальные проблемы с ререндерингом глубоких деревьев

### Сложность API

- Увеличение сложности `useMark` API
- Необходимость обучения пользователей работе с деревьями
- Риск ошибок при работе с references в дереве

### Обратная совместимость

- Необходимо сохранить работу существующих приложений
- Плавная миграция через флаги и деprecation warnings

## Альтернативные решения

### 1. Markup-based подход

Вместо древовидного разбора использовать специальные markup правила:

```
@[bold @[italic](text)](formatted)  // Допустимо
@[italic @[bold](text)](formatted)  // Ошибка - неправильный порядок
```

**Преимущества:** Простота реализации
**Недостатки:** Ограниченная выразительность, жесткие правила

### 2. Конфигурационный подход

Разрешать вложенность только для определенных комбинаций marks:

```typescript
interface Option {
  // ...
  allowedChildren?: string[]  // IDs разрешенных дочерних marks
}
```

**Преимущества:** Контролируемая сложность
**Недостатки:** Менее гибкий, требует предопределения правил

## Следующие шаги

1. **Исследование**: Создать прототип плоского решения
2. **Анализ**: Собрать feedback от потенциальных пользователей
3. **Реализация**: Начать с плоского решения как MVP
4. **Тестирование**: Провести нагрузочное тестирование
5. **Документация**: Обновить документацию и примеры

## Вопросы для обсуждения

1. Какой уровень вложенности поддерживать изначально?
2. Нужно ли сохранять плоский режим как опцию?
3. Как обрабатывать конфликты markup при вложенности?
4. Какие новые хуки нужны для работы с деревом?
5. Как оптимизировать производительность для глубоких деревьев?

## Примеры использования

### Базовый пример вложенных marks

```typescript
// Конфигурация для форматированного текста
const NestedMarkedInput = createMarkedInput({
  nested: true,
  maxDepth: 3,
  Mark: ({ label, children }) => (
    <span className="mark">
      {label}
      {children && <span className="children">{children}</span>}
    </span>
  ),
  options: [
    {
      markup: '**__[__label__]__**',
      trigger: '**',
      data: ['bold', 'strong'],
    },
    {
      markup: '*_[__label__]_*',
      trigger: '*',
      data: ['italic', 'emphasis'],
    },
    {
      markup: '`__label__`',
      trigger: '`',
      data: ['code', 'inline-code'],
    }
  ]
})

// Использование
<NestedMarkedInput
  value="Это **[жирный текст с *курсивом* и `кодом`** внутри"
  onChange={setValue}
/>
```

### Продвинутый пример с useMark

```typescript
const CustomMark = ({ label, value }) => {
  const mark = useMark()

  const handleClick = () => {
    // Доступ к вложенным marks
    console.log('Children:', mark.children.length)
    console.log('Parent:', mark.parent?.label)

    // Добавление дочернего mark
    mark.addChild({
      label: 'новый',
      value: 'дочерний'
    })
  }

  return (
    <span
      ref={mark.ref}
      onClick={handleClick}
      className={`mark depth-${mark.depth}`}
    >
      {label}
      {mark.children.map((child, index) => (
        <Token key={index} mark={child} />
      ))}
    </span>
  )
}
```

## Технические детали парсера

### Алгоритм древовидного разбора

```typescript
interface ParseContext {
  stack: NestedToken[]
  current: NestedToken
  position: number
}

class NestedParser {
  parse(input: string, options: InnerOption[]): NestedToken {
    const root: NestedToken = {
      type: 'mark',
      content: '',
      children: []
    }

    const context: ParseContext = {
      stack: [root],
      current: root,
      position: 0
    }

    while (context.position < input.length) {
      const char = input[context.position]

      if (this.isOpeningMarkup(char, context, options)) {
        this.handleOpeningMarkup(context, input, options)
      } else if (this.isClosingMarkup(char, context, options)) {
        this.handleClosingMarkup(context, input, options)
      } else {
        this.addTextChar(char, context)
      }

      context.position++
    }

    return root
  }

  private isOpeningMarkup(char: string, context: ParseContext, options: InnerOption[]): boolean {
    // Проверка на открывающий markup
    return options.some(option =>
      option.markup.startsWith(char) &&
      this.canOpenMarkup(option, context)
    )
  }

  private handleOpeningMarkup(context: ParseContext, input: string, options: InnerOption[]) {
    // Создание нового nested token и помещение в стек
    const newToken: NestedToken = {
      type: 'mark',
      content: '',
      children: [],
      data: {
        label: '',
        optionIndex: this.getOptionIndex(context.position, options)
      }
    }

    context.current.children.push(newToken)
    context.stack.push(newToken)
    context.current = newToken
  }

  private handleClosingMarkup(context: ParseContext, input: string, options: InnerOption[]) {
    // Закрытие текущего mark и возврат к родителю
    if (context.stack.length > 1) {
      context.current = context.stack.pop()!
    }
  }
}
```

### Оптимизации парсера

#### Текущие оптимизации:
1. **Кеширование регулярных выражений**
2. **Предварительная валидация markup**
3. **Ленивый разбор для глубоких структур**
4. **Инкрементальный парсинг при изменениях**

#### Оптимизированная архитектура ParserV2Matches (с сохранением итеративного интерфейса):

**Цели оптимизации:**
1. Предварительная обработка всех markup для извлечения статических частей
2. Отказ от регулярных выражений в пользу детерминированного поиска
3. Посимвольный парсинг для каждого токена
4. Сохранение интерфейса IterableIterator<NestedToken> (next() возвращает один верхнеуровневый токен)
5. Эффективная обработка вложенности через рекурсивный парсинг

**Ключевые компоненты:**

1. **MarkupDescriptor** - структура для хранения предварительно обработанного markup:
   ```typescript
   interface MarkupDescriptor {
     index: number                    // Индекс в массиве markups
     trigger: string                 // Символ триггера (например, '@')
     startPattern: string           // Статическая часть начала ('[' для '@[__label__]')
     endPattern: string             // Статическая часть конца (']' для '@[__label__]')
     hasValue: boolean              // Есть ли часть __value__
     valueStartPattern?: string     // Статическая часть начала value ('(' для '@[__label__](__value__)')
     valueEndPattern?: string       // Статическая часть конца value (')' для '@[__label__](__value__)')
     fullStartPattern: string       // Полная строка начала (например, '@[')
     fullEndPattern: string         // Полная строка конца (например, ']')
     fullValueStartPattern?: string // Полная строка начала value (например, '](')
     fullValueEndPattern?: string   // Полная строка конца value (например, ')')
   }
   ```

2. **Оптимизированный поиск маркеров:**
   - Предварительная индексация markup по trigger символам
   - Детерминированный посимвольный поиск без регулярных выражений
   - Быстрое определение границ маркеров (label, value)

**Алгоритм оптимизированного поиска:**

```
1. Предварительная обработка (в конструкторе):
   - Для каждого markup создать MarkupDescriptor
   - Сгруппировать descriptors по trigger символам для быстрого поиска
   - Извлечь все статические части разметки

2. Для каждого вызова extractNextNestedToken():
   a) Начать с текущей позиции this.position
   b) Проверить следующий символ на совпадение с trigger
   c) Если trigger найден, проверить startPattern
   d) Найти границы label (до вложенных маркеров или endPattern)
   e) Если есть value, найти его границы
   f) Рекурсивно обработать вложенные маркеры в label/value
   g) Создать NestedToken со всей вложенностью

3. Оптимизации поиска:
   - Быстрый lookup по trigger через Map< string, MarkupDescriptor[] >
   - Посимвольное сравнение для определения границ
   - Раннее прекращение поиска при несоответствиях
   - Кеширование результатов парсинга вложенных частей

**Особенности реализации:**

- **Итеративный интерфейс**: next() возвращает один верхнеуровневый NestedToken за раз
- **Рекурсивная вложенность**: Каждый маркер полностью разбирается со своими children
- **Отказ от регексов**: Детерминированный поиск без backtracking
- **Предварительная подготовка**: Все статические части извлекаются заранее
- **Быстрый lookup**: Группировка markup по trigger символам

**Преимущества оптимизированной архитектуры:**
1. **Производительность**: Быстрый детерминированный поиск без регексов
2. **Совместимость**: Сохранение существующего итеративного интерфейса
3. **Масштабируемость**: Легко добавить новые типы markup
4. **Надежность**: Предсказуемый парсинг без неожиданных регекс-поведений

**Статус реализации: ✅ ЗАВЕРШЕНО**
- Реализован MarkupDescriptor и предварительная обработка markup
- Оптимизирован extractNextNestedToken() с использованием descriptors
- Добавлена поддержка malformed markup (graceful fallback)
- Все тесты проходят (24 unit + 5 integration)
- Сохранена полная обратная совместимость

## Тестирование

### Модульные тесты

```typescript
describe('NestedParser', () => {
  it('should parse simple nested structure', () => {
    const input = '**[bold *italic* text]**'
    const result = parser.parse(input, options)

    expect(result.children).toHaveLength(1)
    expect(result.children[0].data?.label).toBe('bold *italic* text')
    expect(result.children[0].children).toHaveLength(1)
    expect(result.children[0].children[0].data?.label).toBe('italic')
  })

  it('should handle malformed markup gracefully', () => {
    const input = '**[unclosed markup*'
    const result = parser.parse(input, options)

    // Должен обработать незакрытый markup корректно
    expect(result.children).toHaveLength(1)
  })

  it('should respect maxDepth limit', () => {
    const input = '**[a **[b **[c]** b]** a]**'
    const result = parser.parse(input, options, { maxDepth: 2 })

    // Должен остановиться на глубине 2
    const depth3Exists = findDepth(result, 3)
    expect(depth3Exists).toBe(false)
  })
})
```

### Интеграционные тесты

```typescript
describe('NestedMarkedInput Integration', () => {
  it('should render nested structure correctly', async () => {
    const { container } = render(
      <NestedMarkedInput
        value="**[bold *italic* text]**"
        Mark={({ label, children }) => <span>{label}{children}</span>}
      />
    )

    expect(container).toHaveTextContent('bold italic text')
    expect(container.querySelectorAll('span')).toHaveLength(3) // root, bold, italic
  })

  it('should handle user interactions with nested marks', async () => {
    const mockOnChange = vi.fn()
    const { user } = render(
      <NestedMarkedInput
        value="**[editable]**"
        onChange={mockOnChange}
        Mark={EditableMark}
      />
    )

    await user.click(screen.getByText('editable'))
    await user.keyboard('{backspace}')
    await user.keyboard('modified')

    expect(mockOnChange).toHaveBeenCalledWith('**[modified]**')
  })
})
```

### Нагрузочное тестирование

```typescript
describe('Performance Benchmarks', () => {
  it('should parse large nested documents efficiently', () => {
    const largeInput = generateNestedText(1000, 5) // 1000 marks, глубина 5

    const start = performance.now()
    const result = parser.parse(largeInput, options)
    const end = performance.now()

    expect(end - start).toBeLessThan(100) // < 100ms
    expect(countMarks(result)).toBe(1000)
  })

  it('should handle rapid edits without degradation', async () => {
    // Тест на производительность при быстрых изменениях
  })
})
```

## План реализации по этапам

### Этап 1: Фундамент (Неделя 1-2)

**Цели:**
- Создать базовую структуру NestedToken
- Реализовать простой nested парсер
- Обновить базовые типы

**Задачи:**
1. [ ] Создать интерфейсы `NestedToken`, `NestedMarkStruct`
2. [ ] Реализовать базовый `NestedParser` класс
3. [ ] Обновить `MarkStruct` для поддержки children
4. [ ] Написать unit тесты для новых типов

**Критерии готовности:**
- ✅ Компиляция без ошибок
- ✅ Базовые unit тесты проходят
- ✅ Поддержка 1 уровня вложенности

### Этап 2: Парсер и рендеринг (Неделя 3-4)

**Цели:**
- Полноценный рекурсивный парсер
- Обновленный рендеринг для дерева

**Задачи:**
1. [ ] Реализовать стековый алгоритм разбора
2. [ ] Добавить обработку ошибок разметки
3. [ ] Обновить `Container` и `Token` компоненты
4. [ ] Создать рекурсивный рендеринг

**Критерии готовности:**
- ✅ Парсинг произвольной вложенности
- ✅ Корректный рендеринг дерева
- ✅ Integration тесты проходят

### Этап 3: useMark API (Неделя 5-6)

**Цели:**
- Расширенный API для работы с деревом
- Методы управления вложенностью

**Задачи:**
1. [ ] Обновить `useMark` хук
2. [ ] Добавить методы `addChild`, `removeChild`, `moveChild`
3. [ ] Реализовать навигацию по дереву
4. [ ] Добавить методы поиска и фильтрации

**Критерии готовности:**
- ✅ Все методы `NestedMarkHandler` реализованы
- ✅ Поддержка CRUD операций над деревом
- ✅ Документация API обновлена

### Этап 4: Оптимизации (Неделя 7-8)

**Цели:**
- Производительность и UX
- Кеширование и оптимизации

**Задачи:**
1. [ ] Добавить кеширование разобранных структур
2. [ ] Реализовать инкрементальный парсинг
3. [ ] Оптимизировать ререндеринг
4. [ ] Добавить lazy loading для глубоких деревьев

**Критерии готовности:**
- ✅ Производительность < 100ms для 1000 marks
- ✅ Плавный UX при редактировании
- ✅ Memory leaks отсутствуют

### Этап 5: Полировка и релиз (Неделя 9-10)

**Цели:**
- Финальное тестирование
- Документация и примеры

**Задачи:**
1. [ ] Нагрузочное тестирование
2. [ ] Обновление документации
3. [ ] Создание примеров и демо
4. [ ] Миграционные гайды

**Критерии готовности:**
- ✅ Все тесты проходят
- ✅ Документация обновлена
- ✅ Migration guide готов
- ✅ Обратная совместимость сохранена

## Миграция для существующих пользователей

### Автоматическая миграция

```typescript
// Старый код (продолжает работать)
<MarkedInput
  value="Hello @[world](value)"
  Mark={({ label }) => <mark>{label}</mark>}
/>

// Новый код (с nested поддержкой)
<MarkedInput
  nested={true}  // Новый флаг
  value="Hello @[world](value)"
  Mark={({ label, children }) => <mark>{label}{children}</mark>}
/>
```

### Прогрессивное улучшение

```typescript
// Функция-обертка для обратной совместимости
const withNestedSupport = (Component) => {
  return (props) => {
    const hasNestedContent = detectNestedContent(props.value)

    return (
      <Component
        {...props}
        nested={hasNestedContent}
      />
    )
  }
}
```

## Заключение

Внедрение nested marks значительно расширит возможности библиотеки, позволив создавать более сложные и выразительные текстовые интерфейсы. Начатая с плоского решения как MVP, реализация постепенно перейдет к полноценному древовидному парсеру.

Ключевые преимущества нового подхода:
- **Выразительность**: Поддержка сложного форматирования
- **Производительность**: Оптимизированный парсер с кешированием
- **Гибкость**: Расширяемый API для различных сценариев использования
- **Совместимость**: Плавная миграция существующих приложений

Следующие шаги включают создание прототипа, сбор feedback от пользователей и поэтапную реализацию согласно предложенному плану.

## Метрики успеха

### Технические метрики

1. **Производительность парсера**
   - Парсинг 1000 marks: < 100ms
   - Парсинг 10000 marks: < 500ms
   - Инкрементальный парсинг: < 10ms при небольших изменениях

2. **Память**
   - Memory footprint: < 2x от размера входных данных
   - Отсутствие memory leaks при частых обновлениях

3. **Рендеринг**
   - Initial render: < 50ms для 100 marks
   - Update render: < 16ms для интерактивных изменений

### Пользовательские метрики

1. **API usability**
   - Время на изучение нового API: < 30 минут для опытных разработчиков
   - Количество boilerplate кода: уменьшение на 20% по сравнению с альтернативами

2. **Функциональность**
   - Поддержка вложенности: до 10 уровней
   - Корректная обработка: > 99% edge cases

## Безопасность и валидация

### XSS защита

```typescript
// Валидация содержимого marks
const validateNestedContent = (content: string): boolean => {
  // Проверка на опасные конструкции
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i
  ]

  return !dangerousPatterns.some(pattern => pattern.test(content))
}

// Экранирование при рендеринге
const SafeMark = ({ label, children }) => {
  const safeLabel = DOMPurify.sanitize(label)

  return (
    <span
      dangerouslySetInnerHTML={{ __html: safeLabel }}
      className="safe-mark"
    >
      {children}
    </span>
  )
}
```

### Rate limiting

```typescript
// Защита от DoS через глубокую вложенность
const validateNestingDepth = (token: NestedToken, maxDepth: number = 10): boolean => {
  const checkDepth = (node: NestedToken, currentDepth: number): boolean => {
    if (currentDepth > maxDepth) return false

    return node.children?.every(child =>
      checkDepth(child, currentDepth + 1)
    ) ?? true
  }

  return checkDepth(token, 0)
}
```

### Валидация структуры

```typescript
// Проверка корректности дерева
const validateTreeStructure = (root: NestedToken): ValidationResult => {
  const errors: string[] = []

  const validateNode = (node: NestedToken, path: number[] = []): void => {
    // Проверка required полей
    if (!node.type) {
      errors.push(`Missing type at path ${path.join('.')}`)
    }

    // Проверка children consistency
    if (node.children) {
      node.children.forEach((child, index) => {
        validateNode(child, [...path, index])
      })
    }
  }

  validateNode(root)
  return { isValid: errors.length === 0, errors }
}
```

## Breaking changes и обратная совместимость

### Предполагаемые breaking changes

1. **Изменение типов**
   ```typescript
   // Старый тип
   interface MarkStruct {
     label: string
     value?: string
   }

   // Новый тип (breaking)
   interface NestedMarkStruct extends MarkStruct {
     children?: NestedMarkStruct[]
     depth: number
   }
   ```

2. **Изменение API компонентов**
   ```typescript
   // Старый компонент
   const Mark = ({ label, value }) => <span>{label}</span>

   // Новый компонент (breaking)
   const Mark = ({ label, value, children }) => <span>{label}{children}</span>
   ```

### Стратегия миграции

1. **Semantic versioning**
   - Major version bump (v4.0.0)
   - Deprecation warnings в v3.x для подготовительных релизов

2. **Feature flags**
   ```typescript
   // Постепенная миграция
   const MarkedInputV3 = (props) => (
     <MarkedInput
       {...props}
       nested={false} // По умолчанию false в v3
     />
   )

   const MarkedInputV4 = (props) => (
     <MarkedInput
       {...props}
       nested={true} // По умолчанию true в v4
     />
   )
   ```

3. **Migration codemod**
   ```javascript
   // codemod для автоматической миграции
   const transform = (file, api) => {
     const j = api.jscodeshift

     return j(file.source)
       .find(j.JSXElement, { openingElement: { name: { name: 'Mark' } } })
       .forEach(path => {
         // Добавить children prop
         const attributes = path.node.openingElement.attributes
         const hasChildren = attributes.some(attr =>
           attr.name && attr.name.name === 'children'
         )

         if (!hasChildren) {
           attributes.push(
             j.jsxAttribute(
               j.jsxIdentifier('children'),
               j.jsxExpressionContainer(j.identifier('undefined'))
             )
           )
         }
       })
       .toSource()
   }
   ```

## Альтернативные реализации

### 1. AST-based подход

Использование абстрактного синтаксического дерева вместо плоского парсера:

```typescript
interface ASTNode {
  type: 'text' | 'mark'
  content: string
  children: ASTNode[]
  metadata: {
    position: { start: number, end: number }
    markupType: string
  }
}

class ASTParser {
  parse(input: string): ASTNode {
    // Создание полного AST дерева
    // Преимущества: более точный анализ, лучшее восстановление после ошибок
    // Недостатки: более сложная реализация, выше overhead
  }
}
```

### 2. Streaming parser

Постепенный парсинг для больших документов:

```typescript
interface ParserStream {
  write(chunk: string): void
  end(): Promise<NestedToken>
  on(event: 'token', handler: (token: NestedToken) => void): void
}

class StreamingNestedParser implements ParserStream {
  // Преимущества: работа с большими файлами, низкое потребление памяти
  // Недостатки: сложность реализации, stateful API
}
```

## Приложения

### Глоссарий

- **Nested marks**: Marks, которые могут содержать другие marks внутри себя
- **Flat parsing**: Линейный разбор текста без учета иерархии
- **Tree parsing**: Рекурсивный разбор с построением дерева вложенности
- **Markup**: Синтаксис для обозначения marks в тексте
- **Annotation**: Полное представление mark с метаданными

### Ссылки

1. [Marked Input Documentation](https://github.com/Nowely/marked-input)
2. [React Patterns for Complex Components](https://reactpatterns.com/)
3. [Parser Combinators](https://en.wikipedia.org/wiki/Parser_combinator)
4. [Abstract Syntax Trees](https://en.wikipedia.org/wiki/Abstract_syntax_tree)

### История изменений

- **v1.0** (2025-01-XX): Начальная версия RFC
- **v1.1** (2025-01-XX): Добавлены примеры, технические детали, план реализации
- **v1.2** (2025-01-XX): Добавлены метрики, безопасность, миграция
