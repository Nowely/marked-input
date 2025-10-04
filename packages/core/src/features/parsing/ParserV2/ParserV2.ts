import {InnerOption} from '../../default/types'
import {Markup} from '../../../shared/types'
import {NestedToken, MatchResult} from './types'
import {MarkupMatcher} from './MarkupMatcher'
import {createMarkupDescriptor} from './MarkupDescriptor'
import {buildTokenSequence} from './TokenBuilder'

export class ParserV2 {
	private readonly markups: Markup[]
	private readonly strategy: MarkupMatcher

	constructor(markups: Markup[]) {
		this.markups = markups
		// Кешируем стратегию на уровне парсера для переиспользования
		const descriptors = markups.map(createMarkupDescriptor)
		this.strategy = new MarkupMatcher(descriptors)
	}

	static split(value: string, options?: InnerOption[]): NestedToken[] {
		const markups = options?.map(c => c.markup!)
		return markups ? new ParserV2(markups).split(value) : []
	}

	split(value: string): NestedToken[] {
		// Находим все матчи маркеров
		const matches = this.strategy.findAllMatches(value)

		// Строим последовательность токенов
		return buildTokenSequence(value, this.markups, this, matches)
	}

}
