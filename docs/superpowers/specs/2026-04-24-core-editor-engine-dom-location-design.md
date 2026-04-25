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

The design intentionally keeps the named type surface small:

```ts
type TokenPath = readonly number[]

type TokenAddress = {
	readonly path: TokenPath
	readonly parseGeneration: number
}

type Result<T, Reason extends string> = {ok: true; value: T} | {ok: false; reason: Reason}

type DomRole = 'container' | 'control' | 'row' | 'token' | 'text' | 'slotRoot'

type DomRefTarget =
	| {readonly role: 'container'}
	| {readonly role: 'control'; readonly ownerPath?: TokenPath}
	| {readonly role: 'row' | 'token' | 'text' | 'slotRoot'; readonly path: TokenPath}

type DomRef = (element: HTMLElement | null) => void

type RawRange = {
	readonly start: number
	readonly end: number
}

type RawSelection = {
	readonly range: RawRange
	readonly direction?: 'forward' | 'backward'
}

type NodeLocationResult = Result<
	{
		readonly address: TokenAddress
		readonly tokenElement: HTMLElement
		readonly textElement?: HTMLElement
		readonly rowElement?: HTMLElement
	},
	'notIndexed' | 'outsideEditor' | 'control'
>

type RawSelectionResult = Result<RawSelection, 'notIndexed' | 'outsideEditor' | 'control' | 'mixedBoundary' | 'invalidBoundary'>

type BoundaryPositionResult = Result<number, 'notIndexed' | 'outsideEditor' | 'control' | 'invalidBoundary' | 'composing'>

type EditResult =
	| {ok: true; value: string; accepted: 'immediate' | 'pendingControlledEcho'}
	| {ok: false; reason: 'readOnly' | 'invalidRange' | 'stale'}

type CaretRecovery =
	| {readonly kind: 'caret'; readonly rawPosition: number; readonly affinity?: 'before' | 'after'}
	| {readonly kind: 'selection'; readonly selection: RawSelection}

type OptionalMarkFieldPatch = {readonly kind: 'set'; readonly value: string} | {readonly kind: 'clear'}

type MarkPatch = {
	readonly value?: string
	readonly meta?: OptionalMarkFieldPatch
	readonly slot?: OptionalMarkFieldPatch
}

type MarkSnapshot = {
	readonly value: string
	readonly meta: string | undefined
	readonly slot: string | undefined
	readonly readOnly: boolean
}

class MarkController {
	constructor(
		private readonly store: Store,
		private readonly address: TokenAddress,
		private readonly snapshot: MarkSnapshot
	) {}

	get value(): string
	get meta(): string | undefined
	get slot(): string | undefined
	get readOnly(): boolean

	remove(): EditResult
	update(patch: MarkPatch): EditResult
}

type MarkInfo = {
	readonly address: TokenAddress
	readonly depth: number
	readonly hasNestedMarks: boolean
	readonly key: string
}
```

Replacement map:

| New contract | Replaces |
| --- | --- |
| `TokenPath` / `TokenAddress` | `NodeProxy.index`, token object identity, stale DOM anchors, child-index hints |
| `DomRefTarget` / `DomRef` | DOM child parity, wrapper offsets, `data-testid` block detection, adapter-local ref memoization |
| `RawRange` / `RawSelection` | feature-local range shapes in input, clipboard, block edit, and overlay code |
| narrow `Result<_, Reason>` aliases | silent `undefined` or no-op location failures |
| `EditResult` | silent no-op value/mark command failures |
| `MarkController` | public `MarkHandler`, `useMark().ref`, direct mutable token setters |

Keep the implementation deliberately narrow:

- no public `TokenSurface`
- no persistent `TokenView` tree that duplicates parser tokens
- no broad `ValueEdit` union as the first abstraction
- no production dependency on user refs, `data-testid`, public attributes, DOM child parity, or user component DOM shape

Cross-feature domain types such as `TokenAddress`, `RawRange`, `RawSelection`, result aliases, `EditResult`, and `CaretRecovery` belong in `packages/core/src/shared/` so feature modules do not import each other for shared contracts.

