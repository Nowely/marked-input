import type {RefObject} from 'react'
import {useEffect, useRef, useState} from 'react'
import type {MarkToken, Store, Token} from '@markput/core'
import {SystemEvent} from '@markput/core'
import {useToken} from '../providers/TokenProvider'
import {useStore} from './useStore'

export interface MarkOptions {
	/**
	 * @default false
	 */
	controlled?: boolean
}

//TODO subscribe on label/value changing
export const useMark = <T extends HTMLElement = HTMLElement>(options: MarkOptions = {}): MarkHandler<T> => {
	const store = useStore()
	const token = useToken()
	const ref = useRef<HTMLElement>() as unknown as RefObject<T>

	if (token.type !== 'mark') {
		throw new Error('useMark can only be used with mark tokens')
	}

	const [mark] = useState(() => new MarkHandler<T>({ref, store, token}))

	useUncontrolledInit(ref, options, token)

	//Sync for state
	const readOnly = useStore(state => state.props.readOnly)
	useEffect(() => {
		mark.readOnly = readOnly
	}, [readOnly])

	return mark
}

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

	/**
	 * Content/label of the mark (displayed text)
	 */
	get content() {
		return this.#token.content
	}

	set content(value: string) {
		this.#token.content = value
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	/**
	 * Value of the mark (hidden data)
	 */
	get value() {
		return this.#token.value
	}

	set value(value: string | undefined) {
		this.#token.value = value ?? ''
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	/**
	 * Meta value of the mark
	 */
	get meta() {
		return this.#token.meta
	}

	set meta(value: string | undefined) {
		if (value !== undefined) {
			this.#token.meta = value
		} else {
			delete this.#token.meta
		}
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	/**
	 * Nesting depth of this mark (0 for root-level marks).
	 * Computed lazily on access - O(n) traversal.
	 */
	get depth(): number {
		return calculateDepth(this.#token, this.#store.tokens)
	}

	/**
	 * Whether this mark has nested children
	 */
	get hasChildren(): boolean {
		return this.#token.children.length > 0
	}

	/**
	 * Parent mark token (undefined for root-level marks).
	 * Computed lazily on access - O(n) traversal.
	 */
	get parent(): MarkToken | undefined {
		return findParent(this.#token, this.#store.tokens)
	}

	/**
	 * Array of child tokens (read-only)
	 */
	get tokens(): Token[] {
		return this.#token.children
	}

	/**
	 * Change mark content, value, and/or meta at once.
	 */
	change = (props: {content: string; value?: string; meta?: string}) => {
		this.#token.content = props.content
		this.#token.value = props.value ?? ''
		if (props.meta !== undefined) {
			this.#token.meta = props.meta
		}
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	/**
	 * Remove this mark.
	 */
	remove = () => this.#store.bus.send(SystemEvent.Delete, {token: this.#token})
}

/**
 * Calculate the nesting depth of a token in the tree.
 * O(n) traversal - only called when depth is accessed.
 */
function calculateDepth(token: MarkToken, tokens: Token[]): number {
	let depth = 0

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

	findDepthRecursive(tokens, 0)
	return depth
}

/**
 * Find the parent MarkToken of a given token.
 * O(n) traversal - only called when parent is accessed.
 */
function findParent(token: MarkToken, tokens: Token[]): MarkToken | undefined {
	let parent: MarkToken | undefined

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

	findParentRecursive(tokens)
	return parent
}

function useUncontrolledInit(ref: RefObject<HTMLElement>, options: MarkOptions, token: MarkToken) {
	useEffect(() => {
		if (ref.current && !options.controlled) ref.current.textContent = token.content
	}, [])
}
