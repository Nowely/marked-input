# S1 Tree Core — Subsystem Design Spec

**Version:** 1.0
**Status:** Draft
**Date:** 2026-08-08
**Parent Spec:** none — the system-level decision was made in dialog (2026-08-08);
this spec is self-contained. Subsystem code S1 starts the project's spec scheme.

---

## 1. Overview

Markput's core currently treats the **string** as the source of truth: every
edit produces a new string, the whole string is re-parsed, and a diff/identity
layer (`tokenIdentity` + the consume-once edit hint in `ValueModel`)
reconstructs *which tokens changed* — knowledge the edit site had and threw
away. The hint machinery, suffix-shift reconcile, and per-keystroke full parse
are all compensation for that destruction.

This spec inverts the architecture: the **token tree** becomes the source of
truth. Edits are born local (a DOM `beforeinput` lands inside a text node that
already has a token handle), mutate the owning node's fine-grained signal,
and trigger re-tokenization of a minimal window only. The string becomes a
computed projection (`join(tree)`) needed only at the `props.value`/`onChange`
boundary. Identity becomes primary: token nodes persist; ids are never
re-derived by diffing on the edit path.

### 1.1 Goals

- **G1.** Kill the reconstruction layer on the edit path: no stored edit hint,
  no `takePendingEdit`, no per-edit tree diff, no suffix position shifting.
- **G2.** A plain keystroke inside a text token costs O(window) — one signal
  write plus a window re-tokenization check — not O(document) parse + diff.
- **G3.** Token identity survives every local edit by construction (nodes
  persist), not by best-effort diff matching.
- **G4.** Selection is anchored to nodes (`{node, localOffset}`); the global
  numeric range is derived. Caret survives edits without arithmetic.
- **G5.** Transactions (tree ops) are explicit, atomic, and invertible in
  principle — the substrate for a future undo/redo.
- **G6.** Public API is preserved: `props.value`/`onChange` string contract,
  `Token[]` shapes for consumers, mark component rendering, adapters untouched.

### 1.2 Non-Goals

- Undo/redo implementation (only the op-invertibility groundwork).
- Collaborative editing / OT / CRDT.
- First-class block rows (phase7 direction) — block mode keeps its current
  whole-value semantics through the compatibility shim.
- Parser algorithm changes — `Parser` stays as-is; it is invoked over windows.
- Incremental parse *inside* the parser (the window layer sits above it).

## 2. Architecture

### 2.1 Component Diagram

```mermaid
flowchart TD
    subgraph input [Edit Sources]
        DOM[DOM beforeinput\nnode + local offset]
        API[Programmatic API\nmark.update / overlay / clipboard]
        SHIM[Global-range shim\nEditController.replace]
    end

    subgraph core [S1 Tree Core]
        TX[Transactions\napplyText / applyStructural]
        TREE[TokenTree\npersistent nodes, fine-grained signals\nlengths stored, offsets derived]
        WIN[Window Re-tokenizer\nserialize window → Parser → splice\nfallback ladder to full parse]
        PROJ[Projections\nvalue = join(tree)\nToken snapshot facade]
    end

    subgraph boundary [String Boundary]
        CTRL[Controlled merge\necho detection / external reset]
        ONCHANGE[onChange value projection]
    end

    subgraph view [View Layer]
        PIPE[Commit pipeline / LiveNodes]
        SEL[Selection\nnode anchor, derived Range]
    end

    DOM --> TX
    API --> TX
    SHIM -->|prefix sums| TX
    TX --> TREE
    TX --> WIN
    WIN -->|splice| TREE
    TREE --> PROJ
    PROJ --> ONCHANGE
    CTRL -->|full parse + replace| TREE
    TREE --> PIPE
    TREE --> SEL
```

### 2.2 Key Design Decisions

**D1 — Tree is the source of truth; the string is a projection.**
`value` becomes `Computed<string>` = concatenation of node contents. It exists
only for the `props.value`/`onChange` boundary and the global-range shim.
*Tradeoff:* controlled mode needs explicit echo detection (D6); serialization
must be exact (`annotate` round-trip is already the pinned contract of
`toString`/`annotate`).

