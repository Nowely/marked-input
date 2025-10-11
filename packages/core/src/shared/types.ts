import {InnerOption} from '../features/default/types'
import {NodeProxy} from './classes/NodeProxy'

//TODO to upper case
export type label = `${string}__label__${string}`

export type value = `${string}__value__${string}`

export type nested = `${string}__nested__${string}`

// Markup can be:
// - label only: "@[__label__]"
// - label with value: "@[__label__](__value__)"
// - nested only: "@[__nested__]"
// - nested with value: "@[__nested__](__value__)"
// - label with nested: "@[__label__](__nested__)"
// - two labels (HTML-like): "<__label__>__value__</__label__>"
export type Markup = 
	| `${label}${value}` 
	| `${label}${nested}` 
	| `${label}` 
	| `${nested}${value}` 
	| `${nested}`

/** Piece of marked text: fragment of text or mark definition */
export type PieceType = string | MarkMatch

export interface MarkMatch extends MarkStruct {
	annotation: string
	input: string
	/**
	 * Start position of a overlayMatch
	 */
	index: number
	optionIndex: number
}

export interface MarkStruct {
	label: string
	value?: string
}

export type OverlayMatch = {
	/**
	 * Found value via a overlayMatch
	 */
	value: string
	/**
	 * Triggered value
	 */
	source: string
	/**
	 * Piece of text, in which was a overlayMatch
	 */
	span: string
	/**
	 * Html element, in which was a overlayMatch
	 */
	node: Node
	/**
	 * Start position of a overlayMatch
	 */
	index: number
	/**
	 * OverlayMatch's option
	 */
	option: InnerOption
}

export type Listener<T = any> = (e: T) => void

export interface EventKey<T = undefined> extends Symbol {}

export type Recovery = {
	anchor: NodeProxy
	isNext?: boolean
	caret: number
}

export type OverlayTrigger = Array<'change' | 'selectionChange'> | 'change' | 'selectionChange' | 'none'
