# Tokens

The single home for the token layer, exposed as `store.tokens`. The token TREE is
the source of truth and the value string is its projection: a write
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
that imports both. There is no upward edge: `dom/commit.ts` takes the
`TransactionResult` adoption produces, with no intermediate type owned above it.
`index.ts` is the only export point the rest of the package uses.

## Two layers, and the difference matters

|                                      | owns                                                 | reactive?                                         | identity                                |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------------------------- | --------------------------------------- |
| `TreeNode` (`tree/types.ts`)         | the CONTENT — text, value, meta, children, positions | yes: `text`/`value`/`meta`/`children` are signals | `id`, assigned at birth, never reused   |
| `TokenHandle` (`dom/TokenHandle.ts`) | the DOM BINDING — element refs and the text effect   | no — plain field reads                            | the same `id`, keyed in the `nodes` map |

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
  `added`/`removed`/`updated`, the resolved `selectionAfter`, the anchor `map`,
  and the `structural`/`render` bits.
- `gapWindow.ts` — the boundary-reset window: the common prefix/suffix of two
  projections, via `findGap.ts`. An empty window pins at the END of the value,
  because `start` of an empty window is not an edit location.
- `transactions.ts` — the write verbs. `applyRange(window, text)` is
  the primitive; `applyText(node, localRange, text)` and
  `applyStructural(target, replacement)` lower node-local intent into it, and
  `tx(fn)` buffers disjoint ops and adopts once with the hull window. Nothing
  here mutates the tree — adoption, inside the sink, is the only writer.
- `valueBoundary.ts` — the string boundary: commit policy plus arrival routing.
  Controlled mode emits and waits for the echo it spliced; uncontrolled commits
  straight through. Block mode's parse filter (`filterEmptyText`) lives here.
- `__testing__/snapshot.ts` — TEST-ONLY, no production caller:
  `stripIds(snapshot(tree))` deep-equals a fresh parse of the tree's projection.
  That is the output-equivalence ORACLE, and the only check that compares the
  WHOLE tree — structure, POSITIONS, slot text, derived content — against the
  parser rather than against a hand-written expectation. Deliberately
  UNMEMOIZED: a memo inside it would gate adoption against its own cache.
- `anchors.ts` — `anchorAt(roots, offset)` (right affinity: the last text node
  containing the offset), its inverse `offsetOfAnchor`, and `anchorEquals`.
- `selection.ts` — `createSelection(deps)`: the selection STATE (see below).
  DOM-free, and unit-tested without a mounted container. Its dep bag (three
  closures, not the tree) is what lets `TokenModel` satisfy `anchorAt` with the
  SEEDING read rather than the bare tree walk.
- `markPatch.ts` — `serializeMark(node, patch)`: a patch becomes markup, with
  the omitted fields defaulted off the node so an omitted key round-trips.

## Adoption — the descend rules

Pairing is same-index within one sibling list, with ONE exception below. A candidate is
adopted when:

1. both are text, or
2. both are marks AND their `descriptor` is reference-equal (descriptors are
   interned per parser instance).

Anything else is a rebuild: the candidate's ids are collected into `removed` and
a fresh node is built into `added`.

**The exception — a stated `Pairing`.** A commit `Window` may carry
`pairing[j] = previous root index`, and where it resolves it REPLACES all three walks for the
root list. It exists because same-index pairing cannot express a permutation, and no diff can
recover one: moving a row past a byte-identical row leaves the document unchanged, so the
string carries no evidence at all. `resolvePairing` (`tree/adoptUtils.ts`) discards the whole
claim unless it is a total BIJECTION over the roots and every pair is `snapshotNodeEquals`
under its OWN shift — the bijection check is not implied by the range check, and the
counter-example is on the file. A discarded pairing costs nothing: adoption runs exactly as it
does today.

An adopted mark ALWAYS recurses into its children — that recursion is what keeps
in-slot component identity alive across a mark-level value/meta change. There is
no separate descend predicate: the split shows up only in what the mark itself
reports. A mark whose `value` or `meta` changed enters `updated` (its rendered
framework props are new, so the renderer must run); a mark whose children alone
changed does not.

