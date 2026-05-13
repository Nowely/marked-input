# Caret Placement Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate caret placement logic into `CaretModel` so that `CaretModel` is the single source of truth for "where the caret is and how it gets applied to the DOM", and `DomModel` is the single source of truth for "DOM ↔ token-address indexing and boundary reads".

**Architecture:** Today `DomModel` owns `DomCaretPlacer` and exposes three pass-through adapters (`placeAt`, `placeRange`, `focusAddress`) that callers use to imperatively move the DOM caret. This splits caret ownership across two models. After the refactor: the placer disappears, its logic is inlined as private methods on `CaretModel`, and external callers move the caret by setting the `caret.selection` signal — a new auto-apply effect pushes selection changes into the DOM. The three adapter methods on `DomModel` are deleted along with the `DomCaretPlacer` class. The `affinity` parameter (vestigial — only consulted in gap-position territory that no real caller hits) is dropped from the placer side. `DomBoundary` keeps its `affinity` param (DOM→raw direction, separate concern, out of scope).

**Tech Stack:** TypeScript, signals library (`shared/signals`), Vitest, jsdom. Package: `@markput/core` at `packages/core/`.

---

## File Structure

**Files modified:**
- `packages/core/src/features/dom/DomModel.ts` — remove `#caret`, `DomCaretPlacer` import, three adapter methods; add public `pathElements()` and `pathElementsFor(addr)` read-only views.
- `packages/core/src/features/caret/CaretModel.ts` — inline placer logic as five private methods; add auto-apply effect on `selection`; remove explicit `#applyRangeToDOM` call from `selectAll`; rewrite `#applyRangeToDOM` to use the inlined helpers directly instead of `dom.placeAt`/`dom.placeRange`.
- `packages/core/src/features/keyboard/arrowNav.ts` — replace `dom.focusAddress + dom.placeAt` two-step with a single `caret.selection({start, end})` call; drop affinity arguments; drop the dead `.ok` check.
- `packages/core/src/features/keyboard/blockEdit.ts` — `focusRow` helper: replace `dom.focusAddress(...).ok` fallback with unconditional `caret.selection({start: token.position.start, end: ...})`; keep `row.focus()` only when address resolution returns nothing.
- `packages/core/src/shared/classes/MarkputHandler.ts` — replace `dom.focusAddress(firstAddress).ok` with token-availability precondition; on success set `caret.selection`, else `container.focus()`.
- `packages/core/src/store/Store.ts` — verify `CaretModel` constructor signature still matches (no changes expected).
- `packages/core/src/features/dom/DomModel.spec.ts` — delete the four caret-placement tests (`placeAt`, `placeRange`, `focusAddress`); these become integration-tested in `CaretModel.spec.ts`.
- `packages/core/src/features/caret/CaretModel.spec.ts` — rewrite the three tests that spy on `dom.placeAt`/`dom.placeRange` to assert DOM-side outcomes directly (focus target + selection range), since those public methods no longer exist.
- `packages/core/src/features/dom/README.md` — drop the bullet describing `DomCaretPlacer.ts`.
- `packages/core/src/features/caret/README.md` — add a short note that `CaretModel` owns DOM caret placement.

**Files deleted:**
- `packages/core/src/features/dom/DomCaretPlacer.ts`

**No new files created.**

---

## Constraints (apply to every task)

- All edits must keep `pnpm --filter @markput/core build` green at the end.
- Tests must stay passing after each task that touches behavior. The plan structures task boundaries to never leave the test suite red between commits.
- Do NOT touch `DomBoundary`. Its `affinity` parameter operates in the DOM→raw direction and is consumed by `keyboard/input.ts` and `keyboard/blockEdit.ts` boundary reads — that's a separate refactor.
- Do NOT change the public `Range` type in `shared/editorContracts.ts`. The selection signal stays `Range = {start, end}` — no `affinity` field added (we decided affinity is YAGNI for the placer side).
- Do NOT add public methods on `CaretModel` for placement. External callers set `caret.selection(...)` only.
- Commit after every task. Use Conventional Commits prefix `refactor(caret):` for tasks 1-6, `refactor(dom):` for task 7.

---

### Task 1: Expose `pathElements()` and `pathElementsFor(addr)` on `DomModel`

These two reads are currently only available via the internal `DomCaretHost` interface that's wired up inside `DomModel`'s constructor. The placer logic (about to move to `CaretModel`) needs them. Promoting them to the public `DomModel` API is the minimal change that lets `CaretModel` reach them without an extra dependency injection.

**Files:**
- Modify: `packages/core/src/features/dom/DomModel.ts`

- [ ] **Step 1: Add public `pathElements()` and `pathElementsFor(address)` methods to `DomModel`**

Edit `packages/core/src/features/dom/DomModel.ts`. Add the two methods directly below `locateNode` (around line 134):

```ts
locateNode(node: Node): NodeLocationResult {
    return this.#indexer.locateNode(node)
}

pathElements(): IterableIterator<PathElements> {
    return this.#indexer.pathElements()
}

pathElementsFor(address: TokenAddress): PathElements | undefined {
    return this.#indexer.pathElementsFor(address)
}
```

You must also add `PathElements` to the import from `./DomIndexer`. Find the existing import block at the top of the file:

```ts
import {DomIndexer} from './DomIndexer'
import type {ChildSequenceRegistration, ControlRegistration, DomIndexerHost} from './DomIndexer'
```

Replace it with:

```ts
import {DomIndexer} from './DomIndexer'
import type {ChildSequenceRegistration, ControlRegistration, DomIndexerHost, PathElements} from './DomIndexer'
```

`PathElements` is already exported from `DomIndexer.ts` (line 19).

- [ ] **Step 2: Verify it builds**

