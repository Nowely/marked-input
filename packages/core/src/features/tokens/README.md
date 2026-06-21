# Tokens

The single home for the token layer, exposed as `store.tokens`. One source of
truth — an id-keyed map of live token nodes (`TokenHandle`) — feeds one commit
pipeline with two branches: text edits patch the DOM in place without invoking
the framework renderer; structural edits publish a new tree and bind the freshly
painted DOM. No feature flags; parse is always a full parse, and the structural
branch always does a full DOM bind.

**Encapsulation rule:** raw `Selection`, `Range`, and `TreeWalker` DOM APIs live
only inside this module (`features/tokens/`). All consumers outside the module
go through `store.tokens` methods or `TokenHandle`.

## The live node — `TokenHandle` (`model/TokenHandle.ts`)

One live record per token, keyed by its stable identity id. The record IS the
public handle (`TokenHandle`): it owns the CURRENT parsed token, the tree path,
and the DOM bindings (`tokenElement` / `textElement` / `rowElement` /
`childSequenceHost`). There is no separate "LiveNode" entity — the live node is
this class.

No per-node reactivity: the getters (`token()` / `path()` / `alive()` /
`element()`) are plain field reads, not signals. Zero production consumers
subscribe to a handle's getters, so signals would be pure overhead (reversible —
the getters stay methods, so per-node signals could return behind them
additively). A consumer holding a render-tree token resolves `handle(token.id)`
and reads `handle.token()` for current content and positions; the handle's
existence IS the validity check.

Lifetime: created when its token enters the tree (keyed by the token's stable
identity id), mutated in place by `update` / `bindElements` / `unbind`, killed
when the token disappears. A dead handle never throws — stale reads return the
last token, commands return `false`, and it is never resurrected.

Derived lookups are maintained by the pipeline, never rebuilt per keystroke:
`nodes` (the id-keyed map itself), `byPath` (rebuilt only at bind — paths are
unchanged on the text path by definition), `byElement` (WeakMap, set at bind).

## The one commit pipeline (`model/commit.ts`)

Every reconciled value change flows through a single `apply(reconcileResult)`:

```
value edit → full parse → reconcile (identity carry + routing decided here)
  ├─ text path (result.structural === false AND no structural apply pending):
  │    update the listed nodes in place (token, path),
  │    conditionally patch textContent of changed text surfaces,
  │    one batch → fire changed()
  └─ structural (result.structural === true, or folded into a pending pass):
       publish renderTree (new reference) → renderer runs → onRendered() →
       bind(container, latest): one DOM+tree walk —
         create/update/kill TokenHandles, set element bindings,
         apply contentEditable/tabindex to NEWLY BOUND surfaces and mark roots
       → fire changed()
```

- **Routing is decided at reconcile time**, not at commit time. The text branch
  is taken iff `result.structural` is false AND no structural apply is pending
  (the fold guard). `result.structural` is set when a token was added or
  removed, or a mark refused its deep-descend (mark components render
  `value`/`meta` as framework props, so the renderer must run). See the descend
  rules below.
- **Escalation self-heals:** a text-path apply that cannot resolve a target
  (missing handle, missing surface) abandons the branch before any mutation and
  re-binds the current DOM structurally — no render needed first; the adapter's
  later `onRendered()` re-binds idempotently.
- **`pendingStructural` latch:** between a structural apply and its bind the node
  layer is one generation stale. `handle(id)` (and everything id-bridged through
  it: `MarkController` mutations) returns `undefined`
  while latched (`pending()` is true) — mutations fail closed instead of acting
  on a tree the DOM never showed. Applies landing inside the window fold into
  the pending structural pass.
- **bind projects `latest` (the latest RECONCILED tree), not `renderTree`:** the
  render tree keeps its (stale) reference across text applies, and a re-render
  arriving after one — any unrelated adapter update — must re-bind the fresh
  tokens, not regress the node layer and the DOM text to the pre-edit
  generation. `latest` is reassigned at the top of every `apply`.
- **Editable state:** contentEditable/tabindex are applied at bind time to newly
  bound surfaces and mark roots, and by the scoped `setEditable` setter when
  `readOnly`/`isUserSelecting` change (SelectionController owns the policy, the
  model owns the application). No per-commit sweep.
