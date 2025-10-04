import {InnerOption} from '../../default/types'
import {Markup} from '../../../shared/types'
import {NestedToken, MatchResult} from './types'
import {AhoCorasickStrategy} from './AhoCorasickStrategy'
import {createSegmentMarkupDescriptor} from './SegmentMarkupDescriptor'
import {buildGuaranteedSequence} from './TokenAssembler'

export class ParserV2 {
	private readonly markups: Markup[]
	private readonly strategy: AhoCorasickStrategy

	constructor(markups: Markup[]) {
		this.markups = markups
		// Кешируем стратегию на уровне парсера для переиспользования
		const descriptors = markups.map(createSegmentMarkupDescriptor)
		this.strategy = new AhoCorasickStrategy(descriptors)
	}

	static split(value: string, options?: InnerOption[]): NestedToken[] {
		const markups = options?.map(c => c.markup!)
		return markups ? new ParserV2(markups).split(value) : []
	}

	split(value: string): NestedToken[] {
		// Находим все матчи маркеров
		const matches = this.strategy.findAllMatches(value)

		// Строим гарантированную последовательность токенов
		return buildGuaranteedSequence(value, this.markups, this, matches)
	}

}
