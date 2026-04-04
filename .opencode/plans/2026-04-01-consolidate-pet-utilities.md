# Consolidate Pet Utility Functions into Factory/Shared Helpers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate duplicated utility functions across the monorepo by extracting them into shared locations, reducing maintenance burden and drift risk.

**Architecture:** Three consolidation layers: (1) core shared utils for `getOrCreate` and `isTextTokenSpan`, (2) a new `@markput/storybook-test-utils` shared package for storybook browser-mode helpers (`dom.ts`, `focus.ts`), (3) shared drag test helpers extracted from spec files into the shared package. Each layer is independent and can be shipped separately.

**Tech Stack:** TypeScript, pnpm monorepo workspace, Vitest Browser Mode

---

## Inventory of Duplications

| ID  | Duplication             | Files                                                                  | Function(s)                                                                              | Similarity                                           |
| --- | ----------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A   | Storybook DOM helpers   | `react/storybook/.../dom.ts` ↔ `vue/storybook/.../dom.ts`              | `getElement`, `firstChild`, `childAt`, `childrenOf`, `getActiveElement`                  | 100% identical                                       |
| B   | Storybook focus helpers | `react/storybook/.../focus.tsx` ↔ `vue/storybook/.../focus.ts`         | `setCaretPosition`, `focusAtStart`, `focusAtEnd`, `focusAtOffset`, `verifyCaretPosition` | 100% identical logic (only ext differs: .tsx vs .ts) |
| C   | Drag spec helpers       | `react/storybook/.../Drag.spec.tsx` ↔ `vue/storybook/.../Drag.spec.ts` | `findMarkputRowHost`, `getAllRows`, `getBlocks`, `getEditableInRow`, `openMenuForRow`    | ~95% identical (`getRawValue` differs)               |
| D   | Map helper              | `MarkupRegistry.ts:6` ↔ `PatternMatcher.ts:21`                         | `getOrCreate(map, key)`                                                                  | 100% identical                                       |
| E   | Test count helper       | `Parser.spec.ts:1672` ↔ `parser.profile.bench.ts:310`                  | `countMarks(tokens)`                                                                     | Same logic, different implementations                |
| F   | DOM predicate           | `ContentEditableController.ts:6` ↔ `KeyDownController.ts:625`          | `isTextTokenSpan(el)`                                                                    | 100% identical                                       |

---

## Variants for Storybook Shared Helpers (A, B, C)

### Variant 1: New `@markput/storybook-test-utils` package (Recommended)

Create `packages/common/storybook-test-utils/` as a new workspace package.

**Pros:**

- Single source of truth, zero duplication
- Framework-agnostic (no React/Vue dependency — uses only `vitest/browser` APIs)
- Easy to extend with more shared test helpers
- Follows monorepo patterns (like `@markput/core`)

**Cons:**

- New package to maintain (package.json, tsconfig, build config)
- Requires adding dependency to both storybook packages

**Structure:**

```
packages/common/storybook-test-utils/
  package.json          → @markput/storybook-test-utils
  tsconfig.json
  src/
    dom.ts              → getElement, firstChild, childAt, childrenOf, getActiveElement
    focus.ts            → setCaretPosition, focusAtStart, focusAtEnd, focusAtOffset, verifyCaretPosition
    drag.ts             → findMarkputRowHost, getAllRows, getBlocks, getEditableInRow, openMenuForRow, GRIP_SELECTOR
    index.ts            → re-exports all
```

**Imports change from:**

```ts
import {getElement} from '../../shared/lib/dom'
```

**To:**

```ts
import {getElement} from '@markput/storybook-test-utils'
```

### Variant 2: Symlinked shared folder

Create a folder in `packages/common/` and symlink it into both storybook packages.

**Pros:**

- No new package overhead
- Immediate, simple setup

**Cons:**

- Symlinks can be fragile across OS and CI
- No proper package boundaries (TypeScript path resolution gets tricky)
- Not idiomatic in pnpm monorepo

### Variant 3: Copy-based with lint rule

Keep copies but add a CI check that verifies they stay in sync.

**Pros:**

- Zero structural change
- Each package stays self-contained

**Cons:**

- Still duplicated code
- CI check adds complexity
- Easy to forget to update both

---

## Variant for Core Shared Utils (D, E, F)

Single approach — move into existing `packages/common/core/src/shared/`:

| Function          | Destination                      | Notes                                                                   |
| ----------------- | -------------------------------- | ----------------------------------------------------------------------- |
| `getOrCreate`     | `shared/utils/getOrCreate.ts`    | Generic `Map<K, V[]>` helper, used by MarkupRegistry and PatternMatcher |
| `isTextTokenSpan` | `shared/checkers/domGuards.ts`   | Already has similar DOM guard functions                                 |
| `countMarks`      | `shared/testUtils/countMarks.ts` | Test utility, usable by both Parser.spec.ts and bench files             |

