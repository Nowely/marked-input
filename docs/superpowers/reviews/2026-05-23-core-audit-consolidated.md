# Core Audit — Consolidated and Re-Verified

Date: 2026-05-23
Scope: `packages/core/src/**`, with selected React/Vue integration points
that affect feature behavior.

Sources merged and re-verified against the current `next` branch:

- `2026-04-24-feature-code-audit-consolidated.md` (architectural review of
 `store/Store.ts` and feature modules; flagged contract/orchestration risks)
- `2026-05-14-core-cleanup-audit.md` (dead code, over-engineering, and
 unnecessary complexity across every non-spec `.ts` under
 `packages/core/src/`)

Method: re-read every file referenced by either audit, cross-checked against
exports and consumers across the monorepo, then ran `pnpm test` (972 passed,
2 skipped, 13 todo). Each finding is tagged with one of:

- `open` — issue is still present in the current code.
- `deferred` — real issue, but documented as intentionally out of scope.
- `resolved` — fixed; line counts and line numbers below refer to the
 current files (or note the file was deleted).

No production source code was changed by this audit.

## Status Summary

The intervening months delivered a substantial cleanup:

- The whole `feature/<X>Feature` naming was replaced with
 `Controller`/`Model` pairs (`MarkFeature` → `MarkController`,
 `ValueFeature` → `ValueModel`, `OverlayFeature` → `OverlayController`,
 etc.).
- `EditController` was introduced as a single `replace(range, replacement)`
 entrypoint with batching and gated caret movement, addressing most of the
 April "scattered value mutations" finding.
- `MarkController` replaces the mutating `MarkHandler`. It resolves the
 target token through a stored `TokenAddress` on every call, so a stale
 cached position cannot slice the wrong substring anymore. Spec coverage
 includes the "fails closed when address is stale" case.
- `DomIndexer`'s counter-as-proxy `DomIndex` was collapsed to a boolean
 `isIndexed` signal; `OverlayController` and `BlockController` lost their
 `effectScope` toggle dance in favor of inline guards.
- Several whole modules disappeared (`valueParser.ts`, `mark_types.ts`,
 `createNewSpan.ts`, `clearMarkupPaste`, `createTokenIndex` re-exports,
 `MarkControllerConstructor`, `marksOnly`, `isMarkToken`,
 `DEFAULT_OVERLAY_TRIGGER` and friends).

What remains is a short list of real-but-open issues that are worth a
focused pass, plus a small set of deferred items that have an existing
rationale on file.

## Currently Open

### 1. `createRowContent([])` can crash

- File: `packages/core/src/features/block/createRowContent.ts:5`
- Pattern: unsafe array access.
- What: `const firstOption = options[0]; if (!firstOption.markup) return '\n'`
 throws `TypeError` when `options` is empty because the early return reads
 `.markup` on `undefined`.
- Callers: `BlockController#add` (`block/BlockController.ts:56`) and
 `keyboard/blockEdit.ts:172` (Enter on a text-like row).
- Impact: a block-layout editor with explicit `options={[]}` crashes on
 add-row or Enter.
- Trivial fix:

 ```ts
 const firstOption = options[0]
 if (!firstOption?.markup) return '\n'
 ```

- Risk: safe.

### 2. Block keyboard row lookup bypasses `store.dom`

- File: `packages/core/src/features/keyboard/blockEdit.ts:53, 158, 209,
 243, 281`
- Pattern: DOM inferred from container child order outside `store.dom`.
- What: every block keyboard branch (`handleDelete`, `handleEnter`,
 `handleBlockArrowLeftRight`, `handleArrowUpDown`,
 `handleBlockBeforeInput`) derives the active row by
 `htmlChildren(container).findIndex(div => div === document.activeElement
 || div.contains(document.activeElement))` and then indexes
 `store.tokens.current()` by that position. Row-edge checks also use
 `caretDom.getCaretIndex(blockDiv)` against `blockDiv.textContent.length`.
- Why it matters today: `store.dom` already exposes the typed
 `locateNode(node)` (with reasons `'control'`, `'outsideEditor'`,
 `'notIndexed'`), `pathElementsFor(address)`, and `roleFor(element)`. The
 `DomIndexer` even tracks a `'control'` role explicitly. None of that is
 used here, so focus inside a control, drag handle, custom block chrome,
 or any out-of-shape DOM child is silently treated as row text editing.
