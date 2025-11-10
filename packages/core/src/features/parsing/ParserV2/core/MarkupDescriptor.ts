import {PLACEHOLDER, GapType, GAP_TYPE} from '../constants'
import {Markup} from '../types'
import {SegmentDefinition} from '../utils/SegmentMatcher'

/**
 * Descriptor for segment-based markup parsing
 * Converts markup templates into arrays of static or dynamic segments
 */
export interface MarkupDescriptor {
	/** Original markup template string */
	markup: Markup
	/** Index of this markup in the original markups array */
	index: number
	/** Array of segment definitions (can be static strings or dynamic patterns) */
	segments: SegmentDefinition[]
	/** Type of content in each gap between segments */
	gapTypes: GapType[]
	/** True if this markup contains a __nested__ placeholder */
	hasNested: boolean
	/** True if this markup contains exactly two __value__ placeholders */
	hasTwoValues: boolean
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
	const {segments: rawSegments, gapTypes: rawGapTypes, counts, valueGapIndices} = scanMarkupStructure(markup)

	validateMarkup(counts, markup)

	const {value: valueCount, nested: nestedCount} = counts
	const hasTwoValues = valueCount === 2
	const hasNested = nestedCount === 1

	let segments: SegmentDefinition[] = rawSegments
	let gapTypes: GapType[] = rawGapTypes

	if (hasTwoValues) {
		const conversion = convertTwoValuePattern(rawSegments, rawGapTypes, valueGapIndices)
		segments = conversion.segments
		gapTypes = conversion.gapTypes
	}

	if (segments.length === 0) {
		throw new Error(`Invalid markup format: "${markup}". Must have at least one static segment`)
	}

	if (gapTypes.length > segments.length) {
		throw new Error('Invalid markup structure: more gaps than segments')
	}

	return {
		markup,
		index,
		segments,
		gapTypes,
		hasNested,
		hasTwoValues,
		segmentGlobalIndices: new Array(segments.length), // Will be populated by MarkupRegistry
	}
}

/**
 * Parses markup template into segments, gap types and placeholder counts
 */
function scanMarkupStructure(markup: string) {
	const segments: string[] = []
	const gapTypes: GapType[] = []
	const valueGapIndices: number[] = []
	const counts: Record<GapType, number> = {
		value: 0,
		meta: 0,
		nested: 0,
	}

	// Find all placeholders at once
	const placeholders = findAllPlaceholders(markup)

	let currentParsePosition = 0

	for (const placeholder of placeholders) {
		const segment = markup.substring(currentParsePosition, placeholder.position)
		if (segment.length > 0) {
			segments.push(segment)
		}

		gapTypes.push(placeholder.type)

		switch (placeholder.type) {
			case GAP_TYPE.Value:
				valueGapIndices.push(gapTypes.length - 1)
				counts.value++
				break
			case GAP_TYPE.Meta:
				counts.meta++
				break
			case GAP_TYPE.Nested:
				counts.nested++
				break
		}

		currentParsePosition = placeholder.position + getPlaceholderText(placeholder.type).length
	}

	const finalSegment = markup.substring(currentParsePosition)
	if (finalSegment.length > 0) {
		segments.push(finalSegment)
	}

	return {
		segments,
		gapTypes,
		counts,
		valueGapIndices,
	}
}

/**
 * Validates markup placeholder counts
 */
function validateMarkup(counts: Record<GapType, number>, markup: string): void {
	const rules = [
		{count: counts.value, max: 2, name: PLACEHOLDER.Value},
		{count: counts.meta, max: 1, name: PLACEHOLDER.Meta},
		{count: counts.nested, max: 1, name: PLACEHOLDER.Nested},
	]

	for (const {count, max, name} of rules) {
		if (count > max) {
			throw new Error(`Invalid markup: "${markup}". Max ${max} "${name}" placeholders, got ${count}`)
		}
	}

	if (counts.value === 0 && counts.nested === 0) {
		throw new Error(
			`Invalid markup: "${markup}". Need at least one "${PLACEHOLDER.Value}" or "${PLACEHOLDER.Nested}"`
		)
	}
}

