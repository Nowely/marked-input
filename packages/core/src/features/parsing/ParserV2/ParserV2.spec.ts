import {describe, it, expect, beforeEach} from 'vitest'
import {ParserV2} from './ParserV2'
import {validateTreeStructure, countMarks, findMaxDepth} from './validation'
import {MarkToken, NestedToken} from './types'

describe('ParserV2', () => {
	let parser: ParserV2
	let markups: any[]

	beforeEach(() => {
		markups = ['@[__label__](__value__)', '#[__label__]']
		parser = new ParserV2(markups)
	})

	describe('static split', () => {
		it('should parse text with provided options and return NestedToken[]', () => {
			const value = 'Hello @[world](test) and #[tag]'
			const options = [
				{markup: '@[__label__](__value__)' as any, trigger: '@', data: []},
				{markup: '#[__label__]' as any, trigger: '#', data: []},
			]

			const result = ParserV2.split(value, options)

			expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "Hello " [0-6]
					1: MARK @[world(test)] [6-20]
					2: TEXT " and " [20-25]
					3: MARK @[tag] [25-31]
					4: TEXT "" [31-31]"
				`)
		})

		it('should handle text without options', () => {
			const value = 'Hello world'
			const result = ParserV2.split(value)

			expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`""`)
		})
	})

	describe('parsing', () => {
		describe('basic functionality', () => {
			it('parses plain text without markups', () => {
				const input = 'Hello world'
				const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "Hello world" [0-11]"
				`)
			})

			it('parses single mark with value', () => {
				const input = '@[hello](world)'
				const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "" [0-0]
					1: MARK @[hello(world)] [0-15]
					2: TEXT "" [15-15]"
				`)
			})

			it('parses single mark without value', () => {
				const input = '#[tag]'
				const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "" [0-0]
					1: MARK @[tag] [0-6]
					2: TEXT "" [6-6]"
				`)
			})

			it('parses mixed text and multiple marks', () => {
				const input = 'Hello @[world](test) and #[tag]'
				const result = parser.split(input)

			expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "Hello " [0-6]
					1: MARK @[world(test)] [6-20]
					2: TEXT " and " [20-25]
					3: MARK @[tag] [25-31]
					4: TEXT "" [31-31]"
				`)
			})

			describe('error handling', () => {
				it('handles empty input', () => {
					const result = parser.split('')

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "" [0-0]"
				`)
				})

				it('handles malformed markup gracefully', () => {
					const input = '@[unclosed markup'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "@[unclosed markup" [0-17]"
					`)
				})

				describe('complex parsing', () => {
					it('handles nested marks', () => {
						// Test basic nested parsing
						const simpleParser = new ParserV2(['@[__label__]'])
						const input = '@[hello @[world]]'
						const result = simpleParser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							1: MARK @[hello @[world]] [0-17]
							├── 1.0: TEXT "hello " [0-6]
							├── 1.1: MARK @[world] [6-14]
							└── 1.2: TEXT "" [14-14]
							2: TEXT "" [17-17]"
						`)
					})

					it('handles multiple and deeply nested marks', () => {
						const parser = new ParserV2(['@[__label__]'])
						const input = '@[level1 @[level2 @[level3]]]'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							1: MARK @[level1 @[level2 @[level3]]] [0-29]
							├── 1.0: TEXT "level1 " [0-7]
							├── 1.1: MARK @[level2 @[level3]] [7-26]
							│   ├── 1.1.0: TEXT "level2 " [0-7]
							│   ├── 1.1.1: MARK @[level3] [7-16]
							│   └── 1.1.2: TEXT "" [16-16]
							└── 1.2: TEXT "" [26-26]
							2: TEXT "" [29-29]"
						`)
					})

					it('handles mixed markup types with nesting', () => {
						const parser = new ParserV2(['@[__label__]', '#[__label__]'])
						const input = '@[hello #[world]]'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							1: MARK @[hello #[world]] [0-17]
							├── 1.0: TEXT "hello " [0-6]
							├── 1.1: MARK @[world] [6-14]
							└── 1.2: TEXT "" [14-14]
							2: TEXT "" [17-17]"
						`)
					})

					it('handles marks with values and nesting', () => {
						const parser = new ParserV2(['@[__label__](__value__)', '#[__label__]'])
						const input = '@[hello #[world]](value)'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							1: MARK @[hello #[world](value)] [0-24]
							├── 1.0: TEXT "hello " [0-6]
							├── 1.1: MARK @[world] [6-14]
							└── 1.2: TEXT "" [14-14]
							2: TEXT "" [24-24]"
						`)
					})
				})
			})

			describe('validation', () => {
				it('should validate correct tree structure', () => {
					const input = 'Hello @[world](test)'
					const result = parser.split(input)
					const validation = validateTreeStructure(result)

					expect(validation).toMatchInlineSnapshot(`
				{
				  "errors": [],
				  "isValid": true,
				}
			`)
				})

				it('should count marks correctly', () => {
					const input = 'Hello @[world](test) and #[tag1] #[tag2]'
					const result = parser.split(input)
					const markCount = countMarks(result)

					expect(markCount).toMatchInlineSnapshot(`3`)
				})

				it('should calculate max depth correctly', () => {
					const input = 'Hello @[world](test)'
					const result = parser.split(input)
					const maxDepth = findMaxDepth(result)

					expect(maxDepth).toMatchInlineSnapshot(`1`)
				})
			})

			describe('edge cases', () => {
				it('handles adjacent marks', () => {
					const input = '@[first](1)@[second](2)'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						1: MARK @[first(1)] [0-11]
						2: TEXT "" [11-11]
						3: MARK @[second(2)] [11-23]
						4: TEXT "" [23-23]"
					`)
				})
			})
		})

		describe('integration', () => {
			it('handles complex real-world scenarios', () => {
				const input =
					'Hello @[user](admin) welcome to #[project]! Check @[docs](https://example.com) for more info.'
				const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "Hello " [0-6]
					1: MARK @[user(admin)] [6-20]
					2: TEXT " welcome to " [20-32]
					3: MARK @[project] [32-42]
					4: TEXT "! Check " [42-50]
					5: MARK @[docs(https://example.com)] [50-78]
					6: TEXT " for more info." [78-93]"
				`)
			})
		})
	})
})

function tokensToDebugTree(tokens: NestedToken[], level = 0, prefix = ''): string {
	const lines: string[] = []

	tokens.forEach((token, index) => {
		const currentPrefix = prefix + (prefix ? '.' : '') + index
		const isLast = index === tokens.length - 1
		const indent = level > 0 ? '│   '.repeat(level - 1) + (isLast ? '└── ' : '├── ') : ''

		if (token.type === 'text') {
			const content = token.content.length > 30 ? `"${token.content.slice(0, 27)}..."` : `"${token.content}"`
			lines.push(`${indent}${currentPrefix}: TEXT ${content} [${token.position.start}-${token.position.end}]`)
		} else {
			// Показываем метку и значение отдельно
			const markInfo =
				token.data.value !== undefined ? `${token.data.label}(${token.data.value})` : token.data.label
			lines.push(`${indent}${currentPrefix}: MARK @[${markInfo}] [${token.position.start}-${token.position.end}]`)

			if (token.children.length > 0) {
				const childLines = tokensToDebugTree(token.children, level + 1, currentPrefix)
				if (childLines.trim()) {
					lines.push(childLines)
				}
			}
		}
	})

	return lines.join('\n')
}
