import {MarkMatch} from '../../features/parsing/ParserV1/types'

export function assertAnnotated(value: unknown): asserts value is MarkMatch {
	const condition = value !== null && typeof value === 'object' && 'annotation' in value
	if (!condition) throw new Error('Value is not annotated mark!')
}
