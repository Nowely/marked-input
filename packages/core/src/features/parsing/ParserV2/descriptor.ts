import {PLACEHOLDER} from '../../../shared/constants'
import {Markup} from '../../../shared/types'

export interface MarkupDescriptor {
	/** Index in the markups array */
	index: number
	/** Trigger symbol (first character, used for grouping) */
	trigger: string
	/** Start pattern (full prefix before __label__, e.g., '@[') */
	startPattern: string
	/** End pattern (full suffix after __label__, e.g., ']') */
	endPattern: string

	/** Middle patterns between start and end patterns */
	middlePatterns?: [string] | [string, string]

	/** Whether the markup has a __value__ part */
	hasValue: boolean
	/** Whether the markup has two __label__ placeholders */
	hasTwoLabels: boolean
}

/**
 * Создает дескриптор разметки из строки шаблона разметки
 * @param markup - Строка шаблона разметки (например, '@[__label__](__value__)' или '<__label__>__value__</__label__>')
 * @param index - Индекс разметки в массиве
 * @returns MarkupDescriptor с предобработанными статическими частями
 */
export function createDescriptor(markup: Markup, index: number): MarkupDescriptor {
	const hasTwoLabels = 2 === getPlaceholderCount(markup, PLACEHOLDER.LABEL, [1, 2])
	const hasValue = 1 === getPlaceholderCount(markup, PLACEHOLDER.VALUE, [0, 1])

	hasValue && validatePlaceholderOrder(markup)

	const parts = parseMarkupStructure(markup)

	return {
		index,
		trigger: parts.trigger,
		startPattern: parts.startPattern,
		endPattern: parts.endPattern,
		middlePatterns: parts.middlePatterns,
		hasValue,
		hasTwoLabels,
	}
}

/**
 * Parses markup structure into components
 */
function parseMarkupStructure(markup: string): {
	trigger: string
	startPattern: string
	endPattern: string
	middlePatterns?: [string] | [string, string]
} {
	// Создаем regex для всех плейсхолдеров
	const placeholderPattern = new RegExp(`(${PLACEHOLDER.LABEL}|${PLACEHOLDER.VALUE})`, 'g')

	// Разделяем разметку по плейсхолдерам
	const parts: string[] = []
	let lastIndex = 0
	let match

	while ((match = placeholderPattern.exec(markup)) !== null) {
		// Добавляем часть перед плейсхолдером
		if (match.index > lastIndex) {
			parts.push(markup.substring(lastIndex, match.index))
		}
		// Добавляем сам плейсхолдер
		parts.push(match[1])
		lastIndex = match.index + match[0].length
	}

	// Добавляем оставшуюся часть
	if (lastIndex < markup.length) {
		parts.push(markup.substring(lastIndex))
	}

	// startPattern - первый префикс
	const startPattern = parts[0] || ''
	if (startPattern.length === 0 || startPattern.includes('__label__') || startPattern.includes('__value__')) {
		throw new Error(`Invalid markup format: "${markup}". Markup must start with a prefix before placeholders`)
	}

	const trigger = startPattern.charAt(0)

	// endPattern - последний суффикс
	const endPattern = parts[parts.length - 1] || ''

	// middlePatterns - части между плейсхолдерами
	const middlePatterns: string[] = []

	for (let i = 2; i < parts.length - 1; i += 2) {
		const middle = parts[i]
		// Если middle содержит плейсхолдеры, извлекаем только статические части
		if (middle.includes('__value__')) {
			// Для случаев типа ">__value__</" извлекаем ">" и "</"
			const valueIndex = middle.indexOf('__value__')
			const beforeValue = middle.substring(0, valueIndex)
			const afterValue = middle.substring(valueIndex + '__value__'.length)
			if (beforeValue) middlePatterns.push(beforeValue)
			if (afterValue) middlePatterns.push(afterValue)
		} else {
			// Обычный middle pattern
			middlePatterns.push(middle)
		}
	}

	return {
		trigger,
		startPattern,
		endPattern,
		middlePatterns: middlePatterns.length > 0 ? (middlePatterns as [string] | [string, string]) : undefined
	}
}

/**
 * Validates the number of occurrences of a placeholder in markup
 * @param markup - The markup string to validate
 * @param placeholder - The placeholder to search for
 * @param allowedCounts - Array of allowed occurrence counts
 * @returns The actual number of occurrences found
 * @throws Error if the count is not in allowedCounts
 */
function getPlaceholderCount(markup: string, placeholder: string, allowedCounts: number[]): number {
	let count = 0
	let position = 0

	while ((position = markup.indexOf(placeholder, position)) !== -1) {
		count++
		position += placeholder.length
	}

	if (!allowedCounts.includes(count)) {
		throw new Error(
			`Invalid markup format: "${markup}". ` +
				`Expected ${allowedCounts.join(' or ')} "${placeholder}" placeholder(s), but found ${count}`
		)
	}

	return count
}

/**
 * Validates that __value__ does not appear before __label__ in markup
 * @param markup - The markup string to validate
 * @throws Error if __value__ appears before __label__
 */
function validatePlaceholderOrder(markup: string): void {
	const valueIndex = markup.indexOf(PLACEHOLDER.VALUE)
	const labelIndex = markup.indexOf(PLACEHOLDER.LABEL)

	if (valueIndex < labelIndex) {
		throw new Error(
			`Invalid markup format: "${markup}". ` +
			`"${PLACEHOLDER.VALUE}" cannot appear before "${PLACEHOLDER.LABEL}"`
		)
	}
}
