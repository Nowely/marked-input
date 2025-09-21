import {MarkStruct} from '../../shared/types'
import {InnerOption} from '../../features/default/types'
import {isAnnotated} from '../../shared/checkers'
import {annotate} from '../../features/parsing/Parser/annotate'

export function toString(marks: MarkStruct[], options: InnerOption[]) {
	let result = ''
	for (const mark of marks) {
		result += isAnnotated(mark) ? annotate(options[mark.optionIndex].markup!, mark.label, mark.value) : mark.label
	}
	return result
}
