# Tokens

The single home for the token layer, exposed as `store.tokens`. The token TREE is
the source of truth and the value string is its projection (spec D1): a write
lowers to a splice in the projection's coordinates, adoption folds the fresh
parse back into the persistent nodes, and one commit pipeline with two branches
carries the result to the DOM — text edits patch surfaces in place without
invoking the framework renderer; structural edits publish a new tree and bind the
freshly painted DOM. No feature flags; parse is always a full parse, and the
structural branch always does a full DOM bind.

**Encapsulation rule:** raw `Selection`, `Range`, and `TreeWalker` DOM APIs live
only inside this module (`features/tokens/`). All consumers outside the module
go through `store.tokens` methods or `TokenHandle`.

## Two layers, and the difference matters

|                                      | owns                                                  | reactive?                                                    | identity                                |
| ------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| `TreeNode` (`tree/types.ts`)         | the CONTENT — text, value, meta, children, positions  | yes: `text`/`value`/`meta`/`children` are signals (spec D11) | `id`, assigned at birth, never reused   |
| `TokenHandle` (`dom/TokenHandle.ts`) | the DOM BINDING and the generation the DOM is showing | no — plain field reads                                       | the same `id`, keyed in the `nodes` map |

`TreeNode` is the store. `TokenHandle` is a view over one node's DOM. They share
an id and nothing else, and the split is what makes the pending window safe.

## The tree (`tree/`)

- `types.ts` — the node shapes. `TextNode` is `{id, text, position, range()}`;
  `MarkNode` adds `descriptor`/`markup`/`value`/`meta`/`children`/`slotRange`
  plus the public reads `slot()`/`range()` and the write verbs
  `update(patch)`/`remove()`. `MarkPatch` has no discriminator: an absent field
  is left alone, `null` clears it, a string sets it. `NodeAnchor` is the
  addressing model — `{node, offset}`, `{before}`, `{after}`, `'start'`,
  `'end'`.
- `tree.ts` — `createTokenTree(tokens, commands?)`: the `roots` signal, the
  `value` computed (the string projection, joined by `joinNodes`), and
  `buildNode`, the only allocator of ids. `MarkNode.slot()` joins its live
  children — slot text is never stored, so it cannot go stale.
- `adopt.ts` — the fold. Parse the spliced projection, then walk
  prefix / suffix / middle against the previous nodes: prefix and suffix are
  retained byte- and position-equal and strictly OUTSIDE the edit window (the
  window bound is load-bearing — repeating content matches past the edit
  otherwise), the middle pairs same-index candidates and recurses into a mark
  whose `descriptor` matches. Returns a `TransactionResult` carrying
  `added`/`removed`/`updated`/`shifted`, the anchor `map`, and `render`.
- `gapWindow.ts` — the boundary-reset window: the common prefix/suffix of two
  projections, via `findGap.ts`. An empty window pins at the END of the value,
  because `start` of an empty window is not an edit location.
- `transactions.ts` — the write verbs (spec D5). `applyRange(window, text)` is
  the primitive; `applyText(node, localRange, text)` and
  `applyStructural(target, replacement)` lower node-local intent into it, and
  `tx(fn)` buffers disjoint ops and adopts once with the hull window. Nothing
  here mutates the tree — adoption, inside the sink, is the only writer.
- `valueBoundary.ts` — the string boundary (spec §4.4): commit policy plus arrival
  routing. Controlled mode emits and waits for the echo it spliced; uncontrolled
  commits straight through. Block mode's parse filter (`filterEmptyText`) lives
  here.
- `offsetShim.ts` — the internal offset shim (spec D8): a global `{start, end}`
  range → `applyRange`. `end < 0` means "to the end of the value". Whole-value
  ops are re-derived through `gapWindow` rather than passed as `{0, length}`, so
  the adoption walks stay effective. It exists until the block-rows follow-up
  gives its callers node-anchored verbs.
- `snapshot.ts` / `snapshotMemo.ts` — the compat projection. `snapshot(nodes)`
  is the pure, unmemoized §7.1 output-equivalence gate; `materializeNode` is the
  one-node step the memo reuses. `snapshotMemo` re-materializes only what the
  adoption changed, invalidating on dirty ids (walked subtree-inclusively) AND on
  child-reference comparison — both mechanisms are load-bearing.
