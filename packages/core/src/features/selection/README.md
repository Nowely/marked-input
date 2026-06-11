# Selection Feature

Owns the reactive caret/selection state and orchestrates DOM placement after
render and re-index. Exposed as `store.selection`. All raw DOM mechanics
(Selection/Range/TreeWalker) are handled by `store.tokens`; this module is
policy-only.

## Layout

- `SelectionController.ts` — reactive state, DOM event listeners, and caret
  placement. ~208 lines; delegates every DOM read/write to `store.tokens`.

## Public Surface

- `range: Signal<Range | undefined>` — single source of truth for caret/selection
  (`{start, end}` absolute positions). Writes trigger `#applyRange` which clamps
  to value length, then calls `tokens.placeCaret` or `tokens.selectRange`.
- `position: Signal<number | undefined>` — writable computed bound to
  `range().start`; writes collapse the range to `{start: pos, end: pos}`.
- `isAllSelected: Computed<boolean>` — true when the range spans the entire raw
  value.
- `isUserSelecting: Signal<boolean>` — true while the user is dragging a
  selection. When true, `#applyRange` skips DOM placement and
  `#reconcileSurfaces` flips text surfaces to `contenteditable="false"` so the
  browser owns the selection.
- `selectAll()` — sets `range` to `[0, value.length]`.
- `focusFirst()` — collapses to the first indexed token's start, or falls back to
  `container.focus()`.
- `placeAtAddress(address, boundary?)` — collapses to the `'start'` or `'end'`
  of a specific token address; stores the preferred address so the next
  `#applyRange` can disambiguate tokens sharing a boundary position.
- `readRaw()` — delegates to `tokens.readSelection()`; returns the current window
  selection as a `RawSelection` or `undefined`. Used by keyboard, clipboard, and
  overlay consumers.

## Wiring

Inside `host.onMounted`, `SelectionController` registers three DOM listeners and
four watches:

**Listeners** (all private):
- `#focusEmptyEditorOnClick` — focuses the first child when the editor has a
  single empty text token.
- `#trackSelection` — syncs `range` from `tokens.readSelection()` on `focusin`,
  `focusout`, and `selectionchange`; clears range when focus leaves the container
  or lands in a control root.
- `#trackUserSelecting` — sets/clears `isUserSelecting` by watching `mousedown` /
  `mousemove` / `mouseup` / `selectionchange`.

**Watches**:
- `tokens.indexed` → `#reconcileSurfaces` then `#applyRange` (re-applies the
  stored range after each DOM rebuild).
- `props.readOnly` → `#reconcileSurfaces`.
- `isUserSelecting` → `#reconcileSurfaces`.
- `range` → `#applyRange`.
