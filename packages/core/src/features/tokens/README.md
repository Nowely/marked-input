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
an id and nothing else, and the split is what lets the tree move ahead of a DOM
the framework has not repainted yet.

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
  whose `descriptor` matches. Returns a `TransactionResult` carrying the
  resolved `selectionAfter`.
- `gapWindow.ts` — the boundary-reset window: the common prefix/suffix of two
  projections. An empty window pins at the END of the value, because `start`
  of an empty window is not an edit location.
- `transactions.ts` — the write verbs. `applyRange(window, text)` is
  the primitive; `applyAfter(node, text)` and
  `applyStructural(target, replacement)` lower node-local intent into it.
  Nothing here mutates the tree — adoption, inside the sink, is the only
  writer.
- `valueBoundary.ts` — the string boundary: commit policy plus arrival routing.
  Controlled mode emits and waits for the echo it spliced; uncontrolled commits
  straight through. Block mode's parse routes through `parseRows` here — the
  structural separator forms the rows (ADR-0009).
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
string carries no evidence at all. `resolvePairing` (`tree/adopt.ts`) discards the whole
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

**Block-typing consequence:** every block row is a `RowNode` whose content is its
children (ADR-0009), so without in-row adoption each keystroke in a row would be
a whole-row replacement → structural → re-render. With it the keystroke touches
only the row's text child → text path → the surface is patched with ZERO
component re-renders — gated end-to-end by the block render-count specs
(`packages/storybook/src/pages/renderCount.spec.ts`, one file held against both
adapters).

## The one commit pipeline (`dom/commit.ts`)

Every committed change flows through a single `apply(result)`, taking the
`TransactionResult` adoption produced:

```
write verb → splice → parse → adopt → TransactionResult
  │    (adoption writes node.text → the per-surface effects write the DOM)
  → apply(): bind() — one tree walk: create/kill TokenHandles, set element
       bindings, re-arm the text effects, apply the one-host editable topology to
       NEWLY BOUND surfaces and mark roots → fire bound()
     then fire committed()

framework paints → a ref fires → consign(id)(element) → rebind(id): that id's
  share of the same walk → fire bound()
```

- **There is no routing.** `result.render` is not consulted: every commit
  announces and every commit binds. The bit that used to decide, and the epoch
  it bumped, are gone — the price is one whole-tree walk per commit, measured at
  rung L7 in `commitCost.bench.ts` (~1.35× at 100 marks, ~2.5× at 1000 rows) and
  accepted there.
- **A ref binds ONE token, and that is the whole reason mount is linear.** A
  registration used to invalidate a counter the bind read reactively, so every ref
  cost a whole-tree walk: mounting an N-node document measured 2N+2 binds through
  both adapters and 678 ms at 2001 nodes. `rebind(id)` is that id's share of the
  walk; the whole walk stays on the commit clock, where the kill sweep needs it.
- **Bind is a CALL inside `apply`, not a reactive effect.** It runs before
  `committed` fires, so every subscriber sees a DOM that already matches the tree
  and every per-surface effect is re-armed. That order used to be encoded in the
  POSITION of a counter write — a signal the model watched in an effect, flushed
  synchronously on that line — which made moving a line a behaviour change. The
  counter, the effect and the model's last use of `effect` went with it. There is
  no separate mount bind either: a mount always arrives through the props watch,
  which commits, which binds.
- **A control registration binds nothing.** `dom/controlRoots.ts` owns which
  elements sit under a control root and updates in place, because that answer is a
  DOM walk from each control up to the host and touches no token. It used to be
  recomputed inside every bind, which made a block mount quadratic — block layout
  registers up to four controls per ROW.
- **Text is not the pipeline's business.** `bind` arms
  `effect(() => { const t = node.text(); if (el.textContent !== t) el.textContent = t })`
  per bound text surface; the handle owns its disposal. That is the ONE writer of
  a text surface — `bind` itself does not write `textContent`, and no text
  travels through `apply`.
- **The pending window is GONE.** There is no latch and nothing folds: each apply
  is its own commit and its own bind. What survives of the idea is only that the
  framework has not repainted yet, so the registries still hold the previous
  generation's elements and the commit's bind re-projects onto those — it cannot
  invent a layout nobody painted. A node BORN by the commit simply has no handle
  until its own ref fires, which was always the refusal that mattered (ADR-0008).
- **The announcement carries no payload.** There is no ledger and no delta: both
  clocks are bare events, and a consumer that wants to know what moved re-reads
  `nodes()` and `find()`. Deriving a delta cost a module of its own and nothing in
  core read it.
- **bind projects the LIVE tree (`deps.roots()`):** a text commit does not wake
  the renderer, so a re-render arriving afterwards — any unrelated adapter update
  — must bind the current tree, not regress the node layer and the DOM text to
  the painted generation.
