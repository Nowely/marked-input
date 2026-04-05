# Cross-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow drag-selection across mark tokens in both inline and drag modes by temporarily flipping `contenteditable="true"` elements to `"false"` during a cross-element drag, then restoring via `ContentEditableController.sync()`.

**Architecture:** `TextSelectionController` subscribes to `store.state.selecting` — when it becomes `'drag'`, queries all `[contenteditable="true"]` descendants and sets them to `"false"`, collapsing all editing hosts so the browser can select freely. `ContentEditableController` subscribes to the same signal — when it returns to `undefined`, calls `sync()` to restore correct values. No tracking of flipped elements needed.

**Tech Stack:** TypeScript, Vitest Browser Mode, Playwright (Chromium), React (storybook tests only)

---

## File Map

| File | Change |
|------|--------|
| `packages/core/src/features/selection/TextSelectionController.ts` | Add `#unsubSelecting`, subscription for flip, rework `mousemove` / `selectionchange` / `mouseup`, update `disable()` |
| `packages/core/src/features/editable/ContentEditableController.ts` | Add `#unsubSelecting`, subscription to call `sync()` on `selecting → undefined`, update `disable()` |
| `packages/storybook/src/pages/Selection/Selection.react.stories.tsx` | New story fixture: inline mode + drag mode with marks |
| `packages/storybook/src/pages/Selection/Selection.react.spec.tsx` | New component tests: cross-select flip, restoration, drag mode |

---

### Task 1: Create story fixture

**Files:**
- Create: `packages/storybook/src/pages/Selection/Selection.react.stories.tsx`

- [ ] **Step 1: Create the story file**

```tsx
// packages/storybook/src/pages/Selection/Selection.react.stories.tsx
import type {MarkProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'

export default {
    title: 'Selection',
    component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<typeof MarkedInput>

export const Inline: Story = {
    args: {
        Mark: ({value}: MarkProps) => <mark data-testid="mark">{value}</mark>,
        defaultValue: 'hello @[world](1) foo',
    },
}

export const Drag: Story = {
    args: {
        drag: true,
        Mark: ({value}: MarkProps) => <mark data-testid="mark">{value}</mark>,
        defaultValue: 'hello\n@[world](1)\nfoo',
    },
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm --filter @markput/storybook exec tsc --noEmit
```

Expected: no errors.

---

### Task 2: Write failing tests

**Files:**
- Create: `packages/storybook/src/pages/Selection/Selection.react.spec.tsx`

- [ ] **Step 1: Create the spec file with two failing tests**

