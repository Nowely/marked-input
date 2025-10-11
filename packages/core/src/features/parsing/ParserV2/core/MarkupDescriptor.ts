import {PLACEHOLDER} from '../../../../shared/constants'
import {Markup} from '../../../../shared/types'

/**
 * Descriptor for segment-based markup parsing
 * Converts markup templates into arrays of static segments
 */
export interface MarkupDescriptor {
	/** Original markup template string */
	markup: Markup
	/** Index of this markup in the original markups array */
	index: number
	/** First character of first segment, used for fast grouping/lookup */
	trigger: string
	/** Array of static text segments (2-4 segments depending on pattern) */
	segments: string[]
	/** Type of content in each gap between segments */
	gapTypes: Array<'label' | 'value' | 'nested'>
	/** True if this markup contains a __value__ placeholder */
	hasValue: boolean
	/** True if this markup contains a __nested__ placeholder */
	hasNested: boolean
	/** True if this markup contains exactly two __label__ placeholders */
	hasTwoLabels: boolean
	/** True if opening and closing segments are the same (symmetric patterns like **text**) */
	isSymmetric: boolean
}

/**
 * Creates a segment-based markup descriptor from a markup template
 * 
 * Examples:
 * - `#[__label__]` -> segments: ["#[", "]"], gapTypes: ["label"]
 * - `#[__nested__]` -> segments: ["#[", "]"], gapTypes: ["nested"]
 * - `@[__label__](__value__)` -> segments: ["@[", "](", ")"], gapTypes: ["label", "value"]
 * - `@[__nested__](__value__)` -> segments: ["@[", "](", ")"], gapTypes: ["nested", "value"]
 * - `@[__label__](__nested__)` -> segments: ["@[", "](", ")"], gapTypes: ["label", "nested"]
 * - `<__label__>__value__</__label__>` -> segments: ["<", ">", "</", ">"], gapTypes: ["label", "value", "label"]
 * - `<__label__ __value__>__nested__</__label__>` -> segments: ["<", " ", ">", "</", ">"], gapTypes: ["label", "value", "nested", "label"]
 */
export function createMarkupDescriptor(markup: Markup, index: number): MarkupDescriptor {
	const hasTwoLabels = countPlaceholder(markup, PLACEHOLDER.LABEL) === 2
	const hasValue = countPlaceholder(markup, PLACEHOLDER.VALUE) === 1
	const hasNested = countPlaceholder(markup, PLACEHOLDER.NESTED) === 1

	// Validate placeholder counts
	const labelCount = countPlaceholder(markup, PLACEHOLDER.LABEL)
	const valueCount = countPlaceholder(markup, PLACEHOLDER.VALUE)
	const nestedCount = countPlaceholder(markup, PLACEHOLDER.NESTED)

	// Must have at least one content placeholder (__label__ or __nested__)
	if (labelCount === 0 && nestedCount === 0) {
		throw new Error(
			`Invalid markup format: "${markup}". Must have at least one "${PLACEHOLDER.LABEL}" or "${PLACEHOLDER.NESTED}" placeholder`
		)
	}

	if (labelCount < 0 || labelCount > 2) {
		throw new Error(
			`Invalid markup format: "${markup}". Expected 0, 1 or 2 "${PLACEHOLDER.LABEL}" placeholders, but found ${labelCount}`
		)
	}

	if (nestedCount > 1) {
		throw new Error(
			`Invalid markup format: "${markup}". Expected 0 or 1 "${PLACEHOLDER.NESTED}" placeholder, but found ${nestedCount}`
		)
	}

	if (valueCount > 1) {
		throw new Error(
			`Invalid markup format: "${markup}". Expected 0 or 1 "${PLACEHOLDER.VALUE}" placeholder, but found ${valueCount}`
		)
	}

	// Parse segments and gap types
	const { segments, gapTypes } = parseSegmentsAndGaps(markup)

	if (segments.length === 0) {
		throw new Error(`Invalid markup format: "${markup}". Must have at least one static segment`)
	}

	const isSymmetric = segments.length >= 2 && segments[0] === segments[segments.length - 1]

	return {
		markup,
		index,
		trigger: segments[0].charAt(0),
		segments,
		gapTypes,
		hasValue,
		hasNested,
		hasTwoLabels,
		isSymmetric
	}
}

