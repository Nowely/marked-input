import {MarkStruct, Markup, Option, PieceType} from '../../../types'
import {isObject} from '../../checkers/isObject'
import {markupToRegex} from '../../functions/markupToRegex'
import {normalizeMark} from '../../functions/normalizeMark'
import {ParserMatches} from './ParserMatches'

export class Parser {
	private readonly markups: Markup[]
	private readonly uniRegExp: RegExp
	private readonly regExps: RegExp[]

	static split(value: string, options?: Option[]): MarkStruct[] {
		const markups = options?.map((c) => c.markup!)
		const pieces = markups ? new Parser(markups).split(value) : [value]
		return pieces.map(piece => {
			return isObject(piece) ? piece : {label: piece}
		})
	}

	constructor(markups: Markup[]) {
		this.markups = markups
		this.regExps = this.markups.map(markupToRegex)
		this.uniRegExp = new RegExp(this.regExps.map(value => value.source).join('|'))
	}

	split(value: string): PieceType[] {
		return this.iterateMatches(value)
	}

	iterateMatches(value: string) {
		const result: PieceType[] = []

		for (let [span, mark] of new ParserMatches(value, this.uniRegExp, this.regExps)) {
			result.push(span)
			if (mark !== null)
				result.push(normalizeMark(mark, this.markups[mark.optionIndex]))
		}

		return result
	}
}

