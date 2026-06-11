# Tokens

The single home for the token layer. `TokenModel` parses the editor value into a
token tree, indexes it (path ↔ token ↔ address), collects framework ref
callbacks, and maintains the token ↔ DOM-element index that selection and
keyboard navigation read from. It is exposed as `store.tokens`.

The heavy logic stays in pure free functions; the class is a thin orchestrator.

**Encapsulation rule:** raw `Selection`, `Range`, and `TreeWalker` DOM APIs live
only inside this module (`features/tokens/`). The boundary is enforced by
`pnpm run check:encapsulation` (`scripts/check-dom-encapsulation.sh`). All
consumers outside the module must go through `store.tokens` methods or
`TokenHandle`.

Design spec: `docs/superpowers/specs/2026-06-11-tokenmodel-dom-encapsulation-design.md`

## `TokenModel` (`store.tokens`)

- **Parsing** — `current` (computed `Token[]`) and `index` (computed
  `TokenIndex` for path/address resolution).
- **Ref collection** (formerly `TokenRefs`) — adapter components call
  `control(path?)` and `children(ownerPath)` to register DOM elements that
  should be treated as opaque controls or as nested child-sequence hosts.
- **DOM index** (formerly `DomIndex`) — rebuilt on every `host.rendered()` using
  `buildIndex`. All lookups (`#locate`, `#nodeFor`, `#nodes`) are private;
  consumers use the facade methods below. Fires the `indexed` event after each
  rebuild.

### Handle lookups

- `handleFor(address)` — live `TokenHandle` for the token at a known address, or
  `undefined` if not yet indexed.
- `handleAt(node)` — resolves a DOM node to its `TokenHandle`, `'control'` (if
  inside a control root), or `undefined` (outside the container).
- `tokenAt(position)` — `TokenHandle` of the text token containing `position`,
  or the next one after it.
- `handles()` — iterate all indexed tokens as live handles.

### DOM→model reads

- `boundaryFor(node, offset, affinity?)` — maps a DOM `(node, offset)` pair to
  an absolute document position. `affinity` (`'before'` | `'after'`, default
  `'after'`) breaks ties at token boundaries.
- `caretFromPoint(x, y)` — absolute position at viewport coordinates using the
  non-standard `caretRangeFromPoint` / `caretPositionFromPoint` APIs.

### Selection reads

- `readSelection()` — current window selection as a `RawSelection`
  `{range, direction?}` or `undefined`.
- `selectedContent()` — `{html, text}` snapshot of the current selection for
  clipboard use.
- `selectionRect()` — viewport `DOMRect` of the current caret/selection.
- `selectionAnchor()` — `{node, offset, isCollapsed}` of the selection anchor
  (overlay trigger probing).
- `isSelectionCollapsed()` — tri-state: `true` (collapsed), `false` (range),
  `undefined` (no selection / not focused).
- `selectionIntersects(node)` — whether the selection partially or fully contains
  `node`.
- `selectionFocusNode()` — the selection's focus node, if any.

### Caret / selection commands

- `placeCaret(target)` — place a collapsed caret. Number form resolves the best
  text surface or mark boundary; address form
  `{address, offset}` targets a specific token (disambiguates tokens sharing a
  boundary position). Returns `false` when placement failed.
- `selectRange(start, end)` — select `[start, end]`; order-insensitive (passing
  `(end, start)` is normalized). Collapses via `placeCaret` when equal.

### Surface sync

- `reconcileSurfaces({editable, readOnly})` — writes `textContent` /
  `contentEditable` on text token surfaces and `tabIndex` on mark roots.

## `TokenHandle`

Live, path-keyed view of one token. Created and synced by `TokenModel`; survives
DOM commits while a token exists at its path, then dies once. Dead handles never
throw — stale reads return the last snapshot, commands return `false`, and the
object is never resurrected.

### Reactive getters

- `token` — the current parsed `Token`.
- `address` — the current `TokenAddress`.
- `element` — the token root `HTMLElement`, or `undefined` when unmounted.
- `text` — shorthand for `token().content`.
- `dead` — `true` after `unmounted` fires.

### `changed` event

Fires with a `TokenChange` discriminated union:

| `kind`       | extra field           | when                                   |
| ------------ | --------------------- | -------------------------------------- |
| `'text'`     | `previous: string`    | `token.content` changed                |
| `'moved'`    | `previousAddress`     | position shifted without content change |
| `'mounted'`  | —                     | reserved (Phase 3, not emitted yet)    |
| `'unmounted'`| —                     | handle dies; fired exactly once        |

### Measurement

- `hasTextSurface()` — whether the token has a `contenteditable` text element.
- `textLength()` — character count of the token's scope.
- `caretIndex()` — caret offset within scope (meaningful only when focused).
- `caretRect(offset)` — `DOMRect` of a character-offset caret within the text
  surface.
- `rect()` — bounding rect of the token's scope element.
- `caretOnFirstLine()` / `caretOnLastLine()` — line-position helpers for
  vertical arrow-key navigation.

### Commands

All commands return `false` when the handle is dead.

- `placeCaret(offset)` — collapsed caret at a character offset (`Infinity` → end).
- `placeCaretAtBoundary(side)` — `'start'` or `'end'` of the scope.
- `placeCaretAtX(x, y?)` — caret at viewport x within the scope.
- `focus()` — focus the scope element.

## Pure helpers

- `buildIndex` — walks tokens and DOM children in lockstep with one iterative
  stack frame per nesting level, skips control elements, optionally descends into
  a registered child-sequence host, and emits a `(byPath, byElement)` snapshot.
- `reconcileTextSurfaces` — writes `textContent` / `contentEditable` on text
  token surfaces and `tabIndex` on mark roots from a `{editable, readOnly}` pair.
- `createTokenIndex` — builds the `TokenIndex` (path ↔ token ↔ address) lookups.

## Internal helpers (private to `features/tokens`)

These modules contain the raw DOM API usage gated by the encapsulation rule:

- `boundary.ts` — translates a DOM `(node, offset)` boundary to an absolute
  document position. Exports `rawPositionFromBoundary`, `textTargetAt`, and
  `markBoundaryAt`. Vocabulary: `'before'` / `'after'` = affinity at token
  boundaries; `'start'` / `'end'` = placement side.
- `caret.ts` — stateless `Range` / `Selection` mechanics: `placeAtTextOffset`,
  `placeAtChildBoundary`, `placeRangeAcrossSurfaces`, `setAtX`, `getCaretIndex`,
  `getRect`, `isOnFirstLine`, `isOnLastLine`, `focusIfNeeded`.
- `textOffsets.ts` — `TreeWalker`-based text measurement: `textLength`,
  `textOffsetWithin`, `hasEditableAncestorBefore`.

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
