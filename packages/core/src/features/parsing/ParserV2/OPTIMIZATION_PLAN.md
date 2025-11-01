# ParserV2 Optimization Plan - Phase 2 & 3

## Status: Phase 1 Completed ✅

**Phase 1 Results:**
- Performance: +46% improvement (V2: 226k ops/sec, was 155k ops/sec)
- Correctness: 100% (452/452 tests passing)
- V1 vs V2: V1 remains 2-5x faster (acceptable for added flexibility)

---

## Phase 2: Architectural Refactoring

**Goal**: Consolidate redundant components and optimize data flow
**Expected gain**: 15-20% performance improvement
**Effort**: High
**Risk**: Medium

### 2.1. Lazy Evaluation для Children Tokens

**Problem**: TreeBuilder всегда создает children массивы, даже когда они пустые или не используются

**Solution**:
```typescript
interface LazyMarkToken {
  type: 'mark'
  content: string
  position: {start: number, end: number}
  optionIndex: number
  value: string
  meta?: string
  nested?: {content: string, start: number, end: number}
  
  // Lazy children - вычисляются при первом обращении
  get children(): Token[]
  _children?: Token[]  // Кэш
  _childrenFactory?: () => Token[]  // Функция для отложенного вычисления
}
```

**Implementation**:
1. Изменить TreeBuilder, чтобы сохранять closure вместо немедленного парсинга children
2. Добавить getter для children, который вычисляет их при первом обращении
3. Кэшировать результат после первого вычисления

**Benefits**:
- Экономия на парсинге вложенных структур, которые не используются
- Уменьшение аллокаций для marks без children
- Потенциально 10-15% ускорение для случаев с глубокой вложенностью

**Challenges**:
- Изменение интерфейса Token может нарушить обратную совместимость
- Необходимо тщательное тестирование всех edge cases
- Closure могут увеличить потребление памяти если children никогда не вычисляются

### 2.2. Удалить Дублирующиеся Классы

**Problem**: StreamingParser и PatternProcessor выполняют похожие задачи с разными подходами

**Current Architecture**:
```
SegmentMatch (Aho-Corasick)
    ↓
PatternProcessor → PatternChain
    ↓
MatchValidator → ValidatedMatch  
    ↓
MatchPostProcessor → MatchResult
    ↓
TreeBuilder → Token[]
```

**Optimized Architecture** (уже в OptimizedParser):
```
SegmentMatch (Aho-Corasick)
    ↓
OptimizedParser (State Machine) → DirectMatch
    ↓
filterOverlappingMatches → DirectMatch[]
    ↓
convertToMatchResults → MatchResult[]
    ↓
TreeBuilder → Token[]
```

**Action Items**:
1. Полностью удалить старые классы:
   - `PatternProcessor.ts`
   - `MatchValidator.ts`
   - `MatchPostProcessor.ts`
   - `StreamingParser.ts` (если существует)
   
2. Оставить только:
   - `OptimizedParser.ts` - основная логика
   - `TreeBuilder.ts` - построение дерева
   - `MarkupDescriptor.ts` - описание паттернов
   - `AhoCorasick.ts` - поиск сегментов

**Benefits**:
- Упрощение кодовой базы (~1000 строк кода удалено)
- Уменьшение размера bundle
- Проще поддерживать и понимать
- Потенциально 5% ускорение за счет меньшего количества кода

**Challenges**:
- Нужно убедиться что все edge cases покрыты OptimizedParser
- Могут быть зависимости в других частях системы

### 2.3. Оптимизация TreeBuilder

**Problem**: TreeBuilder использует stack-based подход с множеством проверок

**Current Complexity**: O(N²) в худшем случае для глубоко вложенных структур

**Optimization Ideas**:

