/**
 * Utility functions for working with regular expressions
 */

/**
 * Escapes special regex characters in a string for use in regex patterns
 * @param str - String to escape
 * @returns Escaped string safe for use in regex
 */
export function escapeRegexChars(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Escapes characters for use in regex character class [...]
 * Only escapes characters that are special inside character classes: \ ^ - ]
 * Also deduplicates characters using Set
 * @param str - String to escape
 * @returns Escaped and deduplicated characters for character class
 */
export function escapeForCharClass(str: string): string {
	return [...new Set(str)].map(ch => ch.replace(/[\\^\-\]]/g, '\\$&')).join('')
}

/**
 * Unescapes a regex string by removing backslash escapes
 * @param str - Escaped regex string
 * @returns Unescaped string
 */
export function unescapeRegexString(str: string): string {
	return str.replace(/\\(.)/g, '$1')
}
