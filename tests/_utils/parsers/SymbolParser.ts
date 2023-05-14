import {PLACEHOLDER} from 'rc-marked-input/PLACEHOLDER'
import {MarkMatch, Markup, Option, Piece} from 'rc-marked-input/types'
import {normalizeMark} from 'rc-marked-input/utils/normalizeMark'

export class SymbolParser {
	private readonly markups: Markup[]
	private readonly splitMarkups: [string, string][]

	static split(value: string, options?: Option[]) {
		const markups = options?.map((c) => c.markup!)
		return () => markups ? new SymbolParser(markups).split(value) : [value]
	}

	constructor(markups: Markup[]) {
		this.markups = markups
		// @ts-ignore
		this.splitMarkups = this.markups.map(markup => markup.split(PLACEHOLDER.LABEL))
	}

	split(value: string): Piece[] {
		return this.iterateMatches(value)
	}

	iterateMatches(value: string) {
		const result: Piece[] = []

		for (let [span, mark] of new ParserMatches(value, this.splitMarkups)) {
			result.push(span)
			if (mark !== null)
				result.push(normalizeMark(mark, this.markups[mark.optionIndex]))
		}

		return result
	}
}

class ParserMatches implements IterableIterator<[string, MarkMatch | null]> {
	done: boolean = false

	constructor(
		public raw: string,
		public splitMarkups: [string, string][]
	) {
	}

	[Symbol.iterator](): IterableIterator<[string, MarkMatch | null]> {
		return this
	}

	next(): IteratorResult<[string, MarkMatch | null], [string, MarkMatch | null] | null> {
		if (this.done)
			return {done: this.done, value: null}

		let match = this.findMatch1(this.raw)
		if (match === null) {
			this.done = true
			return {done: false, value: [this.raw, null]}
		}

		let [span, mark, raw] = match
		this.raw = raw
		return {done: false, value: [span, mark]}
	}

	findMatch1(raw: string) {
		for (let i = 0; i < raw.length; i++) {
			const substring = raw.substring(i)
			const indexPairs: [number, number][] = []
			this.splitMarkups.forEach(([left, right], markupIndex) => {
				if (substring.startsWith(left)) {
					const endIndex = substring.indexOf(right)
					if (endIndex !== -1){
						indexPairs.push([endIndex, markupIndex])
					}
				}
			})
			let minEndIndex = Number.POSITIVE_INFINITY
			let minEndMarkupIndex = Number.POSITIVE_INFINITY
			indexPairs.forEach(([endIndex, markupIndex]) => {
				if (endIndex < minEndIndex) {
					minEndIndex = endIndex
					minEndMarkupIndex = markupIndex
				}
			})
			if (indexPairs.length) {
				/*return {
					startIndex: i,
					endIndex: minEndIndex,
					markupIndex: minEndMarkupIndex
				}*/
				return [
					raw.slice(0, i),
					{
						annotation: substring.slice(0, minEndIndex + 1),
						input: raw,
						label: substring
							.slice(0, minEndIndex + 1)
							.slice(this.splitMarkups[minEndMarkupIndex][0].length, minEndIndex),
						index: i,
						optionIndex: minEndMarkupIndex
					} as MarkMatch,
					substring.slice(minEndIndex + 1)
				] as const
			}
		}
		return null
	}
}