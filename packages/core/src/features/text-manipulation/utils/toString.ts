import {MarkStruct, MarkMatch, Markup} from '../../parsing/ParserV1/types'
import {InnerOption} from '../../../features/default/types'
import {annotate} from '../../parsing/ParserV1/utils/annotate'
import {isAnnotated} from '../../parsing/ParserV1/utils/isAnnotated'

/**
 * Converts MarkStruct[] array back to string representation
 * 
 * @deprecated This function works with ParserV1 MarkStruct format.
 * Will be removed in v2.0. Use ParserV2.stringify() instead.
 * 
 * For ParserV2:
 * ```typescript
 * import {Parser} from '@markput/core'
 * const text = Parser.stringify(tokens)
 * ```
 */
export function toString(marks: MarkStruct[], options: InnerOption[]) {
	let result = ''
	for (const mark of marks) {
		result += isAnnotated(mark)
			? annotate(options[(mark as MarkMatch).optionIndex].markup!, mark.label, mark.value)
			: mark.label
	}
	return result
}
