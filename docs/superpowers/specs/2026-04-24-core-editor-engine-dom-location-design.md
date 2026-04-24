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
	readonly captured: {
		readonly kind: 'text' | 'mark'
		readonly descriptorIndex?: number
	}
}

type DomRegistration =
	| {readonly role: 'container'; readonly element: HTMLElement | null}
	| {readonly role: 'control'; readonly element: HTMLElement | null}
	| {
			readonly role: 'row' | 'token' | 'text' | 'slotRoot'
			readonly address: TokenAddress
			readonly element: HTMLElement | null
	  }

type RawRange = {
	readonly start: number
	readonly end: number
	readonly direction?: 'forward' | 'backward'
}

type LocationResult<T> =
	| {ok: true; value: T}
	| {
			ok: false
			reason:
				| 'notIndexed'
				| 'outsideEditor'
				| 'control'
				| 'staleAddress'
				| 'invalidBoundary'
				| 'mixedBoundary'
				| 'composing'
	  }

type EditResult =
	| {ok: true; value: string; accepted: 'immediate' | 'pendingControlledEcho'}
	| {ok: false; reason: 'readOnly' | 'invalidRange' | 'staleAddress' | 'wrongTokenKind'}

type MarkPatch = {
	readonly value?: string
	readonly meta?: string | null
	readonly slot?: string | null
}

type MarkController = {
	readonly value: string
	readonly meta: string | undefined
	readonly slot: string | undefined
	readonly depth: number
	readonly hasChildren: boolean
	readonly readOnly: boolean

	remove(): EditResult
	update(patch: MarkPatch): EditResult
}
```

Replacement map:

| New contract | Replaces |
| --- | --- |
| `TokenPath` / `TokenAddress` | `NodeProxy.index`, token object identity, stale DOM anchors, child-index hints |
| `DomRegistration` | DOM child parity, wrapper offsets, `data-testid` block detection |
| `RawRange` | feature-local range shapes in input, clipboard, block edit, and overlay code |
| `LocationResult` | silent `undefined` or no-op location failures |
| `EditResult` | silent no-op value/mark command failures |
| `MarkController` | public `MarkHandler`, `useMark().ref`, direct mutable token setters |

The design also removes these earlier over-specifications:

- no public `TokenSurface`
- no persistent `TokenView` tree that duplicates parser tokens
- no broad `ValueEdit` union as the first abstraction
- no production dependency on user refs, `data-testid`, public attributes, DOM child parity, or user component DOM shape

Cross-feature domain types such as `TokenAddress`, `RawRange`, `LocationResult`, and `EditResult` belong in `packages/core/src/shared/` so feature modules do not import each other for shared contracts.

## Token Address Rules

`TokenPath` examples:

- `[0]` is the first top-level token.
- `[2]` is the third top-level token.
- `[2, 0]` is the first nested child token inside token `[2]`.
- `[2, 1, 0]` is a deeper nested token.

`TokenPath` is a current-parse address, not durable identity. A `MarkController` captures the current `TokenAddress` when it is created. Commands validate the address at call time:

1. Resolve `path` against the current parsed token tree.
2. Require the resolved token kind to match `captured.kind`.
3. For mark commands, require the descriptor identity/index to match `captured.descriptorIndex`.
4. Return a failed `EditResult` instead of mutating when validation fails.

The `parseGeneration` is kept for cheap stale diagnostics and short-circuit checks, but correctness must come from resolving the path and checking the captured token shape. A stale address must fail closed. Do not re-resolve by descriptor search in the first design; descriptor indexes are not unique enough to safely find "the same" mark after unrelated edits.

Core provides internal helpers:

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

Registration is role-specific:

- `container` and `control` do not carry token addresses.
- `row`, `token`, `text`, and `slotRoot` require a `TokenAddress`.
- Adapters should use memoized internal ref callbacks keyed by `pathKey(address.path)` so React/Vue ref identity stays stable when a path is stable.
- `register()` outside an adapter commit is allowed only to queue state for the next rendered lifecycle tick; the DOM index generation bumps once per rendered tick, not once per registration call.

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

`BlockRegistry` remains a `WeakMap<Token, BlockState>` for transient block UI state such as hover and drag chrome. It is not replaced by `TokenPath`; paths are for editing and location, while `BlockRegistry` is for per-token UI state during a render.

## DOM and Location Features

Expose a single `store.dom` façade, but split the implementation into focused modules:

```txt
packages/core/src/features/dom/
  DomFeature.ts
  register.ts
  locate.ts
  postRender.ts
  rawRange.ts