---

## Implementation Plan

### Task 1: Extract `getOrCreate` into `shared/utils/getOrCreate.ts` [Core]

**Files:**

- Create: `packages/common/core/src/shared/utils/getOrCreate.ts`
- Create: `packages/common/core/src/shared/utils/getOrCreate.spec.ts`
- Modify: `packages/common/core/src/shared/utils/index.ts`
- Modify: `packages/common/core/src/features/parsing/parser/core/MarkupRegistry.ts`
- Modify: `packages/common/core/src/features/parsing/parser/core/PatternMatcher.ts`

- [ ] **Step 1: Write failing test**

Create `packages/common/core/src/shared/utils/getOrCreate.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {getOrCreate} from './getOrCreate'

describe('getOrCreate', () => {
    it('returns existing array for a key', () => {
        const map = new Map<string, number[]>()
        map.set('a', [1, 2])
        const result = getOrCreate(map, 'a')
        expect(result).toEqual([1, 2])
        expect(result).toBe(map.get('a'))
    })

    it('creates and returns empty array for missing key', () => {
        const map = new Map<string, number[]>()
        const result = getOrCreate(map, 'a')
        expect(result).toEqual([])
        expect(map.get('a')).toBe(result)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @markput/core exec vitest run packages/common/core/src/shared/utils/getOrCreate.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `getOrCreate.ts`**

Create `packages/common/core/src/shared/utils/getOrCreate.ts`:

```ts
export function getOrCreate<K, V>(map: Map<K, V[]>, key: K): V[] {
    let arr = map.get(key)
    if (!arr) {
        arr = []
        map.set(key, arr)
    }
    return arr
}
```

- [ ] **Step 4: Export from `shared/utils/index.ts`**

Add `export {getOrCreate} from './getOrCreate'` to the barrel file.

- [ ] **Step 5: Update MarkupRegistry.ts**

Remove local `getOrCreate` function (lines 6-13), add import:

```ts
import {getOrCreate} from '../../../shared/utils'
```

- [ ] **Step 6: Update PatternMatcher.ts**

Remove local `getOrCreate` function (lines 21-28), add import:

```ts
import {getOrCreate} from '../../../shared/utils'
```

- [ ] **Step 7: Run tests**

Run: `pnpm --filter @markput/core exec vitest run packages/common/core/src/shared/utils/getOrCreate.spec.ts`
Run: `pnpm --filter @markput/core exec vitest run packages/common/core/src/features/parsing/parser/core/MarkupRegistry.ts`
Expected: All PASS

- [ ] **Step 8: Run full test suite**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 9: Commit**

```
refactor(core): extract getOrCreate into shared utils
```

---

### Task 2: Extract `isTextTokenSpan` into `shared/checkers/domGuards.ts` [Core]

**Files:**

- Modify: `packages/common/core/src/shared/checkers/domGuards.ts`
- Modify: `packages/common/core/src/shared/checkers/index.ts`
- Modify: `packages/common/core/src/features/editable/ContentEditableController.ts`
- Modify: `packages/common/core/src/features/input/KeyDownController.ts`

- [ ] **Step 1: Add `isTextTokenSpan` to `domGuards.ts`**

Add to `packages/common/core/src/shared/checkers/domGuards.ts`:

```ts
export function isTextTokenSpan(el: HTMLElement): boolean {
    return (
        el.tagName === 'SPAN' &&
        (el.attributes.length === 0 || (el.attributes.length === 1 && el.hasAttribute('contenteditable')))
    )
}
```

- [ ] **Step 2: Export from `checkers/index.ts`**

Ensure `isTextTokenSpan` is exported from the barrel.

- [ ] **Step 3: Update ContentEditableController.ts**

Remove local `isTextTokenSpan` (lines 5-11). Update import at top:

```ts
import {childAt, isTextTokenSpan} from '../../shared/checkers'
```

- [ ] **Step 4: Update KeyDownController.ts**

Remove local `isTextTokenSpan` (lines 624-630). Add to existing imports:

```ts
import {isTextTokenSpan} from '../../shared/checkers'
```

(Note: check if KeyDownController already imports from `shared/checkers` — if so, add to that import.)

- [ ] **Step 5: Run tests**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 6: Commit**

```
refactor(core): extract isTextTokenSpan into shared DOM guards
```

---

### Task 3: Extract `countMarks` into shared test utility [Core Tests]

**Files:**

- Create: `packages/common/core/src/shared/testUtils/countMarks.ts`
- Modify: `packages/common/core/src/features/parsing/parser/Parser.spec.ts`
- Modify: `packages/common/core/src/features/parsing/parser.profile.bench.ts`

- [ ] **Step 1: Create shared `countMarks` utility**

Create `packages/common/core/src/shared/testUtils/countMarks.ts`:

```ts
import type {Token} from '../../features/parsing'