- `anchors.ts` — `anchorAt(roots, offset)` (right affinity: the last text node
  containing the offset) and its inverse `offsetOfAnchor`.
- `markPatch.ts` — `serializeMark(node, patch)`: a patch becomes markup, with
  the omitted fields defaulted off the node so an omitted key round-trips.

## Adoption — the descend rules

Pairing is same-index within one sibling list. A candidate is adopted when:

1. both are text, or
2. both are marks AND their `descriptor` is reference-equal (descriptors are
   interned per parser instance).

Anything else is a rebuild: the candidate's ids are collected into `removed` and
a fresh node is built into `added`.

An adopted mark ALWAYS recurses into its children — that recursion is what keeps
in-slot component identity alive across a mark-level value/meta change. The
"refused descend" of the pre-rewrite reconcile is not a separate predicate any
more: `§4.2`'s split shows up only in what the mark itself reports. A mark whose
`value` or `meta` changed enters `updated` (its rendered framework props are new,
so the renderer must run); a mark whose children alone changed does not.

Positions are plain field writes (spec D3), so a move leaves no signal trace.
`shifted` is the only feed that can carry it, and its granularity is subtree
roots — a listed node covers its descendants.

**Block-typing consequence:** every row of a slot-leading block markup
(`'__slot__\n\n'`) is a mark, so without in-slot adoption each keystroke in a row
would be a whole-mark replacement → structural → re-render. With it the keystroke
touches only the row's slot text node → text path → the surface is patched with
ZERO component re-renders — gated end-to-end by the block render-count specs
(`packages/storybook/src/pages/renderCount.react.spec.tsx` /
`renderCount.vue.spec.ts`).

## The one commit pipeline (`dom/commit.ts`)

Every committed change flows through a single `apply(input)`. The input is a
producer-agnostic `CommitInput` (`model/commitInput.ts`), and since S1.6a the
tree core's `fromTransaction` (`model/treeInput.ts`) is its ONLY producer:

```
write verb → splice → parse → adopt → TransactionResult
  → fromTransaction (memo.invalidate → memo.roots → changes + delta)
  → CommitInput {tokens, render, changes, delta}
  ├─ text path (render === false AND no structural apply pending):
  │    refresh the listed handles, conditionally patch textContent of
  │    changed text surfaces, one batch → fire changed()
  └─ structural (render === true, or folded into a pending pass):
       publish renderTree (new reference) → renderer runs → onRendered() →
       bind(container, latest): one DOM+tree walk —
         create/refresh/kill TokenHandles, set element bindings,
         apply contentEditable/tabindex to NEWLY BOUND surfaces and mark roots
       → fire changed()
```

- **Routing is decided by the PRODUCER**, on `result.render` — not on
  `result.structural`. The latter is add/remove only, while a mark whose value or
  meta changed renders new framework props and must reach the renderer.
- **The change feed is the MEMO's**, not the transaction's: a change entry exists
  to hand a handle the generation the DOM now shows, so the set that needs one is
  exactly the tokens of this snapshot that are new objects. `updated` is the only
  PATCH signal — a node re-materialized merely because it moved has no surface
  write to make.
- **Escalation self-heals:** a text-path apply that cannot resolve a target
  (missing handle, missing surface) abandons the branch before any mutation and
  re-binds the current DOM structurally — no render needed first; the adapter's
  later `onRendered()` re-binds idempotently.
- **`pendingStructural` latch:** between a structural apply and its bind the node
  layer is one generation stale. `handle(id)` returns `undefined` while latched
  (`pending()` is true) — id-bridged reads and mutations fail closed instead of
  acting on a tree the DOM never showed. Applies landing inside the window fold
  into the pending structural pass.
- **bind projects `latest` (the latest committed tree), not `renderTree`:** the
  render tree keeps its (stale) reference across text applies, and a re-render
  arriving after one — any unrelated adapter update — must re-bind the fresh
  tokens, not regress the node layer and the DOM text to the pre-edit
  generation. `latest` is reassigned at the top of every `apply`.
