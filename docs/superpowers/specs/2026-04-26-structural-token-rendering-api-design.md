# Structural Token Rendering API Design

## Status

Proposed for `codex/core-editor-engine-dom-location`.

This spec amends the DOM-location implementation from `docs/superpowers/specs/2026-04-24-core-editor-engine-dom-location-design.md`. The original direction remains valid: core owns DOM location, raw selection mapping, caret recovery, and mark commands. This spec changes the adapter contract so React and Vue keep the simple token rendering shape from `next` instead of rendering core-specific wrapper elements and per-token refs.

## Problem

The current implementation branch moved DOM/token location into core, but the React and Vue adapters now render extra structural elements for each token:

- text tokens render a token wrapper, a custom Span component, and an inner editable text surface;
- mark tokens render an adapter-owned wrapper around the user mark component;
- nested marks render an additional slot-root wrapper;
- each of those wrappers is registered with `store.dom.refFor(...)`.

That technically gives core stable nodes, but it changes the adapter API shape too much. `Token` became harder to understand, plain text no longer resembles the `next` branch DOM, and user mark/span components are no longer rendered directly. The migration should remove public refs and data-attribute lookup without replacing them with a noisy private wrapper API.

## Goals

- Keep React and Vue `Token` components close to the `next` branch renderer.
- Render resolved Span and Mark components directly.
- Do not create adapter-owned token wrappers, text-surface wrappers, or slot-root wrappers for normal token rendering.
- Keep DOM/token mapping core-owned.
- Keep text editability, text reconciliation, mark focusability, raw selection mapping, and caret recovery in `DomFeature`.
- Keep `useMark()` command-based and ref-free.
- Detect unsupported component structures with diagnostics instead of silently mapping the wrong element.

## Non-Goals

- Do not support arbitrary multi-root token components for DOM mapping.
- Do not support decorative text inside Span roots as editable text content. Span roots are the editable text surface.
- Do not reintroduce public mark refs.
- Do not use public `data-*` attributes for production editor behavior.
- Do not make React/Vue adapters responsible for raw position math or caret recovery.

## Rendering Contract

The adapter renders the token tree. Core indexes the rendered token tree after each render.

For every token that needs editor behavior, the resolved component must produce one root `HTMLElement`.

For text tokens:

- the root element is the text token element;
- the same root element is the editable text surface;
- the adapter may render the root with no children;
- `DomFeature` writes `token.content` into the root and sets `contentEditable`;
- custom Span components may style or wrap the root element, but their root text content is core-managed.

For mark tokens:

- the root element is the mark token element;
- `DomFeature` may set focus-related attributes such as `tabIndex` on that root;
- `useMark()` receives command state from context, not from a DOM ref;
- nested token children are passed through normal framework children only when nested children exist.

For nested marks:

- child token roots must appear in token order inside the parent mark root;
- child token roots should be a contiguous rendered sequence;
- if a mark component drops children, returns multiple roots, or inserts ambiguous element siblings into the nested token sequence, core emits a diagnostic and marks the affected subtree as not indexed.

For block layout:

- each top-level token still has a block row;
- the row may contain block controls such as drag handle, drop indicators, and block menu;
- controls are not token roots;
- the block token root is the rendered root of the `Token` component inside the row;
- row refs needed for block drag behavior may remain in block feature code, but they are not token-location refs.

## React Adapter Shape

React `Token` should return to the simple renderer shape from `next`, with only the context payload updated for `MarkController`:

```tsx
export const Token = memo(({mark}: {mark: TokenType}) => {
	const {resolveMarkSlot, key, index, store} = useMarkput(s => ({
		resolveMarkSlot: s.mark.slot,
		key: s.key,
		index: s.parsing.index,
		store: s,
	}))
	const [Component, props] = resolveMarkSlot(mark)
	const path = index.pathFor(mark)
	const address = path ? index.addressFor(path) : undefined
	if (!address) return null

	const children =
		mark.type === 'mark' && mark.children.length > 0
			? mark.children.map(child => <Token key={key.get(child)} mark={child} />)
			: undefined

	return (
		<TokenContext value={{store, token: mark, address}}>
			<Component {...props}>{children}</Component>
		</TokenContext>
	)
})
```

