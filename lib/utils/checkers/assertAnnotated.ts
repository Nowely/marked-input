import {MarkMatch} from '../../types'

export function assertAnnotated(value: unknown): asserts value is MarkMatch {
	let condition = value !== null && typeof value === 'object' && 'annotation' in value
	if (!condition) throw new Error('Value is not annotated mark!')
}