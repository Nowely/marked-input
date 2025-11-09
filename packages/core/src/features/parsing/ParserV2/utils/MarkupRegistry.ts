import {Markup} from '../types'
import {createMarkupDescriptor, MarkupDescriptor} from '../core/MarkupDescriptor'
import {SegmentDefinition} from './SegmentMatcher'
import {unescapeRegexString} from './regexUtils'

/**
 * Registry for managing markup descriptors
 * Centralizes access to all markup patterns and their descriptors
 */
export class MarkupRegistry {
	readonly markups: Markup[]
	readonly descriptors: MarkupDescriptor[]
	/** Deduplicated list of unique segment definitions (static strings or dynamic patterns) */
	readonly segments: SegmentDefinition[]
	/** Map from segment key to descriptors that use this segment */
	readonly segmentsMap: Map<string, MarkupDescriptor[]>
	/** Map from first segment index to descriptors that start with this segment (for O(1) lookup) */
	readonly firstSegmentIndexMap: Map<number, MarkupDescriptor[]>

	constructor(markups: Markup[]) {
		this.markups = markups
		this.segmentsMap = new Map<string, MarkupDescriptor[]>()
		this.firstSegmentIndexMap = new Map<number, MarkupDescriptor[]>()

		// Temporary storage for building segments array and index mapping
		const segmentsArray: SegmentDefinition[] = []
		const segmentIndexMap = new Map<string, number>()

		// Create descriptors and build all maps in single pass
		this.descriptors = markups.map((markup, index) => {
			const descriptor = createMarkupDescriptor(markup, index)
			const firstSegment = descriptor.segments[0]

			// Build segmentsMap for all segments and collect unique segments with indices
			descriptor.segments.forEach((segment, segmentIndex) => {
				// Get a unique key for this segment (string value or pattern)
				const segmentKey = this.getSegmentKey(segment)

				if (segmentKey.length > 0) {
					// Assign index to segment if not already assigned
					if (!segmentIndexMap.has(segmentKey)) {
						const globalIndex = segmentsArray.length
						segmentsArray.push(segment)
						segmentIndexMap.set(segmentKey, globalIndex)
					}

					// Fill segmentsMap
					const descriptors = this.segmentsMap.get(segmentKey)
					if (descriptors) {
						descriptors.push(descriptor)
					} else {
						this.segmentsMap.set(segmentKey, [descriptor])
					}

					// Set the global index for this segment in descriptor
					const globalIndex = segmentIndexMap.get(segmentKey)!
					descriptor.segmentGlobalIndices[segmentIndex] = globalIndex

					// For dynamic patterns, also register static prefix and suffix as separate segments
					if (typeof segment !== 'string') {
						const staticParts = this.extractStaticParts(segment.pattern)
						staticParts.forEach(staticPart => {
							if (!segmentIndexMap.has(staticPart)) {
								const staticGlobalIndex = segmentsArray.length
								segmentsArray.push(staticPart)
								segmentIndexMap.set(staticPart, staticGlobalIndex)
							}
						})
					}
				}
			})

			// Build firstSegmentIndexMap immediately
			const firstSegmentKey = this.getSegmentKey(firstSegment)
			if (firstSegmentKey.length > 0) {
				const segmentIndex = segmentIndexMap.get(firstSegmentKey)!
				const descriptors = this.firstSegmentIndexMap.get(segmentIndex)
				if (descriptors) {
					descriptors.push(descriptor)
				} else {
					this.firstSegmentIndexMap.set(segmentIndex, [descriptor])
				}
			}

			return descriptor
		})

		// Finalize segments
		this.segments = segmentsArray
	}

	/**
	 * Gets a unique key for a segment definition
	 * For static segments (strings), returns the string itself
	 * For dynamic segments (objects), returns the pattern
	 */
	private getSegmentKey(segment: SegmentDefinition): string {
		return typeof segment === 'string' ? segment : segment.pattern
	}

	/**
	 * Extracts static prefix and suffix from a dynamic pattern
	 *
	 * Dynamic patterns have the form: `escapedPrefix(captureGroup)escapedSuffix`
	 * This method extracts and unescapes the prefix and suffix parts.
	 *
	 * @param pattern - Dynamic regex pattern (e.g., `<([^ ]+?) ` or `</([^>]+?)>`)
	 * @returns Array of unescaped static parts [prefix, suffix] (may be empty if invalid)
	 *
	 * @example
	 * extractStaticParts('<([^ ]+?) ') // => ['<', ' ']
	 * extractStaticParts('</([^>]+?)>') // => ['</', '>']
	 * extractStaticParts('invalid') // => []
	 */
	private extractStaticParts(pattern: string): string[] {
		// Match pattern structure: prefix + (capture group) + suffix
		// Use named groups for clarity
		const match = pattern.match(/^(?<prefix>.+?)\([^)]+\)(?<suffix>.+?)$/)

		// Validate match - return empty array if pattern doesn't match expected structure
		if (!match?.groups) {
			return []
		}

		const {prefix, suffix} = match.groups
		const parts: string[] = []

		// Unescape regex escapes (e.g., '\<' -> '<', '\[' -> '[')
		const unescapedPrefix = unescapeRegexString(prefix)
		const unescapedSuffix = unescapeRegexString(suffix)

		// Only add non-empty parts
		if (unescapedPrefix.length > 0) {
			parts.push(unescapedPrefix)
		}
		if (unescapedSuffix.length > 0) {
			parts.push(unescapedSuffix)
		}

		return parts
	}
}
