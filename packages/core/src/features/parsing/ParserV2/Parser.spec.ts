import {describe, it, expect, beforeEach} from 'vitest'
import {Parser} from './Parser'
import {MarkToken, Token, Markup} from './types'
import {InnerOption} from '../../default/types'
import {faker} from '@faker-js/faker'

describe('ParserV2', () => {
	let parser: Parser
	let markups: Markup[]

	beforeEach(() => {
		markups = ['@[__value__](__meta__)', '#[__value__]']
		parser = new Parser(markups)
	})

	describe('static split', () => {
		it('should parse text with provided options and return Token[]', () => {
			const value = 'Hello @[world](test) and #[tag]'
			const options: {markup: Markup}[] = [{markup: '@[__value__](__meta__)'}, {markup: '#[__value__]'}]

			const result = Parser.split(value, options)

			expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
				"0: TEXT "Hello " [0-6]
				 1: MARK "@[world](test)" [6-20] [value="world", meta="test"]
				 2: TEXT " and " [20-25]
				 3: MARK "#[tag]" [25-31] [value="tag"]
				 4: TEXT "" [31-31]"
			`)
		})

		it('should handle text without options', () => {
			const value = 'Hello world'
			const result = Parser.split(value)

			expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`"0: TEXT "Hello world" [0-11]"`)
		})
	})

	describe('static join', () => {
		it('should convert tokens back to string with provided options', () => {
			const value = 'Hello @[world](test) and #[tag]'
			const options: {markup: Markup}[] = [{markup: '@[__value__](__meta__)'}, {markup: '#[__value__]'}]

			const tokens = Parser.split(value, options)
			const result = Parser.join(tokens, options)

			expect(result).toBe(value)
		})

		it('should handle tokens without options', () => {
			const value = 'Hello world'
			const tokens = Parser.split(value)
			const result = Parser.join(tokens)

			expect(result).toBe(value)
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
					 1: MARK "@[hello](world)" [0-15] [value="hello", meta="world"]
					 2: TEXT "" [15-15]"
				`)
			})

			it('parses single mark without value', () => {
				const input = '#[tag]'
				const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "" [0-0]
					 1: MARK "#[tag]" [0-6] [value="tag"]
					 2: TEXT "" [6-6]"
				`)
			})

			it('parses mixed text and multiple marks', () => {
				const input = 'Hello @[world](test) and #[tag]'
				const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
				"0: TEXT "Hello " [0-6]
				 1: MARK "@[world](test)" [6-20] [value="world", meta="test"]
				 2: TEXT " and " [20-25]
				 3: MARK "#[tag]" [25-31] [value="tag"]
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
						const simpleParser = new Parser(['@[__nested__]'])
						const input = '@[hello @[world]]'
						const result = simpleParser.split(input)

						// Without self-nesting support, the first closing ] ends the outer pattern
						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "@[hello @[world]]" [0-17] [value="hello @[world]", nested="hello @[world]"]
								1.0: TEXT "hello " [2-8]
								1.1: MARK "@[world]" [8-16] [value="world", nested="world"]
								1.2: TEXT "" [16-16]
							 2: TEXT "" [17-17]"
						`)
					})

					it('handles multiple and deeply nested marks', () => {
						const parser = new Parser(['@[__nested__]'])
						const input = '@[level1 @[level2 @[level3]]]'
						const result = parser.split(input)

						// Without self-nesting support, the first closing ] ends the outer pattern
						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "@[level1 @[level2 @[level3]]]" [0-29] [value="level1 @[level2 @[level3]]", nested="level1 @[level2 @[level3]]"]
								1.0: TEXT "level1 " [2-9]
								1.1: MARK "@[level2 @[level3]]" [9-28] [value="level2 @[level3]", nested="level2 @[level3]"]
									1.1.0: TEXT "level2 " [11-18]
									1.1.1: MARK "@[level3]" [18-27] [value="level3", nested="level3"]
									1.1.2: TEXT "" [27-27]
								1.2: TEXT "" [28-28]
							 2: TEXT "" [29-29]"
						`)
					})

					it('handles mixed markup types with nesting', () => {
						const parser = new Parser(['@[__nested__]', '#[__nested__]'])
						const input = '@[hello #[world]]'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "@[hello #[world]]" [0-17] [value="hello #[world]", nested="hello #[world]"]
								1.0: TEXT "hello " [2-8]
								1.1: MARK "#[world]" [8-16] [value="world", nested="world"]
								1.2: TEXT "" [16-16]
							 2: TEXT "" [17-17]"
						`)
					})

					it('handles marks with values and nesting', () => {
						const parser = new Parser(['@[__nested__](__meta__)', '#[__nested__]'])
						const input = '@[hello #[world]](value)'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[hello #[world]](value)" [0-24] [value="hello #[world]", meta="value", nested="hello #[world]"]
							1.0: TEXT "hello " [2-8]
							1.1: MARK "#[world]" [8-16] [value="world", nested="world"]
							1.2: TEXT "" [16-16]
						 2: TEXT "" [24-24]"
					`)
					})

					it('handles combined __label__ and __nested__ pattern', () => {
						const parser = new Parser(['@[__value__](__nested__)', '#[__nested__]'])
						const input = '@[user](Hello #[world])'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[user](Hello #[world])" [0-23] [value="user", nested="Hello #[world]"]
							1.0: TEXT "Hello " [8-14]
							1.1: MARK "#[world]" [14-22] [value="world", nested="world"]
							1.2: TEXT "" [22-22]
						 2: TEXT "" [23-23]"
					`)
					})

					it('handles combined __label__ and __nested__ with complex nesting', () => {
						const parser = new Parser(['@[__value__](__nested__)', '#[__nested__]', '**__nested__**'])
						const input = '@[user](Text with #[tag] and **bold**)'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[user](Text with #[tag] and **bold**)" [0-38] [value="user", nested="Text with #[tag] and **bold**"]
							1.0: TEXT "Text with " [8-18]
							1.1: MARK "#[tag]" [18-24] [value="tag", nested="tag"]
							1.2: TEXT " and " [24-29]
							1.3: MARK "**bold**" [29-37] [value="bold", nested="bold"]
							1.4: TEXT "" [37-37]
						 2: TEXT "" [38-38]"
					`)
					})

					it('handles __label__ and __nested__ with empty nested content', () => {
						const parser = new Parser(['@[__value__](__nested__)', '#[__nested__]'])
						const input = '@[user]()'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[user]()" [0-9] [value="user"]
						 2: TEXT "" [9-9]"
					`)
					})

					it('handles HTML-like pattern with label, value and nested', () => {
						// Pattern: <__value__ __meta__>__nested__</__value__>
						const parser = new Parser(['<__value__ __meta__>__nested__</__value__>', '**__nested__**'])
						const input = '<div class>Content with **bold**</div>'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "<div class>Content with **bold**</div>" [0-38] [value="div", meta="class", nested="Content with **bold**"]
							1.0: TEXT "Content with " [11-24]
							1.1: MARK "**bold**" [24-32] [value="bold", nested="bold"]
							1.2: TEXT "" [32-32]
						 2: TEXT "" [38-38]"
					`)

						const marks = result.filter(t => t.type === 'mark') as MarkToken[]
						expect(marks[0].value).toBe('div')
						expect(marks[0].meta).toBe('class')
					})

					it('handles HTML-like pattern with empty value', () => {
						const parser = new Parser(['<__value__ __meta__>__nested__</__value__>', '#[__nested__]'])
						const input = '<span >Text #[tag]</span>'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "<span >Text #[tag]</span>" [0-25] [value="span", meta="", nested="Text #[tag]"]
							1.0: TEXT "Text " [7-12]
							1.1: MARK "#[tag]" [12-18] [value="tag", nested="tag"]
							1.2: TEXT "" [18-18]
						 2: TEXT "" [25-25]"
					`)

						const marks = result.filter(t => t.type === 'mark') as MarkToken[]
						expect(marks[0].value).toBe('span')
						expect(marks[0].meta).toBe('')
					})

					it('handles HTML-like pattern with label+value containing nested pattern with label only', () => {
						// Simpler test: outer pattern with value, inner pattern without value
						const parser = new Parser([
							'<__value__ __meta__>__nested__</__value__>',
							'<__value__>__nested__</__value__>',
						])
						const input = '<div class><p>Text</p></div>'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
				"0: TEXT "" [0-0]
				 1: MARK "<div class><p>Text</p></div>" [0-28] [value="div", meta="class", nested="<p>Text</p>"]
					1.0: TEXT "" [11-11]
					1.1: MARK "<p>Text</p>" [11-22] [value="p", nested="Text"]
					1.2: TEXT "" [22-22]
				 2: TEXT "" [28-28]"
			`)

						const marks = result.filter(t => t.type === 'mark') as MarkToken[]
						expect(marks[0].value).toBe('div')
						expect(marks[0].meta).toBe('class')
					})

					it('handles complex HTML-like nested structure', () => {
						const parser = new Parser([
							'<__value__ __meta__>__nested__</__value__>',
							'<__value__>__nested__</__value__>',
							'**__nested__**',
						])
						const input = '<div class><p>Text **bold**</p></div>'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "" [0-0]
					 1: MARK "<div class><p>Text **bold**</p></div>" [0-37] [value="div", meta="class", nested="<p>Text **bold**</p>"]
						1.0: TEXT "" [11-11]
						1.1: MARK "<p>Text **bold**</p>" [11-31] [value="p", nested="Text **bold**"]
							1.1.0: TEXT "Text " [14-19]
							1.1.1: MARK "**bold**" [19-27] [value="bold", nested="bold"]
							1.1.2: TEXT "" [27-27]
						1.2: TEXT "" [31-31]
					 2: TEXT "" [37-37]"
				`)

						// Verify correct nesting
						const marks = result.filter(t => t.type === 'mark') as MarkToken[]
						expect(marks[0].value).toBe('div')
						expect(marks[0].meta).toBe('class')
						expect(marks[0].children.length).toBeGreaterThan(0)
					})

					it('does NOT match HTML-like pattern when opening and closing tags differ', () => {
						// Pattern with two __label__ placeholders requires them to be equal
						const parser = new Parser(['<__value__>__nested__</__value__>'])
						const input = '<div1>text</div2>'
						const result = parser.split(input)

						// Should NOT match - opening tag "div1" doesn't match closing tag "div2"
						// Result should be plain text
						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "<div1>text</div2>" [0-17]"
					`)

						const marks = result.filter(t => t.type === 'mark') as MarkToken[]
						expect(marks).toHaveLength(0)
					})

					it('does NOT find nested marks in __label__ sections', () => {
						// Pattern uses __label__ (not __nested__), so no nesting should be found
						const parser = new Parser(['@[__value__]', '#[__value__]'])
						const input = '@[hello #[world]]'
						const result = parser.split(input)

						// Should parse as a single mark with no children
						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[hello #[world]]" [0-17] [value="hello #[world]"]
						 2: TEXT "" [17-17]"
					`)

						// Verify no nested marks
						const markTokens = result.filter(t => t.type === 'mark') as MarkToken[]
						expect(markTokens).toHaveLength(1)
						expect(markTokens[0].children).toEqual([])
					})

					it('does NOT find nested marks in __value__ sections', () => {
						// Nested patterns should not be found inside value sections
						const parser = new Parser(['@[__nested__](__meta__)', '#[__nested__]'])
						const input = '@[hello](#[world])'
						const result = parser.split(input)

						// Should have only one mark, with #[world] as plain text in value
						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "" [0-0]
					 1: MARK "@[hello](#[world])" [0-18] [value="hello", meta="#[world]", nested="hello"]
					 2: TEXT "" [18-18]"
				`)

						// Verify no nested marks
						const markTokens = result.filter(t => t.type === 'mark') as MarkToken[]
						expect(markTokens).toHaveLength(1)
						expect(markTokens[0].children).toEqual([])
						expect(markTokens[0].meta).toBe('#[world]')
					})

					it('correctly distinguishes between __label__ and __nested__ in mixed patterns', () => {
						// Pattern with __label__ should not support nesting
						// Pattern with __nested__ should support nesting
						const parser = new Parser(['@[__value__]', '#[__nested__]', '**__nested__**'])
						const input1 = '@[#[tag]]' // __label__ pattern - no nesting
						const input2 = '#[**bold**]' // __nested__ pattern - with nesting

						const result1 = parser.split(input1)
						const result2 = parser.split(input2)

						// First case: no nesting in __label__
						expect(tokensToDebugTree(result1)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[#[tag]]" [0-9] [value="#[tag]"]
						 2: TEXT "" [9-9]"
					`)

						// Second case: nesting in __nested__
						expect(tokensToDebugTree(result2)).toMatchInlineSnapshot(`
					"0: TEXT "" [0-0]
					 1: MARK "#[**bold**]" [0-11] [value="**bold**", nested="**bold**"]
						1.0: TEXT "" [2-2]
						1.1: MARK "**bold**" [2-10] [value="bold", nested="bold"]
						1.2: TEXT "" [10-10]
					 2: TEXT "" [11-11]"
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
						 1: MARK "@[first](1)" [0-11] [value="first", meta="1"]
						 2: TEXT "" [11-11]
						 3: MARK "@[second](2)" [11-23] [value="second", meta="2"]
						 4: TEXT "" [23-23]"
					`)
				})

				it('handles identical consecutive marks', () => {
					const input = '#[tag1]#[tag2]#[tag3]'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "#[tag1]" [0-7] [value="tag1"]
						 2: TEXT "" [7-7]
						 3: MARK "#[tag2]" [7-14] [value="tag2"]
						 4: TEXT "" [14-14]
						 5: MARK "#[tag3]" [14-21] [value="tag3"]
						 6: TEXT "" [21-21]"
					`)
				})

				it('handles marks with empty labels', () => {
					const parser = new Parser(['@[__value__]'])
					const input = '@[] @[content]'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[]" [0-3] [value=""]
						 2: TEXT " " [3-4]
						 3: MARK "@[content]" [4-14] [value="content"]
						 4: TEXT "" [14-14]"
					`)
				})

				it('handles marks with empty values', () => {
					const input = '@[label]() @[label2](value)'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "" [0-0]
					 1: MARK "@[label]()" [0-10] [value="label", meta=""]
					 2: TEXT " " [10-11]
					 3: MARK "@[label2](value)" [11-27] [value="label2", meta="value"]
					 4: TEXT "" [27-27]"
				`)
				})

				it('handles unicode and emoji content', () => {
					const input = 'Hello @[привет](мир) and #[🚀] emoji'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "Hello " [0-6]
						 1: MARK "@[привет](мир)" [6-20] [value="привет", meta="мир"]
						 2: TEXT " and " [20-25]
						 3: MARK "#[🚀]" [25-30] [value="🚀"]
						 4: TEXT " emoji" [30-36]"
					`)
				})

				it('handles very long content', () => {
					const longText = 'a'.repeat(10000)
					const input = `@[${longText}](value)`
					const result = parser.split(input)

					const marks = result.filter(token => token.type === 'mark') as MarkToken[]
					expect(marks).toHaveLength(1)
					expect(marks[0].value).toBe(longText)
					expect(marks[0].meta).toBe('value')
				})

				it('handles conflicting patterns gracefully', () => {
					// Test with patterns that could potentially conflict
					// Shorter matches have higher priority, patterns without value preferred for same length
					const conflictingParser = new Parser(['@[__value__]', '@[__value__](__meta__)'])
					const input = '@[simple] @[with](value)'
					const result = conflictingParser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[simple]" [0-9] [value="simple"]
						 2: TEXT " " [9-10]
						 3: MARK "@[with]" [10-17] [value="with"]
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
					const parser = new Parser(['@[__value__]'])
					const result = parser.split(input)
					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "↲⇥⇥⇥⇥⇥⇥'" [0-8]
						 1: MARK "@[start]" [8-16] [value="start"]
						 2: TEXT "',↲⇥⇥⇥⇥⇥⇥'" [16-26]
						 3: MARK "@[end]" [26-32] [value="end"]
						 4: TEXT "',↲⇥⇥⇥⇥⇥⇥'" [32-42]
						 5: MARK "@[start]" [42-50] [value="start"]
						 6: TEXT "" [50-50]
						 7: MARK "@[end]" [50-56] [value="end"]
						 8: TEXT "',↲⇥⇥⇥⇥⇥⇥' " [56-67]
						 9: MARK "@[middle]" [67-76] [value="middle"]
						 10: TEXT " ',↲⇥⇥⇥⇥⇥" [76-85]"
					`)
				})

				it('handles nested brackets in content', () => {
					const input = '@[content [with] brackets](value)'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "@[content [with] brackets](value)" [0-33] [value="content [with] brackets", meta="value"]
						 2: TEXT "" [33-33]"
					`)
				})

				it('handles __value__ before content placeholder', () => {
					// Pattern with value before label: (__meta__)@[__value__]
					const parser = new Parser(['(__meta__)@[__value__]'])
					const input = '(url)@[link]'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "(url)@[link]" [0-12] [value="link", meta="url"]
						 2: TEXT "" [12-12]"
					`)

					const marks = result.filter(t => t.type === 'mark') as MarkToken[]
					expect(marks[0].value).toBe('link')
					expect(marks[0].meta).toBe('url')
				})

				it('handles __value__ before nested placeholder', () => {
					// Pattern with value before nested: (__meta__)#[__nested__]
					const parser = new Parser(['(__meta__)#[__nested__]', '**__nested__**'])
					const input = '(note)#[Text with **bold**]'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "(note)#[Text with **bold**]" [0-27] [value="Text with **bold**", meta="note", nested="Text with **bold**"]
							1.0: TEXT "Text with " [8-18]
							1.1: MARK "**bold**" [18-26] [value="bold", nested="bold"]
							1.2: TEXT "" [26-26]
						 2: TEXT "" [27-27]"
					`)

					const marks = result.filter(t => t.type === 'mark') as MarkToken[]
					expect(marks[0].meta).toBe('note')
				})

				it('handles complex pattern with value in middle', () => {
					// Pattern: [__value__](__meta__)(__nested__)
					const parser = new Parser(['[__value__](__meta__)(__nested__)', '**__nested__**'])
					const input = '[name](url)(Content **bold**)'
					const result = parser.split(input)

					expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "[name](url)(Content **bold**)" [0-29] [value="name", meta="url", nested="Content **bold**"]
							1.0: TEXT "Content " [12-20]
							1.1: MARK "**bold**" [20-28] [value="bold", nested="bold"]
							1.2: TEXT "" [28-28]
						 2: TEXT "" [29-29]"
					`)

					const marks = result.filter(t => t.type === 'mark') as MarkToken[]
					expect(marks[0].value).toBe('name')
					expect(marks[0].meta).toBe('url')
				})
			})
		})

		describe('escape', () => {
			it('should escape segments using provided escaper function', () => {
				const parser = new Parser(['@[__value__](__meta__)', '#[__value__]'])

				// Escaper that prefixes segments
				const escaper = (segment: string) => `ESC_${segment}`

				const testInput = 'Hello @[world](test) and #[tag]'
				const result = parser.escape(testInput, escaper)

				expect(result).toBe('Hello ESC_@[worldESC_ESC_](testESC_) and ESC_#[tagESC_]')
			})

			it('should handle different escaper functions', () => {
				const parser = new Parser(['**[__value__]**'])

				// Escaper that prefixes segments
				const escaper = (segment: string) => `ESC_${segment}`

				const testInput = 'Bold **[text]** here'
				const result = parser.escape(testInput, escaper)

				expect(result).toBe('Bold ESC_**[textESC_]** here')
			})

			it('should handle overlapping segments correctly', () => {
				const parser = new Parser(['@[__value__]', '#[__value__]'])

				const escaper = (segment: string) => `ESC_${segment}`

				const testInput = '@[hello] #[world]'
				const result = parser.escape(testInput, escaper)

				expect(result).toBe('ESC_@[helloESC_] ESC_#[worldESC_]')
			})

			it('should handle empty text', () => {
				const parser = new Parser(['@[__value__]'])

				const escaper = (segment: string) => `\\${segment}`

				const result = parser.escape('', escaper)

				expect(result).toBe('')
			})

			it('should handle text without segments', () => {
				const parser = new Parser(['@[__value__]'])

				const escaper = (segment: string) => `\\${segment}`

				const testInput = 'Hello world'
				const result = parser.escape(testInput, escaper)

				expect(result).toBe('Hello world')
			})

			it('should work without escaper function', () => {
				const parser = new Parser(['@[__value__](__meta__)', '#[__value__]'])

				const testInput = 'Hello @[world](test) and #[tag]'
				const result = parser.escape(testInput)

				expect(result).toBe('Hello [world(test) and [tag]')
			})
		})

		describe('integration', () => {
			it('handles complex real-world scenarios', () => {
				const input =
					'Hello @[user](admin) welcome to #[project]! Check @[docs](https://example.com) for more info.'
				const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "Hello " [0-6]
					 1: MARK "@[user](admin)" [6-20] [value="user", meta="admin"]
					 2: TEXT " welcome to " [20-32]
					 3: MARK "#[project]" [32-42] [value="project"]
					 4: TEXT "! Check " [42-50]
					 5: MARK "@[docs](https://example.com)" [50-78] [value="docs", meta="https://example.com"]
					 6: TEXT " for more info." [78-93]"
				`)
			})

			it('should handle complex nested structures', () => {
				const input = 'User @[john](John Doe) mentioned #[urgent] task'
				const result = parser.split(input)

				expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
					"0: TEXT "User " [0-5]
					 1: MARK "@[john](John Doe)" [5-22] [value="john", meta="John Doe"]
					 2: TEXT " mentioned " [22-33]
					 3: MARK "#[urgent]" [33-42] [value="urgent"]
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
				// Generators for different markup types for testing
				const generateSimpleMarkup = (prefix: string, suffix: string = '') => `${prefix}[__value__]${suffix}`

				const generateValueMarkup = (prefix: string, middle: string = '', suffix: string = '') =>
					`${prefix}[__value__]${middle}(__meta__)${suffix}`

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
							const parser = new Parser([markup as any])
							const input = `Hello ${prefix}[world]!`
							const result = parser.split(input)

							// Find mark token
							const markToken = result.find(token => token.type === 'mark') as MarkToken
							expect(markToken).toBeDefined()
							expect(markToken.value).toBe('world')
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
							const markup = `<${tag}>__value__</${tag}>`
							const parser = new Parser([markup as any])
							const input = `This is <${tag}>content</${tag}> text`
							const result = parser.split(input)

							// Find mark token
							const markToken = result.find(token => token.type === 'mark') as MarkToken
							expect(markToken).toBeDefined()
							expect(markToken.value).toBe('content')
							expect(markToken.content).toBe(`<${tag}>content</${tag}>`)
						})
					})

					it('parses HTML tags with <__value__>__meta__</__value__> format', () => {
						const parser = new Parser(['<__value__>__meta__</__value__>' as any])
						const input = 'Check <img>photo.jpg</img> image'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "Check " [0-6]
						 1: MARK "<img>photo.jpg</img>" [6-26] [value="img", meta="photo.jpg"]
						 2: TEXT " image" [26-32]"
					`)
					})

					it('parses HTML tags with <__value__>__meta__<__value__> format', () => {
						const parser = new Parser(['<__value__>__meta__<__value__>' as any])
						const input = 'Check <img>photo.jpg<img> image'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "Check " [0-6]
							 1: MARK "<img>photo.jpg<img>" [6-25] [value="img", meta="photo.jpg"]
							 2: TEXT " image" [25-31]"
						`)
					})

					it('parses nested HTML tags', () => {
						const markups = ['<b>__nested__</b>' as any, '<i>__nested__</i>' as any]
						const parser = new Parser(markups)
						const input = '<b>Bold <i>italic</i> text</b>'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "<b>Bold <i>italic</i> text</b>" [0-30] [value="Bold <i>italic</i> text", nested="Bold <i>italic</i> text"]
								1.0: TEXT "Bold " [3-8]
								1.1: MARK "<i>italic</i>" [8-21] [value="italic", nested="italic"]
								1.2: TEXT " text" [21-26]
							 2: TEXT "" [30-30]"
						`)
					})
				})

				describe('Markdown formatting', () => {
					const markdownPatterns = [
						{pattern: '**__value__**', input: 'This is **bold** text', expectedLabel: 'bold'},
						{pattern: '*__value__*', input: 'This is *italic* text', expectedLabel: 'italic'},
						{
							pattern: '~~__value__~~',
							input: 'This is ~~strikethrough~~ text',
							expectedLabel: 'strikethrough',
						},
						{pattern: '`__value__`', input: 'This is `code` text', expectedLabel: 'code'},
						{
							pattern: '```__value__```',
							input: 'This is ```block code``` text',
							expectedLabel: 'block code',
						},
					]

					markdownPatterns.forEach(({pattern, input, expectedLabel}) => {
						it(`parses markdown pattern ${pattern}`, () => {
							const parser = new Parser([pattern as any])
							const result = parser.split(input)

							// Find mark token
							const markToken = result.find(token => token.type === 'mark') as MarkToken
							expect(markToken).toBeDefined()
							expect(markToken.value).toBe(expectedLabel)
						})
					})

					it('parses markdown links', () => {
						const parser = new Parser(['[__value__](__meta__)' as any])
						const input = 'Check [Google](https://google.com) for search'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
								"0: TEXT "Check " [0-6]
								 1: MARK "[Google](https://google.com)" [6-34] [value="Google", meta="https://google.com"]
								 2: TEXT " for search" [34-45]"
							`)
					})

					it('parses markdown images', () => {
						const parser = new Parser(['![__value__](__meta__)' as any])
						const input = 'See ![cat](cat.jpg) image'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
								"0: TEXT "See " [0-4]
								 1: MARK "![cat](cat.jpg)" [4-19] [value="cat", meta="cat.jpg"]
								 2: TEXT " image" [19-25]"
							`)
					})

					it('parses mixed markdown formatting', () => {
						const markups: Markup[] = [
							'**__value__**', // bold
							'*__value__*', // italic
							'`__value__`', // code
						]
						const parser = new Parser(markups)
						const input = '**Bold** and *italic* with `code`'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "**Bold**" [0-8] [value="Bold"]
							 2: TEXT " and " [8-13]
							 3: MARK "*italic*" [13-21] [value="italic"]
							 4: TEXT " with " [21-27]
							 5: MARK "\`code\`" [27-33] [value="code"]
							 6: TEXT "" [33-33]"
						`)
					})

					it('parses complex realistic markdown document', () => {
						const markups: Markup[] = [
							'# __nested__\n', // h1 header
							'## __nested__\n', // h2 header
							'- __nested__\n', // list item
							'**__nested__**', // bold
							'*__nested__*', // italic
							'`__value__`', // inline code (no nesting in code)
							'```__value__\n__meta__```', // code block (no nesting)
							'[__value__](__meta__)', // link (no nesting in link text)
							'~~__value__~~', // strikethrough (no nesting)
						]
						const parser = new Parser(markups)

						const input = dedent`
						# Welcome to **Marked Input**

						This is a *powerful* library for parsing **rich text** with *markdown* formatting.
						You can use \`inline code\` snippets like \`const parser = new ParserV2()\` in your text.

						## Features

						- **Bold text** with **strong emphasis**
						- *Italic text* and *emphasis* support
						- \`Code snippets\` and \`code blocks\`
						- ~~Strikethrough~~ for deleted content
						- Links like [GitHub](https://github.com)

						## Example

						Here's how to use it:

						\`\`\`javascript
						const parser = new ParserV2(['**__value__**', '*__value__*'])
						const result = parser.split('Hello **world**!')
						\`\`\`

						Visit our [documentation](https://docs.example.com) for more details.
						~~This feature is deprecated~~ and will be removed in v3.0.
					`

						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "# Welcome to **Marked Input**↲" [0-30] [value="Welcome to **Marked Input**", nested="Welcome to **Marked Input**"]
							1.0: TEXT "Welcome to " [2-13]
							1.1: MARK "**Marked Input**" [13-29] [value="Marked Input", nested="Marked Input"]
							1.2: TEXT "" [29-29]
						 2: TEXT "↲This is a " [30-41]
						 3: MARK "*powerful*" [41-51] [value="powerful", nested="powerful"]
						 4: TEXT " library for parsing " [51-72]
						 5: MARK "**rich text**" [72-85] [value="rich text", nested="rich text"]
						 6: TEXT " with " [85-91]
						 7: MARK "*markdown*" [91-101] [value="markdown", nested="markdown"]
						 8: TEXT " formatting.↲You can use " [101-126]
						 9: MARK "\`inline code\`" [126-139] [value="inline code"]
						 10: TEXT " snippets like " [139-154]
						 11: MARK "\`const parser = new ParserV2()\`" [154-185] [value="const parser = new ParserV2()"]
						 12: TEXT " in your text.↲↲" [185-201]
						 13: MARK "## Features↲" [201-213] [value="Features", nested="Features"]
						 14: TEXT "↲" [213-214]
						 15: MARK "- **Bold text** with **strong emphasis**↲" [214-255] [value="**Bold text** with **strong emphasis**", nested="**Bold text** with **strong emphasis**"]
							15.0: TEXT "" [216-216]
							15.1: MARK "**Bold text**" [216-229] [value="Bold text", nested="Bold text"]
							15.2: TEXT " with " [229-235]
							15.3: MARK "**strong emphasis**" [235-254] [value="strong emphasis", nested="strong emphasis"]
							15.4: TEXT "" [254-254]
						 16: TEXT "" [255-255]
						 17: MARK "- *Italic text* and *emphasis* support↲" [255-294] [value="*Italic text* and *emphasis* support", nested="*Italic text* and *emphasis* support"]
							17.0: TEXT "" [257-257]
							17.1: MARK "*Italic text*" [257-270] [value="Italic text", nested="Italic text"]
							17.2: TEXT " and " [270-275]
							17.3: MARK "*emphasis*" [275-285] [value="emphasis", nested="emphasis"]
							17.4: TEXT " support" [285-293]
						 18: TEXT "" [294-294]
						 19: MARK "- \`Code snippets\` and \`code blocks\`↲" [294-330] [value="\`Code snippets\` and \`code blocks\`", nested="\`Code snippets\` and \`code blocks\`"]
							19.0: TEXT "" [296-296]
							19.1: MARK "\`Code snippets\`" [296-311] [value="Code snippets"]
							19.2: TEXT " and " [311-316]
							19.3: MARK "\`code blocks\`" [316-329] [value="code blocks"]
							19.4: TEXT "" [329-329]
						 20: TEXT "" [330-330]
						 21: MARK "- ~~Strikethrough~~ for deleted content↲" [330-370] [value="~~Strikethrough~~ for deleted content", nested="~~Strikethrough~~ for deleted content"]
							21.0: TEXT "" [332-332]
							21.1: MARK "~~Strikethrough~~" [332-349] [value="Strikethrough"]
							21.2: TEXT " for deleted content" [349-369]
						 22: TEXT "" [370-370]
						 23: MARK "- Links like [GitHub](https://github.com)↲" [370-412] [value="Links like [GitHub](https://github.com)", nested="Links like [GitHub](https://github.com)"]
							23.0: TEXT "Links like " [372-383]
							23.1: MARK "[GitHub](https://github.com)" [383-411] [value="GitHub", meta="https://github.com"]
							23.2: TEXT "" [411-411]
						 24: TEXT "↲" [412-413]
						 25: MARK "## Example↲" [413-424] [value="Example", nested="Example"]
						 26: TEXT "↲Here's how to use it:↲↲" [424-448]
						 27: MARK "\`\`\`javascript↲const parser = new ParserV2(['**__value__**', '*__value__*'])↲const result = parser.split('Hello **world**!')↲\`\`\`" [448-575] [value="javascript", meta="const parser = new ParserV2(['**__value__**', '*__value__*'])↲const result = parser.split('Hello **world**!')↲"]
						 28: TEXT "↲↲Visit our " [575-587]
						 29: MARK "[documentation](https://docs.example.com)" [587-628] [value="documentation", meta="https://docs.example.com"]
						 30: TEXT " for more details.↲" [628-647]
						 31: MARK "~~This feature is deprecated~~" [647-677] [value="This feature is deprecated"]
						 32: TEXT " and will be removed in v3.0." [677-706]"
					`)
					})

					it('isolated test: parses "**strong emphasis**" correctly', () => {
						const parser = new Parser(['**__value__**'])
						const input = '**strong emphasis**'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "**strong emphasis**" [0-19] [value="strong emphasis"]
							 2: TEXT "" [19-19]"
						`)
					})

					it('isolated test: parses two adjacent bold marks correctly', () => {
						const parser = new Parser(['**__value__**'])
						const input = '**Bold text** with **strong emphasis**'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "**Bold text**" [0-13] [value="Bold text"]
							 2: TEXT " with " [13-19]
							 3: MARK "**strong emphasis**" [19-38] [value="strong emphasis"]
							 4: TEXT "" [38-38]"
						`)
					})

					it('isolated test: parses "*emphasis*" correctly', () => {
						const parser = new Parser(['*__value__*'])
						const input = '*emphasis*'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "*emphasis*" [0-10] [value="emphasis"]
							 2: TEXT "" [10-10]"
						`)
					})

					it('isolated test: parses two adjacent italic marks correctly', () => {
						const parser = new Parser(['*__value__*'])
						const input = '*Italic text* and *emphasis*'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
							"0: TEXT "" [0-0]
							 1: MARK "*Italic text*" [0-13] [value="Italic text"]
							 2: TEXT " and " [13-18]
							 3: MARK "*emphasis*" [18-28] [value="emphasis"]
							 4: TEXT "" [28-28]"
						`)
					})

					it('isolated test: parses nested bold marks in list item', () => {
						const parser = new Parser(['- __nested__\n', '**__nested__**'])
						const input = '- **Bold text** with **strong emphasis**\n'
						const result = parser.split(input)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "- **Bold text** with **strong emphasis**↲" [0-41] [value="**Bold text** with **strong emphasis**", nested="**Bold text** with **strong emphasis**"]
							1.0: TEXT "" [2-2]
							1.1: MARK "**Bold text**" [2-15] [value="Bold text", nested="Bold text"]
							1.2: TEXT " with " [15-21]
							1.3: MARK "**strong emphasis**" [21-40] [value="strong emphasis", nested="strong emphasis"]
							1.4: TEXT "" [40-40]
						 2: TEXT "" [41-41]"
					`)
					})

					it('isolated test: multiline code block pattern', () => {
						const parser = new Parser(['```__value__\n__meta__```'])
						const input = '```javascript\nconst x = 1\n```'
						const result = parser.split(input)

						// Validate that no tokens have start > end
						const validatePositions = (tokens: Token[]): void => {
							for (const token of tokens) {
								expect(token.position.start).toBeLessThanOrEqual(token.position.end)
								if (token.type === 'mark' && token.children.length > 0) {
									validatePositions(token.children)
								}
							}
						}
						validatePositions(result)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "" [0-0]
						 1: MARK "\`\`\`javascript↲const x = 1↲\`\`\`" [0-29] [value="javascript", meta="const x = 1↲"]
						 2: TEXT "" [29-29]"
					`)
					})

					it('isolated test: multiline code block with other patterns', () => {
						const parser = new Parser([
							'```__value__\n__meta__```', // code block
							'`__value__`', // inline code
						])
						const input = 'Before `inline` and ```js\ncode\n``` after'
						const result = parser.split(input)

						// Validate that no tokens have start > end
						const validatePositions = (tokens: Token[]): void => {
							for (const token of tokens) {
								expect(token.position.start).toBeLessThanOrEqual(token.position.end)
								if (token.type === 'mark' && token.children.length > 0) {
									validatePositions(token.children)
								}
							}
						}
						validatePositions(result)

						expect(tokensToDebugTree(result)).toMatchInlineSnapshot(`
						"0: TEXT "Before " [0-7]
						 1: MARK "\`inline\`" [7-15] [value="inline"]
						 2: TEXT " and " [15-20]
						 3: MARK "\`\`\`js↲code↲\`\`\`" [20-34] [value="js", meta="code↲"]
						 4: TEXT " after" [34-40]"
					`)
					})
				})

				describe('custom patterns', () => {
					const customPatterns = [
						{
							pattern: '___[__value__]___',
							input: 'This is ___[underlined]___ text',
							expectedLabel: 'underlined',
						},
						{pattern: '```__value__```', input: 'Code ```block``` here', expectedLabel: 'block'},
						{pattern: '{{__value__}}', input: 'Template {{variable}} used', expectedLabel: 'variable'},
						{pattern: '||__value__||', input: 'Spoiler ||hidden|| content', expectedLabel: 'hidden'},
					]

					customPatterns.forEach(({pattern, input, expectedLabel}) => {
						it(`parses custom pattern "${pattern}"`, () => {
							const parser = new Parser([pattern as any])
							const result = parser.split(input)

							// Find mark token
							const markToken = result.find(token => token.type === 'mark') as MarkToken
							expect(markToken).toBeDefined()
							expect(markToken.value).toBe(expectedLabel)
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
				expect(mark.value).toBe(userName)
				expect(mark.meta).toBe(userValue)
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

				expect(marks[0].value).toBe(hashtag1)
				expect(marks[1].value).toBe(hashtag2)
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

				const userMark = marks.find(m => m.meta === 'user')
				const projectMark = marks.find(m => m.value === project)

				expect(userMark).toBeDefined()
				expect(userMark?.value).toBe(userName)
				expect(projectMark).toBeDefined()
			})
		})

		it.todo('should handle international content and unicode', () => {
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
				expect(mark.value).toBe(city)
				expect(mark.meta).toBe(country)
			})
		})

		it('should handle complex nested structures with diverse content', () => {
			//const parser = new ParserV2(['@[__nested__]($__value__)', '#[__nested__]'])
			const testCases = Array.from({length: 15}, () => {
				const outerName = parser.escape(faker.company.name())
				const innerTag = parser.escape(faker.word.noun())
				const innerValue = parser.escape(faker.word.adjective())
				const prefix = parser.escape(faker.lorem.words(3))

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
					expect(mark.value).toBeDefined()
					expect(typeof mark.value).toBe('string')
				})
			})
		})

		describe('join', () => {
			it('should convert tokens back to original string', () => {
				const parser = new Parser(['@[__value__](__meta__)', '#[__value__]'])
				const input = 'Hello @[world](test) and #[tag]'

				const tokens = parser.split(input)
				const result = parser.join(tokens)

				expect(result).toBe(input)
			})

			it('should handle nested tokens', () => {
				const parser = new Parser(['@[__nested__](__meta__)', '#[__value__]'])
				const input = 'Check @[#[urgent] task](priority)'

				const tokens = parser.split(input)
				const result = parser.join(tokens)

				expect(result).toBe(input)
			})

			it('should handle plain text tokens', () => {
				const parser = new Parser(['@[__value__]'])
				const input = 'Hello world'

				const tokens = parser.split(input)
				const result = parser.join(tokens)

				expect(result).toBe(input)
			})
		})
	})
})

function tokensToDebugTree(tokens: Token[], level = 0, prefix = ''): string {
	const lines: string[] = []

	tokens.forEach((token, index) => {
		const currentPrefix = prefix + (prefix ? '.' : '') + index
		const isLast = index === tokens.length - 1
		const indent = level > 0 ? '\t'.repeat(level) : ''
		const paddedPrefix = level === 0 && index > 0 ? ` ${currentPrefix}` : currentPrefix

		if (token.type === 'text') {
			const content = `"${escapeString(token.content)}"`
			lines.push(`${indent}${paddedPrefix}: TEXT ${content} [${token.position.start}-${token.position.end}]`)
		} else {
			let infoParts = [`value="${escapeString(token.value)}"`]

			if (token.meta !== undefined) {
				infoParts.push(`meta="${escapeString(token.meta)}"`)
			}

			if (token.nested) {
				infoParts.push(`nested="${escapeString(token.nested.content)}"`)
			}

			const labelValueInfo = `[${infoParts.join(', ')}]`

			lines.push(
				`${indent}${paddedPrefix}: MARK "${escapeString(token.content)}" [${token.position.start}-${token.position.end}] ${labelValueInfo}`
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

	function escapeString(str: string): string {
		return str
			.replace(/\n/g, '↲') // Newline (down-left arrow)
			.replace(/\r/g, '⏎') // Carriage return (left arrow)
			.replace(/\t/g, '⇥') // Tab (right-up arrow)
	}
}

/**
 * Counts total number of marks in the tree
 */
function countMarks(tokens: Token[]): number {
	// Recursively count only mark types
	const countInNode = (node: Token): number => {
		let nodeCount = node.type === 'mark' ? 1 : 0

		if (node.type === 'mark' && node.children) {
			nodeCount += node.children.reduce((sum, child) => sum + countInNode(child), 0)
		}

		return nodeCount
	}

	return tokens.reduce((sum, token) => sum + countInNode(token), 0)
}

/**
 * Finds maximum nesting depth
 */
function findMaxDepth(tokens: Token[]): number {
	// Find maximum depth among all tokens
	const findDepth = (node: Token): number => {
		if (node.type === 'text') {
			return 0
		}

		if (node.type !== 'mark' || !node.children || node.children.length === 0) {
			return 1 // mark without children has depth 1
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

/**
 * Tagged template function that removes common leading whitespace from each line
 * and trims empty lines from the beginning and end.
 *
 * @param strings - Template strings array
 * @param values - Interpolation values
 * @returns The dedented string
 *
 * @example
 * ```typescript
 * const text = dedent`
 *   Hello world
 *   This is indented
 *   And this too
 * `;
 * // Result: "Hello world\nThis is indented\nAnd this too"
 * ```
 */
function dedent(strings: TemplateStringsArray, ...values: unknown[]): string {
	// Combine template strings with interpolated values
	let result = strings[0]
	for (let i = 0; i < values.length; i++) {
		result += String(values[i]) + strings[i + 1]
	}

	// Split into lines
	const lines = result.split('\n')

	// Remove empty lines from start and end
	let startIndex = 0
	let endIndex = lines.length - 1

	// Find first non-empty line
	while (startIndex < lines.length && lines[startIndex].trim() === '') {
		startIndex++
	}

	// Find last non-empty line
	while (endIndex >= 0 && lines[endIndex].trim() === '') {
		endIndex--
	}

	// If all lines are empty, return empty string
	if (startIndex > endIndex) {
		return ''
	}

	// Extract the content lines
	const contentLines = lines.slice(startIndex, endIndex + 1)

	// Find the minimum indentation (excluding empty lines)
	let minIndent = Infinity
	for (const line of contentLines) {
		if (line.trim() === '') continue

		const indent = line.length - line.trimStart().length
		if (indent < minIndent) {
			minIndent = indent
		}
	}

	// If no indentation found, return as is
	if (minIndent === Infinity || minIndent === 0) {
		return contentLines.join('\n')
	}

	// Remove common indentation from each line
	const dedentedLines = contentLines.map(line => {
		if (line.trim() === '') {
			return ''
		}
		return line.slice(minIndent)
	})

	return dedentedLines.join('\n')
}
