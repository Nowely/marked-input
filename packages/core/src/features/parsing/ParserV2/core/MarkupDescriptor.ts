import {PLACEHOLDER, GapType, GAP_TYPE} from '../constants'
import {Markup} from '../types'
import {SegmentDefinition} from '../utils/SegmentMatcher'
import {escapeRegexChars, escapeForCharClass} from '../utils/regexUtils'

/**
 * Gets the string value from a segment definition
 * For static segments returns the string itself, for dynamic segments returns the pattern
 */
function getSegmentValue(segment: SegmentDefinition): string {
	return typeof segment === 'string' ? segment : segment.pattern
}

/**
 * Descriptor for segment-based markup parsing
 * Converts markup templates into arrays of static or dynamic segments
 */
export interface MarkupDescriptor {
	/** Original markup template string */
	markup: Markup
	/** Index of this markup in the original markups array */
	index: number
	/** First character of first segment, used for fast grouping/lookup */
	trigger: string
	/** Array of segment definitions (can be static strings or dynamic patterns) */
	segments: SegmentDefinition[]
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
 * - `<__value__>__meta__</__value__>` -> segments: [{pattern: '<([^>]+)>'}, {pattern: '</([^>]+)>'}], gapTypes: ["value", "meta", "value"] (dynamic)
 * - `<__value__ __meta__>__nested__</__value__>` -> segments: [{pattern: '<([^> ]+) '}, " ", {pattern: '>__nested__</([^>]+)>'}], gapTypes: ["value", "meta", "nested", "value"] (dynamic)
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
	const {segments, gapTypes} = parseSegmentsAndGaps(markup, hasTwoValues)

	if (segments.length === 0) {
		throw new Error(`Invalid markup format: "${markup}". Must have at least one static segment`)
	}

	// For isSymmetric check, compare the actual segment values (extract from SegmentDefinition)
	const firstSegmentValue = getSegmentValue(segments[0])
	const lastSegmentValue = getSegmentValue(segments[segments.length - 1])
	const isSymmetric = segments.length >= 2 && firstSegmentValue === lastSegmentValue

	// For trigger, use first character of first segment
	const trigger = firstSegmentValue.charAt(0)