- **Editable state:** the CONTAINER is the one editing host, and
  `dom/bind.ts` gives every bound token its place in it, at bind time,
  on newly bound elements only. Text surfaces stay bare (they inherit); a
  value-only mark root is `contenteditable=false`; a SLOT mark leaves its root
  and its slot host bare — a nested editing host would be a `display: contents`
  element, which cannot take focus and gets no `beforeinput` — and freezes only
  the controls hanging off the root→host path. Marks carry no tabindex: Tab leaves
  the field. Controls are frozen where they REGISTER (`control()`), not here,
  because they do not mount on the commit clock. No flags, no per-commit sweep.
- **TWO CLOCKS**, because one event was answering two questions, and neither
  carries a payload. `committed` is the MODEL clock: one pulse per commit, once
  the tree, the projection and the repaired selection are in place. It fires for
  the commits that move NO element — a row reorder and a mark value change both
  leave the id space and the element set untouched — which is exactly what a DOM
  clock cannot see. `bound` is the DOM clock: one pulse per bind, and only the
  caret needs it (`dom/SelectionDriver.ts`), because a caret landing in a node
  BORN by the commit has no handle until bind makes one. Consumers re-read
  content via `nodes()` / `find(id)` / `handle(id)`.
  The `{added, removed, updated}` payload and the ledger that derived it are
  GONE: nothing in core read them once the per-row block store moved to a
  node-keyed `WeakMap`, which was its last reader — and that store is itself
  gone now, replaced by one editor-level `BlockController`. `committed` no longer
  surfaces publicly
  either — `MarkputHandle.changed` was withdrawn with the rest of the v2 verbs.

## Element projection (`dom/bind.ts`)

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
the tree. Child-sequence hosts register under the owning mark's
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
replaceBetween(from, to, text) / setValue(text)
// neither names a caret: the splice's own post-edit anchor answers one, and a caller
// never forms an absolute offset into a string that does not exist yet (ADR-0003)
// per-node writes are MarkNode.update / MarkNode.remove, which ride a transaction

// tree reads, in tree coordinates
valueBetween(from, to) / adjacentMark(anchor, ±1) / step(anchor, ±1)
rowsWithin(anchors) / rowScope(anchors, 'row'|'out'|'up'|'down') // the row selection and its gestures
dropPlacements(nodes, row, edge) / moveRows(nodes, placement)    // what a multi-row drag asks and does

// renderer contract (adapter-only)
consign(id) / children(ownerId) / control() // ref callbacks; a ref IS the bind
committed: Event<void>        // THE model clock; one pulse per commit, DOM or no DOM
bound: Event<void>            // THE DOM clock; one pulse per binding — what the caret needs
// the framework key is `node.id` — there is no keyOf

// per-node live view
handle(id) // id-keyed live handle, or undefined when the id has none yet (ADR-0008)
handleAt(node) // handle | 'control' | undefined for a DOM node

// DOM↔model facade — anchors in both directions; no absolute offsets
anchorFor(node, offset, affinity?)   // DOM (node, offset) → NodeAnchor in the LIVE tree
caretRect(): DOMRect | undefined     // viewport rect of the caret/selection, on demand
selectedContent(): {html; text} | undefined // selection serialized for clipboard

// the selection driver's reads, delegated (the driver itself is private)
domAnchors(): Anchors | undefined    // DOM TRUTH as anchors
focusFirst()

