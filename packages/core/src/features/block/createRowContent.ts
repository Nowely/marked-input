import type {CoreOption} from '../../shared/types'
import {annotate} from '../tokens'

export function createRowContent(options: CoreOption[]): string {
	// `options[0]` types as non-nullable but is undefined on an empty array, and a block
	// editor configured with `options={[]}` reaches here from add-row and from Enter.
	if (options.length === 0) return '\n'
	const firstOption = options[0]
	if (!firstOption.markup) return '\n'
	return annotate(firstOption.markup, {value: '', slot: '', meta: ''})
}