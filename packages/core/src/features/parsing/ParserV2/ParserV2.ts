import {InnerOption} from '../../default/types'
import {Markup} from '../../../shared/types'
import {NestedToken, TokenCandidate} from './types'
import {AhoCorasickMarkupStrategy} from './AhoCorasickMarkupStrategy'
import {createSegmentMarkupDescriptor} from './SegmentMarkupDescriptor'
import {buildGuaranteedSequence} from './TokenSequenceBuilder'

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
		// Находим все матчи маркеров
		const matches = this.strategy.findAllMatches(value)

		// Преобразуем matches в кандидаты (ConflictResolver больше не нужен)
		const candidates: TokenCandidate[] = matches.map(match => ({match}))

		// Строим гарантированную последовательность токенов
		return buildGuaranteedSequence(value, this.markups, this, candidates)
	}

}
