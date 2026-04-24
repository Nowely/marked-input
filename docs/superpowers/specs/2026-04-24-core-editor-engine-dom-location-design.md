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

The desired direction is not quick hardening. Breaking changes are acceptable if they produce a maintainable architecture with a small API surface and clear invariants.

## Goals

- Make `@markput/core` the editor engine, not only the parser and event coordinator.
- Keep React and Vue as presentation adapters over core-owned editor semantics.
- Avoid making user refs the way custom marks connect to tokens.
- Replace ad hoc DOM assumptions with one explicit adapter-owned DOM registration contract.
- Centralize raw value edits, caret recovery, and DOM/token location.
- Improve custom mark DX by exposing command controllers through context/hooks, not DOM mutation.
- Support inline, block, nested marks, custom mark components, and focusable elements inside marks.

## Non-Goals

- Preserve the current `useMark().ref` API.
- Preserve arbitrary user control over structural editable DOM nodes.
- Preserve `NodeProxy` as a token-location primitive.
- Add public `data-markput-*` attributes as the mapping contract.
- Implement a fully new parser as part of this change.
- Introduce a large public command language for every editing operation.

## Design Summary

Core owns token addresses, location algorithms, value mutation, and caret recovery. React and Vue still create DOM, but they render adapter-owned structural elements and register those elements with core through private adapter refs.

The central reduction from the earlier design is:

- no public `TokenSurface`
- no persistent `TokenView` tree that duplicates parser tokens
- no broad `ValueEdit` union as the first abstraction
- no production dependency on user refs, `data-testid`, public attributes, DOM child parity, or user component DOM shape

Replacement map:

| New contract | Replaces |
| --- | --- |
| `TokenPath` / `TokenAddress` | `NodeProxy.index`, token object identity, stale DOM anchors, child-index hints |
| `DomRegistration` | DOM child parity, wrapper offsets, `data-testid` block detection |
| `RawRange` | feature-local range shapes in input, clipboard, block edit, and overlay code |
| `LocationResult` | silent `undefined` or no-op location failures |
| `EditResult` | silent no-op value/mark command failures |
| `MarkController` | public `MarkHandler`, `useMark().ref`, direct mutable token setters |

The core primitives are:

```ts
type TokenPath = readonly number[]

type TokenAddress = {
	readonly path: TokenPath
	readonly generation: number
	readonly expected: {
		readonly kind: 'text' | 'mark'
		readonly start: number
		readonly end: number
		readonly descriptorIndex?: number
	}
}
```

`TokenPath` is a current-parse address, not durable identity. Any command created from a rendered token must carry an internal `TokenAddress`. Commands fail closed when the address is stale, resolves to the wrong kind, or resolves to a token whose expected range/descriptor no longer matches.

Adapters receive lightweight token render context while rendering, but this does not need a named public type. It contains:

- the token address
- a readonly snapshot of the token data needed by props/hooks
- depth and parent snapshot metadata
- whether nested children exist

Snapshots are cloned or readonly views of the existing parser token shape. Public hooks must not expose live mutable parser tokens.

## Token Address Rules

`TokenPath` examples:

- `[0]` is the first top-level token.
- `[2]` is the third top-level token.
- `[2, 0]` is the first nested child token inside token `[2]`.
- `[2, 1, 0]` is a deeper nested token.

Core provides internal helpers:

```ts
pathEquals(a: TokenPath, b: TokenPath): boolean
pathKey(path: TokenPath): string
resolvePath(tokens: readonly Token[], path: TokenPath): Token | undefined
```

`pathKey()` exists for debugging, maps, and framework keys. Arrays remain the canonical shape.

Command validation:

1. Resolve `path` against the current parsed token tree.
2. Require the resolved token kind to match the stored expected data.
3. Require either the same generation or a compatible expected range/descriptor match.
4. For mark commands, require the descriptor identity/index to match.
5. Return a failed result instead of mutating when validation fails.

This prevents stale controller commands from silently editing a different token after insert, delete, reparse, or block move.

## Adapter DOM Contract

