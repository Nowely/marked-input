import {Markup} from '../../../shared/types'
import {createSegmentMarkupDescriptor, SegmentMarkupDescriptor} from './SegmentMarkupDescriptor'
import {MatchResult} from './types'
import {AhoCorasickMarkupStrategy} from './AhoCorasickMarkupStrategy'

/**
 * Компонент для нахождения всех матчей маркеров в тексте
 * Использует Aho-Corasick стратегию для эффективного поиска паттернов
 */
export class PatternMatcher {
	private readonly input: string
	private readonly descriptors: SegmentMarkupDescriptor[]
	private readonly descriptorsByTrigger: Map<string, SegmentMarkupDescriptor[]>
	private readonly strategy: AhoCorasickMarkupStrategy

	constructor(input: string, markups: Markup[], strategy?: AhoCorasickMarkupStrategy) {
		this.input = input
		this.descriptors = markups.map(createSegmentMarkupDescriptor)

		// Группируем дескрипторы по триггерным символам для быстрого доступа
		this.descriptorsByTrigger = new Map()
		for (const desc of this.descriptors) {
			if (!this.descriptorsByTrigger.has(desc.trigger)) {
				this.descriptorsByTrigger.set(desc.trigger, [])
			}
			this.descriptorsByTrigger.get(desc.trigger)!.push(desc)
		}

		// Переиспользуем стратегию если передана, иначе создаем новую
		this.strategy = strategy || new AhoCorasickMarkupStrategy(this.descriptors)
	}

	/**
	 * Находит все матчи маркеров в тексте
	 * Оптимизировано: один вызов search() вместо N вызовов
	 */
	findAllMatches(): MatchResult[] {
		// Получаем все матчи за один проход (эффективно!)
		return this.strategy.getAllMatches(this.input)
	}

}
