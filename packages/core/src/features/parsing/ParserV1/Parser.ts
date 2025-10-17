import {isObject} from '../utils/isObject'
import {markupToRegex} from './markupToRegex'
import {normalizeMark} from './normalizeMark'
import {ParserMatches} from './ParserMatches'
import {Markup, MarkStruct, PieceType} from './types'
import {InnerOption} from '../../default/types'

export class Parser {
	public readonly markups: Markup[]
	public readonly uniRegExp: RegExp
	public readonly regExps: RegExp[]

	constructor(markups: Markup[]) {
		this.markups = markups
		this.regExps = this.markups.map(markupToRegex)
		this.uniRegExp = new RegExp(this.regExps.map(value => value.source).join('|'))
	}

	static split(value: string, options?: InnerOption[]): MarkStruct[] {
		const markups = options?.map(c => c.markup)
		const pieces = markups ? new Parser(markups).split(value) : [value]
		return pieces.map(piece => {
			return isObject(piece) ? piece : {label: piece}
		})
	}

	split(value: string): PieceType[] {
		return this.iterateMatches(value)
	}

	iterateMatches(value: string) {
		const result: PieceType[] = []

		for (const [span, mark] of new ParserMatches(value, this.uniRegExp, this.regExps)) {
			result.push(span)
			if (mark !== null) result.push(normalizeMark(mark, this.markups[mark.optionIndex]))
		}

		return result
	}
}
