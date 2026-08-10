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
 * The live record of one node's DOM: its element bindings and the single writer
 * that keeps its text surface in step with the tree. The class doubles as the
 * public handle face: plain getters (`element()`/`alive()`) and caret commands
 * read this handle's own fields. No per-node reactivity on the getters — the
 * spec's win-4 trade: zero production consumers subscribe to them, so signals
 * would be pure overhead (reversible: they stay methods, so per-node signals can
 * return behind them additively).
 *
 * IT HOLDS NO TOKEN (S2.7). `#token` used to carry "the generation the DOM is
 * SHOWING" — a second representation of data the tree already owns. Cut B took its
 * last positional reader, and this phase took the other two: `setEditable`'s type
 * read (dead — bind gives a text surface to text nodes ONLY, so a bound handle's
 * kind is readable off `textElement`) and `commit.ts`'s divergence detector, which
 * now compares the surface against the LIVE `TextNode.text()`.
 *
 * Lifetime: created when its node enters the tree (keyed by the node's stable id),
 * mutated in place by `bindElements`/`unbind`, killed when the node disappears
 * (stale reads stay safe, commands become no-ops, never resurrected).
 */
export class TokenHandle {
	#dead = false

	#tokenElement: HTMLElement | undefined
	#textElement: HTMLElement | undefined
	#rowElement: HTMLElement | undefined
	#childSequenceHost: HTMLElement | undefined

	constructor(readonly id: number) {}

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