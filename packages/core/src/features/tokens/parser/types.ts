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
	/** Stable identity id, stamped by the tree's snapshot (`tree/snapshot.ts`) — NOT by the parser. Absent on freshly parsed trees. */
	id?: number
}

export interface MarkToken {
	type: 'mark'
	content: string
	position: {
		start: number
		end: number
	}
	/** Stable identity id, stamped by the tree's snapshot (`tree/snapshot.ts`) — NOT by the parser. Absent on freshly parsed trees. */
	id?: number
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

/**
 * A first-class block-mode row. `parseRows` splits the document at separator
 * occurrences that lie outside every match extent and wraps each span as a Row;
 * block layout's top level is `RowToken[]`. `content`/`position` INCLUDE the
 * trailing separator when `terminated`, so joining row contents reproduces the
 * value byte-for-byte; `children` are the row's inline tokens (absolute
 * positions, separator excluded). A Row is never an inline child — `Token`
 * stays `TextToken | MarkToken`.
 */
export interface RowToken {
	type: 'row'
	content: string
	position: {
		start: number
		end: number
	}
	/** Stable identity id, stamped by the tree's snapshot (`tree/snapshot.ts`) — NOT by the parser. Absent on freshly parsed trees. */
	id?: number
	/** Inline tokens of the row content (the same shape `parse()` emits), always edged by text tokens. */
	children: Token[]
	/** False only for the document-final row, which no separator terminates. */
	terminated: boolean
}

/**
 * The block parse policy, as one record: everything the row skeleton is carved by. One
 * argument rather than a growing parameter list, and one value the seam can hand around —
 * `TokenModel.rowConfig` is the single place it is derived from props.
 */
export interface RowConfig {
	/** The structural row separator. Never part of any markup (ADR-0009). */
	separator: string
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