import type {TokenAddress, TokenPath} from '../../../shared/editorContracts'
import {batch, computed, event, signal} from '../../../shared/signals/index.js'
import type {Computed, Event, Signal} from '../../../shared/signals/index.js'
import {
	focusIfNeeded,
	getCaretIndex,
	isOnFirstLine,
	isOnLastLine,
	placeAtChildBoundary,
	placeAtTextOffset,
	setAtX,
} from '../caret'
import type {Token} from '../parser/types'
import {textLength} from '../textOffsets'

export type TokenChange =
	| {kind: 'text'; previous: string}
	| {kind: 'moved'; previousAddress: TokenAddress}
	| {kind: 'unmounted'}

/** DOM bindings of a live node — set by bind, cleared on unbind/kill. */
export type ElementBindings = {
	readonly tokenElement: HTMLElement
	readonly textElement?: HTMLElement
	readonly rowElement?: HTMLElement
	readonly childSequenceHost?: HTMLElement
}

/**
 * The live record of one token — the single source of truth for everything
 * currently true about it: the CURRENT parsed token, its tree position, its
 * DOM bindings, and a per-node `dirty` version signal. The class doubles as
 * the public handle face: reactive getters and caret commands read this
 * node's own state and track ONLY this node's `dirty`, so an untouched
 * token's handle cannot recompute during someone else's edit.
 *
 * Lifetime: created when its token enters the tree (keyed by the token's
 * stable identity id), mutated in place by `update`/`bindElements`/`unbind`,
 * killed when the token disappears (stale reads stay safe, commands become
 * no-ops, never resurrected).
 */
export class TokenHandle {
	readonly changed: Event<TokenChange> = event<TokenChange>()

	/** Per-node version — THE fine-grained unit; bumped on every mutation of this node. */
	readonly dirty: Signal<number> = signal({initial: 0})

	readonly #dead: Signal<boolean> = signal({initial: false})
	readonly dead: Computed<boolean> = computed(() => this.#dead())

	#token: Token
	#path: TokenPath
	#tokenElement: HTMLElement | undefined
	#textElement: HTMLElement | undefined
	#rowElement: HTMLElement | undefined
	#childSequenceHost: HTMLElement | undefined

	constructor(
		readonly id: number,
		token: Token,
		path: TokenPath
	) {
		this.#token = token
		this.#path = [...path]
	}

	readonly token: Computed<Token> = computed(() => {
		this.dirty()
		return this.#token
	})

	/** Derived on read: a fresh `{path, token}` per evaluation of this node's state. */
	readonly address: Computed<TokenAddress> = computed(() => {
		this.dirty()
		return {path: [...this.#path], token: this.#token}
	})

	readonly element: Computed<HTMLElement | undefined> = computed(() => {
		this.dirty()
		return this.#tokenElement
	})

	readonly text: Computed<string> = computed(() => this.token().content)

	/** @internal Current DOM bindings; undefined while unbound or dead. */
	node(): ElementBindings | undefined {
		this.dirty()
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
		this.dirty()
		return this.#rowElement ?? this.#textElement ?? this.#tokenElement
	}

	hasTextSurface(): boolean {
		this.dirty()
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

	caretRect(offset: number): DOMRect | undefined {
		this.dirty()
		const surface = this.#textElement
		if (!surface) return undefined
		const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
		let remaining = Math.max(0, offset)
		for (let text = walker.nextNode(); text instanceof Text; text = walker.nextNode()) {
			if (remaining <= text.length) {
				const range = document.createRange()
				range.setStart(text, remaining)
				range.collapse(true)
				return range.getBoundingClientRect()
			}
			remaining -= text.length
		}
		return undefined
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
		this.dirty()
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

	placeCaretAtBoundary(side: 'start' | 'end'): boolean {
		this.dirty()
		const tokenElement = this.#tokenElement
		if (!tokenElement) return false
		if (!this.#textElement) {
			focusIfNeeded(tokenElement)
			placeAtChildBoundary(tokenElement, side)
			return true
		}
		return this.placeCaret(side === 'start' ? 0 : Infinity)
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
	 * @internal Refresh token/path after a reconcile; fires `text`/`moved` and
	 * bumps `dirty`. Batched so `changed` watchers flush only after the bump —
	 * they must read the post-update token/address.
	 */
	update(token: Token, path: TokenPath): void {
		if (this.#dead()) return
		const prevToken = this.#token
		const previousAddress: TokenAddress = {path: this.#path, token: prevToken}
		this.#token = token
		this.#path = [...path]
		batch(() => {
			this.#bumpDirty()
			if (token.content !== prevToken.content) {
				this.changed({kind: 'text', previous: prevToken.content})
			} else if (token.position.start !== prevToken.position.start) {
				this.changed({kind: 'moved', previousAddress})
			}
		})
	}

	/** @internal Set/replace the DOM bindings (structural bind). */
	bindElements(bindings: ElementBindings): void {
		if (this.#dead()) return
		this.#tokenElement = bindings.tokenElement
		this.#textElement = bindings.textElement
		this.#rowElement = bindings.rowElement
		this.#childSequenceHost = bindings.childSequenceHost
		this.#bumpDirty()
	}

	/** @internal Clear the DOM bindings (token unmounted from the DOM). */
	unbind(): void {
		if (this.#dead()) return
		this.#clearElements()
		this.#bumpDirty()
	}

	/**
	 * @internal Token disappeared from the tree: freeze reads, drop the DOM,
	 * fire `unmounted` once. No unlink dance (the old kill re-read computeds to
	 * drop a GLOBAL version dependency): `dirty`/`dead` are per-node signals
	 * sharing this object's lifetime, so a dead handle pins nothing beyond itself.
	 */
	kill(): void {
		if (this.#dead()) return
		this.#clearElements()
		batch(() => {
			this.#dead(true)
			this.#bumpDirty()
			this.changed({kind: 'unmounted'})
		})
	}

	#clearElements(): void {
		this.#tokenElement = undefined
		this.#textElement = undefined
		this.#rowElement = undefined
		this.#childSequenceHost = undefined
	}

	#bumpDirty(): void {
		this.dirty(this.dirty() + 1)
	}
}