1. **Pre-compute nesting levels**:
```typescript
interface MatchWithLevel extends MatchResult {
  level: number  // Глубина вложенности (0 = root)
  parent?: number  // Индекс родительского match
}

// Вычисляем уровни за один проход
function computeLevels(matches: MatchResult[]): MatchWithLevel[] {
  const withLevels: MatchWithLevel[] = []
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    let level = 0
    let parent = -1
    
    // Найти родителя
    for (let j = i - 1; j >= 0; j--) {
      if (isContainedIn(match, withLevels[j])) {
        level = withLevels[j].level + 1
        parent = j
        break
      }
    }
    
    withLevels.push({...match, level, parent})
  }
  
  return withLevels
}
```

2. **Direct token construction** без stack:
```typescript
function buildTreeFast(input: string, matches: MatchWithLevel[]): Token[] {
  // Группируем по уровням
  const byLevel = new Map<number, MatchWithLevel[]>()
  for (const match of matches) {
    if (!byLevel.has(match.level)) byLevel.set(match.level, [])
    byLevel.get(match.level)!.push(match)
  }
  
  // Строим снизу вверх (от листьев к корню)
  const maxLevel = Math.max(...byLevel.keys())
  const tokenMap = new Map<number, Token>()
  
  for (let level = maxLevel; level >= 0; level--) {
    const levelMatches = byLevel.get(level) || []
    
    for (const match of levelMatches) {
      // Собираем children из tokenMap
      const children = findChildrenTokens(match, tokenMap)
      tokenMap.set(matchIndex, createMarkToken(match, children))
    }
  }
  
  return buildRootLevel(tokenMap, input)
}
```

**Benefits**:
- Линейная сложность O(N) вместо O(N²)
- Более предсказуемая производительность
- Потенциально 5-10% ускорение для вложенных структур

---

## Phase 3: Radical Optimizations

**Goal**: Максимальная производительность, приближение к V1
**Expected gain**: 30-50% improvement (could match or exceed V1 in some cases)
**Effort**: Very High
**Risk**: High

### 3.1. Zero-Copy TokenView Approach

**Concept**: Вместо создания новых Token объектов, использовать "view" на исходную строку

**Current Problem**:
```typescript
// Каждый Token создает копии строк
interface Token {
  content: string  // ❌ Copy
  value: string    // ❌ Copy
  nested?: {content: string, ...}  // ❌ Copy
}
```

**Zero-Copy Solution**:
```typescript
// TokenView хранит только позиции и ссылку на исходную строку
class TokenView {
  constructor(
    private input: string,
    private start: number,
    private end: number,
    private type: 'text' | 'mark',
    private valueStart?: number,
    private valueEnd?: number
  ) {}
  
  // Lazy getters - строки создаются только при обращении
  get content(): string {
    return this.input.substring(this.start, this.end)
  }
  
  get value(): string {
    if (this.valueStart === undefined) return ''
    return this.input.substring(this.valueStart, this.valueEnd)
  }
  
  // Можно добавить методы для эффективного сравнения без создания строк
  contentEquals(str: string): boolean {
    const len = this.end - this.start
    if (len !== str.length) return false
    for (let i = 0; i < len; i++) {
      if (this.input[this.start + i] !== str[i]) return false
    }
    return true
  }
}
```

**Implementation Steps**:
1. Создать `TokenView` класс с lazy string extraction
2. Изменить все операции над Token для работы с view
3. Добавить compatibility layer для обратной совместимости
4. Постепенно мигрировать код на использование TokenView

**Benefits**:
- Нулевое копирование строк до момента использования
- Огромная экономия памяти для больших документов
- 20-30% ускорение за счет отсутствия string allocations
- Лучшая cache locality

**Challenges**:
- Breaking change - нужна миграция всего кода
- Сложность в отладке (view vs реальные значения)
- Нужно держать исходную строку в памяти
- Риск использования после освобождения input строки

### 3.2. Memoization для Повторяющихся Паттернов

**Concept**: Кэшировать результаты парсинга для одинаковых подстрок

