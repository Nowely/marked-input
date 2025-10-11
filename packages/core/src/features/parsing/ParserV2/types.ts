import {InnerOption} from '../../default/types'

export type NestedToken =
	| TextToken
	| MarkToken

export interface TextToken {
	type: 'text'
	content: string
	position: {
		start: number
		end: number
	}
}

export interface MarkToken {
	type: 'mark'
	content: string
	children: NestedToken[]
	data: {
		label: string
		value?: string
		optionIndex: number
	}
	position: {
		start: number
		end: number
	}
	/** Nested content information (for debugging) */
	nested?: {
		content: string
		start: number
		end: number
	}
}

/**
 * Result of pattern matching with position tracking
 * 
 * All positions follow standard JavaScript convention:
 * - start positions are inclusive (point to first character)
 * - end positions are exclusive (point to character after last)
 * 
 * This allows direct use with substring(): input.substring(start, end)
 */
export interface MatchResult {
	/** Start position of entire match (inclusive) */
	start: number
	/** End position of entire match (exclusive) */
	end: number
	/** Full matched content */
	content: string
	/** Label text extracted from match */
	label: string
	/** Start position of label in original text (inclusive) */
	labelStart: number
	/** End position of label in original text (exclusive) */
	labelEnd: number
	/** Nested content text extracted from match (if pattern uses __nested__) */
	nested?: string
	/** Start position of nested content in original text (inclusive) */
	nestedStart?: number
	/** End position of nested content in original text (exclusive) */
	nestedEnd?: number
	/** Value text extracted from match (if present) */
	value?: string
	/** Start position of value in original text (inclusive) */
	valueStart?: number
	/** End position of value in original text (exclusive) */
	valueEnd?: number
	/** Index of markup descriptor that matched */
	descriptorIndex: number
}

/**
 * Unique segment match with descriptor info
 */
export interface UniqueMatch {
	start: number
	end: number
	value: string
	descriptors: Array<{ descriptorIndex: number; segmentIndex: number }>
}

