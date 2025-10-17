import {annotate} from './annotate'
import {MarkStruct, MarkMatch, Markup} from '../types'

export const normalizeMark = (mark: MarkMatch, markup: Markup): MarkMatch => {
	if (mark.annotation !== annotate(markup, mark.label, mark.value))
		return {...mark, label: mark.value!, value: mark.label}
	return mark
}
