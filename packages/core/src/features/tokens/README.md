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

## Phase 2 — token identity, changesets, and incremental reparse

Phase 2 wires stable token identity across reparses, a per-commit changeset, and
an optional windowed fast-path reparse.  The parse output is always correct and
unaffected by these layers; they only add identity continuity and routing signals
on top.

### Identity tracker (`tokenIdentity.ts`)

`createIdentityTracker()` returns an `IdentityTracker` that maps each `Token`
object to a stable integer id via a `WeakMap<Token, number>`.  Ids are allocated
once per token on first sight and never reused.

`reconcile(next, hint?, previousValue?, nextValue?)` matches `next` against the
previously reconciled tree and returns `{tokens, changeset}`:

- **Prefix reuse** — top-level tokens that are byte-identical to their predecessor
  (type, content, positions, descriptor, value/meta, and full subtree) AND lie entirely before
  the edit window are returned `===` the previous object.  The comparison is exact:
  a token with shifted positions is never reused by reference.
- **Suffix id-carry** — top-level tokens lying entirely after the edit window that
  are identical except for a uniform position shift (`shiftDelta`) inherit the
  previous token's id (and its children's ids recursively) onto the new object.
  When `shiftDelta !== 0` they are new objects (positions differ) with inherited id
  and are reported in `shifted`; when `shiftDelta === 0` they are reused by reference
  like the prefix and are NOT reported in `shifted`.
- **Middle pairing** — tokens inside the edit window are paired at the same tree
  slot with the same type and descriptor.  A paired token inherits the old id and
  is placed in `textChanged`; anything without a pair gets a fresh id and goes to
  `added`.

`idOf(token)` assigns an id on first sight and is idempotent afterwards.  Calling
it on a token that is not part of the current reconciled tree permanently allocates
an id — probe only tokens belonging to the live tree.

Edit hint fallback: when no `hint` is provided, the tracker reconstructs one from
the token contents via `findGap` (the same divergence-range utility used by
preparsing).  Changeset degrades to `{kind: 'full'}` only on the very first
reconcile (no previous tree to compare against).

### Changeset vocabulary

```ts
type Changeset =
  | {kind: 'full'}
  | {kind: 'delta'; textChanged: number[]; added: number[]; removed: number[]; shifted: number[]}
```

`textChanged` carries ids of top-level tokens only (its subtree is dirty, no per-child diff).
`shifted`, `added`, and `removed` include the ids of all descendant tokens (children's ids
are included recursively).

`textChanged` on a `mark` token means its content changed; the subtree is treated
as dirty and not diffed per-child.  Whether a textChanged mark requires renderer
invalidation is a Phase 3 decision.

**THE ROUTING RULE** (from the design spec, Phase 3):

> `textChanged` and `shifted` are both text-path — a pure text edit shifts every
> suffix token's position, and that must NOT trigger the renderer, or React would
> render on every keystroke.  `added` or `removed` non-empty → structural path →
> renderer re-render.

```
value edit → incremental parse → changeset
  ├─ textChanged/shifted only → patch text surfaces directly; renderer not invoked
  └─ added/removed present   → request renderer re-render; rebuild index
```

### Edit-hint flow

`EditController.replace` is the single production write path to the value.  The
hint threading works as follows:

1. `EditController.replace` normalizes the replacement range and calls
   `ValueModel.replace(range, replacement)`.
2. `ValueModel.replace` records `{start, end, insertedLength}` in `#pendingEdit`
   (only when the value actually changes — a no-op replace leaves `#pendingEdit`
   undefined to avoid a stale hint on a later unrelated write).
3. `ValueModel.takePendingEdit()` is a consume-once accessor: the first caller
   drains the hint and subsequent calls return `undefined`.
4. `ValueModel.previousValue()` captures the value as it was before the most
   recent accepted write.  Both direct `current(x)` sets and `replace()` calls
   update it through the signal's set-transform, which fires synchronously before
   the stored value changes — ensuring readers never see a half-updated pair.
5. `TokenModel.#reconciled` (a `Computed`) calls `takePendingEdit()` and
   `previousValue()` on every recompute; it passes them into `#identity.reconcile`
   after parsing.

**Controlled-mode limitation (precision, not correctness):** in controlled mode
the parent controls `props.value` without calling `replace`.  A stale hint may
survive in `#pendingEdit` from a previous replace; if the parent later updates
`props.value` for an unrelated reason without triggering a local write, that stale
hint degrades changeset precision — the identity tracker may misattribute
`textChanged` vs `added/removed`.  Token correctness (parse output) is never
affected.

### Windowed incremental reparse (`incrementalParse.ts`)

Enabled by default (`INCREMENTAL = true`; flip to `false` in source for A/B
debugging).  Used by `TokenModel.#parse` when a hint is available and the previous
parse matches the previous value.

Algorithm:

1. **Validate the hint** — range within bounds, length consistent, values identical
   outside the edited range.  Any failure → full parse.
2. **Window in prev coordinates** — expand `[hint.start, hint.end]` to the
   enclosing top-level token boundaries, widen by one whole token per side, then
   snap both endpoints outward to text tokens (the parser emits a strictly
   alternating text/mark stream including empty text tokens, so text-endpoint
   windows splice back into a valid stream).
3. **Inert-outside guard** — every text content outside the window (top-level text
   tokens plus nested text/value/meta inside outside marks) must contain no markup
   segment at all.  This is the key safety rule for non-local pairing: a segment
   outside the window could pair with one inside it, making a bounded reparse
   incorrect regardless of window width.  Guard trips → full parse.
4. **Parse the window slice** and shift resulting positions by `windowStart`.
5. **Stabilization (doubling check)** — reparse a window widened by its own
   character width; compare the content the two windows produce over the doubled
   range.  Equal → accept and splice.  Different → adopt the doubled window and
   retry up to `MAX_WIDENINGS` (3) times.  A window that grows to the whole
   document is already the full parse.  Budget exhausted → full parse.
6. **Splice** — `[prefix prev tokens, reparsed window, suffix prev tokens shifted
   by delta]`.  The identity tracker then runs on the spliced tree.

**Full-parse fallback guarantee:** correctness never depends on incrementality.
Every guard that detects doubt falls back to `parser.parse(nextValue)`.

**Block-layout caveat:** slot-leading markups (block layout prefixes values with
`'__slot__\n\n'`) almost always fall back to a full parse — the inert-outside
guard trips on the `\n\n` segment in the prefix text token.  The incremental win
therefore applies primarily to inline-style markups (no multi-line prefix).
Benchmark reference: `parser.bench.ts` (500-mark document, tail and middle
one-char inserts, ~1.5–1.65× faster than full parse for inline markups).

### `TokenModel` API additions (Phase 2)

```ts
changeset(): Changeset   // routing input for Phase 3; reflects the latest reconcile
idOf(token: Token): number   // stable id of a token in the current tree (assign-on-first-sight)
```

`changeset()` reads `#reconciled()`, which is a Computed — it is reactive and
will re-run only when the value or parser options change.  `idOf` delegates to the
identity tracker's `WeakMap` lookup.

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
