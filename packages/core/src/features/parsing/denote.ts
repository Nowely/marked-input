import {isObject} from './isObject'
import {Parser} from './Parser/Parser'
import {MarkMatch, Markup} from '../../types'

/**
 * Transform the annotated text to the another text
 */
export function denote(value: string, callback: (mark: MarkMatch) => string, ...markups: Markup[]): string {
	if (!markups.length) return value
	const pieces = new Parser(markups).split(value)
	return pieces.reduce(
		(previous: string, current) => (previous += isObject(current) ? callback(current) : current),
		''
	)
}
