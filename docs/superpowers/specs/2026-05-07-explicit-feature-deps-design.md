# Explicit Feature Dependencies in Store

**Status:** design, not yet implemented
**Scope:** `packages/core/src/features/**`, `packages/core/src/store/Store.ts`
**Author session:** brainstorming, 2026-05-07

## Problem

Every feature constructor today takes `_store: Store` and reaches into
whatever it needs through `this._store.<feature>.*`. The Store itself passes
`this` to every feature at construction time:

```ts
readonly value = new ValueFeature(this)
readonly parsing = new ParsingFeature(this)
// ...
```

Consequences:

1. A feature's real dependencies are invisible at its declaration. You must
   read the whole file to discover that `ValueFeature` actually needs
   `lifecycle, props, parsing, caret`.
2. The dependency graph between features has cycles that are hidden by the
   late-binding service-locator pattern. Those cycles are not just a
   style issue; they indicate genuinely tangled ownership.
3. Testing a feature in isolation requires constructing a full Store.
4. `PropsFeature` accepts `_store` but never uses it — the parameter is
   dead weight, which nothing currently signals.

The desired end state: each feature declares exactly what it depends on as
constructor parameters with concrete feature types, and the Store composes
them in a topological order. No service locator, no `_store` indirection,
no lazy getters.

That end state is blocked by cycles. The implementation plan therefore
removes cycles first and converts to explicit deps last.

## Current Dependency Graph

Inventory of cross-feature access (verified by grep across `features/`):

| Feature     | Reads / calls                                          |
| ----------- | ------------------------------------------------------ |
| `value`     | `lifecycle, props, parsing, caret`                     |
| `parsing`   | `lifecycle, mark, props, slots, value, caret`          |
| `caret`     | `lifecycle, dom`                                       |
| `dom`       | `lifecycle, props, caret, parsing`                     |
| `slots`     | `props`                                                |
| `mark`      | `props`                                                |
| `overlay`   | `lifecycle, props, value, dom, caret` (+ parsing via helpers) |
| `keyboard`  | `caret, dom, props, value` (+ parsing via helpers)     |
| `drag`      | `caret, dom, props, value` (+ parsing via helpers)     |
| `clipboard` | `caret, dom, props, value` (+ parsing via helpers)     |
| `props`     | *(none — the `_store` parameter is unused)*            |
| `lifecycle` | *(none)*                                               |

Three cycles exist:

1. **value ↔ parsing.** `ValueFeature.#accept` calls
   `parsing.parseValue/acceptTokens`. `ParsingFeature.sync` reads
   `value.current()`; `#subscribeReactiveParse` reads
   `store.value.current()`.
2. **caret ↔ dom.** `CaretFeature.placeAt/focus` delegate to
   `store.dom.placeCaretAtRawPosition/focusAddress`.
   `DomFeature.#applyPendingRecovery` calls `store.caret.placeAt` —
   which loops right back to Dom.
3. **parsing → caret (one-way but dependent on cycle 1).**
   `ParsingFeature` reads `caret.recovery()` as a "don't resync during an
   active edit" guard. The guard only exists because Value drives Parsing
   imperatively (cycle 1). Removing cycle 1 removes this guard.

## Goals

- Acyclic feature dependency graph.
- Each feature declares its dependencies as positional constructor
  parameter properties with concrete feature types.
- Store constructs features top-to-bottom in topological order, passing
  explicit instances.
- No `_store.*` access anywhere in feature files.
- Tests can instantiate a feature with minimal, honest deps.

## Non-Goals

- No changes to signal/event/computed semantics.
- No changes to the adapter boundary: `MarkputHandler(store)` continues
  to receive the whole Store, because it is the framework-adapter
  facade, not a feature.
- No interface/protocol extraction. Features still depend on concrete
  feature classes. Introducing interfaces is YAGNI until a second
  implementation exists.
- No performance work.

## Design Decisions