/**
 * Placeholder information extracted from markup
 */
interface PlaceholderInfo {
	type: GapType
	position: number
}

/**
 * Gets the text of a placeholder by its type
 */
function getPlaceholderText(type: GapType): string {
	switch (type) {
		case GAP_TYPE.Value:
			return PLACEHOLDER.Value
		case GAP_TYPE.Meta:
			return PLACEHOLDER.Meta
		case GAP_TYPE.Nested:
			return PLACEHOLDER.Nested
		default:
			return '' // Should never happen
	}
}

/**
 * Finds all placeholders in markup, returned in order of appearance
 * @param markup - The markup string to search in
 * @returns Array of placeholder information, sorted by position
 */
function findAllPlaceholders(markup: string): PlaceholderInfo[] {
	const placeholders: PlaceholderInfo[] = []
	const placeholderTypes = [GAP_TYPE.Value, GAP_TYPE.Meta, GAP_TYPE.Nested] as const

	for (const type of placeholderTypes) {
		const text = getPlaceholderText(type)
		let position = markup.indexOf(text)
		while (position !== -1) {
			placeholders.push({
				type,
				position,
			})
			position = markup.indexOf(text, position + text.length)
		}
	}

	// Sort by position to maintain order
	return placeholders.sort((a, b) => a.position - b.position)
}

/**
 * Converts static segments around __value__ placeholders to dynamic patterns
 * For pattern like <__value__>__meta__</__value__>:
 *   - Original: segments ["<", ">", "</", ">"], gapTypes ["value", "meta", "value"]
 *   - Result: segments [['<', '>', exclusions], ['</', '>', exclusions]], gapTypes ["meta"]
 * Dynamic segments "absorb" the __value__ gaps they surround
 */
function convertTwoValuePattern(
	segments: string[],
	gapTypes: GapType[],
	valueGapIndices: number[]
): {segments: SegmentDefinition[]; gapTypes: GapType[]} {
	if (valueGapIndices.length !== 2) {
		return {segments, gapTypes}
	}

	const [firstValueGapIdx, secondValueGapIdx] = valueGapIndices

	const newSegments: SegmentDefinition[] = []

	const beforeFirst = segments[firstValueGapIdx]
	const afterFirst = segments[firstValueGapIdx + 1]
	if (beforeFirst && afterFirst) {
		newSegments.push(createDynamicDefinition(beforeFirst, afterFirst, segments[firstValueGapIdx + 2]))
	}

	for (let i = firstValueGapIdx + 2; i < secondValueGapIdx; i++) {
		newSegments.push(segments[i])
	}

	const beforeSecond = segments[secondValueGapIdx]
	const afterSecond = segments[secondValueGapIdx + 1]
	if (beforeSecond && afterSecond) {
		newSegments.push(createDynamicDefinition(beforeSecond, afterSecond, segments[secondValueGapIdx + 2]))
	}

	const filteredGapTypes = gapTypes.filter(type => type !== GAP_TYPE.Value)

	return {segments: newSegments, gapTypes: filteredGapTypes}
}

/**
 * Creates a dynamic segment definition as [before, after, exclusions]
 * Exclusions are pre-computed for efficient pattern matching
 */
function createDynamicDefinition(
	beforeSegment: string,
	afterSegment: string,
	nextSegment?: string
): [string, string, string] {
	if (!nextSegment) return [beforeSegment, afterSegment, '']

	const firstChar = nextSegment.charAt(0)
	const exclusion =
		firstChar && !afterSegment.includes(firstChar) && !nextSegment.startsWith(beforeSegment) ? firstChar : ''

	return [beforeSegment, afterSegment, exclusion]
}
