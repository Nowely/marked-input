import {PLACEHOLDER} from '../../../shared/constants'
import {Markup} from '../../../shared/types'
import {BaseMarkupDescriptor} from './types'

/**
 * Descriptor for segment-based markup parsing
 * Converts markup templates into arrays of static segments
 */
export interface MarkupDescriptor extends BaseMarkupDescriptor {
	/** Original markup template string */
	markup: Markup
	/** Index of this markup in the original markups array */
	index: number
	/** First character of first segment, used for fast grouping/lookup */
	trigger: string
	/** Array of static text segments (2-4 segments depending on pattern) */
	segments: string[]
	/** Type of content in each gap between segments */
	gapTypes: Array<'label' | 'value'>
	/** True if this markup contains a __value__ placeholder */
	hasValue: boolean
	/** True if this markup contains exactly two __label__ placeholders */
	hasTwoLabels: boolean
}

/**
 * Creates a segment-based markup descriptor from a markup template
 * 
 * Examples:
 * - `#[__label__]` -> segments: ["#[", "]"], gapTypes: ["label"]
 * - `@[__label__](__value__)` -> segments: ["@[", "](", ")"], gapTypes: ["label", "value"]
 * - `<__label__>__value__</__label__>` -> segments: ["<", ">", "</", ">"], gapTypes: ["label", "value", "label"]
 */
export function createMarkupDescriptor(markup: Markup, index: number): MarkupDescriptor {
	const hasTwoLabels = countPlaceholder(markup, PLACEHOLDER.LABEL) === 2
	const hasValue = countPlaceholder(markup, PLACEHOLDER.VALUE) === 1

	// Validate placeholder counts
	const labelCount = countPlaceholder(markup, PLACEHOLDER.LABEL)
	const valueCount = countPlaceholder(markup, PLACEHOLDER.VALUE)

	if (labelCount < 1 || labelCount > 2) {
		throw new Error(
			`Invalid markup format: "${markup}". Expected 1 or 2 "${PLACEHOLDER.LABEL}" placeholders, but found ${labelCount}`
		)
	}

	if (valueCount > 1) {
		throw new Error(
			`Invalid markup format: "${markup}". Expected 0 or 1 "${PLACEHOLDER.VALUE}" placeholder, but found ${valueCount}`
		)
	}

	if (hasValue && markup.indexOf(PLACEHOLDER.VALUE) < markup.indexOf(PLACEHOLDER.LABEL)) {
		throw new Error(
			`Invalid markup format: "${markup}". "${PLACEHOLDER.VALUE}" cannot appear before "${PLACEHOLDER.LABEL}"`
		)
	}

	// Parse segments and gap types
	const { segments, gapTypes } = parseSegmentsAndGaps(markup)

	if (segments.length === 0) {
		throw new Error(`Invalid markup format: "${markup}". Must have at least one static segment`)
	}

	return {
		markup,
		index,
		trigger: segments[0].charAt(0),
		segments,
		gapTypes,
		hasValue,
		hasTwoLabels
	}
}

/**
 * Parses markup template into segments and gap types
 */
function parseSegmentsAndGaps(markup: string): {
	segments: string[]
	gapTypes: Array<'label' | 'value'>
} {
	const segments: string[] = []
	const gapTypes: Array<'label' | 'value'> = []

	let currentPos = 0
	let lastSegmentEnd = 0

	// Find all placeholders in order
	const placeholders: Array<{ type: 'label' | 'value'; pos: number; length: number }> = []

	let pos = 0
	while (pos < markup.length) {
		const labelPos = markup.indexOf(PLACEHOLDER.LABEL, pos)
		const valuePos = markup.indexOf(PLACEHOLDER.VALUE, pos)

		if (labelPos === -1 && valuePos === -1) break

		if (labelPos !== -1 && (valuePos === -1 || labelPos < valuePos)) {
			placeholders.push({ type: 'label', pos: labelPos, length: PLACEHOLDER.LABEL.length })
			pos = labelPos + PLACEHOLDER.LABEL.length
		} else if (valuePos !== -1) {
			placeholders.push({ type: 'value', pos: valuePos, length: PLACEHOLDER.VALUE.length })
			pos = valuePos + PLACEHOLDER.VALUE.length
		}
	}

	// Extract segments between placeholders
	currentPos = 0
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