/**
 * Placeholder information extracted from markup
 */
interface PlaceholderInfo {
	type: 'label' | 'value' | 'nested'
	pos: number
	length: number
}

/**
 * Parses markup template into segments and gap types
 */
function parseSegmentsAndGaps(markup: string): {
	segments: string[]
	gapTypes: Array<'label' | 'value' | 'nested'>
} {
	const placeholders = extractPlaceholders(markup)
	const result = buildSegments(markup, placeholders)
	validateParseResult(result)
	return result
}

/**
 * Extracts all placeholders from markup string in order
 */
function extractPlaceholders(markup: string): PlaceholderInfo[] {
	const placeholders: PlaceholderInfo[] = []
	let pos = 0

	while (pos < markup.length) {
		const labelPos = markup.indexOf(PLACEHOLDER.LABEL, pos)
		const valuePos = markup.indexOf(PLACEHOLDER.VALUE, pos)
		const nestedPos = markup.indexOf(PLACEHOLDER.NESTED, pos)

		if (labelPos === -1 && valuePos === -1 && nestedPos === -1) break

		// Find the earliest placeholder
		const positions = [
			{type: 'label' as const, pos: labelPos, length: PLACEHOLDER.LABEL.length},
			{type: 'value' as const, pos: valuePos, length: PLACEHOLDER.VALUE.length},
			{type: 'nested' as const, pos: nestedPos, length: PLACEHOLDER.NESTED.length}
		].filter(p => p.pos !== -1)

		if (positions.length === 0) break

		// Sort by position to get the next placeholder
		positions.sort((a, b) => a.pos - b.pos)
		const next = positions[0]

		placeholders.push({
			type: next.type,
			pos: next.pos,
			length: next.length
		})
		pos = next.pos + next.length
	}

	return placeholders
}

/**
 * Builds segments and gap types from markup and extracted placeholders
 */
function buildSegments(
	markup: string,
	placeholders: PlaceholderInfo[]
): { segments: string[]; gapTypes: Array<'label' | 'value' | 'nested'> } {
	const segments: string[] = []
	const gapTypes: Array<'label' | 'value' | 'nested'> = []
	let currentPos = 0

	// Extract segments between placeholders
	for (const placeholder of placeholders) {
		// Segment before this placeholder
		const segment = markup.substring(currentPos, placeholder.pos)
		if (segment.length > 0) {
			segments.push(segment)
		}

		// This placeholder represents a gap
		gapTypes.push(placeholder.type)

		currentPos = placeholder.pos + placeholder.length
	}

	// Final segment after last placeholder
	const finalSegment = markup.substring(currentPos)
	if (finalSegment.length > 0) {
		segments.push(finalSegment)
	}

	return { segments, gapTypes }
}

/**
 * Validates the result of parsing segments and gaps
 */
function validateParseResult(result: { segments: string[]; gapTypes: Array<'label' | 'value' | 'nested'> }): void {
	if (result.segments.length === 0) {
		throw new Error('Parsed markup must contain at least one segment')
	}

	// Gap types should be one less than segments (except when markup ends with placeholder)
	if (result.gapTypes.length > result.segments.length) {
		throw new Error('Invalid markup structure: more gaps than segments')
	}
}

/**
 * Counts occurrences of a placeholder in markup
 */
function countPlaceholder(markup: string, placeholder: string): number {
	let count = 0
	let position = 0

	while ((position = markup.indexOf(placeholder, position)) !== -1) {
		count++
		position += placeholder.length
	}

	return count
}