Important details:

- no `store.dom.refFor(...)` in `Token`;
- no adapter-owned `<span>` around `Component`;
- no inner `textSurface`;
- no explicit `contentEditable` or `suppressContentEditableWarning`;
- no artificial `children` for text tokens;
- `children` exists only for nested mark content.

`TokenContext` should receive `{store, token: mark, address}`. If no address exists for the token, `Token` returns `null`; that is an internal stale-token condition and should not be solved by adding a DOM wrapper.

## Vue Adapter Shape

Vue `Token.vue` should also match the `next` renderer shape:

```ts
return () => {
	const mark = props.mark
	const [Comp, compProps] = resolveMarkSlot.value(mark)

	const children =
		mark.type === 'mark' && mark.children.length > 0
			? () => mark.children.map(child => h(markRaw(Token), {key: key.get(child), mark: child}))
			: undefined

	return h(Comp, compProps, children)
}
```

The Vue adapter may still provide token context for `useMark()`, but it should not add DOM wrappers or per-token DOM refs to do so.

## DomFeature Structural Index

`DomFeature` becomes responsible for discovering token elements from the rendered structure.

The public/internal DOM API becomes:

- `store.dom.container`: the container ref/signal used as the indexing root;
- `store.lifecycle.rendered()`: tells core that React/Vue committed a render and DOM indexing can run;
- `store.dom.controlFor(ownerPath?: TokenPath)`: a narrow ref callback for block controls only.

The generic per-token API should be removed from adapter usage:

```ts
store.dom.refFor({role: 'token' | 'text' | 'slotRoot', path})
```

The structural index stores the same useful facts as today:

```ts
type PathElements = {
	path: TokenPath
	address: TokenAddress
	rowElement?: HTMLElement
	tokenElement: HTMLElement
	textElement?: HTMLElement
}
```

`slotRootElement` should disappear unless implementation proves it is still necessary internally. For text tokens, `textElement` is the same element as `tokenElement`.

## Indexing Algorithm

On every rendered lifecycle event:

1. Read `store.dom.container()`.
2. Read `store.parsing.tokens()` and `store.parsing.index()`.
3. If layout is inline, map top-level token roots from the container’s rendered token element sequence.
4. If layout is block, map each top-level token to its block row, then find the token root inside that row after excluding known control elements.
5. For each mark token with children, map nested child token roots from the mark root’s nested token sequence.
6. Validate every discovered element is an `HTMLElement`.
7. Build `PathElements` and element-role lookup maps.
8. Reconcile text token roots and mark focusability.
9. Publish the new DOM index generation.
10. Apply pending caret recovery.

The implementation may use DOM order, but only as part of this explicit structural contract. It must not rely on accidental wrapper counts or query public data attributes.

## Diagnostics

Structural indexing should emit diagnostics for invalid render output:

- no container element;
- fewer token root elements than tokens;
- extra ambiguous elements in a token sequence;
- token root is not an `HTMLElement`;
- mark with children did not render a child token sequence;
- stale path or stale address during indexing;
- block row exists but token root cannot be found.

Diagnostics should include the token path when available and a reason string that explains which contract was violated.

Invalid subtrees should be skipped rather than guessed. Caret placement, raw selection mapping, and `useMark()` commands should fail with existing not-indexed/stale results when their token element is unavailable.

## Text Reconciliation

Text tokens are core-managed editable surfaces.

During reconciliation:

```ts
if (token.type === 'text') {
	if (textElement.textContent !== token.content) {
		textElement.textContent = token.content
	}
	textElement.contentEditable = editable ? 'true' : 'false'
}
```

This preserves the `next` branch behavior where default text can render as a plain `<span />` and core fills text/editable state after render.

For custom Span components, the root is still the editable text surface. If a custom Span renders decoration or additional text inside the root, core may overwrite it while reconciling `token.content`. Rich inline UI should be implemented as a Mark, not as a Span text token.

