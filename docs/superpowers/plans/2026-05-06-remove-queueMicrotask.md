# Remove queueMicrotask Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all 16 `queueMicrotask` usages by replacing each with its correct synchronous or Playwright-retry equivalent.

**Architecture:** Four independent edits — one production file, two passes on one test file, one test helper. No new abstractions. Existing tests verify all changed code paths.

**Tech Stack:** TypeScript, Vitest browser mode, Playwright

---

### Task 1: `blockEdit.ts` — call `focusRow` synchronously (3 changes)

**Files:**
- Modify: `packages/core/src/features/keyboard/blockEdit.ts:111-116`, `:138-143`, `:158-163`

- [ ] **Step 1: Replace BACKSPACE-at-start microtask (first occurrence)**

  In `handleDelete`, locate the block starting around line 111:
  ```ts
  // before
  event.preventDefault()
  queueMicrotask(() => {
      const target = blockDivs[blockIndex - 1]
      focusRow(store, prevToken, target, 'end')
  })
  return
  ```
  Replace with:
  ```ts
  event.preventDefault()
  focusRow(store, prevToken, blockDivs[blockIndex - 1], 'end')
  return
  ```

- [ ] **Step 2: Replace DELETE-at-start microtask (second occurrence)**

  Still in `handleDelete`, under the `KEYBOARD.DELETE` / `caretAtStart` branch around line 138:
  ```ts
  // before
  event.preventDefault()
  queueMicrotask(() => {
      const target = blockDivs[blockIndex - 1]
      focusRow(store, prevToken, target, 'end')
  })
  return
  ```
  Replace with:
  ```ts
  event.preventDefault()
  focusRow(store, prevToken, blockDivs[blockIndex - 1], 'end')
  return
  ```

- [ ] **Step 3: Replace DELETE-at-end microtask (third occurrence)**

  Still in `handleDelete`, under the `caretAtEnd` branch around line 158:
  ```ts
  // before
  event.preventDefault()
  queueMicrotask(() => {
      const target = blockDivs[blockIndex + 1]
      focusRow(store, nextToken, target, 'start')
  })
  return
  ```
  Replace with:
  ```ts
  event.preventDefault()
  focusRow(store, nextToken, blockDivs[blockIndex + 1], 'start')
  return
  ```

- [ ] **Step 4: Confirm no `queueMicrotask` remains in the file**

  Run: `grep -n queueMicrotask packages/core/src/features/keyboard/blockEdit.ts`
  Expected: no output.

- [ ] **Step 5: Run the focused drag keyboard tests**

  Run: `pnpm -w exec vitest run packages/storybook/src/pages/Drag/Drag.vue.spec.ts`

  Expected: all tests pass, particularly:
  - `NOT reduce row count when Backspace at start of text row after mark row`
  - `move focus to the mark row on Backspace at mark boundary`
  - `NOT reduce row count when Delete at start of text row after mark row`
  - `move focus to mark row on Delete at mark boundary`

- [ ] **Step 6: Commit**

  ```bash
  git add packages/core/src/features/keyboard/blockEdit.ts
  git commit -m "refactor: call focusRow synchronously in blockEdit delete handlers"
  ```

---

### Task 2: `Clipboard.vue.spec.ts` — delete 9 post-focus awaits

**Files:**
- Modify: `packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts`

Each change is a single line deletion. The line is always `await new Promise<void>(r => queueMicrotask(r))` that appears directly after a `.focus()` call. Delete each occurrence.

- [ ] **Step 1: Delete the await at line ~189** (after `lastSpan.focus()` in the "paste at end replicates mark" test)

  Before:
  ```ts
  lastSpan.focus()
  await new Promise<void>(r => queueMicrotask(r))
  window.getSelection()!.collapse(lastText, lastText.length)
  ```
  After:
  ```ts
  lastSpan.focus()
  window.getSelection()!.collapse(lastText, lastText.length)
  ```

- [ ] **Step 2: Delete the await at line ~282** (after `targetSpan.focus()` in the "copy then paste into plain text" test)

  Before:
  ```ts
  targetSpan.focus()
  await new Promise<void>(r => queueMicrotask(r))
  expect(document.activeElement).toBe(targetSpan)
  ```
  After:
  ```ts
  targetSpan.focus()
  expect(document.activeElement).toBe(targetSpan)
  ```

