import {MarkStruct, MarkMatch, Markup} from '../../parsing/ParserV1/types'
import {InnerOption} from '../../../features/default/types'

const isAnnotated = (value: unknown): value is MarkMatch => {
	return value !== null && typeof value === 'object' && 'annotation' in value
}

const annotate = (markup: Markup, label: string, value?: string): string => {
	const annotation = markup.replace('__label__', label)
	return value ? annotation.replace('__value__', value) : annotation
}

export function toString(marks: MarkStruct[], options: InnerOption[]) {
	let result = ''
	for (const mark of marks) {
		result += isAnnotated(mark)
			? annotate(options[(mark as MarkMatch).optionIndex].markup!, mark.label, mark.value)
			: mark.label
	}
	return result
}