The mapping contract is adapter-owned registration, not public DOM attributes and not a whole-container child-order guess.

Adapters render known structural elements and register them with core through internal refs:

```ts
type DomRegistration = {
	readonly role: 'container' | 'row' | 'token' | 'text' | 'slot' | 'control'
	readonly address?: TokenAddress
	readonly element: HTMLElement | null
}

store.dom.register(registration)
```

Production mapping uses:

- registered adapter-owned structural elements
- one editor container ref
- the current parsed token tree and token addresses
- internal weak maps derived from adapter registration

Production mapping does not use:

- public `data-*` attributes
- `data-testid`
- user component refs
- raw DOM child parity
- user component child ordering

Adapters may use private classes or private internal attributes for development diagnostics, tests, or style hooks, but production mapping cannot require public attributes.

### Inline Structure

```html
container
  token-shell[path 0]
    text-surface[path 0]
  token-shell[path 1]
    mark-presentation[path 1]
    slot-root[path 1]
  token-shell[path 2]
    text-surface[path 2]
```

The registered `token-shell` owns token location. The registered `text-surface` is the only editable surface for a text token.

### Nested Mark Structure

Nested content is rendered inside an adapter-owned registered slot root:

```html
token-shell[path 1]
  mark-presentation[path 1]
  slot-root[path 1]
    token-shell[path 1.0]
      text-surface[path 1.0]
    token-shell[path 1.1]
      mark-presentation[path 1.1]
```

The public `children` passed to a custom mark is an opaque adapter-owned slot element, not raw token children. Users may place `{children}` to control visual layout, but location uses the registered slot root and token shells. It does not infer identity from where the user placed the slot.

If a mark with nested children does not render `{children}`, nested tokens are not editable or locatable from DOM. Development builds should report a diagnostic for that mark path.

### Block Structure

```html
container
  row[path 0]
    controls
    token-shell[path 0]
      text-surface[path 0]
  row[path 1]
    controls
    token-shell[path 1]
      mark-presentation[path 1]
      slot-root[path 1]
```

Rows and controls are registered separately. Controls such as drag handles, menus, and drop indicators never produce raw edit ranges. A focusable descendant inside a user mark can locate to its owning token, but it is not automatically an editable text surface.

`Span` and `Mark` remain presentation customization points. They do not own structural editable surfaces.

## DOM Feature

Merge DOM reconciliation and DOM/token location under one clear owner, preferably `store.dom`. Avoid adding a second `DomLocationFeature` beside the existing `DomFeature` unless implementation pressure proves the split is valuable.

The feature owns:

```ts
type RawRange = {readonly start: number; readonly end: number}

type LocationResult<T> =
	| {ok: true; value: T}
	| {ok: false; reason: 'notIndexed' | 'outsideEditor' | 'control' | 'staleAddress' | 'invalidBoundary'}
```

Core-facing operations:

```ts
register(registration: DomRegistration): void
afterAdapterRender(input: {container: HTMLElement; layout: 'inline' | 'block'}): {
	generation: number
	valid: boolean
	errors: readonly string[]
}
locateNode(node: Node): LocationResult<{
	address: TokenAddress
	tokenElement: HTMLElement
	textElement?: HTMLElement
	rowElement?: HTMLElement
}>
locateActive(): LocationResult<TokenAddress>
rawRangeFromSelection(): LocationResult<RawRange>
rawPositionFromBoundary(node: Node, offset: number, affinity?: 'before' | 'after'): LocationResult<number>
placeCaret(rawPosition: number, affinity?: 'before' | 'after'): LocationResult<void>
focus(address: TokenAddress): LocationResult<void>
renderedText(address: TokenAddress): LocationResult<string>
```

There is no public `TokenSurface` in the first design. If internal feature code needs a convenience handle, it should be a private `TokenHandle` wrapper over these operations and should return `LocationResult` or `boolean` for operations that can fail.

`store.nodes.focus` and `store.nodes.input` can be replaced by signal state over `TokenAddress`, but that state must not expose DOM child-index helpers.

## Post-Render Protocol

Render timing is part of the contract. Adapters must notify core after any render that can change structural DOM, not only after token changes.

