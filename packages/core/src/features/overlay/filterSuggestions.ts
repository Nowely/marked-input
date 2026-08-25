import type {Suggestion} from '../../shared/types'

/**
 * What a suggestion SHOWS. The one reading of it, so the row a user filtered by is the row they
 * see and the row a `key` is derived from.
 */
export function suggestionLabel(item: Suggestion): string {
	return typeof item === 'string' ? item : (item.label ?? item.value)
}

/**
 * Generic in the row type so a caller keeps its own element type through the filter — the rows
 * that come back are the rows that went in, and {@link Suggestion}'s object arm carries fields
 * this function never reads.
 */
export function filterSuggestions<T extends Suggestion>(data: readonly T[], search: string): T[] {
	const query = search.toLowerCase()
	return data.filter(item => suggestionLabel(item).toLowerCase().includes(query))
}