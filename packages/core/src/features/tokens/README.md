# Tokens

The single home for the token layer, exposed as `store.tokens`. The token TREE is
the source of truth and the value string is its projection (spec D1): a write
lowers to a splice in the projection's coordinates, adoption folds the fresh
parse back into the persistent nodes, and one commit pipeline carries the result
to the DOM. It has ONE question — does the renderer need to run? Text never
travels through it: `bind` arms one effect per bound text surface, so a text edit
reaches the DOM straight off the node's own `text` signal, without invoking the
framework renderer. A structural edit publishes a new tree and binds the freshly
painted DOM. No feature flags; parse is always a full parse, and a bind is always
a full DOM bind.

**Encapsulation rule:** raw `Selection`, `Range`, and `TreeWalker` DOM APIs live
only inside this module (`features/tokens/`). All consumers outside the module
go through `store.tokens` methods or `TokenHandle`.

## Layout

| folder    | what lives there                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| `parser/` | string → `Token[]`. Knows nothing about nodes, ids or the DOM.                                                      |
| `tree/`   | the source of truth: nodes, adoption, transactions, the string boundary, anchors, the selection STATE.              |
| `dom/`    | the contenteditable adapter: bind, the commit pipeline, `TokenHandle`, caret and DOM offsets, the selection DRIVER. |
| `seam/`   | `TokenModel` — the one object that owns a tree, a DOM and the selection, and joins them.                            |

`tree/` imports nothing from `dom/` or `seam/`, and `seam/` is the only folder
that imports both. There is no upward edge left: `dom/commit.ts` takes the
`TransactionResult` adoption produces, so the `CommitInput` type `seam/` used to
own for it is gone. `index.ts` is the only export point the rest of the package
uses.

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
- `__testing__/snapshot.ts` — TEST-ONLY since S2.8: `stripIds(snapshot(tree))`
  deep-equals a fresh parse of the tree's projection, which is S1 §7.1's
  output-equivalence ORACLE and the only check that compares the WHOLE tree
  against the parser. It was production (the compat `Token` projection the
  adapters rendered) and its memo went with the adapters' move onto `TreeNode`;
  the oracle is deliberately UNMEMOIZED, because a memo inside it would gate
  adoption against its own cache.
- `anchors.ts` — `anchorAt(roots, offset)` (right affinity: the last text node
  containing the offset), its inverse `offsetOfAnchor`, and `anchorEquals`.
- `selection.ts` — `createSelection(deps)`: the selection STATE (see below).
  DOM-free, and unit-tested without a mounted container. Its dep bag (three
  closures, not the tree) is what lets `TokenModel` satisfy `anchorAt` with the
  SEEDING read rather than the bare tree walk.
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

Every committed change flows through a single `apply(result)`, taking the
`TransactionResult` adoption produced (the `CommitInput` that used to sit between
them carried a snapshot nothing renders any more):

```
write verb → splice → parse → adopt → TransactionResult
  │    (adoption writes node.text → the per-surface effects write the DOM)
  → apply(result): deltaOf(result) folded into the pending delta
  ├─ render === false AND no structural apply pending:
  │    nothing left to do to the DOM → fire changed()
  └─ render === true, or folded into a pending pass:
       bump renderEpoch → renderer runs → onRendered() →
       bind(container, tree.roots()): one DOM+tree walk —
         create/kill TokenHandles, set element bindings, re-arm the text effects,
         apply contentEditable/tabindex to NEWLY BOUND surfaces and mark roots
       → fire changed()
```

- **Routing is `result.render`** — not `result.structural`. The latter is
  add/remove only, while a mark whose value or meta changed renders new framework
  props and must reach the renderer.
- **`renderEpoch` is a COUNTER, not the tree.** The adapters read `nodes()` for
  data and each token component subscribes to its own node (spec D8), so the
  pipeline publishes only "the renderer must run". It is not redundant with
  `roots`, and that is measured: adoption writes `roots` only when the ROOT LIST
  changes by reference, so a mark whose value changed and a structural change
  INSIDE a slot both leave it equal — a container subscribed to `roots` alone
  never re-renders for either, `rendered()` never fires and `bind` never runs.
  Gated by "a mark value change announces changed" in both render-count specs.
