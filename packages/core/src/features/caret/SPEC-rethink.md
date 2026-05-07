# S1 Caret Save/Restore Rethink — Subsystem Design Spec

**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-05-07  
**Scope:** `packages/core/src/features/caret/`, `packages/core/src/features/value/`,
`packages/core/src/features/dom/`, plus ~15 edit call sites.

---

## 1. Overview

### 1.1 Goals

- Remove the `CaretFeature` import and the `{recover}` API from `ValueFeature`
  so value edits carry no caret knowledge.
- Replace the split between `caret.recovery` (one-shot pending) and
  `caret.location` (imperative token-anchor) with a single reactive primitive
  `caret.range: Signal<RawRange | undefined>`.
- Replace `DomFeature`'s one-shot `#applyPendingRecovery()` with a continuous
  follow-the-signal effect: DOM selection tracks `caret.range`; DOM events
  write `caret.range`.
- Keep `caret.location` as a derived `Computed<CaretLocation | undefined>` for
  the small set of consumers that need a token-anchored view.
- Produce a migration that keeps the test suite green at every step.

### 1.2 Non-Goals

- No change to parsing, drag-row semantics, mark patches, or DOM index
  generation.
- No change to `caret.selecting` semantics.
- No change to `RawRange` / `RawSelection` types.
- No change to the controlled vs uncontrolled value semantics.
- No auto-transform of caret position across edits (callers still write the
  desired post-edit position explicitly).

---

## 2. Architecture

### 2.1 Component Diagram

```
┌──────────────────────────┐     write range      ┌─────────────────────────┐
│  Edit call sites         │ ──────────────────►  │  CaretFeature           │
│  (keyboard, drag, mark,  │                       │  range: Signal<RawRange>│
│   clipboard, overlay)    │                       │  location: Computed     │
└──────────────────────────┘                       │  selecting: Signal      │
                                                   └────────────┬────────────┘
┌──────────────────────────┐     read range                     │ read/write range
│  ValueFeature            │                       ┌────────────▼────────────┐
│  current: Computed       │  ◄── watch(current) ──│  DomFeature             │
│  replaceRange()  [pure]  │                       │  apply effect           │
│  replaceAll()    [pure]  │                       │  DOM→signal wiring      │
└──────────────────────────┘                       └─────────────────────────┘
```

### 2.2 Key Design Decisions

**D1 — Single `range` primitive replaces `recovery` + `location` (writeable).**

Today `recovery` is a one-shot scheduled value ("apply this on next render") and
`location` is an imperatively-written token-anchor ("what's focused right now").
Both exist because `ValueFeature` owns the timing of caret publication — it holds
`recovery` until the controlled-mode echo arrives. Removing that coupling removes
the need for a separate pending state. The reactive signal IS the pending state:
it persists until the next DOM render cycle applies it.

Trade-off: all callers that previously passed `{recover: {kind: 'caret',
rawPosition: X}}` now write `caret.range({start: X, end: X})` separately.
Line count is the same; the API is simpler.

**D2 — Structural equality on `range` eliminates loop suppression flags.**

The apply effect writes to DOM selection; `selectionchange` fires and writes back
to `caret.range`. Without dedup this would loop. `RawRange` objects differ by
reference even when `{start, end}` are equal, so the default `===` check would
re-propagate.

Solution: declare `range` with a custom `equals` option:

```ts
readonly range = signal<RawRange | undefined>(undefined, {
  equals: (a, b) =>
    a === b ||
    (a !== undefined && b !== undefined && a.start === b.start && a.end === b.end),
})
```

When `selectionchange` reads the DOM and writes `{start: 5, end: 5}` back, and
the signal already holds `{start: 5, end: 5}`, the `equals` check returns `true`
→ no propagation → no second apply → loop terminated without any boolean flag.

This is verified by the signal implementation at `shared/signals/signal.ts:218`.

**D3 — `location` becomes a computed, not a writeable signal.**

`caret.location: Computed<CaretLocation | undefined>` is derived from `range` +
`parsing.tokens`. Consumers (`arrowNav.ts`, `DomFeature#clearStaleCaretLocation`,
focus tracking) read it as before; they just can't write it any more. The five
imperative write sites (`focus.ts`, `selection.ts`, `DomFeature` ×3) become
dead code and are removed.

