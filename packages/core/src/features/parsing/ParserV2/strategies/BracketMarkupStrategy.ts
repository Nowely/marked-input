import {MarkupDescriptor} from '../createMarkupDescriptor'
import {MatchResult, MarkupStrategy} from '../types'

/**
 * Стратегия парсинга для маркеров в квадратных скобках: #[__label__]
 */
export class BracketMarkupStrategy implements MarkupStrategy {
	matches(descriptor: MarkupDescriptor, input: string, position: number): MatchResult | null {
		// Проверяем, что начинаем с правильного паттерна
		if (!input.startsWith(descriptor.startPattern, position)) {
			return null
		}

		const startPos = position
		let bracketCount = 1
		let currentPos = position + descriptor.startPattern.length

		// Ищем соответствующую закрывающую скобку
		while (currentPos < input.length) {
			const char = input[currentPos]

			if (char === '[') {
				bracketCount++
			} else if (char === ']') {
				bracketCount--
				if (bracketCount === 0) {
					// Нашли закрывающую скобку
					currentPos++
					break
				}
			}

			currentPos++
		}

		if (bracketCount !== 0) {
			// Не нашли соответствующую закрывающую скобку
			return null
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
		const startPattern = match.descriptor.startPattern

		// Находим позицию начала контента после startPattern
		const contentStart = startPattern.length

		// Ищем конец label (закрывающую скобку)
		let bracketCount = 1
		let labelEnd = contentStart

		for (let i = contentStart; i < content.length; i++) {
			const char = content[i]

			if (char === '[') {
				bracketCount++
			} else if (char === ']') {
				bracketCount--
				if (bracketCount === 0) {
					labelEnd = i
					break
				}
			}
		}

		const label = content.substring(contentStart, labelEnd)

		return { label, value: undefined }
	}
}
