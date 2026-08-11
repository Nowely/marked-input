---
title: Known Inconsistencies
description: Behavior differences between MarkedInput and native input/textarea elements
keywords: [inconsistencies, bugs, limitations, contenteditable, selection, keyboard, accessibility]
---

:::caution[Unverified against the current core]
This page was written and measured against the **pre-rewrite** tree, when the editor lived in a since-removed `markput`
package (React hooks such as `useKeyDown.tsx`, `useTextSelection.tsx`, `useFocusedNode.tsx`, `TextSpan.tsx`). None of
those files exist any more:

- `c0ad3d7e` (#124) moved the event/focus hooks out of the React package into the core;
- `b8f318bf` (#248) deleted `TextSpan.tsx`;
- `a558bf44` (#271) inverted the core — the token tree became the source of truth, public API v2;
- `36a621c8` (#272) retired the S1 compat layers — one address space, one node representation.

The File references below have been re-pointed at the live code in `packages/core/src/**` where the described mechanism
still exists, and marked **STALE (pre-rewrite)** where it does not. **Every entry's Steps / Expected / Actual rows are
unverified**: nothing here has been re-measured in a browser against the current core. Treat them as leads, not as
reproduced defects.
:::

MarkedInput renders as a set of isolated `contentEditable` spans separated by non-editable mark elements:

```
<div>                                        ← container (no contentEditable of its own)
  <span contentEditable="true">text</span>  ← editable text
  <button tabindex="0">mark</button>        ← non-editable mark
  <span contentEditable="true">text</span>  ← editable text
  ...
</div>
```

Each `<span>` is an isolated editable island. Operations that should flow across the entire input hit boundaries at mark elements. This page documents known behavioral differences from native `<input>` / `<textarea>`.

This shape is still current: `applyEditableState` writes `contentEditable` per text surface and `tabindex=0` per mark
root (`packages/core/src/features/tokens/dom/editableState.ts:17-28`), and nothing writes `contentEditable` on the
container.

---

## Critical

### 1. ✅ Ctrl+A then typing only replaces first span — FIXED

|                     | Detail                                                                                                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**          | **FIXED** — PR: fix/ctrl-a-selection-issue (commit a21db88)                                                                                                                                                                                  |
| **Steps**           | 1. Click any text span<br>2. Press `Cmd+A` (or `Ctrl+A`)<br>3. Type any character (e.g. `x`)                                                                                                                                                 |
| **Expected**        | All content (text + marks) is replaced by typed character. Value becomes `"x"`                                                                                                                                                               |
| **Actual (BEFORE)** | Only the first span's text is replaced. All marks and other spans remain intact. Value becomes `x@[primary](primary:4) suggestions and '/' for @[default](default:7)!...`                                                                    |
| **Fix Summary**     | Implemented state-based interception: Track Ctrl+A state with `store.selecting = 'all'`, intercept `beforeinput`/`paste` events with lazy validation, manually replace tokens. Uses `queueMicrotask` to restore focus after React re-render. |
| **Files Modified**  | _(historical, pre-rewrite files — since moved or deleted, paths no longer resolve)_ `Store.ts`, `useKeyDown.tsx`, `useTextSelection.tsx`. See **Lives now in** for the live code |
| **Lives now in**    | `packages/core/src/features/keyboard/arrowNav.ts:19-22` (Ctrl/Cmd+A → `selection.selectAll()`), `packages/core/src/features/tokens/tree/selection.ts:88-101` (`isAllSelected` / `selectAll`), `packages/core/src/features/keyboard/input.ts:41,59,131` (the three all-selected interception points) |

---

### 2. Markup injection via paste

|                | Detail                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**      | 1. Click any text span to focus<br>2. Paste the text `@[injected](primary:99)` (via clipboard)                                                                                    |
| **Expected**   | The literal text `@[injected](primary:99)` appears in the field as plain text                                                                                                     |
| **Actual**     | A new `<button>injected</button>` mark component is created. The pasted text is interpreted as markup syntax                                                                      |
| **Root cause** | _(pre-rewrite wording: paste handler inserts via `document.execCommand('insertText')`, then the `Change` event re-parses the full value string.)_ `execCommand` no longer appears anywhere in the tree, but the mechanism survives: the paste is intercepted, lowered to a string splice and the spliced window is re-parsed, so pasted markup syntax still becomes a mark |
| **File**       | `packages/core/src/features/keyboard/input.ts:130-137` (paste) and `:58-101` (`beforeinput` → `replacementForInput`), splice at `packages/core/src/features/tokens/tree/transactions.ts:48-71`, re-parse at `packages/core/src/features/tokens/tree/valueBoundary.ts:59-70` (`fold` → `parseValue`) |

---

### 3. Undo cannot restore deleted marks

|                | Detail                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**      | 1. Position caret at the beginning of a span that follows a mark<br>2. Press `Backspace` to delete the mark<br>3. Press `Cmd+Z` to undo                                           |
| **Expected**   | The deleted mark is restored, DOM returns to previous state                                                                                                                       |
| **Actual**     | Nothing happens. The mark is permanently gone. Cmd+Z has no effect                                                                                                                |
| **Root cause** | Mark deletion goes through a transaction on the token tree (`event.preventDefault()` + `edit.replace`), so the browser's native undo stack never records it. No undo/redo owner exists anywhere in `packages/core/src`, `packages/react/markput/src` or `packages/vue/markput/src` — grepping for `undo` / `redo` finds no handler |
| **File**       | `packages/core/src/features/keyboard/input.ts:31-56` (`handleDeleteKey`)                                                                                                           |

---

### 4. Delete/Backspace with cross-mark selection only affects first span

**STALE (pre-rewrite)** — mechanism removed in `a558bf44` / `36a621c8`, defect not re-measured against the current core.

The stated root cause was "no cross-selection delete handler". One exists now: `handleDeleteKey` calls
`event.preventDefault()`, reads the live selection's two ends as tree anchors via `tokens.domAnchors()` — which resolves
`range.startContainer` and `range.endContainer` independently, so the pair may span marks — and issues a single
`edit.replace(anchor, head, '')`
(`packages/core/src/features/keyboard/input.ts:31-56`, `packages/core/src/features/tokens/dom/SelectionDriver.ts:108-120`).
Whether the browser can still be driven into the failing state has **not** been checked.

|                | Detail                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Steps**      | 1. Create a selection spanning from span[0] across a mark into span[1] (e.g. via `selection.setBaseAndExtent`)<br>2. Press `Backspace` or `Delete`                  |
| **Expected**   | All selected text (including the mark) is deleted                                                                                                                  |
| **Actual**     | Only the selected text within the originating span is removed. The mark and the other span are untouched                                                           |
| **Root cause** | _(pre-rewrite)_ The browser's delete command only operates within the focused contentEditable span. Cross-span deletion is not handled by the component            |
| **File**       | _(pre-rewrite file deleted)_ live equivalent: `packages/core/src/features/keyboard/input.ts:31-56` (`handleDeleteKey`)                                              |

---

## High

### 5. Tab key cycles through internal elements instead of leaving the field

|                | Detail                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**      | 1. Click on first text span to focus<br>2. Press `Tab`                                                                                             |
| **Expected**   | Focus leaves the MarkedInput component and moves to the next focusable element on the page                                                         |
| **Actual**     | Focus moves to the next internal element — first to the "primary" `<button>`, then to the next `<span>`, etc. The component traps Tab focus        |
| **Root cause** | No Tab key handler exists. Browser default behavior tabs between focusable children (`<span contentEditable>` and `<button>`) within the container. `KEYBOARD.TAB` is declared but never read; mark roots are given `tabindex=0` |
| **File**       | `packages/core/src/features/keyboard/arrowNav.ts:9-24` (the only `keydown` navigation handler) — Tab not handled; `packages/core/src/shared/constants.ts:15`; `packages/core/src/features/tokens/dom/editableState.ts:25-28` |

---

### 6. Home/End keys trapped within current span

|                | Detail                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**      | 1. Click in the middle of a text span (e.g. span[1]: `" suggestions and '/' for "`)<br>2. Press `Home`<br>3. Press `End`                          |
| **Expected**   | `Home` moves caret to the beginning of the visual line (across marks). `End` moves to end of line                                                 |
| **Actual**     | `Home` moves to offset 0 of the current span only. `End` moves to the last offset of the current span only. Caret cannot escape the span boundary |
| **Root cause** | `KEYBOARD.HOME`/`KEYBOARD.END` constants are defined but never read by any handler                                                                |
| **File**       | `packages/core/src/shared/constants.ts:9-10` (declared); `packages/core/src/features/keyboard/arrowNav.ts:9-24` — Home/End not handled            |

---

### 7. Word navigation (Alt+Arrow / Ctrl+Arrow) stuck at span boundary

|                | Detail                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**      | 1. Click in the middle of a text span<br>2. Press `Alt+ArrowLeft` (Mac) or `Ctrl+ArrowLeft` (Windows) repeatedly to jump words backward  |
| **Expected**   | Caret jumps word-by-word, crossing mark boundaries seamlessly                                                                            |
| **Actual**     | Caret jumps words within the span but gets stuck at span boundary (offset 0 or end). Repeated presses do nothing — cannot cross the mark |
| **Root cause** | No word-navigation handler. Browser word-jump only operates within a single contentEditable element                                      |
| **File**       | `packages/core/src/features/keyboard/arrowNav.ts:9-24` — the Left/Right handler ignores `altKey`/`ctrlKey`, so Alt+Arrow is not handled  |

---

### 8. Shift+Arrow selection doesn't cross marks

|                | Detail                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**      | 1. Position caret near the end of span[0] (e.g. offset 24 in `"Enter the '@' for calling "`)<br>2. Press `Shift+ArrowRight` repeatedly (3+ times)                                                         |
| **Expected**   | Selection extends character-by-character through the mark text and into the next span                                                                                                                     |
| **Actual**     | Selection extends only within span[0]. On the 3rd press, focus jumps to the "primary" button but the selection only contains `"g "` (last 2 chars of span). Selection is lost/broken at the mark boundary |
| **Root cause** | No Shift+Arrow handler. Browser Shift+Arrow stops at contentEditable boundary. The component's arrow key handler for mark skipping (Left/Right) fires but doesn't extend selection — `shiftFocus` never inspects `event.shiftKey` and ends in `selection.selectNode(sibling, …)`, which places a collapsed caret |
| **File**       | `packages/core/src/features/keyboard/arrowNav.ts:26-59` (`shiftFocus`)                                                                                                                                    |

---

### 9. Triple-click selects only current span, not full line

|                | Detail                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**      | 1. Triple-click on a word in span[1] (e.g. on "suggestions")                                                                              |
| **Expected**   | The entire visual line or paragraph is selected (including text across marks)                                                             |
| **Actual**     | Only the current span's content is selected: `" suggestions and '/' for "` (25 chars). Text from adjacent spans and marks is not included |
| **Root cause** | Each `<span contentEditable>` is a separate block element for selection purposes. Triple-click selects within the block                   |
| **File**       | `packages/core/src/features/tokens/dom/editableState.ts:17-24` — `contentEditable` is still written per text surface  |

---

### 10. Mouse drag selection doesn't cross marks

**STALE (pre-rewrite)** — mechanism removed in `c0ad3d7e` (hook deleted) and reworked through `a558bf44` / `36a621c8`;
defect not re-measured against the current core.

The stated root cause was that the cross-selection logic "only activates when the drag starts **outside** the
container". The live equivalent (`SelectionDriver.#trackUserSelecting`,
`packages/core/src/features/tokens/dom/SelectionDriver.ts:167-196`) arms on
`(startedOutsideEditor || sweepingAcrossNodes) && selectionIntersectsEditor`, where
`sweepingAcrossNodes = pressedAt !== e.target` — i.e. an intra-component drag now arms it too, and the editable sweep
(`contentEditable=false` on children) runs via `#applyEditablePolicy`. Whether the highlight actually crosses marks in
a browser has **not** been checked.

|                | Detail                                                                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**      | 1. Mouse down in the middle of span[0]<br>2. Drag across the "primary" button into span[1]<br>3. Mouse up in span[1]                                                                                                                                  |
| **Expected**   | Selection highlights text from span[0] through the mark and into span[1]                                                                                                                                                                              |
| **Actual**     | Selection only captures text from span[0]: `"' for calling "` (14 chars). The mark and span[1] text are not selected. Visual highlight stops at the mark boundary                                                                                     |
| **Root cause** | _(pre-rewrite)_ `useTextSelection.tsx` has cross-selection logic (temporarily sets `contentEditable=false` on children during drag) but it only activates when the drag starts **outside** the container and enters it                                 |
| **File**       | _(pre-rewrite file deleted)_ live equivalent: `packages/core/src/features/tokens/dom/SelectionDriver.ts:167-196` (`#trackUserSelecting`) and `:78-82` (`#applyEditablePolicy`, the editable sweep)                                                     |

---

### 11. Focus/Blur fires on every internal span switch

|                | Detail                                                                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**      | 1. Click on span[0] → observe console: `onFocus`<br>2. Click on span[1] → observe console: `onBlur`, `onFocus`<br>3. Click on span[2] → observe console: `onBlur`, `onFocus`<br>4. Click outside → observe console: `onBlur` |
| **Expected**   | A single `onFocus` when the component first receives focus. A single `onBlur` when focus leaves the component. Moving the cursor between spans within the same component should NOT fire focus/blur                          |
| **Actual**     | Every click on a different internal span fires `focusout` then `focusin` on the container. Total events for 3 clicks + blur: 4× `onBlur`, 3× `onFocus` instead of 1× each                                                    |
| **Root cause** | Each `<span contentEditable>` is a separate focusable element. Switching between them triggers real DOM focus/blur events. The component does not debounce or suppress these — the container's `focusin`/`focusout` listeners handle each one individually, and no `onFocus`/`onBlur` prop exists on the component (a consumer wires them through `slotProps.container`, i.e. straight onto the container element) |
| **Impact**     | Can trigger form validation, auto-save, or other side effects on every cursor repositioning                                                                                                                                  |
| **File**       | `packages/core/src/features/tokens/dom/SelectionDriver.ts:242-256` (`focusin`/`focusout`); `packages/core/src/features/tokens/dom/editableState.ts:17-24` (per-span `contentEditable`)                                       |

---

## Medium

### 12. Multi-line paste fires onInput multiple times

**STALE (pre-rewrite)** — mechanism removed in `b8f318bf` (`TextSpan.tsx` deleted) and reworked through `a558bf44` /
`36a621c8`; defect not re-measured against the current core.

The stated root cause was `document.execCommand('insertText')`. `execCommand` no longer appears anywhere in
`packages/core/src`, `packages/react/markput/src` or `packages/vue/markput/src` — the paste path is a single
`beforeinput`/`paste` interception ending in one `edit.replace` inside a `batch`
(`packages/core/src/features/keyboard/input.ts:58-101,130-137`,
`packages/core/src/features/edit/EditController.ts:24-36`). The event count has **not** been re-measured.

|                | Detail                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------- |
| **Steps**      | 1. Click on a text span<br>2. Paste multi-line text (e.g. `"line1\nline2\nline3"`)              |
| **Expected**   | `onInput` fires once for the paste operation                                                    |
| **Actual**     | `onInput` fires 5 times for a 3-line paste                                                      |
| **Root cause** | _(pre-rewrite)_ `document.execCommand('insertText')` may split multi-line insertions into multiple input events |
| **File**       | _(pre-rewrite file deleted)_ live equivalent: `packages/core/src/features/keyboard/input.ts:58-101,130-137` |

---

### 13. No focus ring or visual focus indicator

|                | Detail                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**      | 1. Click on any text span to focus it<br>2. Observe the visual appearance                                                                         |
| **Expected**   | A visible focus ring, border change, or box-shadow indicates the field is active (default browser behavior for inputs)                            |
| **Actual**     | No visual change. The text caret (blinking cursor) appears but there is no outline, border, or shadow. `outline: none` is explicitly set on spans |
| **Root cause** | CSS in `styles.module.css` sets `outline: none` on spans                                                                                          |
| **File**       | `packages/core/styles.module.css:143-146` (`.Container span`), and `:76-85` (`.Block`) for block layout                                           |

---

### 14. No ARIA role or accessibility attributes

|                | Detail                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Steps**      | 1. Inspect the container element's attributes                                                                                              |
| **Expected**   | Container has `role="textbox"`, `aria-multiline="true"`, and an `aria-label` or `aria-labelledby`. `tabIndex=0` for keyboard accessibility |
| **Actual**     | Container has `role=null`, `aria-label=null`, `tabIndex=-1`. Screen readers will not announce it as an editable text field                 |
| **Root cause** | No ARIA attributes are set on the container `<div>`. Grepping `packages/core/src`, `packages/react/markput/src` and `packages/vue/markput/src` for `role=` / `aria-` finds only `DragHandle`'s `aria-label` |
| **File**       | `packages/core/src/features/slots/resolveSlot.ts:14-22` — default container is a plain `<div>`                                      |

---

## Works Correctly

These were observed on the pre-rewrite tree as well and have **not** been re-measured against the current core.

| Behavior                             | Result                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Enter key inserts newline            | ✅ Inserts `\n`, renders via `white-space: pre-wrap`, value updates correctly |
| Basic undo/redo within a span        | ✅ Typing then Cmd+Z within the same span works                               |
| Up/Down arrows in multi-line content | ✅ Browser handles visual line navigation across spans correctly              |
| Double-click word selection          | ✅ Selects the word within the span                                           |
| Basic typing and onChange            | ✅ Characters inserted, state updates on each keystroke                       |
| Left/Right arrow across marks        | ✅ Custom handler skips non-editable marks to adjacent spans                  |
| Delete/Backspace at mark boundary    | ✅ Atomically removes marks (by design)                                       |
| Plain text paste                     | ✅ Text inserted at caret, value updates correctly                            |
