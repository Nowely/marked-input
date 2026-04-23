# Reactive Names Clarity Rename — Design

**Date:** 2026-04-23
**Scope:** Rename 12 reactive symbols (signals, computeds, events) across 4 core features (`value`, `mark`, `overlay`, `drag`) so that each name reads clearly within its feature namespace and describes what the symbol actually *is*, not what it was historically called.

**Non-goal:** This is a **naming pass, not a semantic refactor.** Signals stay signals; events stay events; consumer patterns stay the same. Suspected rudiments are flagged for a separate follow-up (see *Deferred* below).

---

## Context

The core Store exposes 11 feature modules. Each feature today exposes a set of reactive primitives (`signal`, `computed`, `event`). An in-progress refactor (`docs/superpowers/plans/2026-04-23-flatten-feature-api.md`) is flattening the per-feature `state`/`computed`/`emit` containers and will promote features from `store.feature.<name>.*` to `store.<name>.*`.

Once that flatten lands, the final call-site shape is `store.<feature>.<member>()`. At that point, several current names read poorly:

- Some tautologically repeat the feature name (`drag.drag`, `mark.mark`, `overlay.overlay*`).
- Some are not tautological but still obscure what the symbol represents (`value.previousValue`, `value.innerValue`).

This design fixes both classes of problem *by picking the clearest name within the feature's namespace*, not by mechanically stripping prefixes.

## Guiding principle

**Inside a feature's namespace, every symbol is already understood to be *about that feature*.** Extra words that re-state the feature name add nothing. Pick the name that, read in context (`store.<feature>.<name>(…)`), describes the role as plainly as possible.

Corollary: the goal is not shortest, it is clearest. `text` was rejected for `value.currentValue` even though it is short, because it introduces a new word (`text`) for a concept the feature already names (`value`). `current` won.

## Out of scope / Deferred

- **Features with already-clean names:** `lifecycle`, `parsing`, `caret`, `slots`, `keyboard`, `dom`, `clipboard`. No renames.
- **Rudiment audit:** `value.previousValue` exists primarily to seed `value.currentValue`'s fallback chain; its documented dedup purpose is not actively enforced in code. `value.innerValue` is a signal used purely as an event-with-payload (no consumer reads its value for meaning). Both deserve a semantic cleanup pass that may remove or remodel them — but that is a *behavioural* change that belongs in its own design, not mixed into this rename.
- **Flattening itself:** already designed and in progress (see plan linked above). This spec assumes the final flat shape.
- **`slots` DOM-ref rename (`container` → `root`):** considered and rejected. The DOM-ref sharing a name with `containerComponent`'s role is semantically accurate (the DOM node *is* the container), not confusing.

---

## The renames

### `value` feature — temporal triad + event

| Current | New | Type | Purpose |
|---|---|---|---|
| `previousValue` | `last` | signal | The last value we gave to `onChange` |
| `innerValue` | `next` | signal | The next value to commit (writing it triggers reparse + `onChange`) |
| `currentValue` | `current` | computed | The current effective text (`last() ?? props.value() ?? ''`) |
| `change` | `change` | event | Fired when a focused span's text was edited |

**Why this set is clearer:** `last / current / next` is a natural temporal triad — readers already understand the relative positioning without learning new vocabulary. `value.current()` cannot be confused with `props.value()` because the `.current` modifier explicitly selects "right now, effective". `value.next(v)` reads as an imperative at the call site (set the next value), matching its actual role as a write port.

### `mark` feature

| Current | New | Type | Purpose |
|---|---|---|---|
| `hasMark` | `enabled` | computed | Any `Mark` component configured on props or options |
| `mark` | `slot` | computed | Slot resolver: `(token) => [Component, props]` |
| `markRemove` | `remove` | event | Request mark deletion |

**Why `enabled` over `has`:** `has` is grammatically incomplete ("has what?"). `enabled` answers the real question — *is this store set up to do marks?* — and is a natural predicate for a gate like `if (!store.mark.enabled()) return`.

**Why `slot`:** matches the existing `MarkSlot` type name; parallels `overlay.slot` (see below) so "every feature that resolves components exposes a `slot` computed" becomes a structural regularity.

### `overlay` feature

| Current | New | Type | Purpose |
|---|---|---|---|
| `overlayMatch` | `match` | signal | Currently matched trigger (e.g. `@` typed + mention option found) |
| `overlay` (HTMLElement) | `element` | signal | The overlay's mounted DOM node |
| `overlaySlot` | `slot` | computed | Slot resolver (parallels `mark.slot`) |
| `overlaySelect` | `select` | event | User picked an option |
| `overlayClose` | `close` | event | Close the overlay |

**Why `element`:** the signal holds a raw `HTMLElement | null` used with `.contains()` for outside-click detection. `element` is the idiomatic name in this codebase for such refs. `node` would collide semantically with `store.nodes` (NodeProxy wrappers).

### `drag` feature

| Current | New | Type | Purpose |
|---|---|---|---|
| `drag` | `action` | event | Fired with a `DragAction` payload |

**Why `action`:** the payload type is `DragAction`. The event literally carries an action; the name matches.

---

## Final call-site shape

```ts
// Before (post-flatten, current names)
store.value.previousValue(serialized)
store.value.innerValue(nextValue)
const v = store.value.currentValue()

if (!store.mark.hasMark()) return
const [C, p] = store.mark.mark()(token)
store.mark.markRemove({token})

store.overlay.overlayMatch()
store.overlay.overlay(el)
store.overlay.overlaySelect({mark, match})
store.overlay.overlayClose()

store.drag.drag({type: 'reorder', source, target})

// After
store.value.last(serialized)
store.value.next(nextValue)
const v = store.value.current()

if (!store.mark.enabled()) return
const [C, p] = store.mark.slot()(token)
store.mark.remove({token})

store.overlay.match()
store.overlay.element(el)
store.overlay.select({mark, match})
store.overlay.close()

store.drag.action({type: 'reorder', source, target})
```

---

## Migration surface

Renames touch call sites across:

- `packages/core/src/` — feature implementations, tests, `Store.spec.ts`
- `packages/react/markput/src/` — `useOverlay`, `OverlayRenderer`, `Token`, `MarkedInput`
- `packages/vue/markput/src/` — `useOverlay`, `OverlayRenderer`, `Token`, `DragHandle`
- `packages/website/src/content/docs/` — `architecture.md`, `how-it-works.md` (if they reference symbols)

Mechanical rename for each symbol: a ripgrep over the old name (with word-boundary) followed by substitution. No semantic changes required.

## Risks

- **Only risk** is a reader familiar with old names being briefly confused by new ones. Mitigated by:
  - All renames are final-quality (no throwaway intermediate names).
  - The design doc serves as the lookup table.
  - Commit messages name both sides: `refactor(core): rename value.previousValue → last`.

## Testing

- Existing tests cover all 12 symbols. After rename, `pnpm test` must pass green with zero test logic changes — only reference updates.
- `pnpm run typecheck` — catches any missed call site (TypeScript will flag the old property name).

## Sequencing

This design assumes the flatten plan (`2026-04-23-flatten-feature-api.md`) is the current active migration. Renames can proceed:

- **After flatten fully lands** — preferred. Every call site is already at `store.<feature>.<member>()`, so this becomes pure symbol-renaming with no structural change.
- **In parallel, per-feature** — acceptable if a feature has already been flattened in isolation (e.g. `value` appears flat today while `mark` still has containers).

Either way, each rename is independent and can ship as its own focused commit scoped to one feature.