Triggers include:

- parsed token changes
- `layout` changes
- `readOnly` changes
- `Mark`, `Span`, `Block`, or slot component changes
- block controls appearing or disappearing
- adapter structural version changes

Ordered post-render pipeline:

1. Adapter renders structural elements and calls internal registration refs.
2. Adapter calls `store.dom.afterAdapterRender({container, layout})`.
3. Core reconciles text-surface content and editable attributes.
4. Core validates the registered structure enough to detect missing required roles.
5. Core rebuilds weak maps for element-to-token lookup.
6. Core increments the DOM index generation and clears stale active locations.
7. Core applies pending raw-position caret recovery.

Malformed branches fail closed: location for that branch returns a failed `LocationResult`. Development builds should report diagnostics with token path keys.

## Raw Position Semantics

Raw positions are UTF-16 offsets into the serialized editor value.

Boundary rules:

- Collapsed selections return `{start: n, end: n}`.
- Reversed selections normalize `start <= end` and preserve `direction`.
- A boundary inside a registered text surface maps to `token.position.start + localOffset`.
- A boundary on a token shell maps by affinity: `before` maps to token start, `after` maps to token end.
- A boundary inside controls returns `{ok: false, reason: 'control'}`.
- A boundary outside the editor returns `{ok: false, reason: 'outsideEditor'}`.
- Empty text surfaces are valid and map to the text token start.
- Exact token-boundary positions use before/after affinity to decide whether caret placement should prefer the previous or next editable surface.
- Block row gaps map only through registered token shells or explicit row boundary rules; controls do not become text.
- Slot boundaries map to the slot raw range when the mark has a `slot`; otherwise they map to the mark value range.

Caret placement should never depend on stale DOM anchors. It resolves raw position against the current parsed tokens and the current DOM index.

## Value Edit Pipeline

Value mutation moves into one small command pipeline. The first abstraction should be simple: commit a candidate string or replace a raw range. Higher-level mark and block commands can be helpers that lower to one of these primitives.

```ts
type EditResult =
	| {ok: true; value: string; accepted: 'immediate' | 'pendingControlledEcho'}
	| {
			ok: false
			reason: 'readOnly' | 'invalidRange' | 'staleAddress' | 'wrongTokenKind'
	  }

store.value.commit(
	candidate: string,
	options?: {
		recover?: {rawPosition: number; affinity?: 'before' | 'after'}
		source?: 'input' | 'paste' | 'cut' | 'overlay' | 'mark' | 'block' | 'drag'
	}
): EditResult

store.value.replaceRange(
	range: RawRange,
	replacement: string,
	options?: {
		recover?: {rawPosition: number; affinity?: 'before' | 'after'}
		source?: 'input' | 'paste' | 'cut' | 'overlay' | 'mark' | 'block' | 'drag'
	}
): EditResult
```

`ValueFeature` owns:

- read-only checks
- controlled/uncontrolled behavior
- `onChange`
- accepted uncontrolled value commits
- parsing refresh
- rejected edit rollback
- caret recovery scheduling

Controlled-mode behavior:

1. Build the candidate string.
2. Call `onChange(candidate)`.
3. Return `{ok: true, accepted: 'pendingControlledEcho', value: candidate}`.
4. Keep the accepted internal value unchanged until the controlled prop echoes.
5. Reconcile DOM back to the accepted value if the edit is rejected or no echo arrives before the next render cycle.
6. Store the requested recovery and apply it only after the accepted token tree renders.

Features should stop constructing full value strings as side effects. They may compute candidates, but committing and rollback must go through `store.value`.

## Mark Commands and Public DX

Custom marks become presentation components over token context.

React example:

```tsx
function Mention({children}: MarkProps) {
	const mark = useMark()

	return (
		<span>
			<button type="button" onClick={() => mark.remove()}>
				@{mark.value}
			</button>
			{children}
		</span>
	)
}
```

Vue follows the same model through `useMark()`.

`useMark()` returns a command-oriented controller with readonly snapshot data:

