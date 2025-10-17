import {MarkMatch} from '../../features/parsing/ParserV1/types'

export const isAnnotated = (value: unknown): value is MarkMatch => {
	return value !== null && typeof value === 'object' && 'annotation' in value
}
