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
- Avoid making refs the primary way users connect custom marks to tokens.
- Replace ad hoc DOM assumptions with one explicit canonical DOM contract.
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

Core owns the editor model, token paths, location algorithms, and canonical DOM schema. React and Vue own actual DOM creation, but they must render DOM that conforms to the core schema.

The primary token identity is a `TokenPath`, not a DOM ref:

```ts
type TokenPath = readonly number[]
```

Examples:

- `[0]` is the first top-level token.
- `[2]` is the third top-level token.
- `[2, 0]` is the first nested child token inside token `[2]`.
- `[2, 1, 0]` is a deeper nested token.

Core exposes a read-only token view tree:

```ts
type TokenView = {
	path: TokenPath
	token: Token
	kind: 'text' | 'mark'
	children: readonly TokenView[]
	editable: boolean
}
```

React and Vue pass `TokenView` context to custom components. Custom mark components use hooks to access commands and token data; they do not attach editor refs or mutate `textContent`.

Mutation commands are not embedded in `TokenView`. They live in feature/controller APIs and resolve their target by `TokenPath` at execution time.

## Mapping Contract

Production mapping uses:

- the canonical adapter DOM schema
- one editor container ref
- the current `TokenView` tree
- internal indexes or weak maps derived after render

Production mapping does not use:

- public `data-*` attributes
- `data-testid`
- user component refs
- user component DOM shape
- raw DOM child parity

The order-based DOM walk is acceptable because it is no longer an implicit assumption scattered through features. It is the explicit adapter contract. Core validates the rendered schema while indexing it. A malformed branch fails closed: location for that branch returns `undefined`; development builds should surface a diagnostic so adapter bugs are caught early.

## Ref Policy

The only required DOM ref is the editor container ref. Token refs are not part of the public API and are not the primary internal mapping mechanism.

After each framework render, core indexes the canonical DOM structure from the container and the current `TokenView` tree:

```ts
const result = store.domLocation.index({
	container,
	mode,
	views,
})
```

Indexing walks known adapter-owned children in order, validates the rendered schema, and records the resolved elements internally. This can populate weak maps for fast reverse lookup, but those maps are derived from structure after render. They are not created by passing refs through user mark components.

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

Replace `NodeProxy` as a token-location primitive with a location-aware surface handle returned by `DomLocationFeature`. This keeps the ergonomic DOM API while removing child-index and parity-based token mapping.

```ts
type LocatedToken = {
	readonly mode: 'inline' | 'block'
	readonly path: TokenPath
	readonly index: number
	readonly tokenView: TokenView
	readonly tokenElement: HTMLElement
	readonly textSurface?: HTMLElement
	readonly rowElement?: HTMLElement
	readonly generation: number
}

type TokenSurface = {
	readonly location: LocatedToken

	focus(): void
	blur(): void
	isFocused(): boolean
	getRenderedText(): string
	getLocalCaret(): number | undefined
	setLocalCaret(offset: number): void
	getRawCaret(): number | undefined
	setRawCaret(rawPosition: number, affinity?: 'before' | 'after'): void
	previousToken(): TokenSurface | undefined
	nextToken(): TokenSurface | undefined
}
```

The handle is created only after a DOM node has been resolved through canonical structure:

```ts
const surface = store.domLocation.surfaceFromNode(event.target)
store.domLocation.activeSurface(surface)
```

This keeps feature code ergonomic:

```ts
const surface = store.domLocation.activeSurface()
surface?.focus()
surface?.setLocalCaret(0)
```

But token mapping is no longer inferred by `surface.location.tokenElement.parentElement.children.indexOf(...)` or by mark/text parity. The surface already carries a resolved `LocatedToken`.

`previousToken()` and `nextToken()` navigate logical token surfaces from the `TokenView` tree. They do not use raw DOM sibling traversal.

`TokenSurface` is render-index scoped. It is valid only for the `generation` that created it. After a render/index cycle, code should resolve a fresh surface from `DomLocationFeature`. DOM operations on stale or disconnected surfaces fail closed.

Content edits should prefer value commands:

```ts
const range = store.domLocation.rawRangeFromSelection()
if (range) {
	store.value.apply({
		type: 'replaceRange',
		range,
		replacement,
		recover: {rawPosition: range.start + replacement.length},
	})
}
```