- **Text is not the pipeline's business (S2.7).** `bind` arms
  `effect(() => { const t = node.text(); if (el.textContent !== t) el.textContent = t })`
  per bound text surface; the handle owns its disposal. That is the ONE writer of
  a text surface, which is why `bind` no longer writes `textContent` itself and
  why the `changes` feed, `commitText` and the bind-generation `Token` are gone.
- **`pendingStructural` latch:** between a structural apply and its bind the node
  layer is one generation stale. `handle(id)` returns `undefined` while latched
  (`pending()` is true) — id-bridged reads and mutations fail closed instead of
  acting on a tree the DOM never showed. Applies landing inside the window fold
  into the pending structural pass.
- **bind projects the LIVE tree (`deps.roots()`):** a text commit does not wake
  the renderer, so a re-render arriving afterwards — any unrelated adapter update
  — must bind the current tree, not regress the node layer and the DOM text to
  the painted generation.
- **Editable state:** contentEditable/tabindex are applied at bind time to newly
  bound surfaces and mark roots, and by the scoped `setEditable` setter when
  `readOnly`/`isUserSelecting` change (`dom/SelectionDriver.ts` owns the policy,
  the model owns the application). No per-commit sweep.
- **`changed`** fires only after the DOM is consistent with the node layer — the model-level "commit done" signal (`dom/SelectionDriver.ts`
  re-places the caret on it) — carrying that commit's `{added, removed, updated}`
  ids (`TokenDelta`: `added`/`removed` are subtree-inclusive, `updated` is per
  node). Consumers re-read content via `nodes()` / `find(id)` / `handle(id)`;
  `BlockController` prunes its id-keyed store off `delta.removed`. During a
  latched window only the final commit announces, and its payload MERGES every
  folded apply's delta — keeping only the last one dropped the earlier removals
  when two structural applies landed before one bind.

## Structural DOM walk (`dom/bind.ts`)

The renderer's endpoint: zip the freshly rendered DOM with the LIVE tree (one
iterative frame per nesting level, control elements skipped, optional registered
child-sequence host per mark) and project the result onto the node map — `new
TokenHandle` for new ids, `bindElements` for known ids, `kill` (and delete) ids
absent from the tree. The whole projection commits as one batch, so handle
watchers flush only after every node reflects the new tree and DOM.

`bindElements` also re-arms the surface's text effect, unconditionally: the
re-arm's immediate first run is both the mount-time reconciliation of a surface
the renderer left stale and the heal of one corrupted between binds.

The result is `bound: ReadonlyMap<number, TokenHandle>`, **keyed by stable id**.
It was keyed by a `TokenPath` string until S1.8; no consumer ever looked one up
by key — `assertAligned`, `setEditable` and `DomModel.boundHandles` all iterate
the values — so the path string was the last thing keeping a path abstraction
alive inside the pipeline. Child-sequence hosts register under the owning mark's
id for the same reason: an id does not go stale when a sibling above the owner is
added or removed mid-render.

A DOM-walk bail (adapter mid-render misalignment) `unbind`s instead of killing:
the tree is authoritative, only the DOM is transiently misaligned, and the next
successful bind re-attaches the same handles. Alignment is all-or-nothing per
frame — a count mismatch drops that frame AND every descendant frame with it,
because a dropped frame never enqueues its children.

**Block layout:** each immediate container child is a row; a row must contain
exactly one non-control element. Alignment is all-or-nothing — one bad row bails
the whole frame, failing loud when an adapter renders something unexpected.

## Public API — the whole surface (`seam/TokenModel.ts`)

```ts
// consumer reads
value: Computed<string> // THE value read: controlled → props, uncontrolled → the projection
nodes: Computed<readonly TreeNode[]> // the live roots — THE render read too (spec §2.3)
find(id) // the live TreeNode by stable id
selection: Selection // THE stored anchors and their derivations (see below)

// writes
replaceBetween(from, to, text) / setValue(text) / applyText(node, range, text)
// per-node writes are MarkNode.update / MarkNode.remove, which ride a transaction

// renderer contract (adapter-only)
renderEpoch: Computed<number> // bumped ⇔ the renderer must run; NOT data
changed: Event<TokenDelta>    // THE model-level detector; fires after the DOM is consistent
// the framework key is `node.id` — there is no keyOf

// per-node live view
handle(id) // id-keyed live handle, or undefined; latch-gated
handleAt(node) // handle | 'control' | undefined for a DOM node

// DOM↔model facade — anchors in both directions (spec S2 D1); no absolute offsets
anchorFor(node, offset, affinity?)   // DOM (node, offset) → NodeAnchor in the LIVE tree
placeCaret(anchor: NodeAnchor)       // collapsed caret, through the anchor's OWN node
selectRange(anchor, head)            // order-insensitive; normalized in DOM order
domSelection(): SelectionSnapshot | undefined // THE raw window-selection read
selectedContent(): {html; text} | undefined // selection serialized for clipboard

// the selection driver's reads, delegated (the driver itself is private)
domAnchors(): Anchors | undefined    // DOM TRUTH as anchors (spec S2 D5)
focusFirst() / placeAtHandle(handle, boundary?) / isUserSelecting: Signal<boolean>

// the tree layer's own coordinate boundary — the ONE place a number may be formed
anchorAt(offset) / offsetOf(anchor)

// adapter refs
control() / children(ownerId) // ref callbacks
```

