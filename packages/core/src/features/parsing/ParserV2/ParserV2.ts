import {InnerOption} from '../../default/types'
import {Markup} from '../../../shared/types'
import {NestedToken} from './types'
import {PatternMatcher} from './PatternMatcher'
import {ConflictResolver} from './ConflictResolver'
import {TokenSequenceBuilder} from './TokenSequenceBuilder'

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
		// Находим все матчи маркеров
		const patternMatcher = new PatternMatcher(value, this.markups)
		const matches = patternMatcher.findAllMatches()

		// Разрешаем конфликты между пересекающимися маркерами
		const conflictResolver = new ConflictResolver()
		const resolvedCandidates = conflictResolver.resolve(matches)

		// Строим гарантированную последовательность токенов
		const tokenBuilder = new TokenSequenceBuilder(value, this.markups)
		return tokenBuilder.buildGuaranteedSequence(resolvedCandidates)
	}

}