```ts
type MarkPatch = {
	value?: string
	meta?: string | undefined
	slot?: string | undefined
}

type MarkController = {
	readonly path: TokenPath
	readonly key: string
	readonly value: string
	readonly meta: string | undefined
	readonly slot: string | undefined
	readonly depth: number
	readonly hasChildren: boolean
	readonly readOnly: boolean

	remove(): EditResult
	update(patch: MarkPatch): EditResult
	setValue(value: string): EditResult
	setMeta(meta: string | undefined): EditResult
	setSlot(slot: string | undefined): EditResult
}
```

If mark authors need parent or child token data, expose it as readonly snapshot fields later. Keep the first public controller focused on common mark commands.

`setContent()` is deliberately omitted from the first public API. `content`, `value`, and `slot` are easy to confuse. If editable mark text needs first-class support later, add a focused helper such as:

```ts
useMarkField('value')
useMarkField('slot')
```

`useMark().ref` is removed. Uncontrolled mark initialization through `ref.current.textContent` is removed. Marks that need editable text should use command helpers or a future field helper, not direct DOM mutation.

Mark writes should not be exposed as writable signals. Writes must pass through `store.value` so read-only checks, controlled mode, `onChange`, parsing refresh, rollback, and caret recovery stay centralized.

`MarkHandler` should stop being a public constructible runtime class. Prefer exporting `type MarkController`. If compatibility requires a transition, keep `MarkHandler` only as a deprecated type alias or adapter-local implementation detail.

## Framework Adapter Responsibilities

React and Vue should:

- render adapter-owned token shells, text surfaces, slot roots, rows, and control regions
- register structural elements with core through private refs
- provide token render context to custom components
- pass an opaque adapter-owned slot element as `children` for nested marks
- forward browser events to core
- notify core after DOM-affecting renders

They should not:

- compute token indexes from DOM
- own raw value commits
- mutate token content directly
- expose refs as the primary mark API
- decide caret recovery targets
- require user components to render a specific internal DOM shape beyond rendering `{children}` for nested content

## Breaking Changes

This design intentionally allows breaking changes:

- `useMark<T>()` no longer returns a `ref`.
- `MarkHandler` is replaced by `MarkController`.
- Public mark data becomes readonly snapshots, not live mutable tokens.
- Custom `Span` and `Mark` components become presentation slots inside adapter-owned shells.
- Direct custom `contentEditable` marks are no longer the primary editing path.
- `NodeProxy` is removed from feature contracts as a token-location primitive.
- `Recovery.anchor`, `Recovery.childIndex`, and sibling-based recovery are removed.
- `store.nodes.focus` / `store.nodes.input` are replaced by location/address state.
- Internal block wrappers and drag controls may change DOM order.
- Tests that assert exact DOM shape need updates to the adapter-owned structure.

## Migration Plan

### Phase 1: Token Addresses and Snapshots

- Add `TokenPath`, `TokenAddress`, path-key helpers, and expected-token validation.
- Add path lookup and path-key helpers.
- Add readonly token snapshot helpers.
- Keep existing rendering temporarily.

### Phase 2: Adapter Registration

- Add private DOM registration APIs to the DOM feature.
- Update React and Vue to render token shells, text surfaces, slot roots, rows, and controls.
- Register adapter-owned structural elements through internal refs.
- Provide token render context instead of raw token-only context.
- Keep visual behavior equivalent where possible.

### Phase 3: Post-Render Pipeline

- Add `afterAdapterRender()`.
- Move DOM reconciliation into the ordered post-render pipeline.
- Build weak maps from registered elements.
- Add development diagnostics for missing required registered roles.

### Phase 4: DOM Location and Raw Ranges

- Add `locateNode`, `locateActive`, `rawRangeFromSelection`, `rawPositionFromBoundary`, and `placeCaret`.
- Replace local lookup in clipboard, block edit, overlay, and value features.
- Remove production child-parity and `data-testid` mapping.

### Phase 5: Value Commands and Recovery

- Add `store.value.commit()` and `store.value.replaceRange()`.
- Define `EditResult` and controlled rollback behavior.
- Replace DOM-first `value.change()` write paths.
- Replace stale DOM-anchor recovery with raw-position recovery.