export function countMarks(tokens: Token[]): number {
    let count = 0
    for (const token of tokens) {
        if (token.type === 'mark') {
            count++
            count += countMarks(token.children)
        }
    }
    return count
}
```

- [ ] **Step 2: Update Parser.spec.ts**

Remove local `countMarks` function (lines 1672-1685), add import:

```ts
import {countMarks} from '../../../shared/testUtils/countMarks'
```

- [ ] **Step 3: Update parser.profile.bench.ts**

Remove local `countMarks` function (lines 310-319), add import:

```ts
import {countMarks} from '../../shared/testUtils/countMarks'
```

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 5: Commit**

```
refactor(core): extract countMarks into shared test utils
```

---

### Task 4: Create `@markput/storybook-test-utils` package [Storybook — Variant 1]

This task implements Variant 1 from the variants above. Skip this task if you chose a different variant.

**Files:**

- Create: `packages/common/storybook-test-utils/package.json`
- Create: `packages/common/storybook-test-utils/tsconfig.json`
- Create: `packages/common/storybook-test-utils/src/dom.ts`
- Create: `packages/common/storybook-test-utils/src/focus.ts`
- Create: `packages/common/storybook-test-utils/src/drag.ts`
- Create: `packages/common/storybook-test-utils/src/index.ts`

- [ ] **Step 1: Create package.json**

Create `packages/common/storybook-test-utils/package.json`:

```json
{
    "name": "@markput/storybook-test-utils",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "main": "./src/index.ts",
    "types": "./src/index.ts",
    "exports": {
        ".": "./src/index.ts"
    },
    "peerDependencies": {
        "vitest": "workspace:*"
    }
}
```

Note: Using `"main": "./src/index.ts"` with TypeScript project references means no build step needed — consumers resolve source directly.

- [ ] **Step 2: Create tsconfig.json**

Create `packages/common/storybook-test-utils/tsconfig.json`:

```json
{
    "extends": "../core/tsconfig.json",
    "compilerOptions": {
        "outDir": "dist",
        "rootDir": "src"
    },
    "include": ["src"]
}
```

(Adjust to match existing core tsconfig pattern — check `packages/common/core/tsconfig.json` for reference.)

- [ ] **Step 3: Move `dom.ts` helpers**

Create `packages/common/storybook-test-utils/src/dom.ts` — copy content from either `react/storybook/src/shared/lib/dom.ts` or `vue/storybook/src/shared/lib/dom.ts` (they are identical):

```ts
import type {Locator} from 'vitest/browser'

export function getElement(locator: Locator): HTMLElement {
    const el = locator.element()
    if (el instanceof HTMLElement) return el
    throw new Error('Expected HTMLElement')
}

export function firstChild(element: Element): HTMLElement | null {
    const child = element.firstElementChild
    return child instanceof HTMLElement ? child : null
}

export function childAt(element: Element, index: number): HTMLElement | null {
    const child = element.children[index]
    return child instanceof HTMLElement ? child : null
}

export function childrenOf(element: Element): HTMLElement[] {
    return Array.from(element.children).filter((c): c is HTMLElement => c instanceof HTMLElement)
}

export function getActiveElement(): HTMLElement | null {
    return document.activeElement instanceof HTMLElement ? document.activeElement : null
}
```

- [ ] **Step 4: Move `focus.ts` helpers**

Create `packages/common/storybook-test-utils/src/focus.ts` — unified from both versions (identical logic):

```ts
import {expect} from 'vitest'
import {userEvent} from 'vitest/browser'

function setCaretPosition(element: HTMLElement, offset: number) {
    const range = document.createRange()
    const selection = window.getSelection()

    if (!selection) return

    let currentOffset = 0
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

    let node = walker.nextNode()
    while (node) {
        const nodeLength = node.textContent?.length ?? 0
        if (currentOffset + nodeLength >= offset) {
            range.setStart(node, offset - currentOffset)
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)
            return
        }
        currentOffset += nodeLength
        node = walker.nextNode()
    }

    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
}

export async function focusAtStart(element: HTMLElement) {
    await userEvent.click(element)
    setCaretPosition(element, 0)
    await expect.element(element).toHaveFocus()

    verifyCaretPosition(element, 0)
}

