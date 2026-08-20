import type {GapType} from '../constants'
import {GAP_TYPE, PLACEHOLDER} from '../constants'
import type {Markup} from '../types'
import type {SegmentDefinition} from './SegmentMatcher'

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
	/** True if this markup contains a __slot__ placeholder */
	hasSlot: boolean
	/** True if this markup contains exactly two __value__ placeholders */
	hasTwoValues: boolean
	/**
	 * Gap type the markup ENDS with when its last placeholder has no closing
	 * segment (`'# __slot__'`). Such a gap is unfillable by segments — only an
	 * outer boundary (row end, enclosing slot end, end of input) can close it.
	 * A segment count cannot express this: `'# __slot__'` and `'__slot__\n\n'`
	 * both scan to one segment and one slot gap. Undefined for two-value
	 * patterns, whose trailing placeholder is absorbed into a dynamic segment.
	 */
	trailingGap?: GapType
	/** Global indices of segments in registry segments array (parallel to segments array) */
	segmentGlobalIndices: number[]
}

/**
 * Creates a segment-based markup descriptor from a markup template
 *
 * Examples:
 * - `#[__value__]` -> segments: ["#[", "]"], gapTypes: ["value"]
 * - `#[__slot__]` -> segments: ["#[", "]"], gapTypes: ["slot"]
 * - `@[__value__](__meta__)` -> segments: ["@[", "](", ")"], gapTypes: ["value", "meta"]
 * - `@[__slot__](__meta__)` -> segments: ["@[", "](", ")"], gapTypes: ["slot", "meta"]
 * - `@[__value__](__slot__)` -> segments: ["@[", "](", ")"], gapTypes: ["value", "slot"]
 * - `<__value__>__meta__</__value__>` -> segments: [{pattern: '<([^>]+)>'}, {pattern: '</([^>]+)>'}], gapTypes: ["value", "meta", "value"] (dynamic)
 * - `<__value__ __meta__>__slot__</__value__>` -> segments: [{pattern: '<([^> ]+) '}, " ", {pattern: '>__slot__</([^>]+)>'}], gapTypes: ["value", "meta", "slot", "value"] (dynamic)
 */
export function createMarkupDescriptor(markup: Markup, index: number): MarkupDescriptor {
	const {
		segments: rawSegments,
		gapTypes: rawGapTypes,
		counts,
		valueGapIndices,
		trailingGap,
		leadingGap,
	} = scanMarkupStructure(markup)

	validateMarkup(counts, leadingGap, markup)

	const hasTwoValues = counts.value === 2

	const {segments, gapTypes} = hasTwoValues
		? convertTwoValuePattern(rawSegments, rawGapTypes, valueGapIndices)
		: {segments: rawSegments, gapTypes: rawGapTypes}

	return {
		markup,
		index,
		segments,
		gapTypes,
		hasSlot: counts.slot === 1,
		hasTwoValues,
		trailingGap: hasTwoValues ? undefined : trailingGap,
		segmentGlobalIndices: Array.from({length: segments.length}), // Will be populated by MarkupRegistry
	}
}

/**
 * Maps placeholder types to their text representations
 */
const PLACEHOLDER_TEXT: Record<GapType, string> = {
	[GAP_TYPE.Value]: PLACEHOLDER.Value,
	[GAP_TYPE.Meta]: PLACEHOLDER.Meta,
	[GAP_TYPE.Slot]: PLACEHOLDER.Slot,
} as const

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
		slot: 0,
	}

	// Find all placeholders and sort by position
	const placeholders: Array<{type: GapType; position: number}> = []
	const placeholderTypes = [GAP_TYPE.Value, GAP_TYPE.Meta, GAP_TYPE.Slot] as const

	for (const type of placeholderTypes) {
		const text = PLACEHOLDER_TEXT[type]
		let position = markup.indexOf(text)
		while (position !== -1) {
			placeholders.push({type, position})
			position = markup.indexOf(text, position + text.length)
		}
	}

	placeholders.sort((a, b) => a.position - b.position)

	// Process placeholders in order
	let currentParsePosition = 0
	for (const placeholder of placeholders) {
		const segment = markup.substring(currentParsePosition, placeholder.position)
		if (segment.length > 0) {
			segments.push(segment)
		}

		gapTypes.push(placeholder.type)
		counts[placeholder.type]++

		if (placeholder.type === GAP_TYPE.Value) {
			valueGapIndices.push(gapTypes.length - 1)
		}

		currentParsePosition = placeholder.position + PLACEHOLDER_TEXT[placeholder.type].length
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
		// The markup ends exactly at a placeholder: its last gap has no closing segment
		trailingGap: finalSegment.length === 0 && gapTypes.length > 0 ? gapTypes[gapTypes.length - 1] : undefined,
		// The markup BEGINS with a placeholder: nothing delimits its gap on the left
		leadingGap: placeholders.length > 0 && placeholders[0].position === 0,
	}
}

/**
 * Validates markup placeholder counts and placement
 */
function validateMarkup(counts: Record<GapType, number>, leadingGap: boolean, markup: string): void {
	// The row separator is structural (issue 08): a leading-gap form like '__slot__\n\n'
	// has nothing to delimit it on the left — the backwards chain that used to repair it
	// handed a leading marker the previous row's text, and is gone. Declared invalid
	// instead of silently misparsed.
	if (leadingGap) {
		throw new Error(
			`Invalid markup: "${markup}". A markup must not begin with a placeholder — ` +
				'the row separator is an editor-level setting, not part of any markup'
		)
	}

	const rules = [
		{count: counts.value, max: 2, name: PLACEHOLDER.Value},
		{count: counts.meta, max: 1, name: PLACEHOLDER.Meta},
		{count: counts.slot, max: 1, name: PLACEHOLDER.Slot},
	]

	for (const {count, max, name} of rules) {
		if (count > max) {
			throw new Error(`Invalid markup: "${markup}". Max ${max} "${name}" placeholders, got ${count}`)
		}
	}

	if (counts.value === 0 && counts.slot === 0) {
		throw new Error(
			`Invalid markup: "${markup}". Need at least one "${PLACEHOLDER.Value}" or "${PLACEHOLDER.Slot}"`
		)
	}
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