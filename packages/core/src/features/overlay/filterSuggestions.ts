import type {Suggestion} from '../../shared/types'

/**
 * What a suggestion SHOWS. The one reading of it, so the row a user filtered by is the row they
 * see and the row a `key` is derived from.
 */
export function suggestionLabel(item: Suggestion): string {
	return typeof item === 'string' ? item : (item.label ?? item.value)
}

/**
 * HOW WELL A ROW ANSWERS WHAT WAS TYPED, as a band — lower is better, `-1` is no match at all.
 * THE match rule for both overlays: the `@` list ranks a suggestion's label, the `/` menu ranks a
 * menu entry's label plus the hidden keywords it declares.
 *
 * Four bands, and each one is a step further from what the user typed: the label EXACTLY, the
 * label's PREFIX, the label anywhere, then the same three over the keywords. That last offset is
 * the half a single band cannot express — a row that matches on a keyword nobody can see must not
 * outrank one that matches on the label they are reading.
 *
 * IT USED TO BE `includes` AND NOTHING ELSE, so the order on offer was DECLARATION order and an
 * exact match ranked wherever its option happened to sit in the array. Harmless while Enter picked
 * nothing; a wrong commit on the first try once Enter picked the first row — measured on the Notion
 * showcase, `/table` offered **Table of contents** ahead of **Table**, and `/to` offered it ahead of
 * **To-do list**, because `toc` is one of its keywords.
 *
 * AN EMPTY QUERY IS A PREFIX OF EVERYTHING, so nothing is reordered before the first character is
 * typed: every row lands in the same band and the sort below is stable.
 */
export function rankSuggestion(search: string, label: string, keywords: readonly string[] = []): number {
	const query = search.toLowerCase()
	const own = band(label, query)
	if (own >= 0) return own
	const keyword = keywords.reduce((best, word) => {
		const rank = band(word, query)
		return rank < 0 ? best : Math.min(best, rank)
	}, BANDS)
	return keyword === BANDS ? -1 : keyword + BANDS
}

/** How many bands one string contributes — the offset a keyword match is pushed down by. */
const BANDS = 3

function band(text: string, query: string): number {
	const candidate = text.toLowerCase()
	if (candidate === query) return 0
	if (candidate.startsWith(query)) return 1
	return candidate.includes(query) ? 2 : -1
}

/**
 * Generic in the row type so a caller keeps its own element type through the filter — the rows
 * that come back are the rows that went in, and {@link Suggestion}'s object arm carries fields
 * this function never reads.
 *
 * SORTED by {@link rankSuggestion} and not merely filtered. `Array.prototype.sort` is stable, so
 * declaration order still decides inside a band — which is the whole of what it decided before.
 */
export function filterSuggestions<T extends Suggestion>(data: readonly T[], search: string): T[] {
	return data
		.map(item => ({item, rank: rankSuggestion(search, suggestionLabel(item))}))
		.filter(entry => entry.rank >= 0)
		.toSorted((a, b) => a.rank - b.rank)
		.map(entry => entry.item)
}