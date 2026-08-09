import type {DomRef, TokenPath} from '../../../shared/editorContracts'
import {computed, watch} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import type {Host} from '../../state/Host'
import type {PropsModel} from '../../state/PropsModel'
import type {ValueModel} from '../../state/ValueModel'
import {DomModel} from '../DomModel'
import type {SelectionSnapshot} from '../DomModel'
import {Parser} from '../parser/Parser'
import type {Token} from '../parser/types'
import {createTextToken} from '../parser/utils/createTextToken'
import {createIdentityTracker} from '../tokenIdentity'
import {pathEquals} from '../tokenIndex'
import {createCommitPipeline} from './commit'
import {fromReconcile} from './commitInput'
import type {TokenDelta} from './commitInput'
import {applyEditableState} from './editableState'
import type {TokenHandle} from './TokenHandle'

/**
 * The thin public shell over the live node layer: parses the value, reconciles
 * token identity, and feeds the one commit pipeline. Everything DOM-related —
 * boundary math, selection reads, caret placement — lives in {@link DomModel}
 * and is delegated to here, so consumers keep this single entry point. Owns the
 * `nodes` map the pipeline mutates.
 *
 * Layout: consumer reads → adapter SPI → engine SPI → wiring → internals.
 */
export class TokenModel {
	// ═══ Consumer reads ═══════════════════════════════════════════════════════

	/**
	 * THE consumer read: the latest reconciled tree, always fresh and consistent
	 * with `value.current()` (the parallel: `value.current()` is the string,
	 * `tokens.current()` is its parsed tree). Unlike `renderTree` (the renderer
	 * signal, which keeps its reference across text-path commits), `current()` is
	 * the pipeline's private `latest` — reassigned at the top of every apply, fresh
	 * in the pending window too. The boundary facade and every value-slicing
	 * consumer read it.
	 */
	current(): readonly Token[] {
		return this.#pipeline.current()
	}

	/**
	 * THE model-level detector: fires once per commit, only after the DOM is
	 * consistent, carrying that commit's `{added, removed, updated}` ids (spec
	 * §2.3). Applies folded into one pending structural pass announce ONE merged
	 * delta — a consumer pruning off `removed` cannot miss a wave.
	 */
	get changed(): Event<TokenDelta> {
		return this.#pipeline.changed
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

	/** The live handle for a render-tree token, or undefined (no id / mid-window / dead). */
	handleOf(token: Token | undefined): TokenHandle | undefined {
		return token?.id === undefined ? undefined : this.handle(token.id)
	}

	// ═══ Adapter SPI ══════════════════════════════════════════════════════════

	/** Renderer contract (adapter-only): reference change ⇔ the renderer must run. NOT a consumer data read — use `current()`. */
	get renderTree(): Computed<Token[]> {
		return this.#pipeline.renderTree
	}

	/**
	 * Adapter SPI: the framework key of a render-tree token — its stable identity
	 * id. Every token an adapter renders comes from the reconciled tree, so the id
	 * is always present (bind.ts throws loud otherwise). Arrow property: adapters
	 * pass it around unbound.
	 */
	readonly keyOf = (token: Token): number => {
		if (token.id === undefined) throw new Error('keyOf: token has no id — must come from the reconciled tree')
		return token.id
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

	// ═══ Engine SPI (in-core consumers) ═══════════════════════════════════════

	/**
	 * Internal: the `removed` list of the LAST announcement, derived from the
	 * `changed` payload that superseded it. No production consumer is left — it
	 * survives one phase for the specs that read it and is deleted with §4.6
	 * item 6 in S1.6d. Take the payload instead.
	 */
	readonly removedIds = (): readonly number[] => this.#pipeline.removedIds()

	/** Resolve a DOM node to its handle, 'control' if inside a control root, or undefined if outside the container. */
	handleAt(node: Node): TokenHandle | 'control' | undefined {
		return this.#dom.handleAt(node)
	}

	/** Map a DOM boundary (node, offset) to an absolute document position. */
	boundaryFor(node: Node, offset: number, affinity?: 'before' | 'after'): number | undefined {
		return this.#dom.boundaryFor(node, offset, affinity)
	}

	/** THE selection read: one snapshot of the live window selection (see {@link DomModel.selection}). */
	selection(): SelectionSnapshot | undefined {
		return this.#dom.selection()
	}

	/** Current selection serialized for clipboard use. */
	selectedContent(): {html: string; text: string} | undefined {
		return this.#dom.selectedContent()
	}

	/** Place a collapsed caret at an absolute document position. */
	placeCaret(rawPosition: number): boolean {
		return this.#dom.placeCaret(rawPosition)
	}

	/** Select [start, end]; collapses via placeCaret when equal. */
	selectRange(start: number, end: number): boolean {
		return this.#dom.selectRange(start, end)
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

	// ═══ Wiring ═══════════════════════════════════════════════════════════════

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

	// ─── internals ─────────────────────────────────────────────────────────────

	/**
	 * THE reparse pipeline entry (the spec's watch-callback hint flow). Driven by
	 * the one watch over the `(value, parser, isBlock)` tuple in the constructor:
	 * when any of the three changes, drain the consume-once edit hint, full-parse
	 * the value (inline and block parse are both full parses — the windowed
	 * incrementalParse is deleted; a future pre-split row parser was scoped as
	 * Phase 7 but detached/reverted — see branch phase7-first-class-rows-wip),
	 * filter empty texts in block mode, then reconcile and apply. The hint is a
	 * plain field the `current` write set synchronously, so draining it HERE —
	 * inside an `untracked` watch callback, once per wave by construction — needs
	 * no PURITY argument (the old `#reconciled` computed drained it inside a getter,
	 * leaning on the runtime's once-per-wave guarantee; that dependence is gone).
	 */
	#reparse(value: string, parser: Parser | undefined, isBlock: boolean): void {
		const hint = this.value.takePendingEdit()
		const parsed = parser ? parser.parse(value) : [createTextToken(value)]
		const tokens = isBlock ? filterEmptyText(parsed) : parsed
		this.#pipeline.apply(fromReconcile(this.#identity.reconcile(tokens, hint)))
	}

	readonly #parser: Computed<Parser | undefined> = computed(() => {
		const Mark = this.props.Mark()
		const options = this.props.options()
		const hasMark = Mark != null || options.some(opt => 'Mark' in opt && opt.Mark != null)
		if (!hasMark) return
		const markups = options.map(opt => opt.markup)
		if (!markups.some(Boolean)) return
		return new Parser(markups)
	})

