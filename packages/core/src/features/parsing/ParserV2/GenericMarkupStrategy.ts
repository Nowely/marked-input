import {MarkupDescriptor} from './createMarkupDescriptor'
import {MatchResult, MarkupStrategy} from './types'

/**
 * Универсальная стратегия парсинга для произвольных markup паттернов
 * Работает с любыми паттернами, содержащими __label__ и опционально __value__
 */
export class GenericMarkupStrategy implements MarkupStrategy {
	matches(descriptor: MarkupDescriptor, input: string, position: number): MatchResult | null {
		// Проверяем, что начинаем с правильного паттерна
		if (!input.startsWith(descriptor.startPattern, position)) {
			return null
		}

		const startPos = position
		const endPos = this.findEndPosition(descriptor, input, position)

		if (endPos === -1) {
			return null
		}

		const content = input.substring(startPos, endPos)

		return {
			start: startPos,
			end: endPos,
			content,
			label: '', // Заполним позже в extractContent
			value: undefined,
			descriptor
		}
	}

	/**
	 * Находит позицию окончания маркера в тексте
	 */
	private findEndPosition(descriptor: MarkupDescriptor, input: string, position: number): number {
		const startPos = position
		let currentPos = position + descriptor.startPattern.length

		// Для паттернов с двумя лейблами (типа <tag>content</tag>)
		if (this.hasTwoLabels(descriptor)) {
			return this.findEndPositionForTwoLabels(descriptor, input, startPos)
		}

		// Для паттернов с bracket-based синтаксисом считаем скобки для поддержки вложенности
		// Но только для маркеров без value и с простым endPattern (типа #[label])
		if (this.hasBracketSyntax(descriptor) && !descriptor.hasValue && descriptor.endPattern === ']') {
			return this.findEndPositionWithBracketCounting(descriptor, input, startPos)
		}

		// Для всех остальных паттернов (включая с value) ищем endPattern
		const endPatternIndex = input.indexOf(descriptor.endPattern, currentPos)
		if (endPatternIndex === -1) {
			return -1
		}

		return endPatternIndex + descriptor.endPattern.length
	}

	/**
	 * Проверяет, содержит ли дескриптор два лейбла
	 */
	private hasTwoLabels(descriptor: MarkupDescriptor): boolean {
		return descriptor.hasTwoLabels && descriptor.hasValue
	}

	/**
	 * Проверяет, использует ли дескриптор bracket-based синтаксис (для поддержки вложенности)
	 * Bracket syntax: маркеры типа #[label] или @[label](value), где скобки являются структурными
	 */
	private hasBracketSyntax(descriptor: MarkupDescriptor): boolean {
		const markup = descriptor.markup
		// Проверяем, что markup имеет вид: prefix[label_part]suffix или prefix[label_part](value_part)suffix
		// и startPattern заканчивается [, а endPattern начинается с ]
		return markup.includes('[') && markup.includes(']') &&
			   descriptor.startPattern.endsWith('[') &&
			   descriptor.endPattern.startsWith(']')
	}

	/**
	 * Находит конец маркера с учетом подсчета скобок для поддержки вложенности
	 */
	private findEndPositionWithBracketCounting(descriptor: MarkupDescriptor, input: string, startPos: number): number {
		let bracketCount = 1
		let currentPos = startPos + descriptor.startPattern.length

		// Для простых bracket маркеров типа #[label] считаем скобки
		while (currentPos < input.length) {
			const char = input[currentPos]

			if (char === '[') {
				bracketCount++
			} else if (char === ']') {
				bracketCount--
				if (bracketCount === 0) {
					// Нашли соответствующую закрывающую скобку
					// Для маркера типа #[label] конец - это позиция после ]
					return currentPos + 1
				}
			}

			currentPos++
		}

		return -1 // Не нашли соответствующую закрывающую конструкцию
	}

