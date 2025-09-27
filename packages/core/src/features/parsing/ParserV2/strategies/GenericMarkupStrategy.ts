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

		// Специальная обработка для паттернов с повторяющимся __label__
		const labelCount = (descriptor.markup.match(/__label__/g) || []).length
		if (labelCount > 1 && descriptor.hasValue) {
			// Паттерн типа <tag>content</tag> - разбираем структуру паттерна
			const parts = descriptor.markup.split(/__label__|__value__/).filter(p => p)
			if (parts.length >= 3) {
				// parts[0] - перед первым __label__ (<)
				// parts[1] - между первым __label__ и __value__ (>)
				// parts[2] - между __value__ и вторым __label__ (</)
				// parts[3] - после второго __label__ (>) - может отсутствовать

				const openingPrefix = parts[0] // '<'
				const openingSuffix = parts[1] // '>'
				const closingPrefix = parts[2] // '</'
				const closingSuffix = parts[3] || parts[1] // '>' или тот же суффикс что и открывающий

				// Ищем открывающий тег
				const tagStart = position + openingPrefix.length
				const tagEnd = input.indexOf(openingSuffix, tagStart)
				if (tagEnd === -1) return null

				const tagName = input.substring(tagStart, tagEnd)
				const closingTag = closingPrefix + tagName + closingSuffix

				// Ищем закрывающий тег после содержимого
				const contentEnd = input.indexOf(closingTag, tagEnd + openingSuffix.length)
				if (contentEnd === -1) return null

				currentPos = contentEnd + closingTag.length
			} else {
				// Fallback для простых случаев
				const endPatternIndex = input.indexOf(descriptor.endPattern, currentPos)
				if (endPatternIndex === -1) return null
				currentPos = endPatternIndex + descriptor.endPattern.length
			}
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
			// Специальная обработка для паттернов с повторяющимся __label__
			const labelCount = (markup.match(/__label__/g) || []).length
			if (labelCount > 1) {
				// Для паттернов типа <tag>content</tag>
				// innerContent = 'tag>content</tag'
				// Разбираем структуру паттерна
				const parts = markup.split(/__label__|__value__/).filter(p => p)
				if (parts.length >= 3) {
					const firstSeparator = parts[1] // между первым __label__ и __value__
					const secondSeparator = parts[2] // между __value__ и вторым __label__

					const firstSepIndex = innerContent.indexOf(firstSeparator)
					if (firstSepIndex !== -1) {
						label = innerContent.substring(0, firstSepIndex)

						const valueStart = firstSepIndex + firstSeparator.length
						const secondSepIndex = innerContent.indexOf(secondSeparator, valueStart)
						if (secondSepIndex !== -1) {
							value = innerContent.substring(valueStart, secondSepIndex)
						}
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