export async function focusAtEnd(element: HTMLElement) {
    await userEvent.click(element)
    const textLength = element.textContent!.length
    setCaretPosition(element, textLength)
    await expect.element(element).toHaveFocus()

    verifyCaretPosition(element, textLength)
}

export async function focusAtOffset(element: HTMLElement, offset: number) {
    await userEvent.click(element)
    setCaretPosition(element, offset)
    await expect.element(element).toHaveFocus()

    verifyCaretPosition(element, offset)
}

export function verifyCaretPosition(element: HTMLElement, expectedOffset: number) {
    const position = getCaretPosition()
    expect(position, 'Caret position not available').not.toBeNull()
    if (!position) return

    const length = measureTextLength(element, position.node, position.offset)
    expect(length).toBe(expectedOffset)

    function getCaretPosition() {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return null

        const range = selection.getRangeAt(0)
        return {
            node: range.startContainer,
            offset: range.startOffset,
        }
    }

    function measureTextLength(containerElement: HTMLElement, endNode: Node, endOffset: number) {
        const range = document.createRange()
        range.selectNodeContents(containerElement)
        range.setEnd(endNode, endOffset)
        return range.toString().length
    }
}
```

- [ ] **Step 5: Move shared drag test helpers**

Create `packages/common/storybook-test-utils/src/drag.ts`:

```ts
import {userEvent} from 'vitest/browser'
import {childrenOf} from './dom'

export const GRIP_SELECTOR = 'button[aria-label="Drag to reorder or click for options"]'

export function findMarkputRowHost(container: Element): HTMLElement | null {
    const candidates = Array.from(container.querySelectorAll<HTMLElement>('[class*="Container"]'))
    for (const el of candidates) {
        const hasBlockChild = childrenOf(el).some(c => c instanceof HTMLElement && c.dataset.testid === 'block')
        if (hasBlockChild) return el
    }
    return container.querySelector<HTMLElement>('[class*="Container"]')
}

export function getAllRows(container: Element) {
    const host = findMarkputRowHost(container)
    return host ? childrenOf(host) : []
}

export function getBlocks(container: Element) {
    const host = findMarkputRowHost(container)
    if (!host) return []
    return Array.from(host.querySelectorAll<HTMLElement>('[data-testid="block"]'))
}

export function getEditableInRow(row: HTMLElement) {
    return row.querySelector('[contenteditable="true"]') ?? row
}

