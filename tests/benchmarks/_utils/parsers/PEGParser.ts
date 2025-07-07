import {Markup, Option, PieceType} from 'rc-marked-input/types'
// @ts-ignore
import * as parser from '../GeneratedPEGParser'

export class PEGParser {
	private readonly markups: Markup[]

	static split(value: string, options?: Option[]) {
		const markups = options?.map((c) => c.markup!)
		return () => markups ? new PEGParser(markups).split(value) : [value]
	}

	constructor(markups: Markup[]) {
		this.markups = markups
	}

	split(value: string): PieceType[] {
		return parser.parse(value, {
			markups: this.markups
		})
	}
}
