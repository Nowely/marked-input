import {Markup} from '../../../shared/types'
import {NestedToken, TextToken, MarkToken, TokenCandidate, MatchResult} from './types'

/**
 * Компонент для построения гарантированной последовательности токенов text-mark-text-mark-text...
 */
export class TokenSequenceBuilder {
	private readonly input: string
	private readonly markups: Markup[]
	private readonly parser: any // ParserV2 instance for recursion

	constructor(input: string, markups: Markup[], parser?: any) {
		this.input = input
		this.markups = markups
		this.parser = parser
	}

	/**
	 * Строит гарантированную последовательность токенов
	 */
	buildGuaranteedSequence(candidates: TokenCandidate[]): NestedToken[] {
		if (candidates.length === 0) {
			// Если нет маркеров, возвращаем один text токен
			return [{
				type: 'text',
				content: this.input,
				position: {
					start: 0,
					end: this.input.length
				}
			}]
		}

		const tokens: NestedToken[] = []
		let currentPosition = 0

		for (let i = 0; i < candidates.length; i++) {
			const candidate = candidates[i]
			const nextCandidate = candidates[i + 1]
			const match = candidate.match

			// Добавляем текст перед маркером (если есть)
			if (match.start > currentPosition) {
				tokens.push(this.createTextToken(currentPosition, match.start))
			} else if (tokens.length === 0) {
				// Первый маркер начинается с позиции 0, добавляем пустой text
				tokens.push(this.createTextToken(0, 0))
			}

			// Добавляем маркер
			tokens.push(this.createMarkToken(match))

			// Обновляем текущую позицию
			currentPosition = match.end

			// Добавляем текст между маркерами (если есть следующий кандидат)
			if (nextCandidate) {
				const nextStart = nextCandidate.match.start

				if (nextStart > currentPosition) {
					// Есть текст между маркерами
					tokens.push(this.createTextToken(currentPosition, nextStart))
					currentPosition = nextStart
				} else {
					// Следующий маркер начинается сразу, добавляем пустой text
					tokens.push(this.createTextToken(currentPosition, currentPosition))
				}
			} else {
				// Это последний маркер
				if (currentPosition < this.input.length) {
					// Есть оставшийся текст после маркера
					tokens.push(this.createTextToken(currentPosition, this.input.length))
				} else {
					// Маркер в конце строки, добавляем пустой text
					tokens.push(this.createTextToken(currentPosition, currentPosition))
				}
			}
		}

		return tokens
	}

	/**
	 * Создает text токен
	 */
	private createTextToken(start: number, end: number): TextToken {
		return {
			type: 'text',
			content: this.input.substring(start, end),
			position: {
				start,
				end
			}
		}
	}

	/**
	 * Создает mark токен из матча
	 */
	private createMarkToken(match: MatchResult): MarkToken {
		const children: NestedToken[] = []

		// Извлекаем внутренний контент для рекурсивного парсинга
		const innerContent = this.extractInnerContent(match.content, match.descriptor.markup)

		if (innerContent && this.parser) {
			// Рекурсивно парсим внутренний контент (переиспользуем ParserV2 инстанс)
			const innerTokens = this.parser.split(innerContent)

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
	 * Извлекает внутренний контент маркера для рекурсивного парсинга
	 */
	private extractInnerContent(content: string, markup: string): string | null {
		// Для простоты используем ту же логику, что и в старом коде
		// TODO: можно вынести в отдельный утилитный класс

		if (markup.includes('__label__') && markup.includes('__value__')) {
			// Формат @[__label__](__value__)
			const bracketStart = content.indexOf('[')
			const parenStart = content.indexOf('(')

			if (bracketStart !== -1 && parenStart !== -1) {
				let bracketEnd = -1
				let bracketCount = 1

				for (let i = bracketStart + 1; i < parenStart; i++) {
					if (content[i] === '[') {
						bracketCount++
					} else if (content[i] === ']') {
						bracketCount--
						if (bracketCount === 0) {
							bracketEnd = i
							break
						}
					}
				}

				if (bracketEnd !== -1) {
					return content.substring(bracketStart + 1, bracketEnd)
				}
			}
		} else if (markup.includes('__label__')) {
			// Формат #[__label__]
			const bracketStart = content.indexOf('[')
			let bracketEnd = -1
			let bracketCount = 1

			for (let i = bracketStart + 1; i < content.length; i++) {
				if (content[i] === '[') {
					bracketCount++
				} else if (content[i] === ']') {
					bracketCount--
					if (bracketCount === 0) {
						bracketEnd = i
						break
					}
				}
			}

			if (bracketStart !== -1 && bracketEnd !== -1) {
				return content.substring(bracketStart + 1, bracketEnd)
			}
		}

		return null
	}
}
