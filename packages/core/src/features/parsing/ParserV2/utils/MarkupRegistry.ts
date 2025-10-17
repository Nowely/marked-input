import {Markup} from '../types'
import {createMarkupDescriptor, MarkupDescriptor} from '../core/MarkupDescriptor'

/**
 * Registry for managing markup descriptors
 * Centralizes access to all markup patterns and their descriptors
 */
export class MarkupRegistry {
	readonly descriptors: MarkupDescriptor[]
	readonly segments: string[]
	readonly segmentsMap = new Map<string, number[]>()

	constructor(markups: Markup[]) {
		this.descriptors = markups.map((markup, index) => {
			const descriptor = createMarkupDescriptor(markup, index)

			descriptor.segments.forEach(segment => {
				const indexes = this.segmentsMap.get(segment)
				if (indexes) {
					indexes.push(index)
				} else {
					this.segmentsMap.set(segment, [index])
				}
			})

			return descriptor
		})

		this.segments = Array.from(this.segmentsMap.keys())
	}
}