```

`DomFeature` remains the public façade for reconciliation and location. Internally:

- registration maintains element maps
- location resolves DOM nodes and browser selections to token addresses
- reconciliation writes text-surface content and editable attributes
- post-render ties lifecycle, reconciliation, indexing, diagnostics, and recovery together

Core-facing operations:

```ts
store.dom.indexVersion: Signal<number>
store.dom.activeAddress: Signal<TokenAddress | undefined>
store.dom.diagnostics: Event<{kind: string; path?: TokenPath; reason: string}>

store.dom.register(registration: DomRegistration): void
store.dom.locateNode(node: Node): LocationResult<{
	address: TokenAddress
	tokenElement: HTMLElement
	textElement?: HTMLElement
	rowElement?: HTMLElement
}>
store.dom.rawRangeFromSelection(): LocationResult<RawRange>
store.dom.rawPositionFromBoundary(
	node: Node,
	offset: number,
	affinity?: 'before' | 'after'
): LocationResult<number>
store.dom.placeCaret(rawPosition: number, affinity?: 'before' | 'after'): LocationResult<void>
store.dom.focus(address: TokenAddress): LocationResult<void>
store.dom.renderedText(address: TokenAddress): LocationResult<string>
```

`store.nodes.focus` and `store.nodes.input` are replaced by reactive state over `TokenAddress`, not by another DOM wrapper. That state must not expose DOM child-index helpers.

Performance invariants:

- element-to-address lookup is a `WeakMap` keyed by registered elements
- address-to-element lookup is a `Map` keyed by `pathKey()`, rebuilt on `dom.indexVersion` changes
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
- `Mark`, `Span`, `Block`, or slot component changes
- block controls appearing or disappearing
- adapter structural version changes

The DOM feature owns one rendered watcher. Inside one `batch()`, in this order, it:

1. consumes registrations for the adapter commit
2. reconciles text-surface content and editable attributes
3. validates required structural roles
4. rebuilds weak maps for element-to-token lookup
5. increments `dom.indexVersion`
6. clears stale active addresses
7. applies pending raw-position caret recovery

The rendered watcher is non-reentrant. If another rendered event fires while it is running, it queues one more pass after the current pass finishes. `locateNode()` and raw-range APIs return `{ok: false, reason: 'notIndexed'}` while no committed index is available.

Malformed branches fail closed. Development builds should emit diagnostics with token path keys; production should avoid throwing from user interactions.

## Caret Recovery Ownership

Keep one recovery signal:

```ts
store.caret.recovery: Signal<{rawPosition: number; affinity?: 'before' | 'after'} | undefined>
```

Ownership rules:

- Features schedule recovery by writing `store.caret.recovery`.
- Features never call `placeCaret()` directly as part of a value edit.
- The DOM rendered watcher is the only code path that calls `placeCaret()` and clears recovery.
- `ParsingFeature` should no longer branch parse behavior on old DOM-anchor recovery.

This replaces `Recovery.anchor`, `Recovery.childIndex`, `Recovery.isNext`, sibling traversal, and stale DOM-anchor recovery.

## Raw Position Semantics

Raw positions are UTF-16 code-unit offsets into the serialized editor value, not grapheme offsets.

Boundary rules:

- Collapsed selections return `{start: n, end: n}`.
- Reversed selections normalize `start <= end` and preserve `direction`.
- A boundary inside a registered text surface maps to `token.position.start + localOffset`.
- A boundary on a token shell maps by affinity: `before` maps to token start, `after` maps to token end.
- Inter-mark zero-width gaps are resolved through adjacent token-shell affinity: `before` maps to the previous mark end, `after` maps to the next mark start.
- A boundary inside controls returns `{ok: false, reason: 'control'}`.
- A selection crossing controls and editable content returns `{ok: false, reason: 'mixedBoundary'}`; clipboard code decides whether to clamp or fail.
- A boundary outside the editor returns `{ok: false, reason: 'outsideEditor'}`.
- Empty text surfaces are valid and map to the text token start.
- Block row gaps map only through registered token shells or explicit row boundary rules; controls do not become text.
- Slot-root boundaries map to the slot raw range when the mark has a `slot`; otherwise they map to the mark value range.
- Selection and caret events inside registered controls are ignored for `activeAddress` and caret recovery.

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
- Commit composition text on `compositionend` using the final browser selection/range.
- Boundaries that split a UTF-16 surrogate pair return `{ok: false, reason: 'invalidBoundary'}` rather than silently corrupting text.

Caret placement should never depend on stale DOM anchors. It resolves raw position against the current parsed tokens and the current DOM index.

## Value Edit Pipeline

Value mutation moves into one small command pipeline. The first abstraction is `replaceRange()`. `commit()` is a thin helper that replaces the full current value.

```ts
store.value.replaceRange(
	range: RawRange,
	replacement: string,
	options?: {
		recover?:
			| {kind: 'caret'; rawPosition: number; affinity?: 'before' | 'after'}
			| {kind: 'select'; range: RawRange}
		source?: 'input' | 'paste' | 'cut' | 'overlay' | 'mark' | 'block' | 'drag'
	}
): EditResult

