import {Markup} from '../../../shared/types'
import {InnerOption} from '../../default/types'
import {NestedToken, TextToken, MarkToken} from './types'
import {createMarkupDescriptor, MarkupDescriptor} from './createMarkupDescriptor'

// Структура для отслеживания состояния парсинга маркера
interface MarkupParseState {
	descriptor: MarkupDescriptor
	startPosition: number // Позиция в исходной строке, где начался маркер
	phase: 'start' | 'middle' | 'end' | 'content' // Текущая фаза парсинга
	patternIndex: number // Индекс в текущем паттерне
	middlePatternIndex?: number // Индекс в массиве middlePatterns (если в фазе middle)
	contentPhase?: 'label' | 'value' // Тип контента, если в фазе content
	isActive: boolean // Маркер активен (не завершен и не в content фазе)
	nestingLevel?: number // Уровень вложенности скобок в content фазе
}

// Структура для хранения промежуточных токенов во время токенизации
interface TokenCandidate {
	position: number
	type: 'text' | 'mark'
	descriptor?: MarkupDescriptor
	endPosition?: number
}

export class ParserV2Matches {
	private input: string
	private markups: Markup[]
	private descriptors: MarkupDescriptor[] = []
	private descriptorsByTrigger: Map<string, MarkupDescriptor[]> = new Map()
	private isRoot: boolean

	constructor(input: string, markups: Markup[], isRoot = false) {
		this.input = input
		this.markups = markups
		this.isRoot = isRoot
		this.descriptors = this.markups.map(createMarkupDescriptor)

		for (const desc of this.descriptors) {
			if (!this.descriptorsByTrigger.has(desc.trigger)) {
				this.descriptorsByTrigger.set(desc.trigger, [])
			}
			this.descriptorsByTrigger.get(desc.trigger)!.push(desc)
		}
	}

	/**
	 * Полностью разбирает входную строку и возвращает массив токенов
	 */
	parse(): NestedToken[] {
		const candidates: TokenCandidate[] = []
		const activeStates = new Map<string, MarkupParseState[]>()

		// Токенизация: проходим по строке один раз
		for (let i = 0; i < this.input.length; i++) {
			const char = this.input[i]

			// Обрабатываем активные состояния
			const completedStates = this.processActiveStates(activeStates, char, i)

			// Добавляем завершенные состояния в кандидаты
			for (const state of completedStates) {
				candidates.push({
					position: state.startPosition,
					type: 'mark',
					descriptor: state.descriptor,
					endPosition: i + 1
				})
			}

			// Добавляем новых кандидатов (пока без блокировки)
			const newStates = this.createNewStates(char, i)
			for (const state of newStates) {
				const key = this.getStateKey(state)
				if (!activeStates.has(key)) {
					activeStates.set(key, [])
				}
				activeStates.get(key)!.push(state)
			}
		}

		// Постобработка: разрешаем конфликты и строим финальные токены
		return this.postProcessCandidates(candidates)
	}

	/**
	 * Обрабатывает активные состояния для текущего символа
	 * @returns массив завершенных состояний
	 */
	private processActiveStates(activeStates: Map<string, MarkupParseState[]>, char: string, position: number): MarkupParseState[] {
		const completedStates: MarkupParseState[] = []

		for (const [key, states] of activeStates) {
			const survivingStates: MarkupParseState[] = []

			for (const state of states) {
				const wasComplete = this.isParseStateComplete(state)
				const result = this.advanceParseState(state, char, position)
				const isComplete = this.isParseStateComplete(state)

				if (isComplete && !wasComplete) {
					// Состояние только что завершилось
					completedStates.push(state)
				} else if (result) {
					// Состояние продолжает быть активным
					survivingStates.push(state)
				}
				// Если result === false и состояние не завершено, оно невалидно - отбрасываем
			}

			if (survivingStates.length > 0) {
				activeStates.set(key, survivingStates)
			} else {
				activeStates.delete(key)
			}
		}

		return completedStates
	}


