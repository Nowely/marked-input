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

## Coordinates

Three coordinate vocabularies appear below; their definitions and conversions:

- **`RawPosition`** — `type RawPosition = number`: an absolute character offset in the whole document value string. The same number `rawPositionFromBoundary` returns today.
- **Token offset** — `number`: a character offset *within one token's text*. Converts to a RawPosition by adding the token's `position.start`.
- **`TokenAddress`** — existing type: token path plus its absolute `position` range. `tokenAt(rawPosition)` and `handle.address()` convert between the two directions.

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
	readonly dead: Computed<boolean>  // true once the token is removed (see lifecycle)
}

type TokenChange =
	| {kind: 'text', previous: string}
	| {kind: 'moved', previousAddress: TokenAddress}
	| {kind: 'mounted'}
	| {kind: 'unmounted'}
```

### Facade (flat methods on TokenModel)

```ts
type RawPosition = number  // absolute offset in the document value (see Coordinates)

// Lookups → handles
handleFor(address: TokenAddress): TokenHandle | undefined   // replaces TokenModel.nodeFor()
handleAt(node: Node): TokenHandle | 'control' | undefined   // replaces TokenModel.locate()
tokenAt(position: RawPosition): TokenHandle | undefined     // absorbs SelectionController's private findTextTargetAt helper
handles(): IterableIterator<TokenHandle>                    // replaces TokenModel.nodes()

// DOM reality → model coordinates
boundaryFor(node: Node, offset: number): RawPosition | undefined  // absorbs SelectionController.rawPositionFromBoundary
caretFromPoint(x: number, y: number): RawPosition | undefined     // read half of caretDom.setAtX

// Model coordinates → DOM action
placeCaret(position: RawPosition | {address: TokenAddress, offset: number}): void
selectRange(start: RawPosition, end: RawPosition): void
```

Notes:

- `handleAt` returns the literal `'control'` when the node lives inside a registered control element (overlay, drag handle) — DOM that intentionally has no token, today's `Lookup {kind: 'control'}` case. Callers must distinguish "control UI" from "outside the editor" (`undefined`).
- `caretDom.setAtX` today both computes a position from coordinates and places the caret. It splits: `caretFromPoint(x, y)` is the read half; the write half is the composition `placeCaret(caretFromPoint(x, y))`, which is what `blockEdit.ts` migrates to.

### Handle lifecycle (dead-handle contract)

Consumers (e.g. overlay) hold handles across commits, so removal must be safe:

- When a handle's token is removed, it fires `changed({kind: 'unmounted'})` once and is dropped from the registry.
- After that: `element()` returns `undefined` permanently; `token()`, `address()`, `text()` keep returning the last snapshot (stale reads never throw); commands (`placeCaret`, `focus`) become no-ops; `textLength()`/`caretRect()` return `0`/`undefined`.
- A `dead` flag (`readonly dead: Computed<boolean>`) lets holders react declaratively instead of tracking the event.
- Looking the same address up again after a structural change yields a *new* handle; handles are never resurrected.

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

**Routing rule (the load-bearing decision):** structural = `added` or `removed` non-empty. `textChanged` and `shifted` are both text-path — a pure text edit shifts every suffix token's position, and that must NOT trigger the renderer, or React would render on every keystroke. A `shifted` token keeps its DOM untouched; only its index entry updates and its handle fires `changed({kind: 'moved'})`.

```
value edit → incremental parse → changeset
  ├─ textChanged/shifted only → TokenModel patches affected surfaces'
  │    textContent, updates index entries in place, fires per-handle
  │    changed events. Renderer is never invoked.
  └─ added/removed present → request renderer re-render (renderer
       contract below), then re-bind: buildIndex scoped to affected
       rows where possible, full rebuild fallback.
```

**Conditional patching (caret safety):** writing `textContent` recreates the text node and destroys the caret even when the value is identical. The text path therefore skips any surface whose `textContent` already equals the token's text — typically the edited surface itself, which the browser's contentEditable mutation already updated. This is the same guard `reconcileTextSurfaces` uses today (`textContent !== content` check); it becomes a mandated invariant of the patcher, not an optimization.

**Renderer contract:** the one cross-boundary interface Phase 3 hinges on. Sketch:

```ts
// Host additions
structureInvalidated: Event<void>  // TokenModel → adapter: "token tree shape changed, re-render"
rendered: Event<void>              // adapter → TokenModel: "DOM committed" (exists today)
```

The adapter subscribes to `structureInvalidated`, re-renders its structural tree from `tokens.current()`, and fires `rendered()`; TokenModel then re-binds. On the text path neither event fires.

- contentEditable/tabindex applied on handle mount and on `editable`/`readOnly` prop change — not swept every render.

## Error handling

- Keep the all-or-nothing bail in `buildIndex` and the commit re-entry guard (fail loud).
- **Dev-mode divergence detector:** after every commit, assert each text surface's `textContent` equals its token's text; mismatch throws with the token address. Model–DOM drift is the catastrophic failure mode of bypassing React.
- If a text-only patch finds its target surface missing from the index, escalate to the structural path instead of silently dropping the edit.

## Testing

- **Phase 1:** parity specs — for a corpus of DOM fixtures, facade results must equal the old hand-rolled functions' results; only then is the old code deleted. Handle behavior specs alongside `TokenModel.index.spec.ts`.
- **Phase 2:** property-style spec — for randomized edits, `parse(value, previous)` deep-equals `parse(value)`; identity specs (prefix `===`, suffix id-stable). Extend `parser.bench.ts` with an incremental-typing benchmark.
- **Phase 3:** commit-path specs asserting renderer invocation count (text edit → 0 renders, structure edit → 1); divergence detector active in all tests.

## Non-goals

- **No virtual-DOM-style diffing** — change detection comes from parser identity, never from comparing DOM trees.
- **No new renderer support in this effort** — the renderer contract is designed to admit other frameworks later, but only the React adapter is built/migrated.
- **No IME/composition behavior changes** — composition events keep their current handling; the text path must not regress them, but improving them is out of scope.
- **No public (package-level) API redesign** — this is about the internal core↔consumer↔adapter boundaries; the `marked-input` user-facing API only changes where `TokenNode` leaked through.

## Phasing summary

Phase 1 is the largest and lands as three reviewable sub-phases:

- **1a** — facade + handles built alongside the old API, with parity specs proving equivalence on a DOM-fixture corpus.
- **1b** — consumer migration, one consumer per commit (selection → keyboard → overlay → clipboard → block), behavior parity each.
- **1c** — deletions: `locate`/`nodeFor`/`nodes`, public `TokenNode`, `caretDom.ts`/`textOffsets.ts` exports.

| Phase | Delivers | Done when (gate) | Risk contained by | Size |
|---|---|---|---|---|
| 1a | Handles + facade on current engine | `pnpm test` green incl. new parity corpus | Old code untouched until parity proven | M |
| 1b | All consumers on the new API | `pnpm test` green after each consumer commit; no raw DOM imports outside tokens (lint rule) | One consumer per commit | M |
| 1c | Old surface deleted | Grep-clean: no `TokenNode`/`locate`/`caretDom` references outside tokens | Pure deletion after 1b | S |
| 2 | Incremental parser, stable ids, changesets | Equivalence property green (random edits: incremental ≡ full parse); `parser.bench.ts` shows incremental-typing win | Fallback to full parse | L |
| 3 | Fine-grained patching, renderer bypassed on text path | Render-count spec (text edit → 0, structural → 1); divergence detector green across suite | Detector + escalation to structural path | L |

Each phase ships green independently; phases 2–3 are invisible to consumers behind the Phase 1 facade.