## Token Address Rules

`TokenPath` examples:

- `[0]` is the first top-level token.
- `[2]` is the third top-level token.
- `[2, 0]` is the first nested child token inside token `[2]`.
- `[2, 1, 0]` is a deeper nested token.
- `[]` is not a valid token path. The editor container is addressed by DOM role, not by token path.

`TokenPath` is a current-parse address, not durable identity. `TokenAddress` stays a small value object: path plus parse generation. A `MarkController` captures the current `TokenAddress` and an immutable token-shape snapshot from that render when it is created. `TokenIndex` owns address validation so stale-address checks are implemented once, not repeated in every feature. Commands validate the address at call time:

1. Require `address.parseGeneration === store.parsing.index().generation`.
2. Resolve `path` against the current parsed token tree.
3. Require the resolved token kind to match the captured kind.
4. For mark commands, require the descriptor identity and `descriptor.index` to match the captured descriptor.
5. Return a failed `EditResult` instead of mutating when validation fails.

The generation equality check is mandatory for mutation commands. Without it, a stale controller could update a new same-kind token that happens to occupy the same path after an unrelated edit. Resolving the path and checking the captured token shape are still required as defense in depth and for better diagnostics. A stale address must fail closed. Do not re-resolve by descriptor search; descriptor indexes are not unique enough to safely find "the same" mark after unrelated edits.

Parsing provides one computed token index so path logic does not get duplicated across DOM, mark commands, block edit, clipboard, and adapters:

```ts
store.parsing.index: Computed<TokenIndex>

type TokenShapeSnapshot =
	| {readonly kind: 'text'}
	| {readonly kind: 'mark'; readonly descriptor: MarkupDescriptor; readonly descriptorIndex: number}

type TokenIndex = {
	readonly generation: number
	pathFor(token: Token): TokenPath | undefined
	addressFor(path: TokenPath): TokenAddress | undefined
	resolve(path: TokenPath): Token | undefined
	resolveAddress(address: TokenAddress, expected?: TokenShapeSnapshot): Result<Token, 'stale'>
	key(path: TokenPath): string
	equals(a: TokenPath, b: TokenPath): boolean
}
```

`generation` increments exactly once for every accepted parsed-token tree replacement. It is exposed through `TokenIndex` for validation and diagnostics, not as a writable-looking public `Signal`. `index` is computed from `parsing.tokens()` and the internal generation counter, and is the only owner of token-path traversal rules. Core provides internal helpers behind that index:

```ts
pathEquals(a: TokenPath, b: TokenPath): boolean
pathKey(path: TokenPath): string
resolvePath(tokens: readonly Token[], path: TokenPath): Token | undefined
```

`pathKey()` returns a stable string such as `0.2.1` for maps, diagnostics, and framework keys. Arrays remain the canonical path shape.

## Adapter DOM Contract

The mapping contract is adapter-owned registration, not public DOM attributes and not a whole-container child-order guess.

Adapters render known structural elements and register them with core through internal refs:

```ts
store.dom.refFor(target)
```

Production mapping uses:

- registered adapter-owned structural elements
- one editor container ref
- the current parsed token tree and `store.parsing.index()`
- internal weak maps derived from adapter registration

Production mapping does not use:

- public `data-*` attributes
- `data-testid`
- user component refs
- raw DOM child parity
- user component child ordering

Adapters may use private classes or private internal attributes for development diagnostics, tests, or style hooks, but production mapping cannot require public attributes.

Registration is role-specific:

- `container` and `control` do not carry token addresses.
- `control` may carry an `ownerPath` for diagnostics and focus attribution, but controls never produce edit ranges.
- `row`, `token`, `text`, and `slotRoot` require a `TokenPath`, not a `TokenAddress`.
- Core owns stable ref callback memoization. `store.dom.refFor(target)` returns the same callback for the same role plus `pathKey(path)` while the store is alive, so React/Vue adapters do not reimplement ref caching.
- Registered refs must not close over `parseGeneration`. During the rendered commit, DOM indexing resolves every registered path through the current `store.parsing.index()` and builds fresh current-generation addresses.
- Ref callbacks outside an adapter commit are allowed only to queue state for the next rendered lifecycle tick. `DomIndex.generation` changes once per rendered tick, not once per ref callback.

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

