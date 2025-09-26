import {Markup} from '../../../shared/types'
import {InnerOption} from '../../default/types'
import {NestedToken, TextToken, MarkToken} from './types'
import {createMarkupDescriptor, MarkupDescriptor} from './createMarkupDescriptor'

// Структура для отслеживания состояния парсинга маркера
interface MarkupParseState {
	descriptor: MarkupDescriptor
	startPosition: number // Позиция в исходной строке, где начался маркер
	phase: 'start' | 'middle' | 'end' // Текущая фаза парсинга
	patternIndex: number // Индекс в текущем паттерне
	middlePatternIndex?: number // Индекс в массиве middlePatterns (если в фазе middle)
}

export class ParserV2Matches implements IterableIterator<NestedToken> {
	private input: string
	private markups: Markup[]

	private position: number = 0
	private descriptors: MarkupDescriptor[] = []
	private descriptorsByTrigger: Map<string, MarkupDescriptor[]> = new Map()
	private lastTokenWasText: boolean = false // Начинаем с false, чтобы первый токен был text

	constructor(input: string, markups: Markup[]) {
		this.input = input
		this.markups = markups
		this.descriptors = this.markups.map(createMarkupDescriptor)

		for (const desc of this.descriptors) {
			if (!this.descriptorsByTrigger.has(desc.trigger)) {
				this.descriptorsByTrigger.set(desc.trigger, [])
			}
			this.descriptorsByTrigger.get(desc.trigger)!.push(desc)
		}
	}

	[Symbol.iterator](): IterableIterator<NestedToken> {
		return this
	}

	next(): IteratorResult<NestedToken, NestedToken | null> {
		const token = this.extractNextToken()
		if (token) {
			this.lastTokenWasText = token.type === 'text'
			return {done: false, value: token}
		}

		return {done: true, value: null}
	}

	private extractNextToken(): NestedToken | null {
		// Если мы в конце строки и последний токен был mark, возвращаем пустой text
		if (this.position >= this.input.length) {
			if (!this.lastTokenWasText) {
				this.lastTokenWasText = true
				return {
					type: 'text',
					content: '',
					position: {
						start: this.input.length,
						end: this.input.length,
					},
				}
			}
			return null
		}

		return this.processNextToken()
	}

	private processNextToken(): NestedToken | null {
		const rest = this.input.substring(this.position)

		// Ищем маркер на текущей позиции - выбираем самый длинный завершенный маркер
		let bestMarkToken: MarkToken | null = null
		let bestEndPosition = -1

		for (const [trigger, descriptors] of this.descriptorsByTrigger) {
			for (const desc of descriptors) {
				if (rest.startsWith(desc.startPattern)) {
					// Нашли начало маркера, проверяем можем ли завершить парсинг
					const endPosition = this.findMarkupEnd(desc, this.position)
					if (endPosition !== -1 && endPosition > bestEndPosition) {
						const markToken = this.createMarkTokenAtPosition(this.position, desc)
						if (markToken) {
							bestMarkToken = markToken
							bestEndPosition = endPosition
						}
					}
				}
			}
		}

		// Если нашли маркер, возвращаем его
		if (bestMarkToken) {
			// Если последний токен был mark, возвращаем text токен перед mark
			if (!this.lastTokenWasText) {
				const textToken: TextToken = {
					type: 'text',
					content: '',
					position: {
						start: this.position,
						end: this.position,
					},
				}
				return textToken
			} else {
				// Последний токен был text, возвращаем mark токен
				this.position = bestEndPosition
				return bestMarkToken
			}
		}

		// Маркера на позиции 0 нет, ищем следующий маркер
		for (let i = 1; i < rest.length; i++) {
			const char = rest[i]
			const descriptors = this.descriptorsByTrigger.get(char) || []

			for (const desc of descriptors) {
				if (rest.substring(i).startsWith(desc.startPattern)) {
					// Возвращаем text токен от текущей позиции до маркера
					const textContent = rest.substring(0, i)
					const textToken: TextToken = {
						type: 'text',
						content: textContent,
						position: {
							start: this.position,
							end: this.position + i,
						},
					}
					this.position += i
					return textToken
				}
			}
		}

		// Маркеров больше нет, возвращаем оставшийся текст
		return this.createRestTextToken()
	}



