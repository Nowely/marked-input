import type {Token} from '../parser/types'
import {
	focusIfNeeded,
	getCaretIndex,
	isOnFirstLine,
	isOnLastLine,
	placeAtChildBoundary,
	placeAtTextOffset,
	setAtX,
} from './caret'
import {textLength} from './textOffsets'

/** DOM bindings of a live node — set by bind, cleared on unbind/kill. */
export type ElementBindings = {
	readonly tokenElement: HTMLElement
	readonly textElement?: HTMLElement
	readonly rowElement?: HTMLElement
	readonly childSequenceHost?: HTMLElement
}

/**
 * The live record of one token: the BIND-GENERATION token and its DOM
 * bindings. The class doubles as the public handle face: plain
 * getters (`token()`/`element()`/`alive()`) and caret commands read
 * this node's own fields. No per-node reactivity — the spec's win-4 trade: zero
 * production consumers subscribed to a handle's getters, so signals are pure
 * overhead here (reversible: the getters stay methods, so per-node signals can
 * return behind them additively).
 *
 * `#token` is deliberately NOT "the current parsed token" — it is the generation
 * the DOM is currently SHOWING (spec D9). Only two writers exist, `bind` and the
 * text branch, and the text branch patches the surface in the same `batch`;
 * between a structural apply and its bind nothing writes it at all. Gated in
 * `seam/treePipeline.spec.ts` ("holds the BIND-GENERATION token during the pending
 * window"); the deferral of node-backing to the phase that gains a caller is plan
 * decision D-b.
 *
 * NO POSITIONAL READER IS LEFT (S2.6). The latch survives for two production
 * readers, and neither wants a coordinate: `commit.ts`'s divergence detector
 * (content) and `TokenModel.setEditable` (type). The three that did want one are
 * gone — the numeric DOM walk (`dom/domBoundary.ts`'s `rawPositionFromBoundary`,
 * which added a token's stored start to every local offset) and
 * `keyboard/arrowNav.ts` both address by node anchor now. So `position` on this
 * object is no longer read by anything outside the specs; narrowing `#token` to
 * `{type, content}` is the next worthwhile reduction here, and it is deliberately
 * NOT part of a deletion phase.
 *
 * Lifetime: created when its token enters the tree (keyed by the token's
 * stable identity id), mutated in place by
 * `refresh`/`bindElements`/`unbind`, killed when the token disappears
 * (stale reads stay safe, commands become no-ops, never resurrected).
 */
export class TokenHandle {
	#dead = false

	#token: Token
	#tokenElement: HTMLElement | undefined
	#textElement: HTMLElement | undefined
	#rowElement: HTMLElement | undefined
	#childSequenceHost: HTMLElement | undefined

	constructor(
		readonly id: number,
		token: Token
	) {
		this.#token = token
	}

	/** The handle's current token. A plain read of the backing field. */
	token(): Token {
		return this.#token
	}

	/** Live AND bound: not killed and currently holding a DOM element. The whole validity check a holder of this handle needs. */
	alive(): boolean {
		return !this.#dead && this.#tokenElement != null
	}

	/** The handle's current token root element, or undefined while unbound/dead. */
	element(): HTMLElement | undefined {
		return this.#tokenElement
	}

	/** @internal Current DOM bindings; undefined while unbound or dead. */
	node(): ElementBindings | undefined {
		const tokenElement = this.#tokenElement
		if (!tokenElement) return undefined
		return {
			tokenElement,
			textElement: this.#textElement,
			rowElement: this.#rowElement,
			childSequenceHost: this.#childSequenceHost,
		}
	}

	/** Row in block layout, else the text surface / token root. */
	#measureScope(): HTMLElement | undefined {
		return this.#rowElement ?? this.#textElement ?? this.#tokenElement
	}

	hasTextSurface(): boolean {
		return this.#textElement != null
	}

	textLength(): number {
		const scope = this.#measureScope()
		return scope ? textLength(scope) : 0
	}

	/**
	 * Caret offset within this token's scope, or undefined when unmounted.
	 * Only meaningful while the selection is inside this token's scope — the
	 * underlying helper returns 0 when there is no selection.
	 */
	caretIndex(): number | undefined {
		const scope = this.#measureScope()
		return scope ? getCaretIndex(scope) : undefined
	}

	caretOnFirstLine(): boolean {
		const scope = this.#measureScope()
		return scope ? isOnFirstLine(scope) : true
	}

	caretOnLastLine(): boolean {
		const scope = this.#measureScope()
		return scope ? isOnLastLine(scope) : true
	}

	rect(): DOMRect | undefined {
		return this.#measureScope()?.getBoundingClientRect()
	}

	/**
	 * Place a collapsed caret at a character offset (Infinity → end).
	 * On tokens without a text surface any offset > 0 collapses to the 'end'
	 * child boundary.
	 */
	placeCaret(offset: number): boolean {
		const tokenElement = this.#tokenElement
		if (!tokenElement) return false
		const textElement = this.#textElement
		if (!textElement) {
			focusIfNeeded(tokenElement)
			placeAtChildBoundary(tokenElement, offset <= 0 ? 'start' : 'end')
			return true
		}
		focusIfNeeded(textElement)
		const length = textLength(textElement)
		placeAtTextOffset(textElement, Number.isFinite(offset) ? Math.max(0, Math.min(offset, length)) : length)
		return true
	}

	/** Place caret at viewport x (and optional y) within this token's scope. */
	placeCaretAtX(x: number, y?: number): boolean {
		const scope = this.#measureScope()
		if (!scope) return false
		setAtX(scope, x, y)
		return true
	}

	/** Focus this token's scope element (row in block layout). */
	focus(): boolean {
		const scope = this.#measureScope()
		if (!scope) return false
		focusIfNeeded(scope)
		return true
	}

	/**
	 * @internal Refresh the BIND-GENERATION token: the content and type that describe
	 * what the DOM currently shows (spec D9). Written by the text branch, which patches
	 * the surface in the same batch, and by bind. Between a structural apply and its
	 * bind nothing writes it — the property `commit.ts`'s divergence detector depends
	 * on. Inert on a dead handle.
	 */
	refresh(token: Token): void {
		if (this.#dead) return
		this.#token = token
	}

	/** @internal Set/replace the DOM bindings (structural bind). */
	bindElements(bindings: ElementBindings): void {
		if (this.#dead) return
		this.#tokenElement = bindings.tokenElement
		this.#textElement = bindings.textElement
		this.#rowElement = bindings.rowElement
		this.#childSequenceHost = bindings.childSequenceHost
	}

	/** @internal Clear the DOM bindings (token unmounted from the DOM). */
	unbind(): void {
		if (this.#dead) return
		this.#clearElements()
	}

	/** @internal Drops DOM, marks dead. A dead handle pins nothing; no unlink needed. */
	kill(): void {
		if (this.#dead) return
		this.#clearElements()
		this.#dead = true
	}

	#clearElements(): void {
		this.#tokenElement = undefined
		this.#textElement = undefined
		this.#rowElement = undefined
		this.#childSequenceHost = undefined
	}
}