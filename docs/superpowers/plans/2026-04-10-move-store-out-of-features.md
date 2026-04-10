# Move Store out of Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `Store`, `BlockStore`, and `BlockRegistry` from `features/store/` and `shared/classes/` into a new top-level `src/store/` directory, reflecting that they are editor infrastructure — not features.

**Architecture:** Store is the composition root that instantiates all features. BlockStore is a per-block reactive state container used via BlockRegistry. Neither is a feature (no `enable()`/`disable()`). They move to `src/store/` as a sibling to `features/` and `shared/`. All import paths update accordingly. The public API (`@markput/core`) is unchanged.

**Tech Stack:** TypeScript, pnpm, Vitest, oxlint

---

## File Structure

### Moving

| Current                                             | New                                        |
| --------------------------------------------------- | ------------------------------------------ |
| `packages/core/src/features/store/Store.ts`         | `packages/core/src/store/Store.ts`         |
| `packages/core/src/features/store/Store.spec.ts`    | `packages/core/src/store/Store.spec.ts`    |
| `packages/core/src/features/store/index.ts`         | `packages/core/src/store/index.ts`         |
| `packages/core/src/features/store/README.md`        | `packages/core/src/store/README.md`        |
| `packages/core/src/shared/classes/BlockStore.ts`    | `packages/core/src/store/BlockStore.ts`    |
| `packages/core/src/shared/classes/BlockRegistry.ts` | `packages/core/src/store/BlockRegistry.ts` |

### Modifying (import path updates)

| File                                        | Change                                                             |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `packages/core/src/store/Store.ts`          | Update shared/classes import paths                                 |
| `packages/core/src/store/Store.spec.ts`     | Update shared import paths                                         |
| `packages/core/src/store/BlockStore.ts`     | Update shared import paths                                         |
| `packages/core/src/store/BlockRegistry.ts`  | Update BlockStore import path                                      |
| `packages/core/src/store/index.ts`          | New barrel — export Store, BlockStore, BlockRegistry, DropPosition |
| `packages/core/src/shared/classes/index.ts` | Remove BlockStore, BlockRegistry, DropPosition exports             |
| `packages/core/index.ts`                    | Change `./src/features/store` → `./src/store`                      |
| 18 feature files                            | Update `'../store/Store'` → `'../../store/Store'`                  |
| 6 feature spec files                        | Update `'../store/Store'` → `'../../store/Store'`                  |

### Deleting

- `packages/core/src/features/store/` (entire directory after move)

---

## Task 1: Move Store files to `src/store/`

**Files:**

- Move: `packages/core/src/features/store/Store.ts` → `packages/core/src/store/Store.ts`
- Move: `packages/core/src/features/store/Store.spec.ts` → `packages/core/src/store/Store.spec.ts`
- Move: `packages/core/src/features/store/index.ts` → `packages/core/src/store/index.ts`
- Move: `packages/core/src/features/store/README.md` → `packages/core/src/store/README.md`

- [ ] **Step 1: Create target directory and move files**

```bash
mkdir -p packages/core/src/store
mv packages/core/src/features/store/Store.ts packages/core/src/store/Store.ts
mv packages/core/src/features/store/Store.spec.ts packages/core/src/store/Store.spec.ts
mv packages/core/src/features/store/index.ts packages/core/src/store/index.ts
mv packages/core/src/features/store/README.md packages/core/src/store/README.md
rmdir packages/core/src/features/store
```

- [ ] **Step 2: Update Store.ts imports from shared**

In `packages/core/src/store/Store.ts`, the shared import was:

```typescript
import {BlockRegistry, KeyGenerator, MarkputHandler, NodeProxy} from '../../shared/classes'
```

Change to (one level deeper now):

```typescript
import {BlockRegistry, KeyGenerator, MarkputHandler, NodeProxy} from '../shared/classes'
```

Also update these shared imports from `'../../shared/...'` to `'../shared/...'`:

- `import {DEFAULT_OPTIONS} from '../../shared/constants'` → `import {DEFAULT_OPTIONS} from '../shared/constants'`
- `import {signal, computed, event, batch, watch} from '../../shared/signals'` → `import {signal, computed, event, batch, watch} from '../shared/signals'`
- `import type {SignalValues} from '../../shared/signals'` → `import type {SignalValues} from '../shared/signals'`
- `import type {CoreOption, ...} from '../../shared/types'` → `import type {CoreOption, ...} from '../shared/types'`
- `import {cx} from '../../shared/utils/cx'` → `import {cx} from '../shared/utils/cx'`
- `import {merge} from '../../shared/utils/merge'` → `import {merge} from '../shared/utils/merge'`
- `import {shallow} from '../../shared/utils/shallow'` → `import {shallow} from '../shared/utils/shallow`
- CSS module import: `'../../styles.module.css'` → `'../styles.module.css'`

And feature imports from `'../featureName'` → `'../features/featureName'`:

- `'../arrownav'` → `'../features/arrownav'`
- `'../block-editing'` → `'../features/block-editing'`
- `'../clipboard'` → `'../features/clipboard'`
- `'../drag'` → `'../features/drag'`
- `'../editable'` → `'../features/editable'`
- `'../events'` → `'../features/events'`
- `'../focus'` → `'../features/focus'`
- `'../input'` → `'../features/input'`
- `'../lifecycle'` → `'../features/lifecycle'`
- `'../overlay'` → `'../features/overlay'`
- `'../parsing'` → `'../features/parsing'`
- `'../selection'` → `'../features/selection'`
- `'../slots'` → `'../features/slots'`

