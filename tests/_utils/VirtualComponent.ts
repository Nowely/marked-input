import {annotate, MarkMatch, Markup} from 'rc-marked-input'
import {Piece} from 'rc-marked-input/types'
import {isAnnotated} from 'rc-marked-input/utils'
import {Parser} from 'rc-marked-input/utils/Parser'
import {SymbolParser} from 'rc-marked-input/utils/SymbolParser'
import {formalizeTear} from './formalizeTear'
import {getClosestIndexes} from './getClosestIndexes'

type ParserConstructor = new(markups: Markup[]) => IParser

interface IParser {
	split(value: string): Piece[]
}

const Analyzers: Analyzer[] = [analyzeSimple, formalizeTear]
const Parsers: ParserConstructor[] = [SymbolParser, Parser]
const Joiners: ((params: JoinParameters) => string)[] = [joinSimple, joinExactly]

type Analyzer = typeof formalizeTear
type Joiner = typeof joinSimple

export class VirtualComponent {
	private readonly analyzer: Analyzer
	private readonly parser: IParser
	private readonly joiner: Joiner

	value: string = ''
	tokens!: Piece[]
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

		/*const a = this.tokens.map(token => typeof token === 'string' ? token : token.annotation)
		console.log(indexes)
		console.log(a)
		console.log(value)*/
	}


	getRangeMap() {
		let position = 0
		return this.tokens.map(token => {
			const length = typeof token === 'string' ? token.length : token.annotation.length
			position += length
			return position - length
		})
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

		/*const startTime1 = performance.now()
		for (let i = 0; i < 1000000; i++) {
			joinSimple(params)
		}
		const endTime1 = performance.now()

		const startTime2 = performance.now()
		for (let i = 0; i < 1000000; i++) {
			joinExactly(params)
		}
		const endTime2 = performance.now()

		const a = convertMsIntoFrequency(endTime1 - startTime1)
		const b = convertMsIntoFrequency(endTime2 - startTime2)
		console.log(`Simple: ${a}`)
		console.log(`Exactly: ${b}`)*/

		this.render(newValue)
	}
}

function analyzeSimple(value: string, newValue: string) {
	if (value === newValue) return undefined
}

type JoinParameters = { pieces: Piece[], index: number, value: string, markups: Markup[] }

function joinSimple({pieces, markups}: JoinParameters) {
	let result = ''
	for (let value of pieces) {
		result += isAnnotated(value)
			? annotate(markups[value.optionIndex], value.label, value.value)
			: value
	}
	return result
}

function joinExactly({pieces, index, value}: JoinParameters) {
	const annotationLast = (pieces[index - 1] as MarkMatch).annotation
	const annIndex = value.lastIndexOf(annotationLast)
	const substring = value.substring(0, annIndex + annotationLast.length)
	return substring + pieces[index]
}