The public `children` passed to a custom mark is an opaque adapter-owned slot element, not raw token children. Users may place `{children}` to control visual layout, but location uses the registered `slotRoot` and token shells. It does not infer identity from where the user placed the slot.

If a mark with nested children does not render `{children}`, nested tokens are not editable or locatable from DOM. Development builds should treat this as a hard diagnostic; production should fail closed and log through DOM diagnostics.

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

For text tokens, the adapter owns the registered editable text surface and renders the configured `Span` inside or around that surface in a way that preserves one registered editable boundary. A custom `Span` can customize presentation and props, but it cannot replace the structural text surface used for DOM location.

`BlockRegistry` remains a `WeakMap<Token, BlockState>` for transient block UI state such as hover and drag chrome. It is not replaced by `TokenPath`; paths are for editing and location, while `BlockRegistry` is for per-token UI state during a render.

## DOM and Location Features

Expose a single `store.dom` façade. Start with one `DomFeature.ts` and split only when implementation pressure justifies it. If splitting becomes necessary, split by domain primitive (`DomIndex`, `TokenIndex` integration, affinity/boundary mapping) rather than by lifecycle phase, so state ownership remains clear.

`DomFeature` remains the public façade for reconciliation and location. Internally:

- registration maintains element maps
- location resolves DOM nodes and browser selections to token addresses
- reconciliation writes text-surface content and editable attributes
- post-render ties lifecycle, reconciliation, indexing, diagnostics, and recovery together

Core-facing operations:

```ts
type DomIndex = {
	readonly generation: number
}

type CaretLocation = {
	readonly address: TokenAddress
	readonly role: 'row' | 'token' | 'text' | 'slotRoot' | 'markDescendant'
}

type DomDiagnostic = {
	readonly kind:
		| 'missingRole'
		| 'stalePath'
		| 'outsideEditor'
		| 'controlBoundary'
		| 'mixedBoundary'
		| 'invalidBoundary'
		| 'renderReentry'
		| 'recoveryFailed'
	readonly path?: TokenPath
	readonly reason: string
}

store.dom.index: Computed<DomIndex | undefined>
store.dom.structuralKey: Computed<object>
store.dom.diagnostics: Event<DomDiagnostic>

store.dom.refFor(target: DomRefTarget): DomRef
store.dom.locateNode(node: Node): NodeLocationResult
store.dom.readRawSelection(): RawSelectionResult
store.dom.rawPositionFromBoundary(
	node: Node,
	offset: number,
	affinity?: 'before' | 'after'
): BoundaryPositionResult

store.caret.location: Signal<CaretLocation | undefined>
store.caret.placeAt(rawPosition: number, affinity?: 'before' | 'after'): Result<void, 'notIndexed' | 'invalidBoundary'>
store.caret.focus(address: TokenAddress): Result<void, 'notIndexed' | 'stale'>
```

`store.nodes.focus` and `store.nodes.input` are replaced by `store.caret.location` and DOM location APIs, not by another DOM wrapper. That state must not expose DOM child-index helpers.

`structuralKey` is an adapter-facing computed dependency token. It reads the state that can change structural DOM: parsed tokens/generation, parser `options`, `layout`, `readOnly`, `Mark`, `Span`, slots, slot props that affect structure, `draggable`, and adapter structural version if present. Block presentation is driven by `layout`, `slots.block`, `slotProps.block`, `readOnly`, and `draggable`; there is no separate core `Block` prop. It returns a fresh opaque object when those dependencies change, so frameworks can use identity comparison directly. React uses it in `useLayoutEffect`; Vue watches it with `flush: 'post'`. This avoids adapter render notifications that only track `tokens`.

Performance invariants:

- element-to-address lookup is a `WeakMap` keyed by registered elements
- address-to-element lookup is a `Map` keyed by `pathKey()`, rebuilt when a new `DomIndex` is published
- raw position from a text node inside a registered text surface is O(1): raw token start plus local offset
- diagnostics must not allocate on the hot path unless there is a failure