// the tree layer's own coordinate boundary — the ONE place a number may be formed.
// Only this direction is public; its inverse is a private `offsetOf` closure in the
// selection deps, whose one consumer is `tree/selection.ts` (isAllSelected).
anchorAt(offset)
```

**Not here, deliberately** (API-surface cut, 2026-08-21): `placeCaret`,
`selectRange`, `domSelection` and `placeAtHandle` were one-line pass-throughs with no
production caller — the driver and the controllers reach `DomModel` directly, and only
specs went through the model. They live on their owners (`dom/DomModel`,
`dom/SelectionDriver`); specs reach a `DomModel` through `__testing__/mountFixtures`'s
`domModelOf`. `setValueEnteringRoot` folded into `setValue`'s second parameter. The
target for the whole surface is in [the token-born-edit
spec](../../../../../docs/scratch/token-born-edit/spec.md#the-target-surface).

There is no manual editable-state override. `setEditable` used to be one, and had
no caller anywhere: `props.readOnly` owns the container's `contenteditable`
through the driver's `{immediate: true}` watch, so the next readOnly change (and
every re-mount) overwrote whatever it wrote.

Nothing is published before a container mounts: `nodes()` is `[]` and facade
reads fail soft. That ordering is load-bearing rather than incidental — because
the tree seeds inside the container's own ref, no token element can exist before
it, so the container's ref always lands first and every token ref lands after the
mount's own commit has bound.

### The selection snapshot

`DomModel.selection()` returns one `SelectionSnapshot` of the live window selection, or
`undefined` when there is no range (unfocused / nothing selected). One read, not
a set of per-field micro-reads:

```ts
type SelectionSnapshot = {
    range: globalThis.Range // the window selection's OWN first range, not a clone
    focusNode: Node | undefined
}
```

A consumer that treats "no selection" as collapsed compares
`selection()?.range.collapsed !== false`. The caret's viewport rect is not on
the snapshot — `caretRect()` computes it only when asked, so a `selectionchange`
snapshot forces no layout.

The per-member contract — why `nodes` is a subscribable `Computed` field, why
`apply` binds before it announces, exactly when `handle(id)` fails closed — is on
the members themselves in `seam/TokenModel.ts` and `dom/commit.ts`.

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
- `dom/caret.ts` — stateless `Range`/`Selection` mechanics (`collapseTo`,
  `findTextBoundary`, `placeRangeAcrossBoundaries`, `getCaretIndex`, `getRect`,
  `focusEditingHost`).
- `dom/textOffsets.ts` — `TreeWalker`-based text measurement (`textLength`,
  `textOffsetWithin`). The editable-island test the mark arm asks before it
  answers is `shared/checkers`' `inExplicitEditableIsland`, shared verbatim with
  `keyboard/beforeInput.ts`: the two differ only in where they stop.

## `TokenHandle` — the DOM binding

The measurement / command surface of one node's DOM binding, resolved by
`handle(node.id)`.

IT HOLDS NO CONTENT and no generation — only `id` and one `ElementBindings`
record. Content and positions belong to the node, and a second representation of
them here is what the one-tree design forbids. The two reads that could want one
take the live source instead: "is this a mark" is `!textElement` (`bind` gives a
`textElement` to text nodes and to nothing else).

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
emit `text`/`moved`/`unmounted`. Consumers detect change through `committed` —
published as `api.changed` — and re-read.

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

The write verbs live on the NODE, not on a controller (`tree/types.ts`,
implemented in `tree.ts`), and they split by the NATURE of the operation rather
than by node type:

- `NodeCommands` — the STRUCTURAL verbs, on every node: `remove()`,
  `duplicate()`, `insertAfter(text)`, `mergeWith(next)`. A block row can be a
  text node, so a mark-only port could not serve one. The ROW verbs ride the same
  port and are row-only by their addressing: `setDepth(depth)`,
  `turnInto(option, patch)`, `splitAt(anchor)` and `moveTo(placement)`, whose
  `RowPlacement` names a parent ROW and an index among its child rows.
- `MarkCommands` — `update(patch)`, mark-only because `value`/`meta`/`slot` are.

All of them ride a transaction — `serializeMark` (`seam/TokenModel.ts`, beside the
verb wiring) renders a patch to markup,
`applyStructural`/`applyAfter`/`applyRange` splice — and all answer `false` in
read-only mode or off the tree, which is the same fail-closed answer a dead node
gives. Each also OWNS its post-edit caret, applied through one shared rule, with
one deliberate exception: `moveTo` moves none, because a move takes no position
out of the document and the stored anchors still name the same characters — a
re-indent included, since a lead is the ROW's bytes and lives in no text node.

`MarkPatch` has no discriminator: an absent (or `undefined`) field is left alone,
`null` CLEARS it, and a string sets it. Omitted keys are defaulted off the node
itself, so a patch that names only `value` round-trips the current `meta` and the
current slot text.

The adapter hook resolves the node by id per access, so it tracks text-path
commits without re-capture. A node BORN by a commit has no handle until its own
ref fires, and that absence is the whole of the refusal (ADR-0008).

## Selection

Split in two by owner, and owned HERE. There is no `features/selection/` and no
`store.selection`: `TokenModel` constructs both halves, publishes the state as
`tokens.selection` and delegates the driver's two externally-needed reads
(`domAnchors`, `focusFirst`) the same way it delegates `DomModel`'s.

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
  container) and three watches (`tokens.bound`, `readOnly`, and the stored
  anchors themselves). BUILT IN THE CONSTRUCTOR
  BODY, not as a field initializer: its dep bag takes `host` and `bound` as
  VALUES, so an initializer would read a constructor parameter property (`tsc`
  rejects it, TS2729) and `#pipeline` (which answers `undefined` silently from any
  initializer above it). Building it last also puts its `onMounted` after the
  model's own. It watches the STORED anchors, never a number derived from them —
  the measurement behind that is stated at the watch. Its ONE attribute write is
  the editing host itself: the container's `contenteditable`, gated by
  `props.readOnly`. There is no per-surface editable policy left — the topology
  below the host is bind's, applied once at mount.

