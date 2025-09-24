import {Markup} from '../../../shared/types'
import {InnerOption} from '../../default/types'
import {NestedToken, TextToken, MarkToken} from './types'

export class ParserV2Matches implements IterableIterator<NestedToken> {
	done: boolean = false
	private input: string
	private markups: Markup[]
	private position: number = 0
	private hasReturnedToken: boolean = false

	constructor(input: string, markups: Markup[]) {
		this.input = input
		this.markups = markups
	}

	[Symbol.iterator](): IterableIterator<NestedToken> {
		return this
	}

	next(): IteratorResult<NestedToken, NestedToken | null> {
		if (this.done) return {done: this.done, value: null}

		const token = this.extractNextNestedToken()
		if (token === null) {
			this.done = true
			// последний токен остаток текста
			const remainingContent = this.input.substring(this.position)
			// Для пустой строки или если мы уже вернули токены, возвращаем финальный текст
			// Но если remainingContent пустой и мы уже вернули токен, не возвращаем пустой текст
			if (remainingContent === '' && this.hasReturnedToken) {
				return {done: true, value: null}
			}
			return {done: false, value: {
				type: 'text',
				content: remainingContent,
				position: {
					start: this.position,
					end: this.input.length
				}
			}}
		}

		this.hasReturnedToken = true
		return {done: false, value: token}
	}

	private extractNextNestedToken(): NestedToken | null {
		if (this.position >= this.input.length) {
			return null
		}

		const remaining = this.input.substring(this.position)

		// Ищем следующий маркер
		for (let markupIndex = 0; markupIndex < this.markups.length; markupIndex++) {
			const markup = this.markups[markupIndex]
			const option = this.createOptionFromMarkup(markup, markupIndex)

			const markupStartIndex = this.findMarkupStart(remaining, markup)

			if (markupStartIndex !== -1) {
				// Нашли маркер
				const markupPosition = this.position + markupStartIndex

				// Если есть текст перед маркером, возвращаем его сначала
				if (markupStartIndex > 0) {
					const textContent = remaining.substring(0, markupStartIndex)
					// Не возвращаем пустые текстовые токены
					if (textContent === '') {
						this.position = markupPosition
						// Продолжаем к обработке маркера
					} else {
						const textToken: TextToken = {
							type: 'text',
							content: textContent,
							position: {
								start: this.position,
								end: markupPosition
							}
						}
						this.position = markupPosition
						return textToken
					}
				}

				// Маркер найден на текущей позиции, обрабатываем его
				const markToken = this.createMarkTokenAtPosition(markupPosition, option, markupIndex)
				this.position = markupPosition + markToken.content.length
				return markToken
			}
		}

		// Маркер не найден, возвращаем null чтобы следующий next() вернул оставшийся текст
		return null
	}

	private createMarkTokenAtPosition(position: number, option: InnerOption, optionIndex: number): MarkToken {
		const markup = option.markup!

		// Используем специальную логику для извлечения полного маркера
		let markupContent = ''
		let markupLength = 0

		if (markup.includes('__label__') && !markup.includes('__value__')) {
			// Для "@[__label__]" находим соответствующую закрывающую скобку
			let bracketCount = 1
			let endPos = position + 2 // После "@["

			for (let i = endPos; i < this.input.length; i++) {
				if (this.input[i] === '[') {
					bracketCount++
				} else if (this.input[i] === ']') {
					bracketCount--
					if (bracketCount === 0) {
						markupContent = this.input.substring(position, i + 1)
						markupLength = markupContent.length
						break
					}
				}
			}
		} else if (markup.includes('__label__') && markup.includes('__value__')) {
			// Для "@[__label__](__value__)" находим "(" после label, затем соответствующую ")"
			let bracketCount = 1
			let foundClosingBracket = false
			let parenStart = -1
			let parenEnd = -1

			for (let i = position + 2; i < this.input.length; i++) {
				if (!foundClosingBracket) {
					if (this.input[i] === '[') {
						bracketCount++
					} else if (this.input[i] === ']') {
						bracketCount--
						if (bracketCount === 0) {
							foundClosingBracket = true
						}
					}
				} else {
					if (this.input[i] === '(') {
						parenStart = i
					} else if (this.input[i] === ')') {
						parenEnd = i
						markupContent = this.input.substring(position, parenEnd + 1)
						markupLength = markupContent.length
						break
					}
				}
			}
		} else {
			// Для других маркеров используем простой regex
			const escapedMarkup = markup
				.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
				.replace(/__label__/g, '([^\\]]+)')
				.replace(/__value__/g, '([^)]+)')

			const regex = new RegExp(escapedMarkup)
			const remaining = this.input.substring(position)
			const match = remaining.match(regex)

			if (!match) {
				throw new Error(`Failed to match markup at position ${position}`)
			}

			markupContent = match[0]
			markupLength = markupContent.length
		}

		if (!markupContent) {
			throw new Error(`Failed to extract markup content at position ${position}`)
		}

		// Парсим label и value
		const { label, value } = this.parseMarkupContent(markupContent, markup)

		// Извлекаем внутренний контент маркера для потенциального рекурсивного парсинга
		const innerContent = this.extractInnerContent(markupContent, markup)

		// Рекурсивно парсим внутренний контент, но берем только маркеры
		let children: NestedToken[] = []
		if (innerContent) {
			// Создаем новый парсер для внутреннего контента
			const innerParser = new ParserV2Matches(innerContent, this.markups)
			const innerTokens: NestedToken[] = []
			for (const token of innerParser) {
				innerTokens.push(token)
			}
			// Берем только маркеры из распарсенного контента (текст уже в label)
			children = innerTokens.filter(token => token.type === 'mark')
		}

		// Создаем mark token
		const markToken: MarkToken = {
			type: 'mark',
			content: markupContent,
			children,
			data: {
				label,
				value,
				optionIndex
			},
			position: {
				start: position,
				end: position + markupLength
			}
		}

		return markToken
	}



