# Parsing

Purpose: Handles parsing of text values into tokens and annotations

## Benchmarking

### Running Benchmarks

```bash
# Запуск бенчмарков (результаты автоматически сохраняются в JSON)
pnpm run bench

# Watch режим для разработки
pnpm -F core run test:bench:watch
```

**Примечание:** Бенчмарки используют единый файл `parser.bench.ts`. Результаты автоматически сохраняются в `parser.bench.result.json` после каждого запуска.

### Benchmark Results Format

Результаты бенчмарков сохраняются в `parser.bench.result.json` с расширенными метриками производительности.

#### Структура JSON

```json
{
  "timestamp": "2025-10-22T18:07:44.157Z",
  "trends": {
    "v1": {
      "changeFromLast": "+2.5%",
      "regressions": []
    },
    "v2": {
      "changeFromLast": "-1.2%",
      "regressions": ["500 marks"]
    }
  },
  "summary": {
    "totalTests": 7,
    "v1Wins": 7,
    "v2Wins": 0,
    "overallPerformance": {
      "v1": { "avgOps": 566741, "medianOps": 56874 },
      "v2": { "avgOps": 101630, "medianOps": 3365 }
    },
    "performanceRatio": 5.58
  },
  "categories": {
    "scalability": {
      "tests": [...]
    },
    "realWorld": {
      "tests": [...]
    }
  }
}
```

#### Метрики

Каждый тест включает следующие метрики:

**Operations (ops)**
- `avg` - среднее количество операций в секунду
- `min` - минимальное значение
- `max` - максимальное значение
- `p95` - 95-й перцентиль
- `p99` - 99-й перцентиль

**Latency (latency)**
- Время выполнения одной операции в миллисекундах
- Те же статистики: avg, min, max, p95, p99

**Memory (memory)**
- `heapUsed` - используемая heap память в KB
- `external` - внешняя память в KB

**Comparison**
- `ratio` - соотношение производительности v1/v2
- `winner` - какой парсер быстрее
- `performanceGap` - разница в процентах
- `latencyDiff` - соотношение latency
- `memoryRatio` - соотношение потребления памяти

#### Категории тестов

**scalability**
Тесты масштабируемости с различным количеством marks (10, 50, 100, 500)

**realWorld**
Реальные сценарии использования:
- social media - посты с упоминаниями и хэштегами
- markdown-like - текст с markdown-подобной разметкой
- code comments - комментарии кода с аннотациями

#### Trends

Автоматический анализ изменений производительности между запусками:
- `changeFromLast` - процентное изменение с последнего запуска
- `regressions` - список тестов с деградацией производительности (>5%)

#### Интерпретация результатов

1. **Высокий ops** - больше операций в секунду = лучше
2. **Низкий latency** - меньше времени на операцию = лучше
3. **Низкий memory** - меньше потребление памяти = лучше
4. **p95/p99** - показывают стабильность производительности
5. **Regressions** - требуют внимания при наличии

### История результатов

Файл `parser.bench.result.json` хранит последние 10 запусков бенчмарков для анализа трендов и выявления регрессий.