- Recommendation: introduce a typed row locator on `store.dom` (or expose
 the row record returned by `locateNode`'s `rowElement`) and route all
 five branches through it. Controls/ambiguous DOM should return a typed
 failure rather than a row index.
- Risk: behavior-change (small) — block keyboard handlers stop firing on
 ambiguous or control-owned focus, which is the intended outcome.

### 3. Container-bound listeners are one-shot

- Files:
 - `packages/core/src/features/keyboard/input.ts:17`
 - `packages/core/src/features/keyboard/blockEdit.ts:21`
 - `packages/core/src/features/keyboard/arrowNav.ts` (same pattern)
 - `packages/core/src/features/clipboard/ClipboardController.ts:17`
 - `packages/core/src/features/selection/SelectionController.ts:87`
- Pattern: features capture `store.dom.container()` once inside
 `lifecycle.onMounted(...)` and bail when it is null.
- What: `store.dom.container` is a signal, so the value can appear late
 or change if `slots.container` swaps the host element. Anything
 captured at the first mount stays bound to the old element (or never
 attaches).
- Recommendation: a shared `listenToContainer(store, setup)` helper that
 watches `dom.container`, disposes previous listeners, and rebinds to
 the current element. Use it from keyboard input/blockEdit/arrowNav,
 clipboard, and the selection focus-handlers.
- Risk: behavior-change (small) — only matters when the container ref
 actually changes after mount.

### 4. Centralized writes are still partial

- New owner: `packages/core/src/features/edit/EditController.ts` —
 `replace(range, replacement)` batches the value write with caret
 placement and is the recommended path for editor-originated edits.
- Current adopters: `keyboard/input.ts` (beforeinput/compositionend/
 delete), `keyboard/blockEdit.ts:184` (Enter on a text-like row),
 `overlay/OverlayController.ts:118` (overlay insert),
 `clipboard/ClipboardController.ts:27` (cut),
 `parsing/MarkController.ts:47, 66` (remove/update).
- Direct writers that bypass `EditController` and call
 `store.value.current(newValue)` plus a manual `selection.position(...)`:
 - `keyboard/input.ts:221` — `replaceAllContentWith`
 - `keyboard/blockEdit.ts:85, 97, 120, 136, 178` — block Backspace/Delete
 merge paths and Enter on non-text-like rows
 - `block/BlockController.ts:48, 60, 69, 78` — drag reorder/add/delete/
 duplicate
- Impact: each direct writer re-implements the caret-after-edit policy
 and skips the `batch(...)` wrapping. Subscribers can observe a
 transient state where `value` and `selection` disagree.
- Recommendation: route block/drag/full-replace edits through
 `EditController` (extend the API if a Range is awkward — e.g. an
 explicit `replaceAll(next)` or `replaceWithCaret(range, replacement,
 caretAt)`).
- Risk: behavior-change (small) — primarily eliminates intermediate
 subscriber states.

### 5. Overlay still ships a fake `MarkToken`

- Files:
 - `packages/core/src/features/overlay/createMarkFromOverlay.ts`
 - `packages/core/src/features/overlay/OverlayController.ts:29, 98`
 - `packages/react/markput/src/lib/hooks/useOverlay.tsx:2, 29`
 - `packages/vue/markput/src/lib/hooks/useOverlay.ts:2, 33`
- Pattern: framework adapters construct a `MarkToken` with empty
 `children`, fabricated `descriptor` (`segments: []`, `gapTypes: []`,
 `hasSlot: false`, `index: 0`), and an `OverlayMatch` position. The
 controller only reads `mark.value`, `mark.meta`, and (for the text
 branch) `mark.content`.
- Impact: misleading payload type — any future consumer that trusts
 `descriptor` or `children` will get garbage. Also exports a public
 `createMarkFromOverlay` from `packages/core/index.ts` that only the
 two adapters consume.
- Recommendation: change `OverlayController.select` to
 `event<{value: string; meta?: string; match: OverlayMatch}>()`, delete
 `createMarkFromOverlay`, and update both adapters' `useOverlay` hooks
 accordingly. Drop the public re-export.
- Risk: behavior-change (small, internal API) — public surface shrinks;
 framework adapter call sites change.

### 6. Overlay trigger probing reads global selection

- Files:
 - `packages/core/src/features/overlay/OverlayController.ts:56`
 (`watch(this.value.current, ...)` → `#probeTrigger()`)
 - `packages/core/src/features/overlay/TriggerFinder.ts:23-25`
 (`window.getSelection()` in the constructor)
- Pattern: the `selectionchange` effect (`OverlayController.ts:84`)
 properly gates on `container?.contains(document.activeElement)`, but
 the `value.current` watcher does not. `TriggerFinder.find` then reads
 `window.getSelection()` without a container scope.
- Impact: on multi-editor pages or after programmatic mark changes,
 overlay state can latch onto a selection that lives in another editor
 (or anywhere in the document).
- Recommendation: pass the container/focus boundary into
 `TriggerFinder.find` (e.g. `dom: DomModel` is already available — gate
 on `dom.container()?.contains(sel?.anchorNode)` before constructing
 the finder) and apply the same check inside the `value.current`
 watcher.
- Risk: behavior-change (small) — overlay no longer reacts to value
 changes when focus is outside the editor.

### 7. `PropsModel.set` still uses `key in this`

- File: `packages/core/src/features/state/PropsModel.ts:48-52`
- Pattern: arbitrary key existence check.
- What: the loop calls `if (!(key in this)) continue` and then invokes
 `this[key](values[key])`. Because `set` itself is a method on the
 instance, calling `props.set({set: ...})` (or any inherited
 `Object.prototype` key) passes the existence check and invokes a
 non-signal method.
- Compile-time `Partial<SignalValues<typeof this>>` keeps well-typed
 callers safe; the concern is purely runtime input from adapters or
 user code that happens to pass through.
- Recommendation: replace the existence check with a literal whitelist
 of own prop signal keys (one static `Set<string>` per class) and
 ignore everything else. Optionally also verify the resolved value is a
 signal/function before invoking.
- Risk: behavior-change (small) — silently dropped non-signal keys
 instead of executing them.

### 8. Feature READMEs and editor-shell tests lag the code

- Stale READMEs:
 - `packages/core/src/features/clipboard/README.md:7-10` — references
 `CopyFeature` (now `ClipboardController`) and `clearMarkupPaste`
 (deleted, see Resolved #17 below).
 - `packages/core/src/features/dom/README.md:3, 7, 18` — mentions
 `CaretModel`, a `../caret/README.md` that no longer exists, and
 `dom.diagnostics` events that the current `DomModel` does not
 expose; also lists `splitsSurrogatePair` as an exported helper from
 `textOffsets.ts`, but it is now internal (see Resolved #11).
 - `packages/core/src/features/slots/README.md` and
 `packages/core/src/features/parsing/parser/README.md` — referenced as
 stale by the April audit; quick re-skim suggests they still need a
 pass.
- Thin spec coverage:
 - `packages/core/src/features/keyboard/blockEdit.ts` — no `*.spec.ts`
 alongside the file; storybook covers happy paths only.
 - `packages/core/src/features/block/operations.ts` — only consumed by
 spec via `BlockController.spec.ts`; pure-function corner cases
 (negative/oversized/empty indexes) are not exercised directly.
 - `packages/core/src/features/overlay/OverlayController.spec.ts` —
 covers happy paths; multi-editor selection scoping (#6) and
 option-local `Mark`/overlay interactions are untested.
- Recommendation: after the open items above land, refresh the affected
 READMEs in the same PR. Add focused unit tests for pure operations
 (`block/operations.ts`, `block/createRowContent.ts`) — these are cheap
 and protect the cleanup work.
- Risk: safe (docs/tests only).

## Deferred (Documented)

The May 14 audit explicitly marked these as out of scope. The decisions
still hold; restating them here so this is the single source of truth.

- `packages/core/src/features/parsing/preparsing/` (whole subtree) —
 `findGap` / `getClosestIndexes` are dead (only spec/README consumers);
 kept in tree per the May 14 cleanup plan.
- `packages/core/src/features/parsing/parser/Parser.ts` static and
 transform/escape APIs — `Parser.parse`, `Parser.stringify`,
 `parser.transform`, `parser.escape`, `parser.unescape` are spec-only;
 `processTokensWithCallback` backs `transform` and `denote`. The whole
 Parser surface is held stable.
- `packages/core/src/features/dom/DomBoundary.ts` + `DomIndexer.ts` —
 `DomBoundaryHost` / `DomIndexerHost` are single-implementer interfaces
 (only `DomModel`). Flagged in May 14 #21 as deferred; merging them
 into `DomModel` directly is a wider blast-radius change worth its own
 plan.
- `packages/core/src/features/state/Lifecycle.ts` — `onMounted`
 orchestration could collapse to a flat watch chain, but only by
 changing `mounted`/`unmounted` from events to a boolean signal. That
 touches every framework adapter; held back to keep the cleanup pass
 free of behavior changes.
- `packages/core/src/features/parsing/TokenModel.ts` `#parser` computed
 — already covered by a separate plan
 (`docs/superpowers/plans/2026-05-14-tokenmodel-cleanup.md` referenced
 in the May audit; the plan file itself is no longer in tree, suggesting
 the work has either landed or been folded into another effort. Worth
 re-checking before opening another plan).

## Resolved Since the Prior Audits

These were called out by the April or May audits and are no longer
present in the current code. Listed for traceability so future readers
can see what shipped.

### From the April 24 architectural audit

1. `MarkHandler` stale token positions — `MarkHandler` is gone; replaced
 by `MarkController` (`features/parsing/MarkController.ts`). All
 mutations resolve the target through a stored `TokenAddress` on every
 call, and serialization rebuilds the markup via `annotate(...)` so
 cached positions can never slice the wrong substring. Spec
 (`MarkController.spec.ts`) covers the stale-address case explicitly.
2. Mark editing API confusion — `MarkController` exposes only
 `value`/`meta`/`slot`/`readOnly` snapshot getters plus
 `update(patch)` (typed `MarkPatch` with explicit `kind: 'set' | 'clear'`)
 and `remove()`. The mutable `content` field is gone.
3. `mark.remove` typed wider than its name — `mark.remove` event no
 longer exists; removal is `MarkController#remove()`, instantiated from
 a `MarkToken` via `MarkController.fromToken(store, token)`.
4. React adapter mutated store props during render — the per-render
 `store.props.set(props)` is now inside `useLayoutEffect`
 (`packages/react/markput/src/components/MarkedInput.tsx:89-91`). The
 initial sync at line 85 lives inside the `useState` initializer, so it
 runs once per editor instance, not on every render.
5. Initial parsing happened twice — `ValueModel` and `TokenModel` are
 reactive primitives now (no `.enable()` step that re-commits). The
 token computation runs once per value commit.

### From the May 14 cleanup audit

1. `DomIndexer` / `DomIndex` counter-as-proxy — replaced by
 `isIndexed: Signal<boolean>` on `DomIndexer` (private write, public
 read), with `host.emitIndexed()` covering the post-commit notification
 path. (`features/dom/DomIndexer.ts:46-47, 170-171`)
2. `rawRangeFromInputEvent` / `rawRangeFromTargetRange` duplicated across
 `keyboard/input.ts` and `keyboard/blockEdit.ts` — hoisted into
 `keyboard/inputRange.ts`. Both files now import from there.
3. `features/parsing/utils/valueParser.ts` — file deleted; no
 consumers remain.
4. `features/keyboard/index.ts` exported `handleBeforeInput`,
 `handlePaste`, `replaceAllContentWith`, `applySpanInput` — now only
 exports `KeyboardController`; specs import the helpers directly from
 `./input`.
5. `OverlayController` `effectScope` toggle — replaced by inline
 `if (!hasOverlayTrigger()) return` guards inside each `watch`/`effect`.
 (`features/overlay/OverlayController.ts:50-122`)
6. `BlockController` same toggle dance — collapsed to a single
 `watch(this.action, ...)` with `if (!props.layout.isBlock() ||
 !props.draggable()) return`. (`features/block/BlockController.ts:22`)
7. `shared/types.ts` `Listener` and `EventKey` — deleted.
8. `shared/checkers/` unused predicates — `isFunction`, `isObject`,
 `isTextNode`, `childAt`, `lastHtmlChild`, `htmlTarget`,
 `assertNonNullable` all gone. `shared/checkers/index.ts` now exports
 only `firstHtmlChild, htmlChildren, isHtmlElement, nextText,
 nodeTarget`.
9. `features/dom/textOffsets.ts` exports — `nextTextNode`,
 `splitsSurrogatePair`, `textOffsetFromTreeWalker`,
 `elementBoundaryOffset` are now file-internal.
10. `TokenIndex.equals` — removed; the interface is now `pathFor`,
 `addressFor`, `resolve`, `resolveAddress`, `key`.
11. `features/parsing/index.ts` — no longer re-exports
 `createTokenIndex`, `pathEquals`, `pathKey`, `resolvePath`. Index now
 exposes `Parser`, token types, `annotate`, `denote`, `toString`,
 `findToken`, `TokenContext`, `TokenModel`, `TokenIndex`,
 `MarkController`.
12. `features/parsing/mark_types.ts` — file deleted.
13. `shared/editorContracts.ts` `MarkControllerConstructor` type —
 deleted.
14. `features/parsing/parser/types.ts` `marksOnly` parse option —
 removed; `ParseOptions` is now an empty interface.
15. `features/clipboard/pasteMarkup.ts` `clearMarkupPaste` — deleted;
 only `captureMarkupPaste` and `consumeMarkupPaste` remain.
16. `features/parsing/parser/types.ts` `isMarkToken` — deleted; callers
 use `token.type === 'mark'`.
17. `features/block/createNewSpan.ts` — file deleted.
18. `features/parsing/TokenModel.ts` `serializeRange` forwarder — gone;
 `ClipboardController` imports `serializeRange` directly from
 `parsing/utils/serializeRange`.
19. `features/state/ValueModel.ts` `isControlledMode` — inlined inside
 the `current` model's `get`/`set`.
20. `SelectionController` `isUserSelecting` re-export — gone; callers
 read `dom.isUserSelecting`. `SelectionController` itself uses
 `this.dom.isUserSelecting()`.
21. `features/keyboard/input.ts` `getTargetRanges` wrapper — inlined as
 `event.getTargetRanges()`.
22. `shared/constants.ts` over-named DEFAULTs — `DEFAULT_OVERLAY_TRIGGER`,
 `DEFAULT_MARKUP`, `DefaultOverlayConfig`, `DefaultOption` removed;
 only `KEYBOARD` and `DEFAULT_OPTIONS` remain.

## Test Backlog (Worth Picking Up Alongside the Open Items)

- `createRowContent([])` and `createRowContent([{}])` return newline
 instead of throwing. Block Enter and `BlockController#add` work with
 `options={[]}`.
- Block keyboard delete/Enter/arrow navigation refuse to operate when
 focus is inside a `controlFor`-registered element or an ambiguous DOM
 child (Open #2).
- Container ref replacement rebinds keyboard, clipboard, and selection
 focus listeners (Open #3).
- All editor-originated writes (block merge, drag reorder/add/delete/
 duplicate, full-selection replace) leave `value` and `selection`
 consistent in the same tick (Open #4).
- Overlay select consumes only `{value, meta?, match}` without depending
 on `descriptor` or `children` (Open #5).
- Overlay insert with two `MarkedInput` instances on the page: editing
 value in one editor does not surface an overlay in the other (Open #6).
- `PropsModel.set({set: 'x'})`, `PropsModel.set({constructor: 'x'})`,
 `PropsModel.set({__proto__: {}})` all no-op silently (Open #7).
- Pure-function corner cases for `block/operations.ts`:
 `deleteDragRow`/`duplicateDragRow`/`reorderDragRows` with negative,
 oversized, and empty-row inputs return the original value unchanged.

## Acceptance Criteria For The Open Items

- All editor-originated value writes go through `EditController` (or an
 explicit extension of it) and observers see `value` and `selection` in
 sync on the same tick.
- Block keyboard handlers consult `store.dom` for row identity; controls
 and ambiguous DOM are typed failures, not silent row indexes.
- Container listeners (keyboard, clipboard, selection focus) follow
 `store.dom.container` changes, with disposal of the previous binding.
- Overlay state cannot leak across editors on the same page; trigger
 finding rejects selections outside the active editor.
- Overlay select payload contains only data the controller actually
 reads; `createMarkFromOverlay` is removed.
- `PropsModel.set` accepts only the literal own prop signal keys.
- `createRowContent` is total for empty/malformed `options`.
- Affected feature READMEs match the current code on the same PR that
 changes behavior.
