import {JoinParameters} from '../types'
import {annotate, isAnnotated} from 'rc-marked-input/utils'

export function joinSimple({pieces, markups}: JoinParameters) {
	let result = ''
	for (let value of pieces) {
		result += isAnnotated(value)
			? annotate(markups[value.optionIndex], value.label, value.value)
			: value
	}
	return result
}