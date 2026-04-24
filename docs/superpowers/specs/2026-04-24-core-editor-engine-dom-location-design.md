# Core Editor Engine and DOM Location

Date: 2026-04-24

## Problem

DOM/token mapping is currently spread across multiple features:

- `NodeProxy` infers inline token type and index from DOM child parity.
- DOM reconciliation assumes framework-rendered child positions and, in block mode, wrapper child offsets.
- Block keyboard editing maps browser selection offsets to raw value offsets independently.
- Clipboard maps selections to tokens with its own container-child walk.
- Caret recovery stores old DOM anchors and child-index hints.

These pieces all answer the same question in different ways: which token does this DOM node or browser selection represent? That makes the editor fragile around custom marks, nested marks, block wrappers, focusable elements inside marks, and framework render timing.

The desired direction is not quick hardening. Breaking changes are acceptable if they produce a maintainable and scalable architecture.

## Goals

- Make `@markput/core` the editor engine, not only the parser and event coordinator.
- Keep React and Vue as presentation adapters over a core-owned view model.
- Avoid `data-*` attributes for internal token mapping.
- Avoid making refs the primary way users connect custom marks to tokens.
- Replace implicit DOM assumptions with one canonical DOM/view structure.
- Centralize raw value edits, caret recovery, and DOM/token location.
- Improve custom mark DX by exposing token commands through context/hooks, not DOM mutation.
- Support inline, block, nested marks, custom mark components, and focusable elements inside marks.

## Non-Goals

- Preserve the current `useMark().ref` API.
- Preserve arbitrary user control over the structural editable DOM node.
- Preserve `NodeProxy` as the long-term location primitive.
- Remove ergonomic APIs for focus, caret, and rendered text manipulation.
- Add public `data-markput-*` attributes as the mapping contract.
- Implement a fully new parser as part of this change.

## Design Summary

Core owns the editor model and produces a canonical render tree. React and Vue render that tree with fixed internal shells, then place user presentation components inside those shells.

The primary token identity is a `TokenPath`, not a DOM ref:

```ts
type TokenPath = readonly number[]
```

Examples:

- `[0]` is the first top-level token.
- `[2]` is the third top-level token.
- `[2, 0]` is the first nested child token inside token `[2]`.
- `[2, 1, 0]` is a deeper nested token.

Core exposes token views and commands:

```ts
type TokenView = {
	path: TokenPath
	token: Token
	kind: 'text' | 'mark'
	children: TokenView[]
	editable: boolean
	commands: TokenCommands
}

type TokenCommands = {
	remove(): void
	replace(content: string): void
	setValue(value: string): void
	setMeta(meta: string | undefined): void
	setSlot(slot: string): void
}
```

React and Vue pass `TokenView` context to custom components. Custom mark components use hooks to access commands and token data; they do not attach editor refs or mutate `textContent`.

## Ref Policy

The only required DOM ref is the editor container ref. Token refs are not part of the public API and are not the primary internal mapping mechanism.

After each framework render, core indexes the canonical DOM structure from the container and the current `TokenView` tree:

```ts
store.domLocation.index({
	container,
	mode,
	views,
})
```

Indexing walks known adapter-owned children in order and records the resolved elements internally. This can populate weak maps for fast reverse lookup, but those maps are derived from structure after render. They are not created by passing refs through user mark components.

This keeps the connection model simple:

- users connect to a token through `useMark()` / token context
- adapters connect to core through one container ref and render notifications
- core connects DOM to tokens by indexing its own canonical structure

## NodeProxy Attitude

The current `NodeProxy` was created for a valid goal: make DOM node manipulation comfortable. That goal should stay.

The problem is not the ergonomic wrapper itself. The problem is that the current `NodeProxy` combines three responsibilities:

- DOM ergonomics: focus, caret, content, adjacent node helpers.
- Feature state: `store.nodes.focus` and `store.nodes.input`.
- Token location: `index`, `isSpan`, `isMark`, `prev`, `next`, `head`, `tail`.