## Lifecycle Render Flow

Do not add a second post-render protocol beside `store.lifecycle.rendered`. Extend the existing lifecycle event to carry the adapter commit payload:

```ts
store.lifecycle.rendered({container, layout})
```

Adapters call this once after any render that can change structural DOM:

- parsed token changes
- `layout` changes
- `readOnly` changes
- `Mark`, `Span`, or slot component changes
- block controls appearing or disappearing
- adapter structural version changes

Adapters should subscribe to `store.dom.structuralKey` for this, rather than manually maintaining an incomplete dependency list.

The DOM feature owns one rendered watcher. Inside one `batch()`, in this order, it:

1. consumes path-based ref registrations for the adapter commit
2. reconciles text-surface content and editable attributes
3. validates required structural roles
4. resolves registered paths through `store.parsing.index()`
5. rebuilds weak maps for element-to-token lookup
6. publishes one new `DomIndex`
7. clears stale `store.caret.location`
8. applies pending raw-position caret recovery through `store.caret`

The rendered watcher is non-reentrant. If another rendered event fires while it is running, it queues at most one more pass after the current pass finishes. Additional rendered events during that queued pass are coalesced into the same pending pass. `locateNode()` and raw-range APIs return `{ok: false, reason: 'notIndexed'}` while no committed index is available.

Malformed branches fail closed. Development builds should emit diagnostics with token path keys; production should avoid throwing from user interactions.

## Caret Recovery Ownership

Keep one recovery signal:

```ts
store.caret.recovery: Signal<CaretRecovery | undefined>
store.caret.location: Signal<CaretLocation | undefined>
```

Ownership rules:

- Features schedule recovery by writing `store.caret.recovery`.
- Features never call `store.caret.placeAt()` or `store.caret.focus()` directly as part of a value edit.
- The DOM rendered watcher is the only code path that restores selections and clears recovery. It may call `store.caret.placeAt()` / `store.caret.focus()` as the caret-owned façade over the current DOM index. Failed recovery is dropped after one attempt and emitted as a `recoveryFailed` DOM diagnostic.
- Focus and selection event handlers update `store.caret.location`; DOM code does not own persistent caret-shaped state.
- `ParsingFeature` should no longer branch parse behavior on old DOM-anchor recovery.

This replaces `Recovery.anchor`, `Recovery.childIndex`, `Recovery.isNext`, sibling traversal, and stale DOM-anchor recovery.

## Raw Position Semantics

Raw positions are UTF-16 code-unit offsets into the serialized editor value, not grapheme offsets.

Boundary rules:

- Collapsed selections return `RawSelection` with `range: {start: n, end: n}`.
- Reversed selections normalize `range.start <= range.end` and preserve `direction` on `RawSelection`.
- A boundary inside a registered text surface maps to `token.position.start + localOffset`.
- A boundary on a token shell maps by affinity: `before` maps to token start, `after` maps to token end.
- Inter-mark zero-width gaps are resolved through adjacent token-shell affinity: `before` maps to the previous mark end, `after` maps to the next mark start.
- A boundary inside controls returns `{ok: false, reason: 'control'}`.
- A selection crossing controls and editable content returns `{ok: false, reason: 'mixedBoundary'}`; clipboard code decides whether to clamp or fail.
- A boundary outside the editor returns `{ok: false, reason: 'outsideEditor'}`.
- Empty text surfaces are valid and map to the text token start.
- Block row gaps map only through registered token shells or explicit row boundary rules; controls do not become text.
- Slot-root boundaries map to the slot raw range when the mark has a `slot`; otherwise they map to the mark value range.
- Selection and caret events inside registered controls are ignored for `store.caret.location` and caret recovery.

Affinity matrix:

