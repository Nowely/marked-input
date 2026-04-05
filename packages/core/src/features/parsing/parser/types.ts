import type {PLACEHOLDER} from './constants'
import type {MarkupDescriptor} from './core/MarkupDescriptor'

export type Token = TextToken | MarkToken

export function isMarkToken(token: Token): token is MarkToken {
	return token.type === 'mark'
}

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
	slot?: {
		content: string
		start: number
		end: number
	}
	children: Token[]
}

export interface ParseOptions {
	/** Return only MarkTokens, drop all TextTokens */
	marksOnly?: boolean
	/** Drop zero-length TextTokens (where start === end) */
	skipEmptyText?: boolean
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
export type SlotMarkup = `${string}${typeof PLACEHOLDER.Slot}${string}`

/**
 * Modern Markup type supporting value, meta, and slot placeholders
 *
 * Examples:
 * - "@[__value__]" - simple value
 * - "@[__value__](__meta__)" - value with metadata
 * - "@[__slot__]" - nested content
 * - "@[__value__](__slot__)" - value with nested content
 * - "<__value__ __meta__>__slot__</__value__>" - HTML-like with all features
 */
export type Markup =
	| ValueMarkup
	| `${ValueMarkup}${MetaMarkup}`
	| `${ValueMarkup}${MetaMarkup}${SlotMarkup}`
	| `${ValueMarkup}${SlotMarkup}`
	| `${ValueMarkup}${SlotMarkup}${MetaMarkup}`
	| SlotMarkup
	| `${SlotMarkup}${MetaMarkup}`
	| `${SlotMarkup}${MetaMarkup}${ValueMarkup}`
	| `${SlotMarkup}${ValueMarkup}`
	| `${SlotMarkup}${ValueMarkup}${MetaMarkup}`
	| `${MetaMarkup}${ValueMarkup}`
	| `${MetaMarkup}${ValueMarkup}${SlotMarkup}`
	| `${MetaMarkup}${SlotMarkup}`
	| `${MetaMarkup}${SlotMarkup}${ValueMarkup}`