	private createOptionFromMarkup(markup: Markup, index: number): InnerOption {
		return {
			markup,
			trigger: markup.charAt(0),
			data: []
		}
	}

	private findMarkupStart(remaining: string, markup: string): number {
		// Для маркеров с __label__ используем специальную логику для учета вложенных скобок
		if (markup.includes('__label__') && !markup.includes('__value__')) {
			// Ищем trigger + "[" в remaining
			const trigger = markup.charAt(0)
			const triggerBracket = trigger + '['
			const triggerBracketIndex = remaining.indexOf(triggerBracket)
			if (triggerBracketIndex === -1) return -1

			// Находим соответствующую закрывающую скобку
			let bracketCount = 1
			for (let i = triggerBracketIndex + 2; i < remaining.length; i++) {
				if (remaining[i] === '[') {
					bracketCount++
				} else if (remaining[i] === ']') {
					bracketCount--
					if (bracketCount === 0) {
						// Нашли соответствующую ], проверяем, что следующий символ - конец или не часть маркера
						if (i + 1 >= remaining.length || remaining[i + 1] !== '(') {
							return triggerBracketIndex
						}
					}
				}
			}
			return -1
		} else if (markup.includes('__label__') && markup.includes('__value__')) {
			// Ищем trigger + "[" в remaining
			const trigger = markup.charAt(0)
			const triggerBracket = trigger + '['
			const atBracketIndex = remaining.indexOf(triggerBracket)
			if (atBracketIndex === -1) return -1

			// Находим соответствующую закрывающую скобку перед "("
			let bracketCount = 1
			let foundClosingBracket = false
			let closingBracketIndex = -1

			for (let i = atBracketIndex + 2; i < remaining.length; i++) {
				if (!foundClosingBracket) {
					if (remaining[i] === '[') {
						bracketCount++
					} else if (remaining[i] === ']') {
						bracketCount--
						if (bracketCount === 0) {
							foundClosingBracket = true
						}
					}
				} else {
					if (remaining[i] === '(') {
						// Нашли "(" после закрывающей скобки, проверяем что это наш маркер
						return atBracketIndex
					}
				}
			}
			return -1
		} else {
			// Для других маркеров используем простой regex
			const escapedMarkup = markup
				.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Экранируем специальные символы
				.replace(/__label__/g, '([^\\]]+)')     // Заменяем __label__ на группу захвата
				.replace(/__value__/g, '([^)]+)')       // Заменяем __value__ на группу захвата

			const regex = new RegExp(escapedMarkup)
			const match = remaining.match(regex)

			return match ? match.index! : -1
		}
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

	private getInnerContentOffset(content: string, markup: string, innerContent: string): number {
		// Находим позицию innerContent внутри content
		const index = content.indexOf(innerContent)
		return index !== -1 ? index : 0
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
				// Находим конец label, учитывая вложенные маркеры
				const labelContent = content.substring(bracketStart + 1, parenStart - 1) // Контент между [ и (

				// Ищем первый вложенный маркер в label
				const nestedMarkerIndex = Math.min(
					labelContent.indexOf('@') !== -1 ? labelContent.indexOf('@') : Infinity,
					labelContent.indexOf('#') !== -1 ? labelContent.indexOf('#') : Infinity
				)

				let labelEnd
				if (nestedMarkerIndex !== Infinity) {
					// Есть вложенный маркер, label заканчивается перед ним
					labelEnd = bracketStart + 1 + nestedMarkerIndex
				} else {
					// Нет вложенных маркеров, находим соответствующую закрывающую ] перед (
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
					labelEnd = bracketEnd
				}

				if (labelEnd !== -1) {
					label = content.substring(bracketStart + 1, labelEnd)
					value = content.substring(parenStart + 1, parenEnd)
				}
			}
		} else if (markup.includes('__label__')) {
			// Формат #[__label__] - извлекаем label, останавливаясь на первом вложенном маркере
			const bracketStart = content.indexOf('[')
			const fullContent = content.substring(bracketStart + 1)

			// Ищем первый символ, который может быть началом вложенного маркера
			// Для простоты ищем '@' или '#', так как они наиболее распространены
			const nestedMarkerIndex = Math.min(
				fullContent.indexOf('@') !== -1 ? fullContent.indexOf('@') : Infinity,
				fullContent.indexOf('#') !== -1 ? fullContent.indexOf('#') : Infinity
			)
			let labelEnd = -1

			if (nestedMarkerIndex !== Infinity) {
				// Есть вложенный маркер, берем текст до него
				labelEnd = nestedMarkerIndex
			} else {
				// Нет вложенных маркеров, ищем соответствующую закрывающую скобку
				let bracketCount = 1
				for (let i = 1; i < fullContent.length; i++) {
					if (fullContent[i] === '[') {
						bracketCount++
					} else if (fullContent[i] === ']') {
						bracketCount--
						if (bracketCount === 0) {
							labelEnd = i
							break
						}
					}
				}
			}

			if (bracketStart !== -1 && labelEnd !== -1) {
				label = fullContent.substring(0, labelEnd)
			} else if (bracketStart !== -1) {
				// Fallback: берем все до соответствующей скобки
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
				if (bracketEnd !== -1) {
					label = content.substring(bracketStart + 1, bracketEnd)
				}
			}
		}

		return { label: label, value: value?.trim() }
	}

}
