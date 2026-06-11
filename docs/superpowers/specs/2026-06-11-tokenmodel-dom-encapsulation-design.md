# TokenModel DOM Encapsulation — Design Spec

**Date:** 2026-06-11
**Status:** Approved design, pending implementation plan
**Inspirations:** Vue Vapor mode (signal-driven DOM patching, no reconciliation pass), TanStack Table v9 beta (headless core, live row/cell objects, fine-grained change detectors)

## Goal

Encapsulate all DOM-manipulation complexity behind an easy API on `TokenModel`, then evolve the engine behind that API to fine-grained, signal-driven DOM ownership: pure text edits patch the DOM directly without involving the framework renderer.

## Problem

DOM complexity currently leaks across the core:

- **Reverse lookup** (DOM node → token position) is hand-rolled in `SelectionController.rawPositionFromBoundary` — a large switch over node types, container/row/mark containment.
- **Caret mechanics** (TreeWalker text traversal, Range/Selection plumbing) are duplicated across `features/selection/caretDom.ts` and `features/selection/textOffsets.ts`, and re-invoked from `blockEdit.ts`.
- **No fine-grained detection**: every render triggers a full index rebuild (`TokenModel.#commit`) plus a full `reconcileTextSurfaces` sweep, and every keystroke runs the whole pipeline: contentEditable mutation → value update → full reparse → React re-render → full re-index → reconcile sweep → caret restore.
- Consumers receive raw `TokenNode` objects (`tokenElement`, `textElement`, `rowElement`) and poke at elements directly.

## Decisions (made during brainstorming)

1. **Scope:** fine-grained DOM ownership (Vapor-style), reached in stages behind a stable facade.
2. **DOM boundary:** balanced — frameworks (React et al.) remain renderers for Marks and custom spans; TokenModel directly manipulates text surfaces and indexed structure. Breaking changes are acceptable; no compatibility shims.
3. **Typing hot path:** bypass React for pure text changes. React renders only on structural change.
4. **Token identity:** parser-threaded — the parser reuses token objects outside the edit range and emits stable ids (incremental parsing).
5. **API shape:** hybrid — live `TokenHandle` objects for reactive paths plus flat facade methods for one-shot queries.
6. **Sequencing (Approach A):** facade first on the current engine, then swap the engine underneath.

## Architecture

Hard rule: **raw DOM APIs (Range, Selection, TreeWalker, textContent writes) are legal only inside `features/tokens`.** Everything else speaks addresses, offsets, and handles.

```
┌─────────────────────────────────────────────────────┐
│ Consumers: selection, keyboard, overlay, clipboard,  │
│ block — zero raw DOM                                 │
├─────────────────────────────────────────────────────┤
│ TokenModel (the engine)                              │
│  • Facade: one-shot queries (tokenAt, boundaryFor…)  │
│  • TokenHandle: live per-token objects w/ detectors  │
│  • Caret mechanics (absorbed caretDom/textOffsets)   │
│  • Index + fine-grained DOM patching (Phase 3)       │
├─────────────────────────────────────────────────────┤
│ Parser (Phase 2: incremental, identity-preserving)   │
├─────────────────────────────────────────────────────┤
│ Renderers (React adapter, future others)             │
│  • Mount container, render Marks + custom spans      │
│  • Signal rendered(); receive "re-render needed"     │
│    only on structural change (Phase 3)               │
└─────────────────────────────────────────────────────┘
```

Ownership shifts:

- `features/selection/caretDom.ts` and `features/selection/textOffsets.ts` move into `features/tokens` as internal pure helpers, not importable by consumers.
- `SelectionController.rawPositionFromBoundary` moves into TokenModel as `boundaryFor(node, offset)`. SelectionController keeps selection *policy* (semantics, focus, events); TokenModel owns *mechanics*.
- `reconcileTextSurfaces` dissolves into per-handle patching (Phase 3); its responsibilities (textContent, contentEditable, tabindex) stay inside tokens.
- React adapter keeps rendering Marks and custom spans; in the end state it does not re-render on pure text edits.

## API surface (ships in Phase 1)

### TokenHandle

Returned by lookups; stable per token. In Phase 1 handles are keyed by token path (a handle at the same path survives re-commits; identity across structural shifts is best-effort). From Phase 2 they are keyed by parser-assigned token id and survive shifts.

