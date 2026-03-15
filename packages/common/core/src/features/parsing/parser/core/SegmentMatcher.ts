import {escape} from '../../../../shared/escape'

/**
 * Result of a segment match in the text
 */
export interface SegmentMatch {
	/** Index in the patterns array */
	index: number
	/** Start position in text */
	start: number
	/** End position in text (exclusive) */
	end: number
	/** Matched text */
	value: string
	/** Captured content from dynamic pattern (if any) */
	captured?: string
}

/**
 * Segment definition - can be a static string or a dynamic pattern
 * For dynamic patterns: [before, after, exclusions]
 */
export type SegmentDefinition = string | readonly [before: string, after: string, exclusions: string]

/**
 * Internal representation of a segment with its regex pattern
 */
interface SegmentEntry {
	/** Original index in the segments array */
	index: number
	/** Regex pattern for this segment (escaped static or dynamic pattern) */
	pattern: string
	/** Original definition for reference */
	definition: SegmentDefinition
}

/**
 * Computes regex pattern for dynamic segment using pre-computed exclusions
 */
function computeDynamicPattern(before: string, after: string, exclusions: string): string {
	const escapedBefore = escape(before)
	const escapedAfter = escape(after)
	const escapedDelimiters = escape(after + exclusions)

	// Non-greedy quantifier to stop at first occurrence of after
	return `${escapedBefore}([^${escapedDelimiters}]+?)${escapedAfter}`
}

interface StaticMatcher {
	regex: RegExp
	toIndex: Map<string, number>
}

interface DynamicMatcher {
	regex: RegExp
	entries: SegmentEntry[]
	indices: Set<number>
}

/**
 * Segment matcher using dual strategy for optimal performance
 */
export class SegmentMatcher {
	private static?: StaticMatcher
	private dynamic?: DynamicMatcher

	constructor(segments: SegmentDefinition[]) {
		this.initializeDual(segments)
	}

	private initializeDual(segments: SegmentDefinition[]) {
		const statics: string[] = []
		const dynamics: Array<{segment: SegmentDefinition; index: number}> = []
		const staticToIndex = new Map<string, number>()

		// Separate segments and build static index map
		segments.forEach((segment, index) => {
			if (typeof segment === 'string') {
				statics.push(segment)
				staticToIndex.set(segment, index)
			} else {
				dynamics.push({segment, index})
			}
		})

		// Create static matcher
		if (statics.length > 0) {
			const sorted = [...statics].toSorted((a, b) => b.length - a.length)
			const escaped = sorted.map(escape)
			this.static = {
				regex: new RegExp(`(?:${escaped.join('|')})`, 'gu'),
				toIndex: staticToIndex,
			}
		}

		// Create dynamic matcher
		if (dynamics.length > 0) {
			const indices = new Set<number>()
			const entries: SegmentEntry[] = []

			dynamics.forEach(({segment, index}) => {
				const [before, after, exclusions] = segment as readonly [string, string, string]
				indices.add(index)
				const pattern = computeDynamicPattern(before, after, exclusions)
				const namedPattern = pattern.replace('(', `(?<content${index}>`)
				entries.push({index, pattern: namedPattern, definition: segment})
			})

			// Sort by pattern length (longest first) for optimal matching
			entries.sort((a, b) => {
				const aLen = typeof a.definition === 'string' ? a.definition.length : a.pattern.length
				const bLen = typeof b.definition === 'string' ? b.definition.length : b.pattern.length
				return bLen - aLen
			})

			this.dynamic = {
				entries,
				indices,
				regex: new RegExp(entries.map((e, i) => `(?<seg${i}>${e.pattern})`).join('|'), 'gu'),
			}
		}
	}

	search(text: string): SegmentMatch[] {
		const results: SegmentMatch[] = []
		const dynamicResults: SegmentMatch[] = []

		// Static segments
		if (this.static) {
			const {regex, toIndex} = this.static
			for (const match of text.matchAll(regex)) {
				const index = toIndex.get(match[0])
				if (index !== undefined) {
					results.push({
						index,
						start: match.index!,
						end: match.index! + match[0].length,
						value: match[0],
					})
				}
			}
		}

		// Dynamic segments
		if (this.dynamic) {
			const {regex, entries, indices} = this.dynamic
			for (const match of text.matchAll(regex)) {
				const matchedText = match[0]
				const start = match.index!

				let matchedIndex: number | undefined
				let captured: string | undefined

				if (match.groups) {
					for (let i = 0; i < entries.length; i++) {
						const groupValue = match.groups[`seg${i}`]
						if (groupValue !== undefined) {
							matchedIndex = entries[i].index
							if (indices.has(matchedIndex)) {
								captured = match.groups[`content${matchedIndex}`]
							}
							break
						}
					}
				}

				if (matchedIndex !== undefined) {
					dynamicResults.push({
						index: matchedIndex,
						start,
						end: start + matchedText.length,
						value: matchedText,
						captured,
					})
				}
			}
		}

		// Filter overlapping static matches and merge
		const finalResults = [...dynamicResults]
		for (const staticMatch of results) {
			const overlaps = dynamicResults.some(
				dynamic => staticMatch.start < dynamic.end && staticMatch.end > dynamic.start
			)
			if (!overlaps) {
				finalResults.push(staticMatch)
			}
		}

		finalResults.sort((a, b) => a.start - b.start)
		return finalResults
	}
}