| Boundary | `before` | `after` |
| --- | --- | --- |
| container start | first editable token start | first editable token start |
| container end | last editable token end | last editable token end |
| row start | row token start | row token start |
| row end | row token end | row token end |
| token shell before first child | token start | first editable child start when present, otherwise token start |
| token shell after last child | last editable child end when present, otherwise token end | token end |
| adjacent mark gap | previous mark end | next mark start |
| control to token shell | control failure unless browser boundary is inside token shell | token shell rule |
| mark presentation to slotRoot | mark value boundary | slot boundary |

IME and Unicode rules:

- During `compositionstart` through `compositionend`, `beforeinput` edits should not be committed through raw-range replacement.
- Capture the raw selection/range at `compositionstart`; commit `compositionend.data` at that original model range instead of using the post-browser-mutated DOM selection.
- Boundaries that split a UTF-16 surrogate pair return `{ok: false, reason: 'invalidBoundary'}` rather than silently corrupting text.
- Combining marks, flag emoji, and ZWJ sequences are still measured as UTF-16 code units. They do not return `invalidBoundary` unless the boundary splits a surrogate pair.

Caret placement should never depend on stale DOM anchors. It resolves raw position against the current parsed tokens and the current DOM index.

## Value Edit Pipeline

Value mutation moves into one small command pipeline. The first abstraction is `replaceRange()`. `replaceAll()` is a thin helper that delegates to `replaceRange({start: 0, end: current.length}, next)`.

```ts
type EditSource = 'input' | 'paste' | 'cut' | 'overlay' | 'mark' | 'block' | 'drag'

store.value.replaceRange(
	range: RawRange,
	replacement: string,
	options?: {
		recover?: CaretRecovery
		source?: EditSource
	}
): EditResult

store.value.replaceAll(
	next: string,
	options?: {
		recover?: CaretRecovery
		source?: EditSource
	}
): EditResult
```

`source` is diagnostics metadata unless a feature has a concrete branch that needs it. It must not become a second command language.

`ValueFeature` owns:

- read-only checks
- controlled/uncontrolled behavior
- `onChange`
- accepted uncontrolled value commits
- parsing refresh
- rejected edit rollback
- caret recovery scheduling

Controlled-mode behavior is strict echo-only and should be implemented as a small internal state machine:

```ts
class ControlledEcho {
	propose(candidate: string, recovery?: CaretRecovery): void
	onEcho(value: string): CaretRecovery | undefined
	supersede(): void
}
```

Flow:

1. Build the candidate string.
2. Call `onChange(candidate)`.
3. Store `Pending(candidate, recovery)` in `ControlledEcho`.
4. Return `{ok: true, accepted: 'pendingControlledEcho', value: candidate}`.
5. Keep `value.current` and parsed tokens at the last accepted value until `props.value` echoes the candidate.
6. DOM reconciliation always reflects the accepted value, not an optimistic candidate.
7. On matching echo, accept the prop value and schedule the stored recovery.
8. On a superseding edit or failed echo, clear the pending recovery without applying it.

This keeps the accepted value as the DOM source of truth and avoids vague "next render cycle" timing.

Overlay insertion should lower to the same primitive:

```ts
store.value.replaceRange(match.range, markup, {
	source: 'overlay',
	recover: {kind: 'caret', rawPosition: match.range.start + markup.length},
})
```

Features may compute candidate strings, but committing, controlled rollback, and recovery scheduling must go through `store.value`.

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

`useMark()` returns a memoized `MarkController` class instance keyed by the current token address and parse generation. The controller stores readonly render snapshots for `value`, `meta`, `slot`, and `readOnly`; command methods validate the captured address through `store.parsing.index().resolveAddress()` before writing.

`MarkPatch` semantics:

- missing key means unchanged
- `value: string` sets the value field
- `meta: {kind: 'set', value}` sets metadata
- `meta: {kind: 'clear'}` clears metadata
- `slot: {kind: 'set', value}` sets slot content
- `slot: {kind: 'clear'}` clears slot content

`MarkController` intentionally exposes only common mark data and commands. Drop legacy `key`, `depth`, `hasChildren`, `setValue`, `setMeta`, and `setSlot` from the default controller. If integrators need path, depth, stable key, or diagnostics, expose them through a separate `useMarkInfo()` / `useMarkDebug()` hook rather than expanding the default controller. `useMarkInfo()` returns `MarkInfo`, where the nested-content boolean is named `hasNestedMarks` to match the actual meaning.

