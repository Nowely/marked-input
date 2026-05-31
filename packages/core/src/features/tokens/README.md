# Tokens

The single home for the token layer. `TokenModel` parses the editor value into a
token tree, indexes it (path ↔ token ↔ address), collects framework ref
callbacks, and maintains the token ↔ DOM-element index that selection and
keyboard navigation read from. It is exposed as `store.tokens`.

The heavy logic stays in pure free functions; the class is a thin orchestrator.

## `TokenModel` (`store.tokens`)

- **Parsing** — `current` (computed `Token[]`) and `index` (computed
  `TokenIndex` for path/address resolution).
- **Ref collection** (formerly `TokenRefs`) — adapter components call
  `control(path?)` and `children(ownerPath)` to register DOM elements that should
  be treated as opaque controls or as nested child-sequence hosts.
- **DOM index** (formerly `DomIndex`) — rebuilds on every `host.rendered()` using
  `buildIndex`. Exposes `locate(node)`, `nodeFor(address)`, `nodes()`, and the
  `indexed` event. Selection, keyboard, and overlay read through these rather
  than walking DOM children directly.

## Pure helpers

- `buildIndex` — walks tokens and DOM children in lockstep with one iterative
  stack frame per nesting level, skips control elements, optionally descends into
  a registered child-sequence host, and emits a `(byPath, byElement)` snapshot.
- `reconcileTextSurfaces` — writes `textContent` / `contentEditable` on text
  token surfaces and `tabIndex` on mark roots from a `{editable, readOnly}` pair.
- `createTokenIndex` — builds the `TokenIndex` (path ↔ token ↔ address) lookups.

## Block layout indexing

`buildIndex` honours block layout when `isBlock` is true: each immediate child of
the container is treated as a row, and each row must contain exactly one
non-control element to count as a token surface. The alignment is
**all-or-nothing** — if any row has zero or more than one non-control element,
indexing for the whole frame bails, failing loud when an adapter renders
something unexpected.

## Benchmarking

### Running Benchmarks

```bash
# Run benchmarks (results are saved to JSON automatically)
pnpm run bench

# Watch mode for development
pnpm -F core run test:bench:watch
```

**Note:** Benchmarks use the single file `parser.bench.ts`. Results are saved to `parser.bench.result.json` after each run.

### Benchmark Results Format

Benchmark results are stored in `parser.bench.result.json` with extended performance metrics.

#### JSON structure

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

#### Metrics

Each test includes these metrics:

**Operations (ops)**

- `avg` - average operations per second
- `min` - minimum
- `max` - maximum
- `p95` - 95th percentile
- `p99` - 99th percentile

**Latency (latency)**

- Execution time of one operation in milliseconds
- Same stats: avg, min, max, p95, p99

**Memory (memory)**

- `heapUsed` - heap memory used (KB)
- `external` - external memory (KB)

**Comparison**

- `ratio` - performance ratio v1/v2
- `winner` - which parser is faster
- `performanceGap` - percentage difference
- `latencyDiff` - latency ratio
- `memoryRatio` - memory usage ratio

#### Test categories

**scalability**
Scalability tests with different counts of marks (10, 50, 100, 500)

**realWorld**
Real-world scenarios:

- social media - posts with mentions and hashtags
- markdown-like - text with markdown-like markup
- code comments - code comments with annotations

#### Trends

Automatic analysis of performance changes between runs:

- `changeFromLast` - percent change since the last run
- `regressions` - list of tests with performance degradation (>5%)

#### How to read results

1. **High ops** - more operations per second = better
2. **Low latency** - less time per operation = better
3. **Low memory** - lower memory usage = better
4. **p95/p99** - show performance stability
5. **Regressions** - need attention if present

### Results history

The file `parser.bench.result.json` stores the last 10 benchmark runs for trend analysis and regression detection.
