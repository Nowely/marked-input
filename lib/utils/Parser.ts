import {Markup, Option, Piece} from '../types'
import {markupToRegex} from './markupToRegex'
import {ParserMatches} from './ParserMatches'
import {normalizeMark} from "./normalizeMark";

//TODO parser factory?
export class Parser {
	private readonly markups: Markup[]
	private readonly uniRegExp: RegExp
	private readonly regExps: RegExp[]

	static split(value: string, options?: Option[]) {
		const markups = options?.map((c) => c.markup!)
		return () => markups ? new Parser(markups).split(value) : [value]
	}

	constructor(markups: Markup[]) {
		this.markups = markups
		this.regExps = this.markups.map(markupToRegex)
		this.uniRegExp = new RegExp(this.regExps.map(value => value.source).join('|'))
	}

	split(value: string): Piece[] {
		return this.iterateMatches(value)
	}

	iterateMatches(value: string) {
		const result: Piece[] = []

		for (let [span, mark] of new ParserMatches(value, this.uniRegExp, this.regExps)) {
			result.push(span)
			if (mark !== null)
				result.push(normalizeMark(mark, this.markups[mark.optionIndex]))
		}

		return result
	}
}