`setEditable({editable, readOnly})` is the scoped internal setter wired from
`dom/SelectionDriver.ts`'s prop watches; it is not part of the consumer-facing
reading surface above.

Nothing is published before a container mounts: `nodes()` is `[]` and facade
reads fail soft. Adapters mount the container ref, re-render from the first
structural commit, and report `onRendered()`.

### The selection snapshot

`domSelection()` returns one `SelectionSnapshot` of the live window selection, or
`undefined` when there is no range (unfocused / nothing selected). It subsumes
the old per-field micro-reads:

```ts
type SelectionSnapshot = {
    range: globalThis.Range // the window selection's OWN first range, not a clone
    rect: DOMRect | undefined
    anchor: SelectionAnchor // {node, offset, isCollapsed}
    focusNode: Node | undefined
    intersects(node: Node): boolean // partial containment counts
}
```

A consumer that treats "no selection" as collapsed compares
`domSelection()?.anchor.isCollapsed !== false`.

### The fresh read

`nodes()` is the live root list, consistent with `value()` the moment adoption
lands — and since S2.8 it is what the adapters render. `renderEpoch` is the
RENDERER signal and carries no data: it does not move on a text-path commit, so
subscribed adapters skip re-rendering. `handle(id)` maps a node id to its live
handle, failing closed while a structural apply awaits its bind.

### Boundary facade internals

The model builds an `AnchorContext` per call: `locate` walks a DOM node up to its
bound handle, `roots()` and `find(id)` read the LIVE tree. Nothing in it forms an
absolute offset, which is the point — no module above `tree/` may (spec S2 D1).
The bridge from DOM to model is the
handle's stable ID, which is generation-independent, so the walk stays correct
inside the adopt→bind window where a positional read is not (spec S2 D4).

- `dom/domBoundary.ts` — DOM `(node, offset)` → `NodeAnchor`
  (`anchorFromBoundary`). Vocabulary: `'before'`/`'after'` = affinity at token
  boundaries; `'start'`/`'end'` = placement side. Its numeric twin
  (`rawPositionFromBoundary` and friends) was deleted at S2.6 together with the
  equivalence property that used to gate it; every branch now names its own case
  in `domBoundary.spec.ts`.
- `dom/caret.ts` — stateless `Range`/`Selection` mechanics (`placeAtTextOffset`,
  `placeAtChildBoundary`, `placeRangeAcrossSurfaces`, `setAtX`, `getCaretIndex`,
  `getRect`, `isOnFirstLine`, `isOnLastLine`, `focusIfNeeded`).
- `dom/textOffsets.ts` — `TreeWalker`-based text measurement (`textLength`,
  `textOffsetWithin`, `hasEditableAncestorBefore`).

## `TokenHandle` — the DOM binding

The measurement / command surface of one node's DOM binding, resolved by
`handle(node.id)`.

IT HOLDS NO TOKEN since S2.7. `#token` used to carry "the generation the DOM is
SHOWING" (spec D9) — a second representation of data the tree already owns. S2.6
took its last positional reader; S2.7 took the other two, `setEditable`'s type
read (dead: `bind` gives a `textElement` to text nodes and to nothing else, so
`!textElement` already means "mark") and `commit.ts`'s divergence detector, which
compares against the live `TextNode.text()`.

What replaced it is the per-surface TEXT EFFECT `bindElements` arms: one writer
per bound text surface, subscribed to that node's own `text` signal, writing
conditionally (`if (el.textContent !== t)`). Its immediate first run is the
mount-time reconciliation and the corruption heal; it is disposed and re-armed on
every re-bind, and disposed by `unbind`/`kill`. Two writers on one surface is the
failure mode the design exists to prevent, so `bind` no longer writes
`textContent` itself.

