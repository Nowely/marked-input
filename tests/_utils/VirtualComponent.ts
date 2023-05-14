import {Markup} from 'rc-marked-input'
import {Piece} from 'rc-marked-input/types'
import {Analyzers, Joiners, Parsers} from './consts'
import {getClosestIndexes} from './getClosestIndexes'
import {Analyzer, IParser, Joiner} from './types'

export class VirtualComponent {
	private readonly analyzer: Analyzer
	private readonly parser: IParser
	private readonly joiner: Joiner

	value: string = ''
	tokens: Piece[] = []
	private ranges!: number[]

	constructor(private readonly markups: Markup[], group: [number, number, number]) {
		const [analyzer, parser, join] = group
		this.analyzer = Analyzers[analyzer]
		this.parser = new Parsers[parser](markups)
		this.joiner = Joiners[join]
	}

	render(value: string) {
		const diff = this.analyzer(this.value, value)
		if (!diff || !diff[0] && !diff[1]) {
			//find by ranges find

			this.tokens = this.parser.split(value)
			this.value = value
			this.ranges = this.getRangeMap()
			return
		}


		const [updatedIndex] = getClosestIndexes(this.ranges, diff[0])
		const substring = value.substring(this.ranges[updatedIndex])

		const partTokens = this.parser.split(substring)
		this.tokens.splice(updatedIndex, 1, ...partTokens)
		this.value = value
		this.ranges = this.getRangeMap()
	}


	update(fn: (value: string) => string) {
		const index = this.tokens.length - 1
		const value = this.tokens[index] as string

		this.tokens[index] = fn(value)

		const params = {
			pieces: this.tokens,
			markups: this.markups,
			index: index,
			value: this.value
		}
		const newValue = this.joiner(params)
		this.render(newValue)
	}

	private getRangeMap() {
		let position = 0
		return this.tokens.map(token => {
			const length = typeof token === 'string' ? token.length : token.annotation.length
			position += length
			return position - length
		})
	}
}