	readonly #identity = createIdentityTracker()

	/** THE live node layer, keyed by stable token id — mutated only through the pipeline. */
	readonly #nodes = new Map<number, TokenHandle>()

	readonly #pipeline = createCommitPipeline({
		container: () => this.host.container(),
		nodes: this.#nodes,
		idFor: token => this.#identity.idFor(token),
		editableState: () => this.#editableState(),
		controlElements: () => this.#controlElements(),
		childSequenceHostsFor: path => this.#childSequenceHostsFor(path),
		isBlock: () => this.props.layout.isBlock(),
	})

	// All DOM-related reads/commands live in DomModel; the public methods above
	// are one-line delegations so consumers keep a single entry point (this
	// class). The deps are private closures over the pipeline: nothing DOM-shaped
	// leaks.
	readonly #dom = new DomModel({
		container: () => this.host.container(),
		tokens: () => this.current(),
		handleOf: token => this.handleOf(token),
		byElement: element => this.#pipeline.byElement(element),
		isControlRoot: element => this.#pipeline.isControlRoot(element),
		boundHandles: () => this.#pipeline.byPath().values(),
	})

	// Ref registries — populated by framework ref callbacks, read by bind.
	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0

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

	/** Last state written by {@link setEditable}; until then derived from props at bind time. */
	#editable: {editable: boolean; readOnly: boolean} | undefined

	#editableState(): {editable: boolean; readOnly: boolean} {
		if (this.#editable) return this.#editable
		const readOnly = this.props.readOnly()
		return {editable: !readOnly, readOnly}
	}
}

type ControlRegistration = {
	readonly ownerPath?: TokenPath
	readonly element: HTMLElement
}

type ChildSequenceRegistration = {
	readonly ownerPath: TokenPath
	readonly element: HTMLElement
}

function filterEmptyText(tokens: Token[]): Token[] {
	return tokens.filter(token => {
		if (token.type !== 'text') return true
		return token.position.start !== token.position.end
	})
}