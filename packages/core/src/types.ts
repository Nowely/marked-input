import {PLACEHOLDER} from './constants'
import {InnerOption} from './features/default/types'
import {NodeProxy} from './utils/classes/NodeProxy'

//TODO to upper case
export type label = `${string}${PLACEHOLDER.LABEL}${string}`

export type value = `${string}${PLACEHOLDER.VALUE}${string}`
export type Markup = `${label}${value}` | `${label}`

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