Derivation rule (see §4.3 for full detail): for each raw position in `range`,
walk the token tree to find the deepest token that contains it. Map to a
`CaretLocation.role` from the element role at that path.

**D4 — `affinity` is internal to `DomFeature`, not part of the public API.**

`CaretRecovery['caret'].affinity` (optional `'before' | 'after'`) is used inside
`DomFeature.placeCaretAtRawPosition`. No current call site passes a non-`undefined`
affinity — they all emit `{kind: 'caret', rawPosition: X}` without it. `affinity`
is kept as a parameter on `placeCaretAtRawPosition` but removed from the
public-facing caret API entirely.

**D5 — `selecting` is orthogonal to `range`; apply effect skips when drag-selecting.**

When `caret.selecting() === 'drag'`, the browser holds a live multi-row
selection. The apply effect must NOT overwrite it. Guard: `if (caret.selecting()
=== 'drag') return` at the top of the apply effect.

**D6 — ValueFeature drops `change`; OverlayFeature switches to `watch(current)`.**

`change` today fires inside `watch(current, ...)`, so `watch(current)` gives the
same timing. The sole non-test consumer (`OverlayFeature`, line 48) only checks
that a change happened — no payload — so switching is a one-line edit.

---

## 3. User Stories

**US-1:** As a feature author handling a keyboard event, I write one line to set
the desired post-edit caret position without needing to know about recovery
scheduling or controlled-mode echo timing.

- **AC-1.1** `store.caret.range({start: X, end: X})` written in the same
  microtask as `store.value.replaceRange(...)` is applied by DomFeature after the
  next render, regardless of whether the parent echoes the value synchronously
  or asynchronously.
- **AC-1.2** If `caret.range` is not updated by the caller, the signal retains its
  previous value, and DomFeature re-applies it to the new DOM after render
  (caret stays where it was, clamped to valid bounds).

**US-2:** As a user interacting with the editor, my selection (click, keyboard
navigation) is captured in `caret.range` automatically and survives re-renders
triggered by value changes I didn't initiate.

- **AC-2.1** A `selectionchange` or `focusin` event in the editor writes
  `caret.range` from the real DOM selection without any manual call.
- **AC-2.2** If a value change re-renders the editor without updating `caret.range`,
  the range is re-applied to the new DOM.

**US-3:** When a value change removes the token the caret is inside, the editor
does not crash or leave DOM selection in an invalid state.

- **AC-3.1** After DOM reconciliation, if `caret.range` falls outside `[0,
value.length]`, it is clamped and a `recoveryFailed` diagnostic is emitted.
- **AC-3.2** If `caret.range` is `undefined`, DomFeature skips the apply step
  silently.

---

## 4. Detailed Design

### 4.1 CaretFeature (target shape)

```ts
export class CaretFeature {
    // Single source of truth for caret / selection state.
    // Structural equality prevents spurious DOM→signal→DOM loops.
    readonly range = signal<RawRange | undefined>(undefined, {
        equals: (a, b) => a === b || (a !== undefined && b !== undefined && a.start === b.start && a.end === b.end),
    })

    // Token-anchored view derived from range + tokens. Read-only computed.
    // Used by: arrowNav, DomFeature#clearStaleCaretLocation (cleared by nulling range).
    readonly location: Computed<CaretLocation | undefined>

    // Unchanged.
    readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

    constructor(parsing: ParsingFeature, dom: DomFeature) {
        this.location = computed(() => deriveLocation(this.range(), dom.index(), parsing.tokens()))
    }
}
```

`recovery` signal is removed. `location` becomes readonly (no `.set()` path).

### 4.2 ValueFeature (target shape)

