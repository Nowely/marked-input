import type {OverlayMatch} from '../../shared/types'
import type {MarkToken} from '../parsing'

export function createMarkFromOverlay(match: OverlayMatch, value: string, meta?: string): MarkToken {
	const markup = match.option.markup
	if (!markup) throw new Error('createMarkFromOverlay: option.markup is required')
	return {
		type: 'mark',
		value,
		meta,
		content: '',
		position: {
			start: match.range.start,
			end: match.range.end,
		},
		descriptor: {
			markup,
			index: 0,
			segments: [],
			gapTypes: [],
			hasSlot: false,
			hasTwoValues: false,
			segmentGlobalIndices: [],
		},
		children: [],
		slot: undefined,
	}
}