Positions are plain field writes, so a move leaves NO signal trace and reaches
NO feed — nothing in `TransactionResult` reports it and no consumer is woken by
it. What holds the position writes correct is the snapshot ORACLE
(`tree/__testing__/snapshot.ts`), which carries every node's `position`:
`adopt.property.spec.ts` asserts the whole tree against a fresh parse after
every adopt, so a position left stale is a deep-equal mismatch.

**Block-typing consequence:** every row of a slot-leading block markup
(`'__slot__\n\n'`) is a mark, so without in-slot adoption each keystroke in a row
would be a whole-mark replacement → structural → re-render. With it the keystroke
touches only the row's slot text node → text path → the surface is patched with
ZERO component re-renders — gated end-to-end by the block render-count specs
(`packages/storybook/src/pages/renderCount.spec.ts`, one file held against both
adapters).

## The one commit pipeline (`dom/commit.ts`)

Every committed change flows through a single `apply(result)`, taking the
`TransactionResult` adoption produced:

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
         apply the one-host editable topology to NEWLY BOUND surfaces and mark roots
       → fire changed()
```

- **Routing is `result.render`** — not `result.structural`. The latter is
  add/remove only, while a mark whose value or meta changed renders new framework
  props and must reach the renderer.
- **`renderEpoch` is a COUNTER, not the tree.** The adapters read `nodes()` for
  data and each token component subscribes to its own node, so the pipeline
  publishes only "the renderer must run". It is not redundant with
  `roots`, and that is measured: adoption writes `roots` only when the ROOT LIST
  changes by reference, so a mark whose value changed and a structural change
  INSIDE a slot both leave it equal — a container subscribed to `roots` alone
  never re-renders for either, `rendered()` never fires and `bind` never runs.
  Gated by "a mark value change announces changed" in both render-count specs.
- **Text is not the pipeline's business.** `bind` arms
  `effect(() => { const t = node.text(); if (el.textContent !== t) el.textContent = t })`
  per bound text surface; the handle owns its disposal. That is the ONE writer of
  a text surface — `bind` itself does not write `textContent`, and no text
  travels through `apply`.
- **The pending window:** between a structural apply and its bind the node layer
  is one generation stale, so `pipeline.pending()` is true and `handle(id)`
  answers `undefined` — id-bridged reads and mutations fail closed instead of
  acting on a tree the DOM never showed. Applies landing inside the window fold
  into the pending structural pass.
- **bind projects the LIVE tree (`deps.roots()`):** a text commit does not wake
  the renderer, so a re-render arriving afterwards — any unrelated adapter update
  — must bind the current tree, not regress the node layer and the DOM text to
  the painted generation.
- **Editable state:** the CONTAINER is the one editing host, and
  `dom/editableState.ts` gives every bound token its place in it, at bind time,
  on newly bound elements only. Text surfaces stay bare (they inherit); a
  value-only mark root is `contenteditable=false`; a SLOT mark leaves its root
  and its slot host bare — a nested editing host would be a `display: contents`
  element, which cannot take focus and gets no `beforeinput` — and freezes only
  the chrome hanging off the root→host path. Marks carry no tabindex: Tab leaves
  the field. Controls are frozen where they REGISTER (`control()`), not here,
  because they do not mount on the commit clock. No flags, no per-commit sweep.
- **`changed`** fires only after the DOM is consistent with the node layer — the model-level "commit done" signal (`dom/SelectionDriver.ts`
  re-places the caret on it) — carrying that commit's `{added, removed, updated}`
  ids (`TokenDelta`: `added`/`removed` are subtree-inclusive, `updated` is per
  node). Consumers re-read content via `nodes()` / `find(id)` / `handle(id)`;
  `BlockController` prunes its id-keyed store off `delta.removed`. Inside a
  pending window only the final commit announces, and its payload MERGES every
  folded apply's delta, so a consumer pruning off `removed` cannot miss a wave
  when two structural applies land before one bind.

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

The result (`BindResult`) is ELEMENT-keyed only — `byElement` and `controlRoots`,
the two lookups the walk itself produces. There is no id-keyed `bound` map to
return: the id-keyed side is `deps.nodes`, THE live node layer, which bind
mutates in place, and "this walk bound it" is `handle.alive()`, because the walk
unbinds (never removes) a node the DOM missed and deletes only ids absent from
the tree. Its one reader goes to that map — `assertAligned` (`dom/commit.ts`)
reads `deps.nodes` directly. Child-sequence hosts register under the owning mark's
stable id: an id does not go stale when a sibling above the owner is added or
removed mid-render.

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
value: Computed<string> // THE value read: controlled → props, uncontrolled → the last COMMITTED projection
nodes: Computed<readonly TreeNode[]> // the live roots — THE render read too
find(id) // the live TreeNode by stable id
selection: Selection // THE stored anchors and their derivations (see below)

// writes
replaceBetween(from, to, text) / setValue(text) / applyText(node, range, text) / tx(fn)
// per-node writes are MarkNode.update / MarkNode.remove, which ride a transaction

// tree reads, in tree coordinates
valueBetween(from, to) / adjacentMark(anchor, ±1) / step(anchor, ±1)
rootIndexOf(id) / siblingOf(id, ±1)

// renderer contract (adapter-only)
renderEpoch: Computed<number> // bumped ⇔ the renderer must run; NOT data
changed: Event<TokenDelta>    // THE model-level detector; fires after the DOM is consistent
// the framework key is `node.id` — there is no keyOf

// per-node live view
handle(id) // id-keyed live handle, or undefined while `pipeline.pending()` is true
handleAt(node) // handle | 'control' | undefined for a DOM node

// DOM↔model facade — anchors in both directions; no absolute offsets
anchorFor(node, offset, affinity?)   // DOM (node, offset) → NodeAnchor in the LIVE tree
placeCaret(anchor: NodeAnchor)       // collapsed caret, through the anchor's OWN node
selectRange(anchor, head)            // order-insensitive; normalized in DOM order
domSelection(): SelectionSnapshot | undefined // THE raw window-selection read
selectedContent(): {html; text} | undefined // selection serialized for clipboard

// the selection driver's reads, delegated (the driver itself is private)
domAnchors(): Anchors | undefined    // DOM TRUTH as anchors
focusFirst() / placeAtHandle(handle, boundary?)

// the tree layer's own coordinate boundary — the ONE place a number may be formed.
// Only this direction is public; its inverse is the private `#offsetOf`, whose one
// consumer is the selection state in `tree/selection.ts` (isAllSelected).
anchorAt(offset)

