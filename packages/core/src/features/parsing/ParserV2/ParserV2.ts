import {InnerOption} from '../../default/types'
import {Markup} from '../../../shared/types'
import {NestedToken} from './types'
import {PatternMatcher} from './PatternMatcher'
import {TokenSequenceBuilder} from './TokenSequenceBuilder'
import {AhoCorasickMarkupStrategy} from './AhoCorasickMarkupStrategy'
import {createSegmentMarkupDescriptor} from './SegmentMarkupDescriptor'

export class ParserV2 {
	private readonly markups: Markup[]
	private readonly strategy: AhoCorasickMarkupStrategy

	constructor(markups: Markup[]) {
		this.markups = markups
		// Кешируем стратегию на уровне парсера для переиспользования
		const descriptors = markups.map(createSegmentMarkupDescriptor)
		this.strategy = new AhoCorasickMarkupStrategy(descriptors)
	}

	static split(value: string, options?: InnerOption[]): NestedToken[] {
		const markups = options?.map(c => c.markup!)
		return markups ? new ParserV2(markups).split(value) : []
	}

	split(value: string): NestedToken[] {
		// Находим все матчи маркеров (переиспользуем strategy)
		const patternMatcher = new PatternMatcher(value, this.markups, this.strategy)
		const matches = patternMatcher.findAllMatches()

		// Преобразуем matches в кандидаты (ConflictResolver больше не нужен)
		const candidates = matches.map(match => ({
			match,
			conflicts: new Set()
		}))

		// Строим гарантированную последовательность токенов
		const tokenBuilder = new TokenSequenceBuilder(value, this.markups, this)
		return tokenBuilder.buildGuaranteedSequence(candidates)
	}

}
