# Remove `replaceAll` from ValueFeature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete `replaceAll()` from `ValueFeature`, move `readOnly` guard into `current`'s setter, and route all callers through `current()` instead.

**Architecture:** Remove the convenience wrapper so the value feature exposes one write API (`current`) for full replacement and one (`replaceRange`) for surgical edits. `readOnly` enforcement lives in the `current` computed setter, shared by both paths.

**Tech Stack:** TypeScript, Vitest, `@markput/core` signals

---

### Task 1: Move `readOnly` guard into `current` setter in ValueFeature

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.ts:8-16`

- [ ] **Step 1: Add `readOnly` guard to `current` setter**

Add `if (this.props.readOnly()) return` after the `undefined` check in the `current` computed's setter:

```ts
readonly current = computed<string>({
    initial: () => this.props.value() ?? this.props.defaultValue() ?? '',
    get: field => (this.isControlledMode() ? (this.props.value() ?? '') : field()),
    set: (next, field) => {
        if (next === undefined) return
        if (this.props.readOnly()) return
        if (!this.isControlledMode()) field(next)
        this.props.onChange()?.(next)
    },
})
```

- [ ] **Step 2: Run tests to verify guard works via `replaceRange`**

Run: `pnpm -w exec vitest run packages/core/src/features/value/ValueFeature.spec.ts`
Expected: All tests pass, including the readOnly test (guard still works because `replaceRange` still calls `this.current(next)` at the end)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/value/ValueFeature.ts
git commit -m "refactor(value): move readOnly guard into current setter"
```

---

### Task 2: Remove `readOnly` guard from `replaceRange`

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.ts:20-27`

- [ ] **Step 1: Delete the `readOnly` check from `replaceRange`**

```ts
replaceRange(range: RawRange, replacement: string): void {
    const cur = this.current()
    if (range.start < 0 || range.end < range.start || range.end > cur.length) return
    const next = cur.slice(0, range.start) + replacement + cur.slice(range.end)
    if (next === cur) return
    this.current(next)
}
```

- [ ] **Step 2: Run tests**

Run: `pnpm -w exec vitest run packages/core/src/features/value/ValueFeature.spec.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/value/ValueFeature.ts
git commit -m "refactor(value): remove redundant readOnly guard from replaceRange"
```

---

### Task 3: Delete `replaceAll` method from `ValueFeature`

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.ts:29-31`

- [ ] **Step 1: Remove the `replaceAll` method**

Delete lines 29-31:

```ts
replaceAll(next: string): void {
    return this.replaceRange({start: 0, end: this.current().length}, next)
}
```

- [ ] **Step 2: Verify build fails on missing method (callers not yet updated)**

Run: `pnpm -w exec tsc --noEmit -p packages/core/tsconfig.json 2>&1 | head -20`
Expected: TypeScript errors about `replaceAll` not existing on `ValueFeature` at call sites

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/value/ValueFeature.ts
git commit -m "refactor(value): remove replaceAll method"
```

---

### Task 4: Update `DragFeature` call sites

**Files:**
- Modify: `packages/core/src/features/drag/DragFeature.ts:62,74,83,92`

- [ ] **Step 1: Replace `this.value.replaceAll(newValue)` with `this.value.current(newValue)` in all 4 methods**

In `#reorder` (line 62):
```ts
this.value.current(newValue)
```

In `#add` (line 74):
```ts
this.value.current(newValue)
```

In `#delete` (line 83):
```ts
this.value.current(newValue)
```

In `#duplicate` (line 92):
```ts
this.value.current(newValue)
```

- [ ] **Step 2: Run DragFeature tests**

Run: `pnpm -w exec vitest run packages/core/src/features/drag/DragFeature.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/drag/DragFeature.ts
git commit -m "refactor(drag): replace replaceAll with current()"
```

---

### Task 5: Update `blockEdit` call sites

**Files:**
- Modify: `packages/core/src/features/keyboard/blockEdit.ts:93,105,128,144,186`

- [ ] **Step 1: Replace all `store.value.replaceAll(newValue)` with `store.value.current(newValue)`**

Line 93:
```ts
store.value.current(newValue)
```

Line 105:
```ts
store.value.current(newValue)
```

Line 128:
```ts
store.value.current(newValue)
```

Line 144:
```ts
store.value.current(newValue)
```

Line 186:
```ts
store.value.current(newValue)
```

- [ ] **Step 2: Run typecheck to verify no remaining `replaceAll` references in source**

Run: `pnpm -w exec tsc --noEmit -p packages/core/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/keyboard/blockEdit.ts
git commit -m "refactor(keyboard): replace replaceAll with current() in blockEdit"
```