	/**
	 * Находит конец маркера для паттернов с двумя лейблами (типа <tag>content</tag>)
	 */
	private findEndPositionForTwoLabels(descriptor: MarkupDescriptor, input: string, startPos: number): number {
		const parts = descriptor.markup.split(/__label__|__value__/).filter(p => p)
		if (parts.length < 3) {
			// Fallback для некорректных паттернов
			return input.indexOf(descriptor.endPattern, startPos + descriptor.startPattern.length)
		}

		const openingPrefix = parts[0]  // '<'
		const openingSuffix = parts[1]  // '>'
		const closingPrefix = parts[2]  // '</'
		const closingSuffix = parts[3] || parts[1]  // '>' или тот же суффикс

		// Ищем открывающий тег
		const tagStart = startPos + openingPrefix.length
		const tagEnd = input.indexOf(openingSuffix, tagStart)
		if (tagEnd === -1) return -1

		const tagName = input.substring(tagStart, tagEnd)
		const closingTag = closingPrefix + tagName + closingSuffix

		// Ищем закрывающий тег
		const contentEnd = input.indexOf(closingTag, tagEnd + openingSuffix.length)
		if (contentEnd === -1) return -1

		return contentEnd + closingTag.length
	}

	extractContent(match: MatchResult): { label: string; value?: string } {
		const innerContent = this.extractInnerContent(match)

		if (!match.descriptor.hasValue) {
			return { label: innerContent }
		}

		// Для паттернов с двумя лейблами используем специальную логику
		if (this.hasTwoLabels(match.descriptor)) {
			return this.extractContentForTwoLabels(match.descriptor, innerContent)
		}

		// Для простых паттернов с одним лейблом и value
		return this.extractContentForSimpleValuePattern(match.descriptor, innerContent)
	}

	/**
	 * Извлекает внутренний контент маркера (без startPattern и endPattern)
	 */
	private extractInnerContent(match: MatchResult): string {
		const { startPattern, endPattern } = match.descriptor
		return match.content.substring(
			startPattern.length,
			match.content.length - endPattern.length
		)
	}

	/**
	 * Извлекает label и value для паттернов с двумя лейблами (типа <tag>content</tag>)
	 */
	private extractContentForTwoLabels(descriptor: MarkupDescriptor, innerContent: string): { label: string; value?: string } {
		const parts = descriptor.markup.split(/__label__|__value__/).filter(p => p)
		if (parts.length < 3) {
			return { label: innerContent }
		}

		const firstSeparator = parts[1]  // между первым __label__ и __value__
		const secondSeparator = parts[2] // между __value__ и вторым __label__

		const firstSepIndex = innerContent.indexOf(firstSeparator)
		if (firstSepIndex === -1) {
			return { label: innerContent }
		}

		const label = innerContent.substring(0, firstSepIndex)
		const valueStart = firstSepIndex + firstSeparator.length
		const secondSepIndex = innerContent.indexOf(secondSeparator, valueStart)

		const value = secondSepIndex !== -1
			? innerContent.substring(valueStart, secondSepIndex)
			: undefined

		return { label, value }
	}

	/**
	 * Извлекает label и value для простых паттернов (один лейбл + value)
	 */
	private extractContentForSimpleValuePattern(descriptor: MarkupDescriptor, innerContent: string): { label: string; value?: string } {
		const parts = this.splitMarkupPattern(descriptor.markup)

		if (parts.length < 2) {
			return { label: innerContent }
		}

		const labelEndPattern = parts[1] // текст между __label__ и __value__

		if (!labelEndPattern) {
			return { label: innerContent }
		}

		const labelEndIndex = innerContent.indexOf(labelEndPattern)
		if (labelEndIndex === -1) {
			return { label: innerContent }
		}

		const label = innerContent.substring(0, labelEndIndex)
		const valueStart = labelEndIndex + labelEndPattern.length

		// Для простых паттернов value продолжается до конца innerContent
		// (потому что endPattern уже удален из innerContent)
		const value = innerContent.substring(valueStart)

		return { label, value: value || undefined }
	}

	/**
	 * Разбивает шаблон маркера на части между плейсхолдерами
	 */
	private splitMarkupPattern(markup: string): string[] {
		const labelPlaceholder = '__label__'
		const valuePlaceholder = '__value__'

		return markup.split(new RegExp(`(${labelPlaceholder}|${valuePlaceholder})`, 'g'))
			.filter(part => part && part !== labelPlaceholder && part !== valuePlaceholder)
	}
}
