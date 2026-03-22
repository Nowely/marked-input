/**
 * Constants for ParserV2 - modern markup parser with nesting support
 *
 * This module contains the placeholder constants used by ParserV2.
 * Unlike the legacy Parser, ParserV2 supports:
 * - `__value__` - main content (replaces `__label__`)
 * - `__meta__` - metadata (replaces `__value__`)
 * - `__children__` - nested content (new feature)
 *
 * For legacy Parser compatibility, see ../Parser/constants.ts
 * For Markup types, see ./types.ts
 */
export const PLACEHOLDER = {
	Value: '__value__',
	Meta: '__meta__',
	Children: '__children__',
} as const

/**
 * Gap types used in markup descriptors
 * Represents the content type in gaps between segments
 */
export const GAP_TYPE = {
	Value: 'value',
	Meta: 'meta',
	Children: 'children',
} as const

export type GapType = (typeof GAP_TYPE)[keyof typeof GAP_TYPE]