- [ ] **Step 3: Delete the await at line ~327** (after `span.focus()` in "pasting markput data should reconstruct the mark")

  Before:
  ```ts
  span.focus()
  await new Promise<void>(r => queueMicrotask(r))
  expect(document.activeElement).toBe(span)
  ```
  After:
  ```ts
  span.focus()
  expect(document.activeElement).toBe(span)
  ```

- [ ] **Step 4: Delete the await at line ~371** (after `lastSpan.focus()` in "pasting into uncontrolled editor should reconstruct the mark")

  Before:
  ```ts
  lastSpan.focus()
  await new Promise<void>(r => queueMicrotask(r))
  expect(document.activeElement).toBe(lastSpan)
  ```
  After:
  ```ts
  lastSpan.focus()
  expect(document.activeElement).toBe(lastSpan)
  ```

- [ ] **Step 5: Delete the await at line ~411** (after `span.focus()` in "pasting markup over a selection")

  Before:
  ```ts
  span.focus()
  await new Promise<void>(r => queueMicrotask(r))
  const textNode = firstTextNode(span)!
  ```
  After:
  ```ts
  span.focus()
  const textNode = firstTextNode(span)!
  ```

- [ ] **Step 6: Delete the await at line ~449** (after `lastSpan.focus()` in "keeps controlled text unchanged after paste")

  Before:
  ```ts
  lastSpan.focus()
  await new Promise<void>(r => queueMicrotask(r))
  window.getSelection()!.collapse(lastText, lastText.length)
  ```
  After:
  ```ts
  lastSpan.focus()
  window.getSelection()!.collapse(lastText, lastText.length)
  ```

- [ ] **Step 7: Delete the await at line ~492** (after `lastSpan.focus()` in "caret should land immediately after pasted mark")

  Before:
  ```ts
  lastSpan.focus()
  await new Promise<void>(r => queueMicrotask(r))
  window.getSelection()!.collapse(lastText, 1)
  ```
  After:
  ```ts
  lastSpan.focus()
  window.getSelection()!.collapse(lastText, 1)
  ```

- [ ] **Step 8: Delete the await at line ~529** (after `firstBlock.focus()` in "pasting markput data in drag mode")

  Before:
  ```ts
  firstBlock.focus()
  await new Promise<void>(r => queueMicrotask(r))
  const firstBlockText = firstTextNode(firstBlock)
  ```
  After:
  ```ts
  firstBlock.focus()
  const firstBlockText = firstTextNode(firstBlock)
  ```

- [ ] **Step 9: Delete the await at line ~614** (after `lastSpan.focus()` in "paste into nested mark should use cumulative offsets")

  Before:
  ```ts
  lastSpan.focus()
  await new Promise<void>(r => queueMicrotask(r))
  window.getSelection()!.collapse(lastText, 1)
  ```
  After:
  ```ts
  lastSpan.focus()
  window.getSelection()!.collapse(lastText, 1)
  ```

- [ ] **Step 10: Confirm exactly 3 `queueMicrotask` lines remain (the event→assertion ones to be fixed in Task 3)**

  Run: `grep -n queueMicrotask packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts`
  Expected: exactly 3 hits.

- [ ] **Step 11: Run clipboard tests**

  Run: `pnpm -w exec vitest run packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts`
  Expected: all tests pass.

- [ ] **Step 12: Commit**

  ```bash
  git add packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts
  git commit -m "test: remove unnecessary queueMicrotask yields after focus() in clipboard tests"
  ```

---

### Task 3: `Clipboard.vue.spec.ts` — replace 3 event→assertion awaits with Playwright retry

**Files:**
- Modify: `packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts`

`page` is already imported from `vitest/browser` (line 5). Each change replaces the `queueMicrotask` flush with a Playwright retry assertion that waits until the second mark is in the DOM, which means Vue has re-rendered.

