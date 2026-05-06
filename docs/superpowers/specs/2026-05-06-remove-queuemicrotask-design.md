# Remove queueMicrotask

**Date:** 2026-05-06

## Problem

16 uses of `queueMicrotask` exist across the codebase. All are hacks — none document
why the deferral was needed, and investigation shows none are genuinely required.
They fall into four categories with different root causes.

## Inventory

| File | Count | Category |
|------|-------|----------|
| `packages/core/src/features/keyboard/blockEdit.ts` | 3 | Production: unnecessary defer |
| `packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts` | 9 | Test: defensive yield after `focus()` |
| `packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts` | 3 | Test: waiting for Vue re-render before raw assertion |
| `packages/storybook/src/shared/lib/dragTestHelpers.ts` | 1 | Test: dead wait between `dragover` and `drop` |

## Root Cause Analysis

### Production — `blockEdit.ts` (3 uses)

`handleDelete` defers `focusRow()` into a microtask after `event.preventDefault()`.
`handleBlockArrowLeftRight` does the exact same thing — prevent default, move focus to
an adjacent block — with a plain synchronous call. The asymmetry has no documented
reason. The microtask wrapper is dead weight.

### Test — after `focus()` (9 uses)

Pattern: `span.focus()` / `await queueMicrotask` / `getSelection().collapse(...)`.
In real browsers `focus()` is synchronous — `document.activeElement` updates
immediately. The `textNode` referenced after the await is captured after the focus too,
so no stale reference risk either. These yields are vestigial.

### Test — after `dispatchEvent` before raw assertion (3 uses, lines 205, 509, 630)

Pattern: dispatch a `beforeinput` event / `await queueMicrotask` / raw
`querySelectorAll + expect`. The wait lets Vue flush its async DOM update before the
assertion. The same file already handles this correctly elsewhere using Playwright's
retry-based assertions (`await expect.element(...).toBeInTheDocument()`). The three
remaining sites are just inconsistent.

### Test — `dragTestHelpers.ts` (1 use)

`dragover` sets `BlockStore.state.dropPosition` via a core Signal (synchronous write).
`drop` reads `this.state.dropPosition()` immediately — also synchronous. The microtask
between the two dispatches has no effect on the outcome.

## Design

### 1. `blockEdit.ts` — call `focusRow` directly

Remove the `queueMicrotask` wrapper from all three call sites. Call `focusRow(...)`
synchronously, matching the pattern in `handleBlockArrowLeftRight`.

Before:
```ts
event.preventDefault()
queueMicrotask(() => {
    focusRow(store, prevToken, blockDivs[blockIndex - 1], 'end')
})
```

After:
```ts
event.preventDefault()
focusRow(store, prevToken, blockDivs[blockIndex - 1], 'end')
```

### 2. `Clipboard.vue.spec.ts` — delete the 9 post-focus awaits

Each is a single `await new Promise<void>(r => queueMicrotask(r))` line between a
`focus()` call and the next statement. Delete the line.

### 3. `Clipboard.vue.spec.ts` — replace 3 event→assertion awaits with Playwright retry

Replace the flush + raw querySelectorAll pattern with a Playwright retry assertion
before the count check:

Before:
```ts
root.dispatchEvent(inputEvent)
await new Promise<void>(r => queueMicrotask(r))
expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)
```

After:
```ts
root.dispatchEvent(inputEvent)
await expect.element(page.elementLocator(root).getByTestId('mark').nth(1)).toBeInTheDocument()
expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)
```

### 4. `dragTestHelpers.ts` — delete the single dead await

Delete the `await new Promise<void>(r => queueMicrotask(r))` line between
`dragover` and `drop`.

## Verification

Run `pnpm test`. Browser tests in `Drag.vue.spec.ts` and `Clipboard.vue.spec.ts`
cover all four touched areas. No new tests required.
