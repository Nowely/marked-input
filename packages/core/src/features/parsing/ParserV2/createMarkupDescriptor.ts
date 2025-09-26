import {PLACEHOLDER} from '../../../shared/constants'
import {Markup} from '../../../shared/types'

/**
 * Descriptor containing preprocessed information about a markup template.
 * Used for efficient parsing of text containing this markup pattern.
 */
export interface MarkupDescriptor {
	/** Original markup template string (e.g., '@[__label__]' or '<__label__>__value__</__label__>') */
	markup: Markup
	/** Index of this markup in the original markups array */
	index: number
	/** First character of startPattern, used for fast grouping/lookup of descriptors */
	trigger: string
	/** Static text that appears before the first __label__ placeholder */
	startPattern: string
	/** Static text that appears after the last placeholder (can be empty for open-ended markups) */
	endPattern: string
	/** Static text segments between placeholders (max 2 for current architecture) */
	middlePatterns?: [string] | [string, string]
	/** True if this markup template contains a __value__ placeholder */
	hasValue: boolean
	/** True if this markup template contains exactly two __label__ placeholders */
	hasTwoLabels: boolean
}

/**
 * Creates a markup descriptor from a markup template string.
 * Pre-processes the template to extract static patterns for efficient parsing.
 * @param markup - Markup template string (e.g., '@[__label__](__value__)' or '<__label__>__value__</__label__>')
 * @param index - Index of this markup in the markups array
 * @returns MarkupDescriptor with pre-processed static parts
 */
export function createMarkupDescriptor(markup: Markup, index: number): MarkupDescriptor {
	const hasTwoLabels = 2 === getPlaceholderCount(markup, PLACEHOLDER.LABEL, [1, 2])
	const hasValue = 1 === getPlaceholderCount(markup, PLACEHOLDER.VALUE, [0, 1])

	hasValue && validatePlaceholderOrder(markup)

	const parts = parseMarkupStructure(markup)

	return {
		markup,
		index,
		trigger: parts.trigger,
		startPattern: parts.startPattern,
		endPattern: parts.endPattern,
		middlePatterns: parts.middlePatterns,
		hasValue,
		hasTwoLabels,
	}
}

/**
 * Parses markup structure into components (start, middle, end patterns and trigger)
 */
function parseMarkupStructure(markup: string): {
	trigger: string
	startPattern: string
	endPattern: string
	middlePatterns?: [string] | [string, string]
} {
	const splitter = new RegExp(`(${PLACEHOLDER.LABEL}|${PLACEHOLDER.VALUE})`, 'g')
	const parts = markup.split(splitter).filter((part) => part !== PLACEHOLDER.LABEL && part !== PLACEHOLDER.VALUE)

	const startPattern = parts.at(0)
	const middlePatterns = parts.slice(1, -1)
	const endPattern = parts.at(-1) || ''

	if (!startPattern) {
		throw new Error(`Invalid markup format: "${markup}". Markup must start with a prefix before placeholders`)
	}

	return {
		trigger: startPattern.charAt(0),
		startPattern,
		endPattern,
		middlePatterns: middlePatterns.length > 0 ? (middlePatterns as [string] | [string, string]) : undefined,
	}
}

/**
 * Validates the number of occurrences of a placeholder in markup
 * @param markup - The markup string to validate
 * @param placeholder - The placeholder to search for
 * @param allowedCounts - Array of allowed occurrence counts
 * @returns The actual number of occurrences found
 * @throws Error if the count is not in allowedCounts
 */
function getPlaceholderCount(markup: string, placeholder: string, allowedCounts: number[]): number {
	let count = 0
	let position = 0

	while ((position = markup.indexOf(placeholder, position)) !== -1) {
		count++
		position += placeholder.length
	}

	if (!allowedCounts.includes(count)) {
		throw new Error(
			`Invalid markup format: "${markup}". ` +
				`Expected ${allowedCounts.join(' or ')} "${placeholder}" placeholder(s), but found ${count}`
		)
	}

	return count
}

/**
 * Validates that __value__ does not appear before __label__ in markup
 * @param markup - The markup string to validate
 * @throws Error if __value__ appears before __label__
 */
function validatePlaceholderOrder(markup: string): void {
	const valueIndex = markup.indexOf(PLACEHOLDER.VALUE)
	const labelIndex = markup.indexOf(PLACEHOLDER.LABEL)

	if (valueIndex < labelIndex) {
		throw new Error(
			`Invalid markup format: "${markup}". ` +
				`"${PLACEHOLDER.VALUE}" cannot appear before "${PLACEHOLDER.LABEL}"`
		)
	}
}
