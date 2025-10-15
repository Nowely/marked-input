import {PLACEHOLDER} from './constants'

/**
 * Legacy markup type definitions for Parser (deprecated)
 * For new code, use ParserV2 types instead
 */
export type label = `${string}${typeof PLACEHOLDER.LABEL}${string}`
export type value = `${string}${typeof PLACEHOLDER.VALUE}${string}`

/**
 * Legacy Markup type - supports only __label__ and __value__ placeholders
 * For new code, use ParserV2 which supports __value__, __meta__, and __nested__
 */
export type Markup =
	| `${label}${value}`
	| `${label}`
	| `${value}${label}`

/**
 * Legacy MarkStruct interface
 */
export interface MarkStruct {
	label: string
	value?: string
}

/**
 * Legacy PieceType for Parser
 */
export type PieceType = string | MarkStruct

/**
 * Legacy MarkMatch interface for Parser
 */
export interface MarkMatch extends MarkStruct {
	annotation: string
	input: string
	index: number
	optionIndex: number
}