// adapter refs
control() / children(ownerId) // ref callbacks
```

`setEditable({editable, readOnly})` is the MANUAL override of the one editing
host: it writes `container.contentEditable` from `editable && !readOnly`, and is
a no-op while unmounted. Nothing in core calls it — `props.readOnly` owns the
same attribute through the driver's `{immediate: true}` watch, so the next
readOnly change (and every re-mount) overwrites whatever it wrote. It is not part
of the consumer-facing reading surface above.

Nothing is published before a container mounts: `nodes()` is `[]` and facade
reads fail soft. Adapters mount the container ref, re-render from the first
structural commit, and report `onRendered()`.

### The selection snapshot

`domSelection()` returns one `SelectionSnapshot` of the live window selection, or
`undefined` when there is no range (unfocused / nothing selected). One read, not
a set of per-field micro-reads:

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

The per-member contract — why `nodes` is a subscribable `Computed` field, why
`renderEpoch` is a counter and not the tree, exactly when `handle(id)` fails
closed — is on the members themselves in `seam/TokenModel.ts` and
`dom/commit.ts`.

### Boundary facade internals

The model builds an `AnchorContext` per call: `locate` walks a DOM node up to its
bound handle and `find(id)` reads the LIVE tree. Nothing in it forms an absolute
offset, which is the point — no module above `tree/` may. The bridge
from DOM to model is the handle's stable ID, which is generation-independent, so
the walk stays correct inside the adopt→bind window where a positional read is
not.

- `dom/domBoundary.ts` — DOM `(node, offset)` → `NodeAnchor`
  (`anchorFromBoundary`). Vocabulary: `'before'`/`'after'`/`'nearest'` =
  affinity at token boundaries; `'start'`/`'end'` = placement side. The first
  two are the RANGED reader's pair and lean a span's two ends INWARD, so a drag
  through a mark swallows the whole mark; `'nearest'` is the COLLAPSED reader's
  and is passed by nothing else — inside a mark it answers the NEAR edge (the
  tie goes to `before`), because a caret has no inside and the click's own
  offset is the only thing that says which edge was meant. Between two tokens
  there is no near edge, and `'nearest'` reads LEFT-affine: `{after: previous}`
  and `{before: next}` are one position, and the left spelling is the one
  `placeCaret` reproduces in ONE write — the right one placed on into the next
  token's surface, and those extra writes clobbered Chromium's drag base.
  There is no numeric twin: this is the only projection of the walk, and every
  branch names its own case in `domBoundary.spec.ts`.
- `dom/caret.ts` — stateless `Range`/`Selection` mechanics (`placeAtTextOffset`,
  `placeAtParentBoundary`, `placeRangeAcrossSurfaces`, `getCaretIndex`,
  `getRect`, `focusEditingHost`).
- `dom/textOffsets.ts` — `TreeWalker`-based text measurement (`textLength`,
  `textOffsetWithin`, `hasEditableAncestorBefore`).

## `TokenHandle` — the DOM binding

The measurement / command surface of one node's DOM binding, resolved by
`handle(node.id)`.

IT HOLDS NO CONTENT and no generation — only `id` and one `ElementBindings`
record. Content and positions belong to the node, and a second representation of
them here is what the one-tree design forbids. The two reads that could want one
take the live source instead: "is this a mark" is `!textElement` (`bind` gives a
`textElement` to text nodes and to nothing else), and the divergence check
compares each surface against the live `TextNode.text()`.

The DOM-side writer is the per-surface TEXT EFFECT `bindElements` arms: one
writer per bound text surface, subscribed to that node's own `text` signal,
writing conditionally (`if (el.textContent !== t)`). Its immediate first run is
the mount-time reconciliation and the corruption heal; it is disposed and
re-armed on every re-bind, and disposed by `unbind`/`kill`. Two writers on one
surface is the failure mode the design exists to prevent, which is why `bind`
does not write `textContent` itself.

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

Three reads, all answering an inert default when the handle is unbound:

- `hasTextSurface()` — whether this token bound a text surface (`false` unbound).
- `textLength()` — the text length of the scope (`0` unbound).
- `caretIndex()` — the caret offset within the scope, `undefined` unbound. Only
  meaningful while the selection is inside that scope; the helper answers `0`
  when there is no selection at all.

No pixel measures: the caret moves between rows natively under the one editing
host, so nothing here reads geometry.

### Commands

All return `false` when unbound or dead: `placeCaret(offset)` (`Infinity` → end;
on a mark without a text surface any `offset > 0` collapses to the end child
boundary), `focus()`.

### Lifetime

Created when its node enters the tree (keyed by the node's stable identity id),
mutated in place by `bindElements` / `unbind`, killed when the node disappears.
Both `unbind` and `kill` dispose the text effect, so an unbound or dead handle
stops writing its old element. A dead handle never throws — reads answer
`undefined`, commands return `false`, and it is never resurrected.

## Mark commands

The write verbs live on the NODE, not on a controller: `MarkNode.update(patch)`
and `MarkNode.remove()` (`tree/types.ts`, implemented in `tree.ts` against the
`MarkCommands` port). Both ride a transaction — `serializeMark`
renders the patch to markup and `applyStructural` splices it — and both answer
`false` in read-only mode or off the tree, which is the same fail-closed answer a
dead node gives.

`MarkPatch` has no discriminator: an absent (or `undefined`) field is left alone,
`null` CLEARS it, and a string sets it. Omitted keys are defaulted off the node
itself, so a patch that names only `value` round-trips the current `meta` and the
current slot text.

The adapter hook resolves the node by id per access, so it tracks text-path
commits without re-capture, and the pending window is what makes a mid-window
write fail closed rather than act on a tree the DOM never showed.

## Selection

Split in two by owner, and owned HERE. There is no `features/selection/` and no
`store.selection`: `TokenModel` constructs both halves, publishes the state as
`tokens.selection` and delegates the driver's three externally-needed reads
(`domAnchors`, `focusFirst`, `placeAtHandle`) the same way it delegates
`DomModel`'s.

There is no construction cycle around it: the string boundary calls
`this.selection.anchors()` / `this.selection.repair(result)` directly, with no
port thunk handed back from `Store` — which is also why no `Store` field needs
an explicit type annotation to keep `tsc` off TS7022.

- `tree/selection.ts` — the STATE. Stores a pair of `NodeAnchor`s, never
  offsets: a node plus a local offset is what disambiguates two tokens sharing a
  boundary position, and it survives an edit elsewhere without arithmetic.
  `isAllSelected` is the ONE derivation that needs numbers, and it lives here
  because `tree/` is where that arithmetic is legal; there is no numeric
  `range`/`position` projection and no generation marker. `repair(result)`
  APPLIES `result.selectionAfter` — adoption resolves it, since only adoption
  sees the pre-mutation coordinate space.
- `dom/SelectionDriver.ts` — the DOM I/O, private to `TokenModel`. Two listeners
  (the document-level `selectionchange` sync, and the `focusout` clear on the
  container) and three watches (`tokens.changed`, `readOnly`, and the stored
  anchors themselves). BUILT IN THE CONSTRUCTOR
  BODY, not as a field initializer: its dep bag takes `host` and `changed` as
  VALUES, so an initializer would read a constructor parameter property (`tsc`
  rejects it, TS2729) and `#pipeline` (which answers `undefined` silently from any
  initializer above it). Building it last also puts its `onMounted` after the
  model's own. It watches the STORED anchors, never a number derived from them —
  the measurement behind that is stated at the watch. Its ONE attribute write is
  the editing host itself: the container's `contenteditable`, gated by
  `props.readOnly`. There is no per-surface editable policy left — the topology
  below the host is bind's, applied once at mount.

