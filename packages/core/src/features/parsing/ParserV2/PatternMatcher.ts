import {Markup} from '../../../shared/types'
import {createMarkupDescriptor, MarkupDescriptor} from './createMarkupDescriptor'
import {MatchResult, MarkupStrategy} from './types'
import {BracketMarkupStrategy, ParenMarkupStrategy, GenericMarkupStrategy} from './strategies'

/**
 * Компонент для нахождения всех матчей маркеров в тексте
 */
export class PatternMatcher {
	private readonly input: string
	private readonly descriptors: MarkupDescriptor[]
	private readonly descriptorsByTrigger: Map<string, MarkupDescriptor[]>
	private readonly strategies: Map<MarkupDescriptor, MarkupStrategy>

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

		// Создаем стратегии для каждого дескриптора
		this.strategies = new Map()
		for (const desc of this.descriptors) {
			const strategy = this.createStrategyForDescriptor(desc)
			this.strategies.set(desc, strategy)
		}
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
				const strategy = this.strategies.get(desc)!
				const match = strategy.matches(desc, this.input, i)

				if (match) {
					// Заполняем label и value с помощью стратегии
					const content = strategy.extractContent(match)
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

	/**
	 * Создает подходящую стратегию для дескриптора
	 */
	private createStrategyForDescriptor(desc: MarkupDescriptor): MarkupStrategy {
		// Определяем тип стратегии на основе структуры маркера
		const markup = desc.markup

		// Проверяем, использует ли markup квадратные скобки для label
		if (markup.includes('[') && markup.includes(']')) {
			if (desc.hasValue && markup.includes('(') && markup.includes(')')) {
				// Маркер с value в круглых скобках: @[__label__](__value__)
				return new ParenMarkupStrategy()
			} else {
				// Маркер без value или с другим форматом: #[__label__]
				return new BracketMarkupStrategy()
			}
		} else {
			// Для других форматов используем универсальную стратегию
			return new GenericMarkupStrategy()
		}
	}
}
