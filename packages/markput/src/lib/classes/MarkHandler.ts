import type {RefObject} from 'react'
import type {MarkToken, Store, Token} from '@markput/core'
import {SystemEvent} from '@markput/core'

export class MarkHandler<T extends HTMLElement = HTMLElement> {
	readonly ref: RefObject<T>
	readonly #store: Store
	readonly #token: MarkToken
	readOnly?: boolean

	constructor(param: {ref: RefObject<T>; store: Store; token: MarkToken}) {
		this.ref = param.ref
		this.#store = param.store
		this.#token = param.token
	}

	// ─── Data Properties ─────────────────────────────────────────────────────────

	/** Displayed text of the mark */
	get content() {
		return this.#token.content
	}

	set content(value: string) {
		this.#token.content = value
		this.#emitChange()
	}

	/** Data value associated with the mark */
	get value() {
		return this.#token.value
	}

	set value(value: string | undefined) {
		this.#token.value = value ?? ''
		this.#emitChange()
	}

	/** Optional metadata for the mark */
	get meta() {
		return this.#token.meta
	}

	set meta(value: string | undefined) {
		this.#token.meta = value
		this.#emitChange()
	}

	// ─── Navigation Properties ───────────────────────────────────────────────────

	/** Nesting depth (0 for root-level marks) */
	get depth(): number {
		return calculateDepth(this.#token, this.#store.tokens)
	}

	/** Whether this mark has nested children */
	get hasChildren(): boolean {
		return this.#token.children.length > 0
	}

	/** Parent mark token (undefined for root-level marks) */
	get parent(): MarkToken | undefined {
		return findParent(this.#token, this.#store.tokens)
	}

	/** Child tokens of this mark */
	get tokens(): Token[] {
		return this.#token.children
	}

	// ─── Mutation Methods ────────────────────────────────────────────────────────

	/** Update multiple properties in a single operation */
	change = (props: {content: string; value?: string; meta?: string}) => {
		this.#token.content = props.content
		this.#token.value = props.value ?? ''
		if (props.meta !== undefined) {
			this.#token.meta = props.meta
		}
		this.#emitChange()
	}

	/** Delete this mark from the editor */
	remove = () => this.#store.bus.send(SystemEvent.Delete, {token: this.#token})

	// ─── Private ─────────────────────────────────────────────────────────────────

	#emitChange(): void {
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function calculateDepth(token: MarkToken, tokens: Token[]): number {
	let depth = 0
	findDepthRecursive(tokens, 0)
	return depth

	function findDepthRecursive(currentTokens: Token[], currentDepth: number): boolean {
		for (const t of currentTokens) {
			if (t === token) {
				depth = currentDepth
				return true
			}

			if (t.type === 'mark' && t.children.length > 0) {
				if (findDepthRecursive(t.children, currentDepth + 1)) {
					return true
				}
			}
		}
		return false
	}
}

function findParent(token: MarkToken, tokens: Token[]): MarkToken | undefined {
	let parent: MarkToken | undefined
	findParentRecursive(tokens)
	return parent
	
	function findParentRecursive(currentTokens: Token[], currentParent?: MarkToken): boolean {
		for (const t of currentTokens) {
			if (t === token) {
				parent = currentParent
				return true
			}

			if (t.type === 'mark' && t.children.length > 0) {
				if (findParentRecursive(t.children, t)) {
					return true
				}
			}
		}
		return false
	}
}