Run: `pnpm --filter @markput/core typecheck`
Expected: no errors. (Build script is `tsc --noEmit` per package.json — confirm the exact script name before running. If `typecheck` script doesn't exist, run `pnpm --filter @markput/core build` instead, which compiles with tsc.)

- [ ] **Step 3: Verify existing tests still pass**

Run: `pnpm --filter @markput/core test --run`
Expected: all existing tests pass (no regressions). We haven't removed anything yet.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/dom/DomModel.ts
git commit -m "refactor(caret): expose pathElements/pathElementsFor on DomModel"
```

---

### Task 2: Add `effect` import to `CaretModel` (preparation)

`CaretModel.ts` already imports `effect` from signals but let's confirm and keep imports tidy. This task is bookkeeping so the next task focuses purely on logic.

**Files:**
- Modify: `packages/core/src/features/caret/CaretModel.ts` (imports only)

- [ ] **Step 1: Verify imports**

Read `packages/core/src/features/caret/CaretModel.ts` lines 1–10. The import line currently reads:

```ts
import {computed, effect, listen, signal, watch} from '../../shared/signals'
```

`effect` is already imported. Add type imports we'll need for the placer logic. Replace the import block with:

```ts
import {nodeTarget} from '../../shared/checkers'
import type {Range, RawSelection, Result, TokenAddress} from '../../shared/editorContracts'
import {computed, effect, listen, signal, watch} from '../../shared/signals'
import {shallow} from '../../shared/utils/shallow'
import type {DomModel} from '../dom/DomModel'
import type {PathElements} from '../dom/DomIndexer'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {ParseController} from '../parsing/ParseController'
import {nextTextNode} from '../dom/textOffsets'
import type {ValueModel} from '../value/ValueModel'
```

Verify `packages/core/src/features/dom/textOffsets.ts` exports `nextTextNode`:

Run: `grep -n "export.*nextTextNode" packages/core/src/features/dom/textOffsets.ts`
Expected: one match.

Verify `PathElements` is exported from `DomIndexer.ts`:

Run: `grep -n "export.*PathElements" packages/core/src/features/dom/DomIndexer.ts`
Expected: one match showing `export type PathElements = {...}`.

- [ ] **Step 2: Update the `CaretModel` constructor signature to accept `parsing`**

`CaretModel` currently takes `(lifecycle, dom, value)`. The placer logic uses `parsing.index()` to resolve addresses and read token positions. Edit the constructor signature in `packages/core/src/features/caret/CaretModel.ts`:

```ts
constructor(
    private readonly lifecycle: Lifecycle,
    private readonly dom: DomModel,
    private readonly parsing: ParseController,
    private readonly value: ValueModel
) {
```

- [ ] **Step 3: Update `Store.ts` wiring**

Edit `packages/core/src/store/Store.ts`. Find the line:

```ts
readonly caret = new CaretModel(this.lifecycle, this.dom, this.value)
```

Replace with:

```ts
readonly caret = new CaretModel(this.lifecycle, this.dom, this.parsing, this.value)
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm --filter @markput/core build`
Expected: type errors only inside `CaretModel.ts` if we used something not yet defined. The imports themselves should be valid. The constructor change should compile cleanly. If `CaretModel.ts` shows unused import warnings for `Range`, `RawSelection`, `Result`, `TokenAddress`, `PathElements`, `nextTextNode` — that's expected, they'll be consumed in Task 3.

If unused-import errors block the build, suppress them only for this commit by leaving the imports as-is — Task 3 will use them within minutes. Otherwise proceed.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/caret/CaretModel.ts packages/core/src/store/Store.ts
git commit -m "refactor(caret): wire parsing into CaretModel constructor"
```

---

### Task 3: Inline placer logic as private methods on `CaretModel`

Copy the five helper methods from `DomCaretPlacer` into `CaretModel`, adapting them to use `this.dom.pathElements()` / `this.dom.pathElementsFor(addr)` instead of the old `host` interface. Drop the `affinity` parameter from `#findTextTargetForRawPosition` (we determined it's vestigial). The methods remain `private` (`#`-prefixed). At this point both the old `DomCaretPlacer` AND the new private methods coexist — `DomModel` still works as before. We'll swap `#applyRangeToDOM` to use the new private methods in Task 4.

**Files:**
- Modify: `packages/core/src/features/caret/CaretModel.ts`

- [ ] **Step 1: Add the five private placer methods**

Inside the `CaretModel` class body, after `#applyRangeToDOM` (the existing method), add the following five private methods. Paste exactly:

```ts
#findTextTargetForRawPosition(
    rawPosition: number
): {element: HTMLElement; start: number; end: number} | undefined {
    const candidates: Array<{element: HTMLElement; start: number; end: number}> = []
    const tokenIndex = this.parsing.index()

    for (const record of this.dom.pathElements()) {
        if (!record.textElement) continue
        const resolved = tokenIndex.resolveAddress(record.address)
        if (!resolved.ok || resolved.value.type !== 'text') continue
        candidates.push({
            element: record.textElement,
            start: resolved.value.position.start,
            end: resolved.value.position.end,
        })
    }

    candidates.sort((a, b) => a.start - b.start)
    const containing = candidates.find(
        candidate => rawPosition >= candidate.start && rawPosition <= candidate.end
    )
    if (containing) return containing
    return candidates.find(candidate => candidate.start >= rawPosition)
}

#focusMarkBoundaryForRawPosition(rawPosition: number): boolean {
    const tokenIndex = this.parsing.index()

    for (const record of this.dom.pathElements()) {
        const resolved = tokenIndex.resolveAddress(record.address)
        if (!resolved.ok || resolved.value.type !== 'mark') continue
        if (rawPosition !== resolved.value.position.start && rawPosition !== resolved.value.position.end) continue

        const boundary = rawPosition === resolved.value.position.end ? 'end' : 'start'
        record.tokenElement.focus()
        this.#placeCollapsedBoundary(
            record.tokenElement,
            boundary === 'end' ? record.tokenElement.childNodes.length : 0
        )
        return true
    }

    return false
}

#placeCaretInTextSurface(surface: HTMLElement, offset: number): void {
    const selection = window.getSelection()
    if (!selection) return

    const boundary = this.#boundaryInTextSurface(surface, offset)
    if (!boundary) return
    const range = document.createRange()
    range.setStart(boundary.node, boundary.offset)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
}

#placeCollapsedBoundary(element: HTMLElement, offset: number): void {
    const selection = window.getSelection()
    if (!selection) return

    const range = document.createRange()
    range.setStart(element, Math.min(Math.max(offset, 0), element.childNodes.length))
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
}

#boundaryInTextSurface(surface: HTMLElement, offset: number): {node: Text; offset: number} | undefined {
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
    let remaining = Math.max(0, offset)
    let node = nextTextNode(walker)
    while (node) {
        if (remaining <= node.length) return {node, offset: remaining}
        remaining -= node.length
        node = nextTextNode(walker)
    }

    const text = surface.firstChild instanceof Text ? surface.firstChild : document.createTextNode('')
    if (!text.parentNode) surface.append(text)
    return {node: text, offset: text.length}
}
```

Note the deletions vs. the original `DomCaretPlacer`:
- `#findTextTargetForRawPosition` has no `affinity` parameter.
- `#focusMarkBoundaryForRawPosition` returns `boolean` instead of `Result<>`.

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @markput/core build`
Expected: clean build. The new private methods are unused but TypeScript doesn't error on unused private methods.

- [ ] **Step 3: Verify tests still pass**

Run: `pnpm --filter @markput/core test --run`
Expected: all tests pass. Behavior is unchanged — we've added dead code that nothing calls yet.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/caret/CaretModel.ts
git commit -m "refactor(caret): inline placer helpers as private methods on CaretModel"
```

---

### Task 4: Rewrite `#applyRangeToDOM` to use the new private helpers

Replace the calls to `this.dom.placeAt(...)` / `this.dom.placeRange(...)` inside `#applyRangeToDOM` with direct use of the new private placer methods. Behavior must remain identical from the outside — same DOM state after the call, same `this.selection(undefined)` on failure.

**Files:**
- Modify: `packages/core/src/features/caret/CaretModel.ts`

- [ ] **Step 1: Replace `#applyRangeToDOM` body**

Find the existing `#applyRangeToDOM` method in `packages/core/src/features/caret/CaretModel.ts` (around line 133):

```ts
#applyRangeToDOM(): void {
    if (this.isUserSelecting()) return
    const sel = this.selection()
    if (sel === undefined) return

    if (sel.start === sel.end) {
        const result = this.dom.placeAt(sel.start)
        if (!result.ok) {
            this.selection(undefined)
            return
        }
        const applied = result.value.applied
        if (applied !== sel.start) this.selection({start: applied, end: applied})
        return
    }

    const result = this.dom.placeRange(sel)
    if (!result.ok) {
        this.selection(undefined)
        return
    }
    this.selection(result.value.applied)
}
```

Replace with:

```ts
#applyRangeToDOM(): void {
    if (this.isUserSelecting()) return
    if (this.dom.index() === undefined) return
    const sel = this.selection()
    if (sel === undefined) return

    const maxPos = this.value.current().length
    const clamped: Range = {
        start: Math.min(sel.start, maxPos),
        end: Math.min(sel.end, maxPos),
    }

    if (clamped.start === clamped.end) {
        const target = this.#findTextTargetForRawPosition(clamped.start)
        if (target) {
            target.element.focus()
            this.#placeCaretInTextSurface(target.element, clamped.start - target.start)
        } else if (!this.#focusMarkBoundaryForRawPosition(clamped.start)) {
            this.selection(undefined)
            return
        }
        if (clamped.start !== sel.start) this.selection(clamped)
        return
    }

    const startTarget = this.#findTextTargetForRawPosition(clamped.start)
    const endTarget = this.#findTextTargetForRawPosition(clamped.end)
    const browserSelection = window.getSelection()
    if (!startTarget || !endTarget || !browserSelection) {
        this.selection(undefined)
        return
    }

    const startBoundary = this.#boundaryInTextSurface(startTarget.element, clamped.start - startTarget.start)
    const endBoundary = this.#boundaryInTextSurface(endTarget.element, clamped.end - endTarget.start)
    if (!startBoundary || !endBoundary) {
        this.selection(undefined)
        return
    }

    const range = document.createRange()
    range.setStart(startBoundary.node, startBoundary.offset)
    range.setEnd(endBoundary.node, endBoundary.offset)
    browserSelection.removeAllRanges()
    browserSelection.addRange(range)

    if (clamped.start !== sel.start || clamped.end !== sel.end) this.selection(clamped)
}
```

Key semantic equivalences:
- The old `placeAt` returned `{ok: false, reason: 'notIndexed'}` when `dom.index()` was undefined. We now do the same precondition check at the top and return early without clearing the selection (matches old behavior: when `notIndexed`, the result was `!result.ok` → `this.selection(undefined)`. **WAIT — the old behavior cleared selection.** Match old behavior: change the `return` after the `dom.index() === undefined` check to `this.selection(undefined); return`).

Correction: replace `if (this.dom.index() === undefined) return` with:

```ts
if (this.dom.index() === undefined) {
    this.selection(undefined)
    return
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @markput/core build`
Expected: clean build.

- [ ] **Step 3: Run CaretModel tests**

Run: `pnpm --filter @markput/core test --run CaretModel`
Expected: all `CaretModel.spec.ts` tests pass. The three tests that spy on `dom.placeAt`/`dom.placeRange` will still work because `#applyRangeToDOM` no longer calls those methods — but the spies were on the dom side. Let me check: the test on line 105 does `vi.spyOn(store.dom, 'placeRange').mockReturnValue(...)` and then calls `store.caret.selectAll()`. After this refactor, `selectAll` calls `#applyRangeToDOM` which no longer calls `dom.placeRange`. **This test will fail.**

Expected failure (will be fixed in Task 6):
- `CaretModel > selectAll > sets selection to full value range and applies it to DOM` — fails because `placeRangeSpy` is never called.
- `CaretModel > selectAll > clears selection when placeRange fails` — fails because mocked failure no longer triggers.
- `CaretModel > restoration via dom.indexed > restores selection after indexed fires` — fails because `placeAtSpy` is never called.
- `CaretModel > restoration via dom.indexed > clears selection when placeAt fails` — fails because mocked failure no longer triggers.
- `CaretModel > restoration via dom.indexed > skips restoration when isUserSelecting` — may still pass because it only checks `placeAtSpy.not.toHaveBeenCalled()`.

This task ends in a known-broken test state. Task 6 fixes the tests.

- [ ] **Step 4: Run all core tests to see the failure surface**

Run: `pnpm --filter @markput/core test --run`
Expected: 4 failing tests in `CaretModel.spec.ts` (the ones listed above). All other tests pass.

- [ ] **Step 5: Commit (acknowledging broken tests in commit message)**

```bash
git add packages/core/src/features/caret/CaretModel.ts
git commit -m "refactor(caret): apply selection via inlined placer (breaks 4 CaretModel spy tests, fixed in next commit)"
```

---

### Task 5: Add auto-apply effect on `selection` and simplify `selectAll`

Currently `#applyRangeToDOM` is only invoked from two places: explicitly from `selectAll`, and inside `watch(dom.indexed, ...)`. External callers that use `caret.selection(...)` to express intent don't trigger placement. We add an `effect` that re-applies on every `selection` write so signal-only callers (from Task 7 migrations) work.

**Files:**
- Modify: `packages/core/src/features/caret/CaretModel.ts`

- [ ] **Step 1: Add the auto-apply effect**

In the `CaretModel` constructor, inside the existing `lifecycle.onMounted(() => { ... })` block, add a new `effect` after the existing `effect`:

Find this block (around lines 34–46):

```ts
lifecycle.onMounted(() => {
    this.#enableFocusTracking()
    this.#enableSelectionTracking()
    watch(dom.indexed, () => {
        dom.reconcile({isUserSelecting: this.isUserSelecting()})
        this.#applyRangeToDOM()
    })
    effect(() => {
        const isUserSelecting = this.isUserSelecting()
        dom.readOnly()
        dom.reconcile({isUserSelecting})
    })
})
```

Replace with:

```ts
lifecycle.onMounted(() => {
    this.#enableFocusTracking()
    this.#enableSelectionTracking()
    watch(dom.indexed, () => {
        dom.reconcile({isUserSelecting: this.isUserSelecting()})
        this.#applyRangeToDOM()
    })
    effect(() => {
        const isUserSelecting = this.isUserSelecting()
        dom.readOnly()
        dom.reconcile({isUserSelecting})
    })
    effect(() => {
        this.selection()
        this.#applyRangeToDOM()
    })
})
```

- [ ] **Step 2: Simplify `selectAll`**

Find the existing `selectAll` method (around lines 49–52):

```ts
selectAll(): void {
    this.selection({start: 0, end: this.value.current().length})
    this.#applyRangeToDOM()
}
```

Replace with:

```ts
selectAll(): void {
    this.selection({start: 0, end: this.value.current().length})
}
```

The auto-apply effect now handles DOM placement.

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @markput/core build`
Expected: clean build.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @markput/core test --run`
Expected: still 4 failing tests from Task 4 (we haven't fixed them yet). The new auto-apply effect should not cause additional failures. If new tests fail (e.g., infinite-loop assertion in signals lib), investigate — the effect setting `selection` from inside itself could loop. Inside `#applyRangeToDOM` we only call `this.selection(clamped)` when `clamped` differs from `sel`. Since `selection` uses `shallow` equality, writing the same value is a no-op and the effect won't refire.

If you see a new infinite-loop failure, guard the write inside `#applyRangeToDOM` with a re-entrancy flag:

```ts
#applyingRangeToDOM = false

#applyRangeToDOM(): void {
    if (this.#applyingRangeToDOM) return
    this.#applyingRangeToDOM = true
    try {
        // ...existing body...
    } finally {
        this.#applyingRangeToDOM = false
    }
}
```

Only add this if testing reveals a loop. Default expectation: no loop.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/caret/CaretModel.ts
git commit -m "refactor(caret): auto-apply selection to DOM via effect"
```

---

### Task 6: Update `CaretModel.spec.ts` — replace `dom.placeAt`/`dom.placeRange` spies with direct DOM assertions

The four tests that spy on `dom.placeAt`/`dom.placeRange` test indirect behavior (that `CaretModel` calls the right adapter). After the refactor, those adapters don't exist. Rewrite the tests to assert observable outcomes: window selection focus node and offset.

**Files:**
- Modify: `packages/core/src/features/caret/CaretModel.spec.ts`

- [ ] **Step 1: Update `selectAll > sets selection to full value range and applies it to DOM`**

Open `packages/core/src/features/caret/CaretModel.spec.ts`. Find lines 88–111 (the `selectAll > sets selection to full value range and applies it to DOM` test):

```ts
it('sets selection to full value range and applies it to DOM', () => {
    const store = new Store()
    store.props.set({defaultValue: 'hello'})
    store.lifecycle.mounted()
    const container = document.createElement('div')
    const span = document.createElement('span')
    span.appendChild(document.createTextNode('hello'))
    container.appendChild(span)
    document.body.appendChild(container)
    store.dom.container(container)
    store.lifecycle.rendered()

    const placeRangeSpy = vi.spyOn(store.dom, 'placeRange').mockReturnValue({
        ok: true,
        value: {applied: {start: 0, end: 5}},
    })

    store.caret.selectAll()
    expect(placeRangeSpy).toHaveBeenCalledWith({start: 0, end: 5})
    expect(store.caret.selection()).toEqual({start: 0, end: 5})
    container.remove()
    vi.restoreAllMocks()
})
```

Replace with:

```ts
it('sets selection to full value range and applies it to DOM', () => {
    const store = new Store()
    store.props.set({defaultValue: 'hello'})
    store.lifecycle.mounted()
    const container = document.createElement('div')
    const span = document.createElement('span')
    span.appendChild(document.createTextNode('hello'))
    container.appendChild(span)
    document.body.appendChild(container)
    store.dom.container(container)
    store.lifecycle.rendered()

    store.caret.selectAll()
    expect(store.caret.selection()).toEqual({start: 0, end: 5})
    const sel = window.getSelection()
    expect(sel?.anchorNode).toBe(span.firstChild)
    expect(sel?.anchorOffset).toBe(0)
    expect(sel?.focusNode).toBe(span.firstChild)
    expect(sel?.focusOffset).toBe(5)
    container.remove()
})
```

- [ ] **Step 2: Update `selectAll > clears selection when placeRange fails`**

Find lines 112–122:

```ts
it('clears selection when placeRange fails', () => {
    const store = new Store()
    store.props.set({defaultValue: 'hello'})
    store.lifecycle.mounted()

    vi.spyOn(store.dom, 'placeRange').mockReturnValue({ok: false, reason: 'notIndexed'})

    store.caret.selectAll()
    expect(store.caret.selection()).toBeUndefined()
    vi.restoreAllMocks()
})
```

Replace with:

```ts
it('clears selection when DOM is not yet indexed', () => {
    const store = new Store()
    store.props.set({defaultValue: 'hello'})
    store.lifecycle.mounted()

    // No container set → dom.index() is undefined → placement bails out.
    store.caret.selectAll()
    expect(store.caret.selection()).toBeUndefined()
})
```

- [ ] **Step 3: Update `restoration via dom.indexed > restores selection after indexed fires`**

Find lines 200–215:

```ts
it('restores selection after indexed fires', () => {
    const store = new Store()
    const container = document.createElement('div')
    document.body.appendChild(container)

    const placeAtSpy = vi.spyOn(store.dom, 'placeAt').mockReturnValue({ok: true, value: {applied: 5}})
    store.props.set({defaultValue: 'hello'})
    store.dom.container(container)
    store.lifecycle.mounted()
    store.caret.position(5)

    store.lifecycle.rendered()
    expect(placeAtSpy).toHaveBeenCalledWith(5)
    container.remove()
    placeAtSpy.mockRestore()
})
```

Replace with:

```ts
it('restores selection after indexed fires', () => {
    const store = new Store()
    const container = document.createElement('div')
    const span = document.createElement('span')
    span.appendChild(document.createTextNode('hello'))
    container.appendChild(span)
    document.body.appendChild(container)

    store.props.set({defaultValue: 'hello'})
    store.dom.container(container)
    store.lifecycle.mounted()
    store.caret.position(5)

    store.lifecycle.rendered()
    const sel = window.getSelection()
    expect(sel?.focusNode).toBe(span.firstChild)
    expect(sel?.focusOffset).toBe(5)
    container.remove()
})
```

- [ ] **Step 4: Update `restoration via dom.indexed > skips restoration when isUserSelecting`**

Find lines 217–226:

```ts
it('skips restoration when isUserSelecting', () => {
    const store = new Store()
    const placeAtSpy = vi.spyOn(store.dom, 'placeAt')
    store.lifecycle.mounted()
    store.caret.position(3)
    store.caret.isUserSelecting(true)
    store.lifecycle.rendered()
    expect(placeAtSpy).not.toHaveBeenCalled()
    placeAtSpy.mockRestore()
})
```

Replace with:

```ts
it('skips restoration when isUserSelecting', () => {
    const store = new Store()
    store.props.set({defaultValue: 'hello'})
    const container = document.createElement('div')
    const span = document.createElement('span')
    span.appendChild(document.createTextNode('hello'))
    container.appendChild(span)
    document.body.appendChild(container)
    store.dom.container(container)
    store.lifecycle.mounted()
    store.caret.isUserSelecting(true)
    store.caret.position(3)

    // Clear any pre-existing browser selection so we can detect non-changes.
    window.getSelection()?.removeAllRanges()
    store.lifecycle.rendered()

    const sel = window.getSelection()
    expect(sel?.rangeCount ?? 0).toBe(0)
    container.remove()
})
```

- [ ] **Step 5: Update `restoration via dom.indexed > clears selection when placeAt fails`**

Find lines 228–240:

```ts
it('clears selection when placeAt fails', () => {
    const store = new Store()
    const container = document.createElement('div')
    document.body.appendChild(container)
    vi.spyOn(store.dom, 'placeAt').mockReturnValue({ok: false, reason: 'notIndexed'})
    store.dom.container(container)
    store.lifecycle.mounted()
    store.caret.position(3)
    store.lifecycle.rendered()
    expect(store.caret.selection()).toBeUndefined()
    container.remove()
    vi.restoreAllMocks()
})
```

Replace with:

```ts
it('clears selection when no text candidate exists for the position', () => {
    // Empty container: no token elements registered → placer can't find a target → selection cleared.
    const store = new Store()
    const container = document.createElement('div')
    document.body.appendChild(container)
    store.props.set({defaultValue: ''})
    store.dom.container(container)
    store.lifecycle.mounted()
    store.caret.position(3)
    store.lifecycle.rendered()
    expect(store.caret.selection()).toBeUndefined()
    container.remove()
})
```

Note: depending on how `value=''` + position=3 interacts (value.length=0, position clamped to 0, then no text target), the assertion may need adjustment. If clamping causes the test to instead assert `selection()` equals `{start: 0, end: 0}` with selection cleared because the empty container has no text node, verify the actual behavior and adjust the assertion to match — but prefer to keep the test demonstrating "no text candidate ⇒ selection cleared".

- [ ] **Step 6: Run CaretModel tests**

Run: `pnpm --filter @markput/core test --run CaretModel`
Expected: all `CaretModel.spec.ts` tests pass.

- [ ] **Step 7: Run all core tests**

Run: `pnpm --filter @markput/core test --run`
Expected: all tests pass. No regressions elsewhere.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/features/caret/CaretModel.spec.ts
git commit -m "refactor(caret): rewrite CaretModel spy tests as DOM-outcome assertions"
```

---

### Task 7: Migrate external call sites to signal-only

Three files reach into `DomModel` for caret placement:
- `keyboard/arrowNav.ts` (2 call sites: `focusAddress`, `placeAt`)
- `keyboard/blockEdit.ts` (1 call site: `focusAddress`)
- `shared/classes/MarkputHandler.ts` (1 call site: `focusAddress`)

Each one is replaced by setting `caret.selection({start, end})`. The auto-apply effect from Task 5 handles the DOM placement.

**Files:**
- Modify: `packages/core/src/features/keyboard/arrowNav.ts`
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`
- Modify: `packages/core/src/shared/classes/MarkputHandler.ts`

- [ ] **Step 1: Update `arrowNav.ts`**

Find `shiftFocus` in `packages/core/src/features/keyboard/arrowNav.ts` (lines 28–71). Find the block:

```ts
event.preventDefault()
const result = store.dom.focusAddress(siblingAddress, direction === 'prev' ? 'end' : 'start')
if (!result.ok) return false
const sibling = store.parsing.index().resolve(siblingPath)
if (sibling?.type === 'mark') return true

if (direction === 'prev') {
    store.dom.placeAt(sibling?.position.end ?? 0, 'before')
    return true
}
store.dom.placeAt(sibling?.position.start ?? 0, 'after')
return true
```

Replace with:

```ts
event.preventDefault()
const sibling = store.parsing.index().resolve(siblingPath)
if (!sibling) return false
const pos = direction === 'prev' ? sibling.position.end : sibling.position.start
store.caret.selection({start: pos, end: pos})
return true
```

Note that for the mark case (`sibling.type === 'mark'`), the old code did `focusAddress` (focuses mark element + places collapsed range at its child boundary) then returned without calling `placeAt`. The new code sets selection to the mark's `position.end` (prev) or `position.start` (next), and `#applyRangeToDOM` handles the mark-boundary case via `#focusMarkBoundaryForRawPosition`. Verify this in Step 5.

- [ ] **Step 2: Update `blockEdit.ts` — `focusRow` helper**

Find `focusRow` in `packages/core/src/features/keyboard/blockEdit.ts` (lines 195–208):

```ts
function focusRow(store: KbCtx, token: Token, row: HTMLElement, caret: 'start' | 'end'): void {
    if (token.type === 'mark') {
        const path = store.parsing.index().pathFor(token)
        const address = path ? store.parsing.index().addressFor(path) : undefined
        if (address && store.dom.focusAddress(address).ok) return
    }

    row.focus()
    if (caret === 'start') {
        caretDom.setAtElement(row, 0)
        return
    }
    caretDom.setAtElement(row, Infinity)
}
```

Replace with:

```ts
function focusRow(store: KbCtx, token: Token, row: HTMLElement, caret: 'start' | 'end'): void {
    if (token.type === 'mark') {
        const pos = caret === 'start' ? token.position.start : token.position.end
        store.caret.selection({start: pos, end: pos})
        return
    }

    row.focus()
    if (caret === 'start') {
        caretDom.setAtElement(row, 0)
        return
    }
    caretDom.setAtElement(row, Infinity)
}
```

The non-mark branch is unchanged — `caretDom.setAtElement` is the established DOM manipulation for text rows in block layout, kept to preserve existing behavior in that path. (We could also migrate it to `caret.selection`, but the row may not be indexed at expected positions for block layout, and changing this is out of scope for the placer refactor.)

- [ ] **Step 3: Update `MarkputHandler.ts`**

Find `focus()` in `packages/core/src/shared/classes/MarkputHandler.ts` (lines 20–24):

```ts
focus() {
    const firstAddress = this.parsing.index().addressFor([0])
    if (firstAddress && this.dom.focusAddress(firstAddress).ok) return
    this.container?.focus()
}
```

Replace with:

```ts
focus() {
    if (this.parsing.tokens().length > 0) {
        this.caret.selection({start: 0, end: 0})
        return
    }
    this.container?.focus()
}
```

This requires `MarkputHandler` to accept `caret` as a constructor parameter. Find the constructor (lines 5–10):

```ts
export class MarkputHandler {
    constructor(
        private readonly dom: DomModel,
        private readonly overlayFeature: OverlayController,
        private readonly parsing: ParseController
    ) {}
```

Replace with:

```ts
export class MarkputHandler {
    constructor(
        private readonly dom: DomModel,
        private readonly overlayFeature: OverlayController,
        private readonly parsing: ParseController,
        private readonly caret: CaretModel
    ) {}
```

Add the `CaretModel` import at the top of the file:

```ts
import type {CaretModel} from '../../features/caret/CaretModel'
import type {DomModel} from '../../features/dom/DomModel'
import type {OverlayController} from '../../features/overlay/OverlayController'
import type {ParseController} from '../../features/parsing/ParseController'
```

(The existing imports are likely `DomModel`, `OverlayController`, `ParseController` — add `CaretModel` alongside, preserving alphabetical order.)

- [ ] **Step 4: Wire `caret` into `MarkputHandler` construction in `Store.ts`**

Find in `packages/core/src/store/Store.ts`:

```ts
readonly handler = new MarkputHandler(this.dom, this.overlay, this.parsing)
```

Replace with:

```ts
readonly handler = new MarkputHandler(this.dom, this.overlay, this.parsing, this.caret)
```

Note: `this.caret` is constructed before `this.handler` in the existing file (caret on line ~34, handler at the end). Verify ordering — if not, hoist `caret` above `handler` declaration. (Looking at the file from the Read earlier: `caret` is on line 34, `handler` is line 56 — safe.)

- [ ] **Step 5: Build and test**

Run: `pnpm --filter @markput/core build`
Expected: clean build.

Run: `pnpm --filter @markput/core test --run`
Expected: all tests pass. If any test in `keyboard` or `MarkputHandler` regions fails, the most likely cause is the mark-boundary placement path. Debug by manually setting `caret.selection({start: markPos, end: markPos})` in a node script and confirming `#focusMarkBoundaryForRawPosition` finds and focuses the mark element. Test by selecting a mark via arrow keys in storybook (`pnpm --filter @markput/react-storybook dev`) and ensuring caret lands on the mark.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/keyboard/arrowNav.ts packages/core/src/features/keyboard/blockEdit.ts packages/core/src/shared/classes/MarkputHandler.ts packages/core/src/store/Store.ts
git commit -m "refactor(caret): migrate keyboard nav and handler to signal-only caret API"
```

---

### Task 8: Delete `DomCaretPlacer.ts`, adapter methods on `DomModel`, and the four obsolete `DomModel.spec.ts` tests

Now that nothing calls `dom.placeAt` / `dom.placeRange` / `dom.focusAddress`, the adapters and their backing class are dead code.

**Files:**
- Delete: `packages/core/src/features/dom/DomCaretPlacer.ts`
- Modify: `packages/core/src/features/dom/DomModel.ts`
- Modify: `packages/core/src/features/dom/DomModel.spec.ts`
- Modify: `packages/core/src/features/dom/README.md`
- Modify: `packages/core/src/features/caret/README.md`

- [ ] **Step 1: Confirm no remaining callers**

Run: `grep -rn "\.placeAt\|\.placeRange\|\.focusAddress" packages/core/src packages/common 2>/dev/null | grep -v ".spec.ts\|DomCaretPlacer\|CaretModel\|^Binary"`
Expected: zero matches outside of tests, `DomCaretPlacer.ts` (about to be deleted), and `CaretModel.ts` (where the placer logic was inlined).

If matches appear, stop and add a migration step before continuing.

- [ ] **Step 2: Delete `DomCaretPlacer.ts`**

Run: `rm packages/core/src/features/dom/DomCaretPlacer.ts`

- [ ] **Step 3: Remove `DomCaretPlacer` imports and adapter methods from `DomModel.ts`**

Open `packages/core/src/features/dom/DomModel.ts`. Remove these lines:

```ts
import {DomCaretPlacer} from './DomCaretPlacer'
import type {DomCaretHost} from './DomCaretPlacer'
```

Remove the `#caret` field:

```ts
readonly #caret: DomCaretPlacer
```

Remove the `caretHost` block and `#caret` construction in the constructor:

```ts
const caretHost: DomCaretHost = {
    isIndexed: () => this.index() !== undefined,
    pathElements: () => this.#indexer.pathElements(),
    pathElementsFor: address => this.#indexer.pathElementsFor(address),
}
this.#caret = new DomCaretPlacer(caretHost, parsing, value)
```

Remove the three adapter methods (`placeAt`, `placeRange`, `focusAddress`):

```ts
placeAt(
    rawPosition: number,
    affinity: 'before' | 'after' = 'after'
): Result<{applied: number}, 'notIndexed' | 'invalidBoundary'> {
    return this.#caret.placeAt(rawPosition, affinity)
}

placeRange(range: Range): Result<{applied: Range}, 'notIndexed' | 'invalidBoundary'> {
    return this.#caret.placeRange(range)
}

focusAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): Result<void, 'notIndexed' | 'stale'> {
    return this.#caret.focusAddress(address, boundary)
}
```

Also remove the `value: ValueModel` constructor parameter since `DomModel` no longer needs it. Check if it's used elsewhere in the class body (`grep "this.value\|value\." packages/core/src/features/dom/DomModel.ts`). If unused, remove `private readonly value: ValueModel` from the constructor params and remove the `ValueModel` import. If still used (e.g., in `lifecycle.onMounted`), keep it.

Actually verify before deleting — the click handler in the constructor uses `this.parsing.tokens()`, not `value`. Looking at the constructor block:

```ts
listen(container, 'click', () => {
    const tokens = this.parsing.tokens()
    if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
        const c = this.container()
        const element = c ? firstHtmlChild(c) : null
        element?.focus()
    }
})
```

No `value` reference. Remove `private readonly value: ValueModel` from the constructor signature and remove `import type {ValueModel} from '../value/ValueModel'`.

Also remove now-unused type imports if applicable. Check `Range`, `Result`, `TokenAddress`: if those were only used by the deleted adapter signatures, remove them from the import block. (Likely `Range`, `TokenAddress`, `Result` were only used in the deleted methods. Verify with one more search of the file.)

The resulting `DomModel.ts` should be substantially shorter — ~120 lines instead of 162.

- [ ] **Step 4: Update `Store.ts` to drop `value` from `DomModel` construction**

Find:

```ts
readonly dom = new DomModel(this.lifecycle, this.props, this.parsing, this.value)
```

Replace with:

```ts
readonly dom = new DomModel(this.lifecycle, this.props, this.parsing)
```

- [ ] **Step 5: Delete obsolete `DomModel.spec.ts` tests**

Open `packages/core/src/features/dom/DomModel.spec.ts`. Delete these four tests (lines ~315–370):

- `'places the caret at a raw position inside a structural text surface'`
- `'placeAt returns applied position on success'`
- `'placeAt clamps position to value length'`
- `'placeRange returns applied range on success'`
- `'placeRange clamps to value length'`
- `'focuses the element for an address'`

(That's six tests — count them in the existing file. Delete each `it(...)` block in full.)

The four tests immediately after them (`clamps OOB caret range and places at maxPos`, etc.) test the auto-apply behavior via `caret.selection` and `lifecycle.rendered`. **Keep those** — they exercise the new behavior correctly. They might benefit from moving to `CaretModel.spec.ts` instead, since they test caret-driven placement, but they remain valid as integration tests on `DomModel.spec.ts` (testing the dom + caret wiring together). For YAGNI, leave them in place.

- [ ] **Step 6: Update `packages/core/src/features/dom/README.md`**

Open the file. Find the bullet describing `DomCaretPlacer.ts`:

```
- `DomCaretPlacer.ts` — places carets and ranges back into the DOM from raw positions or token addresses (`placeAt`, `placeRange`, `focusAddress`). Out-of-bounds inputs are clamped; placements that cannot resolve return `invalidBoundary` and the caller is expected to surface that.
```

Delete that bullet entirely.

- [ ] **Step 7: Update `packages/core/src/features/caret/README.md`**

Open the file. Add a single new bullet (or append to the existing description) noting:

```
- `CaretModel` is the single source of truth for caret state AND for applying that state to the DOM. External code should never imperatively move the caret; instead, write to `caret.selection` and let the auto-apply effect handle DOM placement.
```

Place this bullet where it fits the existing structure of the README.

- [ ] **Step 8: Final build + test**

Run: `pnpm --filter @markput/core build`
Expected: clean build.

Run: `pnpm --filter @markput/core test --run`
Expected: all tests pass. Count of passing tests should be lower than before by the count of deleted tests (6) — confirm the count matches `previous_count - 6`.

Run: `pnpm --filter @markput/react build && pnpm --filter @markput/vue build`
Expected: both downstream packages build cleanly. This catches API-shape regressions visible to consumers.

- [ ] **Step 9: Run react + vue test suites (smoke)**

Run: `pnpm --filter @markput/react test --run`
Expected: all tests pass. If a test invokes `dom.focusAddress` / `dom.placeAt` / `dom.placeRange` directly, migrate it the same way as the core callers.

Run: `pnpm --filter @markput/vue test --run`
Expected: same.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/features/dom/DomModel.ts packages/core/src/features/dom/DomModel.spec.ts packages/core/src/features/dom/README.md packages/core/src/features/caret/README.md packages/core/src/store/Store.ts
git rm packages/core/src/features/dom/DomCaretPlacer.ts
git commit -m "refactor(dom): delete DomCaretPlacer and caret-placement adapters from DomModel"
```

---

### Task 9: Manual smoke test in storybook

Type-checked and unit-tested code can still misbehave when wired into a real browser. Verify three caret-driven flows by hand before declaring the refactor done.

**Files:** none modified.

- [ ] **Step 1: Start the React storybook**

Run: `pnpm --filter @markput/react-storybook dev` (or whichever script the storybook uses — check `packages/react/storybook/package.json`).
Expected: dev server starts. Note the URL.

- [ ] **Step 2: Smoke-test arrow navigation across mark boundaries**

Open the storybook page that exercises mark tokens (e.g. the Drag story or Basic story). Click into the editor, type some text and a mark via the trigger (`@`). Place the caret immediately before a mark and press ArrowLeft to step backward across it. Then press ArrowRight to step forward.

Expected:
- Caret moves to the end of the previous token (text or mark).
- When stepping into a mark token, the caret lands on the mark boundary, not inside its child content (for marks without text children).

If the caret jumps unpredictably or fails to advance, the most likely cause is the `position.start`/`position.end` math in `arrowNav.ts` or the mark-boundary path in `#applyRangeToDOM`. Console-log the `selection()` write site and the resolved `clamped` value to debug.

- [ ] **Step 3: Smoke-test `MarkputHandler.focus()`**

In the storybook, find a story that exposes `.focus()` on the handler (e.g. a focus-on-mount story or an external focus button). Trigger focus and verify the caret lands at position 0 of the value when the value is non-empty, and at the container when empty.

- [ ] **Step 4: Smoke-test block layout (drag mode)**

Open the React Drag story. Verify:
- Clicking a mark row, then pressing ArrowLeft, jumps to the end of the previous row.
- Pressing Enter at the start of a row creates a leading empty row (existing behavior; should not regress).

- [ ] **Step 5: Manual test report**

If all three pass, the refactor is complete. If any fail, file the failure inline as a follow-up note in the commit message of the next change. No commit for this task — it's verification only.

---

## Self-Review Checklist (run after writing the plan)

- **Spec coverage:** The original brief was "remove DomCaretPlacer + adapter methods, make each model one source of truth, signal-only API". Tasks 1–8 cover all of that. Task 9 is verification.
- **Placeholder scan:** No "TBD" / "add validation" / "implement later" entries. Every code-changing step includes the exact code to write.
- **Type consistency:** `CaretModel` constructor signature `(lifecycle, dom, parsing, value)` is set in Task 2 and used consistently in Tasks 3–7. `DomModel` constructor drops `value` in Task 8. `MarkputHandler` adds `caret` in Task 7. `Store.ts` wiring is updated in both Task 2 and Task 7.
- **Affinity:** Mentioned and dropped only in `CaretModel`'s `#findTextTargetForRawPosition` (Task 3). `DomBoundary`'s `affinity` is left untouched (correct — out of scope).
- **Test handling:** Task 4 deliberately ends with 4 failing tests; Task 6 fixes them. The intermediate commit's message flags this so a future bisecter doesn't get confused.
- **External package impact:** Task 8 Step 9 runs the react + vue test suites to catch any consumer that reached into the deleted API. If they did, follow the same migration pattern.

---

## Notes for the Implementing Engineer

- **Why we drop affinity:** `#findTextTargetForRawPosition` only consulted `affinity` when no candidate token contained the position — i.e. gap positions (between `\n\n` separator chars). None of the 4 caller sites ever pass a position that falls in a gap; they all pass token `position.start` or `position.end`, which are owned by exactly one token. Carrying the parameter through the new code adds complexity for no observable benefit. If a real-world gap-position bug ever appears, reintroduce affinity at that point.
- **Why we don't add a public `placeAt` method on `CaretModel`:** The user explicitly chose signal-only. Imperative placement methods would split the API surface again — exactly the problem we set out to solve.
- **Why `MarkputHandler.focus()` checks `parsing.tokens().length`:** The empty-value case is the only legitimate fallback. If the value is non-empty, `caret.selection({start: 0, end: 0})` will always find a target (the first token always starts at position 0). If it doesn't, that's a bug in the placer worth surfacing, not papering over with a `container.focus()` fallback.
- **Performance:** Each `caret.selection(...)` write now triggers an `effect` that walks `pathElements` to find a text target. For typical documents (<100 tokens) this is trivially fast; if a real perf issue surfaces, memoize the position→element lookup behind a `computed`.