```ts
export class ValueFeature {
    readonly isControlledMode = computed(() => this.props.value() !== undefined)

    readonly current = computed<string>({
        initial: () => this.props.value() ?? this.props.defaultValue() ?? '',
        get: field => (this.isControlledMode() ? (this.props.value() ?? '') : field()),
        set: (next, field) => {
            if (next === undefined) return
            if (!this.isControlledMode()) field(next)
            this.props.onChange()?.(next)
        },
    })

    constructor(
        private readonly lifecycle: LifecycleFeature,
        private readonly props: PropsFeature
    ) {
        lifecycle.onMounted(() => {
            this.#accept(this.current())
        })
    }

    replaceRange(range: RawRange, replacement: string): void {
        const cur = this.current()
        if (this.props.readOnly()) return
        if (range.start < 0 || range.end < range.start || range.end > cur.length) return
        const next = cur.slice(0, range.start) + replacement + cur.slice(range.end)
        if (next === cur) return
        this.current(next)
    }

    replaceAll(next: string): void {
        return this.replaceRange({start: 0, end: this.current().length}, next)
    }

    #accept(value: string): void {
        /* no-op; hook preserved for future lifecycle use */
    }
}
```

Removed: `change` event, `{recover}` option, `#pending`, `caret` constructor arg,
`CaretFeature` import.

### 4.3 `deriveLocation` — location computation rule

```ts
function deriveLocation(
    range: RawRange | undefined,
    index: TokenIndex,
    tokens: readonly Token[]
): CaretLocation | undefined {
    if (!range) return undefined
    const pos = range.start // use anchor; selection uses start
    return resolveCaretLocation(pos, index, tokens)
}
```

Role mapping (same four values as today):

| Condition                                                    | `role`             |
| ------------------------------------------------------------ | ------------------ |
| `pos` falls in a row element (drag mode)                     | `'row'`            |
| `pos` falls inside a mark token that is not a text surface   | `'token'`          |
| `pos` falls inside a text surface of a token                 | `'text'`           |
| `pos` falls inside a mark descendant element (slot children) | `'markDescendant'` |

Returns `undefined` if `pos` is outside all indexed paths (stale state after a
value change; consumers must handle `undefined`).

### 4.4 DomFeature apply effect

Replaces `#applyPendingRecovery()`. Called from the existing post-render hook
(currently at the end of `reconcile()`, around line 422).

```
#applyRangeToDOM():
  if caret.selecting() === 'drag' → return   (live drag selection, do not clobber)
  range = caret.range()
  if range is undefined → return
  if range is out of bounds → clamp, emit 'recoveryFailed' diagnostic, write clamped to caret.range
  if range.start === range.end:
    result = placeCaretAtRawPosition(range.start)   // affinity defaults to 'after'
  else:
    result = #placeSelection({range, direction: undefined})
  if !result.ok:
    caret.range(undefined)
    emit 'recoveryFailed' diagnostic
```

The equality option on `range` ensures that if `#applyRangeToDOM` writes the
same value back (clamped = already in bounds), no second cycle fires.

### 4.5 DOM→signal wiring

**`focus.ts`** replaces `caret.location(...)` writes with `caret.range(...)`:

```ts
// focusin:
const rawSel = store.dom.readRawSelection()
if (rawSel.ok) store.caret.range(rawSel.value.range)
else store.caret.range(undefined)

// focusout:
store.caret.range(undefined)
```

**`selection.ts`** `selectionchange` handler replaces `caret.location(...)`:

```ts
const rawSel = store.dom.readRawSelection()
if (rawSel.ok) store.caret.range(rawSel.value.range)
else if (result.reason !== 'control') store.caret.range(undefined)
```

**`DomFeature#clearStaleCaretLocation`** renamed `#clearStaleRange`:

```ts
#clearStaleRange(): void {
  const range = this.caret.range()
  if (range === undefined) return
  const maxPos = this.value.current().length
  if (range.start > maxPos || range.end > maxPos) {
    this.caret.range(undefined)
  }
}
```

Called at the same point as today (after DOM index rebuild, before apply).

### 4.6 OverlayFeature change detection

`watch(this.value.change, ...)` at line 48 → `watch(this.value.current, ...)`.
Behavior is identical because `change` was fired only when `current` changed.

---

## 5. Output Contract

### CaretFeature public API (after migration)

| Member      | Type                                   | Description                             |
| ----------- | -------------------------------------- | --------------------------------------- |
| `range`     | `Signal<RawRange \| undefined>`        | Caret or selection as raw value offsets |
| `location`  | `Computed<CaretLocation \| undefined>` | Token-anchored view; read-only          |
| `selecting` | `Signal<'drag' \| 'all' \| undefined>` | Unchanged                               |