### D1 — Invert value → parsing

Parsing becomes a pure derivation of `value.current` and `parser`.

```ts
// ParsingFeature
constructor(
  private readonly lifecycle: LifecycleFeature,
  private readonly value: ValueFeature,
  private readonly mark: MarkFeature,
  private readonly props: PropsFeature,
  private readonly slots: SlotsFeature,
) {
  const input = computed(() => ({value: value.current(), parser: this.parser()}))
  lifecycle.onMounted(() => {
    watch(input, ({value: v}) => this.acceptTokens(this.parseValue(v)))
    watch(this.reparse, () => this.acceptTokens(this.parseValue(value.current())))
  })
}
```

```ts
// ValueFeature
#accept(value: string): void {
  const pending = this.#pending
  this.#pending = undefined
  if (pending?.value === value) this.caret.recovery(pending.recovery)
}
```

`ValueFeature` no longer imports `ParsingFeature`. `ParsingFeature` no
longer reads `caret.recovery()` — the guard is not needed because
Value is no longer an imperative driver of tokens.

Public surface on `ParsingFeature` after Step 1:

- `parseValue(value)`, `acceptTokens(tokens)`, and `sync(value?)` become
  internal implementation details. Existing tests that call them
  migrate to drive parsing through `store.value.replaceAll(text)`,
  which is the canonical entry point for "set the editor content and
  observe the parsed tokens".
- `reparse` remains public as an event-based affordance for forcing a
  re-parse without a value change (e.g., after config/options mutate
  outside the signal graph). No public callers in the runtime, but
  kept because it is the only remaining force-reparse primitive.

### D2 — Break the `caret ↔ dom` self-call

Delete `CaretFeature.placeAt` and `CaretFeature.focus`. Update the
three runtime call sites and the documentation that references them:

- `features/keyboard/arrowNav.ts` → `store.dom.placeCaretAtRawPosition`
  / `store.dom.focusAddress`.
- `features/keyboard/blockEdit.ts` → `store.dom.focusAddress`.
- `features/dom/DomFeature.ts` line 771 →
  `this.placeCaretAtRawPosition` (internal method).
- `features/navigation/README.md` → reference `store.dom.*`.

`CaretFeature` becomes pure state: `recovery`, `location`, `selecting`.
Its constructor becomes empty (no deps). The `enableFocus(store)` and
`enableSelection(store)` calls move from `CaretFeature.constructor` to
the `Store` constructor, where they are attached as
`lifecycle.onMounted(() => { enableFocus(this); enableSelection(this) })`.
Rationale: these helpers need `dom`, and `dom` is constructed after
`caret`, so attaching them inside `CaretFeature` would force `caret` to
receive `dom` — which would either reintroduce the cycle or require a
lazy hack. Moving attachment to the Store breaks the dependency cleanly
and keeps `CaretFeature` purely data-owning.

### D3 — Positional parameter properties

Chosen over object destructuring and wrapper-object patterns. Rationale
recorded here because the decision was non-obvious:

- Consistent with the existing `private readonly _store: Store`
  style — minimal refactor churn.
- Cleanest access sites: `this.props.value()`, no `deps.` or `#`
  prefix noise.
- Risk: positional caller can swap two args of compatible types. In
  practice each feature has a distinct class type, so TypeScript
  catches mismatches. Store is the only runtime construction site.

Treat "constructor signature is hard to read" as a signal that a
feature has too many deps, not as a reason to switch to object syntax.

### D4 — Drop `PropsFeature`'s unused Store parameter

`PropsFeature` currently takes `_store: Store` but never reads it.
Remove the parameter as part of Step 3.

### D5 — Handler stays store-typed

`MarkputHandler(store)` keeps the `Store` parameter. It is the adapter
boundary; its job is to expose the Store's affordances to the React /
Vue adapter, and it is constructed last so no cycle concern applies.

### D6 — Behavior modules keep `store` parameter

