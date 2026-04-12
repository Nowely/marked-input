# Store Layer Review

Review of `@markput/core` store and related code — reactive signals, features, DOM proxies, and event bus.

## Design Plan

### P0 — Bugs (must fix)

| #   | Issue                                                                        | File(s)                   | Approach                                                                     |
| --- | ---------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| 1   | FocusFeature leaks 2 watch subscriptions per enable/disable cycle            | `FocusFeature.ts:40-48`   | Wrap both `watch()` calls in `effectScope`, store and dispose in `disable()` |
| 2   | DragFeature double-enable leaks watcher                                      | `DragFeature.ts:13-14`    | Add `if (this.#unsub) return` guard at top of `enable()`                     |
| 3   | `isCaretAtBeginning`/`isCaretAtEnd` return `undefined` as falsy boolean      | `NodeProxy.ts:37-48`      | Change early returns to `return false`                                       |
| 4   | `replaceAllContentWith` bypasses change pipeline, never sets `previousValue` | `InputFeature.ts:261-290` | Route through `store.state.innerValue()` or explicitly set `previousValue`   |
| 5   | `FocusFeature.disable()` leaves stale DOM ref in `nodes.focus`               | `FocusFeature.ts:51-62`   | Add `this.store.nodes.focus.clear()` in `disable()`                          |

### P1 — Inconsistencies (should fix)

| #   | Issue                                                     | File(s)                     | Approach                                                                                                          |
| --- | --------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 6   | No standard enable-guard convention                       | All features                | Adopt `effectScope`-based `if (this.#scope) return` as canonical pattern; for DOM-only features use handler check |
| 7   | Inconsistent disable() cleanup ordering                   | All features                | Standardize order: reset state -> remove DOM listeners -> dispose scope -> null refs                              |
| 8   | NodeProxy `length` returns `-1` vs `content` returns `''` | `NodeProxy.ts:67`           | Change `length` to return `0` when no target                                                                      |
| 9   | `seq` vs `id` for same uniqueness-counter concept         | `signal.ts:45,177`          | Unify to one name (recommend `seq`)                                                                               |
| 10  | `attachContainer`/`attachGrip` duplicate preamble         | `BlockStore.ts:28-29,72-73` | Extract shared setup to private method                                                                            |

### P2 — Readability (nice to fix)

| #   | Issue                                              | File(s)               | Approach                                                               |
| --- | -------------------------------------------------- | --------------------- | ---------------------------------------------------------------------- |
| 11  | `signal()` 106 lines, 3 near-identical branches    | `signal.ts:36-142`    | Refactor to single path parameterized by equality function             |
| 12  | `BlockRegistry.get` has silent create semantics    | `BlockRegistry.ts:6`  | Rename to `getOrCreate`                                                |
| 13  | `_cls`/`_sty` destructuring unexplained            | `Store.ts:112`        | Add comment: "Strip className/style to avoid duplicate keys in spread" |
| 14  | Bare `return` statements                           | `NodeProxy.ts:97,103` | Remove dead trailing `return`                                          |
| 15  | `#blockIndex` defaults to `0` (valid index)        | `BlockStore.ts:21`    | Change to `-1` or add comment                                          |
| 16  | `Span`/`Mark`/`Overlay` typed as `Signal<unknown>` | `Store.ts:60-62`      | Create `type FrameworkComponent = unknown` alias to document intent    |

## Detailed Findings

### P0-1: FocusFeature leaks watch subscriptions

`packages/core/src/features/focus/FocusFeature.ts:40-48`

Two `watch()` calls in `enable()` return dispose functions that are never stored. On `disable()`, only DOM listeners are removed; the reactive subscriptions persist forever. Every other feature that uses `watch()` wraps it in `effectScope` (SystemListenerFeature, OverlayFeature, ContentEditableFeature, ParseFeature, TextSelectionFeature) or stores the unsub directly (DragFeature). FocusFeature is the sole exception.

After N enable/disable cycles, there are 2N live watch subscriptions — the guard `if (this.#focusinHandler) return` prevents re-entry, but `disable()` clears `#focusinHandler`, so each cycle adds two more leaked watchers.

### P0-2: DragFeature missing enable guard

`packages/core/src/features/drag/DragFeature.ts:13-14`

`enable()` immediately overwrites `this.#unsub` with the new watch disposer. If called twice without an intervening `disable()`, the first watcher's dispose function is lost and that subscription leaks.

### P0-3: `isCaretAtBeginning`/`isCaretAtEnd` return `undefined` instead of `boolean`

`packages/core/src/shared/classes/NodeProxy.ts:37-48`

