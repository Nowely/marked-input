import {Markup} from '../../../shared/types'
import {InnerOption} from '../../default/types'
import {NestedToken, TextToken, MarkToken} from './types'

export class ParserV2Matches implements IterableIterator<NestedToken> {
	done: boolean = false
	private tokens: NestedToken[] = []
	private position: number = 0
	private markups: Markup[]

	constructor(input: string, markups: Markup[]) {
		this.markups = markups
		this.tokens = this.parseTokens(input, markups)
	}

	[Symbol.iterator](): IterableIterator<NestedToken> {
		return this
	}

	next(): IteratorResult<NestedToken, NestedToken | null> {
		if (this.done || this.position >= this.tokens.length) {
			this.done = true
			return {done: this.done, value: null}
		}

		const token = this.tokens[this.position]
		this.position++

		return {done: false, value: token}
	}


	private parseTokens(input: string, markups: Markup[]): NestedToken[] {
		const result: NestedToken[] = []

		if (!input) {
			return result
		}

		let position = 0
		let currentTextStart = 0

		while (position < input.length) {
			let foundMarkup = false

			// Ищем подходящий markup, начиная с текущей позиции
			for (let markupIndex = 0; markupIndex < markups.length; markupIndex++) {
				const markup = markups[markupIndex]
				const option = this.createOptionFromMarkup(markup, markupIndex)

				const remaining = input.substring(position)
				const markupStartIndex = this.findMarkupStart(remaining, markup)

				if (markupStartIndex !== -1) { // Нашли markup в оставшейся строке
					const markupPosition = position + markupStartIndex

					// Добавляем текст перед маркером, если есть
					if (markupPosition > currentTextStart) {
						this.addTextToken(
							result,
							input.substring(currentTextStart, markupPosition),
							currentTextStart,
							markupPosition
						)
					}

					// Перемещаемся к позиции маркера
					position = markupPosition

					// Обрабатываем markup
					const newPosition = this.handleMarkup(result, input, position, option, markupIndex)
					position = newPosition
					currentTextStart = position
					foundMarkup = true
					break
				}
			}

			if (!foundMarkup) {
				position++
			}
		}

		// Добавляем оставшийся текст
		if (currentTextStart < input.length) {
			this.addTextToken(
				result,
				input.substring(currentTextStart),
				currentTextStart,
				input.length
			)
		}

		return result
	}

	private createOptionFromMarkup(markup: Markup, index: number): InnerOption {
		return {
			markup,
			trigger: markup.charAt(0),
			data: []
		}
	}

	private findMarkupStart(remaining: string, markup: string): number {
		// Создаем регулярное выражение для поиска markup с любым содержимым в плейсхолдерах
		const escapedMarkup = markup
			.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Экранируем специальные символы
			.replace(/__label__/g, '([^\\]]+)')     // Заменяем __label__ на группу захвата
			.replace(/__value__/g, '([^)]+)')       // Заменяем __value__ на группу захвата

		const regex = new RegExp(escapedMarkup)
		const match = remaining.match(regex)

		return match ? match.index! : -1
	}

	private addTextToken(result: NestedToken[], text: string, start: number, end: number) {
		if (!text) return

		const textToken: TextToken = {
			type: 'text',
			content: text,
			position: { start, end }
		}

		result.push(textToken)
	}

	private handleMarkup(result: NestedToken[], input: string, position: number, option: InnerOption, optionIndex: number): number {
		const markup = option.markup!

		// Создаем regex для поиска полного совпадения
		const escapedMarkup = markup
			.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			.replace(/__label__/g, '([^\\]]+)')
			.replace(/__value__/g, '([^)]+)')

		const regex = new RegExp(escapedMarkup)
		const remaining = input.substring(position)
		const match = remaining.match(regex)

		if (!match) return position

		const markupContent = match[0]
		const markupLength = markupContent.length

		// Парсим label и value
		const { label, value } = this.parseMarkupContent(markupContent, markup)

		// Извлекаем внутренний контент маркера для потенциального рекурсивного парсинга
		const innerContent = this.extractInnerContent(markupContent, markup)

		// Создаем mark token
		const markToken: MarkToken = {
			type: 'mark',
			content: markupContent,
			children: innerContent ? this.parseTokens(innerContent, this.markups) : [], // Рекурсивно парсим внутренний контент
			markData: {
				label,
				value,
				optionIndex
			},
			position: {
				start: position,
				end: position + markupLength
			}
		}

		result.push(markToken)

		// Возвращаем новую позицию
		return position + markupLength
	}

	private extractInnerContent(content: string, markup: string): string | null {
		// Извлекаем label как внутренний контент для рекурсивного парсинга
		if (markup.includes('__label__') && markup.includes('__value__')) {
			// Формат @[__label__](__value__)
			// Находим границы label между [ и ]
			const bracketStart = content.indexOf('[')
			const parenStart = content.indexOf('(')

			if (bracketStart !== -1 && parenStart !== -1) {
				// Ищем соответствующую закрывающую ] перед (
				let bracketEnd = -1
				let bracketCount = 1 // Мы уже внутри открывающей скобки

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
			// Формат #[__label__] - находим соответствующую закрывающую скобку
			const bracketStart = content.indexOf('[')
			let bracketEnd = -1
			let bracketCount = 1 // Мы уже внутри открывающей скобки

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

	private parseMarkupContent(content: string, markup: string): { label: string; value?: string } {
		// Парсим на основе структуры шаблона
		let label = ''
		let value: string | undefined

		if (markup.includes('__label__') && markup.includes('__value__')) {
			// Формат @[__label__](__value__)
			// Ищем позиции в контенте
			const bracketStart = content.indexOf('[')
			const parenStart = content.indexOf('(')
			const parenEnd = content.lastIndexOf(')')

			if (bracketStart !== -1 && parenStart !== -1 && parenEnd !== -1) {
				// Находим соответствующую закрывающую ] перед (
				let bracketEnd = -1
				let bracketCount = 1 // Мы уже внутри открывающей скобки

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
					label = content.substring(bracketStart + 1, bracketEnd)
					value = content.substring(parenStart + 1, parenEnd)
				}
			}
		} else if (markup.includes('__label__')) {
			// Формат #[__label__] - находим соответствующую закрывающую скобку
			const bracketStart = content.indexOf('[')
			let bracketEnd = -1
			let bracketCount = 1 // Мы уже внутри открывающей скобки

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
				label = content.substring(bracketStart + 1, bracketEnd)
			}
		}

		return { label: label.trim(), value: value?.trim() }
	}
}
