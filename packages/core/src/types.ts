import {PLACEHOLDER} from './constants'

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