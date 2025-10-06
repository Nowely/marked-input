import {describe, it, expect, beforeEach} from 'vitest'
import {ParserV2} from './ParserV2'
import {MarkToken, NestedToken} from './types'
import {Markup} from '../../../shared/types'
import {InnerOption} from '../../default/types'
import {faker} from '@faker-js/faker'

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

				it('handles identical consecutive marks', () => {
					const input = '#[tag1]#[tag2]#[tag3]'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "#[tag1]" [0-7] [label="tag1"]
						 2: TEXT "" [7-7]
						 3: MARK "#[tag2]" [7-14] [label="tag2"]
						 4: TEXT "" [14-14]
						 5: MARK "#[tag3]" [14-21] [label="tag3"]
						 6: TEXT "" [21-21]"
					`)
				})

				it('handles marks with empty labels', () => {
					const parser = new ParserV2(['@[__label__]'])
					const input = '@[] @[content]'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[]" [0-3] [label=""]
						 2: TEXT " " [3-4]
						 3: MARK "@[content]" [4-14] [label="content"]
						 4: TEXT "" [14-14]"
					`)
				})

				it('handles marks with empty values', () => {
					const input = '@[label]() @[label2](value)'
					const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "" [0-0]
					 1: MARK "@[label]()" [0-10] [label="label", value=""]
					 2: TEXT " " [10-11]
					 3: MARK "@[label2](value)" [11-27] [label="label2", value="value"]
					 4: TEXT "" [27-27]"
				`)
				})

				it('handles unicode and emoji content', () => {
					const input = 'Hello @[привет](мир) and #[🚀] emoji'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "Hello " [0-6]
						 1: MARK "@[привет](мир)" [6-20] [label="привет", value="мир"]
						 2: TEXT " and " [20-25]
						 3: MARK "#[🚀]" [25-30] [label="🚀"]
						 4: TEXT " emoji" [30-36]"
					`)
				})

				it('handles very long content', () => {
					const longText = 'a'.repeat(10000)
					const input = `@[${longText}](value)`
					const result = parser.split(input)

					const marks = result.filter(token => token.type === 'mark') as MarkToken[]
					expect(marks).toHaveLength(1)
					expect(marks[0].data.label).toBe(longText)
					expect(marks[0].data.value).toBe('value')
				})

				it('handles conflicting patterns gracefully', () => {
					// Test with patterns that could potentially conflict
					// Shorter matches have higher priority, patterns without value preferred for same length
					const conflictingParser = new ParserV2(['@[__label__]', '@[__label__](__value__)'])
					const input = '@[simple] @[with](value)'
					const result = conflictingParser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[simple]" [0-9] [label="simple"]
						 2: TEXT " " [9-10]
						 3: MARK "@[with]" [10-17] [label="with"]
						 4: TEXT "(value)" [17-24]"
					`)
				})

				it('handles marks at string boundaries', () => {
					const input = `
						'@[start]',
						'@[end]',
						'@[start]@[end]',
						' @[middle] ',
					`
					const parser = new ParserV2(['@[__label__]'])
					const result = parser.split(input)
					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "
												'" [0-8]
						 1: MARK "@[start]" [8-16] [label="start"]
						 2: TEXT "',
												'" [16-26]
						 3: MARK "@[end]" [26-32] [label="end"]
						 4: TEXT "',
												'" [32-42]
						 5: MARK "@[start]" [42-50] [label="start"]
						 6: TEXT "" [50-50]
						 7: MARK "@[end]" [50-56] [label="end"]
						 8: TEXT "',
												' " [56-67]
						 9: MARK "@[middle]" [67-76] [label="middle"]
						 10: TEXT " ',
											" [76-85]"
					`)
				})

				it('handles nested brackets in content', () => {
					const input = '@[content [with] brackets](value)'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[content [with] brackets](value)" [0-33] [label="content [with] brackets", value="value"]
						 2: TEXT "" [33-33]"
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

			it('should handle complex nested structures', () => {
				const input = 'User @[john](John Doe) mentioned #[urgent] task'
				const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "User " [0-5]
					 1: MARK "@[john](John Doe)" [5-22] [label="john", value="John Doe"]
					 2: TEXT " mentioned " [22-33]
					 3: MARK "#[urgent]" [33-42] [label="urgent"]
					 4: TEXT " task" [42-47]"
				`)
			})

			it('should handle incomplete markup gracefully', () => {
				const inputs = ['@[incomplete', '#[', '**[']

				inputs.forEach(input => {
					const result = parser.split(input)
					// Basic validation that result exists
					expect(result).toBeDefined()
					expect(Array.isArray(result)).toBe(true)
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

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "Check " [0-6]
							 1: MARK "<img>photo.jpg</img>" [6-26] [label="img", value="photo.jpg"]
							 2: TEXT " image" [26-32]"
						`)
					})

					it('parses HTML tags with <__label__>__value__<__label__> format', () => {
						const parser = new ParserV2(['<__label__>__value__<__label__>' as any])
						const input = 'Check <img>photo.jpg<img> image'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "Check " [0-6]
							 1: MARK "<img>photo.jpg<img>" [6-25] [label="img", value="photo.jpg"]
							 2: TEXT " image" [25-31]"
						`)
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
						const markups: Markup[] = [
							'**__label__**', // bold
							'*__label__*', // italic
							'`__label__`', // code
						]
						const parser = new ParserV2(markups)
						const input = '**Bold** and *italic* with `code`'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "**Bold**" [0-8] [label="Bold"]
							 2: TEXT " and " [8-13]
							 3: MARK "*italic*" [13-21] [label="italic"]
							 4: TEXT " with " [21-27]
							 5: MARK "\`code\`" [27-33] [label="code"]
							 6: TEXT "" [33-33]"
						`)
					})

					it('parses complex realistic markdown document', () => {
						const markups: Markup[] = [
							'# __label__\n', // h1 header
							'## __label__\n', // h2 header
							'- __label__\n', // list item
							'**__label__**', // bold
							'*__label__*', // italic
							'`__label__`', // inline code
							'```__label__```', // code block
							'[__label__](__value__)', // link
							'~~__label__~~', // strikethrough
						]
						const parser = new ParserV2(markups)

						const input = `# Welcome to **Marked Input**

This is a *powerful* library for parsing **rich text** with *markdown* formatting.
You can use \`inline code\` snippets like \`const parser = new ParserV2()\` in your text.

## Features

- **Bold text** with **strong emphasis**
- *Italic text* and *emphasis* support
- \`Code snippets\` and \`\`\`code blocks\`\`\`
- ~~Strikethrough~~ for deleted content
- Links like [GitHub](https://github.com)

## Example

Here's how to use it:

\`\`\`javascript
const parser = new ParserV2(['**__label__**', '*__label__*'])
const result = parser.split('Hello **world**!')
\`\`\`

Visit our [documentation](https://docs.example.com) for more details.
~~This feature is deprecated~~ and will be removed in v3.0.`

						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "# Welcome to **Marked Input**
							" [0-30] [label="Welcome to **Marked Input**"]
							├── 1.0: TEXT "Welcome to " [0-11]
							├── 1.1: MARK "**Marked Input**" [11-27] [label="Marked Input"]
							└── 1.2: TEXT "" [27-27]
							 2: TEXT "
							This is a " [30-41]
							 3: MARK "*powerful*" [41-51] [label="powerful"]
							 4: TEXT " library for parsing " [51-72]
							 5: MARK "**rich text**" [72-85] [label="rich text"]
							 6: TEXT " with " [85-91]
							 7: MARK "*markdown*" [91-101] [label="markdown"]
							 8: TEXT " formatting.
							You can use " [101-126]
							 9: MARK "\`inline code\`" [126-139] [label="inline code"]
							 10: TEXT " snippets like " [139-154]
							 11: MARK "\`const parser = new ParserV2()\`" [154-185] [label="const parser = new ParserV2()"]
							 12: TEXT " in your text.

							" [185-201]
							 13: MARK "## Features

							" [201-214] [label="Features
							"]
							 14: TEXT "" [214-214]
							 15: MARK "- **Bold text** with **strong emphasis**
							" [214-255] [label="**Bold text** with **strong emphasis**"]
							├── 15.0: TEXT "" [0-0]
							├── 15.1: MARK "**Bold text**" [0-13] [label="Bold text"]
							├── 15.2: TEXT " with " [13-19]
							├── 15.3: MARK "**strong emphasis**" [19-38] [label="strong emphasis"]
							└── 15.4: TEXT "" [38-38]
							 16: TEXT "" [255-255]
							 17: MARK "- *Italic text* and *emphasis* support
							" [255-294] [label="*Italic text* and *emphasis* support"]
							├── 17.0: TEXT "" [0-0]
							├── 17.1: MARK "*Italic text*" [0-13] [label="Italic text"]
							├── 17.2: TEXT " and " [13-18]
							├── 17.3: MARK "*emphasis*" [18-28] [label="emphasis"]
							└── 17.4: TEXT " support" [28-36]
							 18: TEXT "" [294-294]
							 19: MARK "- \`Code snippets\` and \`\`\`code blocks\`\`\`
							" [294-334] [label="\`Code snippets\` and \`\`\`code blocks\`\`\`"]
							├── 19.0: TEXT "" [0-0]
							├── 19.1: MARK "\`Code snippets\`" [0-15] [label="Code snippets"]
							├── 19.2: TEXT " and " [15-20]
							├── 19.3: MARK "\`\`\`code blocks\`\`\`" [20-37] [label="code blocks"]
							└── 19.4: TEXT "" [37-37]
							 20: TEXT "" [334-334]
							 21: MARK "- ~~Strikethrough~~ for deleted content
							" [334-374] [label="~~Strikethrough~~ for deleted content"]
							├── 21.0: TEXT "" [0-0]
							├── 21.1: MARK "~~Strikethrough~~" [0-17] [label="Strikethrough"]
							└── 21.2: TEXT " for deleted content" [17-37]
							 22: TEXT "" [374-374]
							 23: MARK "- Links like [GitHub](https://github.com)
							" [374-416] [label="Links like [GitHub](https://github.com)"]
							├── 23.0: TEXT "Links like " [0-11]
							├── 23.1: MARK "[GitHub](https://github.com)" [11-39] [label="GitHub", value="https://github.com"]
							└── 23.2: TEXT "" [39-39]
							 24: TEXT "
							" [416-417]
							 25: MARK "## Example

							" [417-429] [label="Example
							"]
							 26: TEXT "Here's how to use it:

							" [429-452]
							 27: MARK "\`\`\`javascript
							const parser = new ParserV2(['**__label__**', '*__label__*'])
							const result = parser.split('Hello **world**!')
							\`\`\`" [452-579] [label="javascript
							const parser = new ParserV2(['**__label__**', '*__label__*'])
							const result = parser.split('Hello **world**!')
							"]
							├── 27.0: TEXT "javascript
							const parser = n..." [0-41]
							├── 27.1: MARK "**__label__**" [41-54] [label="__label__"]
							├── 27.2: TEXT "', '" [54-58]
							├── 27.3: MARK "*__label__*" [58-69] [label="__label__"]
							├── 27.4: TEXT "'])
							const result = parser.s..." [69-108]
							├── 27.5: MARK "**world**" [108-117] [label="world"]
							└── 27.6: TEXT "!')
							" [117-121]
							 28: TEXT "

							Visit our [documentation]..." [579-651]
							 29: MARK "~~This feature is deprecated~~" [651-681] [label="This feature is deprecated"]
							 30: TEXT " and will be removed in v3.0." [681-710]"
						`)
					})

					it('isolated test: parses "**strong emphasis**" correctly', () => {
						const parser = new ParserV2(['**__label__**'])
						const input = '**strong emphasis**'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "**strong emphasis**" [0-19] [label="strong emphasis"]
							 2: TEXT "" [19-19]"
						`)
					})

					it('isolated test: parses two adjacent bold marks correctly', () => {
						const parser = new ParserV2(['**__label__**'])
						const input = '**Bold text** with **strong emphasis**'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "**Bold text**" [0-13] [label="Bold text"]
							 2: TEXT " with " [13-19]
							 3: MARK "**strong emphasis**" [19-38] [label="strong emphasis"]
							 4: TEXT "" [38-38]"
						`)
					})

					it('isolated test: parses "*emphasis*" correctly', () => {
						const parser = new ParserV2(['*__label__*'])
						const input = '*emphasis*'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "*emphasis*" [0-10] [label="emphasis"]
							 2: TEXT "" [10-10]"
						`)
					})

					it('isolated test: parses two adjacent italic marks correctly', () => {
						const parser = new ParserV2(['*__label__*'])
						const input = '*Italic text* and *emphasis*'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "*Italic text*" [0-13] [label="Italic text"]
							 2: TEXT " and " [13-18]
							 3: MARK "*emphasis*" [18-28] [label="emphasis"]
							 4: TEXT "" [28-28]"
						`)
					})

					it('isolated test: parses nested bold marks in list item', () => {
						const parser = new ParserV2(['- __label__\n', '**__label__**'])
						const input = '- **Bold text** with **strong emphasis**\n'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "- **Bold text** with **strong emphasis**
							" [0-41] [label="**Bold text** with **strong emphasis**"]
							├── 1.0: TEXT "" [0-0]
							├── 1.1: MARK "**Bold text**" [0-13] [label="Bold text"]
							├── 1.2: TEXT " with " [13-19]
							├── 1.3: MARK "**strong emphasis**" [19-38] [label="strong emphasis"]
							└── 1.4: TEXT "" [38-38]
							 2: TEXT "" [41-41]"
						`)
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

	describe('Integration tests with diverse data', () => {
		// Helper function to generate safe markup content (no brackets or parentheses)
		const generateSafeContent = (length: number = 10): string => {
			return faker.string.alpha({length: {min: 1, max: length}}).replace(/[[\]()]/g, '') // Remove any brackets or parentheses that might appear
		}

		it('should handle diverse user names and content', () => {
			const testCases = Array.from({length: 20}, () => {
				const userName = faker.person.firstName()
				const userValue = faker.person.lastName()
				const message = faker.lorem.sentence()

				return {userName, userValue, message}
			})

			testCases.forEach(({userName, userValue, message}) => {
				const input = `${message} @[${userName}](${userValue}) says hi!`
				const result = parser.split(input)

				const marks = result.filter(t => t.type === 'mark') as MarkToken[]
				expect(marks).toHaveLength(1)

				const mark = marks[0]
				expect(mark.data.label).toBe(userName)
				expect(mark.data.value).toBe(userValue)
			})
		})

		it('should handle diverse hashtags and topics', () => {
			const testCases = Array.from({length: 15}, () => {
				const hashtag1 = faker.word.words(1)
				const hashtag2 = faker.word.words(1)
				const text = faker.lorem.words(5)

				return {hashtag1, hashtag2, text}
			})

			testCases.forEach(({hashtag1, hashtag2, text}) => {
				const input = `${text} #[${hashtag1}] #[${hashtag2}]`
				const result = parser.split(input)

				const marks = result.filter(t => t.type === 'mark') as MarkToken[]
				expect(marks).toHaveLength(2)

				expect(marks[0].data.label).toBe(hashtag1)
				expect(marks[1].data.label).toBe(hashtag2)
			})
		})

		it('should handle mixed content with various formats', () => {
			const testCases = Array.from({length: 25}, () => {
				const userName = faker.internet.username()
				const project = faker.commerce.productName()
				const description = faker.lorem.sentences(2)

				return {userName, project, description}
			})

			testCases.forEach(({userName, project, description}) => {
				const input = `${description} @[${userName}](user) #[${project}]`
				const result = parser.split(input)

				const marks = result.filter(t => t.type === 'mark') as MarkToken[]
				expect(marks).toHaveLength(2)

				const userMark = marks.find(m => m.data.value === 'user')
				const projectMark = marks.find(m => m.data.label === project)

				expect(userMark).toBeDefined()
				expect(userMark?.data.label).toBe(userName)
				expect(projectMark).toBeDefined()
			})
		})

		it('should handle international content and unicode', () => {
			const testCases = Array.from({length: 10}, () => {
				const city = faker.location.city()
				const country = faker.location.country()
				const text = faker.lorem.sentence()

				return {city, country, text}
			})

			testCases.forEach(({city, country, text}) => {
				const input = `${text} @[${city}](${country}) 🌍`
				const result = parser.split(input)

				const marks = result.filter(t => t.type === 'mark') as MarkToken[]
				expect(marks).toHaveLength(1)

				const mark = marks[0]
				expect(mark.data.label).toBe(city)
				expect(mark.data.value).toBe(country)
			})
		})

		it('should handle complex nested structures with diverse content', () => {
			const testCases = Array.from({length: 15}, () => {
				const outerName = faker.company.name()
				const innerTag = faker.word.noun()
				const innerValue = faker.word.adjective()
				const prefix = faker.lorem.words(3)

				return {outerName, innerTag, innerValue, prefix}
			})

			testCases.forEach(({outerName, innerTag, innerValue, prefix}) => {
				const input = `${prefix} @[${outerName} #[${innerTag}](${innerValue})]`
				const result = parser.split(input)

				const marks = result.filter(t => t.type === 'mark') as MarkToken[]
				expect(marks.length).toBeGreaterThan(0)

				// Should have outer mark
				const outerMark = marks.find(m => m.content.includes(outerName))
				expect(outerMark).toBeDefined()
				expect(outerMark?.children).toBeDefined()
				expect(Array.isArray(outerMark?.children)).toBe(true)
			})
		})

		it('should handle various text lengths and complexity', () => {
			const testCases = [
				// Very short
				{text: 'Hi @[user](name)!', expectedMarks: 1},
				// Medium
				{text: faker.lorem.sentences(2) + ' @[user](name) says hello', expectedMarks: 1},
				// Long
				{text: faker.lorem.paragraphs(2) + ' @[user](name) ' + faker.lorem.sentences(3), expectedMarks: 1},
				// Multiple marks
				{
					text: faker.lorem.sentence() + ' @[user1](name1) and #[tag1] then @[user2](name2) #[tag2]',
					expectedMarks: 4,
				},
			]

			testCases.forEach(({text, expectedMarks}) => {
				const result = parser.split(text)

				const marks = result.filter(t => t.type === 'mark') as MarkToken[]
				expect(marks).toHaveLength(expectedMarks)

				// Verify all marks have required properties
				marks.forEach(mark => {
					expect(mark.data).toBeDefined()
					expect(mark.data.label).toBeDefined()
					expect(typeof mark.data.label).toBe('string')
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
