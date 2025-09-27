import {InnerOption} from '../../default/types'
import {Markup} from '../../../shared/types'
import {NestedToken, MarkToken} from './types'
import {ParserV2Matches} from './ParserV2Matches'

export class ParserV2 {
	private readonly markups: Markup[]

	constructor(markups: Markup[]) {
		this.markups = markups
	}

	static split(value: string, options?: InnerOption[]): NestedToken[] {
		const markups = options?.map(c => c.markup!)
		return markups ? new ParserV2(markups).split(value) : []
	}

	split(value: string): NestedToken[] {
		const parser = new ParserV2Matches(value, this.markups, true)
		return parser.parse()
	}

}
