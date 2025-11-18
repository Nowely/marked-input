import type {RefObject} from 'react'
import {useEffect, useMemo, useRef, useState} from 'react'
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
	 * Nesting depth of this mark (0 for root-level marks)
	 */
	depth: number
	/**
	 * Whether this mark has nested children
	 */
	hasChildren: boolean
	/**
	 * Parent mark token (undefined for root-level marks)
	 */
	parent?: MarkToken
	/**
	 * Array of child tokens (read-only)
	 */
	children: Token[]
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

	// Calculate tree navigation properties
	const depth = useMemo(() => calculateDepth(token, store.tokens), [token, store.tokens])
	const parent = useMemo(() => findParent(token, store.tokens), [token, store.tokens])

	// Extend mark with tree navigation properties
	mark.depth = depth
	mark.hasChildren = token.children.length > 0
	mark.parent = parent
	mark.children = token.children

	return mark
}

/**
 * Calculate the nesting depth of a token in the tree
 * @param token - The token to calculate depth for
 * @param tokens - Root-level tokens array
 * @returns Depth (0 for root-level, 1+ for nested)
 */
function calculateDepth(token: MarkToken, tokens: Token[]): number {
	let depth = 0
	const visited = new Set<Token>()

	function findDepthRecursive(currentTokens: Token[], currentDepth: number): boolean {
		for (const t of currentTokens) {
			if (visited.has(t)) continue
			visited.add(t)

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
 * Find the parent MarkToken of a given token
 * @param token - The token to find parent for
 * @param tokens - Root-level tokens array
 * @returns Parent MarkToken or undefined if at root level
 */
function findParent(token: MarkToken, tokens: Token[]): MarkToken | undefined {
	let parent: MarkToken | undefined
	const visited = new Set<Token>()

	function findParentRecursive(currentTokens: Token[], currentParent?: MarkToken): boolean {
		for (const t of currentTokens) {
			if (visited.has(t)) continue
			visited.add(t)

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

type MarkHandlerPConstruct<T> = {ref: RefObject<T>; options: MarkOptions; store: Store; token: MarkToken}

export class MarkHandlerP<T extends HTMLElement = HTMLElement> {
	ref: RefObject<T>
	readonly #store: Store
	readonly #token: MarkToken

	readOnly?: boolean

	// Tree navigation properties (set by useMark hook)
	depth: number = 0
	hasChildren: boolean = false
	parent?: MarkToken
	children: Token[] = []

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

	change = (props: MarkStruct) => {
		this.#token.content = props.label
		this.#token.value = props.value ?? ''
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	remove = () => this.#store.bus.send(SystemEvent.Delete, {token: this.#token})
}

function useUncontrolledInit(ref: RefObject<HTMLElement>, options: MarkOptions, token: MarkToken) {
	useEffect(() => {
		if (ref.current && !options.controlled) ref.current.textContent = token.content
	}, [])
}
