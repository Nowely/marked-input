import type {OverlayMatch} from '../../shared/types'
import type {MarkToken} from '../parsing'

export function createMarkFromOverlay(match: OverlayMatch, value: string, meta?: string): MarkToken {
	return {
		type: 'mark',
		value,
		meta,
		content: '',
		position: {
			start: match.index,
			end: match.index + match.span.length,
		},
		descriptor: {
			markup: match.option.markup!,
			index: 0,
			segments: [],
			gapTypes: [],
			hasNested: false,
			hasTwoValues: false,
			segmentGlobalIndices: [],
		},
		children: [],
		nested: undefined,
	}
}