The first responsibility is useful. The third responsibility is fragile because it treats DOM child position and child parity as token identity. That works only when the rendered DOM is a flat inline sequence with no block rows, nested marks, controls, custom wrappers, or focusable children.

The replacement should preserve the comfortable API, but move token identity into the DOM location feature.

## Surface Handle API

Replace `NodeProxy` with a location-aware surface handle returned by `DomLocationFeature`.

```ts
type TokenSurface = {
	readonly mode: 'inline' | 'block'
	readonly path: TokenPath
	readonly token: Token
	readonly tokenView: TokenView
	readonly tokenElement: HTMLElement
	readonly textSurface?: HTMLElement
	readonly rowElement?: HTMLElement

	focus(): void
	blur(): void
	isFocused(): boolean
	getRenderedText(): string
	setRenderedText(content: string): void
	getLocalCaret(): number | undefined
	setLocalCaret(offset: number): void
	getRawCaret(): number | undefined
	setRawCaret(rawPosition: number, affinity?: 'before' | 'after'): void
	previous(): TokenSurface | undefined
	next(): TokenSurface | undefined
}

type FocusState = {
	current(): TokenSurface | undefined
	set(surface: TokenSurface | undefined): void
	clear(): void
}
```

The handle is created only after a DOM node has been resolved through canonical structure:

```ts
const surface = store.domLocation.surfaceFromNode(event.target)
store.focus.set(surface)
```

This keeps feature code ergonomic:

```ts
const surface = store.focus.current()
surface?.focus()
surface?.setLocalCaret(0)
```

But token mapping is no longer inferred by `surface.tokenElement.parentElement.children.indexOf(...)` or by mark/text parity. The surface already carries its resolved `TokenPath`, token, and canonical elements.

`previous()` and `next()` navigate logical token surfaces from the `TokenView` tree. They do not use raw DOM sibling traversal.

Content edits should prefer raw value commands:

```ts
const range = store.domLocation.rawRangeFromSelection()
if (range) {
	store.value.apply({
		range,
		insert,
		recover: {rawPosition: range.start + insert.length},
	})
}
```

`setRenderedText()` exists for DOM reconciliation and controlled rollback, not as the primary value mutation path.

## Canonical DOM Structure

The framework adapters render a fixed internal structure. Internal mapping relies on the structural relationship between core-owned elements and the `TokenView` tree.

No `data-*` attributes are required.

### Inline Mode

```html
container
  token-shell[0]
    text-surface
  token-shell[1]
    mark-presentation
    slot-root
  token-shell[2]
    text-surface
```

Each direct child of the container corresponds to one top-level `TokenView`.

### Nested Mark Mode

```html
mark-token-shell[path 1]
  mark-presentation
  slot-root
    token-shell[path 1.0]
      text-surface
    token-shell[path 1.1]
      mark-presentation
```

Nested token shells are rendered inside a core-owned slot root. User mark presentation can wrap visual content, but core still owns the token shell and slot root.

### Block Mode

```html
container
  row[0]
    token-shell[0]
      text-surface
    controls
  row[1]
    token-shell[1]
      mark-presentation
      slot-root
    controls
```

Each direct child of the block container corresponds to one top-level row. Controls such as drag handles, menus, and drop indicators are not part of token mapping. They are rendered in known adapter-owned control regions.

Text editing happens in core-owned `text-surface` elements. User `Span` and `Mark` components may affect presentation, but they do not replace the structural text surface that selection and caret logic depend on.

## DOM Location Feature

Add a core feature responsible for all DOM/token lookup:

```ts
type LocatedToken = {
	mode: 'inline' | 'block'
	path: TokenPath
	index: number
	token: Token
	tokenView: TokenView
	tokenElement: HTMLElement
	textSurface?: HTMLElement
	rowElement?: HTMLElement
	surface: TokenSurface
}

type LocatedSelection = {
	start: LocatedToken
	end: LocatedToken
	rawStart: number
	rawEnd: number
}
```

