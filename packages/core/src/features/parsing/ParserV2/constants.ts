/**
 * Constants for ParserV2 - modern markup parser with nesting support
 *
 * This module contains the placeholder constants used by ParserV2.
 * Unlike the legacy Parser, ParserV2 supports:
 * - `__value__` - main content (replaces `__label__`)
 * - `__meta__` - metadata (replaces `__value__`)
 * - `__nested__` - nested content (new feature)
 *
 * For legacy Parser compatibility, see ../Parser/constants.ts
 * For Markup types, see ./types.ts
 */
export enum PLACEHOLDER {
	VALUE = '__value__',
	META = '__meta__',
	NESTED = '__nested__',
}