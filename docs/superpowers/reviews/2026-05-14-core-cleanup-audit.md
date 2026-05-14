# Core Cleanup Audit — `packages/core/src/`

Date: 2026-05-14
Scope: every `.ts` file under `packages/core/src/` (excluding `*.spec.ts`, `dist/`, `alien-signals/`, `__testing__/`, `test-utils/`, `*.bench.ts`).
Method: read every source file, cross-reference each exported symbol across `packages/` (core, react, vue, storybook, website), and tag any of:

- **Dead code** — exported symbol with zero consumers across the repo, or only spec consumers; types defined but never referenced.
- **Over-engineering** — abstractions with a single implementation and no extension point; wrapper classes/types that add no behavior; private-then-re-exposed signal pairs; intermediate computeds that just rename a value; counters used as a proxy for object identity / WeakMap membership.
- **Unnecessary complexity** — `effectScope` toggle dances where a guard inside the watcher would be equivalent; `batch` calls wrapping a single write; `event()` primitives with a single fire-site; multi-step constructor orchestration (`onMounted` + nested closures + scope tracking) where a flat watch chain would do.

Findings are sorted by impact. Each entry is filed under the smell label with a one-sentence "what to remove or collapse" and a risk note (`safe` = no behavior change, `behavior-change` = behavior may shift in a documented way).

> **Cleanup status:** Findings #4 and #5 are **deferred** — they are real but the implementation pass tracked in `docs/superpowers/plans/2026-05-14-core-cleanup.md` deliberately leaves them in place for now. Every other finding is in scope for that plan.

---

## High impact

### 1. `features/dom/DomIndexer.ts` + `shared/editorContracts.ts` (`DomIndex`)

- **Pattern:** counter-as-proxy + private-then-re-exposed.
- **What:** `DomIndex = {generation: number}` exists only so the `signal<DomIndex>` flips identity on every render commit, but no caller ever reads `.generation`. Every consumer just does `dom.index() === undefined`. Collapse to `dom.isIndexed: signal<boolean>(false)` (set once on first commit). The existing `dom.indexed` event already covers the "re-run after commit" use case (one subscriber: `SelectionController#applyRangeToDOM`). Also drop the `#domIndex` (private signal) + `index: Computed<...>` re-exposure pair in `DomIndexer`.
- **Risk:** safe (every reader is an existence check; no consumer reads `generation`).

### 2. `features/keyboard/input.ts` + `features/keyboard/blockEdit.ts`

- **Pattern:** unnecessary complexity (duplicated implementation).
- **What:** `rawRangeFromInputEvent`, `rawRangeFromTargetRange`, `rawSelectionReason`, the `InputTargetRange` type and `RawSelectionFailureReason` type are defined identically in both files. Hoist into `keyboard/inputRange.ts`.
- **Risk:** safe (mechanical extraction).

### 3. `features/parsing/utils/valueParser.ts` (whole file)

- **Pattern:** dead code + alias wrappers.
- **What:** `computeTokensFromValue` is documented as "Public API compatibility shim"; it, plus `parseWithParser`, `parseUnionLabels`, and `getRangeMap`, have zero non-self consumers in the repo (only mentioned in the outdated `core/README.md`). Delete the file and the re-exports in `features/parsing/index.ts`.
- **Risk:** safe.

### 4. `features/parsing/preparsing/` (whole subtree) — **DEFERRED**

- **Pattern:** dead code (entire feature).
- **What:** `findGap` and `getClosestIndexes` (plus their `index.ts`) are not exported from `packages/core/index.ts` and have only spec/README consumers.
- **Status:** Deferred from this cleanup pass per the user request — keep the code in tree for now even though it's dead.

### 5. `features/parsing/parser/Parser.ts` — static + transform/escape APIs — **DEFERRED**

- **Pattern:** dead code + abstraction with a single implementation.
- **What:** `Parser.parse`, `Parser.stringify`, `parser.transform`, `parser.escape`, `parser.unescape` have only spec consumers. `processTokensWithCallback` exists only to back `parser.transform` and `denote`.
- **Status:** Deferred from this cleanup pass per the user request — Parser surface stays untouched.

### 6. `features/keyboard/index.ts` — exported helpers only used by spec

- **Pattern:** dead code (exported, never imported).
- **What:** `handleBeforeInput`, `handlePaste`, `replaceAllContentWith`, `applySpanInput` are exported but consumed only by `input.spec.ts`. Drop the named exports; switch the spec to import from `./input` directly. `enableInput` (used by `KeyboardController`) is the only legitimate consumer.
- **Risk:** safe.

### 7. `features/overlay/OverlayController.ts` — `effectScope` toggle

