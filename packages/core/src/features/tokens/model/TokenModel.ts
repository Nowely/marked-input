import type {DomRef, RawSelection, TokenAddress, TokenPath} from '../../../shared/editorContracts'
import {computed, watch} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import type {Host} from '../../state/Host'
import type {PropsModel} from '../../state/PropsModel'
import type {ValueModel} from '../../state/ValueModel'
import {markBoundaryAt, rawPositionFromBoundary, textTargetAt} from '../boundary'
import type {BoundaryContext, Lookup, TokenView} from '../boundary'
import {focusIfNeeded, getRect, placeAtChildBoundary, placeAtTextOffset, placeRangeAcrossSurfaces} from '../caret'
import {incrementalParse} from '../incrementalParse'
import {Parser} from '../parser/Parser'
import type {Token} from '../parser/types'
import {createTextToken} from '../parser/utils/createTextToken'
import {createIdentityTracker} from '../tokenIdentity'
import type {EditHint, ReconcileResult} from '../tokenIdentity'
import {pathEquals, pathKey, resolvePath} from '../tokenIndex'
import {createCommitPipeline} from './commit'
import {applyEditableState} from './editableState'
import type {TokenHandle} from './LiveNode'

export type SelectionAnchor = {node: Node; offset: number; isCollapsed: boolean}

type ControlRegistration = {
	readonly ownerPath?: TokenPath
	readonly element: HTMLElement
}

type ChildSequenceRegistration = {
	readonly ownerPath: TokenPath
	readonly element: HTMLElement
}

/**
 * The thin public shell over the live node layer: parses the value, reconciles
 * token identity, and feeds the one commit pipeline; everything else — handle
 * lookups, the DOM↔model facade, adapter refs — is a read over the pipeline's
 * node layer. Owns the `nodes` map the pipeline mutates.
 */
export class TokenModel {
	readonly #identity = createIdentityTracker()

	/** THE live node layer, keyed by stable token id — mutated only through the pipeline. */
	readonly #nodes = new Map<number, TokenHandle>()

	// Ref registries — populated by framework ref callbacks, read by bind.
	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0

	/** Last state written by {@link setEditable}; until then derived from props at bind time. */
	#editable: {editable: boolean; readOnly: boolean} | undefined