	return {
		markup,
		index,
		trigger,
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
 * For hasTwoValues patterns, creates dynamic segments around __value__ placeholders
 */
function parseSegmentsAndGaps(
	markup: string,
	hasTwoValues: boolean
): {
	segments: SegmentDefinition[]
	gapTypes: GapType[]
} {
	const placeholders = extractPlaceholders(markup)
	const result = buildSegments(markup, placeholders, hasTwoValues)
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
 * For hasTwoValues patterns, creates dynamic segments around __value__ placeholders
 */
function buildSegments(
	markup: string,
	placeholders: PlaceholderInfo[],
	hasTwoValues: boolean
): {segments: SegmentDefinition[]; gapTypes: GapType[]} {
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

	// Convert to dynamic segments if this is a hasTwoValues pattern
	if (hasTwoValues) {
		return convertToDynamicSegments(segments, gapTypes, placeholders)
	}

	return {segments, gapTypes}
}

/**
 * Converts static segments around __value__ placeholders to dynamic patterns
 * For pattern like <__value__>__meta__</__value__>:
 *   - Original: segments ["<", ">", "</", ">"], gapTypes ["value", "meta", "value"]
 *   - Result: segments [{template: '<{}>', pattern: '<([^>]+)>'}, {template: '</{}>', pattern: '</([^>]+)>'}], gapTypes ["meta"]
 * Dynamic segments "absorb" the __value__ gaps they surround
 */
function convertToDynamicSegments(
	segments: string[],
	gapTypes: GapType[],
	_placeholders: PlaceholderInfo[]
): {segments: SegmentDefinition[]; gapTypes: GapType[]} {
	// Find positions of __value__ gaps
	const valueGapIndices: number[] = []
	gapTypes.forEach((type, idx) => {
		if (type === GAP_TYPE.Value) {
			valueGapIndices.push(idx)
		}
	})

	if (valueGapIndices.length !== 2) {
		// This shouldn't happen as hasTwoValues should be validated earlier
		return {segments, gapTypes}
	}

	const newSegments: SegmentDefinition[] = []
	const newGapTypes: GapType[] = []

	const firstValueGapIdx = valueGapIndices[0]
	const secondValueGapIdx = valueGapIndices[1]

	// Create first dynamic segment
	const beforeFirst = segments[firstValueGapIdx]
	const afterFirst = segments[firstValueGapIdx + 1]
	if (beforeFirst && afterFirst) {
		// Get segments that come after afterFirst to determine exclusions
		const segmentsAfterFirst = segments.slice(firstValueGapIdx + 2)
		newSegments.push(createDynamicSegment(beforeFirst, afterFirst, segmentsAfterFirst))
	}

	// Add middle segments and gaps (between the two value gaps)
	for (let i = firstValueGapIdx + 2; i < secondValueGapIdx; i++) {
		newSegments.push(segments[i])
	}

	// Create second dynamic segment
	const beforeSecond = segments[secondValueGapIdx]
	const afterSecond = segments[secondValueGapIdx + 1]
	if (beforeSecond && afterSecond) {
		// Get segments that come after afterSecond to determine exclusions
		const segmentsAfterSecond = segments.slice(secondValueGapIdx + 2)
		newSegments.push(createDynamicSegment(beforeSecond, afterSecond, segmentsAfterSecond))
	}

	// Filter out value gaps
	gapTypes.forEach(type => {
		if (type !== GAP_TYPE.Value) {
			newGapTypes.push(type)
		}
	})

	return {segments: newSegments, gapTypes: newGapTypes}
}

/**
 * Creates a dynamic segment definition with template and pattern
 * Template is used for value substitution, pattern for regex matching
 *
 * Universal approach - no hardcoded special cases
 * Uses non-greedy matching to handle complex patterns correctly
 * Dynamically determines excluded characters based on other segments in the pattern
 *
 * @param beforeSegment - Segment before the captured content (e.g., '<')
 * @param afterSegment - Segment immediately after the captured content (e.g., '>')
 * @param segmentsAfter - Segments that come after afterSegment in the pattern to determine exclusions
 * @returns Object with template (for substitution) and pattern (for matching)
 *
 * @example
 * createDynamicSegment('</','>', [])
 * // => {template: '</{}>', pattern: '</([^>]+?)>'}
 *
 * createDynamicSegment('<', ' ', ['>'])
 * // => {template: '<{} ', pattern: '<([^ >]+?) '}  // excludes '>' to prevent matching <p>Text
 */
function createDynamicSegment(
	beforeSegment: string,
	afterSegment: string,
	segmentsAfter: string[]
): {template: string; pattern: string} {
	// Template for simple substitution - no escaping needed
	const template = `${beforeSegment}{}${afterSegment}`

	// Pattern for regex matching - with proper escaping
	const escapedBefore = escapeRegexChars(beforeSegment)
	const escapedAfter = escapeRegexChars(afterSegment)

	// Exclude characters from afterSegment
	const escapedDelimiters = escapeForCharClass(afterSegment)

	// Dynamically determine additional exclusions based on segments that come after afterSegment
	// Exclude characters that start segments after afterSegment, but only if they could appear
	// between beforeSegment and afterSegment (i.e., they're not part of a longer segment starting with beforeSegment)
	// For example, if afterSegment is ' ' and there's a segment '>', exclude '>' to prevent matching <p>Text
	const additionalExclusions = new Set<string>()
	for (const segment of segmentsAfter) {
		if (segment.length > 0) {
			const firstChar = segment[0]
			// If this character is not part of afterSegment and the segment doesn't start with beforeSegment,
			// exclude it to prevent incorrect matches
			// This handles cases like '<__value__ __meta__>__nested__</__value__>' where '>' should be excluded
			// from '<([^ ]+?) ' pattern, but not cases like '<__value__>__meta__</__value__>' where
			// '</' segment shouldn't cause '/' to be excluded from '<([^>]+?)>' pattern
			if (!afterSegment.includes(firstChar) && !segment.startsWith(beforeSegment)) {
				additionalExclusions.add(firstChar)
			}
		}
	}

	const additionalExclusionsEscaped = escapeForCharClass(Array.from(additionalExclusions).join(''))

	// Non-greedy quantifier to stop at first occurrence of afterSegment
	const pattern = `${escapedBefore}([^${escapedDelimiters}${additionalExclusionsEscaped}]+?)${escapedAfter}`

	return {template, pattern}
}

/**
 * Validates the result of parsing segments and gaps
 */
function validateParseResult(result: {segments: SegmentDefinition[]; gapTypes: GapType[]}): void {
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
