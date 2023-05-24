import fs from 'fs'
import {Markup, Option, Piece} from 'rc-marked-input/types'
import nearley from 'nearley'
// @ts-ignore
import grammar from '../GeneratedBNFGrammar.js'

export class BNFParser {
	//private readonly markups: Markup[]
	private parser: nearley.Parser

	static split(value: string, options?: Option[]) {
		const markups = options?.map((c) => c.markup!)
		return () => markups ? new BNFParser(markups).split(value) : [value]
	}

	constructor(markups: Markup[]) {
		this.parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
	}

	split(value: string): Piece[] {
		return this.#parse(value)
	}

	#parse(value: string) {
		try {
			this.parser.feed(value)
			if (this.parser.results.length > 0) {
				return this.parser.results[0]
			}
		} catch (error) {
			console.error('Parsing error:', error)
		}
		return null
	}
}