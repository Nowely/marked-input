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

		// Находим позицию __label__ в шаблоне
		const labelPlaceholder = '__label__'
		const labelIndex = markup.indexOf(labelPlaceholder)

		if (labelIndex === -1) {
			return { label: '' }
		}

		// Вычисляем позицию label в контенте относительно startPattern
		const startPattern = match.descriptor.startPattern
		const labelStart = startPattern.length
		const labelLength = content.length - startPattern.length - match.descriptor.endPattern.length

		let label: string
		let value: string | undefined

		if (match.descriptor.hasValue) {
			// Для паттернов с value нужно найти границы
			const valuePlaceholder = '__value__'
			const valueIndex = markup.indexOf(valuePlaceholder)

			if (valueIndex > labelIndex) {
				// __value__ идет после __label__
				const middlePattern = markup.substring(labelIndex + labelPlaceholder.length, valueIndex)
				const labelEndPattern = middlePattern || match.descriptor.endPattern

				// Ищем конец label
				const labelEndIndex = content.indexOf(labelEndPattern, labelStart)
				if (labelEndIndex !== -1) {
					label = content.substring(labelStart, labelEndIndex)

					// Ищем value
					const valueStart = labelEndIndex + labelEndPattern.length
					const valueEndIndex = content.indexOf(match.descriptor.endPattern, valueStart)
					if (valueEndIndex !== -1) {
						value = content.substring(valueStart, valueEndIndex)
					}
				} else {
					label = content.substring(labelStart, labelStart + labelLength)
				}
			} else {
				// Упрощенная логика для паттернов без сложной структуры
				label = content.substring(labelStart, labelStart + labelLength)
			}
		} else {
			// Для простых паттернов весь контент между start и end - это label
			label = content.substring(labelStart, labelStart + labelLength)
		}

		return { label: label || '', value }
	}
}