Removed: `recovery: Signal<CaretRecovery | undefined>`.

### ValueFeature public API (after migration)

| Member                             | Type                | Description      |
| ---------------------------------- | ------------------- | ---------------- |
| `isControlledMode`                 | `Computed<boolean>` | Unchanged        |
| `current`                          | `Computed<string>`  | Unchanged        |
| `replaceRange(range, replacement)` | `void`              | No `options` arg |
| `replaceAll(next)`                 | `void`              | No `options` arg |

Removed: `change: Event<void>`.

### Types changed

`CaretRecovery` type in `editorContracts.ts` is deleted (no consumers remain
after migration). `CaretLocation` shape is unchanged.

---

## 6. Error Handling

| Condition                                                      | Behaviour                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `caret.range` is out of bounds at apply time                   | Clamp to `[0, value.length]`; emit `recoveryFailed`; write clamped back so equality check suppresses re-fire |
| `placeCaretAtRawPosition` returns `!ok`                        | Write `caret.range(undefined)`; emit `recoveryFailed`                                                        |
| `deriveLocation` receives a position outside all indexed paths | Return `undefined`; callers guard on `undefined`                                                             |
| Apply effect fires during drag selection                       | Skip silently; no diagnostic                                                                                 |

---

## 7. Testing Strategy

### 7.1 Unit tests — `ValueFeature.spec.ts`

The `replaceRange()` block (lines 102–192) tests that `caret.recovery` is
scheduled on accept and gated by controlled-mode echo. These tests become:

