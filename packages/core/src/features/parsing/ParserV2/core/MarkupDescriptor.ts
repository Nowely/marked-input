import {PLACEHOLDER, GapType, GAP_TYPE} from '../constants'
import {Markup} from '../types'

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
	gapTypes: GapType[]
	/** True if this markup contains a __meta__ placeholder */
	hasMeta: boolean
	/** True if this markup contains a __nested__ placeholder */
	hasNested: boolean
	/** True if this markup contains exactly two __value__ placeholders */
	hasTwoValues: boolean
	/** True if opening and closing segments are the same (symmetric patterns like **text**) */
	isSymmetric: boolean
	/** Global indices of segments in registry segments array (parallel to segments array) */
	segmentGlobalIndices: number[]
}

/**
 * Creates a segment-based markup descriptor from a markup template
 *
 * Examples:
 * - `#[__value__]` -> segments: ["#[", "]"], gapTypes: ["value"]
 * - `#[__nested__]` -> segments: ["#[", "]"], gapTypes: ["nested"]
 * - `@[__value__](__meta__)` -> segments: ["@[", "](", ")"], gapTypes: ["value", "meta"]
 * - `@[__nested__](__meta__)` -> segments: ["@[", "](", ")"], gapTypes: ["nested", "meta"]
 * - `@[__value__](__nested__)` -> segments: ["@[", "](", ")"], gapTypes: ["value", "nested"]
 * - `<__value__>__meta__</__value__>` -> segments: ["<", ">", "</", ">"], gapTypes: ["value", "meta", "value"]
 * - `<__value__ __meta__>__nested__</__value__>` -> segments: ["<", " ", ">", "</", ">"], gapTypes: ["value", "meta", "nested", "value"]
 */
export function createMarkupDescriptor(markup: Markup, index: number): MarkupDescriptor {
	const hasTwoValues = countPlaceholder(markup, PLACEHOLDER.Value) === 2
	const hasMeta = countPlaceholder(markup, PLACEHOLDER.Meta) === 1
	const hasNested = countPlaceholder(markup, PLACEHOLDER.Nested) === 1

	// Validate placeholder counts
	const valueCount = countPlaceholder(markup, PLACEHOLDER.Value)
	const metaCount = countPlaceholder(markup, PLACEHOLDER.Meta)
	const nestedCount = countPlaceholder(markup, PLACEHOLDER.Nested)

	// Must have at least one content placeholder (__value__ or __nested__)
	if (valueCount === 0 && nestedCount === 0) {
		throw new Error(
			`Invalid markup format: "${markup}". Must have at least one "${PLACEHOLDER.Value}" or "${PLACEHOLDER.Nested}" placeholder`
		)
	}

	if (valueCount < 0 || valueCount > 2) {
		throw new Error(
			`Invalid markup format: "${markup}". Expected 0, 1 or 2 "${PLACEHOLDER.Value}" placeholders, but found ${valueCount}`
		)
	}

	if (nestedCount > 1) {
		throw new Error(
			`Invalid markup format: "${markup}". Expected 0 or 1 "${PLACEHOLDER.Nested}" placeholder, but found ${nestedCount}`
		)
	}

	if (metaCount > 1) {
		throw new Error(
			`Invalid markup format: "${markup}". Expected 0 or 1 "${PLACEHOLDER.Meta}" placeholder, but found ${metaCount}`
		)
	}

	// Parse segments and gap types
	const {segments, gapTypes} = parseSegmentsAndGaps(markup)

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
		hasMeta,
		hasNested,
		hasTwoValues,
		isSymmetric,
		segmentGlobalIndices: new Array(segments.length), // Will be populated by MarkupRegistry
	}
}

/**
 * Placeholder information extracted from markup
 */
interface PlaceholderInfo {
	type: GapType
	pos: number
	length: number
}

/**
 * Parses markup template into segments and gap types
 */
function parseSegmentsAndGaps(markup: string): {
	segments: string[]
	gapTypes: GapType[]
} {
	const placeholders = extractPlaceholders(markup)
	const result = buildSegments(markup, placeholders)
	validateParseResult(result)
	return result
}

/**
 * Finds the next placeholder in markup starting from the given position
 * @param markup - The markup string to search in
 * @param startPosition - Position to start searching from
 * @returns Information about the next placeholder, or null if none found
 */
function findNextPlaceholder(markup: string, startPosition: number): PlaceholderInfo | null {
	const valuePos = markup.indexOf(PLACEHOLDER.Value, startPosition)
	const metaPos = markup.indexOf(PLACEHOLDER.Meta, startPosition)
	const nestedPos = markup.indexOf(PLACEHOLDER.Nested, startPosition)

	// Check if any placeholders found
	if (valuePos === -1 && metaPos === -1 && nestedPos === -1) {
		return null
	}

	// Find the earliest placeholder using simple comparisons (no array creation or sorting)
	let minPos = Infinity
	let minType: GapType | null = null
	let minLength = 0

	if (valuePos !== -1 && valuePos < minPos) {
		minPos = valuePos
		minType = GAP_TYPE.Value
		minLength = PLACEHOLDER.Value.length
	}

	if (metaPos !== -1 && metaPos < minPos) {
		minPos = metaPos
		minType = GAP_TYPE.Meta
		minLength = PLACEHOLDER.Meta.length
	}

	if (nestedPos !== -1 && nestedPos < minPos) {
		minPos = nestedPos
		minType = GAP_TYPE.Nested
		minLength = PLACEHOLDER.Nested.length
	}

	if (minType === null) {
		return null
	}

	return {
		type: minType,
		pos: minPos,
		length: minLength,
	}
}

/**
 * Extracts all placeholders from markup string in order
 */
function extractPlaceholders(markup: string): PlaceholderInfo[] {
	const placeholders: PlaceholderInfo[] = []
	let currentParsePosition = 0

	while (currentParsePosition < markup.length) {
		const placeholder = findNextPlaceholder(markup, currentParsePosition)
		if (!placeholder) break

		placeholders.push(placeholder)
		currentParsePosition = placeholder.pos + placeholder.length
	}

	return placeholders
}

/**
 * Builds segments and gap types from markup and extracted placeholders
 */
function buildSegments(
	markup: string,
	placeholders: PlaceholderInfo[]
): {segments: string[]; gapTypes: GapType[]} {
	const segments: string[] = []
	const gapTypes: GapType[] = []
	let currentSegmentPosition = 0

	// Extract segments between placeholders
	for (const placeholder of placeholders) {
		// Segment before this placeholder
		const segment = markup.substring(currentSegmentPosition, placeholder.pos)
		if (segment.length > 0) {
			segments.push(segment)
		}

		// This placeholder represents a gap
		gapTypes.push(placeholder.type)

		currentSegmentPosition = placeholder.pos + placeholder.length
	}

	// Final segment after last placeholder
	const finalSegment = markup.substring(currentSegmentPosition)
	if (finalSegment.length > 0) {
		segments.push(finalSegment)
	}

	return {segments, gapTypes}
}

/**
 * Validates the result of parsing segments and gaps
 */
function validateParseResult(result: {segments: string[]; gapTypes: GapType[]}): void {
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