	/**
	 * Создает новые состояния для текущего символа
	 */
	private createNewStates(char: string, position: number): MarkupParseState[] {
		const newStates: MarkupParseState[] = []
		const candidates = this.descriptorsByTrigger.get(char) || []

		for (const desc of candidates) {
			if (this.input.startsWith(desc.startPattern, position)) {
				newStates.push({
					descriptor: desc,
					startPosition: position,
					phase: 'start',
					patternIndex: 1, // Первый символ уже проверили
					isActive: true,
				})
			}
		}

		return newStates
	}

	/**
	 * Получает ключ для состояния (для группировки в Map)
	 */
	private getStateKey(state: MarkupParseState): string {
		return `${state.descriptor.trigger}_${state.startPosition}_${state.phase}`
	}

	/**
	 * Постобработка кандидатов: разрешает конфликты и строит финальные токены
	 */
	private postProcessCandidates(candidates: TokenCandidate[]): NestedToken[] {
		// Сортируем кандидатов по позиции начала, затем по длине (длинные первыми)
		candidates.sort((a, b) => {
			if (a.position !== b.position) return a.position - b.position
			const aLen = (a.endPosition || 0) - a.position
			const bLen = (b.endPosition || 0) - b.position
			return bLen - aLen // Длинные маркеры первыми
		})

		// Разрешаем конфликты: выбираем непересекающиеся маркеры, предпочитая более длинные
		const selectedCandidates: TokenCandidate[] = []
		const usedPositions = new Set<number>()

		for (const candidate of candidates) {
			if (candidate.type === 'mark') {
				const start = candidate.position
				const end = candidate.endPosition || candidate.position + 1
				const conflicts = Array.from(usedPositions).some(pos => pos >= start && pos < end)

				if (!conflicts) {
					selectedCandidates.push(candidate)
					for (let i = start; i < end; i++) {
						usedPositions.add(i)
					}
				}
			}
		}

		// Сортируем выбранных кандидатов по позиции
		selectedCandidates.sort((a, b) => a.position - b.position)

		// Строим финальные токены с гарантированной структурой text-mark-text-mark-text...
		const tokens: NestedToken[] = []
		let currentPosition = 0

		// Обработка случая без маркеров - просто один text токен
		if (selectedCandidates.length === 0) {
			tokens.push({
				type: 'text',
				content: this.input,
				position: {
					start: 0,
					end: this.input.length
				}
			})
			return tokens
		}

		for (let i = 0; i < selectedCandidates.length; i++) {
			const candidate = selectedCandidates[i]
			const nextCandidate = selectedCandidates[i + 1]

			// Добавляем текст перед маркером
			if (candidate.position > currentPosition) {
				tokens.push({
					type: 'text',
					content: this.input.substring(currentPosition, candidate.position),
					position: {
						start: currentPosition,
						end: candidate.position
					}
				})
			} else if (tokens.length === 0) {
				// Первый маркер начинается с позиции 0, добавляем пустой text
				tokens.push({
					type: 'text',
					content: '',
					position: {
						start: 0,
						end: 0
					}
				})
			}

			// Добавляем маркер
			const markToken = this.createMarkTokenFromCandidate(candidate)
			if (markToken) {
				tokens.push(markToken)
				currentPosition = candidate.endPosition || candidate.position + 1
			}

			// Добавляем text токен после маркера
			if (nextCandidate) {
				// Есть следующий кандидат
				const nextStart = nextCandidate.position
				if (nextStart > currentPosition) {
					// Между маркерами есть текст
					tokens.push({
						type: 'text',
						content: this.input.substring(currentPosition, nextStart),
						position: {
							start: currentPosition,
							end: nextStart
						}
					})
					currentPosition = nextStart
				} else {
					// Следующий маркер начинается сразу, добавляем пустой text
					tokens.push({
						type: 'text',
						content: '',
						position: {
							start: currentPosition,
							end: currentPosition
						}
					})
				}
			} else {
				// Это последний маркер
				if (currentPosition < this.input.length) {
					// Есть оставшийся текст после маркера
					tokens.push({
						type: 'text',
						content: this.input.substring(currentPosition),
						position: {
							start: currentPosition,
							end: this.input.length
						}
					})
				} else {
					// Маркер в конце строки, добавляем пустой text
					tokens.push({
						type: 'text',
						content: '',
						position: {
							start: currentPosition,
							end: currentPosition
						}
					})
				}
			}
		}

		return tokens
	}

