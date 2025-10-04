import {Markup} from '../../../shared/types'
import {NestedToken, TextToken, MarkToken, MatchResult} from './types'
import {ParserV2} from './ParserV2'

/**
 * Создает text токен
 */
function createTextToken(input: string, start: number, end: number): TextToken {
	return {
		type: 'text',
		content: input.substring(start, end),
		position: {
			start,
			end
		}
	}
}

/**
 * Извлекает внутренний контент маркера для рекурсивного парсинга
 * Просто возвращает label, который уже содержит текст между первой парой сегментов
 */
function extractInnerContent(match: MatchResult): string | null {
	// label уже содержит текст между первой парой сегментов (gap типа 'label')
	// Это было извлечено в AhoCorasickMarkupStrategy.extractFromParts()
	return match.label || null
}

/**
 * Создает mark токен из матча
 */
function createMarkToken(input: string, markups: Markup[], parser: ParserV2, match: MatchResult): MarkToken {
	const children: NestedToken[] = []

	// Извлекаем внутренний контент для рекурсивного парсинга
	const innerContent = extractInnerContent(match)

	if (innerContent && parser) {
		// Рекурсивно парсим внутренний контент (переиспользуем ParserV2 инстанс)
		const innerTokens = parser.split(innerContent)

		// Добавляем children только если среди них есть маркеры
		const hasMarks = innerTokens.some((token: NestedToken) => token.type === 'mark')
		if (hasMarks) {
			children.push(...innerTokens)
		}
	}

	return {
		type: 'mark',
		content: match.content,
		children,
		data: {
			label: match.label,
			value: match.value,
			optionIndex: match.descriptor.index
		},
		position: {
			start: match.start,
			end: match.end
		}
	}
}

/**
 * Строит гарантированную последовательность токенов text-mark-text-mark-text...
 */
export function buildGuaranteedSequence(
	input: string,
	markups: Markup[],
	parser: ParserV2,
	matches: MatchResult[]
): NestedToken[] {
	if (matches.length === 0) {
		// Если нет маркеров, возвращаем один text токен
		return [{
			type: 'text',
			content: input,
			position: {
				start: 0,
				end: input.length
			}
		}]
	}

	const tokens: NestedToken[] = []
	let currentPosition = 0

	for (let i = 0; i < matches.length; i++) {
		const match = matches[i]
		const nextMatch = matches[i + 1]

		// Добавляем текст перед маркером (если есть)
		if (match.start > currentPosition) {
			tokens.push(createTextToken(input, currentPosition, match.start))
		} else if (tokens.length === 0) {
			// Первый маркер начинается с позиции 0, добавляем пустой text
			tokens.push(createTextToken(input, 0, 0))
		}

		// Добавляем маркер
		tokens.push(createMarkToken(input, markups, parser, match))

		// Обновляем текущую позицию
		currentPosition = match.end

		// Добавляем текст между маркерами (если есть следующий матч)
		if (nextMatch) {
			const nextStart = nextMatch.start

			if (nextStart > currentPosition) {
				// Есть текст между маркерами
				tokens.push(createTextToken(input, currentPosition, nextStart))
				currentPosition = nextStart
			} else {
				// Следующий маркер начинается сразу, добавляем пустой text
				tokens.push(createTextToken(input, currentPosition, currentPosition))
			}
		} else {
			// Это последний маркер
			if (currentPosition < input.length) {
				// Есть оставшийся текст после маркера
				tokens.push(createTextToken(input, currentPosition, input.length))
			} else {
				// Маркер в конце строки, добавляем пустой text
				tokens.push(createTextToken(input, currentPosition, currentPosition))
			}
		}
	}

	return tokens
}
