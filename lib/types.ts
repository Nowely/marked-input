import {FunctionComponent, RefObject} from 'react'
import {MarkedInputProps} from './components/MarkedInput'
import {PLACEHOLDER} from './constants'
import {NodeProxy} from './utils/classes/NodeProxy'


export type NodeData = {
	mark: MarkStruct
	ref: RefObject<HTMLElement>
}

export interface MarkStruct {
	label: string
	value?: string
}

export type label = `${string}${PLACEHOLDER.LABEL}${string}`

export type value = `${string}${PLACEHOLDER.VALUE}${string}`
export type Markup = `${label}${value}` | `${label}`

/** Piece of marked text: fragment of text or mark definition */
export type PieceType = string | MarkMatch

export interface Option<T = Record<string, any>> {
	/**
	 * Template string instead of which the mark is rendered.
	 * Must contain placeholders: `__label__` and optional `__value__`
	 * @default "@[__label__](__value__)"
	 */
	markup?: Markup
	/**
	 * Sequence of symbols for calling the overlay.
	 * @default "@"
	 */
	trigger?: string //| RegExp
	/**
	 * Data for an overlay component. By default, it is suggestions.
	 */
	data?: string[] //TODO | object[]
	/**
	 * Function to initialize props for the mark component. Gets arguments from found markup
	 */
	initMark?: (props: MarkStruct) => T
}

export type ConfiguredMarkedInput<T> = FunctionComponent<MarkedInputProps<T>>

export interface MarkMatch extends MarkStruct {
	annotation: string
	input: string
	/**
	 * Start position of a overlayMatch
	 */
	index: number
	optionIndex: number
}

export type OverlayMatch = {
	/**
	 * Found value via a overlayMatch
	 */
	value: string,
	/**
	 * Triggered value
	 */
	source: string,
	/**
	 * Piece of text, in which was a overlayMatch
	 */
	span: string,
	/**
	 * Html element, in which was a overlayMatch
	 */
	node: Node,
	/**
	 * Start position of a overlayMatch
	 */
	index: number,
	/**
	 * OverlayMatch's option
	 */
	option: Option
}

export type Listener<T = any> = (e: T) => void

export type Recovery = {
	anchor: NodeProxy
	caret: number
}

export interface MarkedInputHandler {
	/**
	 * Container element
	 */
	readonly container: HTMLDivElement | null
	/**
	 * Overlay element if exists
	 */
	readonly overlay: HTMLElement | null

	focus(): void
}

export type OverlayTrigger =
	| Array<'change' | 'selectionChange'>
	| 'change'
	| 'selectionChange'
	| 'none';

export interface EventKey<T> extends Symbol {}

export type DefaultedProps = WithRequired<MarkedInputProps, 'options'>
type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }