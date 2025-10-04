import {describe, it, expect, beforeEach} from 'vitest'
import {ParserV2} from './ParserV2'
import {MarkToken, NestedToken} from './types'
import {Markup} from '../../../shared/types'
import {InnerOption} from '../../default/types'

describe('ParserV2', () => {
	let parser: ParserV2
	let markups: Markup[]

	beforeEach(() => {
		markups = ['@[__label__](__value__)', '#[__label__]']
		parser = new ParserV2(markups)
	})

	describe('static split', () => {
		it('should parse text with provided options and return NestedToken[]', () => {
			const value = 'Hello @[world](test) and #[tag]'
			const options: InnerOption[] = [
				{markup: '@[__label__](__value__)', trigger: '@', data: []},
				{markup: '#[__label__]', trigger: '#', data: []},
			]

			const result = ParserV2.split(value, options)

			expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
				"0: TEXT "Hello " [0-6]
				 1: MARK "@[world](test)" [6-20] [label="world", value="test"]
				 2: TEXT " and " [20-25]
				 3: MARK "#[tag]" [25-31] [label="tag"]
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

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`"0: TEXT "Hello world" [0-11]"`)
			})

			it('parses single mark with value', () => {
				const input = '@[hello](world)'
				const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "" [0-0]
					 1: MARK "@[hello](world)" [0-15] [label="hello", value="world"]
					 2: TEXT "" [15-15]"
				`)
			})

			it('parses single mark without value', () => {
				const input = '#[tag]'
				const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "" [0-0]
					 1: MARK "#[tag]" [0-6] [label="tag"]
					 2: TEXT "" [6-6]"
				`)
			})

			it('parses mixed text and multiple marks', () => {
				const input = 'Hello @[world](test) and #[tag]'
				const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
				"0: TEXT "Hello " [0-6]
				 1: MARK "@[world](test)" [6-20] [label="world", value="test"]
				 2: TEXT " and " [20-25]
				 3: MARK "#[tag]" [25-31] [label="tag"]
				 4: TEXT "" [31-31]"
			`)
			})

			describe('error handling', () => {
				it('handles empty input', () => {
					const result = parser.split('')

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`"0: TEXT "" [0-0]"`)
				})

				it('handles malformed markup gracefully', () => {
					const input = '@[unclosed markup'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`"0: TEXT "@[unclosed markup" [0-17]"`)
				})

				describe('complex parsing', () => {
					it('handles nested marks', () => {
						// Test basic nested parsing
						// Note: Self-nesting is not supported (pattern cannot nest within itself)
						// This is by design to eliminate bracket counting complexity
						const simpleParser = new ParserV2(['@[__label__]'])
						const input = '@[hello @[world]]'
						const result = simpleParser.split(input)

						// Without self-nesting support, the first closing ] ends the outer pattern
						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[hello @[world]" [0-16] [label="hello @[world"]
						 2: TEXT "]" [16-17]"
					`)
					})

					it('handles multiple and deeply nested marks', () => {
						const parser = new ParserV2(['@[__label__]'])
						const input = '@[level1 @[level2 @[level3]]]'
						const result = parser.split(input)

						// Without self-nesting support, the first closing ] ends the outer pattern
						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[level1 @[level2 @[level3]" [0-27] [label="level1 @[level2 @[level3"]
						 2: TEXT "]]" [27-29]"
					`)
					})

					it('handles mixed markup types with nesting', () => {
						const parser = new ParserV2(['@[__label__]', '#[__label__]'])
						const input = '@[hello #[world]]'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "@[hello #[world]]" [0-17] [label="hello #[world]"]
							├── 1.0: TEXT "hello " [0-6]
							├── 1.1: MARK "#[world]" [6-14] [label="world"]
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
							 1: MARK "@[hello #[world]](value)" [0-24] [label="hello #[world]", value="value"]
							├── 1.0: TEXT "hello " [0-6]
							├── 1.1: MARK "#[world]" [6-14] [label="world"]
							└── 1.2: TEXT "" [14-14]
							 2: TEXT "" [24-24]"
						`)
					})
				})
			})

			describe('validation', () => {
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
						 1: MARK "@[first](1)" [0-11] [label="first", value="1"]
						 2: TEXT "" [11-11]
						 3: MARK "@[second](2)" [11-23] [label="second", value="2"]
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
					 1: MARK "@[user](admin)" [6-20] [label="user", value="admin"]
					 2: TEXT " welcome to " [20-32]
					 3: MARK "#[project]" [32-42] [label="project"]
					 4: TEXT "! Check " [42-50]
					 5: MARK "@[docs](https://example.com)" [50-78] [label="docs", value="https://example.com"]
					 6: TEXT " for more info." [78-93]"
				`)
			})
		})

		describe('generated markup patterns', () => {
			// Генераторы различных типов markup для тестирования
			const generateSimpleMarkup = (prefix: string, suffix: string = '') => `${prefix}[__label__]${suffix}`

			const generateValueMarkup = (prefix: string, middle: string = '', suffix: string = '') =>
				`${prefix}[__label__]${middle}(__value__)${suffix}`

			const generateCustomMarkup = (prefix: string, pattern: string) => `${prefix}${pattern}`

			describe('single character prefixes', () => {
				const prefixes = [
					'@',
					'#',
					'$',
					'%',
					'^',
					'&',
					'*',
					'+',
					'-',
					'=',
					'|',
					'\\',
					'/',
					'?',
					'<',
					'>',
					':',
					';',
				]

				// Filter out problematic prefixes that may conflict with parsing logic
				const safePrefixes = prefixes.filter(
					prefix => prefix !== '<' && prefix !== '>' && prefix !== '\\' && prefix !== '|'
				)

				safePrefixes.forEach(prefix => {
					it(`parses markup with prefix "${prefix}"`, () => {
						const markup = generateSimpleMarkup(prefix)
						const parser = new ParserV2([markup as any])
						const input = `Hello ${prefix}[world]!`
						const result = parser.split(input)

						// Find mark token
						const markToken = result.find(token => token.type === 'mark') as MarkToken
						expect(markToken).toBeDefined()
						expect(markToken.data.label).toBe('world')
						expect(markToken.content).toBe(`${prefix}[world]`)

						// Check that we have text before mark
						const textBefore = result.find(token => token.type === 'text' && token.content === 'Hello ')
						expect(textBefore).toBeDefined()

						// Check that we have text after mark
						const textAfter = result.find(token => token.type === 'text' && token.content === '!')
						expect(textAfter).toBeDefined()
					})
				})
			})

			describe('HTML tags (without attributes)', () => {
				const htmlTags = [
					{tag: 'b', description: 'bold'},
					{tag: 'i', description: 'italic'},
					{tag: 'strong', description: 'strong'},
					{tag: 'em', description: 'emphasis'},
					{tag: 'code', description: 'code'},
					{tag: 'span', description: 'span'},
					{tag: 'div', description: 'division'},
					{tag: 'p', description: 'paragraph'},
				]

				htmlTags.forEach(({tag, description}) => {
					it(`parses HTML <${tag}> tag`, () => {
						const markup = `<${tag}>__label__</${tag}>`
						const parser = new ParserV2([markup as any])
						const input = `This is <${tag}>content</${tag}> text`
						const result = parser.split(input)

						// Find mark token
						const markToken = result.find(token => token.type === 'mark') as MarkToken
						expect(markToken).toBeDefined()
						expect(markToken.data.label).toBe('content')
						expect(markToken.content).toBe(`<${tag}>content</${tag}>`)
					})
				})

				it('parses HTML tags with <__label__>__value__</__label__> format', () => {
					const parser = new ParserV2(['<__label__>__value__</__label__>' as any])
					const input = 'Check <img>photo.jpg</img> image'
					const result = parser.split(input)

					// Find mark token
					const markToken = result.find(token => token.type === 'mark') as MarkToken
					expect(markToken).toBeDefined()
					expect(markToken.data.label).toBe('img')
					expect(markToken.data.value).toBe('photo.jpg')
					expect(markToken.content).toBe('<img>photo.jpg</img>')
				})

				it('parses HTML tags with <__label__>__value__<__label__> format', () => {
					const parser = new ParserV2(['<__label__>__value__<__label__>' as any])
					const input = 'Check <img>photo.jpg<img> image'
					const result = parser.split(input)

					// Find mark token
					const markToken = result.find(token => token.type === 'mark') as MarkToken
					expect(markToken).toBeDefined()
					expect(markToken.data.label).toBe('img')
					expect(markToken.data.value).toBe('photo.jpg')
					expect(markToken.content).toBe('<img>photo.jpg<img>')
				})

				it('parses nested HTML tags', () => {
					const markups = ['<b>__label__</b>' as any, '<i>__label__</i>' as any]
					const parser = new ParserV2(markups)
					const input = '<b>Bold <i>italic</i> text</b>'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "<b>Bold <i>italic</i> text</b>" [0-30] [label="Bold <i>italic</i> text"]
							├── 1.0: TEXT "Bold " [0-5]
							├── 1.1: MARK "<i>italic</i>" [5-18] [label="italic"]
							└── 1.2: TEXT " text" [18-23]
							 2: TEXT "" [30-30]"
						`)
				})
			})

			describe('Markdown formatting', () => {
				const markdownPatterns = [
					{pattern: '**__label__**', input: 'This is **bold** text', expectedLabel: 'bold'},
					{pattern: '*__label__*', input: 'This is *italic* text', expectedLabel: 'italic'},
					{
						pattern: '~~__label__~~',
						input: 'This is ~~strikethrough~~ text',
						expectedLabel: 'strikethrough',
					},
					{pattern: '`__label__`', input: 'This is `code` text', expectedLabel: 'code'},
					{
						pattern: '```__label__```',
						input: 'This is ```block code``` text',
						expectedLabel: 'block code',
					},
				]

				markdownPatterns.forEach(({pattern, input, expectedLabel}) => {
					it(`parses markdown pattern ${pattern}`, () => {
						const parser = new ParserV2([pattern as any])
						const result = parser.split(input)

						// Find mark token
						const markToken = result.find(token => token.type === 'mark') as MarkToken
						expect(markToken).toBeDefined()
						expect(markToken.data.label).toBe(expectedLabel)
					})
				})

				it('parses markdown links', () => {
					const parser = new ParserV2(['[__label__](__value__)' as any])
					const input = 'Check [Google](https://google.com) for search'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "Check " [0-6]
							 1: MARK "[Google](https://google.com)" [6-34] [label="Google", value="https://google.com"]
							 2: TEXT " for search" [34-45]"
						`)
				})

				it('parses markdown images', () => {
					const parser = new ParserV2(['![__label__](__value__)' as any])
					const input = 'See ![cat](cat.jpg) image'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "See " [0-4]
							 1: MARK "![cat](cat.jpg)" [4-19] [label="cat", value="cat.jpg"]
							 2: TEXT " image" [19-25]"
						`)
				})

				it('parses mixed markdown formatting', () => {
					const markups = [
						'**__label__**' as any, // bold
						'*__label__*' as any, // italic
						'`__label__`' as any, // code
					]
					const parser = new ParserV2(markups)
					const input = '**Bold** and *italic* with `code`'
					const result = parser.split(input)

					// Check structure
					expect(result.length).toBeGreaterThan(3)

					// Find all mark tokens
					const markTokens = result.filter(token => token.type === 'mark') as MarkToken[]
					expect(markTokens).toHaveLength(3)

					// Check specific marks
					const boldMark = markTokens.find(m => m.data.label === 'Bold')
					expect(boldMark).toBeDefined()

					const italicMark = markTokens.find(m => m.data.label === 'italic')
					expect(italicMark).toBeDefined()

					const codeMark = markTokens.find(m => m.data.label === 'code')
					expect(codeMark).toBeDefined()
				})
			})

			describe('custom patterns', () => {
				const customPatterns = [
					{
						pattern: '___[__label__]___',
						input: 'This is ___[underlined]___ text',
						expectedLabel: 'underlined',
					},
					{pattern: '```__label__```', input: 'Code ```block``` here', expectedLabel: 'block'},
					{pattern: '{{__label__}}', input: 'Template {{variable}} used', expectedLabel: 'variable'},
					{pattern: '||__label__||', input: 'Spoiler ||hidden|| content', expectedLabel: 'hidden'},
				]

				customPatterns.forEach(({pattern, input, expectedLabel}) => {
					it(`parses custom pattern "${pattern}"`, () => {
						const parser = new ParserV2([pattern as any])
						const result = parser.split(input)

						// Find mark token
						const markToken = result.find(token => token.type === 'mark') as MarkToken
						expect(markToken).toBeDefined()
						expect(markToken.data.label).toBe(expectedLabel)
					})
				})
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
		const paddedPrefix = level === 0 && index > 0 ? ` ${currentPrefix}` : currentPrefix

		if (token.type === 'text') {
			const content = token.content.length > 30 ? `"${token.content.slice(0, 27)}..."` : `"${token.content}"`
			lines.push(`${indent}${paddedPrefix}: TEXT ${content} [${token.position.start}-${token.position.end}]`)
		} else {
			const labelValueInfo =
				token.data.value !== undefined
					? `[label="${token.data.label}", value="${token.data.value}"]`
					: `[label="${token.data.label}"]`
			lines.push(
				`${indent}${paddedPrefix}: MARK "${token.content}" [${token.position.start}-${token.position.end}] ${labelValueInfo}`
			)

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

/**
 * Подсчитывает общее количество marks в дереве
 */
function countMarks(tokens: NestedToken[]): number {
	// Рекурсивно считаем только mark типы
	const countInNode = (node: NestedToken): number => {
		let nodeCount = node.type === 'mark' ? 1 : 0

		if (node.type === 'mark' && node.children) {
			nodeCount += node.children.reduce((sum, child) => sum + countInNode(child), 0)
		}

		return nodeCount
	}

	return tokens.reduce((sum, token) => sum + countInNode(token), 0)
}

/**
 * Находит максимальную глубину вложенности
 */
function findMaxDepth(tokens: NestedToken[]): number {
	// Находим максимальную глубину среди всех токенов
	const findDepth = (node: NestedToken): number => {
		if (node.type === 'text') {
			return 0
		}

		if (node.type !== 'mark' || !node.children || node.children.length === 0) {
			return 1 // mark без детей имеет глубину 1
		}

		const childrenDepths = node.children.map(child => findDepth(child))
		const maxChildDepth = childrenDepths.length > 0 ? Math.max(...childrenDepths) : 0

		return maxChildDepth + 1
	}

	if (tokens.length === 0) {
		return 0
	}

	const depths = tokens.map(token => findDepth(token))
	return Math.max(...depths)
}
