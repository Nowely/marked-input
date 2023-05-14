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
				//result.push(normalizeMark(mark, this.markups[mark.optionIndex]))
				result.push(mark)
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

		let match = this.findMatch(this.raw)
		if (match === null) {
			this.done = true
			return {done: false, value: [this.raw, null]}
		}

		let [span, mark, raw] = match
		this.raw = raw
		return {done: false, value: [span, mark]}
	}

	findMatch(raw: string) {
		let indexPairs: [number, number, number][] = []
		this.splitMarkups.forEach(([left, right], markupIndex) => {
			const startIndex = raw.indexOf(left)
			if (startIndex === -1) return

			const endIndex = raw.indexOf(right)
			if (endIndex === -1) return

			indexPairs.push([startIndex, endIndex, markupIndex])
		})

		let minStartIndex = Number.POSITIVE_INFINITY
		let minEndIndex = Number.POSITIVE_INFINITY
		let minEndMarkupIndex = Number.POSITIVE_INFINITY
		indexPairs = indexPairs.filter(([startIndex, endIndex]) => (startIndex < endIndex))
		indexPairs.forEach(([startIndex, endIndex, markupIndex]) => {
			if (endIndex < minEndIndex) {
				minStartIndex = startIndex
				minEndIndex = endIndex
				minEndMarkupIndex = markupIndex
			}
		})

		if (indexPairs.length) {
			if (raw.slice(minStartIndex, minEndIndex + 1) === '') {
				debugger
			}
			return [
				raw.slice(0, minStartIndex),
				{
					annotation: raw.slice(minStartIndex, minEndIndex + 1),
					input: raw,
					label: raw
						.slice(minStartIndex, minEndIndex + 1)
						.slice(this.splitMarkups[minEndMarkupIndex][0].length, -this.splitMarkups[minEndMarkupIndex][1].length),
					index: minStartIndex,
					optionIndex: minEndMarkupIndex
				} as MarkMatch,
				raw.slice(minEndIndex + 1)
			] as const
		}

		return null
	}
}