- **Editable state:** contentEditable/tabindex are applied at bind time to newly
  bound surfaces and mark roots, and by the scoped `setEditable` setter when
  `readOnly`/`isUserSelecting` change (SelectionController owns the policy, the
  model owns the application). No per-commit sweep.
- **`changed`** fires in both branches only after the DOM is consistent with the
  node layer — the model-level "commit done" signal (SelectionController
  re-places the caret on it) — carrying that commit's `{added, removed, updated}`
  ids (`TokenDelta`: `added`/`removed` are subtree-inclusive, `updated` is per
  node). Consumers re-read content via `current()` / `handle(id)`;
  `BlockController` prunes its id-keyed store off `delta.removed`. During a
  latched window only the final commit announces, and its payload MERGES every
  folded apply's delta — keeping only the last one dropped the earlier removals
  when two structural applies landed before one bind.

## Structural DOM walk (`dom/bind.ts`)

The structural branch's endpoint: zip the freshly rendered DOM with the committed
tree (one iterative frame per nesting level, control elements skipped, optional
registered child-sequence host per mark) and project the result onto the node
map — `new TokenHandle` for new ids, `refresh` + `bindElements` for known ids,
`kill` (and delete) ids absent from the tree. The whole projection commits as one
batch, so handle watchers flush only after every node reflects the new tree and
DOM.

The result is `bound: ReadonlyMap<number, TokenHandle>`, **keyed by stable id**.
It was keyed by a `TokenPath` string until S1.8; no consumer ever looked one up
by key — `assertAligned`, `setEditable` and `DomModel.boundHandles` all iterate
the values — so the path string was the last thing keeping a path abstraction
alive inside the pipeline. Child-sequence hosts register under the owning mark's
id for the same reason: an id does not go stale when a sibling above the owner is
added or removed mid-render.

A DOM-walk bail (adapter mid-render misalignment) `unbind`s instead of killing:
the tree is authoritative, only the DOM is transiently misaligned, and the next
successful bind re-attaches the same handles. Bind fails loud (throws) only on a
tree token with no id — a contract violation (an unsnapshotted tree was passed).

**Block layout:** each immediate container child is a row; a row must contain
exactly one non-control element. Alignment is all-or-nothing — one bad row bails
the whole frame, failing loud when an adapter renders something unexpected.

## Public API — the whole surface (`model/TokenModel.ts`)

```ts
// consumer reads
current() // readonly Token[] — the always-fresh committed tree
value: Computed<string> // THE value read: controlled → props, uncontrolled → the projection
nodes() / find(id) // the live TreeNode reads (spec §2.3)

// writes
replace(range, replacement) // the internal offset shim (spec D8)
// per-node writes are MarkNode.update / MarkNode.remove, which ride a transaction

// renderer contract (adapter-only)
renderTree: Computed<Token[]> // structural tree; reference change ⇔ renderer must run
changed: Event<TokenDelta>    // THE model-level detector; fires after the DOM is consistent
keyOf(token): number          // framework key (stable id); adapters pass it unbound

// per-token live view
handle(id) / handleOf(token) // id-keyed live handle, or undefined; latch-gated
handleAt(node) // handle | 'control' | undefined for a DOM node

// DOM↔model facade
boundaryFor(node, offset, affinity?) // DOM (node, offset) → absolute position
placeCaret(rawPosition: number) // place a collapsed caret at an absolute position
selectRange(start, end)
selection(): SelectionSnapshot | undefined // THE selection read
selectedContent(): {html; text} | undefined // selection serialized for clipboard

// adapter refs
control() / children(ownerId) // ref callbacks
```

`setEditable({editable, readOnly})` is the scoped internal setter wired from
SelectionController's prop watches; it is not part of the consumer-facing reading
surface above.

Nothing is published before a container mounts: `current()` is `[]` and facade
reads fail soft. Adapters mount the container ref, re-render from the first
structural commit, and report `onRendered()`.

### The selection snapshot