```tsx
// packages/storybook/src/pages/Selection/Selection.react.spec.tsx
import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'

import * as Stories from './Selection.react.stories'

const {Inline, Drag} = composeStories(Stories)

describe('Cross-select', () => {
    it('inline: should flip spans to non-editable during cross-element drag', async () => {
        const {container} = await render(<Inline />)
        const root = container.firstElementChild as HTMLElement
        const spans = Array.from(root.querySelectorAll<HTMLElement>('span'))
        const [span1, span2] = spans

        // Set a selection spanning both spans (programmatic — crosses editing hosts)
        const sel = window.getSelection()!
        sel.setBaseAndExtent(span1.firstChild!, 0, span2.firstChild!, 3)

        // Simulate mousedown on span1 (records pressedNode)
        span1.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))

        // Simulate mousemove on span2 (cross-element → should trigger flip)
        span2.dispatchEvent(new MouseEvent('mousemove', {bubbles: true}))

        expect(span1.contentEditable).toBe('false')
        expect(span2.contentEditable).toBe('false')
    })

    it('inline: should restore spans after selection collapses', async () => {
        const {container} = await render(<Inline />)
        const root = container.firstElementChild as HTMLElement
        const spans = Array.from(root.querySelectorAll<HTMLElement>('span'))
        const [span1, span2] = spans

        // Trigger cross-select (same as above)
        const sel = window.getSelection()!
        sel.setBaseAndExtent(span1.firstChild!, 0, span2.firstChild!, 3)
        span1.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
        span2.dispatchEvent(new MouseEvent('mousemove', {bubbles: true}))
        expect(span1.contentEditable).toBe('false')

        // Collapse selection then fire mouseup — should restore
        sel.removeAllRanges()
        document.dispatchEvent(new MouseEvent('mouseup', {bubbles: false}))

        expect(span1.contentEditable).toBe('true')
        expect(span2.contentEditable).toBe('true')
    })

    it('drag: should flip block rows to non-editable during cross-block drag', async () => {
        const {container} = await render(<Drag />)
        const root = container.firstElementChild as HTMLElement
        const blocks = Array.from(root.children) as HTMLElement[]
        // drag mode renders: [textBlock("hello"), markBlock("world"), textBlock("foo")]
        const [textBlock1, , textBlock3] = blocks

        // Use TreeWalker to find text nodes — block structure has drag handles and
        // indicators as siblings so querySelector('span') is not reliable here
        const w1 = document.createTreeWalker(textBlock1, NodeFilter.SHOW_TEXT)
        const w3 = document.createTreeWalker(textBlock3, NodeFilter.SHOW_TEXT)
        const textNode1 = w1.nextNode() as Text | null
        const textNode3 = w3.nextNode() as Text | null
        if (!textNode1 || !textNode3) throw new Error('text nodes not found in drag blocks')

        // Set selection spanning both text blocks
        const sel = window.getSelection()!
        sel.setBaseAndExtent(textNode1, 0, textNode3, 2)

        // Simulate cross-block drag
        textBlock1.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
        textBlock3.dispatchEvent(new MouseEvent('mousemove', {bubbles: true}))

        // Text blocks should be flipped to non-editable
        expect(textBlock1.contentEditable).toBe('false')
        expect(textBlock3.contentEditable).toBe('false')
    })
})
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm --filter @markput/storybook exec vitest run packages/storybook/src/pages/Selection/Selection.react.spec.tsx
```

Expected: all 3 tests FAIL — `expect(span1.contentEditable).toBe('false')` fails with `'true'`.

---

### Task 3: Implement `ContentEditableController` subscription

**Files:**
- Modify: `packages/core/src/features/editable/ContentEditableController.ts`

- [ ] **Step 1: Add `#unsubSelecting` field and update `enable()` and `disable()`**

Open `packages/core/src/features/editable/ContentEditableController.ts`. Make exactly three edits:

**Edit 1** — add field after `#unsubscribe`:
```typescript
    #unsubscribe?: () => void
    #unsubSelecting?: () => void   // ← add this line
```

**Edit 2** — replace the `enable()` method:
```typescript
    enable() {
        if (this.#unsubscribe) return

        this.#unsubscribe = this.store.state.readOnly.on(() => this.sync())
        this.#unsubSelecting = this.store.state.selecting.on(value => {
            if (value === undefined) this.sync()
        })
        this.sync()
    }
```

**Edit 3** — replace the `disable()` method:
```typescript
    disable() {
        this.#unsubscribe?.()
        this.#unsubscribe = undefined
        this.#unsubSelecting?.()
        this.#unsubSelecting = undefined
    }
```

Do not touch `sync()`, `#syncTextContent()`, `#syncMarkChildren()`, or `#syncDragTextContent()`.

- [ ] **Step 2: Verify typecheck**

```bash
pnpm run typecheck
```

Expected: no errors.

---

### Task 4: Implement `TextSelectionController` rework

**Files:**
- Modify: `packages/core/src/features/selection/TextSelectionController.ts`

- [ ] **Step 1: Rewrite the file**

Replace the entire file with the following:

