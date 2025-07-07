import {MarkStruct, Option} from '../../types'
import {isAnnotated} from '../checkers/isAnnotated'
import {annotate} from './annotate'

export function toString(marks: MarkStruct[], options: Option[]) {
	let result = ''
	for (let mark of marks) {
		result += isAnnotated(mark)
			? annotate(options[mark.optionIndex].markup!, mark.label, mark.value)
			: mark.label
	}
	return result
}