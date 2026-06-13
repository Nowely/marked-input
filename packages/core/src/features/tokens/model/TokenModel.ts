import type {DomRef, RawSelection, TokenPath} from '../../../shared/editorContracts'
import {computed, watch} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import type {Host} from '../../state/Host'
import type {PropsModel} from '../../state/PropsModel'
import type {ValueModel} from '../../state/ValueModel'
import {markBoundaryAt, rawPositionFromBoundary, textTargetAt} from '../boundary'
import type {BoundaryContext, Lookup, TokenView} from '../boundary'
import {focusIfNeeded, getRect, placeAtChildBoundary, placeAtTextOffset, placeRangeAcrossSurfaces} from '../caret'
import {Parser} from '../parser/Parser'
import type {Token} from '../parser/types'
import {createTextToken} from '../parser/utils/createTextToken'
import {createIdentityTracker} from '../tokenIdentity'
import {pathEquals} from '../tokenIndex'
import {createCommitPipeline} from './commit'
import {applyEditableState} from './editableState'
import type {TokenHandle} from './LiveNode'

export type SelectionAnchor = {node: Node; offset: number; isCollapsed: boolean}

export type SelectionSnapshot = {
	/** Absolute in-editor positions of the selection, or undefined if it falls outside any bound token. */
	readonly raw: RawSelection | undefined
	/** Viewport rect of the caret/selection. */
	readonly rect: DOMRect | undefined
	/** Anchor node + offset + collapsed flag of the raw window selection. */
	readonly anchor: SelectionAnchor
	/** Whether the raw selection is collapsed. */
	readonly collapsed: boolean
	/** Focus node of the raw window selection. */
	readonly focusNode: Node | undefined
	/** Whether the raw selection intersects `node` (partial containment counts). */
	intersects(node: Node): boolean
}

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

	/**
	 * THE reparse pipeline entry (the spec's watch-callback hint flow). Driven by
	 * the one watch over the `(value, parser, isBlock)` tuple in the constructor:
	 * when any of the three changes, drain the consume-once edit hint, full-parse
	 * the value (inline parsing is always a full parse — the windowed
	 * `incrementalParse` is deleted; Phase 7's pre-split row parser is the
	 * incrementality story), filter empty texts in block mode, then reconcile and
	 * apply. The hint + `previousValue` are plain fields the `current` write set
	 * synchronously, so draining them HERE — inside an `untracked` watch callback,
	 * once per wave by construction — needs no PURITY argument (the old
	 * `#reconciled` computed drained them inside a getter, leaning on the runtime's
	 * once-per-wave guarantee; that dependence is gone).
	 */
	#reparse(value: string, parser: Parser | undefined, isBlock: boolean): void {
		const hint = this.value.takePendingEdit()
		const previousValue = this.value.previousValue()
		const parsed = parser ? parser.parse(value) : [createTextToken(value)]
		const tokens = isBlock ? filterEmptyText(parsed) : parsed
		this.#pipeline.apply(this.#identity.reconcile(tokens, hint, previousValue, value))
	}

	constructor(
		private readonly value: ValueModel,
		private readonly props: PropsModel,
		private readonly host: Host
	) {
		host.onMounted(() => {
			// Order matters: the immediate reparse seeds the pipeline (cold start is
			// a structural pass), so the immediate onRendered right after can bind
			// a pre-built DOM — the shell is live once the container attaches.
			//
			// THE reparse trigger: one watch over the (value, parser, isBlock) tuple
			// (the spec's named tuple). The trigger reads exactly those three signals
			// — so the watch fires on exactly the waves the old #reconciled computed
			// recomputed on — and #reparse drains the hint + applies in the callback.
			watch(
				() => ({value: this.value.current(), parser: this.#parser(), isBlock: this.props.layout.isBlock()}),
				({value, parser, isBlock}) => this.#reparse(value, parser, isBlock),
				{immediate: true}
			)
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

	/** View of a handle for the boundary facade: the fresh current token over the live bindings. */
	#view(handle: TokenHandle): TokenView | undefined {
		const bindings = handle.node()
		if (!bindings) return undefined
		return {handle, token: handle.token(), ...bindings}
	}

	*#views(): IterableIterator<TokenView> {
		for (const handle of this.#pipeline.byPath().values()) {
			const view = this.#view(handle)
			if (view) yield view
		}
	}

	/** The view's fresh current token while its handle is live (views are built from live handles, so this is total for an in-hand view). */
	#tokenOf(view: TokenView): Token | undefined {
		return view.handle.alive() ? view.token : undefined
	}

	/** Id-bridged view of a current-tree token's bound node (boundary internals). */
	#viewOf(token: Token): TokenView | undefined {
		const handle = token.id === undefined ? undefined : this.handle(token.id)
		return handle ? this.#view(handle) : undefined
	}

	#boundaryContext(): BoundaryContext {
		return {
			container: this.host.container() ?? undefined,
			tokens: this.tokens(),
			tokenOf: view => this.#tokenOf(view),
			viewOf: token => this.#viewOf(token),
			locate: node => this.#locate(node),
			nodes: () => this.#views(),
		}
	}

	/** Map a DOM boundary (node, offset) to an absolute document position. */
	boundaryFor(node: Node, offset: number, affinity: 'before' | 'after' = 'after'): number | undefined {
		return rawPositionFromBoundary(this.#boundaryContext(), node, offset, affinity)
	}

	/**
	 * THE selection read: one snapshot of the live window selection, or
	 * `undefined` when there is no range (the element is unfocused / nothing
	 * selected). Subsumes the six micro-reads — `raw` is the absolute in-editor
	 * range (undefined when the selection is outside the editor), `rect`/`anchor`/
	 * `collapsed`/`focusNode` reflect the raw selection, and `intersects` closes
	 * over it. A consumer that treated "no selection" as collapsed compares
	 * `selection()?.collapsed !== false`.
	 */
	selection(): SelectionSnapshot | undefined {
		const sel = window.getSelection()
		if (!sel || sel.rangeCount === 0) return undefined
		const anchorNode = sel.anchorNode
		if (!anchorNode) return undefined
		return {
			raw: this.#rawSelectionFrom(sel),
			rect: getRect() ?? undefined,
			anchor: {node: anchorNode, offset: sel.anchorOffset, isCollapsed: sel.isCollapsed},
			collapsed: sel.isCollapsed,
			focusNode: sel.focusNode ?? undefined,
			intersects: node => sel.containsNode(node, true),
		}
	}

	/** Absolute in-editor positions of a window selection's first range, or undefined if it maps outside any bound token. */
	#rawSelectionFrom(selection: Selection): RawSelection | undefined {
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

	/**
	 * Place a collapsed caret. Number form resolves the best target (text
	 * surface containing the position, else a mark boundary exactly there);
	 * handle form targets a specific token's live handle (callers use it to
	 * disambiguate tokens sharing a boundary position).
	 *
	 * **Handle form — `offset` for mark tokens without a text surface:**
	 * `offset <= 0` selects the start child boundary of the token element,
	 * `offset > 0` the end — a binary selector, not a character offset.
	 */
	placeCaret(target: number | {handle: TokenHandle; offset: number}): boolean {
		if (typeof target === 'number') return this.#placeAtRawPosition(target)

		// The handle IS the resolution: a live handle carries the current bindings;
		// a dead or mid-window handle fails closed.
		const handle = target.handle
		if (!handle.alive()) return false
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