Rendered-text writes are deliberately not exposed on `TokenSurface`. DOM reconciliation and controlled rollback can use a narrower internal reconciler helper, but feature code should not mutate rendered text as a value write path.

## Canonical DOM Structure

The framework adapters render a fixed internal structure that conforms to the core schema. Internal mapping relies on the structural relationship between adapter-owned structural elements and the `TokenView` tree.

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

Nested token shells are rendered inside an adapter-owned slot root that conforms to the core schema. User mark presentation can wrap visual content, but it does not replace the token shell or slot root.

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

Text editing happens in adapter-owned `text-surface` elements that conform to the core schema. User `Span` and `Mark` components may affect presentation, but they do not replace the structural text surface that selection and caret logic depend on. `Span` remains a presentation customization point for text token rendering and styling; it is not the editable structure owner.

## DOM Location Feature

Add a core feature responsible for all DOM/token lookup:

```ts
type LocatedSelection = {
	start: LocatedToken
	end: LocatedToken
	rawStart: number
	rawEnd: number
}

type IndexResult = {
	generation: number
	valid: boolean
	errors: readonly string[]
}
```

The feature owns these operations:

```ts
activeSurface: Signal<TokenSurface | undefined>
clearActiveSurface(): void
index(input: {container: HTMLElement; mode: 'inline' | 'block'; views: readonly TokenView[]}): IndexResult
locateNode(node: Node): LocatedToken | undefined
locateActive(): LocatedToken | undefined
surfaceFromNode(node: Node): TokenSurface | undefined
locateSelection(): LocatedSelection | undefined
rawRangeFromSelection(): {start: number; end: number} | undefined
rawPositionFromBoundary(node: Node, offset: number): number | undefined
placeCaret(rawPosition: number, affinity?: 'before' | 'after'): void
```

The implementation may maintain internal weak maps for performance, but those maps are adapter-internal/core-internal details. They are not exposed as the user-facing connection model.

The locator follows the mapping contract: it walks from the known container through the canonical adapter-owned structure and resolves against the `TokenView` tree.

## Value Edit Pipeline

Value mutation moves into one command pipeline. Simple text edits use raw ranges; higher-level edits lower to serialized value changes inside `ValueFeature.apply()`.

```ts
type RawRange = {start: number; end: number}

type RecoveryRequest = {
	rawPosition: number
	affinity?: 'before' | 'after'
}

type MarkPatch = {
	content?: string
	value?: string
	meta?: string | undefined
	slot?: string | undefined
}

type ValueEdit =
	| {type: 'replaceRange'; range: RawRange; replacement: string; recover?: RecoveryRequest}
	| {type: 'updateMark'; path: TokenPath; patch: MarkPatch; recover?: RecoveryRequest}
	| {type: 'removeToken'; path: TokenPath; recover?: RecoveryRequest}
	| {type: 'moveBlock'; path: TokenPath; toIndex: number; recover?: RecoveryRequest}

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

Commands resolve `TokenPath` targets at execution time. If the path no longer resolves to the expected token kind, the command fails closed and leaves value unchanged.

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
	readonly path: TokenPath
	readonly token: MarkToken
	readonly value: string
	readonly meta: string | undefined
	readonly slot: string | undefined
	readonly depth: number
	readonly hasChildren: boolean
	readonly parent: MarkToken | undefined
	readonly children: readonly Token[]

	remove(): void
	setContent(content: string): void
	setValue(value: string): void
	setMeta(meta: string | undefined): void
	setSlot(slot: string | undefined): void
	update(patch: {
		content?: string
		value?: string
		meta?: string | undefined
		slot?: string | undefined
	}): void
}
```

`token` is available for inspection, but mutation commands target `path` and resolve the current token at execution time. This avoids stale-token writes after reparsing.

`useMark().ref` is removed. Uncontrolled mark initialization through `ref.current.textContent` is removed. Marks that need editable text should use explicit commands or a future controlled input helper, not direct DOM mutation.

### Commands vs Signals

Mark writes should not be exposed as writable signals in this design. Writes must pass through `store.value.apply()` so read-only checks, controlled mode, `onChange`, parsing refresh, and caret recovery stay centralized.

