import {annotate, MarkMatch, Markup} from 'rc-marked-input'
import {Piece} from 'rc-marked-input/types'
import {isAnnotated} from 'rc-marked-input/utils'
import {Parser} from 'rc-marked-input/utils/Parser'
import {SymbolParser} from 'rc-marked-input/utils/SymbolParser'
import {convertMsIntoFrequency} from './convertMsIntoFrequency'

type ParserConstructor = new(markups: Markup[]) => IParser

interface IParser {
	split(value: string): Piece[]
}

const Parsers: ParserConstructor[] = [SymbolParser, Parser]
const Analyzers: Analyzer[] = [analyzeSimple]
const Joiners: ((params: JoinParameters) => string)[] = [joinSimple, joinExactly]

type Analyzer = typeof analyzeSimple
type Joiner = typeof joinSimple

export class VirtualComponent {
	private readonly analyzer: Analyzer
	private readonly parser: IParser
	private readonly joiner: Joiner

	value!: string
	tokens!: Piece[]

	constructor(private readonly markups: Markup[], group: [number, number, number]) {
		const [analyzer, parser, join] = group
		this.analyzer = Analyzers[analyzer]
		this.parser = new Parsers[parser](markups)
		this.joiner = Joiners[join]
	}

	render(value: string) {
		const isSome = this.analyzer(value, this.value)
		if (isSome) return

		this.value = value
		this.tokens = this.parser.split(value)
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

function analyzeSimple(value?: string, previousValue?: string) {
	return value === previousValue
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
	const annotationLast = (pieces[index-1] as MarkMatch).annotation
	const annIndex = value.lastIndexOf(annotationLast)
	const substring = value.substring(0, annIndex + annotationLast.length)
	return substring + pieces[index]
}