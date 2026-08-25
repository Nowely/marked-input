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
 * A first-class block-mode row, and block layout's top level. `parseRows` carves the skeleton
 * first: each row is recognised at its OWN start, by its kind's opener or by nothing at all, and
 * its body is inline-parsed afterwards.
 *
 * `content`/`position` INCLUDE the trailing separator on every row but the document-final one, so
 * rows keep tiling the value. There is no stored terminator: which rows carry a separator is
 * structural — the pre-order join puts one between every adjacent pair and none after the last.
 *
 * A Row is never an inline child — `Token` stays `TextToken | MarkToken`.
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
	/**
	 * The row's KIND: the compiled markup its opener matched, `undefined` for a paragraph. The
	 * descriptor rather than its index, for `MarkToken.descriptor`'s reason — the projection
	 * re-annotates the row from its markup, and an index alone is not resolvable without a
	 * registry the tree does not have.
	 */
	descriptor?: MarkupDescriptor
	/** The kind's metadata gap, `undefined` when the kind has none. */
	meta?: string
	/**
	 * The row's own editable interior: the body gap for a typed row, the whole row content for a
	 * paragraph. A row's structural bytes — its opener and closing literal — lie outside it, and
	 * no caret may enter them.
	 */
	slot: {content: string; start: number; end: number}
	/**
	 * Inline tokens of the row's SLOT (the same shape `parse()` emits, at absolute positions),
	 * always edged by text tokens. A raw body (`__value__`) is one text token, never re-parsed.
	 */
	children: Token[]
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