export async function openMenuForRow(container: Element, rowIndex: number) {
    const row = getAllRows(container)[rowIndex]
    await userEvent.hover(row)
    await new Promise(r => setTimeout(r, 50))
    const grip = row.querySelector<HTMLButtonElement>(GRIP_SELECTOR)
    if (!grip) throw new Error(`No grip found after hovering row ${rowIndex}`)
    await userEvent.click(grip)
}
```

Note: `getRawValue` is NOT included because the React version reads `dataset.value` while the Vue version reads `textContent`. Each spec file should keep its own `getRawValue`.

- [ ] **Step 6: Create index.ts barrel**

Create `packages/common/storybook-test-utils/src/index.ts`:

```ts
export * from './dom'
export * from './focus'
export * from './drag'
```

- [ ] **Step 7: Commit package skeleton**

```
feat(storybook): add @markput/storybook-test-utils package
```

---

### Task 5: Migrate React storybook to use `@markput/storybook-test-utils`

**Files:**

- Modify: `packages/react/storybook/package.json` (add dependency)
- Delete: `packages/react/storybook/src/shared/lib/dom.ts`
- Delete: `packages/react/storybook/src/shared/lib/focus.tsx`
- Modify: `packages/react/storybook/src/pages/Drag/Drag.spec.tsx` (imports + remove local helpers)
- Modify: `packages/react/storybook/src/pages/Base/Base.spec.tsx`
- Modify: `packages/react/storybook/src/pages/Base/keyboard.spec.tsx`
- Modify: `packages/react/storybook/src/pages/Overlay/Overlay.spec.tsx`

- [ ] **Step 1: Add dependency to React storybook package.json**

Add to `packages/react/storybook/package.json` dependencies:

```json
"@markput/storybook-test-utils": "workspace:*"
```

Run: `pnpm install`

- [ ] **Step 2: Update all spec file imports**

For each spec file, change:

```ts
// FROM:
import {getElement} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
// TO:
import {getElement, focusAtEnd, focusAtStart} from '@markput/storybook-test-utils'
```

Files to update (consolidate dom + focus imports into one from the shared package):

- `pages/Base/Base.spec.tsx` — uses `getElement`, `focusAtEnd`, `focusAtStart`
- `pages/Base/keyboard.spec.tsx` — uses `getElement`, `focusAtEnd`, `focusAtStart`
- `pages/Base/MarkputHandler.spec.tsx` — check if it imports dom/focus
- `pages/Overlay/Overlay.spec.tsx` — uses `firstChild`, `childAt`, `focusAtEnd`, `verifyCaretPosition`
- `pages/Drag/Drag.spec.tsx` — uses all dom + focus + drag helpers
- `pages/Nested/nested.spec.tsx` — check if it imports dom/focus
- `pages/Slots/slots.spec.tsx` — check if it imports dom/focus
- `pages/stories.spec.tsx` — check if it imports dom/focus

- [ ] **Step 3: Update Drag.spec.tsx — remove local helpers**

Remove from `Drag.spec.tsx`:

- `GRIP_SELECTOR` const → now imported from `@markput/storybook-test-utils`
- `findMarkputRowHost` → now imported
- `getAllRows` → now imported
- `getBlocks` → now imported
- `getEditableInRow` → now imported
- `openMenuForRow` → now imported
- Keep `getRawValue` (differs from Vue version)

- [ ] **Step 4: Delete old helper files**

Delete:

- `packages/react/storybook/src/shared/lib/dom.ts`
- `packages/react/storybook/src/shared/lib/focus.tsx`

- [ ] **Step 5: Run React storybook tests**

Run: `pnpm --filter react-storybook exec vitest run`
Expected: All PASS

- [ ] **Step 6: Commit**

```
refactor(react): migrate to @markput/storybook-test-utils
```

---

### Task 6: Migrate Vue storybook to use `@markput/storybook-test-utils`

**Files:**

- Modify: `packages/vue/storybook/package.json` (add dependency)
- Delete: `packages/vue/storybook/src/shared/lib/dom.ts`
- Delete: `packages/vue/storybook/src/shared/lib/focus.ts`
- Modify: `packages/vue/storybook/src/pages/Drag/Drag.spec.ts` (imports + remove local helpers)
- Modify: `packages/vue/storybook/src/pages/Base/Base.spec.ts`
- Modify: `packages/vue/storybook/src/pages/Base/keyboard.spec.ts`
- Modify: `packages/vue/storybook/src/pages/Overlay/Overlay.spec.ts`

- [ ] **Step 1: Add dependency to Vue storybook package.json**

Add to `packages/vue/storybook/package.json` dependencies:

```json
"@markput/storybook-test-utils": "workspace:*"
```

Run: `pnpm install`

- [ ] **Step 2: Update all spec file imports**

Same pattern as Task 5, but for Vue spec files:

- `pages/Base/Base.spec.ts`
- `pages/Base/keyboard.spec.ts`
- `pages/Base/MarkputHandler.spec.ts`
- `pages/Overlay/Overlay.spec.ts`
- `pages/Drag/Drag.spec.ts`
- `pages/Nested/nested.spec.ts`
- `pages/Slots/slots.spec.ts`
- `pages/stories.spec.ts`

- [ ] **Step 3: Update Drag.spec.ts — remove local helpers**

Same as Task 5 Step 3 — remove `GRIP_SELECTOR`, `findMarkputRowHost`, `getAllRows`, `getBlocks`, `getEditableInRow`, `openMenuForRow`. Keep `getRawValue`.

- [ ] **Step 4: Delete old helper files**

Delete:

- `packages/vue/storybook/src/shared/lib/dom.ts`
- `packages/vue/storybook/src/shared/lib/focus.ts`

- [ ] **Step 5: Run Vue storybook tests**

Run: `pnpm --filter vue-storybook exec vitest run`
Expected: All PASS

- [ ] **Step 6: Commit**

```
refactor(vue): migrate to @markput/storybook-test-utils
```

---

### Task 7: Final verification

- [ ] **Step 1: Run all checks**

Run:

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run format
```

Expected: All pass with zero errors.

- [ ] **Step 2: Commit if format fixes needed**

If any format/lint fixes were applied:

```
chore: format after utility consolidation
```

---

## Task Dependency Graph

```
Task 1 (getOrCreate) ─── independent
Task 2 (isTextTokenSpan) ─── independent
Task 3 (countMarks) ─── independent
Task 4 (create package) ─── independent
Task 5 (migrate React) ─── depends on Task 4
Task 6 (migrate Vue) ─── depends on Task 4 (can run in parallel with Task 5)
Task 7 (final verify) ─── depends on all
```

Tasks 1-4 can be parallelized. Tasks 5-6 can be parallelized after Task 4.