## Caret placement by handle

`DomModel.placeCaret(anchor)` resolves the anchor's OWN node and lowers onto
`TokenHandle.placeCaret(localOffset)`; `selectRange(anchor, head)` does the same
for both ends and normalizes them in DOM order. The two document edges (`'start'`
/ `'end'`) resolve against the live roots. `SelectionDriver.placeAtHandle(handle,
boundary)` places at a handle's start/end — `focusFirst`'s own lowering, and the
only caller. All of it fails closed against a dead or mid-window handle: a node with no live handle
declines, and the `tokens.bound` re-apply places the caret once the bind
lands. Nothing searches the bound surfaces for a nearest position.

## Parse

Both parses are always a full parse. The boundary parses the whole spliced
projection — `Parser.parseRows` when the document has rows, `Parser.parse` when
`separator` is `null` and it has none —
and hands the result to adoption. There is no windowed re-tokenizer: the only incrementality
is adoption's prefix/suffix retention above. Full-parse cost is tracked by the
`parser.bench.ts` tripwire.

## Divergence: healed, not detected

There is no flag and no check. A dev-only sweep used to walk every bound surface
after each announcement and throw `TokenModel divergence` when one disagreed with
its node. It came out once every commit began binding: `bindElements` disposes
and re-creates the per-surface effect unconditionally, and the re-arm's first run
rewrites the surface — so anything that wrote a bound surface behind the model's
back is corrected by the next commit instead of being reported by it.

Measured before deleting it. In the mounted wiring the heal lands inside `bind`,
ahead of any subscriber that could observe the corruption, so the class the sweep
was written for — a writer that missed on a node the commit never touched — was
already unreachable. What it could still catch was one consumer contract
violation, an element consigned under two ids, which neither adapter can produce:
each Token creates its own element and passes its own `consign(id)` ref. Against
that it cost a whole-tree walk on every commit in dev and in every test.

The heal itself is pinned rather than assumed — `commitPipeline.spec.ts` corrupts
a surface and asserts the next commit repairs it, batched and unbatched, and
`TokenModel.spec.ts` does the same across a container re-attach.

## Refuted simplifications

Deletions and folds that were tried against the suite or measured in worktrees
and refuted. Do not re-propose without new evidence.

- **`handle()`'s pending-structural latch** (removed; ADR-0008). The latch failed
  closed for EVERY id while a structural apply awaited its bind, on the argument
  that the node layer is one generation stale. But a node BORN by that commit has
  no handle at all until `bind` creates one, so the refusal it needed was already
  structural. What the latch added was a refusal for nodes that SURVIVED the
  commit, whose elements are correct in the window — the per-surface effect has
  already written the new text (`commitPipeline.spec.ts`'s fold case). It refused
  precisely the case that worked. A caret placed mid-window against pre-paint
  parent coordinates is a transient the post-bind `tokens.bound` re-apply
  corrects in the same frame, and it cannot steal focus the way it could under
  the N-editing-host topology the latch was designed in. Gate:
  `seam/pendingWindow.spec.ts`.
- ~~**Deleting the `#committed` mirror**~~ — refuted 2026-08-20, then DONE
  2026-08-22, and the sequence is the point. Both refusals were real: folding
  `value` onto the tree in one batch lost the mount clock pulses, and deleting
  the mirror without the batch silently inverted the value-vs-DOM order (a
  subscriber handed the new string over the previous generation's document —
  now pinned by `TokenModel.clocks.spec`'s "a value subscriber sees a DOM that
  already matches"). What neither refusal saw was that the first failure was a
  BUG in our own event primitive: `eventReadOper` consumed a shared dirty flag,
  so a `watch` registered during the batch cancelled delivery for everyone
  queued behind it. Fixing that (`shared/signals/eventDelivery.spec.ts`) made
  the atomic commit work, and the mirror came out with nothing to compensate
  for. **The lesson to carry, not the verdict:** a refutation is evidence about
  the code as it stands, never a permanent no — check whether the obstacle is
  ours to remove.
- **The change feed** (`{added, removed, updated}` ids on `committed`, derived
  by a ledger module). Deleted once the block store moved to a `WeakMap` and
  left it with zero core readers; the spec oracles moved to
  `tree/__testing__/diff.ts`. A future fine-grained render feed may want it
  back — that is a re-add with a consumer, not a revert.
- **Folding `EditController` into `tokens.replaceBetween`.** The seam IS the
  contract: user edits move the caret, programmatic writes are repair-only —
  pinned by selection.spec AC-3.x and the bench L5/L5b ladder. `store.edit` is
  also exported-Store surface.
- **`domBoundary` vs `valueBoundary` "duplication".** None: one is DOM-domain,
  the other string-domain, with zero shared computation.

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
