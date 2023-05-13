import {PLACEHOLDER} from '../constants'
import {MarkMatch, Markup, Option, Piece} from '../types'
import {normalizeMark} from './index'

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
		for (let i = 0; i < raw.length; i++) {
			for (let j = 0; j < this.splitMarkups.length; j++){
				const markup = this.splitMarkups[j];
				const substring = raw.substring(i)

				if (substring.startsWith(markup[0])){
					const endIndex = substring.indexOf(markup[1])
					if (endIndex !== -1) {
						return [
							raw.slice(0, i),
							{
								annotation: substring.slice(0, endIndex + 1),
								input: raw,
								label: substring.slice(0, endIndex + 1).slice(markup[0].length, endIndex),
								index: i,
								optionIndex: j
							} as MarkMatch,
							substring.slice(endIndex + 1)
						] as const
					}
				}
			}
		}
		return null
	}
}