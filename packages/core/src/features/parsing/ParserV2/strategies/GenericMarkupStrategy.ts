import {MarkupDescriptor} from '../createMarkupDescriptor'
import {MatchResult, MarkupStrategy} from '../types'

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
		let currentPos = position + descriptor.startPattern.length

		// Специальная обработка для паттернов типа <__label__>__value__<__label__>
		if (descriptor.markup.includes('<__label__>__value__<__label__>')) {
			// Для HTML-стиля: <tag>content</tag>
			// Ищем соответствующий закрывающий тег
			const tagStart = position + descriptor.startPattern.length
			const tagEnd = input.indexOf(descriptor.endPattern, tagStart)
			if (tagEnd === -1) return null

			const tagName = input.substring(tagStart, tagEnd)
			const closingTag = descriptor.startPattern + tagName + descriptor.endPattern

			// Ищем закрывающий тег после содержимого
			const contentEnd = input.indexOf(closingTag, tagEnd + descriptor.endPattern.length)
			if (contentEnd === -1) return null

			currentPos = contentEnd + closingTag.length
		} else {
			// Для простых паттернов без value ищем endPattern
			if (!descriptor.hasValue) {
				const endPatternIndex = input.indexOf(descriptor.endPattern, currentPos)
				if (endPatternIndex === -1) {
					return null
				}
				currentPos = endPatternIndex + descriptor.endPattern.length
			} else {
				// Для паттернов с value нужно найти соответствующую закрывающую конструкцию
				// Это упрощенная логика - находим endPattern после startPattern
				const endPatternIndex = input.indexOf(descriptor.endPattern, currentPos)
				if (endPatternIndex === -1) {
					return null
				}
				currentPos = endPatternIndex + descriptor.endPattern.length
			}
		}

		const endPos = currentPos
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

	extractContent(match: MatchResult): { label: string; value?: string } {
		const content = match.content
		const markup = match.descriptor.markup

		// Удаляем startPattern и endPattern из контента для анализа
		const startPattern = match.descriptor.startPattern
		const endPattern = match.descriptor.endPattern
		const innerContent = content.substring(startPattern.length, content.length - endPattern.length)

		let label: string
		let value: string | undefined

		if (match.descriptor.hasValue) {
			// Специальная обработка для паттернов типа <__label__>__value__<__label__>
			if (markup.includes('<__label__>__value__<__label__>')) {
				// Для HTML-стиля: <tag>content</tag>
				// innerContent = 'tag>content<tag'
				const firstCloseIndex = innerContent.indexOf('>')
				if (firstCloseIndex !== -1) {
					label = innerContent.substring(0, firstCloseIndex)

					const contentStart = firstCloseIndex + 1
					const secondOpenIndex = innerContent.indexOf('<', contentStart)
					if (secondOpenIndex !== -1) {
						value = innerContent.substring(contentStart, secondOpenIndex)
					}
				}
			} else {
				// Для паттернов с value разбираем структуру
				const labelPlaceholder = '__label__'
				const valuePlaceholder = '__value__'

				// Разбираем шаблон на части
				const parts = markup.split(new RegExp(`(${labelPlaceholder}|${valuePlaceholder})`, 'g'))
					.filter(part => part && part !== labelPlaceholder && part !== valuePlaceholder)

				if (parts.length >= 2) {
					// У нас есть и label, и value
					const labelStart = 0
					const labelEndPattern = parts[1] // текст между __label__ и __value__

					if (labelEndPattern) {
						const labelEndIndex = innerContent.indexOf(labelEndPattern)
						if (labelEndIndex !== -1) {
							label = innerContent.substring(labelStart, labelEndIndex)

							// Ищем value после разделителя
							const valueStart = labelEndIndex + labelEndPattern.length
							const valueEndPattern = parts[2] || '' // текст после __value__

							let valueEndIndex: number
							if (valueEndPattern) {
								valueEndIndex = innerContent.indexOf(valueEndPattern, valueStart)
							} else {
								valueEndIndex = innerContent.length
							}

							if (valueEndIndex !== -1) {
								value = innerContent.substring(valueStart, valueEndIndex)
							}
						} else {
							// Не нашли разделитель, берем весь контент как label
							label = innerContent
						}
					} else {
						// Нет разделителя, весь контент - label
						label = innerContent
					}
				} else {
					// Простой случай: весь контент - label
					label = innerContent
				}
			}
		} else {
			// Для паттернов без value весь innerContent - это label
			label = innerContent
		}

		return { label: label || '', value }
	}
}