```typescript
// packages/core/src/features/selection/TextSelectionController.ts
import {nodeTarget} from '../../shared/checkers'
import type {Store} from '../store/Store'

export class TextSelectionController {
    #mousedownHandler?: (e: MouseEvent) => void
    #mousemoveHandler?: (e: MouseEvent) => void
    #mouseupHandler?: () => void
    #selectionchangeHandler?: () => void
    #unsubSelecting?: () => void
    #pressedNode: Node | null = null
    #isPressed = false

    constructor(private store: Store) {}

    enable() {
        if (this.#mousedownHandler) return

        this.#mousedownHandler = e => {
            this.#pressedNode = nodeTarget(e)
            this.#isPressed = true
        }

        this.#mousemoveHandler = e => {
            const container = this.store.refs.container
            if (!container) return
            const isPressed = this.#isPressed
            const isNotInnerSome = !container.contains(this.#pressedNode) || this.#pressedNode !== e.target
            const isInside = window.getSelection()?.containsNode(container, true)

            if (isPressed && isNotInnerSome && isInside) {
                if (this.store.state.selecting.get() !== 'drag') {
                    this.store.state.selecting.set('drag')
                }
            }
        }

        this.#mouseupHandler = () => {
            this.#isPressed = false
            this.#pressedNode = null
            if (this.store.state.selecting.get() === 'drag') {
                const sel = window.getSelection()
                if (!sel || sel.isCollapsed) {
                    this.store.state.selecting.set(undefined)
                }
            }
        }

        this.#selectionchangeHandler = () => {
            if (this.store.state.selecting.get() !== 'drag') return
            const sel = window.getSelection()
            if (!sel || sel.isCollapsed) {
                this.store.state.selecting.set(undefined)
            }
        }

        this.#unsubSelecting = this.store.state.selecting.on(value => {
            if (value !== 'drag') return
            const container = this.store.refs.container
            if (!container) return
            container
                .querySelectorAll<HTMLElement>('[contenteditable="true"]')
                .forEach(el => (el.contentEditable = 'false'))
        })

        document.addEventListener('mousedown', this.#mousedownHandler)
        document.addEventListener('mousemove', this.#mousemoveHandler)
        document.addEventListener('mouseup', this.#mouseupHandler)
        document.addEventListener('selectionchange', this.#selectionchangeHandler)
    }

    disable() {
        if (this.store.state.selecting.get() === 'drag') {
            this.store.state.selecting.set(undefined)
        }

        this.#unsubSelecting?.()
        this.#unsubSelecting = undefined

        if (this.#mousedownHandler) {
            document.removeEventListener('mousedown', this.#mousedownHandler)
            if (this.#mousemoveHandler) document.removeEventListener('mousemove', this.#mousemoveHandler)
            if (this.#mouseupHandler) document.removeEventListener('mouseup', this.#mouseupHandler)
            if (this.#selectionchangeHandler)
                document.removeEventListener('selectionchange', this.#selectionchangeHandler)

            this.#mousedownHandler = undefined
            this.#mousemoveHandler = undefined
            this.#mouseupHandler = undefined
            this.#selectionchangeHandler = undefined
        }

        this.#pressedNode = null
        this.#isPressed = false
    }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm run typecheck
```

Expected: no errors.

---

### Task 5: Run cross-select tests

- [ ] **Step 1: Run the new tests**

```bash
pnpm --filter @markput/storybook exec vitest run packages/storybook/src/pages/Selection/Selection.react.spec.tsx
```

Expected: all 3 tests PASS.

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass, no regressions.

---

### Task 6: Run all checks

- [ ] **Step 1: Build**

```bash
pnpm run build
```

Expected: success.

- [ ] **Step 2: Typecheck**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Lint**

```bash
pnpm run lint
```

Expected: no errors.

- [ ] **Step 4: Format**

```bash
pnpm run format
```

Expected: no errors. If format reports changes, run `pnpm run format:fix` and re-run `pnpm run format`.

---

### Task 7: Commit

- [ ] **Step 1: Commit**

```bash
git add \
  packages/core/src/features/selection/TextSelectionController.ts \
  packages/core/src/features/editable/ContentEditableController.ts \
  packages/storybook/src/pages/Selection/Selection.react.stories.tsx \
  packages/storybook/src/pages/Selection/Selection.react.spec.tsx

git commit -m "feat: enable cross-element text selection across mark tokens

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

Expected: commit succeeds, pre-commit hook (oxlint + oxfmt) passes.