- **`changed()`** fires (payloadless) in both branches only after the DOM is
  consistent with the node layer — the model-level "commit done" signal
  (SelectionController re-places the caret on it). Consumers re-read via
  `current()` / `handle(id)`; removed ids come from the separate `removedIds()`
  accessor. During a latched window only the final commit announces.

## Structural DOM walk (`model/bind.ts`)

The structural branch's endpoint: zip the freshly rendered DOM with the
reconciled tree (one iterative frame per nesting level, control elements
skipped, optional registered child-sequence host per mark) and project the
result onto the node map — `new TokenHandle` for new ids, `update`+`bindElements`
for known ids, `kill` (and delete) ids absent from the tree. The whole
projection commits as one batch, so handle watchers flush only after every node
reflects the new tree and DOM.

A DOM-walk bail (adapter mid-render misalignment) `unbind`s instead of killing:
the tree is authoritative, only the DOM is transiently misaligned, and the next
successful bind re-attaches the same handles. Bind fails loud (throws) only on a
tree token with no id — a contract violation (an unreconciled tree was passed).

**Block layout:** each immediate container child is a row; a row must contain
exactly one non-control element. Alignment is all-or-nothing — one bad row bails
the whole frame, failing loud when an adapter renders something unexpected.

## Public API — the whole surface (`model/TokenModel.ts`)

```ts
// consumer read
current() // readonly Token[] — the always-fresh reconciled tree

// renderer contract (adapter-only)
renderTree: Computed<Token[]> // structural tree; reference change ⇔ renderer must run
changed: Event<void>          // THE model-level detector; payloadless, fires after the DOM is consistent
removedIds(): readonly number[] // ids removed (subtree included) by the last commit — the prune feed
keyOf(token): number          // framework key (stable id); adapters pass it unbound

// per-token live view
handle(id) // id-keyed live handle, or undefined; latch-gated
handleAt(node) // handle | 'control' | undefined for a DOM node

// DOM↔model facade
boundaryFor(node, offset, affinity?) // DOM (node, offset) → absolute position
placeCaret(rawPosition: number) // place a collapsed caret at an absolute position
selectRange(start, end)
selection(): SelectionSnapshot | undefined // THE selection read
selectedContent(): {html; text} | undefined // selection serialized for clipboard

// adapter refs
control(ownerPath?) / children(ownerPath) // ref callbacks
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

`current()` is the always-fresh reconciled tree — consistent with
`value.current()` on both commit branches (it is the pipeline's `latest`,
reassigned every apply). `renderTree` is the RENDERER signal: it keeps its
reference across text-path commits so subscribed adapters skip re-rendering —
adapter-only, not consumer data. `handle(id)` maps a token id to its live handle,
failing closed while a structural apply awaits its bind.

### Boundary facade internals

The model builds a `BoundaryContext` per call that reads the node layer:
`locate` walks a DOM node up to its bound handle, `tokenOf(view)` returns the
view's fresh current token (or `undefined` mid-window — the liveness gate),
`viewOf(token)` is the id-bridged element read. A `TokenView` carries the live
token (`handle.token()`), so DOM→token resolution is a single read with no
path-and-identity round-trip.

- `boundary.ts` — DOM `(node, offset)` → absolute position
  (`rawPositionFromBoundary`, `textTargetAt`, `markBoundaryAt`). Vocabulary:
  `'before'`/`'after'` = affinity at token boundaries; `'start'`/`'end'` =
  placement side.
- `caret.ts` — stateless `Range`/`Selection` mechanics (`placeAtTextOffset`,
  `placeAtChildBoundary`, `placeRangeAcrossSurfaces`, `setAtX`, `getCaretIndex`,
  `getRect`, `isOnFirstLine`, `isOnLastLine`, `focusIfNeeded`).
- `textOffsets.ts` — `TreeWalker`-based text measurement (`textLength`,
  `textOffsetWithin`, `hasEditableAncestorBefore`).

## `TokenHandle` — the handle face

The read / measurement / command surface of the live record described above,
resolved by `handle(token.id)`.

### Reads

- `id` — the stable identity integer (the key `handle(id)` resolves by).
- `token()` — the current parsed `Token` (fresh content and positions).
- `path()` — the handle's current tree position (a fresh copy each read).
- `alive()` — live AND bound (not killed and holding a DOM element). The whole
  validity check a holder of the handle needs.
- `element()` — the token root `HTMLElement`, or `undefined` when unbound/dead.

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

## Mark commands (`MarkController`)

`MarkController.fromToken(store, token)` (the adapter hook) is ID-BACKED: it
holds a stable token id plus the render-tree token it was built from, used only
as a read fallback. `value` / `meta` / `slot` / `readOnly` prefer the LIVE handle
(`store.tokens.handle(id)`, re-resolved per access), so they track text-path
commits and the controller's own updates after re-bind without re-capture.
During the latch-gated mid-window (hit on every render before the freshly
painted DOM binds) the live read serves `undefined`, so reads fall back to the
construction-time token the adapter just handed in — the rendered mark shows its
value immediately instead of flashing empty.

`update` / `remove` resolve the LIVE handle only; against a pending (mid-window)
or dead handle, or in read-only mode, they are a fail-closed no-op returning
`false`. A controller built before a structural commit that KILLS its handle does
not auto-bridge — it fails closed, and the adapter re-derives the controller from
the fresh token (each render rebuilds it from the new token object), bridging
by the inherited id to the new live handle.

## Caret placement by handle

`TokenModel.placeCaret(rawPosition)` resolves the best target for an absolute
position; per-token placement is `TokenHandle.placeCaret(offset)`, and
`SelectionController.placeAtHandle(handle, boundary)` places at a handle's
start/end. The handle paths fail closed against a dead or mid-window handle
(`!handle.alive()` → `false`). The handle carries the stable id, so no
path-and-token round-trip is involved.

## Parse and identity

### Identity tracker (`tokenIdentity.ts`)

`createIdentityTracker()` maps each `Token` object to a stable integer id via a
plain `id` field stamped directly on the token. `reconcile(next, hint?)` matches the new parse against the previous
tree and returns a `ReconcileResult`:

```ts
type ReconcileResult = {
    tokens: Token[] // the reconciled tree (ids stamped, prev objects reused)
    structural: boolean // the renderer must run (add/remove, or a refused mark descend)
    changes: TokenChangeEntry[] // every changed token, in tree order — the commit branch reads these
    removedIds: number[] // ids gone from the tree (subtree included) — the prune feed
}

