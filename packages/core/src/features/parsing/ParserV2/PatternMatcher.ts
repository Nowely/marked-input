import {Markup} from '../../../shared/types'
import {createMarkupDescriptor, MarkupDescriptor} from './createMarkupDescriptor'
import {MatchResult} from './types'
import {GenericMarkupStrategy} from './GenericMarkupStrategy'

/**
 * Компонент для нахождения всех матчей маркеров в тексте
 * Использует единую универсальную стратегию для всех типов маркеров
 */
export class PatternMatcher {
	private readonly input: string
	private readonly descriptors: MarkupDescriptor[]
	private readonly descriptorsByTrigger: Map<string, MarkupDescriptor[]>
	private readonly strategy: GenericMarkupStrategy

	constructor(input: string, markups: Markup[]) {
		this.input = input
		this.descriptors = markups.map(createMarkupDescriptor)

		// Группируем дескрипторы по триггерным символам для быстрого доступа
		this.descriptorsByTrigger = new Map()
		for (const desc of this.descriptors) {
			if (!this.descriptorsByTrigger.has(desc.trigger)) {
				this.descriptorsByTrigger.set(desc.trigger, [])
			}
			this.descriptorsByTrigger.get(desc.trigger)!.push(desc)
		}

		// Используем единую стратегию для всех маркеров
		this.strategy = new GenericMarkupStrategy()
	}

	/**
	 * Находит все матчи маркеров в тексте
	 */
	findAllMatches(): MatchResult[] {
		const matches: MatchResult[] = []

		for (let i = 0; i < this.input.length; i++) {
			const char = this.input[i]

			// Проверяем только триггерные символы
			const candidates = this.descriptorsByTrigger.get(char)
			if (!candidates) continue

			// Для каждого дескриптора с этим триггером пытаемся найти матч
			for (const desc of candidates) {
				const match = this.strategy.matches(desc, this.input, i)

				if (match) {
					// Заполняем label и value с помощью стратегии
					const content = this.strategy.extractContent(match)
					match.label = content.label
					match.value = content.value

					matches.push(match)

					// Пропускаем обработанный текст
					i = match.end - 1
					break // Нашли матч для этого триггера, переходим к следующей позиции
				}
			}
		}

		return matches
	}

}
