# Drag API Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the current `drag` prop into separate `layout` and `draggable` props, renaming and restructuring the API for clarity and extensibility.

**Architecture:** Replace the monolithic `drag?: boolean | { alwaysShowHandle }` prop with `layout?: 'inline' | 'block'` (controls rendering) and `draggable?: boolean | DraggableConfig` (controls drag interaction). Core features that check `store.props.drag()` switch to checking `store.props.layout()` for block-mode behavior and `store.props.draggable()` for drag-specific behavior.

**Tech Stack:** TypeScript, React 19, Vue 3, Vitest

---

### Task 1: Update core types — add `DraggableConfig`, replace `drag` with `layout` + `draggable`

**Files:**
- Modify: `packages/core/src/shared/types.ts`

- [ ] **Step 1: Update `MarkputState` — replace `drag` with `layout` and `draggable`**

In `packages/core/src/shared/types.ts`, remove the `drag` field from `MarkputState` and add the new types:

```ts
// Remove from MarkputState:
// drag: boolean | {alwaysShowHandle: boolean}

// Add to MarkputState:
layout: 'inline' | 'block'
draggable: boolean | DraggableConfig
```

Add the `DraggableConfig` interface before `DragAction`:

```ts
export interface DraggableConfig {
	alwaysShowHandle?: boolean
}
```

Full diff for `MarkputState`:

```diff
 export interface MarkputState {
 	tokens: Token[]
 	parser: Parser | undefined
 	previousValue: string | undefined
 	recovery: Recovery | undefined
 	selecting: 'drag' | 'all' | undefined
 	overlayMatch: OverlayMatch | undefined
 	value: string | undefined
 	defaultValue: string | undefined
 	onChange: ((value: string) => void) | undefined
 	readOnly: boolean
 	options: CoreOption[] | undefined
 	showOverlayOn: OverlayTrigger | undefined
 	Span: unknown
 	Mark: unknown
 	Overlay: unknown
 	className: string | undefined
 	style: CSSProperties | undefined
 	slots: CoreSlots | undefined
 	slotProps: CoreSlotProps | undefined
-	drag: boolean | {alwaysShowHandle: boolean}
+	layout: 'inline' | 'block'
+	draggable: boolean | DraggableConfig
 }
```

- [ ] **Step 2: Run typecheck to verify the change compiles (it will show errors in other files — expected)**