Files under `features/caret/focus.ts`, `features/caret/selection.ts`,
`features/caret/selectionHelpers.ts`, and keyboard/drag/clipboard
helpers that currently take a `store` argument keep that shape. They
are not features. Narrowing their parameter types is a separate,
optional cleanup.

## Target Dependency Graph

After Steps 1 and 2 the graph is acyclic:

```
lifecycle → ∅
props     → ∅
caret     → ∅
mark      → props
slots     → props
value     → lifecycle, props, caret
parsing   → lifecycle, value, mark, props, slots
dom       → lifecycle, props, caret, parsing
overlay   → lifecycle, props, value, dom, caret, parsing
keyboard  → caret, dom, props, value, parsing
drag      → caret, dom, props, value, parsing
clipboard → caret, dom, props, value, parsing
```

Construction order in `Store` (top-to-bottom field initializers):

1. `lifecycle`
2. `props`
3. `caret`
4. `mark`, `slots`
5. `value`
6. `parsing`
7. `dom`
8. `overlay`
9. `keyboard`, `drag`, `clipboard`
10. `handler`

## Migration Plan

### Step 0 — Dep audit (no behavior change)

For each feature, change `_store: Store` to
`_store: Pick<Store, 'lifecycle' | 'props' | ...>` listing only the
members that feature actually uses. Run `pnpm run typecheck`. Any
compile errors surface drift between declared and actual deps.

Commit: `refactor(core): narrow feature store dependencies`.

### Step 1 — Invert value ↔ parsing

1. Add a new spec in `packages/core/src/features/value/ValueFeature.spec.ts`:
   "controlled parent rejects change → caret.recovery is not leaked".
   Arrange: controlled mode, `onChange` does not propagate. Act: call
   `replaceRange(..., {recover})`. Assert: `caret.recovery()` stays
   `undefined`.
2. Move the watch/subscription logic from
   `ValueFeature.constructor`/`#accept` into `ParsingFeature`:
   `ParsingFeature` subscribes to `value.current` and the `parser`
   computed; on change, it parses and accepts tokens.
3. `ValueFeature.#accept` becomes a pure recovery-commit: if pending
   value matches, write `caret.recovery`, else nothing.
4. Delete the `caret.recovery` guards in
   `ParsingFeature.#subscribeParse` and `#subscribeReactiveParse`.

Commit: `refactor(core): parse tokens from value as a derivation`.

### Step 2 — Remove `caret.placeAt/focus`

1. Update `features/keyboard/arrowNav.ts`,
   `features/keyboard/blockEdit.ts`,
   `features/dom/DomFeature.ts`, and
   `features/navigation/README.md` to use `store.dom.*` directly.
2. Delete `placeAt` and `focus` from `CaretFeature`.
3. Move the `enableFocus(store) / enableSelection(store)` wiring
   from `CaretFeature.constructor` into the `Store` constructor.
   `CaretFeature` becomes a pure-state class with an empty constructor.
4. Update `CaretFeature.spec.ts` to remove any assertion that still
   references the removed methods.
5. Update docs under `packages/website/src/content/docs/` that
   reference `store.caret.placeAt` / `store.caret.focus`.

Commit: `refactor(core): move caret placement methods to DomFeature`.

### Step 3 — Switch to explicit feature-typed deps

1. For each feature, replace the (narrowed) `_store` parameter with
   positional parameter properties typed as concrete feature classes.
   Drop `PropsFeature`'s unused parameter entirely.
2. Update each feature's body: every `this._store.X` becomes `this.X`.
3. Rewrite `Store` to construct features with explicit instances in
   topological order.
4. Delete any now-dead re-exports or narrowing utilities introduced
   during Step 0.

Commit: `refactor(core): pass explicit dependencies to features`.

### Step 4 — Doc and storybook sweep

1. Update
   `packages/website/src/content/docs/development/architecture.md` to
   describe the new explicit-deps pattern and the acyclic graph.