`update(patch)` serializes through the parser descriptor instead of mutating parser tokens:

1. Resolve the captured address through `store.parsing.index().resolveAddress(address, capturedShape)`.
2. Require the resolved current token to be a mark token.
3. Build patched mark fields using explicit `MarkPatch` semantics.
4. Serialize those fields through the current descriptor markup.
5. Call `store.value.replaceRange({start: token.position.start, end: token.position.end}, serialized, {source: 'mark'})`.

`remove()` lowers to the same value pipeline by replacing the mark token range with an empty string. Both commands return `EditResult`; neither mutates live parser tokens.

`setContent()` is deliberately omitted. `content`, `value`, and `slot` are easy to confuse. `useMarkField()` is deferred until there is a concrete editing helper design.

`useMark().ref` is removed. Uncontrolled mark initialization through `ref.current.textContent` is removed. Marks that need editable text should use command helpers or a future field helper, not direct DOM mutation.

Mark writes should not be exposed as writable signals. Writes must pass through `store.value` so read-only checks, controlled mode, `onChange`, parsing refresh, rollback, and caret recovery stay centralized.

`MarkHandler` should stop being the public constructible runtime class. Export `MarkController` as the runtime class. If compatibility requires a transition, keep `MarkHandler` only as a deprecated alias/subclass or adapter-local implementation detail.

## Framework Adapter Responsibilities

React and Vue should:

- render adapter-owned token shells, text surfaces, slot roots, rows, and control regions
- register structural elements with core through private refs
- provide token render context to custom components
- pass an opaque adapter-owned slot element as `children` for nested marks
- preserve an adapter-owned editable text surface even when a custom `Span` is configured
- forward browser events to core
- emit `store.lifecycle.rendered({container, layout})` after DOM-affecting renders, driven by `store.dom.structuralKey`

They should not:

- compute token indexes from DOM
- own raw value commits
- mutate token content directly
- expose refs as the primary mark API
- decide caret recovery targets
- require user components to render a specific internal DOM shape beyond rendering `{children}` for nested content
- pass snapshot strings to `innerHTML` without explicit user sanitization

## Breaking Changes

This design intentionally allows breaking changes:

- `useMark<T>()` no longer returns a `ref`.
- `MarkHandler` is replaced by `MarkController`.
- Public mark data becomes readonly snapshots, not live mutable tokens.
- `depth`, `hasNestedMarks`, path, and key move to a separate mark-info/debug hook instead of the default mark controller.
- Custom `Span` and `Mark` components become presentation slots inside adapter-owned shells.
- Direct custom `contentEditable` marks are no longer the primary editing path.
- `Recovery.anchor`, `Recovery.childIndex`, and sibling-based recovery are removed.
- `store.nodes.focus` / `store.nodes.input` and `NodeProxy` are replaced by `store.caret.location` and DOM location APIs.
- Internal block wrappers and drag controls may change DOM order.
- Clipboard behavior for mixed control/editable selections may fail or clamp explicitly instead of silently preserving partial marks.
- Tests that assert exact DOM shape need updates to the adapter-owned structure.

## Migration Plan

Prefer vertical migration slices over one long DOM-shape rewrite. Keep any temporary dual-path locator behind `store.dom`; do not keep `NodeProxy` as a feature-facing contract after the early caret-location cutover.

### Phase 1: Shared Contracts and Addressing

- Add shared `TokenPath`, `TokenAddress`, `RawRange`, `RawSelection`, narrow result aliases, `EditResult`, and `CaretRecovery` types under `packages/core/src/shared/`.
- Add path lookup and `pathKey()` helpers behind a parsing-owned `TokenIndex`.
- Add internal parse generation tracking and `parsing.index` in `ParsingFeature`.
- Add readonly token snapshot helpers for adapter props/hooks.

### Phase 2: Value Pipeline Foundation

