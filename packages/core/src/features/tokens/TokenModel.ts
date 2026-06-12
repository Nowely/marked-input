import type {DomRef, RawSelection, TokenAddress, TokenPath} from '../../shared/editorContracts'
import {batch, computed, event, signal, watch} from '../../shared/signals/index.js'
import type {Computed, Event, Signal} from '../../shared/signals/index.js'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {markBoundaryAt, rawPositionFromBoundary, textTargetAt} from './boundary'
import type {BoundaryContext} from './boundary'
import {buildIndex, indexNodeElements} from './buildIndex'
import {focusIfNeeded, getRect, placeAtChildBoundary, placeAtTextOffset, placeRangeAcrossSurfaces} from './caret'
import {isTextPath} from './commitRouting'
import type {Lookup, TokenNode} from './domTypes'
import {INCREMENTAL, incrementalParse} from './incrementalParse'
import {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import {createTextToken} from './parser/utils/createTextToken'
import {reconcileTextSurfaces} from './reconcileTextSurfaces'
import {TokenHandle} from './TokenHandle'
import type {HandleHost} from './TokenHandle'
import {createIdentityTracker} from './tokenIdentity'
import type {Changeset, EditHint, ReconcileResult} from './tokenIdentity'
import {createTokenIndex, pathEquals, pathKey, type TokenIndex} from './tokenIndex'

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
 * Single home for the token layer: parses the value into a token tree, indexes
 * it (path ↔ token ↔ address), collects framework ref callbacks, and maintains
 * the token ↔ DOM-element index that selection and keyboard navigation rely on.
 *
 * The heavy logic lives in pure free functions (`buildIndex`, `createTokenIndex`);
 * this class is the thin orchestrator that wires them to the live DOM.
 */
export class TokenModel {
	readonly #identity = createIdentityTracker()

	// PURITY NOTE: `takePendingEdit()` (and the tracker's internal state) mutate
	// inside this computed. That is safe because the signals runtime never runs
	// a computed speculatively: `propagate`/`checkDirty` (shared/signals/
	// alien-signals/system.ts) only flip flags; the getter executes in
	// `updateComputed` — and on the very first read, through the computed's
	// first-read branch — still at most ONCE per dependency change wave, and
	// only when a dependency value actually changed (equal writes never propagate;
	// checkDirty's non-dirty unwind clears Pending without running the getter).
	// A parser/options change also re-runs this computed; by then the hint is
	// consumed or absent and reconcile degrades to the structural added/removed
	// path, which is correct.
	readonly #reconciled: Computed<ReconcileResult> = computed(() => {
		const parser = this.#parser()
		const value = this.value.current()
		const hint = this.value.takePendingEdit()
		const previousValue = this.value.previousValue()
		const parsed = this.#parse(parser, value, hint, previousValue)
		// #lastParsed keeps the UNfiltered tree: incrementalParse splices previous
		// TOP-LEVEL tokens, so its input must be exactly what parse() emits
		// (tiling the whole value, empty text tokens included). The identity
		// tracker keeps receiving the FILTERED tree (block mode) — the tree
		// handles and the index actually consume.
		this.#lastParsed = parser ? {parser, value, tokens: parsed} : undefined
		const tokens = this.props.layout.isBlock() ? filterEmptyText(parsed) : parsed
		return this.#identity.reconcile(tokens, hint, previousValue, value)
	})

	/** Previous parse (pre-filterEmptyText) — the splice base for {@link incrementalParse}. */
	#lastParsed: {parser: Parser; value: string; tokens: Token[]} | undefined

	/**
	 * Typing hot path: when the edit hint and the matching previous parse are
	 * available, reparse only a window around the edit; any doubt inside
	 * incrementalParse falls back to a full parse (output is always
	 * parse-equivalent — gated by incrementalParse.property.spec.ts).
	 */
	#parse(
		parser: Parser | undefined,
		value: string,
		hint: EditHint | undefined,
		previousValue: string | undefined
	): Token[] {
		if (!parser) return [createTextToken(value)]
		const lastParsed = this.#lastParsed
		if (!INCREMENTAL || hint === undefined || lastParsed === undefined) return parser.parse(value)
		// A parser/options change invalidates the previous tree's descriptors;
		// the hint's ranges are coordinates in exactly the last parsed value.
		// `previousValue` is always defined here: the computed reads it from
		// ValueModel, which initializes it to the value present on first render,
		// so the undefined case only occurs before the first run — at which point
		// `lastParsed` is undefined too and we have already returned above.
		if (lastParsed.parser !== parser || lastParsed.value !== previousValue) return parser.parse(value)
		return incrementalParse(parser, lastParsed.tokens, lastParsed.value, value, hint)
	}

	readonly current: Computed<Token[]> = computed(() => this.#reconciled().tokens)
	readonly index: Computed<TokenIndex> = computed(() => createTokenIndex(this.current()))

	#lastStructure: Token[] | undefined

	/**
	 * Renderer contract: the token tree for STRUCTURAL rendering. Reference-
	 * stable across text-path reconciles, so adapters subscribed via snapshot
	 * comparison (React useSyncExternalStore, Vue shallowRef) skip re-rendering
	 * on pure text edits. Refined form of the design spec's sketched
	 * structureInvalidated event — signal-idiomatic for this codebase.
	 *
	 * PURITY NOTE: `#lastStructure` mutates inside this computed. That is safe
	 * for the same reason as `#reconciled`'s consume-once mutation — the signals
	 * runtime only executes a computed's getter at most ONCE per dependency change
	 * wave (see the PURITY NOTE on `#reconciled` for the full argument).
	 */
	readonly structure: Computed<Token[]> = computed(() => {
		const {tokens, changeset} = this.#reconciled()
		if (this.#lastStructure && isTextPath(tokens, changeset, t => this.#identity.idOf(t))) {
			return this.#lastStructure
		}
		this.#lastStructure = tokens
		return tokens
	})

	/** Changeset of the latest reconcile — Phase 3's routing input. */
	changeset(): Changeset {
		return this.#reconciled().changeset
	}

	/** Stable identity of a token in the current tree. */
	idOf(token: Token): number {
		return this.#identity.idOf(token)
	}

	/** Fires after each DOM re-index. */
	readonly indexed: Event<void> = event<void>()

	readonly #parser: Computed<Parser | undefined> = computed(() => {
		const Mark = this.props.Mark()
		const options = this.props.options()
		// TODO maybe in the future it place in one again
		const hasMark = Mark != null || options.some(opt => 'Mark' in opt && opt.Mark != null)
		if (!hasMark) return
		const markups = options.map(opt => opt.markup)
		if (!markups.some(Boolean)) return
		return new Parser(markups)
	})

	// Ref registries (formerly TokenRefs) — populated by framework ref callbacks.
	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0

	// DOM index (formerly DomIndex) — rebuilt on every render.
	#byPath: ReadonlyMap<string, TokenNode> = new Map()
	#byElement: WeakMap<HTMLElement, TokenNode> = new WeakMap()
	#controlRoots: WeakSet<HTMLElement> = new WeakSet()
	#committing = false
	/** Whether a full #commit has run — the first paint must come from the adapter. */
	#hasCommitted = false

	// Handle registry — keyed by stable token identity id, so a handle follows
	// its token across structural path shifts. #byId is the per-commit id → node
	// projection of #byPath (rebuilt in #commit before handles sync).
	readonly #handles = new Map<number, TokenHandle>()
	#byId: ReadonlyMap<number, TokenNode> = new Map()
	readonly #domVersion: Signal<number> = signal({initial: 0})
	readonly #handleHost: HandleHost = {
		version: () => this.#domVersion(),
		nodeForId: id => this.#byId.get(id),
	}

	constructor(
		private readonly value: ValueModel,
		private readonly props: PropsModel,
		private readonly host: Host
	) {
		host.onMounted(() => {
			watch(host.rendered, () => this.#commit(), {immediate: true})
			// Text-path commits: a reconcile classified as a pure text edit keeps
			// structure() reference-stable, so the adapter never re-renders and
			// rendered() never fires — the DOM and index are patched here instead.
			watch(this.#reconciled, ({tokens, changeset}) => {
				if (!this.#hasCommitted) return // first paint must come from the adapter
				// Structural reconciles go through the adapter: structure() changed
				// reference → re-render → rendered() → #commit.
				if (changeset.kind !== 'delta') return
				if (!isTextPath(tokens, changeset, t => this.#identity.idOf(t))) return
				this.#patchCommit(changeset.textChanged)
			})
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

	/** Locate the indexed token node owning a DOM node, walking up to the container. */
	#locate(node: Node): Lookup | undefined {
		const container = this.host.container()
		if (!container) return undefined

		let current: Node | null = node
		while (current && current !== container) {
			if (current instanceof HTMLElement) {
				const tokenNode = this.#byElement.get(current)
				if (tokenNode) return {kind: 'token', node: tokenNode, element: current}
				if (this.#controlRoots.has(current)) return {kind: 'control'}
			}
			current = current.parentNode
		}
		return undefined
	}

	#nodeFor(address: TokenAddress): TokenNode | undefined {
		return this.#byPath.get(pathKey(address.path))
	}

	#nodes(): IterableIterator<TokenNode> {
		return this.#byPath.values()
	}

	/** Return the live handle for a token at the given address, or undefined if not indexed. */
	handleFor(address: TokenAddress): TokenHandle | undefined {
		const node = this.#byPath.get(pathKey(address.path))
		if (!node) return undefined
		return this.#ensureHandle(node)
	}

	/**
	 * Resolve a DOM node to its handle, 'control' if inside a control root,
	 * or undefined if outside the container.
	 */
	handleAt(node: Node): TokenHandle | 'control' | undefined {
		const lookup = this.#locate(node)
		if (!lookup) return undefined
		if (lookup.kind === 'control') return 'control'
		return this.#ensureHandle(lookup.node)
	}

	/**
	 * Iterate all indexed tokens, materializing a handle for each on demand.
	 * @yields each token's live handle
	 */
	*handles(): IterableIterator<TokenHandle> {
		for (const node of this.#byPath.values()) yield this.#ensureHandle(node)
	}

	#ensureHandle(node: TokenNode): TokenHandle {
		const id = this.#identity.idOf(node.address.token)
		let handle = this.#handles.get(id)
		if (!handle) {
			handle = new TokenHandle(id, this.#handleHost, node.address.token, node.address)
			this.#handles.set(id, handle)
		}
		return handle
	}

	#boundaryContext(): BoundaryContext {
		return {
			container: this.host.container() ?? undefined,
			tokens: this.current(),
			index: this.index(),
			locate: node => this.#locate(node),
			nodeFor: address => this.#nodeFor(address),
			nodes: () => this.#nodes(),
		}
	}

	/** Map a DOM boundary (node, offset) to an absolute document position. */
	boundaryFor(node: Node, offset: number, affinity: 'before' | 'after' = 'after'): number | undefined {
		return rawPositionFromBoundary(this.#boundaryContext(), node, offset, affinity)
	}

	/** Handle of the text token containing `position` (or the next one after). */
	tokenAt(position: number): TokenHandle | undefined {
		const target = textTargetAt(this.#boundaryContext(), position)
		return target ? this.#ensureHandle(target.node) : undefined
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
	 * Tri-state: returns `undefined` when there is **no selection at all** (no
	 * `Selection` object, or `rangeCount === 0` style absence handled by the
	 * browser returning a collapsed-but-empty selection — in practice this means
	 * the element is not focused).  Returns `true` when the caret is collapsed,
	 * `false` when a range is selected.
	 *
	 * Callers that want "no selection counts as collapsed" must compare
	 * `isSelectionCollapsed() !== false` rather than checking for truthiness.
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
	 * When the addressed token is a `mark` that has no text surface of its own
	 * (i.e. `node.textElement` is absent), `offset` is interpreted as a binary
	 * boundary selector, not as a character offset:
	 * - `offset <= 0` → start boundary of the token element
	 * - `offset > 0`  → end boundary of the token element
	 */
	placeCaret(target: number | {address: TokenAddress; offset: number}): boolean {
		if (typeof target === 'number') return this.#placeAtRawPosition(target)

		const node = this.#nodeFor(target.address)
		const resolved = this.index().resolveAddress(target.address)
		if (!node || !resolved) return false

		if (resolved.type === 'mark' && !node.textElement) {
			focusIfNeeded(node.tokenElement)
			placeAtChildBoundary(node.tokenElement, target.offset <= 0 ? 'start' : 'end')
			return true
		}

		const surface = node.textElement ?? node.tokenElement
		focusIfNeeded(surface)
		if (node.textElement) placeAtTextOffset(node.textElement, target.offset)
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
	 * Select [start, end]; collapses via placeCaret when equal.
	 * The arguments are order-insensitive — passing (end, start) is equivalent
	 * to passing (start, end); the range is always normalized to [lo, hi] before
	 * being forwarded to the DOM Range API (which would throw on a reversed range).
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
	 * resolved DOM boundary falls outside any indexed token.
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

	/** Sync text surfaces' textContent/contentEditable and mark tabindex. */
	reconcileSurfaces(options: {editable: boolean; readOnly: boolean}): void {
		reconcileTextSurfaces(this.#nodes(), this.index(), options)
	}

	// Note: handle `changed`/`unmounted` watchers run while `#committing` is true;
	// synchronously triggering `host.rendered()` from them throws the re-entry error by design.
	#syncHandles(): void {
		for (const [id, handle] of this.#handles) {
			const node = this.#byId.get(id)
			if (node) {
				// Addresses were rebuilt from the live index in this commit, so
				// node.address.token is the current token for this identity.
				handle.sync(node, node.address.token)
			} else {
				handle.kill()
				this.#handles.delete(id)
			}
		}
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

	#commit(): void {
		if (this.#committing) throw new Error('TokenModel index re-entry')
		const container = this.host.container()
		if (!container) return
		this.#committing = true
		try {
			const tokens = this.current()
			const tokenIndex = this.index()
			const result = buildIndex({
				container,
				tokens,
				addressFor: path => tokenIndex.addressFor(path),
				controlElements: this.#controlElements(),
				childSequenceHostsFor: path => this.#childSequenceHostsFor(path),
				isBlock: this.props.layout.isBlock(),
			})

			this.#byPath = result.byPath
			this.#byElement = result.byElement
			this.#controlRoots = result.controlRoots

			// Rebuild the id → node projection BEFORE handles sync against it.
			const byId = new Map<number, TokenNode>()
			for (const node of result.byPath.values()) {
				byId.set(this.#identity.idOf(node.address.token), node)
			}
			this.#byId = byId

			// Batch so handle `changed` watchers flush only after the version bump —
			// otherwise they would read the previous commit's cached token/address.
			batch(() => {
				this.#syncHandles()
				this.#domVersion(this.#domVersion() + 1)
			})
			this.#hasCommitted = true
			this.indexed()
		} finally {
			this.#committing = false
		}
	}

	/**
	 * Text-path commit: the adapter never ran (structure() kept its reference),
	 * so the previous commit's elements are all still live. Paths are unchanged
	 * by definition of the text path, so the index is refreshed in place — each
	 * node keeps its elements and gets a fresh address from the new token index —
	 * and the changed text surfaces are patched directly.
	 *
	 * Caret note: the browser caret is already correct on this path (the
	 * keystroke happened inside that surface); `indexed` still triggers
	 * SelectionController's #applyRange, which re-places from the range signal
	 * exactly as it does after a full commit — behavior unchanged.
	 */
	#patchCommit(textChanged: readonly number[]): void {
		if (this.#committing) throw new Error('TokenModel index re-entry')
		// Nothing to patch before the adapter has painted: wait for rendered().
		if (!this.host.container() || this.#byPath.size === 0) return
		this.#committing = true
		try {
			const tokenIndex = this.index()

			// Refresh addresses in place: same paths and elements, new tokens.
			const byPath = new Map<string, TokenNode>()
			const byElement = new WeakMap<HTMLElement, TokenNode>()
			for (const [key, previous] of this.#byPath) {
				const address = tokenIndex.addressFor(previous.path)
				if (!address) continue // mirrors buildIndex: unresolvable paths drop out
				const node: TokenNode = {...previous, address}
				byPath.set(key, node)
				indexNodeElements(node, byElement)
			}
			this.#byPath = byPath
			this.#byElement = byElement

			// Rebuild the id → node projection BEFORE handles sync against it.
			const byId = new Map<number, TokenNode>()
			for (const node of byPath.values()) {
				byId.set(this.#identity.idOf(node.address.token), node)
			}
			this.#byId = byId

			// Patch the changed text surfaces — reconcileTextSurfaces' conditional
			// write, scoped to the changed ids (isTextPath guarantees they are all
			// text tokens). contentEditable/tabindex upkeep stays with the full
			// sweep, which SelectionController still runs on `indexed`.
			for (const id of textChanged) {
				const node = byId.get(id)
				if (!node?.textElement) continue
				const content = node.address.token.content
				if (node.textElement.textContent !== content) node.textElement.textContent = content
			}

			// Same tail as #commit: sync handles after the version bump, then notify.
			batch(() => {
				this.#syncHandles()
				this.#domVersion(this.#domVersion() + 1)
			})
			this.indexed()
		} finally {
			this.#committing = false
		}
	}
}

function filterEmptyText(tokens: Token[]): Token[] {
	return tokens.filter(token => {
		if (token.type !== 'text') return true
		return token.position.start !== token.position.end
	})
}