### Phase 6: Mark Controller API

- Replace `MarkHandler` with command-oriented `MarkController`.
- Remove `useMark().ref` and uncontrolled DOM mutation behavior.
- Update docs, examples, and stories for custom mark authoring.

### Phase 7: Remove Legacy Paths

- Remove `NodeProxy` from feature contracts.
- Remove child-parity checks.
- Remove `data-testid`-based reconciliation.
- Remove feature-local DOM/token locator helpers.

## Testing Strategy

Core unit tests:

- build stable token paths for inline tokens
- build stable paths for nested marks
- resolve token paths and produce path keys
- reject stale token addresses and same-kind path reuse
- expose readonly token snapshots
- commit and replace raw ranges in controlled and uncontrolled mode
- roll back rejected controlled edits
- recover caret from raw position after parse
- ignore invalid token paths safely

DOM/browser tests:

- inline typing maps registered text surfaces to the correct token
- deletion across mark boundaries uses the shared locator
- nested mark selection maps to raw positions correctly
- block typing and deletion map DOM boundaries to raw value positions
- controls do not produce raw edit ranges
- focusable mark descendants locate to the owning token without becoming text surfaces
- overlay insert recovers caret through raw-position recovery
- clipboard copy/cut uses the shared locator
- custom mark without refs can remove/update itself
- nested custom mark reports a diagnostic when `{children}` is omitted
- stale location handles or addresses fail closed after a generation change
- render notifications run after layout, slot, readOnly, and token changes

Regression tests:

- no `data-testid` reliance in production mapping
- no public `useMark().ref`
- no `NodeProxy` usage in feature contracts
- no token mapping through DOM child parity
- no public controller exposes live mutable parser tokens

## Documentation Updates

Update these docs as part of implementation:

- `packages/website/src/content/docs/development/architecture.md`
- `packages/website/src/content/docs/development/how-it-works.md`
- custom mark guides and examples
- React and Vue API references for `useMark`
- `CLAUDE.md` / `AGENTS.md` if architecture rules change

New documentation should describe:

- core as the editor engine
- adapters as presentation plus private structural registration layers
- custom marks using commands, not refs
- raw value edits and caret recovery flowing through core
- `TokenPath` as a current-parse address, not durable identity

## Resolved Design Decisions

- Keep `TokenPath` as arrays and use `pathKey()` strings for maps/debugging.
- Use `layout`, not `mode`, in DOM APIs to match existing public prop language.
- Do not expose public `TokenSurface` in the first implementation.
- Do not expose live mutable tokens from public mark APIs.
- Use adapter-owned internal registration instead of a production DOM walk based on child order.
- Keep the first value pipeline small: `commit()` and `replaceRange()`.

## Open Design Decisions

- Exact internal name: keep the existing `DomFeature` or split a private `DomLocationFeature` after implementation pressure.
- Exact expected-token fields needed for path validation across parser changes.
- Whether `useMarkField()` is required in the first breaking release or can wait.
- Whether missing `{children}` for nested marks should be a warning only or a hard development error.

## Acceptance Criteria

### DOM Location and Adapter Contract

- There is exactly one production DOM/token locator.
- React and Vue register the same conceptual structural roles with core.
- The locator ignores controls, maps user-mark descendants to the owning token, and detects missing required structural roles.
- Production mapping does not depend on public attributes, test ids, user refs, user component DOM child order, or DOM child parity.

### Value and Caret

- Value commits and raw range edits go through one core command path.
- Controlled rollback and no-echo behavior are explicit.
- Caret recovery is based on raw value position, not stale DOM anchors.
- Raw-position boundary behavior is covered for collapsed selections, reversed selections, controls, empty text, block rows, and slot boundaries.

### Public API and Docs

- Custom marks do not need refs for normal mark operations.
- Public mark APIs return readonly snapshots and result-returning commands.
- Writable mark signals are not introduced as a second mutation path.
- Inline, block, and nested mark tests pass in both React and Vue.
- Public docs show the new command-based custom mark API.
