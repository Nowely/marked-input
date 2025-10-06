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
}

// Результат матчинга маркера
export interface MatchResult {
	start: number
	end: number
	content: string
	label: string
	labelStart: number  // Position of label in original text
	labelEnd: number    // Position of label in original text (inclusive)
	value?: string
	valueStart?: number // Position of value in original text
	valueEnd?: number   // Position of value in original text (inclusive)
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

