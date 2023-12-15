import {FunctionComponent, RefObject} from 'react'
import {MarkedInputProps} from './components/MarkedInput'

import LinkedList from './utils/classes/LinkedList/LinkedList'
import {PLACEHOLDER} from "./constants";
import LinkedListNode from './utils/classes/LinkedList/LinkedListNode'

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
export type Piece = string | MarkMatch

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

export type State = {
	pieces?: LinkedList<NodeData>,
	overlayMatch?: OverlayMatch,
}

export type Payload = {
	node: LinkedListNode<NodeData>,
	value?: MarkStruct
}

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
	prevNodeData?: NodeData
	caretPosition: number
	isPrevPrev?: boolean
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