# Remove `blockIndex` Prop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `blockIndex` prop from `Container.tsx` and `Block.tsx` in the React package, deriving the index internally in `Block` instead.

**Architecture:** `Container` stops passing the array index to `Block`. `Block` subscribes to `store.state.tokens` and computes its own index via `tokens.indexOf(token)`. The computed index is passed to `BlockStore.attachContainer()` and `DragHandle` internally. Core API and Vue components are unchanged.

**Tech Stack:** React 19, TypeScript

---

### Task 1: Remove `blockIndex` prop from Container

**Files:**
- Modify: `packages/react/markput/src/components/Container.tsx:25`

- [ ] **Step 1: Edit Container.tsx**

Change line 25 from:
```tsx
? tokens.map((t, i) => <Block key={key.get(t)} token={t} blockIndex={i} />)
```
to:
```tsx
? tokens.map(t => <Block key={key.get(t)} token={t} />)
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm run typecheck`
Expected: FAIL — `Block` component no longer expects `blockIndex` prop but `Container` still won't pass it (this step validates the edit was made; the type error will resolve in Task 2)

---

### Task 2: Update Block component to compute index internally

**Files:**
- Modify: `packages/react/markput/src/components/Block.tsx:15-30`

- [ ] **Step 1: Edit Block.tsx interface**

Remove `blockIndex` from the `BlockProps` interface:

```tsx
interface BlockProps {
	token: TokenType
}
```

- [ ] **Step 2: Edit Block component signature and add tokens subscription**

Change the component destructuring from:
```tsx
export const Block = memo(({token, blockIndex}: BlockProps) => {
```
to:
```tsx
export const Block = memo(({token}: BlockProps) => {
```

Add a `tokens` subscription after the `useMarkput` calls (after line 26). Add a new `useMarkput` call to subscribe to tokens:
```tsx
const tokens = useMarkput(s => s.state.tokens)
const blockIndex = tokens.indexOf(token)
```

- [ ] **Step 3: Verify full typecheck passes**

Run: `pnpm run typecheck`
Expected: PASS

---

### Task 3: Run all checks

- [ ] **Step 1: Run all verification commands**

Run each and verify PASS:
```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run format
```

- [ ] **Step 2: Commit**

```bash
git add packages/react/markput/src/components/Container.tsx packages/react/markput/src/components/Block.tsx
git commit -m "refactor(react): remove blockIndex prop from Container and Block, derive internally"
```