**D2 — Identity is primary, never reconstructed.**
Nodes persist across edits; a node's id is assigned once. Diff-based identity
matching (`tokenIdentity.reconcile`) survives **only** at the external boundary
(parent rewrote `props.value`), where the information genuinely doesn't exist.
The consume-once hint (`ValueModel.#pendingEdit`/`takePendingEdit`) is deleted —
not moved, deleted: the problem it solved no longer exists.
*Tradeoff:* boundary resets lose fine identity continuity unless boundary
reconcile is kept (it is, as an optional continuity pass).

**D3 — Positions are derived, not stored.**
Nodes store their own `length` (a computed over content); global offsets are
prefix sums computed on demand (linear walk in v1; a Fenwick index is a drop-in
if a hot path is proven — AGENTS.md requires a benchmark first). The entire
suffix-shift machinery class disappears: nothing right of an edit changes state.
*Tradeoff:* global-offset queries are O(n) in v1. Acceptable: input fields are
small; the tripwire bench (parser.bench.ts) extends to cover this.

**D4 — Window re-tokenization with a correctness ladder.**
After a local text mutation, re-parse a minimal serialized window and splice.
The ladder, ported from the deleted `incrementalParse` (git `8685bc69^`, whose
header documents the found rakes):
1. Window = edited node, widened by one token per side, endpoints snapped
   outward to TEXT nodes (the top-level stream strictly alternates
   text/mark/…/text, so text endpoints splice into a valid stream).
2. **Inert-outside guard:** segment pairing is non-local — a closing segment
   pairs with the nearest unmatched open arbitrarily far outside any bounded
   window. Conservative rule: if any text content outside the window contains
   any markup segment, fall back to full parse of the projection.
3. **Stabilization (doubling check):** re-parse a window widened by its own
   width; if the spliced result differs, adopt the doubled window and retry
   (bounded, then full parse). A window grown to the whole document IS the
   full parse.
Gate: a property spec asserting `windowed ≡ full parse` for any document and
any single edit (the deleted `incrementalParse.property.spec.ts` is the
template). Correctness never depends on incrementality.
*Why it pays now when it didn't before:* the old incrementalParse fed the same
downstream diff/identity layer, so it saved parse time only. Here the window
result **is** the change — no downstream diff exists — and the common case
(keystroke inside a text token, window parses to one text token) is a pure
signal write with zero structural work.

**D5 — All mutations flow through transactions.**
`applyText(node, localRange, text)` and structural splices are the only write
paths. A transaction runs atomically in one signal batch: tree mutation +
window check + selection update. DOM input resolves to node-local ops via the
existing handle layer (`handleAt`); the string-range API
(`EditController.replace(range, text)`) survives as a shim that resolves global
offsets to nodes via prefix sums — external callers (`blockEdit`, overlay,
clipboard) do not change in this rewrite.
*Tradeoff:* multi-node selections deleted in one input produce multi-node
transactions; the transaction layer must compose ops.

**D6 — Controlled mode lives at the boundary only.**
Uncontrolled: transactions commit synchronously. Controlled: the transaction
computes the next projection, fires `onChange(next)`, and holds as a pending
transaction; when `props.value` arrives, `=== next` confirms and commits it
verbatim; anything else is an **external reset**: full parse, tree replacement
(with optional boundary reconcile for id continuity). Echo detection is by
projection equality — no hint crosses the async gap.
*Tradeoff:* a parent that transforms every input degrades to reset-per-keystroke;
that parent pattern is already degraded today (full parse + fallback diff).

**D7 — Selection anchors to nodes.**
`{node, localOffset}` is the stored form — the same shape the DOM selection
API uses, and the same shape `placeAtHandle`/`#preferredHandle` already
approximate. The global `Range {start, end}` becomes a derived view (prefix
sums). Caret survives edits with no re-derivation: an edit left of the anchor
in the same node adjusts one local offset; edits in other nodes don't touch it.

**D8 — Migration behind a snapshot facade.**
`tokens.current(): Token[]` and every public read keep their current shapes via
a projection that materializes plain `Token` snapshots (with absolute
positions) from the tree. Adapters, renderers, and the existing spec suite run
unchanged against the facade throughout the migration; cutover happens
per-consumer, and the facade itself is the regression net.

## 3. User Stories

**US-1: Typing stays local.** As a user typing inside plain text, my keystroke
must not re-parse or re-render unrelated tokens.
- AC-1.1: a character insert inside a text node that stays a single text token
  after the window check performs no structural change, no diff, and updates
  exactly one content signal.
