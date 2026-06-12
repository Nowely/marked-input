# Tokens

The single home for the token layer, exposed as `store.tokens`. One source of
truth — an id-keyed map of live token nodes — feeds one commit pipeline with
two branches: text edits patch the DOM in place without invoking the framework
renderer; structural edits publish a new tree and bind the freshly painted DOM.
No feature flags; full parse and full DOM bind survive only as internal
cold-start/fallback branches.

**Encapsulation rule:** raw `Selection`, `Range`, and `TreeWalker` DOM APIs live
only inside this module (`features/tokens/`). The boundary is enforced by
`pnpm run check:encapsulation` (`scripts/check-dom-encapsulation.sh`). All
consumers outside the module go through `store.tokens` methods or `TokenHandle`.

Design spec: `docs/superpowers/specs/2026-06-12-tokenmodel-finegrained-consolidation-design.md`
(facade contract inherited from `2026-06-11-tokenmodel-dom-encapsulation-design.md`).

## LiveNode — the single source of truth (`model/LiveNode.ts`)

One live record per token, keyed by its stable identity id. The record IS the
public handle (`TokenHandle`): it owns the CURRENT parsed token, the tree path,
the DOM bindings (`tokenElement` / `textElement` / `rowElement` /
`childSequenceHost`), and a per-node `dirty` signal — THE fine-grained unit.

- Handle getters (`token` / `address` / `element` / `text` / `dead`) track only
  their own node's `dirty`: an untouched token's handle cannot recompute during
  someone else's edit (gated by the isolation specs).
- Mutation is internal: `update(token, path)` fires `text`/`moved` and bumps
  `dirty`; `bindElements`/`unbind` set and clear the DOM; `kill()` fires
  `unmounted` once. Dead handles never throw — stale reads return the last
  token, commands return `false`, the object is never resurrected.
- Derived lookups are maintained by the pipeline, never rebuilt per keystroke:
  `byId` (the node map itself), `byPath` (rebuilt only at bind — paths are
  unchanged on the text path by definition), `byElement` (WeakMap, set at bind).

## The one commit pipeline (`model/commit.ts`)

Every value change flows through a single `apply(reconcileResult)`:

```
value edit → parse (windowed; full on cold start / unstable window / markup change)
           → reconcile → changeset
  ├─ text path (added/removed empty, textChanged all text tokens):
  │    update changed/shifted nodes in place (token, positions),
  │    conditionally patch textContent of changed text surfaces,
  │    bump ONLY those nodes' dirty signals → fire changed(changeset)
  └─ structural:
       set tree signal (new reference) → renderer renders → rendered() →
       bind(container, latest tree): one DOM+tree walk —
         create/update/kill LiveNodes, set element bindings,
         apply contentEditable/tabindex to NEWLY BOUND surfaces and mark roots
       → fire changed(changeset)
```

- **Routing** is inline (~5 lines): text path ⇔ `kind === 'delta'` with empty
  `added`/`removed` — and every `textChanged` id resolving to a `text` token.
  A `textChanged` MARK escalates structurally (mark components render
  `value`/`meta` as framework props). Deep reconcile (B3) will make
  `textChanged` hold text tokens by construction and demote the type check to
  a dev assertion.
- **Escalation self-heals:** a text-path apply that cannot resolve a target
  (missing handle, missing surface, id absent from the tree) abandons the
  branch before any mutation and re-binds the current DOM structurally —
  no render needed first; the adapter's later `rendered()` re-binds
  idempotently.
- **`pendingStructural` latch:** between a structural apply and its bind the
  node layer is one generation stale. `handleOf` (and everything id-bridged
  through it: `MarkController` mutations, address-form `placeCaret`) returns
  `undefined` while latched — mutations fail closed instead of acting on a
  tree the DOM never showed. Applies landing inside the window fold into the
  pending structural pass.
- **bind projects the latest RECONCILED tree, not `tree()`:** the render tree
  keeps its (stale) reference across text applies, and a re-render arriving
  after one — any unrelated adapter update — must re-bind the fresh tokens,
  not regress the node layer and the DOM text to the pre-edit generation.
- **Editable state:** contentEditable/tabindex are applied at bind time to
  newly bound surfaces and mark roots, and by the scoped `setEditable` setter
  when `readOnly`/`isUserSelecting` change (SelectionController owns the
  policy, the model owns the application). The tabindex write checks the
  ATTRIBUTE, not the property — natively focusable mark roots (`<button>`)
  report `tabIndex === 0` without carrying it. No per-commit sweep exists.
- **`changed(changeset)`** fires in both branches only after the DOM is
  consistent with the node layer — the model-level "commit done" signal
  (SelectionController re-places the caret on it). During a latched window
  only the final changeset is announced; no production consumer reads the
  buckets (the payload exists for fine-grained consumers and specs).

## Structural DOM walk (`model/bind.ts`)