Read-side signal/computed APIs can be considered later if framework adapters need them:

```ts
type ReactiveMarkController = {
	value: Computed<string>
	meta: Computed<string | undefined>
	slot: Computed<string | undefined>
	setValue(value: string): void
	update(patch: MarkPatch): void
}
```

This keeps the mutation contract command-based while leaving room for reactive reads.

## Framework Adapter Responsibilities

React and Vue should only:

- render the core `TokenView` tree
- provide token context to custom components
- render fixed token shells and block row shells that conform to the core schema
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
- Custom `Span` and `Mark` components become presentation slots inside adapter-owned shells that follow the core schema.
- Direct custom `contentEditable` marks are no longer the primary editing path.
- `NodeProxy` is removed as a token-location primitive after `TokenSurface` replaces its ergonomic DOM role.
- `Recovery.anchor`, `Recovery.childIndex`, and sibling-based recovery are removed.
- `store.nodes.focus` / `store.nodes.input` are replaced by signal-style active surface state backed by `TokenSurface`.
- Internal block wrappers and drag controls may change DOM order.
- Tests that assert exact DOM shape need updates to the new canonical structure.

## Migration Plan

### Phase 1: Core View Model

- Add `TokenPath` and `TokenView` builders in core.
- Add path-aware token lookup helpers.
- Keep existing rendering temporarily, but expose the new view model to adapters.

### Phase 2: Canonical Adapter Structure

- Update React and Vue token rendering to use adapter-owned token shells that follow the core schema.
- Update block rendering to separate row structure, token shell, and controls.
- Provide `TokenView` context instead of raw token-only context.
- Add schema indexing/validation after render.
- Keep visual behavior equivalent where possible.

### Phase 3: DOM Location Feature

- Add `DomLocationFeature`.
- Add `TokenSurface` and signal-style active surface state.
- Define stale-surface behavior by render generation.
- Move selection-to-token and DOM-boundary-to-raw-position logic into it.
- Replace local lookup in clipboard, block edit, overlay, and value features.

### Phase 4: Unified Value Edits

- Add `store.value.apply()`.
- Add raw range replacement and structured edits for mark update, token removal, and block movement.
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
- apply raw range edits and structured value edits in controlled and uncontrolled mode
- recover caret from raw position after parse
- ignore invalid token paths safely
- fail closed when a structured edit path is stale or points at the wrong token kind

DOM/browser tests:

- inline typing maps active text shell to the correct token
- deletion across mark boundaries uses locator, not parity
- nested mark selection maps to raw positions correctly
- block typing and deletion map DOM boundaries to raw value positions
- overlay insert recovers caret through raw-position recovery
- clipboard copy/cut uses the shared locator
- custom mark with nested button does not break token mapping
- custom mark without refs can remove/update itself
- locator ignores block controls and maps user-mark descendants to the owning token
- malformed adapter schema is detected during indexing
- stale `TokenSurface` DOM operations fail closed after a render generation change

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
- Whether editable nested slots need a first-class controlled input helper for mark authors.
- Whether block controls render before or after the token shell in the canonical structure.

## Acceptance Criteria

### DOM Location and Adapter Contract

- There is exactly one production DOM/token locator.
- React and Vue render the same conceptual core view tree and conform to the same adapter DOM schema.
- The locator ignores controls, maps user-mark descendants to the owning token, and detects malformed adapter structure.
- Production mapping does not depend on public attributes, test ids, user refs, user component DOM shape, or DOM child parity.

### Surface and Focus

- `NodeProxy` is gone from feature contracts as a token-location primitive.
- Feature code has an ergonomic `TokenSurface` API for focus, caret, and rendered text reads.
- Active focus state uses the project signal style.
- Stale `TokenSurface` instances fail closed after render generation changes.

### Value and Caret

- Raw range edits and structured edits go through one core command path.
- Mark commands resolve by `TokenPath` at execution time.
- Caret recovery is based on raw value position, not stale DOM anchors.

### Public API and Docs

- Custom marks do not need refs for normal mark operations.
- Writable mark signals are not introduced as a second mutation path.
- Inline, block, and nested mark tests pass in both React and Vue.
- Public docs show the new command-based custom mark API.