- **Pattern:** `effectScope` toggle dance.
- **What:** `toggle(enabled)` destroys/recreates an entire `effectScope` whenever `hasOverlayTrigger` flips. Since the outer `lifecycle.onMounted` already wraps everything in a scope, every inner subscription except the document-level `selectionchange` listener can be replaced by `if (!hasOverlayTrigger()) return` guards inside each `watch`/`effect`. Conditionally registering only the `selectionchange` listener (small inner `effect`) preserves the only real benefit — saving one global handler.
- **Risk:** behavior-change (small) — every `watch` would now subscribe even when there are no overlay triggers; cost is one extra signal read on each `value.current` change. Caller-visible behavior unchanged.

### 8. `features/block/BlockController.ts` — same toggle dance

- **Pattern:** `effectScope` toggle dance.
- **What:** Identical pattern to #7 around `slots.isDragEnabled`. The watched dependency is `this.action` (an `event()`), which fires only when a drag UI actually runs, so guarding inside the watcher (`if (!slots.isDragEnabled()) return`) is equivalent and removes `#unsub` / `toggle` glue.
- **Risk:** behavior-change (negligible) — keeping a watcher subscribed to a never-firing event is essentially free; preserves `BlockController.spec.ts > does not leak a watcher` semantics if the early return stays.

---

## Medium impact

### 9. `shared/types.ts` — `Listener`, `EventKey`

- **Pattern:** dead types.
- **What:** Defined and only mentioned in `core/README.md`; never imported anywhere.
- **Risk:** safe.

### 10. `shared/checkers/` — exported but unused predicates

- **Pattern:** dead code.
- **What:** `isFunction`, `isObject`, `isTextNode`, `childAt`, `lastHtmlChild`, `htmlTarget`, and `assertNonNullable` are exported from `shared/checkers/index.ts` but have zero non-spec consumers (storybook ships its own `childAt`).
- **Risk:** safe.

### 11. `features/dom/textOffsets.ts` — exported helpers used only internally

- **Pattern:** over-broad public surface.
- **What:** `nextTextNode`, `splitsSurrogatePair`, `textOffsetFromTreeWalker`, `elementBoundaryOffset` are exported but only used inside this file. Make non-exports.
- **Risk:** safe.

### 12. `features/parsing/tokenIndex.ts` — `equals` method on `TokenIndex`

- **Pattern:** dead member of an interface.
- **What:** `TokenIndex.equals` is declared on the interface and assigned `pathEquals`, but no caller ever invokes `.equals(...)` on the index instance. Drop the field.
- **Risk:** safe.

### 13. `features/parsing/index.ts` — re-exports of `createTokenIndex`, `pathEquals`, `pathKey`, `resolvePath`

- **Pattern:** dead exports.
- **What:** Re-exported as if public, but no consumer outside `tokenIndex.ts` itself, `DomIndexer` (which already imports the function module directly), and specs uses these. Drop the re-exports.
- **Risk:** safe — none re-exported from `packages/core/index.ts`.

### 14. `features/parsing/mark_types.ts` (`MarkOptions`)

- **Pattern:** dead type.
- **What:** `interface MarkOptions { controlled?: boolean }` is exported and re-exported through `packages/core/index.ts`, but no consumer imports it (React/Vue `useMark` accept their own option types). Delete the file and its re-exports.
- **Risk:** safe.

### 15. `shared/editorContracts.ts` — `MarkControllerConstructor`

- **Pattern:** dead type.
- **What:** `export type MarkControllerConstructor = ...` has no importers anywhere.
- **Risk:** safe.

### 16. `features/parsing/parser/types.ts` — `marksOnly` parse option

- **Pattern:** dead feature option.
- **What:** `ParseOptions.marksOnly` is exposed and special-cased inside `TreeBuilder.filterTokens`, but no caller in the entire monorepo passes it — only `Parser.spec.ts` does. Drop the option, the filter branch, and the spec block.
- **Risk:** safe (no production consumer; spec coverage gap is intentional).

### 17. `features/clipboard/pasteMarkup.ts` — `clearMarkupPaste`

- **Pattern:** dead code (exported only for tests).
- **What:** Documented as "Useful for test cleanup". Spec is the only caller. Replace with `consumeMarkupPaste(container)` in the test.
- **Risk:** safe.

### 18. `features/parsing/parser/types.ts` — `isMarkToken`

- **Pattern:** dead helper.
- **What:** Exported but only used in `Parser.spec.ts`. The spec can switch to inline `token.type === 'mark'` (the same shape used everywhere else).
- **Risk:** safe.

### 19. `features/block/createNewSpan.ts`

