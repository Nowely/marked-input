import {NestedToken, ValidationResult, MarkToken} from './types'
import {InnerOption} from '../../default/types'

/**
 * Type guard to check if token is a MarkToken with children
 */
const isMarkToken = (token: NestedToken): token is MarkToken => {
	return token.type === 'mark'
}

/**
 * Валидирует содержимое на наличие опасных конструкций (XSS защита)
 */
export const validateNestedContent = (content: string): boolean => {
	const dangerousPatterns = [
		/<script/i,
		/javascript:/i,
		/on\w+\s*=/i,
		/<iframe/i,
		/<object/i,
		/<embed/i,
		/<form/i,
		/<input/i,
		/<button/i,
		/<a\s+href\s*=\s*["']?\s*javascript:/i
	]

	return !dangerousPatterns.some(pattern => pattern.test(content))
}

/**
 * Проверяет максимальную глубину вложенности для защиты от DoS
 */
export const validateNestingDepth = (token: NestedToken, maxDepth: number = 10): boolean => {
	const checkDepth = (node: NestedToken, currentDepth: number): boolean => {
		if (currentDepth > maxDepth) return false

		if (isMarkToken(node)) {
			return node.children?.every((child: NestedToken) =>
				checkDepth(child, currentDepth + 1)
			) ?? true
		}

		return true // TextToken has no children, so depth check passes
	}

	return checkDepth(token, 0)
}

/**
 * Полная валидация структуры дерева
 */
export const validateTreeStructure = (tokens: NestedToken[]): ValidationResult => {
	const errors: string[] = []

	const validateNode = (node: NestedToken, path: number[] = []): void => {
		// Проверка обязательных полей
		if (!node.type) {
			errors.push(`Missing type at path ${path.join('.')}`)
		}

		if (!node.content && node.content !== '') {
			errors.push(`Missing content at path ${path.join('.')}`)
		}

		if (!node.position || typeof node.position.start !== 'number' || typeof node.position.end !== 'number') {
			errors.push(`Invalid position at path ${path.join('.')}`)
		}

		// Проверка типа mark
		if (node.type === 'mark') {
			if (!node.data) {
				errors.push(`Missing data for mark node at path ${path.join('.')}`)
			} else {
				if (typeof node.data.label !== 'string') {
					errors.push(`Invalid label for mark node at path ${path.join('.')}`)
				}
				if (typeof node.data.optionIndex !== 'number') {
					errors.push(`Invalid optionIndex for mark node at path ${path.join('.')}`)
				}
			}
		}

		// Проверка children
		if (isMarkToken(node) && node.children) {
			if (!Array.isArray(node.children)) {
				errors.push(`Children is not an array at path ${path.join('.')}`)
			} else {
				node.children.forEach((child: NestedToken, index: number) => {
					validateNode(child, [...path, index])
				})
			}
		}

		// Проверка позиций
		if (node.position.start > node.position.end) {
			errors.push(`Invalid position range at path ${path.join('.')}`)
		}

		// Проверка пересечения позиций siblings
		if (isMarkToken(node) && node.children && node.children.length > 1) {
			for (let i = 0; i < node.children.length - 1; i++) {
				const current = node.children[i]
				const next = node.children[i + 1]

				if (current.position.end > next.position.start) {
					errors.push(`Overlapping positions between children at path ${path.join('.')}`)
				}
			}
		}
	}

	tokens.forEach((token, index) => validateNode(token, [index]))
	return { isValid: errors.length === 0, errors }
}

/**
 * Проверяет корректность разметки
 */
export const validateMarkup = (content: string, options: InnerOption[]): ValidationResult => {
	const errors: string[] = []

	// Проверка на незакрытые markup
	const openBrackets = (content.match(/\[/g) || []).length
	const closeBrackets = (content.match(/\]/g) || []).length

	if (openBrackets !== closeBrackets) {
		errors.push('Unmatched brackets in markup')
	}

	const openParens = (content.match(/\(/g) || []).length
	const closeParens = (content.match(/\)/g) || []).length

	if (openParens !== closeParens) {
		errors.push('Unmatched parentheses in markup')
	}

	// Проверка на корректные плейсхолдеры
	const hasLabelPlaceholder = content.includes('__label__')
	const hasValuePlaceholder = content.includes('__value__')

	if (!hasLabelPlaceholder) {
		errors.push('Missing __label__ placeholder in markup')
	}

	return { isValid: errors.length === 0, errors }
}

/**
 * Подсчитывает общее количество marks в дереве
 */
export const countMarks = (tokens: NestedToken[]): number => {
	// Рекурсивно считаем только mark типы
	const countInNode = (node: NestedToken): number => {
		let nodeCount = node.type === 'mark' ? 1 : 0

		if (isMarkToken(node) && node.children) {
			nodeCount += node.children.reduce((sum, child) => sum + countInNode(child), 0)
		}

		return nodeCount
	}

	return tokens.reduce((sum, token) => sum + countInNode(token), 0)
}

/**
 * Находит максимальную глубину вложенности
 */
export const findMaxDepth = (tokens: NestedToken[]): number => {
	// Находим максимальную глубину среди всех токенов
	const findDepth = (node: NestedToken): number => {
		if (node.type === 'text') {
			return 0
		}

		if (!isMarkToken(node) || !node.children || node.children.length === 0) {
			return 1 // mark без детей имеет глубину 1
		}

		const childrenDepths = node.children.map(child => findDepth(child))
		const maxChildDepth = childrenDepths.length > 0 ? Math.max(...childrenDepths) : 0

		return maxChildDepth + 1
	}

	const depths = tokens.map(token => findDepth(token))
	return depths.length > 0 ? Math.max(...depths) : 0
}
