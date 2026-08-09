# Selection Feature

Owns the reactive caret/selection state and orchestrates DOM placement after
render and re-index. Exposed as `store.selection`. All raw DOM mechanics
(Selection/Range/TreeWalker) are handled by `store.tokens`; this module is
policy-only.

## Layout

- `SelectionController.ts` — reactive state, DOM event listeners, and caret
  placement; delegates every DOM read/write to `store.tokens`.

## Stored Form

The selection is stored as a pair of `NodeAnchor`s (`#anchors`), not as offsets
(spec D7). A node plus a local offset is what disambiguates two tokens sharing a
boundary position, and it survives an edit elsewhere in the document without
arithmetic. The numeric range is therefore **derived**, not stored: offsets move
whenever adoption shifts positions, and a stored copy would be a mirror nothing
resyncs. Because adoption writes positions as plain fields, `range` also reads a
`#generation` counter that the caret repair bumps once per adoption — otherwise
an anchor that survives an edit unchanged would keep reporting its old offset.

## Public Surface

- `range: Computed<Range | undefined>` — **read-only** projection of the stored
  anchors into `{start, end}` absolute positions, normalized low→high. Every
  offset-speaking consumer still reads it; nothing outside the class writes it.
- `position: Signal<number | undefined>` — writable computed bound to
  `range().start`. The setter resolves the offset through `tokens.anchorAt` and
  stores a collapsed anchor pair.
- `isAllSelected: Computed<boolean>` — true when the range spans the entire raw
  value.
- `isUserSelecting: Signal<boolean>` — true while the user is dragging a
  selection. When true, `#applySelection` skips DOM placement and the
  `isUserSelecting` watch on `#applyEditablePolicy` recomputes editability
  (setting surfaces non-editable so the browser owns the selection).
- `select(anchor, head?)` (`@internal`) — THE write. `selectAll`, `position` and
  `placeAtHandle` all go through it; the DOM sync writes `#anchors` directly
  because it must also be able to write `undefined`, which `select` cannot
  express.
- `repair(result)` (`@internal`) — post-adoption caret repair, called by the
  token layer inside the commit. Bumps `#generation`, then re-derives both
  anchors from `result.selectionBefore` through `result.map`.
- `selectAll()` — anchors at offset `0` and `value.length`. Node anchors, not the
  `'start'`/`'end'` edges: a later edit that grows the value must make
  `isAllSelected` false, and edge anchors would keep it true.
- `focusFirst()` — collapses to the first indexed token's start, or falls back to
  `container.focus()`.
- `placeAtHandle(handle, boundary?)` — collapses to the `'start'` or `'end'` of a
  specific token handle, storing that handle's own node as the anchor. No clamp
  and no preferred-handle stash: the node IS the disambiguator, an anchor cannot
  point past its own node, and `TokenHandle.placeCaret` bounds the local offset.
- `readRaw()` — returns `tokens.selection()?.raw`: the current window selection
  as a `RawSelection` or `undefined`. Used by keyboard, clipboard, and overlay
  consumers.

Together, `range` and `repair` are the `SelectionPort` `TokenModel` is
constructed with: `range` is the pre-adoption capture, `repair` the
post-adoption fix.

## Wiring

Inside `host.onMounted`, `SelectionController` registers three DOM listeners and
four watches:

**Listeners** (all private):

- `#focusEmptyEditorOnClick` — focuses the first child when the editor has a
  single empty text token.
- `#trackSelection` — syncs `#anchors` from `tokens.selection()` on `focusin`,
  `focusout`, and `selectionchange`; clears them when focus leaves the container
  or lands in a control root. It rewrites only when the DOM's numeric range
  differs from the derived one, because the DOM→anchor round-trip is not
  idempotent (`anchorAt` is right-affine, so a deliberately left-side anchor
  comes back as a different anchor with the same number).
- `#trackUserSelecting` — sets/clears `isUserSelecting` by watching `mousedown` /
  `mousemove` / `mouseup` / `selectionchange`.

**Watches**:

- `tokens.changed` → `#applySelection` (re-applies the stored anchors after each
  commit, once the DOM is consistent).
- `props.readOnly` → `#applyEditablePolicy` (computes `{editable, readOnly}`
  and hands it to `tokens.setEditable` — policy lives here, application in the
  model).
- `isUserSelecting` → `#applyEditablePolicy`.
- `#anchors` → `#applySelection`. The STORED anchors, not the derived `range`:
  at a shared boundary `placeAtHandle` changes the anchor without changing the
  number, so a `range` watch would never fire and the caret would never be
  placed (measured: 8 browser assertions).
