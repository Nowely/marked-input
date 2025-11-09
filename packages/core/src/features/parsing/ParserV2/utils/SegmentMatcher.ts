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
	/** Start position of captured content (if any) */
	capturedStart?: number
	/** End position of captured content (if any) */
	capturedEnd?: number
}

/**
 * Segment definition - can be a static string or a dynamic pattern
 * For dynamic patterns, template is used for value substitution, pattern for matching
 */
export type SegmentDefinition =
	| string
	| {
			/** Template with {} placeholder for substitution (e.g., '</{}>') */
			template: string
			/** Regex pattern for matching (e.g., '</([^>]+)>') */
			pattern: string
	  }

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

import {escapeRegexChars} from './regexUtils'

/**
 * Segment matcher using dual strategy for optimal performance
 */
export class SegmentMatcher {
	private staticRegex?: RegExp
	private staticToIndex?: Map<string, number>
	private dynamicRegex?: RegExp
	private dynamicEntries?: SegmentEntry[]
	private dynamicIndices?: Set<number>

	constructor(segments: SegmentDefinition[]) {
		this.initializeDual(segments)
	}

	private initializeDual(segments: SegmentDefinition[]) {
		const statics: string[] = []
		const dynamics: SegmentDefinition[] = []
		const staticToIndex = new Map<string, number>()

		// Separate segments and build static index map
		segments.forEach((segment, index) => {
			if (typeof segment === 'string') {
				statics.push(segment)
				staticToIndex.set(segment, index)
			} else {
				dynamics.push(segment)
			}
		})

		// Create static regex
		if (statics.length > 0) {
			const sorted = [...statics].sort((a, b) => b.length - a.length)
			const escaped = sorted.map(escapeRegexChars)
			this.staticRegex = new RegExp(`(?:${escaped.join('|')})`, 'gu')
			this.staticToIndex = staticToIndex
		}

		// Create dynamic regex
		if (dynamics.length > 0) {
			const dynamicIndices = new Set<number>()
			const entries: SegmentEntry[] = []

			dynamics.forEach((segment) => {
				const index = segments.indexOf(segment)
				if (typeof segment === 'string') {
					entries.push({index, pattern: escapeRegexChars(segment), definition: segment})
				} else {
					dynamicIndices.add(index)
					const pattern = segment.pattern.replace('(', `(?<content${index}>`)
					entries.push({index, pattern, definition: segment})
				}
			})

			// Sort by pattern length (longest first)
			entries.sort((a, b) => {
				const aLen = typeof a.definition === 'string' ? a.definition.length : a.definition.pattern.length
				const bLen = typeof b.definition === 'string' ? b.definition.length : b.definition.pattern.length
				return bLen - aLen
			})

			this.dynamicEntries = entries
			this.dynamicIndices = dynamicIndices
			this.dynamicRegex = new RegExp(entries.map((e, i) => `(?<seg${i}>${e.pattern})`).join('|'), 'gu')
		}
	}

	search(text: string): SegmentMatch[] {
		const results: SegmentMatch[] = []
		const dynamicResults: SegmentMatch[] = []

		// Static segments
		if (this.staticRegex && this.staticToIndex) {
			for (const match of text.matchAll(this.staticRegex)) {
				const index = this.staticToIndex.get(match[0])
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
		if (this.dynamicRegex && this.dynamicEntries && this.dynamicIndices) {
			for (const match of text.matchAll(this.dynamicRegex)) {
				const matchedText = match[0]
				const start = match.index!

				let matchedIndex: number | undefined
				let captured: string | undefined

				if (match.groups) {
					for (let i = 0; i < this.dynamicEntries.length; i++) {
						const groupValue = match.groups[`seg${i}`]
						if (groupValue !== undefined) {
							matchedIndex = this.dynamicEntries[i].index
							if (this.dynamicIndices.has(matchedIndex)) {
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
						capturedStart: captured ? start + matchedText.indexOf(captured) : undefined,
						capturedEnd: captured ? start + matchedText.indexOf(captured) + captured.length : undefined,
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