	/**
	 * Создает MarkToken из кандидата
	 */
	private createMarkTokenFromCandidate(candidate: TokenCandidate): MarkToken | null {
		if (!candidate.descriptor || !candidate.endPosition) return null

		const desc = candidate.descriptor
		const startPos = candidate.position
		const endPos = candidate.endPosition

		const markupContent = this.input.substring(startPos, endPos)

		// Создаем InnerOption для совместимости с parseMarkupContent
		const option: InnerOption = {
			markup: desc.markup,
			trigger: desc.trigger,
			data: [],
		}

		const {label, value} = this.parseMarkupContent(markupContent, option.markup!)
		const innerContent = this.extractInnerContent(markupContent, option.markup!)

		const children: NestedToken[] = []
		if (innerContent) {
			const innerParser = new ParserV2Matches(innerContent, this.markups)
			const innerTokens = innerParser.parse()
			// Добавляем children только если среди них есть маркеры
			const hasMarks = innerTokens.some(token => token.type === 'mark')
			if (hasMarks) {
				children.push(...innerTokens)
			}
		}

		return {
			type: 'mark',
			content: markupContent,
			position: {
				start: startPos,
				end: endPos,
			},
			data: {
				label,
				value,
				optionIndex: desc.index,
			},
			children,
		}
	}

	/**
	 * Продвигает состояние парсинга на один символ
	 * @param state Текущее состояние
	 * @param char Текущий символ
	 * @param position Текущая позиция в исходной строке
	 * @returns true если состояние все еще активно, false если завершено или невалидно
	 */
	private advanceParseState(state: MarkupParseState, char: string, position: number): boolean {
		const desc = state.descriptor

		switch (state.phase) {
			case 'start':
				if (state.patternIndex >= desc.startPattern.length) {
					// Переходим к следующей фазе
					this.transitionToNextPhase(state)
					// Обновляем isActive
					state.isActive = state.phase !== 'content' && !this.isParseStateComplete(state)
					return true
				}
				break

			case 'content':
				// В content фазе для маркеров с квадратными скобками считаем баланс скобок
				if (desc.startPattern.includes('[') && desc.endPattern.includes(']')) {
					if (char === '[') {
						// Увеличиваем уровень вложенности
						if (!state.nestingLevel) state.nestingLevel = 0
						state.nestingLevel++
					} else if (char === ']') {
						if (!state.nestingLevel) state.nestingLevel = 0
						if (state.nestingLevel === 0) {
							// Нашли закрывающую скобку на уровне 0 - это конец маркера
							this.transitionToNextPhase(state)
							state.isActive = state.phase !== 'content' && !this.isParseStateComplete(state)
							return this.advanceParseState(state, char, position)
						} else {
							state.nestingLevel--
						}
					}
				} else {
					// Для других типов маркеров просто проверяем следующий паттерн
					const nextPattern = this.getNextExpectedPattern(state)
					if (nextPattern && this.input.startsWith(nextPattern, position)) {
						// Нашли начало следующего паттерна - переходим к нему
						this.transitionToNextPhase(state)
						state.isActive = state.phase !== 'content' && !this.isParseStateComplete(state)
						return this.advanceParseState(state, char, position)
					}
				}
				// Продолжаем в content фазе
				state.isActive = false // Content не блокирует новые состояния
				return true

			case 'middle':
				const middlePatterns = desc.middlePatterns
				if (!middlePatterns || state.middlePatternIndex! >= middlePatterns.length) {
					// Переходим к end фазе
					state.phase = 'end'
					state.patternIndex = 0
					return true
				}

				const currentMiddle = middlePatterns[state.middlePatternIndex!]
				if (state.patternIndex >= currentMiddle.length) {
					// Переходим к следующему middle паттерну или content
					state.middlePatternIndex!++
					state.patternIndex = 0
					if (state.middlePatternIndex! >= middlePatterns.length) {
						this.transitionToNextPhase(state)
					}
					state.isActive = state.phase !== 'content' && !this.isParseStateComplete(state)
					return true
				}
				break

			case 'end':
				if (state.patternIndex >= desc.endPattern.length) {
					// Маркер завершен
					return false
				}
				// Продолжаем к проверке символа
		}

		// Проверяем соответствует ли символ текущему паттерну
		const expectedChar = this.getCurrentExpectedChar(state)
		if (expectedChar === char) {
			state.patternIndex++
			return true
		}

		// Символ не соответствует
		if (state.phase === 'content' || state.phase === 'end') {
			// В content и end фазах несоответствие означает, что мы продолжаем ожидать правильный символ/паттерн
			return true
		} else {
			// В start и middle фазах несоответствие делает состояние невалидным
			return false
		}
	}

	/**
	 * Переходит к следующей фазе парсинга
	 */
	private transitionToNextPhase(state: MarkupParseState): void {
		const desc = state.descriptor

		switch (state.phase) {
			case 'start':
				// После startPattern всегда идет content (label)
				state.phase = 'content'
				state.contentPhase = 'label'
				break

			case 'content':
				if (state.contentPhase === 'label') {
					if (desc.middlePatterns && desc.middlePatterns.length > 0) {
						state.phase = 'middle'
						state.middlePatternIndex = 0
						state.patternIndex = 0
					} else {
						state.phase = 'end'
						state.patternIndex = 0
					}
				} else if (state.contentPhase === 'value') {
					state.phase = 'end'
					state.patternIndex = 0
				}
				break

			case 'middle':
				if (desc.hasValue && state.middlePatternIndex === desc.middlePatterns!.length - 1) {
					state.phase = 'content'
					state.contentPhase = 'value'
				} else {
					state.phase = 'end'
					state.patternIndex = 0
				}
				break
		}
	}

	/**
	 * Возвращает текущий ожидаемый символ для состояния
	 */
	private getCurrentExpectedChar(state: MarkupParseState): string | null {
		const desc = state.descriptor

		switch (state.phase) {
			case 'start':
				return desc.startPattern[state.patternIndex] || null
			case 'middle':
				const middlePatterns = desc.middlePatterns
				if (middlePatterns && state.middlePatternIndex! < middlePatterns.length) {
					const currentMiddle = middlePatterns[state.middlePatternIndex!]
					return currentMiddle[state.patternIndex] || null
				}
				return null
			case 'end':
				return desc.endPattern[state.patternIndex] || null
			case 'content':
				return null // В content фазе любой символ принимается
		}
	}

	/**
	 * Возвращает следующий ожидаемый паттерн для состояния
	 */
	private getNextExpectedPattern(state: MarkupParseState): string | null {
		const desc = state.descriptor

		switch (state.phase) {
			case 'content':
				if (state.contentPhase === 'label') {
					if (desc.middlePatterns && desc.middlePatterns.length > 0) {
						return desc.middlePatterns[0]
					} else {
						return desc.endPattern
					}
				} else if (state.contentPhase === 'value') {
					return desc.endPattern
				}
				break
			case 'middle':
				if (desc.hasValue && state.middlePatternIndex === desc.middlePatterns!.length - 1) {
					return null // Следующий - content value, нет паттерна
				} else {
					return desc.endPattern
				}
			case 'start':
				return null // После start идет content
		}

		return null
	}

	/**
	 * Проверяет, завершено ли состояние парсинга
	 */
	private isParseStateComplete(state: MarkupParseState): boolean {
		return state.phase === 'end' && state.patternIndex >= state.descriptor.endPattern.length
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

				// Находим соответствующую закрывающую ] перед (
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
					label = content.substring(bracketStart + 1, bracketEnd)
					value = content.substring(parenStart + 1, parenEnd)
				}
			}
		} else if (markup.includes('__label__')) {
			// Формат #[__label__] - извлекаем label, останавливаясь на первом вложенном маркере
			const bracketStart = content.indexOf('[')
			const fullContent = content.substring(bracketStart + 1)

			// Ищем соответствующую закрывающую скобку
			let bracketCount = 1
			let labelEnd = -1
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