The structural branch's endpoint: zip the freshly rendered DOM with the
reconciled tree (one iterative frame per nesting level, control elements
skipped, optional registered child-sequence host per mark) and project the
result onto the node map — create handles for new ids, `update`+`bindElements`
for known ids, `kill` ids absent from the tree. The whole projection commits
as one batch, so handle watchers flush only after every node reflects the new
tree and DOM.

A DOM-walk bail (adapter mid-render misalignment) unbinds instead of killing:
the tree is authoritative, only the DOM is transiently misaligned, and the
next successful bind re-attaches the same handles.

**Block layout:** each immediate container child is a row; a row must contain
exactly one non-control element. Alignment is all-or-nothing — one bad row
bails the whole frame, failing loud when an adapter renders something
unexpected.

## Public API — the whole surface (`model/TokenModel.ts`)

```ts
// renderer contract
tree: Computed<Token[]>      // structural tree; reference changes ⇔ renderer must run
changed: Event<Changeset>    // THE model-level detector; fires after the DOM is consistent

// per-token live views
handleFor(address)           // handle bound at address.path, or undefined
handleAt(node)               // handle | 'control' | undefined for a DOM node
tokenAt(position)            // handle of the text token containing position
handles()                    // iterate all bound handles
handleOf(token)              // id-bridge for (possibly stale) token objects; latch-gated

// DOM↔model facade
boundaryFor / caretFromPoint / placeCaret / selectRange
readSelection / selectedContent / selectionRect / selectionAnchor /
isSelectionCollapsed / selectionIntersects / selectionFocusNode

// adapter refs
control() / children()
```

`setEditable({editable, readOnly})` is the scoped internal setter wired from
SelectionController's prop watches; it is not part of the consumer-facing
reading surface above.

Nothing is published before a container mounts: `tree()` is `[]` and facade
reads fail soft. Adapters mount the container ref, re-render from the first
structural commit, and report `rendered()`.

### The staleness contract

`tree()` is the RENDER tree: on the text path it keeps its previous reference
(adapters subscribed via snapshot comparison skip re-rendering), so its token
objects lag the value by design — the fresh truth lives in the node layer.

- **Handles are always fresh:** `handle.token()` carries current content and
  positions on both branches.
- **`handleOf(token)`** bridges a stale tree object to its live handle via the
  stable id (ids survive object replacement in the identity WeakMap). It fails
  closed while a structural apply awaits its bind.
- **`freshTokens(store.tokens)`** (`utils/freshTokens.ts`) is the canonical
  whole-tree fresh read for consumers that slice the live value by token
  positions (keyboard block edits, drag operations, clipboard serialization):
  tree shape from `tree()`, per-token freshness through the id bridge. A fresh
  mark token carries fresh children, so it never recurses.

### Boundary facade internals

`boundary.ts` owns the view types and reads the node layer through a
`BoundaryContext` the shell builds per call: `locate` walks a DOM node up to
its bound handle, `resolveAddress` is the fail-closed address check (path AND
object identity against the current reconciled tree), `viewOf` is the
id-bridged element read. `TokenView` carries the handle itself, so DOM→handle
resolution is a single lookup.

- `boundary.ts` — DOM `(node, offset)` → absolute position
  (`rawPositionFromBoundary`, `textTargetAt`, `markBoundaryAt`). Vocabulary:
  `'before'`/`'after'` = affinity at token boundaries; `'start'`/`'end'` =
  placement side.
- `caret.ts` — stateless `Range`/`Selection` mechanics (`placeAtTextOffset`,
  `placeAtChildBoundary`, `placeRangeAcrossSurfaces`, `setAtX`,
  `getCaretIndex`, `getRect`, `isOnFirstLine`, `isOnLastLine`,
  `focusIfNeeded`).
- `textOffsets.ts` — `TreeWalker`-based text measurement (`textLength`,
  `textOffsetWithin`, `hasEditableAncestorBefore`).

## `TokenHandle`

Live, identity-keyed view of one token — the LiveNode's public face. Follows
its token across structural path shifts (fires `moved`), survives commits
while the token exists, then dies once.

### Reactive getters

- `token` — the current parsed `Token` (fresh content and positions).
- `address` — the current `TokenAddress`, derived on read.
- `element` — the token root `HTMLElement`, or `undefined` when unbound.
- `text` — shorthand for `token().content`.
- `dead` — `true` after `unmounted` fires.

### `changed` event

| `kind`        | extra field        | when                                    |
| ------------- | ------------------ | --------------------------------------- |
| `'text'`      | `previous: string` | `token.content` changed                 |
| `'moved'`     | `previousAddress`  | position shifted without content change |
| `'unmounted'` | —                  | handle dies; fired exactly once         |

### Measurement

`hasTextSurface()`, `textLength()`, `caretIndex()`, `caretRect(offset)`,
`rect()`, `caretOnFirstLine()` / `caretOnLastLine()` — all over the bound
elements (row scope in block layout), inert defaults when unbound.