Run: `pnpm run typecheck 2>&1 | head -30`
Expected: Type errors in Store.ts, features, and framework packages (we'll fix them in subsequent tasks)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/shared/types.ts
git commit -m "refactor(core): replace drag type with layout + draggable in MarkputState"
```

---

### Task 2: Update Store — replace `props.drag` signal with `props.layout` + `props.draggable`

**Files:**
- Modify: `packages/core/src/store/Store.ts`

- [ ] **Step 1: Update `buildContainerProps` to accept `isDraggable` and `isBlock` parameters**

Replace the `buildContainerProps` function (lines 41-60):

```ts
function buildContainerProps(
	isDraggable: boolean,
	isBlock: boolean,
	readOnly: boolean,
	className: string | undefined,
	style: CSSProperties | undefined,
	slotProps: CoreSlotProps | undefined
): {className: string | undefined; style?: CSSProperties; [key: string]: unknown} {
	const containerSlotProps = slotProps?.container
	const baseStyle = merge(style, containerSlotProps?.style)
	const mergedStyle = isDraggable && isBlock && !readOnly ? {paddingLeft: DRAG_HANDLE_WIDTH, ...baseStyle} : baseStyle

	const {className: _, style: __, ...otherSlotProps} = resolveSlotProps('container', slotProps) ?? {}

	return {
		className: cx(styles.Container, className, containerSlotProps?.className),
		style: mergedStyle,
		...otherSlotProps,
	}
}
```

- [ ] **Step 2: Replace `props.drag` signal with `props.layout` and `props.draggable`**

In the `props` object (line 80), replace:

```diff
-		drag: signal<boolean | {alwaysShowHandle: boolean}>(false, {readonly: true}),
+		layout: signal<'inline' | 'block'>('inline', {readonly: true}),
+		draggable: signal<boolean | DraggableConfig>(false, {readonly: true}),
```

- [ ] **Step 3: Update `computed.parser` — gate `skipEmptyText` on `layout === 'block'`**

```diff
-		const isDrag = !!this.props.drag()
-		return new Parser(markups, isDrag ? {skipEmptyText: true} : undefined)
+		const isBlock = this.props.layout() === 'block'
+		return new Parser(markups, isBlock ? {skipEmptyText: true} : undefined)
```

- [ ] **Step 4: Update `computed.containerProps` — pass `isDraggable` and `isBlock`**

```diff
 		containerProps: computed(
 			() =>
 				buildContainerProps(
-					!!this.props.drag(),
+					!!this.props.draggable(),
+					this.props.layout() === 'block',
 					this.props.readOnly(),
 					this.props.className(),
 					this.props.style(),
 					this.props.slotProps()
 				),
 			{equals: shallow}
 		),
```

- [ ] **Step 5: Add `DraggableConfig` to the import**

```diff
 import type {
 	CoreOption,
+	DraggableConfig,
 	OverlayMatch,
 	OverlayTrigger,
 	Recovery,
```

- [ ] **Step 6: Run typecheck**

Run: `pnpm --filter @markput/core exec tsc --noEmit 2>&1 | head -20`
Expected: Errors only in features that still reference `props.drag` (not in Store.ts itself)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/store/Store.ts
git commit -m "refactor(core): replace props.drag with props.layout + props.draggable in Store"
```

---

### Task 3: Update core features — switch from `props.drag()` to `props.layout()` / `props.draggable()`

**Files:**
- Modify: `packages/core/src/features/editable/ContentEditableFeature.ts`
- Modify: `packages/core/src/features/input/InputFeature.ts`
- Modify: `packages/core/src/features/arrownav/ArrowNavFeature.ts`
- Modify: `packages/core/src/features/block-editing/BlockEditFeature.ts`
- Modify: `packages/core/src/features/selection/selectionHelpers.ts`

- [ ] **Step 1: Update ContentEditableFeature.ts**

Replace all `this.store.props.drag()` checks with `this.store.props.layout() === 'block'`:

Line 41: `const isDrag = !!this.store.props.drag()` → `const isBlock = this.store.props.layout() === 'block'`

Then rename all `isDrag` usages to `isBlock` (lines 43, 66). The variable appears in:
- Line 43: `if (isDrag) {`
- Line 66: `if (isDrag) {`

These all become `if (isBlock) {`.

- [ ] **Step 2: Update InputFeature.ts**

Two changes:

Line 23: `if (!this.store.props.drag()) {` → `if (this.store.props.layout() !== 'block') {`

Line 116: `if (store.props.drag()) return` → `if (store.props.layout() === 'block') return`

- [ ] **Step 3: Update ArrowNavFeature.ts**

Line 20: `if (this.store.props.drag()) return` → `if (this.store.props.layout() === 'block') return`

- [ ] **Step 4: Update BlockEditFeature.ts**

Lines 30 and 46: `if (!this.store.props.drag()) return` → `if (this.store.props.layout() !== 'block') return`

- [ ] **Step 5: Update selectionHelpers.ts**

Line 24: `if (store.props.drag()) return` → `if (store.props.layout() === 'block') return`

- [ ] **Step 6: Run typecheck for core package**

Run: `pnpm --filter @markput/core exec tsc --noEmit`
Expected: PASS (or only framework package errors remaining)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/features/editable/ContentEditableFeature.ts packages/core/src/features/input/InputFeature.ts packages/core/src/features/arrownav/ArrowNavFeature.ts packages/core/src/features/block-editing/BlockEditFeature.ts packages/core/src/features/selection/selectionHelpers.ts
git commit -m "refactor(core): switch features from props.drag() to props.layout() === 'block'"
```

---

### Task 4: Update drag config helper — rename `getAlwaysShowHandleDrag` → `getAlwaysShowHandle`

**Files:**
- Modify: `packages/core/src/features/drag/config.ts`
- Modify: `packages/core/src/features/drag/index.ts`
- Modify: `packages/core/index.ts`

- [ ] **Step 1: Update config.ts — rename function and change parameter type**

```ts
import type {DraggableConfig} from '../../shared/types'

export function getAlwaysShowHandle(draggable: boolean | DraggableConfig): boolean {
	return typeof draggable === 'object' && !!draggable.alwaysShowHandle
}
```

- [ ] **Step 2: Update drag/index.ts barrel export**

```diff
-	export {getAlwaysShowHandleDrag} from './config'
+	export {getAlwaysShowHandle} from './config'
```

- [ ] **Step 3: Update core/index.ts public export**

```diff
-	export {getAlwaysShowHandleDrag} from './src/features/drag'
+	export {getAlwaysShowHandle} from './src/features/drag'
+	export type {DraggableConfig} from './src/shared/types'
```

Also add `DraggableConfig` to the type exports block:

```diff
 export type {
 	OverlayMatch,
 	OverlayTrigger,
 	CoreOption,
+	DraggableConfig,
 	CSSProperties,
 	CoreSlots,
 	CoreSlotProps,
 	DataAttributes,
 	DragAction,
 	DragActions,
 } from './src/shared/types'
```

- [ ] **Step 4: Run core typecheck**

Run: `pnpm --filter @markput/core exec tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Run core unit tests**

Run: `pnpm --filter @markput/core exec vitest run`
Expected: PASS (DragFeature.spec.ts doesn't reference the config helper)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/drag/config.ts packages/core/src/features/drag/index.ts packages/core/index.ts
git commit -m "refactor(core): rename getAlwaysShowHandleDrag to getAlwaysShowHandle, export DraggableConfig"
```

---

### Task 5: Update React — new props, Container, Block, DragHandle

**Files:**
- Modify: `packages/react/markput/src/components/MarkedInput.tsx`
- Modify: `packages/react/markput/src/components/Container.tsx`
- Modify: `packages/react/markput/src/components/DragHandle.tsx`

- [ ] **Step 1: Update MarkedInput.tsx — replace `drag` prop with `layout` + `draggable`**

Replace the `drag` prop in `MarkedInputProps` interface:

```diff
-	/** Enable drag mode: each individual token (mark or text) becomes its own draggable row.
-	 * One mark per row, one text fragment per row.
-	 * Adjacent marks need no separator; adjacent text rows are separated by `\n\n`.
-	 */
-	drag?: boolean | {alwaysShowHandle: boolean}
+	/** Layout mode: 'inline' renders tokens in a single flow, 'block' stacks each token as its own row.
+	 * @default 'inline'
+	 */
+	layout?: 'inline' | 'block'
+	/** Enable drag interaction on block rows. Only effective when layout='block'.
+	 * @default false
+	 */
+	draggable?: boolean | DraggableConfig
```

Add import:

```diff
-import type {CoreOption, MarkputHandler, OverlayTrigger} from '@markput/core'
+import type {CoreOption, DraggableConfig, MarkputHandler, OverlayTrigger} from '@markput/core'
```

- [ ] **Step 2: Update Container.tsx — read `layout` instead of `drag`**

```diff
-	const {drag, tokens, key, refs, event} = useMarkput(s => ({
-		drag: s.props.drag,
+	const {layout, tokens, key, refs, event} = useMarkput(s => ({
+		layout: s.props.layout,
 		tokens: s.state.tokens,
 		key: s.key,
 		refs: s.refs,
 		event: s.event,
 	}))
```

And the render:

```diff
 		<Component ref={(el: HTMLDivElement | null) => (refs.container = el)} {...props}>
-			{drag
+			{layout === 'block'
 				? tokens.map((t, i) => <Block key={key.get(t)} token={t} blockIndex={i} />)
 				: tokens.map(t => <Token key={key.get(t)} mark={t} />)}
 		</Component>
```

- [ ] **Step 3: Update DragHandle.tsx — use new prop names and renamed helper**

```diff
-import {cx, getAlwaysShowHandleDrag} from '@markput/core'
+import {cx, getAlwaysShowHandle} from '@markput/core'
```

```diff
-	const {readOnly, drag} = useMarkput(s => ({
+	const {readOnly, draggable} = useMarkput(s => ({
 		readOnly: s.props.readOnly,
-		drag: s.props.drag,
+		draggable: s.props.draggable,
 	}))
```

```diff
-	const alwaysShowHandle = useMemo(() => getAlwaysShowHandleDrag(drag), [drag])
+	const alwaysShowHandle = useMemo(() => getAlwaysShowHandle(draggable), [draggable])
```

- [ ] **Step 4: Run typecheck for React package**

Run: `pnpm --filter @markput/react exec tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/react/markput/src/components/MarkedInput.tsx packages/react/markput/src/components/Container.tsx packages/react/markput/src/components/DragHandle.tsx
git commit -m "refactor(react): replace drag prop with layout + draggable"
```

---

### Task 6: Update Vue — new props, MarkedInput, Container, DragHandle

**Files:**
- Modify: `packages/vue/markput/src/types.ts`
- Modify: `packages/vue/markput/src/components/MarkedInput.vue`
- Modify: `packages/vue/markput/src/components/Container.vue`
- Modify: `packages/vue/markput/src/components/DragHandle.vue`

- [ ] **Step 1: Update types.ts — replace `drag` with `layout` + `draggable`**

```diff
-import type {CoreOption, DataAttributes, OverlayTrigger} from '@markput/core'
+import type {CoreOption, DataAttributes, DraggableConfig, OverlayTrigger} from '@markput/core'
```

```diff
-	/** Enable drag mode: each individual token (mark or text) becomes its own draggable row.
-	 * One mark per row, one text fragment per row.
-	 * Adjacent marks need no separator; adjacent text rows are separated by `\n\n`.
-	 */
-	drag?: boolean | {alwaysShowHandle: boolean}
+	layout?: 'inline' | 'block'
+	draggable?: boolean | DraggableConfig
```

- [ ] **Step 2: Update MarkedInput.vue — sync new prop names**

In `syncProps`:

```diff
 	function syncProps() {
 		store.value.setProps({
 			value: props.value,
 			defaultValue: props.defaultValue,
 			onChange: (v: string) => emit('change', v),
 			readOnly: props.readOnly,
-			drag: props.drag,
+			layout: props.layout,
+			draggable: props.draggable,
 			options: props.options,
 			showOverlayOn: props.showOverlayOn,
 			Span: props.Span,
```

In the watch dependency array:

```diff
 		props.slots,
 		props.slotProps,
-		props.drag,
+		props.layout,
+		props.draggable,
 	],
```

- [ ] **Step 3: Update Container.vue — read `layout` instead of `drag`**

```diff
 const result = useMarkput(s => ({
-	drag: s.props.drag,
+	layout: s.props.layout,
 	tokens: s.state.tokens,
 	key: s.key,
 	refs: s.refs,
```

```diff
-		<template v-if="result.drag">
+		<template v-if="result.layout === 'block'">
```

- [ ] **Step 4: Update DragHandle.vue — use new prop names and renamed helper**

```diff
-import {getAlwaysShowHandleDrag} from '@markput/core'
+import {getAlwaysShowHandle} from '@markput/core'
```

```diff
-const drag = useMarkput(s => s.props.drag)
+const draggable = useMarkput(s => s.props.draggable)
```

```diff
-const alwaysShowHandle = computed(() => getAlwaysShowHandleDrag(drag.value))
+const alwaysShowHandle = computed(() => getAlwaysShowHandle(draggable.value))
```

- [ ] **Step 5: Run typecheck for Vue package**

Run: `pnpm run typecheck`
Expected: PASS (runs both tsc and vue-tsc)

- [ ] **Step 6: Commit**

```bash
git add packages/vue/markput/src/types.ts packages/vue/markput/src/components/MarkedInput.vue packages/vue/markput/src/components/Container.vue packages/vue/markput/src/components/DragHandle.vue
git commit -m "refactor(vue): replace drag prop with layout + draggable"
```

---

### Task 7: Update React storybook stories and specs

**Files:**
- Modify: `packages/storybook/src/pages/Drag/Drag.react.stories.tsx`
- Modify: `packages/storybook/src/pages/Drag/Drag.react.spec.tsx`

- [ ] **Step 1: Update React stories — replace `drag: true` with `layout="block" draggable`**

In `Drag.react.stories.tsx`, for every story that has `drag: true`, replace:

```diff
-		drag: true,
+		layout: 'block',
+		draggable: true,
```

This affects stories: Markdown, PlainTextDrag, MarkdownDrag, ReadOnlyDrag, TodoList.

- [ ] **Step 2: Update React specs — replace any `drag` prop usage in test fixtures**

In `Drag.react.spec.tsx`, search for `drag` in composed story args and update similarly. Run:

```bash
rg 'drag' packages/storybook/src/pages/Drag/Drag.react.spec.tsx
```

If any test directly sets `drag` on component props, update to `layout: 'block', draggable: true`.

- [ ] **Step 3: Run React browser tests**

Run: `pnpm --filter storybook exec vitest run packages/storybook/src/pages/Drag/Drag.react.spec.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/storybook/src/pages/Drag/Drag.react.stories.tsx packages/storybook/src/pages/Drag/Drag.react.spec.tsx
git commit -m "refactor(storybook): update React drag stories to use layout + draggable"
```

---

### Task 8: Update Vue storybook stories and specs

**Files:**
- Modify: `packages/storybook/src/pages/Drag/Drag.vue.stories.ts`
- Modify: `packages/storybook/src/pages/Drag/Drag.vue.spec.ts`

- [ ] **Step 1: Update Vue stories — replace `drag: true` with `layout: 'block', draggable: true`**

In `Drag.vue.stories.ts`, for every story that has `drag: true`, replace:

```diff
-		drag: true,
+		layout: 'block',
+		draggable: true,
```

This affects stories: Markdown, PlainTextDrag (render function), MarkdownDrag (render function), ReadOnlyDrag, TodoListDrag.

- [ ] **Step 2: Update Vue specs — replace any `drag` prop usage in test fixtures**

Search for `drag` in `Drag.vue.spec.ts` and update similarly.

- [ ] **Step 3: Run Vue browser tests**

Run: `pnpm --filter storybook exec vitest run packages/storybook/src/pages/Drag/Drag.vue.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/storybook/src/pages/Drag/Drag.vue.stories.ts packages/storybook/src/pages/Drag/Drag.vue.spec.ts
git commit -m "refactor(storybook): update Vue drag stories to use layout + draggable"
```

---

### Task 9: Update DragFeature.spec.ts and documentation

**Files:**
- Modify: `packages/core/src/features/drag/DragFeature.spec.ts`
- Modify: `packages/core/src/features/drag/README.md` (if exists)

- [ ] **Step 1: Update DragFeature.spec.ts — no drag prop changes needed**

The existing test doesn't set `drag` prop, so it should still pass. Verify:

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/drag/DragFeature.spec.ts`
Expected: PASS

If the test needs updating (e.g., it indirectly relies on block mode), add `layout: 'block'` to `setProps`.

- [ ] **Step 2: Update drag README if it references old API**

Check `packages/core/src/features/drag/README.md` for references to `drag` prop or `getAlwaysShowHandleDrag` and update.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/drag/DragFeature.spec.ts packages/core/src/features/drag/README.md
git commit -m "refactor(core): update drag feature docs for new API"
```

---

### Task 10: Run all checks and fix any remaining references

**Files:**
- Any remaining files that reference old API

- [ ] **Step 1: Search for remaining references to old API**

```bash
rg 'getAlwaysShowHandleDrag\|props\.drag\b\|props\.drag()\|"drag"\|drag:' packages/core packages/react packages/vue packages/storybook --type ts --type tsx
```

Fix any remaining references.

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Run build**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 4: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm run lint`
Expected: PASS

- [ ] **Step 6: Run format**

Run: `pnpm run format`
Expected: PASS

- [ ] **Step 7: Commit any final fixes**

```bash
git add -A
git commit -m "fix: resolve remaining old drag API references"
```