Both getters have an early `if (!this.target) return` with no value, returning `undefined`. Callers (e.g., `InputFeature.ts:63-64`) test these with `!focus.isCaretAtBeginning` — when target is undefined, `!undefined === true`, which means "caret is not at beginning" when there is no target. This can cause subtle bugs.

### P0-4: `replaceAllContentWith` bypasses change pipeline

`packages/core/src/features/input/InputFeature.ts:261-290`

This function calls `onChange()` directly and sets tokens manually, instead of going through `innerValue` -> SystemListenerFeature watch -> parse -> onChange. Two problems:

1. Creates two divergent "change" code paths
2. Never updates `store.state.previousValue()` — subsequent operations that read `previousValue` (e.g., CopyFeature cut handler at line 57) get stale data

### P0-5: FocusFeature `disable()` leaves stale DOM ref

`packages/core/src/features/focus/FocusFeature.ts:51-62`

On disable, DOM listeners are removed but `store.nodes.focus.target` is not cleared. After unmount, the NodeProxy may hold a stale reference to a detached DOM element.

### P1-6: No standard enable-guard convention

Features use three different patterns to prevent double-enable:

| Pattern                     | Features                                                                       |
| --------------------------- | ------------------------------------------------------------------------------ |
| `if (this.#scope) return`   | SystemListenerFeature, OverlayFeature, ContentEditableFeature, ParseFeature    |
| `if (this.#handler) return` | FocusFeature, ArrowNavFeature, InputFeature, CopyFeature, TextSelectionFeature |
| No guard                    | DragFeature                                                                    |

### P1-7: Inconsistent disable() cleanup ordering

- TextSelectionFeature resets `selecting` state _before_ disposing scope (intentional but undocumented — so ContentEditableFeature.sync() still fires)
- SystemListenerFeature disposes scope first, then nulls it
- OverlayFeature removes DOM listeners, then calls `#disableClose()`, then disposes scope
- Some guard with `if (!container || !this.#handler)` and skip cleanup entirely; others use `?.`

### P1-8: NodeProxy sentinel values inconsistent

- `length` returns `-1` when no target
- `content` returns `''` when no target
- `caret` getter returns `-1`, setter silently no-ops

`length` of empty-string content should logically be `0`, not `-1`.

### P1-9: `seq` vs `id` for same concept

- `signal.ts:45` — `{v: T; seq: number}` in the `equals === false` branch
- `signal.ts:178` — `{v: T; id: number}` in `event()`

Both serve the identical purpose (uniqueness counter to force reactivity), different names.

### P1-10: `attachContainer`/`attachGrip` duplicate preamble

`BlockStore.ts:28-29` and `72-73` both start with:

```typescript
this.#blockIndex = blockIndex
this.#dragAction = actions.dragAction
```

### P2-11: `signal()` three near-identical branches

`signal.ts:36-142` — 106 lines with three branches (equals===false, equals===function, default) that repeat the same structure: `_default`, `hasDefault`, `inner`, `read()`, `isReadonly`, callable. The main difference is how equality is checked before writing.

### P2-12: `BlockRegistry.get` has silent create semantics

`BlockRegistry.ts:6-12` — `get(token)` creates a new BlockStore if one doesn't exist. The name `get` implies read-only access.

### P2-13: `_cls`/`_sty` destructuring unexplained

`Store.ts:112` — `className` and `style` are stripped from `resolveSlotProps` via discard variables, only to be re-composed separately. No comment explains why.

### P2-14: Bare `return` statements

`NodeProxy.ts:97` in `setCaretToEnd()` and `NodeProxy.ts:103` in `focus()` — trailing `return` statements that serve no purpose.

### P2-15: `#blockIndex` defaults to `0`

`BlockStore.ts:21` — `0` is a valid block index. Always overwritten before use so no real bug, but the default is misleading.

### P2-16: `Span`/`Mark`/`Overlay` typed as `Signal<unknown>`

`Store.ts:60-62` — Framework component types stored as raw `unknown`. A named type alias would communicate intent.

## Rejected Issues (verified invalid)

| Issue                                    | Reason                                                    |
| ---------------------------------------- | --------------------------------------------------------- |
| CopyFeature missing enable guard         | Has `if (this.#copyHandler) return` at line 39            |
| BlockRegistry WeakMap losing BlockStores | Framework ref callbacks handle cleanup via `attach(null)` |
| BlockStore document-level listener leaks | Cleaned via `attachMenu(null)` from framework lifecycle   |
| NodeProxy.textContent null               | Never null for HTMLElement at runtime                     |
| signal() can't store undefined           | Intentional default-fallback design for props             |
