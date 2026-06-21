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
  │    update textChanged/updated nodes in place (token, positions),
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
  A `textChanged` MARK is a refused descend and escalates structurally (mark
  components render `value`/`meta` as framework props). The type check is a
  RUNTIME branch, not the dev assertion the consolidation spec planned — see
  the descend rules below for the documented deviation.
- **Escalation self-heals:** a text-path apply that cannot resolve a target
  (missing handle, missing surface, id absent from the tree) abandons the
  branch before any mutation and re-binds the current DOM structurally —
  no render needed first; the adapter's later `rendered()` re-binds
  idempotently.
- **`pendingStructural` latch:** between a structural apply and its bind the
  node layer is one generation stale. `handle(id)` (and everything id-bridged
  through it: `MarkController` mutations, handle-form `placeCaret`) returns
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
// consumer read
current() // the always-fresh reconciled tree; at(i) the token at top-level index i

// renderer contract (adapter-only — @markput/core/adapter)
renderTree: Computed<Token[]> // structural tree; reference change ⇔ renderer must run
changed: Event<void> // THE model-level detector; fires after the DOM is consistent

// per-token live views
handle(id) // id-keyed live handle for a token id, or undefined; latch-gated
handleAt(node) // handle | 'control' | undefined for a DOM node
tokenAt(position) // handle of the text token containing position
handles() // iterate all bound handles

// DOM↔model facade
boundaryFor / caretFromPoint / placeCaret / selectRange
readSelection /
    selectedContent /
    selectionRect /
    selectionAnchor /
    isSelectionCollapsed /
    selectionIntersects /
    selectionFocusNode

// adapter refs
control() / children()
```

`setEditable({editable, readOnly})` is the scoped internal setter wired from
SelectionController's prop watches; it is not part of the consumer-facing
reading surface above.

Nothing is published before a container mounts: `tree()` is `[]` and facade
reads fail soft. Adapters mount the container ref, re-render from the first
structural commit, and report `rendered()`.

### The fresh read

`current()` is the always-fresh reconciled tree — consistent with `value.current()`
on both commit branches (it is the pipeline's `latest`, reassigned every apply).
`renderTree` is the RENDERER signal: it keeps its reference across text-path
commits so subscribed adapters skip re-rendering — adapter-only, not consumer data.
Handles (`handle.token()`) carry current content/positions; `handle(id)` maps
a token id to its live handle, failing closed while a structural apply awaits its bind.

### Boundary facade internals

`boundary.ts` owns the view types and reads the node layer through a
`BoundaryContext` the shell builds per call: `locate` walks a DOM node up to
its bound handle, `tokenOf(view)` returns the view's fresh current token (or
`undefined` mid-window — the liveness gate, since `#view` excludes unbound
handles), `viewOf(token)` is the id-bridged element read. `TokenView` carries
the live token (`handle.token()`), so DOM→token resolution is a single read —
the path-and-identity round-trip (`resolveAddress`) was removed in Phase 4.

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

Live, identity-keyed view of one token — the LiveNode's public face. The face
is `{id, token(), path(), alive(), element(), …}`: a consumer holding a
render-tree token resolves `handle(token.id)`, and the handle's `token()`
carries current content and positions — its existence IS the validity check.
Follows its token across structural path shifts (fires `moved`), survives
commits while the token exists, then dies once.

### Reads

- `id` — the stable identity integer (the key `handle(id)` resolves by).
- `token` — the current parsed `Token` (fresh content and positions).
- `path()` — the handle's current tree position; a live read, tracks moves.
- `alive()` — live AND bound (not killed and holding a DOM element). The whole
  validity check a holder of the handle needs.
- `element` — the token root `HTMLElement`, or `undefined` when unbound.
- `text` — shorthand for `token().content`.
- `address` — a derived `{path, token}` snapshot. _Deprecated_ (Phase-5
  deletion target — prefer `path()` + `token()`); no longer the public
  `TokenAddress` type, which was removed in Phase 4.
- `dead` — `true` after `unmounted` fires (the inverse of bound liveness;
  Phase-5 deletion target — prefer `alive()`).

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

## Mark commands (`MarkController`)

The mark command surface (`MarkController.fromToken(store, token)`, the adapter
hook) is HANDLE-BACKED — it holds a `TokenHandle`, not a frozen `{address,
snapshot}` capture. `value` / `meta` / `slot` / `readOnly` are LIVE reads of
the handle's current token, so they track text-path commits (and the
controller's own updates after re-bind) without re-capture: a mid-window or
dead handle reads `value === ''` and `meta` / `slot` `=== undefined`. `update`
and `remove` resolve the live mark first; against a pending (mid-window) or
dead handle, or in read-only mode, they are a fail-closed no-op returning
`false`. SEMVER-MAJOR (Phase 4): a controller captured before a structural
commit that KILLS its handle no longer auto-bridges — it fails closed, and the
adapter re-derives the controller from the fresh token (`useMark`'s `useMemo`
re-runs on the new token object), bridging by the inherited id to the new live
handle. The `TokenAddress` surface this used to ride on was removed in Phase 4.

## Caret placement by handle