`selection()` returns one `SelectionSnapshot` of the live window selection, or
`undefined` when there is no range (unfocused / nothing selected). It subsumes
the old per-field micro-reads:

```ts
type SelectionSnapshot = {
    raw: RawSelection | undefined // absolute in-editor range, undefined if outside any bound token
    rect: DOMRect | undefined
    anchor: SelectionAnchor // {node, offset, isCollapsed}
    focusNode: Node | undefined
    intersects(node: Node): boolean // partial containment counts
}
```

A consumer that treats "no selection" as collapsed compares
`selection()?.anchor.isCollapsed !== false`.

### The fresh read

`current()` is the always-fresh committed tree — consistent with `value()` on
both commit branches (it is the pipeline's `latest`, reassigned every apply).
`renderTree` is the RENDERER signal: it keeps its reference across text-path
commits so subscribed adapters skip re-rendering — adapter-only, not consumer
data. `handle(id)` maps a token id to its live handle, failing closed while a
structural apply awaits its bind.

### Boundary facade internals

The model builds a `BoundaryContext` per call that reads the node layer:
`locate` walks a DOM node up to its bound handle, `tokenOf(view)` returns the
view's fresh current token (or `undefined` mid-window — the liveness gate),
`viewOf(token)` is the id-bridged element read. A `TokenView` carries the live
token (`handle.token()`), so DOM→token resolution is a single read with no
path-and-identity round-trip.

- `dom/domBoundary.ts` — DOM `(node, offset)` → absolute position
  (`rawPositionFromBoundary`, `textTargetAt`, `markBoundaryAt`). Vocabulary:
  `'before'`/`'after'` = affinity at token boundaries; `'start'`/`'end'` =
  placement side.
- `dom/caret.ts` — stateless `Range`/`Selection` mechanics (`placeAtTextOffset`,
  `placeAtChildBoundary`, `placeRangeAcrossSurfaces`, `setAtX`, `getCaretIndex`,
  `getRect`, `isOnFirstLine`, `isOnLastLine`, `focusIfNeeded`).
- `dom/textOffsets.ts` — `TreeWalker`-based text measurement (`textLength`,
  `textOffsetWithin`, `hasEditableAncestorBefore`).

## `TokenHandle` — the read latch

The read / measurement / command surface of the DOM binding, resolved by
`handle(token.id)`.

`#token` is deliberately NOT "the current parsed token" — it is the generation
the DOM is currently SHOWING (spec D9). Only two writers exist, `bind` and the
text branch, and the text branch patches the surface in the same `batch`; between
a structural apply and its bind nothing writes it at all. That is what makes
every DOM-boundary read correct during the pending window: the DOM boundary layer
resolves offsets as `token.position.start + local`, and a handle answering with
the LIVE tree node would resolve carets against a layout the adapter has not
painted yet.

No per-node reactivity **on the handle**: its getters are plain field reads. That
is not a statement about the model — `TreeNode`'s content fields ARE signals, and
they are what the public API subscribes to.

### Reads

- `id` — the stable identity integer (the key `handle(id)` resolves by).
- `token()` — the BIND-GENERATION `Token` (see above).
- `alive()` — live AND bound (not killed and holding a DOM element). The whole
  validity check a holder of the handle needs.
- `element()` — the token root `HTMLElement`, or `undefined` when unbound/dead.
- `node()` — the `ElementBindings` record
  (`tokenElement`/`textElement`/`rowElement`/`childSequenceHost`).

There is no per-node `dirty` signal, and no event surface: a handle does not
emit `text`/`moved`/`unmounted`. Consumers detect change through the model's
`changed` event and re-read.

### Measurement (over the bound elements, row scope in block layout)

`hasTextSurface()`, `textLength()`, `caretIndex()`, `rect()`,
`caretOnFirstLine()` / `caretOnLastLine()` — inert defaults when unbound.

### Commands

All return `false` when unbound or dead: `placeCaret(offset)` (`Infinity` → end;
on a mark without a text surface any `offset > 0` collapses to the end child
boundary), `placeCaretAtX(x, y?)`, `focus()`.

### Lifetime

Created when its token enters the tree (keyed by the token's stable identity id),
mutated in place by `refresh` / `bindElements` / `unbind`, killed when the token
disappears. A dead handle never throws — stale reads return the last token,
commands return `false`, and it is never resurrected.

## Mark commands

The write verbs live on the NODE, not on a controller: `MarkNode.update(patch)`
and `MarkNode.remove()` (`tree/types.ts`, implemented in `tree.ts` against the
`MarkCommands` port). Both ride a transaction (spec D5) — `serializeMark`
renders the patch to markup and `applyStructural` splices it — and both answer
`false` in read-only mode or off the tree, which is the same fail-closed answer a
dead node gives.

`MarkPatch` has no discriminator: an absent (or `undefined`) field is left alone,
`null` CLEARS it, and a string sets it. Omitted keys are defaulted off the node
itself, so a patch that names only `value` round-trips the current `meta` and the
current slot text.

The adapter hook resolves the node by id per access, so it tracks text-path
commits without re-capture, and the `pendingStructural` latch is what makes a
mid-window write fail closed rather than act on a tree the DOM never showed.

## Caret placement by handle

`TokenModel.placeCaret(rawPosition)` resolves the best target for an absolute
position; per-token placement is `TokenHandle.placeCaret(offset)`, and
`SelectionController.placeAtHandle(handle, boundary)` places at a handle's
start/end. The handle paths fail closed against a dead or mid-window handle
(`!handle.alive()` → `false`). The handle carries the stable id, so no
path-and-token round-trip is involved.

## Parse

Inline and block parse are always a full parse. The boundary parses the whole
spliced projection (block mode then filters empty text tokens) and hands the
result to adoption. The only incrementality is adoption's prefix/suffix retention
above; the windowed `incrementalParse` was deleted. Full-parse cost is tracked by
the `parser.bench.ts` tripwire.

## Divergence detector (the only flag)

`VERIFY_DOM = import.meta.env?.DEV ?? true` (`dom/commit.ts`) — dev/test builds
assert after both branches that every bound text surface's `textContent` equals
its token's `content`, throwing
`TokenModel divergence at #<id>: DOM "…" ≠ model "…"`. Through the public API the
machinery self-heals before each check (bind sweeps every bound surface, the text
branch writes its own targets), so the throw cases are covered white-box — the
detector guards the case where the healing itself missed a write. Production
bundles strip it.

## Benchmarking

### Running Benchmarks

```bash
# Run benchmarks (results saved to parser.bench.result.json in Node mode)
pnpm run bench

# Watch mode for development
pnpm -w exec vitest bench --project core
```

**Note:** Benchmarks measure full-parse performance — the windowed incremental
parse no longer exists, so the only tripwire is the cost of a full parse.
Results are persisted to `parser.bench.result.json` when run in Node;
browser-mode runs (Chromium) skip JSON persistence (see caveat below).

### Benchmark Results Format

Results are stored as an array of run entries in `parser.bench.result.json`. Each
entry captures one benchmark run:

```json
{
    "timestamp": "2026-06-12T02:50:00.000Z",
    "trends": {
        "changeFromLast": "-19.9%",
        "regressions": []
    },
    "summary": {
        "totalTests": 10,
        "performance": 290823
    },
    "tests": {
        "10 marks": {
            "category": "scalability",
            "performance": [161023, 161023, 161023],
            "changeFromLast": "+16.6%"
        }
    }
}
```

Each test's `performance` array is `[min, avg, max]` operations per second.
`changeFromLast` tracks percent change since the previous run. Regressions are
flagged when a test degrades >5%.

#### Test Categories

**scalability** — mark count scaling (10, 50, 100, 500 marks)
**realWorld** — realistic scenarios (social media posts, markdown-like text, code comments)
**incremental** — repeated reparse of an edited document (tail/middle insert on 500-mark documents); now full-parse, kept as a tripwire.

#### History & Regression Detection

The file stores the last runs. Regressions (slowdown >5% from the previous run)
are listed in `trends.regressions`.

#### Browser-Mode Caveat

Benchmarks run in two contexts: Node (persists JSON) and Chromium (prints console
summary only). Node runs are the source of truth; browser runs skip file I/O.
