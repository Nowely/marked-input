import React, {Context, useContext} from 'react'
import {DefaultOptionProps} from '../constants'
import {KeyedPieces, MarkMatch, MarkStruct, Markup, NodeData, Option, Piece,} from '../types'
import {annotate} from './annotate'
import {isAnnotated} from './isAnnotated'
import {Parser} from './Parser'
import {Store} from './Store'

export const assign = Object.assign

//TODO the alternative way to create markup?
//const markup2: any = createMarkup("@[__label__]", "(__value__)")
//const markup3: any = createMarkup("@[hello](world)", "hello", "world")

/**
 * Transform the annotated text to the another text
 */
export function denote(value: string, callback: (mark: MarkMatch) => string, ...markups: Markup[]): string {
	if (!markups.length) return value
	const pieces = new Parser(markups).split(value)
	return pieces.reduce((previous: string, current) => previous += isObject(current) ? callback(current) : current, '')
}

export function toString(values: MarkStruct[], options: Option[]) {
	let result = ''
	for (let value of values) {
		result += isAnnotated(value)
			? annotate(options[value.optionIndex].markup!, value.label, value.value)
			: value.label
	}
	return result
}

//https://stackoverflow.com/a/52171480 cyrb53 generate hash
export const genHash = (str: string, seed = 0) => {
	let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
	for (let i = 0, ch; i < str.length; i++) {
		ch = str.charCodeAt(i)
		h1 = Math.imul(h1 ^ ch, 2654435761)
		h2 = Math.imul(h2 ^ ch, 1597334677)
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
	return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export const genId = () => Math.random().toString(36).substring(2, 9)

export const isObject = (value: unknown): value is object => typeof value === 'object'

export function assertAnnotated(value: unknown): asserts value is MarkMatch {
	let condition = value !== null && typeof value === 'object' && 'annotation' in value
	if (!condition) throw new Error('Value is not annotated mark!')
}

export const isFunction = (value: unknown): value is Function => typeof value === 'function'

export function extractOptions(options?: Option[]): Option[] {
	if (options?.length) return options.map(initOption)

	return [DefaultOptionProps]

	function initOption(props: Option, index: number) {
		return assign({}, DefaultOptionProps, props, {index})
	}
}

const createContext = <T, >(name: string): [() => T, React.Provider<NonNullable<T>>, React.Context<NonNullable<T>>] => {
	const defaultContext = React.createContext<T | undefined>(undefined)
	defaultContext.displayName = name

	const hook = createContextHook(defaultContext)
	const provider = defaultContext.Provider as React.Provider<NonNullable<T>>
	const context = defaultContext as React.Context<NonNullable<T>>

	return [hook, provider, context]


	function createContextHook<T, >(context: Context<T>) {
		return () => {
			const value = useContext(context)

			if (value) return value as NonNullable<T>

			throw new Error(`The context ${context.displayName} didn't found!`)
		}
	}
}

export const [useStore, _, StoreContext] = createContext<Store>('StoreProvider')
export const [useNode, NodeProvider] = createContext<NodeData>('NodeProvider')

export function findSpanKey(span: string, pieces: KeyedPieces) {
	let foundKey
	for (let [key, piece] of pieces) {
		if (piece === span) {
			foundKey = key
			break
		}
	}
	return foundKey
}

export function createNewSpan(span: string, annotation: string, index: number, source: string) {
	return span.slice(0, index) + annotation + span.slice(index + source.length)
}

export function genKey(piece: Piece, cache?: Set<number>) {
	const str = isObject(piece) ? piece.label + piece.value : piece

	let seed = 0, key = genHash(str, seed)
	while (cache?.has(key))
		key = genHash(str, seed++)
	cache?.add(key)
	return key
}

export const isForward = (component?: React.ExoticComponent<any> | React.ComponentType<any>) =>
	component && '$$typeof' in component && component.$$typeof === Symbol.for('react.forward_ref')