- Add `replaceRange()` / `replaceAll()` with strict controlled echo-only behavior.
- Add the internal `ControlledEcho` state machine and unit tests.
- Store pending controlled recovery and apply it only after matching prop echo.
- Keep existing consumers on `value.next()` / `value.change()` until each vertical slice migrates.

### Phase 3: Registration Foundation

- Add private DOM registration APIs and core-owned stable adapter ref factories.
- Extend `store.lifecycle.rendered` with `{container, layout}` payload.
- Add `store.dom.index`, `store.dom.structuralKey`, diagnostics, and non-reentrant rendered watcher.
- Keep existing locator paths active.

### Phase 4: Caret Location and NodeProxy Cutover

- Add `store.caret.location`, `store.caret.placeAt()`, and `store.caret.focus()`.
- Replace `store.nodes.focus` / `store.nodes.input` feature reads with caret location and DOM location APIs.
- Remove `NodeProxy` from feature contracts before input, overlay, clipboard, block, or drag are migrated.
- Keep any temporary compatibility locator private to `store.dom`.

### Phase 5: Clipboard Slice

- Add `readRawSelection()` and migrate clipboard copy/cut first.
- Cover mixed-boundary clipboard behavior.
- Keep keyboard/block paths on the temporary locator during this slice.

### Phase 6: Inline Input and Overlay Slice

- Migrate inline input and overlay selection to raw ranges.
- Replace stale DOM-anchor recovery for these paths with `caret.recovery`.

### Phase 7: Block and Drag Slice

- Migrate block edit raw-position logic and drag row edits.
- Keep drag preview token order immutable; mutate serialized value only on drop commit.
- Clarify `BlockRegistry` remains UI state.

### Phase 8: Mark Controller API

- Replace `MarkHandler` with command-oriented `MarkController`.
- Remove `useMark().ref` and uncontrolled DOM mutation behavior.
- Update docs, examples, and stories for custom mark authoring.

### Phase 9: Locator Cleanup

- Remove child-parity checks.
- Remove `data-testid`-based reconciliation.
- Remove feature-local DOM/token locator helpers.

## Testing Strategy

Core unit tests:

- build stable token paths for inline tokens
- build stable paths for nested marks
- expose `parsing.index` as the single token-path resolver
- resolve token paths and produce path keys through the index
- increment parse generation once per parsed-token tree replacement and expose it only through `TokenIndex`
- reject stale token addresses even when the same path now holds a same-kind token
- expose readonly token snapshots
- replace all values and replace raw ranges in controlled and uncontrolled mode
- exercise the `ControlledEcho` state machine for echo, superseding edits, and failed echoes
- delayed controlled echo applies recovery only after echoed tokens render
- no controlled echo keeps accepted value and DOM at the previous value
- recover caret from raw position after parse
- ignore invalid token paths safely
- reject surrogate-pair split boundaries
- handle IME composition by committing on `compositionend`

DOM/browser tests:

- inline typing maps registered text surfaces to the correct token
- core-owned stable adapter refs do not keep stale parse generations after same-path rerenders
- custom `Span` rendering preserves the adapter-owned editable text surface
- deletion across mark boundaries uses the shared locator
- adjacent marks such as `#[a]#[b]` navigate through the zero-width gap by affinity
- nested mark selection maps to raw positions correctly
- block typing and deletion map DOM boundaries to raw value positions
- controls do not produce raw edit ranges or active-address updates
- mixed control/editable selections produce `mixedBoundary`
- focusable mark descendants locate to the owning token without becoming text surfaces
- overlay insert recovers caret through raw-position recovery
- clipboard copy/cut uses the shared locator
- custom mark without refs can remove/update itself
- nested custom mark reports a diagnostic when `{children}` is omitted
- stale addresses fail closed after `parseGeneration` or `DomIndex.generation` changes
- render notifications run after layout, slot, readOnly, and token changes
- render notifications are driven by `dom.structuralKey`, not only token identity
- rendered watcher is non-reentrant, coalesces recursive render events, and publishes one `DomIndex` per committed pass
- drag preview does not mutate `parsing.tokens()` until drop commit

Regression tests:

