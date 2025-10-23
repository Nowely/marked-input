import {bench, describe} from 'vitest'
import {Parser} from '../../core/src/features/parsing/Parser/Parser'
import {Parser as ParserV2} from '../../core/src/features/parsing/ParserV2/index'

// Создаем текст с настоящей вложенностью
function createNestedText(depth = 2, marks = 5): string {
	let result = 'Start '
	for (let i = 0; i < marks; i++) {
		result += `#[tag${i}`
		// Добавляем вложенность
		for (let d = 0; d < depth; d++) {
			result += ` @[user${i}_${d}](User ${i}_${d})`
		}
		result += `] `
	}
	result += 'end.'
	return result
}

describe('Nested Structure Performance: v1 vs v2', () => {
	const markups = ['@[__label__](__value__)', '#[__label__]']
	const parserV1 = new Parser(markups)
	const parserV2 = new ParserV2(markups)

	const testCases = [
		{ depth: 1, marks: 5, name: 'shallow nesting' },
		{ depth: 2, marks: 5, name: 'medium nesting' },
		{ depth: 3, marks: 3, name: 'deep nesting' }
	]

	testCases.forEach(({ depth, marks, name }) => {
		const testText = createNestedText(depth, marks)

		describe(`${name} (depth: ${depth}, marks: ${marks})`, () => {
			console.log(`Test text: "${testText}"`)

			bench(`Parser v1 (flat) - ${name}`, () => {
				try {
					parserV1.split(testText)
				} catch (e) {
					// Parser v1 может не справиться с вложенностью
					console.log(`Parser v1 failed: ${e}`)
				}
			}, {
				time: 1000,
				iterations: 10
			})

			bench(`Parser v2 (nested) - ${name}`, () => {
				parserV2.split(testText)
			}, {
				time: 1000,
				iterations: 10
			})
		})
	})
})
