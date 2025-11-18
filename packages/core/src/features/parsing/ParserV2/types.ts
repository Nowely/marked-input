import type {PLACEHOLDER} from './constants'
import type {MarkupDescriptor} from './core/MarkupDescriptor'

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
 * Position range representing a span in text with start and end positions
 * Used for various positioning needs throughout the parser
 */
export interface PositionRange {
	start: number
	end: number
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
