import {PLACEHOLDER} from './constants'
import {MarkupDescriptor} from './core/MarkupDescriptor'

export type Token = TextToken | MarkToken

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
	position: {
		start: number
		end: number
	}
	descriptor: MarkupDescriptor
	value: string
	meta?: string
	nested?: {
		content: string
		start: number
		end: number
	}
	children: Token[]
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
	/** Value text extracted from match */
	value: string
	/** Start position of value in original text (inclusive) */
	valueStart: number
	/** End position of value in original text (exclusive) */
	valueEnd: number
	/** Nested content text extracted from match (if pattern uses __nested__) */
	nested?: string
	/** Start position of nested content in original text (inclusive) */
	nestedStart?: number
	/** End position of nested content in original text (exclusive) */
	nestedEnd?: number
	/** Meta text extracted from match (if present) */
	meta?: string
	/** Start position of meta in original text (inclusive) */
	metaStart?: number
	/** End position of meta in original text (exclusive) */
	metaEnd?: number
	/** Markup descriptor that matched */
	descriptor: MarkupDescriptor
}

/**
 * Template literal types for markup placeholders
 */
export type ValueMarkup = `${string}${typeof PLACEHOLDER.Value}${string}`
export type MetaMarkup = `${string}${typeof PLACEHOLDER.Meta}${string}`
export type NestedMarkup = `${string}${typeof PLACEHOLDER.Nested}${string}`

/**
 * Modern Markup type supporting value, meta, and nested placeholders
 *
 * Examples:
 * - "@[__value__]" - simple value
 * - "@[__value__](__meta__)" - value with metadata
 * - "@[__nested__]" - nested content
 * - "@[__value__](__nested__)" - value with nested content
 * - "<__value__ __meta__>__nested__</__value__>" - HTML-like with all features
 */
export type Markup =
	| `${ValueMarkup}`
	| `${ValueMarkup}${MetaMarkup}`
	| `${ValueMarkup}${MetaMarkup}${NestedMarkup}`
	| `${ValueMarkup}${NestedMarkup}`
	| `${ValueMarkup}${NestedMarkup}${MetaMarkup}`
	| `${NestedMarkup}`
	| `${NestedMarkup}${MetaMarkup}`
	| `${NestedMarkup}${MetaMarkup}${ValueMarkup}`
	| `${NestedMarkup}${ValueMarkup}`
	| `${NestedMarkup}${ValueMarkup}${MetaMarkup}`
	| `${MetaMarkup}${ValueMarkup}`
	| `${MetaMarkup}${ValueMarkup}${NestedMarkup}`
	| `${MetaMarkup}${NestedMarkup}`
	| `${MetaMarkup}${NestedMarkup}${ValueMarkup}`