## Mark Rendering And Children

Mark components should not receive artificial children.

For flat marks, render the component with its resolved props and no nested token children.

For nested marks, pass only the actual nested token render output as framework children. Do not wrap nested children in a `slotRoot` span.

This preserves the API users already see on `next`: a Mark component decides how to render its root element and whether to place `children`. If it does not place children for a nested mark, core reports a missing nested token sequence.

## Selection And Caret Mapping

The raw-position APIs stay conceptually the same:

- `locateNode(node)`;
- `rawPositionFromBoundary(node, offset, affinity)`;
- `readRawSelection()`;
- `placeCaretAtRawPosition(rawPosition, affinity)`;
- `focusAddress(address, boundary)`.

Their implementation changes to use structural index records instead of registered token/text/slotRoot refs.

For text tokens, offset math runs inside the text root.

For mark tokens, boundaries map to the mark token raw start/end unless the boundary is inside an indexed nested text token.

For nested marks, DOM lookup walks upward to the nearest indexed token element and resolves the token address from the structural index.

## Block Controls

Block controls are not token elements.

Drag handles, drop indicators, and menus may keep the refs they need for block interaction and positioning, but those refs should not be expressed as token-location refs. `DomFeature` should expose a narrow control-registration API rather than the generic path-based `refFor()` API.

Example:

```ts
store.dom.controlFor(path)(element)
```

When a control is not owned by a token path, call `store.dom.controlFor()(element)`.

## API Cleanup

Remove or narrow these contracts after adapters stop using them:

- `DomRefTarget` roles for `token`, `text`, and `slotRoot`;
- `DomRef` if it exists only for `refFor()`;
- `slotRootElement` from `NodeLocationResult`;
- generic `store.dom.refFor()`.

Keep `TokenPath`, `TokenAddress`, raw range/selection types, edit result types, caret recovery types, and mark controller types.

## Testing Strategy

Add tests before changing implementation.

Core unit tests:

- maps inline text and mark tokens to direct rendered elements;
- treats a text token root as both token and text element;
- maps nested mark children without a slot-root wrapper;
- emits diagnostics when nested children are omitted;
- emits diagnostics when token roots are ambiguous;
- maps raw boundaries in text roots to raw positions;
- preserves caret recovery after text reconciliation.

React browser tests:

- default text renders as one span after reconciliation;
- mark renders without an adapter-owned wrapper around the user Mark root;
- nested marks render without a slot-root wrapper;
- `useMark()` update/remove still works;
- inline input, overlay selection, and controlled no-echo behavior still pass.

Vue browser tests:

- mirror the React shape tests for default text, mark roots, and nested marks;
- verify `useMark()` update/remove still works;
- verify existing input and overlay behavior still passes.

Focused verification during implementation:

```bash
pnpm -w vitest run packages/core/src/features/dom/DomFeature.spec.ts
pnpm -w vitest run packages/storybook/src/pages/Base/Base.react.spec.tsx packages/storybook/src/pages/Base/Base.vue.spec.ts
pnpm -w vitest run packages/storybook/src/pages/Clipboard/Clipboard.react.spec.tsx packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts
pnpm run typecheck
```

Before calling the code work complete, run the full local check list from `AGENTS.md`.

## Migration Notes

Start by reverting any interrupted partial edits to adapter token rendering tests or `Token.tsx`.

Then migrate in this order:

1. Write focused DOM-shape and structural-index tests.
2. Restore React `Token` direct rendering.
3. Restore Vue `Token` direct rendering.
4. Implement structural indexing in `DomFeature` while keeping existing raw-position public methods.
5. Remove adapter token/text/slotRoot refs.
6. Narrow or remove `refFor()` and associated shared contracts.
7. Update Storybook snapshots and tests that asserted wrapper-heavy DOM.
8. Run focused checks, then full checks.

## Block Control Decision

Use a narrow explicit control ref API:

```ts
store.dom.controlFor(ownerPath?: TokenPath): (element: HTMLElement | null) => void
```

This keeps token location structural while avoiding fragile guesses around buttons, menus, and drag handles.
