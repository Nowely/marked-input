/**
 * Placeholder tokens recognized by the Parser.
 *
 * - `__value__` - main content of a mark annotation
 * - `__meta__` - secondary metadata of a mark annotation
 * - `__slot__` - nested content slot for marks with children
 *
 * For Markup types, see ./types.ts
 */
export const PLACEHOLDER = {
	Value: '__value__',
	Meta: '__meta__',
	Slot: '__slot__',
} as const

/**
 * Gap types used in markup descriptors
 * Represents the content type in gaps between segments
 */
export const GAP_TYPE = {
	Value: 'value',
	Meta: 'meta',
	Slot: 'slot',
} as const

export type GapType = (typeof GAP_TYPE)[keyof typeof GAP_TYPE]