- [ ] **Step 3: Update Store.spec.ts imports**

In `packages/core/src/store/Store.spec.ts`:

- `import {DEFAULT_OPTIONS} from '../../shared/constants'` → `import {DEFAULT_OPTIONS} from '../shared/constants'`
- `import {setUseHookFactory, effect, effectScope, watch, batch} from '../../shared/signals'` → `import {setUseHookFactory, effect, effectScope, watch, batch} from '../shared/signals'`
- `import {parseWithParser} from '../parsing'` → `import {parseWithParser} from '../features/parsing'`

- [ ] **Step 4: Update `packages/core/index.ts`**

Change:

```typescript
export {Store} from './src/features/store'
```

To:

```typescript
export {Store} from './src/store'
```

- [ ] **Step 5: Update all 18 feature file imports of Store**

Every feature file that imports Store currently uses `'../store/Store'`. Since Store moved up one level, they now need `'../../store/Store'`.

Files to update (all use `import type {Store} from '../store/Store'` except specs which use `import {Store}`):

- `packages/core/src/features/parsing/ParseFeature.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/parsing/ParseFeature.spec.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/parsing/utils/valueParser.ts`: `'../../store/Store'` → `'../../../store/Store'`
- `packages/core/src/features/lifecycle/Lifecycle.spec.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/overlay/OverlayFeature.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/overlay/OverlayFeature.spec.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/focus/FocusFeature.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/focus/FocusFeature.spec.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/selection/TextSelectionFeature.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/selection/TextSelectionFeature.spec.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/input/InputFeature.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/events/SystemListenerFeature.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/events/SystemListenerFeature.spec.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/drag/DragFeature.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/editable/ContentEditableFeature.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/editable/ContentEditableFeature.spec.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/block-editing/BlockEditFeature.ts`: `'../store/Store'` → `'../../store/Store'`
- `packages/core/src/features/arrownav/ArrowNavFeature.ts`: `'../store/Store'` → `'../../store/Store'`

- [ ] **Step 6: Verify build and tests pass**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/store/Store.spec.ts`
Run: `pnpm run typecheck`
Run: `pnpm run lint`

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(core): move Store from features/store/ to src/store/"
```

---

## Task 2: Move BlockStore and BlockRegistry to `src/store/`

**Files:**

- Move: `packages/core/src/shared/classes/BlockStore.ts` → `packages/core/src/store/BlockStore.ts`
- Move: `packages/core/src/shared/classes/BlockRegistry.ts` → `packages/core/src/store/BlockRegistry.ts`
- Modify: `packages/core/src/shared/classes/index.ts`
- Modify: `packages/core/src/store/Store.ts`

- [ ] **Step 1: Move files**

```bash
mv packages/core/src/shared/classes/BlockStore.ts packages/core/src/store/BlockStore.ts
mv packages/core/src/shared/classes/BlockRegistry.ts packages/core/src/store/BlockRegistry.ts
```

- [ ] **Step 2: Update BlockStore.ts imports**

In `packages/core/src/store/BlockStore.ts`, the imports from shared used relative paths like `'../signals'`, `'../types'`, etc. Since BlockStore moved from `shared/classes/` to `store/`, the relative paths to shared remain the same depth:

- `import {signal} from '../signals'` → `import {signal} from '../shared/signals'`
- `import type {DragAction, DragActions} from '../types'` → `import type {DragAction, DragActions} from '../shared/types'`
- `import {getDragDropPosition, getDragTargetIndex, parseDragSourceIndex} from '../utils/dragUtils'` → `import {getDragDropPosition, getDragTargetIndex, parseDragSourceIndex} from '../shared/utils/dragUtils'`
- `import {isClickOutside, isEscapeKey} from '../utils/menuUtils'` → `import {isClickOutside, isEscapeKey} from '../shared/utils/menuUtils'`

- [ ] **Step 3: Update BlockRegistry.ts import**

In `packages/core/src/store/BlockRegistry.ts`:

- `import {BlockStore} from './BlockStore'` — no change needed (same directory).

- [ ] **Step 4: Update Store.ts to import BlockRegistry from local**

In `packages/core/src/store/Store.ts`, change:

```typescript
import {BlockRegistry, KeyGenerator, MarkputHandler, NodeProxy} from '../shared/classes'
```

To:

```typescript
import {KeyGenerator, MarkputHandler, NodeProxy} from '../shared/classes'
import {BlockRegistry} from './BlockRegistry'
```

- [ ] **Step 5: Update `packages/core/src/shared/classes/index.ts`**

Remove these lines:

```typescript
export {BlockStore} from './BlockStore'
export type {DropPosition} from './BlockStore'
export {BlockRegistry} from './BlockRegistry'
```

- [ ] **Step 6: Update `packages/core/src/store/index.ts`**

Replace contents with:

```typescript
export {Store} from './Store'
export {BlockStore} from './BlockStore'
export type {DropPosition} from './BlockStore'
export {BlockRegistry} from './BlockRegistry'
```

- [ ] **Step 7: Verify build and tests pass**

Run: `pnpm test`
Run: `pnpm run typecheck`
Run: `pnpm run lint`

Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(core): move BlockStore and BlockRegistry into src/store/"
```

---

## Task 3: Run full verification

- [ ] **Step 1: Run all checks**

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run format
```

Expected: All pass with zero errors.

- [ ] **Step 2: Commit any formatting fixes if needed**

```bash
git add -A && git commit -m "style: format after store relocation"
```