- [ ] **Step 1: Replace the await at line ~205** (after `root.dispatchEvent(inputEvent)`, before `querySelectorAll` count assertion in the "paste at end replicates mark" test)

  Before:
  ```ts
  root.dispatchEvent(inputEvent)

  await new Promise<void>(r => queueMicrotask(r))
  expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)
  expect(root.textContent).toBe('hello world foolo world f')
  ```
  After:
  ```ts
  root.dispatchEvent(inputEvent)

  await expect.element(page.elementLocator(root).getByTestId('mark').nth(1)).toBeInTheDocument()
  expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)
  expect(root.textContent).toBe('hello world foolo world f')
  ```

- [ ] **Step 2: Replace the await at line ~509** (after `root.dispatchEvent(inputEvent)`, before `querySelectorAll` + selection assertions in "caret should land immediately after pasted mark")

  Before:
  ```ts
  root.dispatchEvent(inputEvent)

  await new Promise<void>(r => queueMicrotask(r))
  expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)
  const sel = window.getSelection()!
  expect(sel.isCollapsed).toBe(true)
  expect(sel.anchorNode?.textContent).toBe('foo')
  expect(sel.anchorOffset).toBe(0)
  ```
  After:
  ```ts
  root.dispatchEvent(inputEvent)

  await expect.element(page.elementLocator(root).getByTestId('mark').nth(1)).toBeInTheDocument()
  expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)
  const sel = window.getSelection()!
  expect(sel.isCollapsed).toBe(true)
  expect(sel.anchorNode?.textContent).toBe('foo')
  expect(sel.anchorOffset).toBe(0)
  ```

- [ ] **Step 3: Replace the await at line ~630** (after `root.dispatchEvent(inputEvent)`, before `querySelectorAll` count assertion in "paste into nested mark should use cumulative offsets")

  Before:
  ```ts
  root.dispatchEvent(inputEvent)

  await new Promise<void>(r => queueMicrotask(r))
  expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)
  expect(root.textContent).toBe('hello world worldfoo')
  ```
  After:
  ```ts
  root.dispatchEvent(inputEvent)

  await expect.element(page.elementLocator(root).getByTestId('mark').nth(1)).toBeInTheDocument()
  expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)
  expect(root.textContent).toBe('hello world worldfoo')
  ```

- [ ] **Step 4: Confirm no `queueMicrotask` remains in the file**

  Run: `grep -n queueMicrotask packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts`
  Expected: no output.

- [ ] **Step 5: Run clipboard tests**

  Run: `pnpm -w exec vitest run packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts`
  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts
  git commit -m "test: replace queueMicrotask flush with Playwright retry assertions in clipboard tests"
  ```

---

### Task 4: `dragTestHelpers.ts` — delete dead await between dragover and drop

**Files:**
- Modify: `packages/storybook/src/shared/lib/dragTestHelpers.ts:69`

- [ ] **Step 1: Delete the await line**

  In `simulateDragRow`, the block around lines 59–72 currently reads:
  ```ts
  targetRow.dispatchEvent(
      new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientY: position === 'before' ? rect.top + 1 : rect.bottom - 1,
      })
  )

  await new Promise<void>(r => queueMicrotask(r))

  targetRow.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt}))
  ```
  Delete the `await new Promise<void>(r => queueMicrotask(r))` line and the blank line above it:
  ```ts
  targetRow.dispatchEvent(
      new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientY: position === 'before' ? rect.top + 1 : rect.bottom - 1,
      })
  )

  targetRow.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt}))
  ```

- [ ] **Step 2: Confirm no `queueMicrotask` remains anywhere in the codebase**

  Run: `grep -rn queueMicrotask packages/`
  Expected: no output.

- [ ] **Step 3: Run the drag tests**

  Run: `pnpm -w exec vitest run packages/storybook/src/pages/Drag/Drag.vue.spec.ts`
  Expected: all tests pass, especially the `drag & drop` describe block.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/storybook/src/shared/lib/dragTestHelpers.ts
  git commit -m "test: remove dead queueMicrotask between dragover and drop in simulateDragRow"
  ```

---

### Task 5: Full verification

- [ ] **Step 1: Run full test suite**

  Run: `pnpm test`
  Expected: all tests pass. No failures in Drag, Clipboard, or any other suite.

- [ ] **Step 2: Run typecheck and lint**

  Run: `pnpm run typecheck && pnpm run lint:check`
  Expected: no errors.