| Old assertion                                                      | New assertion                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `expect(store.caret.recovery()).toBe(recovery)`                    | `expect(store.caret.range()).toEqual({start: X, end: X})`        |
| `expect(store.caret.recovery()).toBeUndefined()`                   | (test removed — gating is no longer ValueFeature's job)          |
| test "keeps controlled accepted value until matching echo"         | retained: tests `value.current` timing; caret assertions removed |
| test "clears pending recovery when controlled echo does not match" | removed: no pending state                                        |
| test "does not set recovery when parent ignores the change"        | removed: no pending state                                        |

New test: `replaceRange does not write caret.range — caller owns it`.

### 7.2 Unit tests — `CaretFeature.spec.ts`

| Scenario                           | New test                                                    |
| ---------------------------------- | ----------------------------------------------------------- |
| `recovery` signal exposed          | removed                                                     |
| `range` signal structural equality | `writing equal range does not notify subscribers`           |
| `location` derived from range      | `location returns undefined when range is undefined`        |
| `location` role mapping            | `location returns text role for position inside text token` |

### 7.3 Unit tests — `DomFeature.spec.ts`

| Old test                                                                       | New test                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| "clears pending caret recovery and emits diagnostics when placement fails"     | "clears range and emits recoveryFailed when placement fails" |
| "clears pending selection recovery and emits diagnostics when placement fails" | same, for selection range                                    |

New test: `apply effect does not fire during drag selection`.

New test: `DOM→signal write does not trigger second apply when positions match`
(verifies the equality-option loop-suppression).

### 7.4 Integration check

Run `pnpm test` after each phase gate. All 313 core + 171 React + 157 Vue tests
must remain green between phases.

---

## 8. Performance Considerations

- The apply effect runs on every render and on every `caret.range` write.
  `readRawSelection` calls `window.getSelection()` — cheap browser call.
  No regression expected; today's `#applyPendingRecovery` runs on every render.
- Structural equality on `range` prevents the apply effect from re-firing when
  DOM writes and reads produce the same `{start, end}` — a mild improvement
  over today.
- `deriveLocation` (computed) runs only when `range` or `tokens` changes. It
  walks the token tree once per caret move. Token trees are small for typical
  inputs; no performance concern.

---

## 9. Future Considerations

- **Auto-transform on edit**: callers could write `caret.range` via a helper that
  auto-computes `range.start + replacement.length` for the common case. This is
  a thin convenience wrapper, not a feature; intentionally excluded from this
  spec.
- **Undo/redo**: `caret.range` could be snapshotted alongside value in a future
  history stack. The signal shape is already amenable.

---

## 10. Dependencies

No new package dependencies. Uses `signal()` with the existing `equals` option
(already supported — `signal.ts:345`).

---

## 11. Implementation Phases

### Phase dependency graph

```
S1.1 (Types & contracts)
 |
 |── S1.2 (CaretFeature restructure)
 |    |
 |    |── S1.3 (DomFeature apply + DOM→signal)  ─┐
 |    |                                           │ parallel
 |    └── S1.4 (ValueFeature pure)               ─┤
 |                                                │
 |── S1.5 (Call site migration)  ←────────────────┘
      |
      └── S1.6 (Bridge removal + docs)

Parallelizable: S1.3 and S1.4 after S1.2.
```

---

### S1.1: Types & Contracts

**Scope:** Define the new API surface in types only. No runtime changes.

**Size estimate:** ~2 files, ~20 lines changed.

**Contracts consumed:** None.

**Contracts exposed:**

- `caret.range: Signal<RawRange | undefined>` (add alongside existing signals)
- `caret.location: Computed<CaretLocation | undefined>` (declare type only)
- `CaretRecovery` marked `@deprecated` with removal note pointing to S1.6

**Gate:** `pnpm run typecheck && pnpm test`

**Verification:** No behavioral change. Grep confirms `range` is present on
`CaretFeature`; `recovery` still exists. All existing tests pass unchanged.

**Review tier:** gate-only

**Dependencies:** None.

---

### S1.2: CaretFeature Restructure

**Scope:** Add `range` signal (with equality option). Add `location` computed.
Keep `recovery` and imperative `location` writes as deprecated bridges.

**Size estimate:** ~2 files (`CaretFeature.ts`, new `deriveLocation.ts`), ~60 lines.

**Contracts consumed:** `parsing.tokens`, `dom.index` (for computed).

**Contracts exposed:**

- `range: Signal<RawRange | undefined>` — live, structural-equal
- `location: Computed<CaretLocation | undefined>` — derived (but still readable via old write path during bridge period)

**Gate:** `pnpm test`

**Verification:**

1. `store.caret.range` is a function (signal).
2. Writing `{start: 5, end: 5}` twice does not trigger a second notify (verify
   with a `watch` spy).
3. `store.caret.location()` returns `undefined` when `range` is `undefined`.

**Review tier:** spot-check

**Dependencies:** S1.1.

---

### S1.3: DomFeature Apply + DOM→Signal Wiring

**Scope:** Replace `#applyPendingRecovery()` with `#applyRangeToDOM()`.
Replace `caret.location(...)` writes in `focus.ts`, `selection.ts`, and
`DomFeature` (lines 265, 746, 837, 841) with `caret.range(...)` writes.
Rename `#clearStaleCaretLocation` → `#clearStaleRange`.

**Size estimate:** ~3 files (`DomFeature.ts`, `focus.ts`, `selection.ts`), ~80 lines changed.

**Contracts consumed:** `caret.range`, `caret.selecting`.

**Contracts exposed:** (internal — no public API change)

**Gate:** `pnpm test`

**Verification:**

1. Place caret at position 3 in a plain text editor, trigger a value change that
   re-renders. After render, DOM caret is still at position 3.
2. Set `caret.range({start: 0, end: 5})` programmatically. After next render,
   DOM shows a 5-char selection.
3. Set an out-of-bounds range. `dom.diagnostics` emits `recoveryFailed`.
4. During a drag-select gesture (`selecting === 'drag'`), apply effect does not
   move the DOM selection.

**Review tier:** full-review

**Dependencies:** S1.2.

---

### S1.4: ValueFeature Purification

**Scope:** Drop `caret` constructor arg, `change` event, `{recover}` option on
`replaceRange`/`replaceAll`, `#pending`, `#accept`. Switch `OverlayFeature`
line 48 from `watch(value.change)` to `watch(value.current)`.

**Size estimate:** ~3 files (`ValueFeature.ts`, `ValueFeature.spec.ts`,
`OverlayFeature.ts`), ~60 lines removed, ~10 changed.

**Contracts consumed:** None (decoupled from caret).

**Contracts exposed:**

- `replaceRange(range, replacement): void` — no third argument
- `replaceAll(next): void` — no second argument
- `change` event — removed from public API

**Gate:** `pnpm test && pnpm run typecheck`

**Verification:**

1. TypeScript compiler emits no errors after dropping `caret` arg.
2. `store.value.change` is `undefined` (or produces a type error — verify removed
   from Store).
3. `store.value.replaceRange({start:0,end:0}, 'x')` accepts exactly two args.
4. OverlayFeature trigger test: overlay still probes on value change.

**Review tier:** spot-check

**Dependencies:** S1.2 (so `caret.range` exists for call sites), S1.3
(so `recovery` is no longer needed for apply).

---

### S1.5: Call Site Migration

**Scope:** Replace every `{recover: ...}` at ~15 call sites with `caret.range(...)`.
Sites:

| File                            | Sites | Old                                                   | New                                                |
| ------------------------------- | ----- | ----------------------------------------------------- | -------------------------------------------------- |
| `keyboard/input.ts`             | 4     | `{recover: {kind:'caret', rawPosition: X}}`           | `store.caret.range({start:X,end:X})`               |
| `keyboard/blockEdit.ts`         | 8     | same                                                  | same                                               |
| `mark/MarkController.ts`        | 1     | `{recover: undefined}`                                | (line removed — no-op)                             |
| `clipboard/ClipboardFeature.ts` | 1     | `{recover: {kind:'caret', rawPosition: range.start}}` | `caret.range({start:range.start,end:range.start})` |
| `overlay/OverlayFeature.ts`     | 1     | `{recover: {kind:'caret', rawPosition: ...}}`         | `caret.range({start:X,end:X})`                     |
| `drag/DragFeature.ts`           | 4     | `{recover: this.#recoverAfterDrag(...)}`              | `caret.range(this.#recoverAfterDrag(...))`         |

`#recoverAfterDrag` today returns `CaretRecovery | undefined`. After migration it
returns `RawRange | undefined`. Callers do:

```ts
const range = this.#recoverAfterDrag(action, rows, newValue)
if (range) this.caret.range(range)
this.value.replaceAll(newValue)
```

**Size estimate:** ~6 files, ~30 lines changed.

**Contracts consumed:** `caret.range` (write path).

**Contracts exposed:** (no public API change)

**Gate:** `pnpm test && pnpm run typecheck && pnpm run lint:check`

**Verification:**

1. Type a character — caret advances one position.
2. Press Backspace at start of merged blocks — caret lands at join point.
3. Paste text — caret lands after pasted content.
4. Drag a block — caret follows the dragged row.
5. Select item from overlay — caret lands after inserted annotation.

**Review tier:** full-review

**Dependencies:** S1.3, S1.4.

---

### S1.6: Bridge Removal + Docs

**Scope:** Delete `caret.recovery` signal, delete the deprecated `CaretRecovery`
type from `editorContracts.ts`, delete imperative `location` write paths (now
dead code), delete `#applyPendingRecovery` (already replaced). Update READMEs
and architecture doc.

**Size estimate:** ~6 files, ~100 lines removed, ~50 docs lines changed.

**Contracts consumed:** None (cleanup only).

**Contracts exposed:** Final clean API surface (see §5).

**Gate:** `pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`

**Verification:**

1. `grep -r 'caret\.recovery\|CaretRecovery\|recover:' packages/core/src` returns
   zero matches outside the deleted spec and test files.
2. Architecture doc updated to reflect new caret ownership model.
3. Full suite green.

**Review tier:** spot-check

**Dependencies:** S1.5.

---

## 12. Acceptance Summary

1. `caret.range: Signal<RawRange | undefined>` exists with structural equality.
2. `caret.location: Computed<CaretLocation | undefined>` is derived; no imperative
   writes anywhere in the codebase.
3. `caret.recovery` signal does not exist.
4. `ValueFeature` has no `CaretFeature` import, no `change` event, no `{recover}`
   parameter.
5. DomFeature's `#applyRangeToDOM` (continuous effect) applies `caret.range` after
   every render; `#applyPendingRecovery` does not exist.
6. DOM `focusin` / `selectionchange` write `caret.range`; no site writes
   `caret.location` imperatively.
7. `CaretRecovery` type does not exist in `editorContracts.ts`.
8. All 313 core + 171 React + 157 Vue tests pass.
9. `pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check` pass.
10. Architecture doc (`development/architecture.md`) reflects the new ownership model.