---

### Task 6: Update `replaceAllContentWith` helper body

**Files:**
- Modify: `packages/core/src/features/keyboard/input.ts:270-274`

- [ ] **Step 1: Change `store.value.replaceAll(newContent)` to `store.value.current(newContent)`**

```ts
export function replaceAllContentWith(store: KbCtx, newContent: string): void {
    store.caret.selecting(undefined)
    store.caret.range({start: newContent.length, end: newContent.length})
    store.value.current(newContent)
}
```

Function name and export stay unchanged.

- [ ] **Step 2: Run input tests**

Run: `pnpm -w exec vitest run packages/core/src/features/keyboard/input.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/keyboard/input.ts
git commit -m "refactor(keyboard): update replaceAllContentWith body to use current()"
```

---

### Task 7: Update test files — mechanical `replaceAll` → `current`

**Files:**
- Modify: `packages/core/src/store/Store.spec.ts:139,149,159,168`
- Modify: `packages/core/src/features/parsing/ParseFeature.spec.ts:27,86,125`
- Modify: `packages/core/src/features/overlay/OverlayFeature.spec.ts:40,64,75,103`
- Modify: `packages/core/src/features/mark/MarkController.spec.ts:62`
- Modify: `packages/core/src/features/dom/DomFeature.spec.ts:159`

- [ ] **Step 1: `Store.spec.ts`**

Line 139: `store.value.replaceAll('hello')` → `store.value.current('hello')`
Line 149: `store.value.replaceAll('world')` → `store.value.current('world')`
Line 159: `store.value.replaceAll('world')` → `store.value.current('world')`
Line 168: `store.value.replaceAll('test')` → `store.value.current('test')`

- [ ] **Step 2: `ParseFeature.spec.ts`**

Line 27: `store.value.replaceAll('world')` → `store.value.current('world')`
Line 86: `store.value.replaceAll('second')` → `store.value.current('second')`
Line 125: `store.value.replaceAll('hello')` → `store.value.current('hello')`

- [ ] **Step 3: `OverlayFeature.spec.ts`**

Line 40: `store.value.replaceAll(store.value.current() + ' ')` → `store.value.current(store.value.current() + ' ')`
Line 64: `store.value.replaceAll(store.value.current() + ' ')` → `store.value.current(store.value.current() + ' ')`
Line 75: `store.value.replaceAll(store.value.current() + ' ')` → `store.value.current(store.value.current() + ' ')`
Line 103: `store.value.replaceAll(store.value.current() + ' ')` → `store.value.current(store.value.current() + ' ')`

- [ ] **Step 4: `MarkController.spec.ts`**

Line 62: `store.value.replaceAll('different @[token]')` → `store.value.current('different @[token]')`

- [ ] **Step 5: `DomFeature.spec.ts`**

Line 159: `store.value.replaceAll('hello @[world]')` → `store.value.current('hello @[world]')`

- [ ] **Step 6: Run all impacted test files**

```bash
pnpm -w exec vitest run packages/core/src/store/Store.spec.ts packages/core/src/features/parsing/ParseFeature.spec.ts packages/core/src/features/overlay/OverlayFeature.spec.ts packages/core/src/features/mark/MarkController.spec.ts packages/core/src/features/dom/DomFeature.spec.ts
```
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/store/Store.spec.ts packages/core/src/features/parsing/ParseFeature.spec.ts packages/core/src/features/overlay/OverlayFeature.spec.ts packages/core/src/features/mark/MarkController.spec.ts packages/core/src/features/dom/DomFeature.spec.ts
git commit -m "test: replace replaceAll with current() in test files"
```

---

### Task 8: Update `ValueFeature.spec.ts` readOnly test

**Files:**
- Modify: `packages/core/src/features/value/ValueFeature.spec.ts:57-68`

- [ ] **Step 1: Change `replaceAll` to `current` in the readOnly test**

```ts
it('readOnly rejects editor-originated range replacement', () => {
    const store = new Store()
    const onChange = vi.fn()
    store.props.set({defaultValue: 'hello', readOnly: true, onChange})
    store.lifecycle.mounted()

    store.value.current('world')

    expect(onChange).not.toHaveBeenCalled()
    expect(store.value.current()).toBe('hello')
    expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
})
```

- [ ] **Step 2: Run ValueFeature tests**

Run: `pnpm -w exec vitest run packages/core/src/features/value/ValueFeature.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/value/ValueFeature.spec.ts
git commit -m "test(value): update readOnly test to call current() directly"
```

---

### Task 9: Update `DragFeature.spec.ts` spy

**Files:**
- Modify: `packages/core/src/features/drag/DragFeature.spec.ts:31,47,51`

- [ ] **Step 1: Replace spy and assertion**

Line 31: `const replaceAll = vi.spyOn(store.value, 'replaceAll')` → `const currentSpy = vi.spyOn(store.value, 'current')`

Line 33: `expect(replaceAll).not.toHaveBeenCalled()` → `expect(currentSpy).not.toHaveBeenCalled()`

Line 47: `const replaceAll = vi.spyOn(store.value, 'replaceAll')` → `const currentSpy = vi.spyOn(store.value, 'current')`

Line 51: `expect(replaceAll).toHaveBeenCalledWith('beta\n\n')` → `expect(currentSpy).toHaveBeenCalledWith('beta\n\n')`

- [ ] **Step 2: Run DragFeature tests**

Run: `pnpm -w exec vitest run packages/core/src/features/drag/DragFeature.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/drag/DragFeature.spec.ts
git commit -m "test(drag): update spy from replaceAll to current"
```

---

### Task 10: Update docs — `value/README.md`

**Files:**
- Modify: `packages/core/src/features/value/README.md:21-23`

- [ ] **Step 1: Remove `replaceAll` row from the Commands table**

Remove line 22 (`| \`replaceAll()\`   | ... |`).