type TokenChangeEntry = {
    id: number
    token: Token
    path: TokenPath
    kind: 'text' | 'update' | 'add'
}
```

The matching layer is the only incrementality — parse itself is always full.

- **Prefix reuse** — top-level tokens byte-identical (full subtree, positions
  included) and entirely before the edit window are returned `===` the previous
  object (no `changes` entry).
- **Suffix id-carry** — tokens after the window identical modulo a uniform
  position shift inherit the previous id (descendants recursively) onto the new
  object and are reported as `kind: 'update'`; zero-shift suffixes are reused by
  reference like the prefix.
- **Middle pairing** — same-slot tokens with the same type (and descriptor for
  marks) inherit the old id and are reported as `kind: 'text'`; everything
  unpaired is `kind: 'add'` (+ `structural`) or lands in `removedIds`. Same-slot
  inheritance is best-effort continuity, not semantics — output correctness is
  guarded by the equivalence properties (`tokenIdentity.property.spec.ts`).

`idOf(token)` allocates on first sight (intended for live-tree tokens; probing
foreign tokens permanently allocates); `idFor(token)` is the read-only peek the
model uses for foreign-token-safe bridging.

When no hint is provided the tracker derives one from the values via `findGap`;
the reconcile produces a structural pass (`result.structural === true`, all
`kind: 'add'`) only on the very first reconcile (no previous tree).

### `TokenChangeEntry` kinds

`kind: 'text'` carries text-token surface changes — and a mark whose descend was
refused (the inherited id, kept for handle continuity; the entry also sets
`structural`). `kind: 'update'` holds position-only shifts (descendants
recursively) and deep-descended container marks. `kind: 'add'` is a token new to
the tree (forces `structural`); the discarded counterparts are in `removedIds`.

### Deep reconcile — descend rules

When the middle pairing pairs two marks (same tree slot, same descriptor), it
attempts a deep descend (`tryDescend`) before settling for mark-level `text`;
nested mark pairs inside a descended slot recurse the same check. ALL of the
following must hold:

1. **Same descriptor** — reference equality (descriptors are interned per parser
   instance).
2. **Rendered props byte-unchanged** — `value` and `meta` strictly equal. Mark
   components receive exactly these as framework props, so equal props ⇒ the
   renderer has nothing new to paint for the mark itself.
3. **Both carry a slot** — the descend operates on the slot interior. Once 1+2
   hold, the bytes outside the slot are necessarily equal (the parser captures all
   outside-slot variation as `value`/`meta`), so this is a parser invariant rather
   than an inline check.
4. **Children pair 1:1** — same count, and nested mark pairs keep their
   descriptor. Equal child count already implies an equal type sequence
   (TreeBuilder emits a strict `text,(mark,text)*` alternation), so no per-child
   type check is needed.

The reconcile-equivalence property spec is the regression net for the conditions
3–4 parser invariants.

On descend the children are paired inside the slot window with the same
prefix/suffix/middle logic as the top level — the window is derived from the slot
contents themselves, independent of how sloppy the outer edit window was.
Zero-shift matches reuse the previous OBJECT and produce no `changes` entry;
shifted matches inherit their ids as `kind: 'update'` (descendants included);
middle pairs recurse the descend for nested marks and report `kind: 'text'` for
text children. The mark itself inherits its id and enters `changes` as
`kind: 'update'` ALONE — its children report their own changes. Condition 4
guarantees a descend never contributes an `add`/removal, so an edit fully
absorbed by descends routes the text path.

The descended mark sits in the renderer-irrelevant `update` kind even when its
content changed; the handle layer stays honest because the pipeline refreshes
every bound `update` node with `update(token, path)` (a never-bound id is
skipped; its handle materializes on the next bind). The `kind` describes what the
renderer must do; the handle refresh describes what happened to the token.

**Refused descend** (any condition fails): the mark keeps the conservative
mark-level `text` entry WITH the inherited id, and the reconcile sets
`structural`. Reclassifying refused descends as `removed`+`add` would break
handle identity continuity for value-edited marks (`MarkController.update` flows
pin same-id inheritance), so the structural-escalation route stays.

**Block-typing consequence:** every row of a slot-leading block markup
(`'__slot__\n\n'`) is a mark, so without deep reconcile each keystroke in a row
would be a mark-level `text` → structural → re-render. With descend the keystroke
emits child `text` + mark `update` → text path → the row's slot surface is
patched with ZERO component re-renders — gated end-to-end by the block
render-count specs (`packages/storybook/src/pages/renderCount.react.spec.tsx` /
`renderCount.vue.spec.ts`).

### Edit-hint flow

`EditController.replace` → `ValueModel.replace(range, replacement)` records a
consume-once `{start, end, insertedLength}` hint. The model's reparse watch
drains it per wave and hands it to the tracker; when no hint is present,
`reconcile` reconstructs the previous and next values from the token contents
(top-level tokens partition the value) and derives the window via `findGap`.

**Controlled-mode limitation (precision, not correctness):** a parent driving
`props.value` without a local `replace` can leave a stale hint behind; that
degrades reconcile precision only — parse output is never affected.

### Parse

Inline and block parse are always a full parse. `TokenModel.#reparse` parses the
whole value (block mode then filters empty text tokens) and hands the result to
`reconcile`. The only incrementality is the reconcile/identity-carry layer above;
the windowed `incrementalParse` was deleted. Full-parse cost is tracked by the
`parser.bench.ts` tripwire.

## Divergence detector (the only flag)

`VERIFY_DOM = import.meta.env?.DEV ?? true` (`model/commit.ts`) — dev/test builds
assert after both branches that every bound text surface's `textContent` equals
its token's `content`, throwing
`TokenModel divergence at [path]: DOM "…" ≠ model "…"`. Through the public API the
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