The feature owns these operations:

```ts
locateNode(node: Node): LocatedToken | undefined
locateActive(): LocatedToken | undefined
surfaceFromNode(node: Node): TokenSurface | undefined
activeSurface(): TokenSurface | undefined
locateSelection(): LocatedSelection | undefined
rawRangeFromSelection(): {start: number; end: number} | undefined
rawPositionFromBoundary(node: Node, offset: number): number | undefined
placeCaret(rawPosition: number, affinity?: 'before' | 'after'): void
```

The implementation may maintain internal weak maps for performance, but those maps are adapter-internal/core-internal details. They are not exposed as the user-facing connection model.

The locator must not read `data-*` attributes, `data-testid`, or user component markup. It walks from the known container through the canonical adapter-owned structure and resolves against the `TokenView` tree.

## Value Edit Pipeline

Raw value mutation moves into one command pipeline:

```ts
type ValueEdit = {
	range: {start: number; end: number}
	insert: string
	recover?: {
		rawPosition: number
		affinity?: 'before' | 'after'
	}
}

store.value.apply(edit)
```

`ValueFeature.apply()` owns:

- read-only checks
- controlled/uncontrolled behavior
- `onChange`
- committing accepted uncontrolled values
- parsing refresh
- scheduling caret recovery

Features should stop constructing full value strings independently. Overlay insert, paste, cut, delete, block editing, drag row operations, and mark commands should all call the same pipeline.

## Caret Recovery

Caret recovery becomes raw-position based:

```ts
type Recovery = {
	rawPosition: number
	affinity?: 'before' | 'after'
}
```

After React/Vue render the accepted token tree, core asks the DOM location feature to place the caret at the requested raw position.

This replaces recovery based on stale DOM anchors, sibling traversal, and child-index hints.

## Custom Mark DX

Custom marks become presentation components over core token context.

React example:

```tsx
function Mention({children}: MarkProps) {
	const mark = useMark()

	return (
		<button type="button" onClick={() => mark.remove()}>
			@{mark.value}
			{children}
		</button>
	)
}
```

Vue follows the same model through `useMark()`.

`useMark()` should return a command-oriented controller:

```ts
type MarkController = {
	readonly token: MarkToken
	readonly path: TokenPath
	readonly value: string
	readonly meta: string | undefined
	readonly slot: string | undefined
	readonly depth: number
	readonly hasChildren: boolean
	readonly parent: MarkToken | undefined
	remove(): void
	setValue(value: string): void
	setMeta(meta: string | undefined): void
	setSlot(slot: string): void
	replace(content: string): void
}
```

`useMark().ref` is removed. Uncontrolled mark initialization through `ref.current.textContent` is removed. Marks that need editable text should use explicit commands or a future controlled input helper, not direct DOM mutation.

## Framework Adapter Responsibilities

React and Vue should only:

- render the core `TokenView` tree
- provide token context to custom components
- render fixed token shells and block row shells
- render user presentation slots inside those shells
- forward browser events to core
- notify core after render

They should not:

- compute token indexes from DOM
- own raw value edits
- mutate token content directly
- expose refs as the primary mark API
- decide caret recovery targets

## Breaking Changes

This design intentionally allows breaking changes:

- `useMark<T>()` no longer returns a `ref`.
- `MarkHandler` is replaced or reshaped into `MarkController`.
- Custom `Span` and `Mark` components become presentation slots inside core-owned shells.
- Direct custom `contentEditable` marks are no longer the primary editing path.
- `NodeProxy` is removed from feature contracts.
- `Recovery.anchor`, `Recovery.childIndex`, and sibling-based recovery are removed.
- `store.nodes.focus` / `store.nodes.input` are replaced by a focus/surface state API backed by `TokenSurface`.
- Internal block wrappers and drag controls may change DOM order.
- Tests that assert exact DOM shape need updates to the new canonical structure.

