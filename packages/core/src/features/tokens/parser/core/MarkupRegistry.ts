import type {Markup} from '../types'
import {getOrCreate} from '../utils/getOrCreate'
import type {MarkupDescriptor} from './MarkupDescriptor'
import {createMarkupDescriptor} from './MarkupDescriptor'
import type {RowDeclaration} from './RowKind'
import {orderRowKinds, rowSplitOf, splitCellKind} from './RowKind'
import type {SegmentDefinition} from './SegmentMatcher'

/**
 * Registry for managing markup descriptors
 * Centralizes access to all markup patterns and their descriptors
 */
export class MarkupRegistry {
	readonly descriptors: MarkupDescriptor[]
	/** Deduplicated list of unique segment definitions (static strings or dynamic patterns) */
	readonly segments: SegmentDefinition[] = []
	/** Map from first segment index to descriptors that start with this segment (for O(1) lookup) */
	readonly firstSegmentIndexMap: Map<number, MarkupDescriptor[]> = new Map()
	/**
	 * The ROW kinds, in scan order. Compiled by the same compiler as a mark and held on the same
	 * registry — one registry per option set, so a row kind and a mark share the option index a
	 * component is resolved by — but deliberately OUTSIDE `segments` and `descriptors`: a row
	 * literal must never enter the inline alternation. Registering a fence's opener and closer
	 * there was measured to yield zero marks, because the closing literal eats the opening one.
	 */
	readonly rowKinds: MarkupDescriptor[]
	/**
	 * WHICH KINDS CARVE THEIR OWN BODY, and into what: the delimiter, and the compiled kind the
	 * carved rows take. Keyed by the parent's descriptor because that is what the scan holds when it
	 * has matched one.
	 *
	 * The cell kind is compiled ONCE per option index and shared, so two parents splitting into the
	 * same option hand their rows the same descriptor object — adoption pairs rows on descriptor
	 * identity, and a per-parent copy would refuse every pair.
	 */
	readonly rowSplits: Map<MarkupDescriptor, {at: string; as: MarkupDescriptor}> = new Map()

	constructor(markups: (Markup | undefined)[], rows: readonly (RowDeclaration | undefined)[] = []) {
		const segmentIndexMap = new Map<string, number>()
		const rowKinds: MarkupDescriptor[] = []
		// Every row kind BY OPTION INDEX, scanned or not: what a split resolves its `as` through.
		const byOption = new Map<number, MarkupDescriptor>()

		this.descriptors = markups
			.map((markup, index) => {
				if (markup === undefined) {
					// An option declaring `row` with no markup is an ANONYMOUS kind: nothing scans it,
					// and it exists only as the target of some other kind's split.
					if (rows[index]) byOption.set(index, splitCellKind(index))
					return null
				}

				const descriptor = createMarkupDescriptor(markup, index)

				if (rows[index]) {
					rowKinds.push(descriptor)
					byOption.set(index, descriptor)
					return null
				}

				// Process segments and register them
				descriptor.segments.forEach((segment, segmentIndex) => {
					this.processSegment(descriptor, segment, segmentIndex, segmentIndexMap)
				})

				this.addToFirstSegmentIndexMap(descriptor)

				return descriptor
			})
			.filter((descriptor): descriptor is MarkupDescriptor => descriptor !== null)

		this.rowKinds = orderRowKinds(rowKinds)

		// AFTER the pass above, because `as` may name an option that compiles later. A split whose
		// target is not a row kind is dropped rather than guessed at — the props boundary reports it.
		for (const [index, declaration] of rows.entries()) {
			const split = rowSplitOf(declaration)
			const parent = byOption.get(index)
			const as = split && byOption.get(split.as)
			if (!split || !parent || !as || split.at === '') continue
			this.rowSplits.set(parent, {at: split.at, as})
		}
	}

	/**
	 * Adds a descriptor to the firstSegmentIndexMap using its first segment's global index
	 */
	private addToFirstSegmentIndexMap(descriptor: MarkupDescriptor): void {
		const firstSegmentIndex = descriptor.segmentGlobalIndices[0]

		getOrCreate(this.firstSegmentIndexMap, firstSegmentIndex).push(descriptor)
	}

	private processSegment(
		descriptor: MarkupDescriptor,
		segment: SegmentDefinition,
		segmentIndex: number,
		segmentIndexMap: Map<string, number>
	): void {
		const segmentKey = this.getSegmentKey(segment)
		if (!segmentKey) return

		const globalIndex = this.registerSegment(segment, segmentKey, segmentIndexMap)

		descriptor.segmentGlobalIndices[segmentIndex] = globalIndex
	}

	private registerSegment(
		segment: SegmentDefinition,
		segmentKey: string,
		segmentIndexMap: Map<string, number>
	): number {
		const existing = segmentIndexMap.get(segmentKey)
		if (existing !== undefined) return existing
		const globalIndex = this.segments.length
		this.segments.push(segment)
		segmentIndexMap.set(segmentKey, globalIndex)
		return globalIndex
	}

	/**
	 * Gets a unique key for a segment definition
	 * For static segments (strings), returns the string itself if non-empty
	 * For dynamic segments (arrays), returns before|after|exclusions if before or after is non-empty
	 * Returns empty string for segments that should be ignored
	 */
	private getSegmentKey(segment: SegmentDefinition): string {
		if (typeof segment === 'string') {
			return segment
		}
		// For dynamic segments, create a key from before+after+exclusions
		const [before, after, exclusions] = segment
		// Only return a key if there's something to match (before or after is non-empty)
		if (before || after) {
			return `${before}|${after}|${exclusions}`
		}
		return ''
	}
}