Update the prose on line 24 (the sentence referencing "both these commands" still stands — `replaceRange` is the one command now):

```
Drag, clipboard, overlay, block editing, inline input, and mark commands use
`replaceRange` or write `current()` directly instead of mutating tokens
directly.
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/features/value/README.md
git commit -m "docs(value): remove replaceAll from README"
```

---

### Task 11: Update docs — `store/README.md`

**Files:**
- Modify: `packages/core/src/store/README.md:32`

- [ ] **Step 1: Replace `replaceRange()` or `replaceAll()` phrasing**

Line 32, change:
```
feature code routes edits through `store.value.replaceRange()` or `store.value.replaceAll()`
```
to:
```
feature code routes edits through `store.value.replaceRange()` or `store.value.current()`
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/store/README.md
git commit -m "docs(store): replace replaceAll with current() in README"
```

---

### Task 12: Update docs — AGENTS.md

**Files:**
- Modify: `AGENTS.md:63`

- [ ] **Step 1: Replace `replaceAll()` with `current()`**

Line 63, change:
```
`store.value.replaceAll()` with raw positions. Callers that want a specific
```
to:
```
`store.value.current()` with raw positions. Callers that want a specific
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: replace replaceAll with current() in AGENTS.md"
```

---

### Task 13: Update docs — website architecture and guides

**Files:**
- Modify: `packages/website/src/content/docs/development/architecture.md:91,104,315,345`
- Modify: `packages/website/src/content/docs/development/how-it-works.md:53`
- Modify: `packages/website/src/content/docs/guides/keyboard-handling.md:14`

- [ ] **Step 1: `architecture.md`**

Line 91: `then calls store.value.replaceRange() or replaceAll()` → `then calls store.value.replaceRange() or store.value.current()`

Line 104: `then call `store.value.replaceRange()` or `replaceAll()`.` → `then call `store.value.replaceRange()` or `store.value.current()`.`

Line 315: `// current, replaceRange(), replaceAll()` → `// current, replaceRange()`

Line 345: `store.value.replaceAll('Hello @[World]')` → `store.value.current('Hello @[World]')`

- [ ] **Step 2: `how-it-works.md`**

Line 53: `- raw value edits through `store.value.replaceRange()` / `replaceAll()` `` → `- raw value edits through `store.value.replaceRange()` / `store.value.current()` ``

- [ ] **Step 3: `keyboard-handling.md`**

Line 14: `4. Edits call `store.value.replaceRange()` or `store.value.replaceAll()`.` → `4. Edits call `store.value.replaceRange()` or `store.value.current()`.`

- [ ] **Step 4: Commit**

```bash
git add packages/website/src/content/docs/development/architecture.md packages/website/src/content/docs/development/how-it-works.md packages/website/src/content/docs/guides/keyboard-handling.md
git commit -m "docs(website): replace replaceAll with current() in docs"
```

---

### Task 14: Full verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

```bash
pnpm run typecheck
```
Expected: No errors

- [ ] **Step 3: Run build**

```bash
pnpm run build
```
Expected: Build succeeds

- [ ] **Step 4: Run linter**

```bash
pnpm run lint:check
```
Expected: No errors