2. Verify examples in docs that reference `store.caret.placeAt` are
   updated (should be caught in Step 2).
3. Run storybook tests once to confirm no consumer-visible regression.

Commit: `docs: describe explicit feature deps and acyclic store`.

## Public API Impact

Breaking changes visible to consumers of `@markput/core`:

- `store.caret.placeAt(rawPosition, affinity)` → removed.
  Replacement: `store.dom.placeCaretAtRawPosition(rawPosition, affinity)`.
- `store.caret.focus(address, boundary)` → removed.
  Replacement: `store.dom.focusAddress(address, boundary)`.

No other public surface changes. `store.value.replaceRange/replaceAll`,
`store.parsing.sync/reparse`, all signal shapes, and adapter props
stay the same.

Release note: this is a minor-version-breaking change on the `next`
branch. Pre-1.0 semantics apply.

## Testing Strategy

- **Regression guard for Step 1:** the new controlled-rejection spec
  described above.
- **Existing ValueFeature specs:** continue to pass unchanged.
- **Existing ParsingFeature specs:** the 16 tests that currently call
  `store.parsing.sync(...)` or `store.parsing.acceptTokens(...)`
  migrate to driving the feature through `store.value.replaceAll(...)`.
  Assertions on resulting `store.parsing.tokens()` shape stay the
  same. Specs that exercise the removed `caret.recovery` guard path
  (lines 157, 170, 185) either delete or rewrite to verify the new
  derivation behavior (reparse happens on value change; recovery is
  observed by DOM, not Parsing).
- **DragFeature spec** (`store.parsing.acceptTokens` call at line 46)
  migrates to `store.value.replaceAll(...)`.
- **Existing DomFeature specs:** unchanged. The `#applyPendingRecovery`
  path now calls an internal method instead of bouncing through Caret;
  observable behavior is identical.
- **Caret specs:** remove assertions for `placeAt`/`focus`; add
  keyboard-level integration tests in Storybook if coverage was
  relying on Caret as the public surface.
- **Storybook browser tests:** run full suite after Step 3. Any caret
  navigation story is the strongest integration check.

## Risks

- **Signal ordering in Step 1.** Today `#accept` does parse, accept,
  set recovery synchronously in one batch. After inversion, Parsing
  subscribes to `value.current` and fires its own batched effect.
  Verification: the controlled-rejection spec plus the existing
  "edit with recovery" specs catch ordering regressions.
- **Hidden cycle reintroduction.** Once converted to explicit
  instance-typed deps, reintroducing a cycle is a compile error
  ("used before declaration"). Harder to regress than today.
- **Behavior modules still take `store`.** They retain the old
  pattern for now. If someone adds a new cycle via a behavior module,
  it would not be caught by the explicit-deps design. Acceptable
  because those modules are attached at construction of the owning
  feature and do not introduce long-lived cross-feature references.
- **PropsFeature used-parameter assumption.** Verified by reading
  the file. If a future patch adds a `_store` read in `PropsFeature`,
  Step 3 regresses it to "no parameter".

## Verification

After each step that changes runtime behavior:

```
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
```

Focused iteration during a step may use
`pnpm -w exec vitest run <path>`. Storybook browser tests
(`pnpm -F @markput/storybook test`) run at the end of Step 3.

## Out-of-Scope Follow-ups

Explicitly not part of this plan; surface them as separate issues if
they start to hurt:

- Narrowing `store` parameters in behavior modules
  (`features/caret/focus.ts` etc.).
- Refactoring `TriggerFinder.find(options, predicate, store)` and
  similar shared utils that currently take the whole Store to take
  explicit, narrower deps.
- Extracting interfaces per feature for mock-heavy test ergonomics.
- Breaking `OverlayFeature` or `KeyboardFeature` into smaller features
  if their deps object grows unwieldy in Step 3.
