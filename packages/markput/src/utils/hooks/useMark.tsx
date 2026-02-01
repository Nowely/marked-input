import type {RefObject} from 'react'
import {useEffect, useRef, useState} from 'react'
import type {MarkToken, Store, Token} from '@markput/core'
import {SystemEvent} from '@markput/core'
import {useToken} from '../providers/TokenProvider'
import {useStore} from './useStore'

interface MarkStruct {
	label: string
	value?: string
}

export interface MarkHandler<T> extends MarkStruct {
	/**
	 * MarkStruct ref. Used for focusing and key handling operations.
	 */
	ref: RefObject<T>
	/**
	 * Change mark.
	 * @param {Object} options - The options object
	 * @param {boolean} options.silent - If true, doesn't change itself label and value, only pass change event.
	 */
	change: (props: MarkStruct, options?: {silent: boolean}) => void
	/**
	 * Remove itself.
	 */
	remove: () => void
	/**
	 * Passed the readOnly prop value
	 */
	readOnly?: boolean
	/**
	 * Meta value of the mark
	 */
	meta?: string
	/**
	 * Nesting depth of this mark (0 for root-level marks).
	 * Computed lazily on access.
	 */
	readonly depth: number
	/**
	 * Whether this mark has nested children
	 */
	readonly hasChildren: boolean
	/**
	 * Parent mark token (undefined for root-level marks).
	 * Computed lazily on access.
	 */
	readonly parent: MarkToken | undefined
	/**
	 * Array of child tokens (read-only)
	 */
	readonly tokens: Token[]
}

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

	const [mark] = useState(() => new MarkHandlerP<T>({ref, store, options, token}))

	useUncontrolledInit(ref, options, token)

	//Sync for state
	const readOnly = useStore(state => state.props.readOnly)
	useEffect(() => {
		mark.readOnly = readOnly
	}, [readOnly])

	return mark
}

type MarkHandlerPConstruct<T> = {ref: RefObject<T>; options: MarkOptions; store: Store; token: MarkToken}

export class MarkHandlerP<T extends HTMLElement = HTMLElement> {
	ref: RefObject<T>
	readonly #store: Store
	readonly #token: MarkToken

	readOnly?: boolean

	get label() {
		return this.#token.content
	}

	set label(value: string) {
		this.#token.content = value
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	constructor(param: MarkHandlerPConstruct<T>) {
		this.ref = param.ref
		this.#store = param.store
		this.#token = param.token
	}

	get value() {
		return this.#token.value
	}

	set value(value: string | undefined) {
		this.#token.value = value ?? ''
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

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

	change = (props: MarkStruct) => {
		this.#token.content = props.label
		this.#token.value = props.value ?? ''
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

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