store.value.commit(
	candidate: string,
	options?: {
		recover?:
			| {kind: 'caret'; rawPosition: number; affinity?: 'before' | 'after'}
			| {kind: 'select'; range: RawRange}
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

Controlled-mode behavior is strict echo-only:

1. Build the candidate string.
2. Call `onChange(candidate)`.
3. Return `{ok: true, accepted: 'pendingControlledEcho', value: candidate}`.
4. Keep `value.current` and parsed tokens at the last accepted value until `props.value` echoes the candidate.
5. DOM reconciliation always reflects the accepted value, not an optimistic candidate.
6. Recovery is stored and applied only after the echoed token tree renders.

This matches the current controlled rollback model more closely than bounded optimistic editing and avoids vague "next render cycle" timing.

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

`useMark()` returns a small command-oriented controller. It is rebuilt by the framework adapter as token props and `readOnly` change; the methods close over the captured `TokenAddress` from that render.

`MarkPatch` semantics:

- missing key means unchanged
- `meta: null` clears metadata
- `slot: null` clears slot content
- string values set the field

`MarkController` intentionally exposes only common mark data and commands. Drop `key`, `setValue`, `setMeta`, and `setSlot`; callers can use `pathKey(path)` and `update(patch)` when they need those behaviors. If integrators need `path`, `depth`, or diagnostics, expose them through a separate `useMarkAddress()` / `useMarkDebug()` hook rather than expanding the default controller.

`setContent()` is deliberately omitted. `content`, `value`, and `slot` are easy to confuse. `useMarkField()` is deferred until there is a concrete editing helper design.

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
- emit `store.lifecycle.rendered({container, layout})` after DOM-affecting renders

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
- Custom `Span` and `Mark` components become presentation slots inside adapter-owned shells.
- Direct custom `contentEditable` marks are no longer the primary editing path.
- `Recovery.anchor`, `Recovery.childIndex`, and sibling-based recovery are removed.
- `store.nodes.focus` / `store.nodes.input` are replaced by location/address state.
- Internal block wrappers and drag controls may change DOM order.
- Clipboard behavior for mixed control/editable selections may fail or clamp explicitly instead of silently preserving partial marks.
- Tests that assert exact DOM shape need updates to the adapter-owned structure.

`NodeProxy` removal from feature contracts is a follow-up release after adapter registration and migrated consumers have stabilized. It should not block the first breaking ship.

## Migration Plan

Prefer vertical migration slices over one long DOM-shape rewrite. Keep a short internal dual-path flag so old and new locators can coexist while one consumer is migrated at a time.

### Phase 1: Shared Contracts and Addressing

- Add shared `TokenPath`, `TokenAddress`, `RawRange`, `LocationResult`, and `EditResult` types under `packages/core/src/shared/`.
- Add path lookup and `pathKey()` helpers.
- Add parse generation tracking in `ParsingFeature`.
- Add readonly token snapshot helpers for adapter props/hooks.

### Phase 2: Registration Foundation

- Add private DOM registration APIs and stable adapter ref factories.
- Extend `store.lifecycle.rendered` with `{container, layout}` payload.
- Add `store.dom.indexVersion`, `store.dom.activeAddress`, diagnostics, and non-reentrant rendered watcher.
- Keep existing locator paths active.

### Phase 3: Clipboard Slice

- Add `rawRangeFromSelection()` and migrate clipboard copy/cut first.
- Cover mixed-boundary clipboard behavior.
- Keep old keyboard/block paths on the legacy locator during this slice.

### Phase 4: Inline Input and Overlay Slice

- Add `replaceRange()` / `commit()` with strict controlled echo-only behavior.
- Migrate inline input and overlay selection to raw ranges.
- Replace stale DOM-anchor recovery for these paths with `caret.recovery`.

### Phase 5: Block and Drag Slice

- Migrate block edit raw-position logic and drag row edits.
- Keep drag preview token order immutable; mutate serialized value only on drop commit.
- Clarify `BlockRegistry` remains UI state.

### Phase 6: Mark Controller API

- Replace `MarkHandler` with command-oriented `MarkController`.
- Remove `useMark().ref` and uncontrolled DOM mutation behavior.
- Update docs, examples, and stories for custom mark authoring.

### Phase 7: Legacy Cleanup Follow-Up Release

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
- delayed controlled echo applies recovery only after echoed tokens render
- no controlled echo keeps accepted value and DOM at the previous value
- recover caret from raw position after parse
- ignore invalid token paths safely
- reject surrogate-pair split boundaries
- handle IME composition by committing on `compositionend`

DOM/browser tests:

- inline typing maps registered text surfaces to the correct token
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
- stale addresses fail closed after `parseGeneration` or `dom.indexVersion` changes
- render notifications run after layout, slot, readOnly, and token changes
- rendered watcher is non-reentrant and bumps `indexVersion` once per committed pass
- drag preview does not mutate `parsing.tokens()` until drop commit

Regression tests:

- no `data-testid` reliance in production mapping
- no public `useMark().ref`
- no token mapping through DOM child parity
- no public controller exposes live mutable parser tokens
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
- raw value edits and caret recovery flowing through core
- `TokenPath` as a current-parse address, not durable identity
- `BlockRegistry` as UI state, not edit/location identity

## Resolved Design Decisions

- Keep `TokenPath` as arrays and use `pathKey()` strings for maps/debugging.
- Use `layout`, not `mode`, in DOM APIs to match existing public prop language.
- Use `slotRoot`, not `slot`, for the DOM registration role.
- Keep `TokenAddress.parseGeneration` for diagnostics and cheap stale checks, but validate by resolving the path and comparing captured token shape.
- Do not re-resolve stale addresses by descriptor search in the first design.
- Do not expose public `TokenSurface` in the first implementation.
- Do not expose live mutable tokens from public mark APIs.
- Use adapter-owned internal registration instead of production DOM walks based on child order.
- Reuse `store.lifecycle.rendered` as the single adapter post-render signal.
- Keep `caret.recovery` as the single recovery signal; features schedule, the DOM rendered watcher applies.
- Use strict echo-only controlled mode.
- Defer `useMarkField()` until a concrete field-editing helper is needed.
- Treat missing nested `{children}` as a development error and production diagnostic.
- Ship legacy `NodeProxy` cleanup as a follow-up release.

## Acceptance Criteria

### DOM Location and Adapter Contract

- There is exactly one production DOM/token locator.
- React and Vue register the same conceptual structural roles with core.
- The locator ignores controls, maps user-mark descendants to the owning token, and detects missing required structural roles.
- Production mapping does not depend on public attributes, test ids, user refs, user component DOM child order, or DOM child parity.
- Render processing is non-reentrant, `parseGeneration` is monotonic for parsed token changes, and `dom.indexVersion` is monotonic for committed DOM indexes.

### Value and Caret

- Value commits and raw range edits go through one core command path.
- Controlled behavior is strict echo-only.
- Caret recovery is based on raw value position, not stale DOM anchors.
- Only the DOM rendered watcher applies and clears `caret.recovery`.
- Raw-position boundary behavior is covered for collapsed selections, reversed selections, controls, mixed selections, empty text, adjacent marks, block rows, slot-root boundaries, IME, and surrogate pairs.

### Public API and Docs

- Custom marks do not need refs for normal mark operations.
- Public mark APIs return readonly fields and command methods.
- Writable mark signals are not introduced as a second mutation path.
- Inline, block, and nested mark tests pass in both React and Vue.
- Public docs show the new command-based custom mark API.