- AC-1.2: mark components in the document do not re-render on such an edit
  (observable via the existing render-count storybook specs).

**US-2: Markup boundaries still form.** As a user, when my edit creates or
breaks a markup construct (typing the closing `]` of `@[x]`), the tree updates
exactly as a full parse of the whole value would dictate.
- AC-2.1: property spec `windowed ≡ full` holds for arbitrary documents and
  single edits (generated via faker as in the deleted spec).
- AC-2.2: constructs whose opening lies far outside the window (non-local
  pairing) are handled by the inert-outside guard's full-parse fallback.

**US-3: Identity and caret survive.** As a user editing near marks, existing
mark components keep their state and my caret stays put.
- AC-3.1: an edit inside one text node never changes any other node's id.
- AC-3.2: caret anchored in a node untouched by the transaction keeps both its
  node and local offset.

**US-4: Controlled parents keep working.** As an app developer using
`value`/`onChange`, behavior is unchanged.
- AC-4.1: echo (`props.value` === emitted projection) commits the pending
  transaction with full identity precision.
- AC-4.2: a parent rewriting the value triggers a clean external reset; parse
  output equals a fresh full parse (existing controlled-mode specs stay green).

**US-5: Public API is stable.** As an adapter/consumer, `Token[]` shapes,
handles, and events behave as before.
- AC-5.1: the full existing core + storybook browser suite passes against the
  facade with no test rewritten to accommodate the new core (test changes are
  allowed only for deleted internals' unit specs).

## 4. Detailed Design

### 4.1 TokenTree

Persistent node layer (extends the existing LiveNode direction):

- `TextNode { id, content: Signal<string>, length: Computed<number> }`
- `MarkNode { id, descriptor, value: Signal<string>, meta: Signal<string|undefined>,
  children: Signal<TreeNode[]>, content: Computed<string> /* annotate(...) */,
  length: Computed<number> }`
- `TokenTree { roots: Signal<TreeNode[]>, value: Computed<string> /* join */ }`

Invariants (carried from the parser contract):
- Top-level and slot children keep the strict `text,(mark,text)*` alternation,
  empty texts included — this is what makes window splicing well-defined.
- `content` of a mark is derived (`annotate`), never stored; round-trip
  `parse(join(tree)) ≡ snapshot(tree)` is a property-level invariant.
- Offsets: `offsetOf(node)` computed by walking `roots`/`children` summing
  `length` — O(n) v1, no caching until a benchmark demands it.

### 4.2 Window re-tokenizer

Pure function, no tree mutation:

```
retokenize(window: {texts: string[], marks: Snapshot[]}, parser) →
  | {kind: 'text-only', content: string}      // fast path: one text token
  | {kind: 'splice', tokens: Token[]}          // parsed window to splice
  | {kind: 'full'}                             // fallback: caller full-parses
```

Operates on serialized strings + snapshots — independent of the live tree,
independently property-testable (S1.3 runs parallel to S1.2). Encodes the D4
ladder including the inert-outside scan over the *rest of the projection*.

### 4.3 Transactions

- `applyText(node, localRange, text)`: mutate `content` → run re-tokenizer on
  the window → fast path: done; splice path: adopt parsed tokens into nodes
  (new marks get fresh nodes; the edited text region maps positionally within
  the window — no global diff); full path: boundary-style replace of the
  window's enclosing scope.
- `applyStructural(target, replacement)`: `mark.update`/`remove`, overlay
  annotate — the caller already holds the node; splice directly, then run the
  re-tokenizer over the neighborhood (a replacement can join with adjacent
  text into new constructs).
- Each transaction: one signal batch; records `{inverse}` op descriptor
  (groundwork for undo, unused in v1); updates selection anchors it invalidated
  (nodes removed by a splice re-anchor to the nearest surviving position).

### 4.4 String boundary

- Uncontrolled: transaction commits; `onChange(projection)` fires post-commit.
- Controlled: transaction parks as `pending {ops, expected}`; `props.value`
  arrival: `=== expected` → commit parked ops; else → external reset (full
  parse → tree replace, optional `tokenIdentity` continuity pass), `pending`
  cleared. `defaultValue`, parser change, `isBlock` change are resets too.

### 4.5 Selection

- Stored: `{anchor: {node, offset}, head: {node, offset}} | undefined`.
- Derived: global `Range` via prefix sums (feeds `isAllSelected`, public API).
- DOM sync adapters in `SelectionController` translate DOM ↔ node anchors
  directly (they already resolve DOM nodes to handles via `handleAt`).

### 4.6 What is deleted at cutover

`ValueModel.#pendingEdit` / `takePendingEdit` / `replace` hint recording; the
`(value, parser, isBlock)` reparse watch as the edit path (remains as the reset
path only); per-edit `tokenIdentity.reconcile` including suffix-shift and deep
descend on the edit path (file survives for boundary resets); per-keystroke
full parse.

## 5. Output Contract

Downstream consumers depend on:

- `props.value: string` / `onChange(value: string)` — unchanged semantics.
- `tokens.current(): Token[]` — plain snapshots, absolute positions, exact
  current shapes (`TextToken`/`MarkToken` from `parser/types`).
- Handle layer: `handleOf/handleAt/alive/placeCaret` — unchanged signatures;
  handles now front persistent nodes (stability strictly improves).
- `tokens.changed` event timing: still fires only after DOM is consistent.
- `EditController.replace(range, replacement, caretAt?)` — unchanged signature,
  shim implementation.
- Mark component props (`value`, `meta`, slot content) — unchanged; backed by
  per-node signals (fine-grained updates are an internal improvement).

Internal contracts between phases are listed per-phase in Section 11.

## 6. Error Handling

| Category | Strategy |
| --- | --- |
| Window splice would diverge (guard trip, stabilization exhausted) | Fall back to full parse of the projection — correctness never depends on incrementality (D4). |
| Invalid op (range outside node, dead node) | Transaction rejected, no partial mutation (atomic batch); returns `false` like today's `replace`. |
| Controlled parent diverges from expected | Not an error: external reset path (D6). |
| Tree invariant violation (alternation broken by a splice) | Dev-mode assertion + full-parse self-heal in production; property specs make this unreachable in tests. |
| readOnly | Gated at the transaction entry, before any mutation or `onChange`. |

## 7. Testing Strategy

### 7.1 Unit / Property Tests

- **Equivalence property (the gate for everything):** for arbitrary generated
  documents + markups + single edits: applying the edit through transactions
  yields a tree whose snapshot deep-equals `parser.parse(editedString)`.
  Template: deleted `incrementalParse.property.spec.ts` (git `8685bc69^`).
- Round-trip property: `parse(join(tree)) ≡ snapshot(tree)` after any
  transaction sequence.
- Prefix-sum offsets ≡ stored positions of a fresh parse.
- Selection anchor survival per US-3.
- Existing `tokenIdentity` specs keep guarding the boundary-reset path.

### 7.2 Integration Tests

- Existing core suite (`TokenModel.*.spec`, `MarkController.spec`,
  `BlockController.spec`, controlled-mode specs) runs against the facade —
  this suite is the primary migration regression net (AC-5.1).
- New: transaction → onChange → controlled echo round-trip with a mock parent.

### 7.3 End-to-End Tests

- Storybook browser suites (React + Vue) unchanged: typing, IME-adjacent
  input paths, caret placement, mark interaction, clipboard, block mode.
- Render-count specs assert AC-1.2 (no mark re-render on plain text edits).

## 8. Performance Considerations

- Keystroke fast path: O(window) — target: one signal write + one window parse
  of a few tokens. The bench tripwire in `parser.bench.ts` (kept when
  incrementalParse was deleted) extends with a transaction-path benchmark.
- Prefix sums O(n) per global-offset query in v1; measured before optimizing
  (AGENTS.md: performance claims need a benchmark).
- Projection `join` is computed lazily; controlled mode reads it once per
  transaction; uncontrolled only for `onChange`.

## 9. Future Considerations (out of scope for v1)

- Undo/redo over recorded inverse ops (D5 groundwork).
- First-class block rows: rows become tree scopes — the window re-tokenizer's
  window naturally becomes "the row" (revives phase7 on this substrate).
- Fenwick-tree offset index if benchmarks demand.
- Multi-op transactions (batched programmatic edits, paste-as-ops).

## 10. Dependencies

### 10.1 Packages

None added. Core stays dependency-free (AGENTS.md contract).

### 10.2 External

- Deleted-code archaeology: `git show 8685bc69^:packages/core/src/features/tokens/incrementalParse.ts`
  and its property spec — the ported correctness ladder.

## 11. Implementation Phases

### S1.1: Types & Contracts

**Scope:** `TreeNode`/`TextNode`/`MarkNode`/`TokenTree` types, `TreeOp` /
transaction types, `NodeAnchor` selection types, re-tokenizer result type,
snapshot (`Token[]`) mapping signatures. No behavior.
**Size estimate:** ~3 files, ~250 lines
**Contracts consumed:** `parser/types` (`Token`, `MarkupDescriptor`), signals.
**Contracts exposed:** all of the above — every later phase imports only these.
**Gate:** `pnpm run typecheck && pnpm -w exec vitest run packages/core`
**Verification:** types compile; snapshot mapping signatures round-trip
`Token[]` shapes in a type-level test.
**Review tier:** gate-only
**Dependencies:** None

### S1.2: TokenTree structure & projections

**Scope:** build tree from `Token[]` (parse adoption), `join` projection,
prefix-sum `offsetOf`, splice primitives, alternation invariant checks,
`Token[]` snapshot facade (pure part).
**Size estimate:** ~3 files, ~400 lines
**Contracts consumed:** S1.1 types.
**Contracts exposed:** `TokenTree` construction/read/splice API; round-trip
property `parse(join(tree)) ≡ snapshot(tree)`.
**Gate:** `pnpm -w exec vitest run packages/core/src/features/tokens`
**Verification:** feed existing parser spec fixtures through
build→snapshot→compare; check offsets against parser positions.
**Review tier:** spot-check
**Dependencies:** S1.1

### S1.3: Window re-tokenizer (riskiest first)

**Scope:** pure `retokenize` with the D4 ladder (snap-to-text window,
inert-outside guard, doubling stabilization, full fallback); property spec
`windowed ≡ full` ported from the deleted spec.
**Size estimate:** ~2 files, ~350 lines
**Contracts consumed:** S1.1 types, `Parser`. **Not** S1.2 — operates on
strings + snapshots (parallel-safe).
**Contracts exposed:** `retokenize(window, parser) → TextOnly | Splice | Full`.
**Gate:** `pnpm -w exec vitest run packages/core/src/features/tokens` (property
spec included, high iteration count)
**Verification:** run the property spec with elevated runs locally; review the
guard conditions against the archived incrementalParse header; hand-check the
non-local pairing example (closing segment with far-away open).
**Review tier:** full-review
**Dependencies:** S1.1

### S1.4: Transactions

**Scope:** `applyText`/`applyStructural` composing S1.2 splices with S1.3
results; atomic batching; readOnly gate; inverse-op recording (inert);
selection-anchor repair hooks (interface only, wired in S1.7).
**Size estimate:** ~2 files, ~300 lines
**Contracts consumed:** S1.2 tree API, S1.3 re-tokenizer.
**Contracts exposed:** `Transactions.applyText/applyStructural → boolean`;
equivalence property (transaction ≡ full parse of edited string).
**Gate:** `pnpm -w exec vitest run packages/core/src/features/tokens`
**Verification:** equivalence property green; hand-run: edit that completes a
mark across the window edge, edit that breaks a mark, no-op replace.
**Review tier:** full-review
**Dependencies:** S1.2, S1.3

### S1.5: String boundary (controlled/uncontrolled)

**Scope:** projection-based `onChange`; pending-transaction echo protocol;
external reset path (full parse → tree replace, optional boundary reconcile);
`defaultValue`/parser/isBlock resets.
**Size estimate:** ~2 files, ~250 lines
**Contracts consumed:** S1.2 projections, S1.4 transactions,
`tokenIdentity.reconcile` (boundary only).
**Contracts exposed:** boundary controller API consumed by Store wiring in S1.7.
**Gate:** `pnpm -w exec vitest run packages/core` (controlled-mode specs)
**Verification:** mock controlled parent: echo, transform, reject; verify
identity continuity on echo and clean reset on transform.
**Review tier:** full-review
**Dependencies:** S1.2, S1.4

### S1.6: Facade completion

**Scope:** `tokens.current()`, handles-over-nodes, `changed` timing, mark
component prop feeds from node signals — full public read surface on the tree.
**Size estimate:** ~3 files, ~300 lines
**Contracts consumed:** S1.2 snapshots, S1.4.
**Contracts exposed:** the Section 5 public contract, verified by the existing
suite.
**Gate:** `pnpm -w exec vitest run packages/core`
**Verification:** existing TokenModel/MarkController specs green unmodified.
**Review tier:** spot-check
**Dependencies:** S1.2, S1.4

### S1.7: Input wiring & cutover

**Scope:** `beforeinput` → node-local ops; `EditController.replace` shim
(prefix sums → ops; whole-value replaces — block row split/merge/reorder —
route through the boundary continuity pass so node identity survives, not
through a bare tree replacement); Store wiring; **deletion**: `#pendingEdit`,
`takePendingEdit`, `ValueModel.replace` hint recording, reparse-watch edit
path, per-edit reconcile.
**Size estimate:** ~6 files touched, ~-300/+250 lines
**Contracts consumed:** S1.4, S1.5, S1.6.
**Contracts exposed:** none new — this is the imperative shell.
**Gate:** `pnpm test && pnpm run build && pnpm run typecheck`
**Verification:** storybook browser suites (React + Vue) green; manual smoke:
typing, mark insert via overlay, cut/paste, block mode drag, readOnly.
**Review tier:** full-review
**Dependencies:** S1.4, S1.5, S1.6

### S1.8: Selection anchoring

**Scope:** node-anchored selection state; derived global Range; SelectionController
DOM adapters translate directly to anchors; caret-survival repair on splices
(hooked into S1.4's interface).
**Size estimate:** ~2 files, ~250 lines
**Contracts consumed:** S1.4 anchor-repair interface, S1.6 handles.
**Contracts exposed:** `NodeAnchor` selection API; derived `Range` keeps the
current public shape.
**Gate:** `pnpm test` (incl. storybook caret specs)
**Verification:** caret stays through: typing before/after it, mark creation
next to it, splice removing its node (re-anchor), controlled echo.
**Review tier:** full-review
**Dependencies:** S1.4, S1.6, S1.7

### Phase Dependency Graph

```
S1.1 (Types & Contracts)
 ├── S1.2 (TokenTree structure)
 ├── S1.3 (Window re-tokenizer)     ← parallel with S1.2
 │
 ├── S1.4 (Transactions)            ← S1.2 + S1.3
 │    ├── S1.5 (String boundary)    ← parallel with S1.6
 │    ├── S1.6 (Facade completion)  ← parallel with S1.5
 │    │
 │    └── S1.7 (Input wiring & cutover) ← S1.4, S1.5, S1.6
 │         └── S1.8 (Selection anchoring)

Parallelizable: S1.2 ∥ S1.3 after S1.1; S1.5 ∥ S1.6 after S1.4.
```

## 12. Acceptance Summary

1. Property gate: any single edit through transactions ≡ full parse of the
   edited string (S1.3/S1.4 property specs, high-iteration).
2. Round-trip: `parse(join(tree)) ≡ snapshot(tree)` after any transaction.
3. `takePendingEdit`, `#pendingEdit`, and per-edit reconcile no longer exist
   in the codebase; `tokenIdentity` is referenced only by the boundary reset.
4. Full existing suite (core + storybook React/Vue) green with no behavioral
   test rewritten (AC-5.1).
5. Plain-text keystroke: one content-signal write, zero structural changes,
   zero mark re-renders (render-count spec).
6. Controlled parents: echo commits with identity continuity; transform resets
   cleanly (existing controlled specs green).
7. Full checks green: `pnpm test`, `pnpm run build`, `pnpm run typecheck`,
   `pnpm run lint:check`, `pnpm run format:check`.

## Appendix A — Archaeology

- `git show 8685bc69^:packages/core/src/features/tokens/incrementalParse.ts` —
  the correctness ladder this spec ports (window snapping, inert-outside
  guard, doubling stabilization, full-parse fallback) and its property spec.
- Why it was deleted then but returns now: under string-as-truth it only saved
  parse time and still fed the full diff/identity layer; under tree-as-truth
  the window result *is* the change — the diff layer it fed no longer exists.
- `docs/superpowers/reviews/2026-05-23-core-audit-consolidated.md` — prior
  core audit.
