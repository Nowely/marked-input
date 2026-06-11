import type {TokenAddress} from '../../shared/editorContracts'
import {computed, event, signal} from '../../shared/signals/index.js'
import type {Computed, Event, Signal} from '../../shared/signals/index.js'
import {
	focusIfNeeded,
	getCaretIndex,
	isOnFirstLine,
	isOnLastLine,
	placeAtChildBoundary,
	placeAtTextOffset,
	setAtX,
} from './caret'
import type {TokenNode} from './domTypes'
import type {Token} from './parser/types'
import {textLength} from './textOffsets'

export type TokenChange =
	| {kind: 'text'; previous: string}
	| {kind: 'moved'; previousAddress: TokenAddress}
	| {kind: 'mounted'} // reserved for Phase 3 (not emitted in Phase 1)
	| {kind: 'unmounted'}

/** Internal view of TokenModel state a handle reads through. */
export type HandleHost = {
	/** Reactive read; bumped after every DOM commit. */
	version(): number
	nodeByKey(key: string): TokenNode | undefined
}

/**
 * Live, path-keyed view of one token: reactive getters over the parsed token
 * and its indexed DOM, plus caret commands scoped to it. Created and synced by
 * TokenModel; survives commits while a token exists at its path, then dies
 * (stale reads never throw, commands become no-ops, never resurrected).
 */
export class TokenHandle {
	readonly changed: Event<TokenChange> = event<TokenChange>()

	readonly #dead: Signal<boolean> = signal({initial: false})
	readonly dead: Computed<boolean> = computed(() => this.#dead())

	#lastToken: Token
	#lastAddress: TokenAddress

	readonly token: Computed<Token> = computed(() => {
		this.host.version()
		return this.#lastToken
	})

	readonly address: Computed<TokenAddress> = computed(() => {
		this.host.version()
		return this.#lastAddress
	})

	readonly element: Computed<HTMLElement | undefined> = computed(() => this.#node()?.tokenElement)

	readonly text: Computed<string> = computed(() => this.token().content)

	constructor(
		private readonly key: string,
		private readonly host: HandleHost,
		token: Token,
		address: TokenAddress
	) {
		this.#lastToken = token
		this.#lastAddress = address
	}

	#node(): TokenNode | undefined {
		if (this.#dead()) return undefined
		this.host.version()
		return this.host.nodeByKey(this.key)
	}

	/** Row in block layout, else the text surface / token root. */
	#measureScope(): HTMLElement | undefined {
		const node = this.#node()
		if (!node) return undefined
		return node.rowElement ?? node.textElement ?? node.tokenElement
	}

	hasTextSurface(): boolean {
		return this.#node()?.textElement != null
	}

	textLength(): number {
		const scope = this.#measureScope()
		return scope ? textLength(scope) : 0
	}

	/** Caret offset within this token's scope, or undefined when unmounted. */
	caretIndex(): number | undefined {
		const scope = this.#measureScope()
		return scope ? getCaretIndex(scope) : undefined
	}

	caretRect(offset: number): DOMRect | undefined {
		const node = this.#node()
		const surface = node?.textElement
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

	/** Place a collapsed caret at a character offset (Infinity → end). */
	placeCaret(offset: number): boolean {
		const node = this.#node()
		if (!node) return false
		if (!node.textElement) {
			focusIfNeeded(node.tokenElement)
			placeAtChildBoundary(node.tokenElement, offset <= 0 ? 'start' : 'end')
			return true
		}
		focusIfNeeded(node.textElement)
		const length = textLength(node.textElement)
		placeAtTextOffset(node.textElement, Number.isFinite(offset) ? Math.max(0, Math.min(offset, length)) : length)
		return true
	}

	placeCaretAtBoundary(side: 'start' | 'end'): boolean {
		const node = this.#node()
		if (!node) return false
		if (!node.textElement) {
			focusIfNeeded(node.tokenElement)
			placeAtChildBoundary(node.tokenElement, side)
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

	/** @internal Called by TokenModel after each commit. */
	sync(node: TokenNode, token: Token | undefined): void {
		if (!token) return
		const prevToken = this.#lastToken
		const prevAddress = this.#lastAddress
		this.#lastToken = token
		this.#lastAddress = node.address
		if (token.content !== prevToken.content) {
			this.changed({kind: 'text', previous: prevToken.content})
		} else if (token.position.start !== prevToken.position.start) {
			this.changed({kind: 'moved', previousAddress: prevAddress})
		}
	}

	/** @internal Called by TokenModel when the token disappears. */
	kill(): void {
		if (this.#dead()) return
		this.#dead(true)
		this.changed({kind: 'unmounted'})
	}
}