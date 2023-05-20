import {annotate} from 'rc-marked-input/utils/annotate'
import {isAnnotated} from 'rc-marked-input/utils/isAnnotated'
import {JoinParameters} from '../../types'

export function mapStraight({pieces, markups}: JoinParameters) {
	let result = ''
	for (let value of pieces) {
		result += isAnnotated(value)
			? annotate(markups[value.optionIndex], value.label, value.value)
			: value
	}
	return result
}