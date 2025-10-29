import {PLACEHOLDER} from '../constants'
import {Markup} from '../types'

/**
 * Make annotation from the markup for ParserV2
 *
 * @param markup - Markup pattern with __value__, __meta__, and/or __nested__ placeholders
 * @param params - Object with optional value, meta, and nested strings
 * @returns Annotated string with placeholders replaced
 *
 * @example
 * ```typescript
 * annotate('@[__value__]', { value: 'Hello' }) // '@[Hello]'
 * annotate('@[__value__](__meta__)', { value: 'Hello', meta: 'world' }) // '@[Hello](world)'
 * annotate('@[__nested__]', { nested: 'content' }) // '@[content]'
 * ```
 */
export function annotate(
	markup: Markup,
	params: {
		value?: string
		meta?: string
		nested?: string
	}
): string {
	let annotation = markup as string

	if (params.value !== undefined) {
		annotation = annotation.replaceAll(PLACEHOLDER.Value, params.value)
	}

	if (params.meta !== undefined) {
		annotation = annotation.replaceAll(PLACEHOLDER.Meta, params.meta)
	}

	if (params.nested !== undefined) {
		annotation = annotation.replaceAll(PLACEHOLDER.Nested, params.nested)
	}

	return annotation
}