- no `data-testid` reliance in production mapping
- no public `useMark().ref`
- no token mapping through DOM child parity
- no feature-facing `NodeProxy` usage after the caret-location cutover
- no public controller exposes live mutable parser tokens
- no default `useMark()` controller exposes path, depth, key, or mutable token children
- no feature except the DOM rendered watcher applies and clears `caret.recovery`

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
- `useMark()` for common commands and `useMarkInfo()` / debug hooks for address-level details
- raw value edits and caret recovery flowing through core
- `TokenPath` as a current-parse address, not durable identity
- `parsing.index` as the single token-path resolver
- `dom.structuralKey` as the adapter post-render dependency source
- `BlockRegistry` as UI state, not edit/location identity

## Implementation Constraints

- Keep `TokenPath` as arrays and use `pathKey()` strings for maps/debugging.
- Keep `TokenAddress` small: path plus parse generation. Captured token shape is resolver validation state, not part of the address type.
- Own token-path traversal in `ParsingFeature` through `parsing.index`.
- Require generation equality for mutation commands before resolving path shape. Expose generation through `TokenIndex`, not a standalone public signal.
- Use `layout`, not `mode`, in DOM APIs to match existing public prop language.
- Use `slotRoot`, not `slot`, for the DOM registration role.
- Register DOM elements by `TokenPath`, not `TokenAddress`, so stable refs cannot retain stale parse generations.
- Core owns adapter ref callback memoization through `store.dom.refFor()`.
- Do not re-resolve stale addresses by descriptor search.
- Do not expose public `TokenSurface`.
- Do not expose `renderedText()` as a DOM source-of-truth escape hatch.
- Do not expose live mutable tokens from public mark APIs.
- Use adapter-owned internal registration instead of production DOM walks based on child order.
- Use `store.caret.location`, not `activeAddress`, because focus and selections need role context and belong with caret state.
- Keep `RawRange` directionless; put direction on `RawSelection`.
- Reuse `store.lifecycle.rendered` as the single adapter post-render signal.
- Keep `caret.recovery` as the single recovery signal; features schedule, the DOM rendered watcher applies.
- Drive adapter rendered notifications from `dom.structuralKey`.
- Use strict echo-only controlled mode.
- Keep the default `MarkController` command-focused; move path/depth/key details to `useMarkInfo()` or debug hooks.
- Defer `useMarkField()` until a concrete field-editing helper is needed.
- Treat missing nested `{children}` as a development error and production diagnostic.
- Remove `NodeProxy` from feature contracts immediately after adapter registration and caret-location cutover.

## Acceptance Criteria

### DOM Location and Adapter Contract

- There is exactly one production DOM/token locator.
- React and Vue register the same conceptual structural roles with core.
- DOM refs carry paths and are resolved to current-generation addresses during the rendered commit.
- The locator ignores controls, maps user-mark descendants to the owning token, and detects missing required structural roles.
- Production mapping does not depend on public attributes, test ids, user refs, user component DOM child order, or DOM child parity.
- Render processing is non-reentrant, `parseGeneration` is monotonic for parsed token changes, and `DomIndex.generation` is monotonic for committed DOM indexes.
- Adapter rendered notifications are driven by `dom.structuralKey`.

### Value and Caret

- Value commits and raw range edits go through one core command path.
- Controlled behavior is strict echo-only.
- Controlled echo is implemented as one testable state machine.
- Caret recovery is based on raw value position, not stale DOM anchors.
- Only the DOM rendered watcher applies and clears `caret.recovery`, including selection recovery.
- Raw-position boundary behavior is covered for collapsed selections, reversed selections, controls, mixed selections, empty text, adjacent marks, block rows, slot-root boundaries, IME, and surrogate pairs.

### Public API and Docs

- Custom marks do not need refs for normal mark operations.
- Public mark APIs return readonly fields and command methods.
- The default mark controller does not expose path, depth, key, token children, or writable fields.
- Address-level mark details are available only through explicit mark-info/debug APIs.
- Writable mark signals are not introduced as a second mutation path.
- Inline, block, and nested mark tests pass in both React and Vue.
- Public docs show the new command-based custom mark API.