**Problem**: Многие документы содержат повторяющиеся структуры
```typescript
// Например, в коде множество одинаковых комментариев:
"// TODO: fix this\n// TODO: fix that\n// TODO: fix other"
```

**Solution - Content-based Memoization**:
```typescript
class MemoizedParser {
  private cache = new Map<string, Token[]>()
  private stats = {hits: 0, misses: 0}
  
  parse(input: string, maxCacheSize = 1000): Token[] {
    // Для коротких строк используем полное совпадение
    if (input.length < 100) {
      const cached = this.cache.get(input)
      if (cached) {
        this.stats.hits++
        return this.cloneTokens(cached)  // Clone для безопасности
      }
    }
    
    // Для длинных - хэш-based
    const hash = this.computeHash(input)
    const cacheKey = `${hash}:${input.length}`
    const cached = this.cache.get(cacheKey)
    
    if (cached && this.validateCached(input, cached)) {
      this.stats.hits++
      return cached
    }
    
    // Parse и сохраняем
    this.stats.misses++
    const result = this.doParse(input)
    
    // LRU eviction
    if (this.cache.size >= maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    this.cache.set(cacheKey, result)
    return result
  }
  
  private computeHash(input: string): number {
    // Fast hash для первых N символов
    let hash = 0
    const len = Math.min(input.length, 64)
    for (let i = 0; i < len; i++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i)
      hash |= 0  // Convert to 32bit integer
    }
    return hash
  }
}
```

**Advanced: Pattern-level Memoization**:
```typescript
// Кэшируем не результаты парсинга, а найденные matches
class PatternMemoization {
  // Кэш: pattern signature → positions
  private patternCache = new Map<string, number[]>()
  
  findPatterns(input: string, patterns: string[]): MatchResult[] {
    // Signature учитывает структуру паттернов и input
    const sig = this.createSignature(input, patterns)
    const cached = this.patternCache.get(sig)
    
    if (cached) {
      // Быстро восстанавливаем matches из позиций
      return this.reconstituteMatches(cached, input, patterns)
    }
    
    // Обычный парсинг
    const matches = this.actualParsing(input, patterns)
    
    // Сохраняем только позиции (компактно)
    const positions = this.extractPositions(matches)
    this.patternCache.set(sig, positions)
    
    return matches
  }
}
```

**Benefits**:
- 50-80% ускорение для документов с повторениями
- Особенно эффективно для code comments, repeated markup
- Можно комбинировать с worker threads для async parsing

**Challenges**:
- Overhead на хэширование и кэш-менеджмент
- Потребление памяти для кэша
- Сложность в определении когда кэш помогает, а когда вредит
- Нужна адаптивная стратегия (enable/disable caching based on hit rate)

### 3.3. Parallel Parsing для Больших Документов

**Concept**: Разделить большой документ на чанки и парсить параллельно

**Strategy**:
```typescript
class ParallelParser {
  async parse(input: string, chunkSize = 10000): Promise<Token[]> {
    if (input.length < chunkSize * 2) {
      // Для небольших документов параллелизм не нужен
      return this.sequentialParse(input)
    }
    
    // Разбиваем на чанки с overlap для корректности границ
    const chunks = this.splitIntoChunks(input, chunkSize, overlap = 200)
    
    // Парсим параллельно (Web Workers или worker_threads)
    const promises = chunks.map(chunk => 
      this.parseChunkInWorker(chunk)
    )
    
    const results = await Promise.all(promises)
    
    // Сливаем результаты, устраняя дубликаты на границах
    return this.mergeChunkResults(results, chunks)
  }
  
  private splitIntoChunks(
    input: string, 
    chunkSize: number, 
    overlap: number
  ): ChunkInfo[] {
    const chunks: ChunkInfo[] = []
    
    for (let i = 0; i < input.length; i += chunkSize) {
      const start = Math.max(0, i - overlap)
      const end = Math.min(input.length, i + chunkSize + overlap)
      
      chunks.push({
        text: input.substring(start, end),
        offset: start,
        overlapStart: overlap,
        overlapEnd: overlap
      })
    }
    
    return chunks
  }
}
```