## Caret placement by handle

`TokenModel.placeCaret(anchor)` resolves the anchor's OWN node and lowers onto
`TokenHandle.placeCaret(localOffset)`; `selectRange(anchor, head)` does the same
for both ends and normalizes them in DOM order. The two document edges (`'start'`
/ `'end'`) resolve against the live roots. `TokenModel.placeAtHandle(handle,
boundary)` (the driver's, delegated) places at a handle's start/end. All of it
fails closed against a dead or mid-window handle: a node with no live handle
declines, and the `tokens.changed` re-apply places the caret once the bind
lands. Nothing searches the bound surfaces for a nearest position.

## Parse

Inline and block parse are always a full parse. The boundary parses the whole
spliced projection (block mode then filters empty text tokens) and hands the
result to adoption. There is no windowed re-tokenizer: the only incrementality
is adoption's prefix/suffix retention above. Full-parse cost is tracked by the
`parser.bench.ts` tripwire.

## Divergence detector (the only flag)

`VERIFY_DOM` (`dom/commit.ts`) — in dev/test, every `changed` announcement
asserts that each bound text surface's `textContent` equals its node's live
`text()`, throwing `TokenModel divergence at #<id>: DOM "…" ≠ model "…"`. The
flag's fail-closed derivation (what the published bundle ships, and which
consumer bundler decides the value) and the sweep's placement (a `changed`
subscriber, not an inline call and not a per-surface check) are stated in full
at the site — `VERIFY_DOM` and `assertAligned` in `dom/commit.ts`.

## Benchmarking

### Running Benchmarks

```bash
# Run benchmarks (results saved to parser.bench.result.json in Node mode)
pnpm run bench

# Watch mode for development
pnpm -w exec vitest bench --project core
```

**Note:** Benchmarks measure full-parse performance — the only tripwire is the
cost of a full parse.
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
**incremental** — repeated reparse of an edited document (tail/middle insert on 500-mark documents); a full parse like the rest, kept as a tripwire.

#### History & Regression Detection

The file stores the last runs. Regressions (slowdown >5% from the previous run)
are listed in `trends.regressions`.

#### Browser-Mode Caveat

Benchmarks run in two contexts: Node (persists JSON) and Chromium (prints console
summary only). Node runs are the source of truth; browser runs skip file I/O.
