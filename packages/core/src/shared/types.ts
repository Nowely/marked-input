import {CoreOption} from '../features/default/types'
import {NodeProxy} from './classes/NodeProxy'

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
	option: CoreOption
}

export type Listener<T = any> = (e: T) => void

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface EventKey<T = any> extends Symbol {}

export type Recovery = {
	anchor: NodeProxy
	isNext?: boolean
	caret: number
}

export type OverlayTrigger = Array<'change' | 'selectionChange'> | 'change' | 'selectionChange' | 'none'