**Benefits**:
- Линейное ускорение с количеством ядер для больших документов
- Особенно эффективно для документов >100KB
- Можно использовать все ядра CPU

**Challenges**:
- Overhead на создание workers и communication
- Сложность в корректном слиянии результатов на границах
- Нужна специальная логика для patterns, пересекающих границы чанков
- Может быть медленнее для небольших документов

### 3.4. SIMD Optimizations (Advanced)

**Concept**: Использовать SIMD инструкции для ускорения string matching

**Implementation** (требует WebAssembly):
```typescript
// В Rust/C++ с SIMD
fn find_pattern_simd(text: &[u8], pattern: &[u8]) -> Vec<usize> {
    use std::arch::x86_64::*;
    
    let mut positions = Vec::new();
    let pattern_first = pattern[0];
    
    // Загружаем первый символ паттерна в SIMD регистр
    let pattern_vec = unsafe { _mm_set1_epi8(pattern_first as i8) };
    
    let mut i = 0;
    while i + 16 <= text.len() {
        // Загружаем 16 байт текста
        let text_vec = unsafe {
            _mm_loadu_si128(text.as_ptr().add(i) as *const __m128i)
        };
        
        // Сравниваем все 16 символов одновременно
        let cmp = unsafe { _mm_cmpeq_epi8(text_vec, pattern_vec) };
        let mask = unsafe { _mm_movemask_epi8(cmp) };
        
        // Проверяем каждый совпавший байт
        if mask != 0 {
            for j in 0..16 {
                if (mask & (1 << j)) != 0 {
                    if text[i+j..].starts_with(pattern) {
                        positions.push(i + j);
                    }
                }
            }
        }
        
        i += 16;
    }
    
    positions
}
```

**Benefits**:
- 4-8x ускорение для string matching операций
- Особенно эффективно для длинных паттернов
- Может ускорить AhoCorasick search

**Challenges**:
- Требует WebAssembly
- Сложность в разработке и отладке
- Не поддерживается везде
- Нужен fallback на обычный код

---

## Recommended Approach

### Conservative (Recommended):
1. ✅ **Phase 1**: Completed - 46% improvement
2. **Phase 2.2**: Remove duplicate classes (low risk, maintenance benefit)
3. **Stop here** - достигнута хорошая производительность

### Aggressive:
1. ✅ **Phase 1**: Completed
2. **Phase 2.1 + 2.2**: Lazy eval + cleanup (15% gain)
3. **Phase 3.2**: Memoization with adaptive strategy (20-30% gain)
4. **Phase 3.1**: Zero-copy if needed (20% gain)

### Extreme (Not Recommended):
- Full implementation of all Phase 3 optimizations
- Risk: High complexity, maintenance burden
- Benefit: Might match V1, but at what cost?

## Performance Goals Reassessment

**Current State**:
- V2 Optimized: 226k ops/sec average
- V1: 523k ops/sec average
- Ratio: 2.3x

**Realistic Target with Phase 2+3**:
- V2 Further Optimized: ~320-350k ops/sec (40-50% additional gain)
- Still ~1.5-1.6x slower than V1
- Ratio: 1.5x (acceptable given added flexibility)

**To Match V1 Performance**:
- Would require SIMD + Zero-copy + Parallel parsing
- Effort: 6-8 weeks of development
- Risk: Very high
- Recommendation: **Not worth it** - V1 is already available for performance-critical cases

## Conclusion

**Phase 1 is a Great Success** - OptimizedParser achieves:
- ✅ 46% performance improvement
- ✅ 100% correctness
- ✅ Production ready
- ✅ Maintainable codebase

**Phase 2 (optional)**: Reasonable next step if performance is still insufficient
**Phase 3 (not recommended)**: Only if there's a business-critical need to match V1 performance