No per-node reactivity **on the handle's getters**: they are plain field reads.
That is not a statement about the model — `TreeNode`'s content fields ARE signals,
and they are what the public API (and the text effect) subscribes to.

### Reads

- `id` — the stable identity integer (the key `handle(id)` resolves by).
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

Created when its node enters the tree (keyed by the node's stable identity id),
mutated in place by `bindElements` / `unbind`, killed when the node disappears.
Both `unbind` and `kill` dispose the text effect, so an unbound or dead handle
stops writing its old element. A dead handle never throws — reads answer
`undefined`, commands return `false`, and it is never resurrected.

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

## Selection

Split in two by owner (spec S2 D10) and OWNED HERE since S2.9. There is no
`features/selection/` and no `store.selection`: `TokenModel` constructs both
halves, publishes the state as `tokens.selection` and delegates the driver's four
externally-needed reads (`domAnchors`, `focusFirst`, `placeAtHandle`,
`isUserSelecting`) the same way it delegates `DomModel`'s.

That closed the last construction cycle in the core. `Store` used to build the
selection and hand this class a two-method `SelectionPort` thunk back so the
string boundary could capture and repair through it; the cycle forced an explicit
type annotation on two `Store` fields to keep `tsc` off TS7022. Both are gone, and
the boundary now calls `this.selection.anchors()` / `this.selection.repair(result)`
directly.

- `tree/selection.ts` — the STATE. Stores a pair of `NodeAnchor`s (spec S1 D7),
  never offsets: a node plus a local offset is what disambiguates two tokens
  sharing a boundary position, and it survives an edit elsewhere without
  arithmetic. `isAllSelected` is the ONE derivation left that needs numbers, and
  it lives here because `tree/` is where that arithmetic is legal; the numeric
  `range`/`position` projections and the `generation` marker they needed went at
  S2.6 (spec S2 D11). `repair(result)` APPLIES
  `result.selectionAfter` — adoption resolves it, since only adoption sees the
  pre-mutation coordinate space.
- `dom/SelectionDriver.ts` — the DOM I/O, private to `TokenModel`. Three
  listeners (`focusin`/`focusout`/`selectionchange` sync, the empty-editor click
  focus, the mouse-sweep tracker) and four watches (`tokens.changed`, `readOnly`,
  `isUserSelecting`, and the stored anchors themselves). BUILT IN THE CONSTRUCTOR
  BODY, not as a field initializer: its dep bag takes `host` and `changed` as
  VALUES, so an initializer would read a constructor parameter property (`tsc`
  rejects it, TS2729) and `#pipeline` (which answers `undefined` silently from any
  initializer above it). The constructor also puts its `onMounted` after the
  model's own, which is the order `Store` produced before S2.9. It watches the STORED anchors — the derived numeric
  `range` it once watched deduped on `shallow`, so at a shared boundary
  `placeAtHandle` changed the anchor without changing the number and the watch
  never fired (measured — 8 browser assertions across three focus specs). It also
  owns the editable POLICY; the model owns the application.

## Caret placement by handle

`TokenModel.placeCaret(anchor)` resolves the anchor's OWN node and lowers onto
`TokenHandle.placeCaret(localOffset)`; `selectRange(anchor, head)` does the same
for both ends and normalizes them in DOM order. The two document edges (`'start'`
/ `'end'`) resolve against the live roots. `TokenModel.placeAtHandle(handle,
boundary)` (the driver's, delegated) places at a handle's start/end. All of it fails closed against a dead
or mid-window handle — where the deleted numeric form searched every bound surface
for a position and fell back to the nearest, reading bind-generation coordinates
for a layout the adapter had not painted.

## Parse

Inline and block parse are always a full parse. The boundary parses the whole
spliced projection (block mode then filters empty text tokens) and hands the
result to adoption. The only incrementality is adoption's prefix/suffix retention
above; the windowed `incrementalParse` was deleted. Full-parse cost is tracked by
the `parser.bench.ts` tripwire.

## Divergence detector (the only flag)

`VERIFY_DOM = import.meta.env?.DEV ?? true` (`dom/commit.ts`) — dev/test builds
assert after both branches that every bound text surface's `textContent` equals
its node's live `text()`, throwing
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
