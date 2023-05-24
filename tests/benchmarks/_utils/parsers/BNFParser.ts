import {Markup, Option, Piece} from 'rc-marked-input/types'
import nearley from 'nearley'
// @ts-ignore
import grammar from '../GeneratedBNFGrammar.js'

export class BNFParser {
	//private readonly markups: Markup[]

	static split(value: string, options?: Option[]) {
		const markups = options?.map((c) => c.markup!)
		return () => markups ? new BNFParser(markups).split(value) : [value]
	}

	constructor(markups: Markup[]) {
	}

	split(value: string): Piece[] {
		return this.#parse(value)
	}

	#parse(value: string) {
		try {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
			parser.feed(value)
			if (parser.results.length === 0) debugger
			if (parser.results.length > 0) {
				const max = Math.max(...parser.results.map(v => v.length))
				const index = parser.results.findIndex(v => v.length === max)
			 	return parser.results[index]
			}
		} catch (error) {
			console.error('Parsing error:', error)
		}
		return null
	}
}