### Commands

All return `false` when unbound or dead: `placeCaret(offset)` (`Infinity` →
end), `placeCaretAtBoundary(side)`, `placeCaretAtX(x, y?)`, `focus()`.

## Parse and identity

### Identity tracker (`tokenIdentity.ts`)

`createIdentityTracker()` maps each `Token` object to a stable integer id via
a `WeakMap`. `reconcile(next, hint?, previousValue?, nextValue?)` matches the
new parse against the previous tree and returns `{tokens, changeset}`:

- **Prefix reuse** — top-level tokens byte-identical (full subtree, positions
  included) and entirely before the edit window are returned `===` the
  previous object.
- **Suffix id-carry** — tokens after the window identical modulo a uniform
  position shift inherit the previous id (descendants recursively) onto the
  new object and are reported in `shifted`; zero-shift suffixes are reused by
  reference like the prefix.
- **Middle pairing** — same-slot tokens with the same type (and descriptor for
  marks) inherit the old id and land in `textChanged`; everything unpaired is
  `added`/`removed`. Same-slot inheritance is best-effort continuity, not
  semantics — output correctness is guarded by the equivalence properties.

`idOf(token)` allocates on first sight (probe only live-tree tokens);
`idFor(token)` is the read-only peek the model uses for foreign-token-safe
bridging.

When no hint is provided the tracker derives one from the values via `findGap`;
the changeset degrades to `{kind: 'full'}` only on the very first reconcile.

### Changeset vocabulary

```ts
type Changeset =
  | {kind: 'full'}
  | {kind: 'delta'; textChanged: number[]; added: number[]; removed: number[]; shifted: number[]}
```

`textChanged` carries ids at matched-token granularity (a changed mark's
subtree is dirty, not diffed per child — until deep reconcile lands).
`shifted`/`added`/`removed` include descendant ids recursively.

### Deep reconcile — descend rules

Placeholder: B3 adds pairwise descend into a changed mark's slot (same
descriptor, byte-unchanged `value`/`meta`, slot-interior-only change, 1:1
child pairing), renaming `shifted` → `updated`. Until then a changed mark
routes structural — in block layout every visible text token sits inside a
slot-leading mark, so block typing re-renders per keystroke while inline
typing takes the text path.

### Edit-hint flow

`EditController.replace` → `ValueModel.replace(range, replacement)` records a
consume-once `{start, end, insertedLength}` hint; `ValueModel.previousValue()`
captures the pre-write value synchronously in the signal's set-transform. The
model's reconcile computed drains both on every recompute and hands them to
the tracker and the windowed parse.

**Controlled-mode limitation (precision, not correctness):** a parent driving
`props.value` without a local `replace` can leave a stale hint behind; that
degrades changeset precision only — parse output is never affected.

### Windowed incremental reparse (`incrementalParse.ts`)

The windowed parse IS the parse — no flag. `TokenModel.#parse` full-parses
only on cold start or when the parser/options changed; otherwise it reparses a
window around the edit hint and splices:

1. **Validate the hint** — any inconsistency → full parse.
2. **Window in prev coordinates** — expand to enclosing top-level token
   boundaries, widen by one token per side, snap outward to TEXT tokens (the
   parser emits a strictly alternating text/mark stream, empty texts included).
3. **Inert-outside guard** — every text content outside the window must
   contain no markup segment at all (segment pairing is non-local); guard
   trips → full parse.
4. **Parse the window slice**, shift positions by `windowStart`.
5. **Stabilization (doubling check)** — reparse a self-width-widened window;
   differing content adopts the doubled window, at most `MAX_WIDENINGS` (3)
   times, then full parse.
6. **Splice** — `[prefix prev tokens, reparsed window, shifted suffix]`; the
   identity tracker runs on the spliced tree.

**Full-parse fallback guarantee:** correctness never depends on incrementality
(gated by `incrementalParse.property.spec.ts` — output deep-equals the full
parse for any document and edit).

**Block-layout caveat:** slot-leading markups (`'__slot__\n\n'`) almost always
trip the inert-outside guard on the `\n\n` prefix segment — block parse stays
effectively full. The incremental win applies primarily to inline markups
(benchmarks: `parser.bench.ts`, ~1.5–1.65× over full parse for 500-mark
documents).

## Divergence detector (the only flag)

`VERIFY_DOM = import.meta.env?.DEV ?? true` (`model/commit.ts`) — dev/test
builds assert after both branches that every bound text surface's
`textContent` equals its token's `content`, throwing
`TokenModel divergence at [path]: DOM "…" ≠ model "…"`. Through the public API
the machinery self-heals before each check (bind sweeps every bound surface,
the text branch writes its own targets), so the throw cases are covered
white-box — the detector guards the case where the healing itself missed a
write. Production bundles strip it.

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