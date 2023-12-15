import {MarkStruct, Option} from '../../types'
import {isAnnotated} from '../checkers/isAnnotated'
import {annotate} from './annotate'

export function toString(values: MarkStruct[], options: Option[]) {
	let result = ''
	for (let value of values) {
		result += isAnnotated(value)
			? annotate(options[value.optionIndex].markup!, value.label, value.value)
			: value.label
	}
	return result
}