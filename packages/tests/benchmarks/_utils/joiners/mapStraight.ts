import {isAnnotated} from 'rc-marked-input/utils/checkers/isAnnotated'
import {annotate} from 'rc-marked-input/utils/helpers/annotate'
import {JoinParameters} from '../../types'

export function mapStraight({pieces, markups}: JoinParameters) {
	let result = ''
	for (const value of pieces) {
		result += isAnnotated(value) ? annotate(markups[value.optionIndex], value.label, value.value) : value
	}
	return result
}