	readonly #pipeline = createCommitPipeline({
		container: () => this.host.container(),
		nodes: this.#nodes,
		idFor: token => this.#identity.idFor(token),
		editableState: () => this.#editableState(),
		controlElements: () => this.#controlElements(),
		childSequenceHostsFor: path => this.#childSequenceHostsFor(path),
		isBlock: () => this.props.layout.isBlock(),
	})

	/** Renderer contract (adapter-only — `@markput/core/adapter`): reference change ⇔ the renderer must run. NOT a consumer data read — use `tokens()`. */
	readonly renderTree: Computed<Token[]> = this.#pipeline.renderTree

	/**
	 * THE consumer read: the latest reconciled tree, always fresh and consistent
	 * with `value.current()`. Unlike `renderTree` (the renderer signal, which keeps
	 * its reference across text-path commits), `tokens()` is the pipeline's private
	 * `latest` — reassigned at the top of every apply, fresh in the pending window
	 * too. The boundary facade and every value-slicing consumer read it.
	 */
	tokens(): readonly Token[] {
		return this.#pipeline.tokens()
	}

	/** The top-level token at `index` of the fresh reconciled tree, or undefined. */
	at(index: number): Token | undefined {
		return this.#pipeline.tokens()[index]
	}

	/** THE model-level detector: fires once per commit, only after the DOM is consistent. Payloadless — consumers re-read. */
	readonly changed: Event<void> = this.#pipeline.changed

	/**
	 * Internal: ids removed (subtree included) by the LAST committed reconcile —
	 * the prune feed for id-keyed UI-state stores. Read inside a `changed` watch;
	 * the public event carries no payload, so this accessor is the migration path
	 * for consumers that read the old changeset's `removed` bucket (BlockController).
	 */
	readonly removedIds = (): readonly number[] => this.#pipeline.removedIds()

	/**
	 * Adapter SPI: the framework key of a render-tree token — its stable
	 * identity id, so a suffix-shifted token (new object, inherited id) keeps
	 * its key and is reconciled in place instead of remounted. Arrow property:
	 * adapters pass it around unbound. Total like the KeyGenerator it replaces;
	 * the idOf fallback covers tokens that predate reconcile stamping (and
	 * allocates for foreign tokens, exactly as the old per-object counter did).
	 */
	readonly keyOf = (token: Token): number => token.id ?? this.#identity.idOf(token)

	readonly #parser: Computed<Parser | undefined> = computed(() => {
		const Mark = this.props.Mark()
		const options = this.props.options()
		const hasMark = Mark != null || options.some(opt => 'Mark' in opt && opt.Mark != null)
		if (!hasMark) return
		const markups = options.map(opt => opt.markup)
		if (!markups.some(Boolean)) return
		return new Parser(markups)
	})

	/** Previous parse (pre-filterEmptyText) — the splice base for {@link incrementalParse}. */
	#lastParsed: {parser: Parser; value: string; tokens: Token[]} | undefined

	// PURITY: the consume-once hint read and the #lastParsed write mutate inside
	// this computed — safe because the runtime executes a getter at most once per
	// dependency change wave (verified in shared/signals; equal writes never propagate).
	readonly #reconciled: Computed<ReconcileResult> = computed(() => {
		const parser = this.#parser()
		const value = this.value.current()
		const hint = this.value.takePendingEdit()
		const previousValue = this.value.previousValue()
		const parsed = this.#parse(parser, value, hint, previousValue)
		// #lastParsed keeps the UNfiltered tree: incrementalParse splices previous
		// top-level tokens, so its input must be exactly what parse() emits. The
		// identity tracker receives the FILTERED tree (block mode) — what renders.
		this.#lastParsed = parser ? {parser, value, tokens: parsed} : undefined
		const tokens = this.props.layout.isBlock() ? filterEmptyText(parsed) : parsed
		return this.#identity.reconcile(tokens, hint, previousValue, value)
	})

	/**
	 * Typing hot path: reparse only a window around the edit hint when the
	 * matching previous parse is available; incrementalParse itself falls back
	 * to a full parse on any doubt (output is always parse-equivalent — gated
	 * by incrementalParse.property.spec.ts).
	 */
	#parse(
		parser: Parser | undefined,
		value: string,
		hint: EditHint | undefined,
		previousValue: string | undefined
	): Token[] {
		if (!parser) return [createTextToken(value)]
		const lastParsed = this.#lastParsed
		if (hint === undefined || lastParsed === undefined) return parser.parse(value)
		// A parser/options change invalidates the previous tree's descriptors; the
		// hint's ranges are coordinates in exactly the last parsed value.
		if (lastParsed.parser !== parser || lastParsed.value !== previousValue) return parser.parse(value)
		return incrementalParse(parser, lastParsed.tokens, lastParsed.value, value, hint)
	}

	constructor(
		private readonly value: ValueModel,
		private readonly props: PropsModel,
		private readonly host: Host
	) {
		host.onMounted(() => {
			// Order matters: the immediate apply seeds the pipeline (cold start is
			// a structural pass), so the immediate onRendered right after can bind
			// a pre-built DOM — the shell is live once the container attaches.
			watch(this.#reconciled, result => this.#pipeline.apply(result), {immediate: true})
			watch(host.rendered, () => this.#pipeline.onRendered(), {immediate: true})
		})
	}

	/** Ref callback for a control element (e.g. overlay, drag handle). */
	control(ownerPath?: TokenPath): DomRef {
		const key = `control:${++this.#nextControlId}`
		return element => {
			if (element) {
				this.#pendingControls.set(key, {ownerPath: ownerPath ? [...ownerPath] : undefined, element})
			} else {
				this.#pendingControls.delete(key)
			}
		}
	}

	/** Ref callback for the element hosting a token's child sequence. */
	children(ownerPath: TokenPath): DomRef {
		const key = `children:${++this.#nextChildSequenceId}`
		return element => {
			if (element) {
				this.#pendingChildSequences.set(key, {ownerPath: [...ownerPath], element})
			} else {
				this.#pendingChildSequences.delete(key)
			}
		}
	}

	/** Live handle of the token bound at `address.path`, or undefined if not bound. */
	handleFor(address: TokenAddress): TokenHandle | undefined {
		return this.#pipeline.byPath().get(pathKey(address.path))
	}

	/**
	 * Resolve a DOM node to its handle, 'control' if inside a control root,
	 * or undefined if outside the container.
	 */
	handleAt(node: Node): TokenHandle | 'control' | undefined {
		const lookup = this.#locate(node)
		if (!lookup) return undefined
		if (lookup.kind === 'control') return 'control'
		return lookup.node.handle
	}

	/**
	 * Bridge a (possibly stale) token object to its live handle via the stable
	 * identity id. Fails closed while a structural apply awaits its bind — the
	 * node layer is one generation stale there, and handing out a handle would
	 * let mutations act on a tree the DOM never showed. `handleFor`/`handleAt`
	 * stay ungated by design: they resolve through the CURRENT maps (address-
	 * and DOM-keyed, not stale-token-keyed), matching the old shell's behavior
	 * during the same window.
	 */
	handleOf(token: Token): TokenHandle | undefined {
		if (this.#pipeline.pending()) return undefined
		// Read-only id peek: probing a foreign token must not allocate an id.
		const id = this.#identity.idFor(token)
		return id === undefined ? undefined : this.#nodes.get(id)
	}

	/**
	 * Resolve a token id to its live handle, or `undefined`. The id-keyed read
	 * over the live node layer — fails closed while a structural apply awaits its
	 * bind (the layer is one generation stale, so a handle would let mutations act
	 * on a tree the DOM never showed). THE identity lookup: a consumer holding a
	 * render-tree token resolves `handle(token.id)`; the handle's `token()` carries
	 * current content and positions, and its existence IS the validity check.
	 */
	handle(id: number): TokenHandle | undefined {
		if (this.#pipeline.pending()) return undefined
		return this.#nodes.get(id)
	}

	/**
	 * Iterate all bound tokens' live handles.
	 * @yields each bound token's handle
	 */
	*handles(): IterableIterator<TokenHandle> {
		yield* this.#pipeline.byPath().values()
	}

	/** Handle of the text token containing `position` (or the next one after). */
	tokenAt(position: number): TokenHandle | undefined {
		return textTargetAt(this.#boundaryContext(), position)?.node.handle
	}

	/** Locate the live node owning a DOM node, walking up to the container (the old #locate over the pipeline lookups). */
	#locate(node: Node): Lookup | undefined {
		const container = this.host.container()
		if (!container) return undefined

		let current: Node | null = node
		while (current && current !== container) {
			if (current instanceof HTMLElement) {
				const handle = this.#pipeline.byElement(current)
				if (handle) {
					const view = this.#view(handle)
					return view ? {kind: 'token', node: view} : undefined
				}
				if (this.#pipeline.isControlRoot(current)) return {kind: 'control'}
			}
			current = current.parentNode
		}
		return undefined
	}

	/** View of a handle for the boundary facade: fresh address over the live bindings. */
	#view(handle: TokenHandle): TokenView | undefined {
		const bindings = handle.node()
		if (!bindings) return undefined
		return {handle, address: handle.address(), ...bindings}
	}

	*#views(): IterableIterator<TokenView> {
		for (const handle of this.#pipeline.byPath().values()) {
			const view = this.#view(handle)
			if (view) yield view
		}
	}

	/**
	 * Fail-closed address check against the CURRENT reconciled tree (path AND
	 * object identity must match). Node-layer views carry fresh token objects,
	 * so this only rejects while a structural apply awaits its bind (the layer
	 * is one generation stale) and for foreign or removed addresses.
	 */
	#resolveAddress(address: TokenAddress): Token | undefined {
		const current = resolvePath(this.tokens(), address.path)
		return current === address.token ? current : undefined
	}

	/** Id-bridged view of a current-tree token's bound node (boundary internals; reached only behind {@link #resolveAddress}). */
	#viewOf(token: Token): TokenView | undefined {
		const id = this.#identity.idFor(token)
		const handle = id === undefined ? undefined : this.#nodes.get(id)
		return handle ? this.#view(handle) : undefined
	}

	#boundaryContext(): BoundaryContext {
		return {
			container: this.host.container() ?? undefined,
			tokens: this.tokens(),
			resolveAddress: address => this.#resolveAddress(address),
			viewOf: token => this.#viewOf(token),
			locate: node => this.#locate(node),
			nodes: () => this.#views(),
		}
	}

	/** Map a DOM boundary (node, offset) to an absolute document position. */
	boundaryFor(node: Node, offset: number, affinity: 'before' | 'after' = 'after'): number | undefined {
		return rawPositionFromBoundary(this.#boundaryContext(), node, offset, affinity)
	}

	/** Current window selection as absolute positions. */
	readSelection(): RawSelection | undefined {
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return undefined

		const range = selection.getRangeAt(0)
		const start = this.boundaryFor(range.startContainer, range.startOffset, 'after')
		if (start === undefined) return undefined
		const end = this.boundaryFor(range.endContainer, range.endOffset, 'before')
		if (end === undefined) return undefined

		const rangeValue = start <= end ? {start, end} : {start: end, end: start}
		const direction =
			rangeValue.start === rangeValue.end
				? undefined
				: selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
					? 'backward'
					: 'forward'

		return direction ? {range: rangeValue, direction} : {range: rangeValue}
	}

	/** Current selection serialized for clipboard use. */
	selectedContent(): {html: string; text: string} | undefined {
		const sel = window.getSelection()
		const range = sel?.rangeCount ? sel.getRangeAt(0) : undefined
		if (!range) return undefined
		const fragment = range.cloneContents()
		const div = document.createElement('div')
		div.appendChild(fragment)
		return {html: div.innerHTML, text: range.toString()}
	}

	/** Viewport rect of the current caret/selection. */
	selectionRect(): DOMRect | undefined {
		return getRect() ?? undefined
	}

	/** Anchor node + offset of the current selection (overlay trigger probing). */
	selectionAnchor(): SelectionAnchor | undefined {
		const sel = window.getSelection()
		if (!sel?.anchorNode) return undefined
		return {node: sel.anchorNode, offset: sel.anchorOffset, isCollapsed: sel.isCollapsed}
	}

	/**
	 * Whether the current selection is collapsed.
	 *
	 * Tri-state: `undefined` when there is no Selection object at all (in
	 * practice: the element is not focused), `true` for a collapsed caret,
	 * `false` for a range. Callers wanting "no selection counts as collapsed"
	 * must compare `isSelectionCollapsed() !== false`.
	 */
	isSelectionCollapsed(): boolean | undefined {
		const sel = window.getSelection()
		return sel ? sel.isCollapsed : undefined
	}

	/** Whether the current selection intersects `node` (partial containment counts). */
	selectionIntersects(node: Node): boolean {
		return window.getSelection()?.containsNode(node, true) ?? false
	}

	/** Focus node of the current selection, if any. */
	selectionFocusNode(): Node | undefined {
		return window.getSelection()?.focusNode ?? undefined
	}

	/**
	 * Place a collapsed caret. Number form resolves the best target (text
	 * surface containing the position, else a mark boundary exactly there);
	 * address form targets a specific token (callers use it to disambiguate
	 * tokens sharing a boundary position).
	 *
	 * **Address form — `offset` for mark tokens without a text surface:**
	 * `offset <= 0` selects the start child boundary of the token element,
	 * `offset > 0` the end — a binary selector, not a character offset.
	 */
	placeCaret(target: number | {address: TokenAddress; offset: number}): boolean {
		if (typeof target === 'number') return this.#placeAtRawPosition(target)

		// Id-bridged resolution: the address's token may be a stale tree() object
		// after text-path commits — accept it iff its identity currently lives at
		// the addressed path. handleOf's latch gate keeps this fail-closed while
		// a structural apply awaits its bind.
		const handle = this.handleFor(target.address)
		if (!handle || this.handleOf(target.address.token) !== handle) return false
		const bindings = handle.node()
		if (!bindings) return false

		if (handle.token().type === 'mark' && !bindings.textElement) {
			focusIfNeeded(bindings.tokenElement)
			placeAtChildBoundary(bindings.tokenElement, target.offset <= 0 ? 'start' : 'end')
			return true
		}

		const surface = bindings.textElement ?? bindings.tokenElement
		focusIfNeeded(surface)
		if (bindings.textElement) placeAtTextOffset(bindings.textElement, target.offset)
		return true
	}

	#placeAtRawPosition(rawPosition: number): boolean {
		const ctx = this.#boundaryContext()

		const textTarget = textTargetAt(ctx, rawPosition)
		if (textTarget?.node.textElement && rawPosition >= textTarget.start && rawPosition <= textTarget.end) {
			focusIfNeeded(textTarget.node.textElement)
			placeAtTextOffset(textTarget.node.textElement, rawPosition - textTarget.start)
			return true
		}

		const markTarget = markBoundaryAt(ctx, rawPosition)
		if (markTarget) {
			focusIfNeeded(markTarget.element)
			placeAtChildBoundary(markTarget.element, rawPosition === markTarget.position.end ? 'end' : 'start')
			return true
		}

		if (textTarget?.node.textElement) {
			focusIfNeeded(textTarget.node.textElement)
			placeAtTextOffset(textTarget.node.textElement, rawPosition - textTarget.start)
			return true
		}

		return false
	}

	/**
	 * Select [start, end]; collapses via placeCaret when equal. Order-
	 * insensitive: the range is normalized to [lo, hi] before being forwarded
	 * to the DOM Range API (which would throw on a reversed range).
	 */
	selectRange(start: number, end: number): boolean {
		if (start === end) return this.placeCaret(start)
		const [lo, hi] = start <= end ? [start, end] : [end, start]
		const ctx = this.#boundaryContext()
		const startTarget = textTargetAt(ctx, lo)
		const endTarget = textTargetAt(ctx, hi)
		if (!startTarget?.node.textElement || !endTarget?.node.textElement) return false
		placeRangeAcrossSurfaces(
			{element: startTarget.node.textElement, offset: lo - startTarget.start},
			{element: endTarget.node.textElement, offset: hi - endTarget.start}
		)
		return true
	}

	/**
	 * Absolute position at viewport coordinates (read half of old setAtX).
	 * Returns `undefined` when the point hits nothing hittable, or when the
	 * resolved DOM boundary falls outside any bound token.
	 */
	caretFromPoint(x: number, y: number): number | undefined {
		// oxlint-disable-next-line no-unsafe-type-assertion -- non-standard DOM APIs not in TS lib
		const doc = document as unknown as {
			caretRangeFromPoint?(x: number, y: number): globalThis.Range | null
			caretPositionFromPoint?(x: number, y: number): {offsetNode: Node; offset: number} | null
		}
		const pos = doc.caretRangeFromPoint?.(x, y) ?? doc.caretPositionFromPoint?.(x, y)
		if (!pos) return undefined
		if (pos instanceof globalThis.Range) return this.boundaryFor(pos.startContainer, pos.startOffset)
		return this.boundaryFor(pos.offsetNode, pos.offset)
	}

	/**
	 * @internal Scoped editable-state application: conditional contentEditable
	 * on bound text surfaces, tabindex on bound mark roots, and the seed for
	 * future binds (replaces the old per-commit sweep). SelectionController
	 * owns the policy: it calls this whenever readOnly or isUserSelecting changes.
	 */
	setEditable(options: {editable: boolean; readOnly: boolean}): void {
		this.#editable = {editable: options.editable, readOnly: options.readOnly}
		for (const handle of this.#pipeline.byPath().values()) {
			const bindings = handle.node()
			if (!bindings) continue
			if (!bindings.textElement && handle.token().type !== 'mark') continue
			applyEditableState(bindings, options)
		}
	}

	#editableState(): {editable: boolean; readOnly: boolean} {
		if (this.#editable) return this.#editable
		const readOnly = this.props.readOnly()
		return {editable: !readOnly, readOnly}
	}

	#controlElements(): ReadonlySet<HTMLElement> {
		const out = new Set<HTMLElement>()
		for (const {element} of this.#pendingControls.values()) out.add(element)
		return out
	}

	#childSequenceHostsFor(ownerPath: TokenPath): HTMLElement[] {
		const out: HTMLElement[] = []
		for (const registration of this.#pendingChildSequences.values()) {
			if (pathEquals(registration.ownerPath, ownerPath)) out.push(registration.element)
		}
		return out
	}
}

/** Standalone / test construction seam: creates a TokenModel from the same (value, props, host) triple Store uses directly. */
export function createTokenModel(value: ValueModel, props: PropsModel, host: Host): TokenModel {
	return new TokenModel(value, props, host)
}

function filterEmptyText(tokens: Token[]): Token[] {
	return tokens.filter(token => {
		if (token.type !== 'text') return true
		return token.position.start !== token.position.end
	})
}