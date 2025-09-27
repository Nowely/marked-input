import {MarkupDescriptor} from '../createMarkupDescriptor'
import {MatchResult, MarkupStrategy} from '../types'

/**
 * Стратегия парсинга для маркеров с круглыми скобками: @[__label__](__value__)
 */
export class ParenMarkupStrategy implements MarkupStrategy {
	matches(descriptor: MarkupDescriptor, input: string, position: number): MatchResult | null {
		// Проверяем, что начинаем с правильного паттерна
		if (!input.startsWith(descriptor.startPattern, position)) {
			return null
		}

		const startPos = position
		let bracketCount = 1
		let parenCount = 0
		let foundClosingBracket = false
		let currentPos = position + descriptor.startPattern.length

		// Ищем соответствующую закрывающую скобку для label, затем круглую скобку для value
		while (currentPos < input.length) {
			const char = input[currentPos]

			if (!foundClosingBracket) {
				// Ищем закрывающую квадратную скобку для label
				if (char === '[') {
					bracketCount++
				} else if (char === ']') {
					bracketCount--
					if (bracketCount === 0) {
						foundClosingBracket = true
					}
				}
			} else {
				// Ищем закрывающую круглую скобку для value
				if (char === ')') {
					break
				}
			}

			currentPos++
		}

		if (!foundClosingBracket || input[currentPos] !== ')') {
			// Не нашли правильную структуру
			return null
		}

		const endPos = currentPos + 1
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

		// Находим позицию начала label после startPattern
		const labelStart = startPattern.length

		// Ищем конец label (закрывающую квадратную скобку)
		let bracketCount = 1
		let labelEnd = labelStart
		let parenStart = -1

		for (let i = labelStart; i < content.length; i++) {
			const char = content[i]

			if (char === '[') {
				bracketCount++
			} else if (char === ']') {
				bracketCount--
				if (bracketCount === 0) {
					labelEnd = i
					// Следующий символ должен быть '('
					if (content[i + 1] === '(') {
						parenStart = i + 1
					}
					break
				}
			}
		}

		if (parenStart === -1) {
			// Неправильная структура, возвращаем только label
			const label = content.substring(labelStart, labelEnd)
			return { label, value: undefined }
		}

		// Ищем закрывающую круглую скобку
		let parenEnd = parenStart + 1
		for (let i = parenStart + 1; i < content.length; i++) {
			if (content[i] === ')') {
				parenEnd = i
				break
			}
		}

		const label = content.substring(labelStart, labelEnd)
		const value = content.substring(parenStart + 1, parenEnd)

		return { label, value }
	}
}