`placeCaret` takes a raw position (`number`) or a handle form
(`placeCaret({handle, offset})`); `SelectionController.placeAtHandle(handle,
boundary)` places at a handle's start/end. Both fail closed against a dead or
mid-window handle (`!handle.alive()` → `false`). The path-and-token
`placeAtAddress` / `placeCaret({address})` forms were removed in Phase 4 — the
handle IS the identity, so no `{path, token}` round-trip remains.

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
  new object and are reported in `updated`; zero-shift suffixes are reused by
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
    | {kind: 'delta'; textChanged: number[]; added: number[]; removed: number[]; updated: number[]}
```

`textChanged` carries text-token ids plus marks whose descend was refused (a
refused mark's subtree is dirty, not diffed per child). `updated` holds
position-only shifts (descendants recursively) and deep-descended container
marks. `added`/`removed` include descendant ids recursively.

### Deep reconcile — descend rules

When the middle pairing pairs two marks (same tree slot, same descriptor
candidate), it attempts a deep descend (`tryDescend`) before settling for
mark-level `textChanged`; nested mark pairs inside a descended slot recurse
the same check. ALL four conditions must hold:

1. **Same descriptor** — reference equality (descriptors are interned per
   parser instance).
2. **Rendered props byte-unchanged** — `value` and `meta` strictly equal.
   This is the renderer-correctness argument: mark components receive exactly
   these as framework props, so equal props ⇒ the renderer has nothing new to
   paint for the mark itself.
3. **Only the slot interior changed** — both marks carry a slot, and the raw
   bytes before and after it are equal (compared as `content` slices relative
   to each mark's own start, so a uniformly shifted mark still qualifies).
4. **Children pair 1:1 structurally** — same count, pairwise same type, same
   descriptor for nested mark pairs.

On descend the children are paired inside the slot window with the same
prefix/suffix/middle logic as the top level — the window is derived from the
slot contents themselves, independent of how sloppy the outer edit window
was. Zero-shift matches reuse the previous OBJECT and stay out of every
bucket; shifted matches inherit their ids into `updated` (descendants
included); middle pairs recurse the descend for nested marks and report
`textChanged` for text children. The mark itself inherits its id and enters
`updated` ALONE — its children report their own changes. Condition 4
guarantees a descend never contributes to `added`/`removed`, so an edit fully
absorbed by descends routes the text path.

Bucket honesty vs handle honesty: a descended mark sits in the
renderer-irrelevant `updated` bucket even when its content changed. The
handle layer stays honest — the pipeline refreshes every bound `updated` node
with `update(token, path)` (a never-bound id is skipped; its handle
materializes on the next bind), which fires `changed({kind: 'text'})`
whenever content differs (`moved` for pure position shifts). Buckets describe
what the renderer must do; handle events describe what happened to the token.

**Refused descend** (any condition fails): the mark keeps the conservative
mark-level `textChanged` WITH the inherited id, and the commit pipeline
escalates it at runtime — `commitText` finds a non-text `textChanged` entry,
abandons the branch before any mutation, and self-heals through the
structural branch. DELIBERATE deviation from the consolidation spec's
"`textChanged` ⊆ text tokens by construction; demote routing to a dev
assertion": reclassifying refused descends as `removed`+`added` would break
handle identity continuity for value-edited marks (`MarkController.update`
flows pin same-id inheritance), so the runtime escalation branch stays.

**Block-typing consequence:** every row of a slot-leading block markup
(`'__slot__\n\n'`) is a mark, so before deep reconcile each keystroke in a
row was a mark-level `textChanged` → structural escalation → re-render. With
descend the keystroke emits child `textChanged` + mark `updated` → text path
→ the row's slot surface is patched with ZERO component re-renders — gated
end-to-end by the block render-count specs
(`packages/storybook/src/pages/renderCount.react.spec.tsx` /
`renderCount.vue.spec.ts`). Parse-side cost is unchanged: block markups still
full-parse (see the block-layout caveat below).

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
# Run benchmarks (results saved to parser.bench.result.json in Node mode)
pnpm run bench

# Watch mode for development
pnpm -F core run test:bench:watch
```

**Note:** Benchmarks measure ParserV2 performance. Results are persisted to `parser.bench.result.json` when run in Node; browser-mode runs (Chromium) skip JSON persistence (see caveat below).

### Benchmark Results Format

Results are stored as an array of run entries in `parser.bench.result.json`. Each entry captures one benchmark run:

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

Each test's `performance` array is `[min, avg, max]` operations per second. `changeFromLast` tracks percent change since the previous run. Regressions are flagged when a test degrades >5%.

#### Test Categories

**scalability** — mark count scaling (10, 50, 100, 500 marks)
**realWorld** — realistic scenarios (social media posts, markdown-like text, code comments)
**incremental** — incremental parsing with edit hints (tail insert, middle insert on 500-mark documents)

#### History & Regression Detection

The file stores the last 50 runs. Regressions (slowdown >5% from the previous run) are listed in `trends.regressions`.

#### Browser-Mode Caveat

Benchmarks run in two contexts: Node (persists JSON) and Chromium (prints console summary only). Node runs are the source of truth; browser runs skip file I/O.

### Results history

The file `parser.bench.result.json` stores the last 10 benchmark runs for trend analysis and regression detection.