```ts
interface TokenHandle {
	// Reactive getters
	readonly token: Computed<Token>
	readonly address: Computed<TokenAddress>             // shifts reactively
	readonly element: Computed<HTMLElement | undefined>  // undefined before mount
	readonly text: Computed<string>

	// One-shot measurements
	textLength(): number
	caretRect(offset: number): DOMRect | undefined

	// Commands — the only way to place a caret
	placeCaret(offset: number): void
	placeCaretAtBoundary(side: 'before' | 'after'): void
	focus(): void

	// Fine-grained detector (Phase 1: fires on any commit touching this
	// token; Phase 3: precise)
	readonly changed: Event<TokenChange>
}

type TokenChange =
	| {kind: 'text', previous: string}
	| {kind: 'moved', previousAddress: TokenAddress}
	| {kind: 'mounted'}
	| {kind: 'unmounted'}
```

### Facade (flat methods on TokenModel)

```ts
// Lookups → handles
handleFor(address: TokenAddress): TokenHandle | undefined   // replaces nodeFor()
handleAt(node: Node): TokenHandle | 'control' | undefined   // replaces locate()
tokenAt(position: number): TokenHandle | undefined          // replaces findTextTargetAt
handles(): IterableIterator<TokenHandle>                    // replaces nodes()

// DOM reality → model coordinates
boundaryFor(node: Node, offset: number): RawPosition | undefined  // absorbs rawPositionFromBoundary
caretFromPoint(x: number, y: number): RawPosition | undefined     // absorbs setAtX read side

// Model coordinates → DOM action
placeCaret(position: number | {address: TokenAddress, offset: number}): void
selectRange(start: number, end: number): void
```

### Removals

- `TokenNode` leaves the public surface; `handle.element()` is the sole escape hatch (overlay positioning).
- `locate` / `nodeFor` / `nodes` are deleted in the same phase — one API, no dual surface.
- Consumer migration is mechanical and lands one consumer per commit with behavior parity: SelectionController drops its boundary parsing; `blockEdit.ts` replaces `findActiveBlock` + `caretDom.setAtElement` with `tokenAt(...).placeCaret(...)`; `TriggerFinder` uses `boundaryFor`.

## Engine evolution

### Phase 2 — parser-threaded identity

- Signature: `parse(value, previous?: {tree, editRange})`.
- Every token gets a stable internal `id`.
- Untouched **prefix**: previous token objects returned `===`-identical. **Suffix**: same ids, shifted positions (absolute positions prevent full referential reuse).
- Output: tree + **changeset** `{textChanged, added, removed, shifted}` by id. Handles are keyed by id.
- Guard: if the edit range cannot be confidently bounded (mass paste, markup option change), fall back to full parse with changeset `full`. Correctness never depends on incrementality.

### Phase 3 — fine-grained commit

```
value edit → incremental parse → changeset
  ├─ text-only → TokenModel patches affected surfaces' textContent
  │    directly, updates index entries in place, fires per-handle
  │    changed events. React is never invoked. Caret untouched —
  │    the browser already has it right.
  └─ added/removed/moved → request renderer re-render (host-level
       event the adapter subscribes to), then re-bind: buildIndex
       scoped to affected rows where possible, full rebuild fallback.
```

- contentEditable/tabindex applied on handle mount and on `editable`/`readOnly` prop change — not swept every render.

## Error handling

- Keep the all-or-nothing bail in `buildIndex` and the commit re-entry guard (fail loud).
- **Dev-mode divergence detector:** after every commit, assert each text surface's `textContent` equals its token's text; mismatch throws with the token address. Model–DOM drift is the catastrophic failure mode of bypassing React.
- If a text-only patch finds its target surface missing from the index, escalate to the structural path instead of silently dropping the edit.

## Testing

- **Phase 1:** parity specs — for a corpus of DOM fixtures, facade results must equal the old hand-rolled functions' results; only then is the old code deleted. Handle behavior specs alongside `TokenModel.index.spec.ts`.
- **Phase 2:** property-style spec — for randomized edits, `parse(value, previous)` deep-equals `parse(value)`; identity specs (prefix `===`, suffix id-stable). Extend `parser.bench.ts` with an incremental-typing benchmark.
- **Phase 3:** commit-path specs asserting renderer invocation count (text edit → 0 renders, structure edit → 1); divergence detector active in all tests.

## Phasing summary

| Phase | Delivers | Risk contained by |
|---|---|---|
| 1 | Hybrid API (handles + facade) on current engine; all consumers migrated; caretDom/textOffsets absorbed | Parity specs before deleting old code |
| 2 | Incremental parser with stable ids and changesets | Full-parse equivalence property; fallback to full parse |
| 3 | Fine-grained patching; React bypassed on text path | Divergence detector; escalation to structural path |

Each phase ships green independently; phases 2–3 are invisible to consumers behind the Phase 1 facade.
