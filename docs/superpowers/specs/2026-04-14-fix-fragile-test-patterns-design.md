# Fix Fragile Test Patterns

## Problem

31 `await new Promise(r => setTimeout(r, 50/100))` calls across 4 storybook test files. These are fragile because:

1. Arbitrary timeout may be too short on slow CI
2. No guarantee the condition is met — just a guess
3. Raw DOM queries (`querySelectorAll`, `querySelector`) bypass vitest-browser's built-in auto-retry mechanism

## Solution

Replace all `setTimeout` with vitest-browser's built-in waiting mechanisms — no custom helpers needed.

### Mechanisms

| Mechanism | When to use | How it works |
|-----------|-------------|--------------|
| `expect.element(locator).toBe*(...)` | Asserting DOM state after async update | Auto-retries assertion until timeout (uses test timeout) |
| `locator.findElement()` | Getting an element reference that may not exist yet | Auto-retries query with increasing intervals (0, 20, 50, 100, 100, 500ms) |
| `page.elementLocator(el).getBy*(...)` | Creating locators scoped to a specific parent element | Same auto-retry as `page.getBy*()` |

### Categories of setTimeout Usage

#### Category A: After synthetic event dispatch → `expect.element()`

Most common pattern. Dispatch `ClipboardEvent`/`InputEvent`/`DragEvent`, wait for React/Vue re-render, assert DOM.

```ts
// Before:
root.dispatchEvent(inputEvent)
await new Promise(r => setTimeout(r, 50))
expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)

// After:
root.dispatchEvent(inputEvent)
await expect.element(page.getByTestId('mark')).toBeInTheDocument()
```

For count assertions (e.g., "2 marks"), use `page.getByTestId('mark').length`:
```ts
// Before:
expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)

// After:
expect(page.getByTestId('mark').length).toBe(2)  // .length is synchronous on Locator
```

For text content assertions:
```ts
// Before:
expect(root.textContent).toBe('heo world foo')

// After:
await expect.element(page.getByText('heo world foo')).toBeInTheDocument()
// OR keep sync assertion since textContent is already updated:
expect(root.textContent).toBe('heo world foo')
```

#### Category B: After userEvent.hover → `findElement()`

Wait for grip button to appear after hovering a row.

```ts
// Before:
await userEvent.hover(row)
await new Promise(r => setTimeout(r, 50))
const grip = row.querySelector<HTMLButtonElement>(GRIP_SELECTOR)

// After:
await userEvent.hover(row)
const grip = await page.elementLocator(row).getByLabel('Drag to reorder or click for options').findElement()
```

#### Category C: After dispatchEvent + keyboard in drag mode → `expect.element()` on raw value

Wait for value update after typing/pasting in a row. The `getRawValue()` function reads from `<pre>` element. Use locator to wait for the expected text.

```ts
// Before:
dispatchInsertText(editable, '!')
await new Promise(r => setTimeout(r, 50))
expect(getRawValue(container)).toContain('First block of plain text!')

// After — wait for the <pre> to contain expected text:
dispatchInsertText(editable, '!')
await expect.element(page.getByText('First block of plain text!')).toBeInTheDocument()
```

When the assertion is on `getRawValue()` (reading `<pre data-value>` or `<pre>` textContent), and the text cannot be matched by `getByText` (e.g., because it's inside `<pre>` and may contain newlines), use `locator.findElement()` to wait for the `<pre>` to exist, then assert synchronously. Since `findElement` auto-waits for the element, the re-render will have completed by the time it resolves:

```ts
// After — for getRawValue() assertions:
dispatchInsertText(editable, '!')
await page.getByText(/First block/).findElement()  // waits for re-render
expect(getRawValue(container)).toContain('First block of plain text!')
```

### Files to Change

| File | setTimeout Count | Categories |
|------|-----------------|------------|
| `Clipboard.react.spec.tsx` | 12 | A (after dispatchEvent) |
| `Drag.react.spec.tsx` | 11 | A, B, C |
| `Drag.vue.spec.ts` | 8 | A, B, C |

### Detailed Transformations

See implementation plan for per-occurrence mappings.

### Constraints

- No custom `waitFor` utility
- No behavior changes — same assertions, more robust waiting
- Must pass all existing tests
- Must pass typecheck and lint
