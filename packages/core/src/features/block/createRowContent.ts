import type {CoreOption} from '../../shared/types'
import {annotate} from '../tokens'

export function createRowContent(options: CoreOption[]): string {
	const firstOption = options[0]
	if (!firstOption.markup) return '\n'
	return annotate(firstOption.markup, {value: '', slot: '', meta: ''})
}