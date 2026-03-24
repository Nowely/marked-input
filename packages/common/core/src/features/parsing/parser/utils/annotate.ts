import {PLACEHOLDER} from '../constants'
import type {Markup} from '../types'

/**
 * Make annotation from the markup for ParserV2
 *
 * @param markup - Markup pattern with __value__, __meta__, and/or __slot__ placeholders
 * @param params - Object with optional value, meta, and slot strings
 * @returns Annotated string with placeholders replaced
 *
 * @example
 * ```typescript
 * annotate('@[__value__]', { value: 'Hello' }) // '@[Hello]'
 * annotate('@[__value__](__meta__)', { value: 'Hello', meta: 'world' }) // '@[Hello](world)'
 * annotate('@[__slot__]', { slot: 'content' }) // '@[content]'
 * ```
 */
export function annotate(
	markup: Markup,
	params: {
		value?: string
		meta?: string
		slot?: string
	}
): string {
	let annotation = markup as string

	if (params.value !== undefined) {
		annotation = annotation.replaceAll(PLACEHOLDER.Value, params.value)
	}

	if (params.meta !== undefined) {
		annotation = annotation.replaceAll(PLACEHOLDER.Meta, params.meta)
	}

	if (params.slot !== undefined) {
		annotation = annotation.replaceAll(PLACEHOLDER.Slot, params.slot)
	}

	return annotation
}