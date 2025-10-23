import {MarkStruct, MarkMatch, Markup} from '../../parsing/ParserV1/types'
import {InnerOption} from '../../../features/default/types'
import {annotate} from '../../parsing/ParserV1/utils/annotate'
import {isAnnotated} from '../../parsing/ParserV1/utils/isAnnotated'

export function toString(marks: MarkStruct[], options: InnerOption[]) {
	let result = ''
	for (const mark of marks) {
		result += isAnnotated(mark)
			? annotate(options[(mark as MarkMatch).optionIndex].markup!, mark.label, mark.value)
			: mark.label
	}
	return result
}
