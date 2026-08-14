import type {CoreOption} from '../../shared/types'
import {annotate} from '../tokens'

export function createRowContent(options: CoreOption[]): string {
	// `.at`, not `[]`: `noUncheckedIndexedAccess` is off, so an index read types as
	// non-nullable while a block editor configured with `options={[]}` gets undefined
	// here, from add-row and from Enter.
	const firstOption = options.at(0)
	if (!firstOption?.markup) return '\n'
	return annotate(firstOption.markup, {value: '', slot: '', meta: ''})
}