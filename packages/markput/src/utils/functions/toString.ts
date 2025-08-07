import {InnerOption} from '../../features/default/types'
import {annotate, isAnnotated, MarkStruct} from '@markput/core'

export function toString(marks: MarkStruct[], options: InnerOption[]) {
	let result = ''
	for (const mark of marks) {
		result += isAnnotated(mark) ? annotate(options[mark.optionIndex].markup!, mark.label, mark.value) : mark.label
	}
	return result
}
