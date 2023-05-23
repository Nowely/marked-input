import {PLACEHOLDER} from 'rc-marked-input/PLACEHOLDER'
import {MarkMatch, Markup, Option, Piece} from 'rc-marked-input/types'
import {normalizeMark} from 'rc-marked-input/utils/normalizeMark'
import * as peggy from "peggy";
// @ts-ignore
import * as parser from "../GeneratedPEGParser"

export class PEGParser {
	private readonly markups: Markup[]


	static split(value: string, options?: Option[]) {
		const markups = options?.map((c) => c.markup!)
		return () => markups ? new PEGParser(markups).split(value) : [value]
	}

	constructor(markups: Markup[]) {
		this.markups = markups
	}

	split(value: string): Piece[] {
		return parser.parse(value, {
			markups: this.markups
		})
	}
}
