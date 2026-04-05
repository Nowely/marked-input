# Cross-Select Design

**Date:** 2026-04-05  
**Branch:** `cross-select`  
**Scope:** Visual cross-element selection in both inline and drag modes. Future: copy plain value, type/delete while cross-selected.

---

## Problem

Users cannot drag-select text across mark tokens.

**Root cause:** `ContentEditableController` sets each text `<span>` to `contenteditable="true"` explicitly. This makes every span its own independent editing host. The browser confines drag-selection to the current editing host — it cannot cross to a sibling span through a mark.

The container `<div>` has no `contenteditable` attribute. Marks have no `contenteditable` set by the framework (user components may set `"false"` themselves).

```
<div>                                          ← plain container
  <span contenteditable="true">hello </span>  ← editing host A  ← selection trapped here
  <mark>world</mark>                          ← not in any editing host
  <span contenteditable="true"> foo</span>    ← editing host B  ← unreachable by drag
```

The existing `TextSelectionController` had a partial workaround (toggle-false-then-restore) that only fired for drags starting **outside** the container. It did not handle the common case of dragging within the container across element boundaries.

---

## Solution

When a cross-element drag is detected, set all `contenteditable="true"` descendants of the container to `"false"`. With no active editing hosts anywhere, the browser treats the content as normal non-editable text and allows free drag-selection across all elements — identical to selecting text on a regular webpage.

When the selection ends (collapses), restore correct `contenteditable` values by triggering `ContentEditableController.sync()`.

```
During cross-select:
  <div>                                           ← plain container (unchanged)
    <span contenteditable="false">hello </span>  ← not an editing host — selectable
    <mark>world</mark>                           ← selectable (unchanged)
    <span contenteditable="false"> foo</span>    ← not an editing host — selectable
```

Works identically in drag mode — block divs for text rows also have `contenteditable="true"` set by `ContentEditableController`, so the same flip covers them.

---

## Architecture

Communication follows the existing pattern: controllers communicate only through `store.state` signals, never by calling each other directly.

### State

No new state fields. `store.state.selecting: 'drag' | 'all' | undefined` is the existing signal.

`'drag'` means a cross-element selection is active. `'all'` means Ctrl+A select-all. `undefined` means no selection mode active.

### `TextSelectionController` changes

**New subscription** (in `enable()`): reacts to `selecting` becoming `'drag'`:

```typescript
this.store.state.selecting.on(value => {
    if (value !== 'drag') return
    const container = this.store.refs.container
    if (!container) return
    container
        .querySelectorAll<HTMLElement>('[contenteditable="true"]')
        .forEach(el => (el.contentEditable = 'false'))
})
```

**`mousemove` handler** — reworked: the existing cross-element detection condition (`isPressed && isNotInnerSome && isInside`) is kept. When it fires and `selecting !== 'drag'` yet, call `store.state.selecting.set('drag')`. The subscription above handles the actual DOM flip reactively. Remove the old toggle-false-then-restore block.

**`selectionchange` handler** — simplified: if `selecting === 'drag'` and the selection is now collapsed, call `store.state.selecting.set(undefined)`. The `ContentEditableController` subscription handles restoration. Remove the old toggle trick entirely.

**`mouseup` handler** — simplified: clear `isPressed` and `pressedNode`. If `selecting === 'drag'` and the selection is now collapsed, call `store.state.selecting.set(undefined)`. If `selecting !== 'drag'` (normal click, no cross-element drag happened), do nothing. If `selecting === 'drag'` and there is still an active selection, leave it — `selectionchange` will clear it when the selection eventually collapses.

**`disable()`** — unsubscribe the new `selecting` subscription. If `selecting === 'drag'` on disable, set to `undefined` (triggers `ContentEditableController.sync()` for clean teardown).

### `ContentEditableController` changes

**New subscription** (in `enable()`), alongside the existing `readOnly` subscription:

```typescript
this.store.state.selecting.on(value => {
    if (value === undefined) this.sync()
})
```

When `selecting` returns to `undefined` (selection ended), `sync()` restores the correct `contentEditable` values for all spans/blocks. `sync()` is already the authoritative source for these values — no duplication.

**`disable()`** — unsubscribe the new `selecting` subscription.

---

## Sequencing

```
mousedown (inside container, any element)
    → #isPressed = true, #pressedNode = target

mousemove (crossing to different element)
    → isPressed && isNotInnerSome && isInside
    → store.state.selecting.set('drag')
        → TextSelectionController subscription fires:
            querySelectorAll('[contenteditable="true"]').forEach → 'false'
    → browser can now drag-select freely

mouseup (selection still active)
    → #isPressed = false, #pressedNode = null
    → selection not collapsed → do nothing
    → selection remains visible, spans remain "false"

selectionchange (user clicks elsewhere, selection collapses)
    → selecting === 'drag' && sel.isCollapsed
    → store.state.selecting.set(undefined)
        → ContentEditableController subscription fires:
            sync() restores spans to contentEditable = 'true'
```

---

## Why no `#flippedElements` tracking

Saving which elements were flipped is unnecessary because `ContentEditableController.sync()` is already the authoritative function for computing the correct `contentEditable` values for every element. Calling `sync()` on selection end is equivalent to a perfect restore, and it handles both inline and drag mode correctly. The signal subscription (`selecting.on`) is the coordination mechanism — no manual tracking needed.

---

## Known limitation (MVP)

While `selecting === 'drag'` is active and spans have `contenteditable="false"`, typing produces no effect (no editing host). This is acceptable for MVP. If the user types before releasing the mouse, nothing happens. After mouseup the selection remains; if they then type, `handleBeforeInput` does not yet handle the cross-selection replace case.

---

## Future extensions

Both attach to the existing `selecting === 'drag'` signal — no state shape changes needed.

### Copy plain value

Add a `copy` event listener in `TextSelectionController.enable()`. When `selecting === 'drag'`:

1. Read `window.getSelection().{anchorNode, anchorOffset, focusNode, focusOffset}`
2. Map each to a raw-value offset using `getDomRawPos` logic (already exists in `KeyDownController` for drag-mode editing)
3. Call `e.clipboardData.setData('text/plain', rawValue.slice(start, end))`
4. `e.preventDefault()`

The selected range in raw-value terms will include full markup syntax for any marks within it (e.g. `@[Alice](123)` rather than `Alice`).

### Type / delete while cross-selected

Extend `handleBeforeInput` in `KeyDownController` with a `selecting === 'drag'` branch, mirroring the existing `selecting === 'all'` branch:

1. Compute cross-selection range in raw-value coordinates (same `getDomRawPos` mapping as copy)
2. Apply the edit (delete range, insert typed text, paste)
3. Call `store.applyValue(newValue)`
4. Call `store.state.selecting.set(undefined)` to end selection mode

---

## Files changed

| File | Change |
|------|--------|
| `packages/core/src/features/selection/TextSelectionController.ts` | Add `selecting` subscription, rework `mousemove` / `selectionchange` / `mouseup` handlers, update `disable()` |
| `packages/core/src/features/editable/ContentEditableController.ts` | Add `selecting` subscription for restore-on-undefined, update `disable()` |