	/**
	 * Создает text токен из оставшегося содержимого строки
	 */
	private createRestTextToken(): TextToken {
		const remainingContent = this.input.substring(this.position)
		const textToken: TextToken = {
			type: 'text',
			content: remainingContent,
			position: {
				start: this.position,
				end: this.input.length,
			},
		}
		this.position = this.input.length
		return textToken
	}

	private findMarkupEnd(desc: MarkupDescriptor, startPos: number): number {
		if (desc.hasValue) {
			// Для маркеров со значением используем специальную логику
			let bracketCount = 1
			let foundClosingBracket = false

			for (let i = startPos + desc.startPattern.length; i < this.input.length; i++) {
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
					if (this.input[i] === ')') {
						return i + 1 // позиция после ')'
					}
				}
			}
			return -1
		} else {
			// Для простых маркеров используем общую логику
			if (desc.endPattern === '') {
				return this.input.length
			}

			let bracketCount = 0
			for (let i = startPos; i < this.input.length; i++) {
				const isStart = this.descriptors.some(d => this.input.startsWith(d.startPattern, i))
				if (isStart) {
					bracketCount++
				} else if (this.input.startsWith(desc.endPattern, i)) {
					bracketCount--
					if (bracketCount === 0) {
						return i + desc.endPattern.length
					}
				}
			}
			return -1
		}
	}

	private createMarkTokenAtPosition(position: number, desc: MarkupDescriptor): MarkToken | null {
		const markup = this.markups[desc.index]


		// Используем специальную логику для извлечения полного маркера
		let markupContent = ''
		let markupLength = 0

		if (desc.hasValue) {
			// Для "@[__label__](__value__)" находим ")" после value
			let bracketCount = 1
			let foundClosingBracket = false
			let parenStart = -1
			let parenEnd = -1

			for (let i = position + desc.startPattern.length; i < this.input.length; i++) {
				if (!foundClosingBracket) {
					// Для маркеров со значением, закрываем label по ']'
					// TODO: сделать более общим, парсить структуру
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
			// Для простых маркеров используем findMarkupEnd
			const endPos = this.findMarkupEnd(desc, position)
			if (endPos === -1) return null
			markupContent = this.input.substring(position, endPos)
			markupLength = markupContent.length
		}

		if (!markupContent) return null

		// Создаем InnerOption для совместимости с parseMarkupContent
		const option: InnerOption = {
			markup,
			trigger: desc.trigger,
			data: [],
		}

		// Извлекаем внутренний контент маркера для рекурсивного парсинга
		const innerContent = this.extractInnerContent(markupContent, option.markup!)

		// Рекурсивно парсим внутренний контент
		let children: NestedToken[] = []
		if (innerContent) {
			// Создаем новый парсер для внутреннего контента
			const innerParser = new ParserV2Matches(innerContent, this.markups)
			const innerTokens: NestedToken[] = []
			for (const token of innerParser) {
				innerTokens.push(token)
			}

			// Если среди токенов есть маркеры, сохраняем все токены как children
			// Если все токены - текст, то children остается пустым
			const hasMarks = innerTokens.some(token => token.type === 'mark')
			if (hasMarks) {
				children = innerTokens
			}
		}

		// Парсим label и value
		let label: string
		let value: string | undefined

		if (desc.hasValue) {
			// Для маркеров с value используем специальную логику парсинга
			const parsed = this.parseMarkupContent(markupContent, option.markup!)
			label = parsed.label
			value = parsed.value
		} else {
			// Для простых маркеров label - это полный внутренний контент
			label = innerContent || ''
			value = undefined
		}

		// Создаем mark token
		const markToken: MarkToken = {
			type: 'mark',
			content: markupContent,
			children,
			data: {
				label,
				value,
				optionIndex: desc.index,
			},
			position: {
				start: position,
				end: position + markupLength,
			},
		}

		return markToken
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

	private parseMarkupContent(content: string, markup: string): {label: string; value?: string} {
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

		return {label: label, value: value?.trim()}
	}
}