- **Pattern:** dead module.
- **What:** `createNewSpan` has no consumers (and even the `core/README.md` signature is wrong). Delete the file.
- **Risk:** safe.

### 20. `features/parsing/TokenModel.ts` (`serializeRange`) and `features/dom/DomModel.ts` forwarders

- **Pattern:** wrapper that adds nothing.
- **What:** `TokenModel.serializeRange(range)` is a one-line forwarder to `serializeRange(this.current(), range)` with one caller (`ClipboardController`). Inline the util at the call site. (DomModel forwarders to `#indexer`/`#boundary` are the same shape but we keep them: see #21.)
- **Risk:** safe.

### 21. `features/dom/DomBoundary.ts` + `features/dom/DomIndexer.ts` — `DomBoundaryHost` / `DomIndexerHost`

- **Pattern:** abstraction with a single implementation and no extension point.
- **What:** Both interfaces have exactly one implementer (`DomModel`), no test fakes, no plans for extension. Replace with direct `DomModel` references (or merge `DomBoundary`/`DomIndexer` back into `DomModel`).
- **Status:** flagged but deferred to its own follow-up plan — wider blast radius and worth a dedicated review.

---

## Low impact / minor

### 22. `features/state/ValueModel.ts` — `isControlledMode`

- **Pattern:** intermediate computed that exists only to rename a check.
- **What:** `isControlledMode = computed(() => this.props.value() !== undefined)` is read 2× internally (and only by `ValueModel.spec`). Inline the boolean inside `current`'s `get`/`set` and drop the public field.
- **Risk:** safe.

### 23. `features/selection/SelectionController.ts` — `isUserSelecting` re-export

- **Pattern:** private-then-re-exposed (cross-feature).
- **What:** `SelectionController.isUserSelecting = dom.isUserSelecting` exists for "API compatibility" — but the only readers/writers are specs (`SelectionController.spec`, `Store.spec`, `DomModel.spec`) and one internal `this.isUserSelecting()` call in `#applyRangeToDOM`. Drop the re-export, switch the internal call to `this.dom.isUserSelecting()`, and update specs to read `dom.isUserSelecting`.
- **Risk:** behavior-change (minor) — public API of `SelectionController` shrinks; spec churn.

### 24. `features/parsing/TokenModel.ts` — `#parser` computed

- **Status:** already covered by `docs/superpowers/plans/2026-05-14-tokenmodel-cleanup.md`. Out of scope for this audit's plan.

### 25. `features/keyboard/input.ts` — `getTargetRanges` wrapper

- **Pattern:** wrapper that adds nothing.
- **What:** `function getTargetRanges(event) { return event.getTargetRanges() }` is a no-op call wrapper used once. Inline `event.getTargetRanges()`.
- **Risk:** safe.

### 26. `shared/constants.ts` — over-named DEFAULTs

- **Pattern:** over-engineering.
- **What:** `DEFAULT_OVERLAY_TRIGGER`, `DEFAULT_MARKUP`, `DefaultOverlayConfig`, `DefaultOption` exist only as inputs to `DEFAULT_OPTIONS` and are not exported from `packages/core/index.ts`. Inline them and drop the helper types.
- **Risk:** safe.

### 27. `features/state/Lifecycle.ts` — `onMounted` orchestration

- **Pattern:** multi-step orchestration that could be a flat watch chain.
- **Status:** real, but the simplification requires changing `mounted`/`unmounted` from events to a single boolean signal — that touches every framework adapter (React/Vue mount hooks). Out of scope for a "no behavior change" cleanup.

---

## Skipped (load-bearing despite looking suspicious)

- `Lifecycle.mounted/unmounted/rendered` events: cross-package contracts (React/Vue adapters fire them).
- `DomModel.controlFor` / `childrenFor`: real DOM ref factories with multiple consumers.
- `BlockStore`: holds DOM event wiring per block; multiple Vue/React callers.
- `MarkController.update` / `remove`: public API consumed by `useMark` hooks in both adapters.
- `TokenModel.#parser` computation logic itself: genuinely depends on three reactive inputs; only the plumbing is suspect (#24).
- `signal.ts` / `alien-signals/`: explicitly excluded.
- `Parser` core (`MarkupRegistry`, `PatternMatcher`, `SegmentMatcher`, `TreeBuilder`, `Match`): performance-critical hot path with benchmark coverage in `parser.profile.bench.ts`.

---

## Plan handoff

The cleanup plan derived from this audit lives at:

- `docs/superpowers/plans/2026-05-14-core-cleanup.md`

That plan covers findings 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 25, 26.

Findings 4, 5, 21, 24, and 27 are **out of scope** for that plan and are documented above with rationale.