## Migration Plan

### Phase 1: Core View Model

- Add `TokenPath` and `TokenView` builders in core.
- Add path-aware token lookup helpers.
- Keep existing rendering temporarily, but expose the new view model to adapters.

### Phase 2: Canonical Adapter Structure

- Update React and Vue token rendering to use core-owned token shells.
- Update block rendering to separate row structure, token shell, and controls.
- Provide `TokenView` context instead of raw token-only context.
- Keep visual behavior equivalent where possible.

### Phase 3: DOM Location Feature

- Add `DomLocationFeature`.
- Add `TokenSurface` and focus/surface state.
- Move selection-to-token and DOM-boundary-to-raw-position logic into it.
- Replace local lookup in clipboard, block edit, overlay, and value features.

### Phase 4: Unified Value Edits

- Add `store.value.apply()`.
- Migrate inline input, paste, cut, overlay insert, mark remove, drag row edits, and block edits.
- Remove duplicated raw string mutation logic from feature modules.

### Phase 5: Raw-Position Caret Recovery

- Replace `Recovery.anchor` with raw-position recovery.
- Use post-render `DomLocationFeature.placeCaret()`.
- Delete sibling and child-index recovery code.

### Phase 6: Public API Cleanup

- Replace `MarkHandler` with command-oriented mark controller.
- Remove `useMark().ref` and uncontrolled DOM mutation behavior.
- Update docs and examples for custom mark authoring.

### Phase 7: Remove Legacy Paths

- Remove `NodeProxy` after feature code uses `TokenSurface`.
- Remove child-parity checks.
- Remove `data-testid`-based reconciliation.
- Remove feature-local DOM/token locator helpers.

## Testing Strategy

Core unit tests:

- build stable `TokenView` paths for inline tokens
- build stable paths for nested marks
- resolve token path to token and parent
- apply raw value edits in controlled and uncontrolled mode
- recover caret from raw position after parse
- ignore invalid token paths safely

DOM/browser tests:

- inline typing maps active text shell to the correct token
- deletion across mark boundaries uses locator, not parity
- nested mark selection maps to raw positions correctly
- block typing and deletion map DOM boundaries to raw value positions
- overlay insert recovers caret through raw-position recovery
- clipboard copy/cut uses the shared locator
- custom mark with nested button does not break token mapping
- custom mark without refs can remove/update itself

Regression tests:

- no `data-testid` reliance in production code
- no direct imports between unrelated features for location logic
- no public `useMark().ref`
- no `NodeProxy` usage in feature contracts
- no token mapping through DOM child parity

## Documentation Updates

Update these docs as part of implementation:

- `packages/website/src/content/docs/development/architecture.md`
- `packages/website/src/content/docs/development/how-it-works.md`
- custom mark guides and examples
- React and Vue API references for `useMark`
- `CLAUDE.md` / `AGENTS.md` if architecture rules change

New documentation should describe the split clearly:

- core is the editor engine
- adapters are presentation layers
- custom marks use commands, not refs
- value edits and caret recovery flow through core

## Open Design Decisions

These should be resolved during implementation planning:

- Exact names for `DomLocationFeature`, `TokenView`, and `MarkController`.
- Whether `TokenPath` should be serialized as arrays only, or also as a string form for debugging.
- Whether text token presentation still accepts a `Span` component, or whether `Span` becomes style/props-only.
- Whether editable nested slots need a first-class controlled input helper for mark authors.
- Whether block controls render before or after the token shell in the canonical structure.

## Acceptance Criteria

- There is exactly one production DOM/token locator.
- React and Vue render the same conceptual core view tree.
- Custom marks do not need refs for normal mark operations.
- Feature code has an ergonomic `TokenSurface` API for focus, caret, and rendered text operations.
- All raw value edits go through one core command path.
- Caret recovery is based on raw value position, not stale DOM anchors.
- Inline, block, and nested mark tests pass in both React and Vue.
- Public docs show the new command-based custom mark API.
