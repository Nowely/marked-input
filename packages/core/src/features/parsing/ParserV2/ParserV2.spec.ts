import {describe, it, expect, beforeEach} from 'vitest'
import {ParserV2} from './ParserV2'
import {validateTreeStructure, countMarks, findMaxDepth} from './validation'
import {MarkToken} from './types'

describe('ParserV2', () => {
	let parser: ParserV2
	let markups: any[]

	beforeEach(() => {
		markups = [
			'@[__label__](__value__)',
			'#[__label__]'
		]
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

			expect(result).toMatchInlineSnapshot(`
				[
				  {
				    "content": "Hello ",
				    "position": {
				      "end": 6,
				      "start": 0,
				    },
				    "type": "text",
				  },
				  {
				    "children": [],
				    "content": "@[world](test)",
				    "data": {
				      "label": "world",
				      "optionIndex": 0,
				      "value": "test",
				    },
				    "position": {
				      "end": 20,
				      "start": 6,
				    },
				    "type": "mark",
				  },
				  {
				    "content": " and ",
				    "position": {
				      "end": 25,
				      "start": 20,
				    },
				    "type": "text",
				  },
				  {
				    "children": [],
				    "content": "#[tag]",
				    "data": {
				      "label": "tag",
				      "optionIndex": 1,
				      "value": undefined,
				    },
				    "position": {
				      "end": 31,
				      "start": 25,
				    },
				    "type": "mark",
				  },
				  {
				    "content": "",
				    "position": {
				      "end": 31,
				      "start": 31,
				    },
				    "type": "text",
				  },
				]
			`)
		})

		it('should handle text without options', () => {
			const value = 'Hello world'
			const result = ParserV2.split(value)

			expect(result).toMatchInlineSnapshot(`[]`)
		})
	})

	describe('parsing', () => {
		describe('basic functionality', () => {
		it('parses plain text without markups', () => {
			const input = 'Hello world'
			const result = parser.split(input)

			expect(result).toMatchInlineSnapshot(`
				[
				  {
				    "content": "Hello world",
				    "position": {
				      "end": 11,
				      "start": 0,
				    },
				    "type": "text",
				  },
				]
			`)
		})

		it('parses single mark with value', () => {
			const input = '@[hello](world)'
			const result = parser.split(input)

			expect(result).toMatchInlineSnapshot(`
				[
				  {
				    "content": "",
				    "position": {
				      "end": 0,
				      "start": 0,
				    },
				    "type": "text",
				  },
				  {
				    "children": [],
				    "content": "@[hello](world)",
				    "data": {
				      "label": "hello",
				      "optionIndex": 0,
				      "value": "world",
				    },
				    "position": {
				      "end": 15,
				      "start": 0,
				    },
				    "type": "mark",
				  },
				  {
				    "content": "",
				    "position": {
				      "end": 15,
				      "start": 15,
				    },
				    "type": "text",
				  },
				]
			`)
		})

		it('parses single mark without value', () => {
			const input = '#[tag]'
			const result = parser.split(input)

			expect(result).toMatchInlineSnapshot(`
				[
				  {
				    "content": "",
				    "position": {
				      "end": 0,
				      "start": 0,
				    },
				    "type": "text",
				  },
				  {
				    "children": [],
				    "content": "#[tag]",
				    "data": {
				      "label": "tag",
				      "optionIndex": 1,
				      "value": undefined,
				    },
				    "position": {
				      "end": 6,
				      "start": 0,
				    },
				    "type": "mark",
				  },
				  {
				    "content": "",
				    "position": {
				      "end": 6,
				      "start": 6,
				    },
				    "type": "text",
				  },
				]
			`)
		})

		it('parses mixed text and multiple marks', () => {
			const input = 'Hello @[world](test) and #[tag]'
			const result = parser.split(input)

			expect(result).toMatchInlineSnapshot(`
				[
				  {
				    "content": "Hello ",
				    "position": {
				      "end": 6,
				      "start": 0,
				    },
				    "type": "text",
				  },
				  {
				    "children": [],
				    "content": "@[world](test)",
				    "data": {
				      "label": "world",
				      "optionIndex": 0,
				      "value": "test",
				    },
				    "position": {
				      "end": 20,
				      "start": 6,
				    },
				    "type": "mark",
				  },
				  {
				    "content": " and ",
				    "position": {
				      "end": 25,
				      "start": 20,
				    },
				    "type": "text",
				  },
				  {
				    "children": [],
				    "content": "#[tag]",
				    "data": {
				      "label": "tag",
				      "optionIndex": 1,
				      "value": undefined,
				    },
				    "position": {
				      "end": 31,
				      "start": 25,
				    },
				    "type": "mark",
				  },
				  {
				    "content": "",
				    "position": {
				      "end": 31,
				      "start": 31,
				    },
				    "type": "text",
				  },
				]
			`)
		})

		describe('error handling', () => {
			it('handles empty input', () => {
				const result = parser.split('')

				expect(result).toMatchInlineSnapshot(`
					[
					  {
					    "content": "",
					    "position": {
					      "end": 0,
					      "start": 0,
					    },
					    "type": "text",
					  },
					]
				`)
			})

			it('handles malformed markup gracefully', () => {
			const input = '@[unclosed markup'
			const result = parser.split(input)

			expect(result).toMatchInlineSnapshot(`
				[
				  {
				    "content": "@[unclosed markup",
				    "position": {
				      "end": 17,
				      "start": 0,
				    },
				    "type": "text",
				  },
				]
			`)
		})

		describe('complex parsing', () => {
			it('handles nested marks', () => {
				// Test basic nested parsing
				const simpleParser = new ParserV2(['@[__label__]'])
				const input = '@[hello @[world]]'
				const result = simpleParser.split(input)

				expect(result).toMatchInlineSnapshot(`
					[
					  {
					    "content": "",
					    "position": {
					      "end": 0,
					      "start": 0,
					    },
					    "type": "text",
					  },
					  {
					    "children": [
					      {
					        "content": "hello ",
					        "position": {
					          "end": 6,
					          "start": 0,
					        },
					        "type": "text",
					      },
					      {
					        "children": [],
					        "content": "@[world]",
					        "data": {
					          "label": "world",
					          "optionIndex": 0,
					          "value": undefined,
					        },
					        "position": {
					          "end": 14,
					          "start": 6,
					        },
					        "type": "mark",
					      },
					      {
					        "content": "",
					        "position": {
					          "end": 14,
					          "start": 14,
					        },
					        "type": "text",
					      },
					    ],
					    "content": "@[hello @[world]]",
					    "data": {
					      "label": "hello @[world]",
					      "optionIndex": 0,
					      "value": undefined,
					    },
					    "position": {
					      "end": 17,
					      "start": 0,
					    },
					    "type": "mark",
					  },
					  {
					    "content": "",
					    "position": {
					      "end": 17,
					      "start": 17,
					    },
					    "type": "text",
					  },
					]
				`)
			})

			it('handles multiple and deeply nested marks', () => {
				const parser = new ParserV2(['@[__label__]'])
				const input = '@[level1 @[level2 @[level3]]]'
				const result = parser.split(input)

				expect(result).toMatchInlineSnapshot(`
					[
					  {
					    "content": "",
					    "position": {
					      "end": 0,
					      "start": 0,
					    },
					    "type": "text",
					  },
					  {
					    "children": [
					      {
					        "content": "level1 ",
					        "position": {
					          "end": 7,
					          "start": 0,
					        },
					        "type": "text",
					      },
					      {
					        "children": [
					          {
					            "content": "level2 ",
					            "position": {
					              "end": 7,
					              "start": 0,
					            },
					            "type": "text",
					          },
					          {
					            "children": [],
					            "content": "@[level3]",
					            "data": {
					              "label": "level3",
					              "optionIndex": 0,
					              "value": undefined,
					            },
					            "position": {
					              "end": 16,
					              "start": 7,
					            },
					            "type": "mark",
					          },
					          {
					            "content": "",
					            "position": {
					              "end": 16,
					              "start": 16,
					            },
					            "type": "text",
					          },
					        ],
					        "content": "@[level2 @[level3]]",
					        "data": {
					          "label": "level2 @[level3]",
					          "optionIndex": 0,
					          "value": undefined,
					        },
					        "position": {
					          "end": 26,
					          "start": 7,
					        },
					        "type": "mark",
					      },
					      {
					        "content": "",
					        "position": {
					          "end": 26,
					          "start": 26,
					        },
					        "type": "text",
					      },
					    ],
					    "content": "@[level1 @[level2 @[level3]]]",
					    "data": {
					      "label": "level1 @[level2 @[level3]]",
					      "optionIndex": 0,
					      "value": undefined,
					    },
					    "position": {
					      "end": 29,
					      "start": 0,
					    },
					    "type": "mark",
					  },
					  {
					    "content": "",
					    "position": {
					      "end": 29,
					      "start": 29,
					    },
					    "type": "text",
					  },
					]
				`)
			})

			it('handles mixed markup types with nesting', () => {
				const parser = new ParserV2(['@[__label__]', '#[__label__]'])
				const input = '@[hello #[world]]'
				const result = parser.split(input)

				expect(result).toMatchInlineSnapshot(`
					[
					  {
					    "content": "",
					    "position": {
					      "end": 0,
					      "start": 0,
					    },
					    "type": "text",
					  },
					  {
					    "children": [
					      {
					        "content": "hello ",
					        "position": {
					          "end": 6,
					          "start": 0,
					        },
					        "type": "text",
					      },
					      {
					        "children": [],
					        "content": "#[world]",
					        "data": {
					          "label": "world",
					          "optionIndex": 1,
					          "value": undefined,
					        },
					        "position": {
					          "end": 14,
					          "start": 6,
					        },
					        "type": "mark",
					      },
					      {
					        "content": "",
					        "position": {
					          "end": 14,
					          "start": 14,
					        },
					        "type": "text",
					      },
					    ],
					    "content": "@[hello #[world]]",
					    "data": {
					      "label": "hello #[world]",
					      "optionIndex": 0,
					      "value": undefined,
					    },
					    "position": {
					      "end": 17,
					      "start": 0,
					    },
					    "type": "mark",
					  },
					  {
					    "content": "",
					    "position": {
					      "end": 17,
					      "start": 17,
					    },
					    "type": "text",
					  },
					]
				`)
			})

			it('handles marks with values and nesting', () => {
				const parser = new ParserV2(['@[__label__](__value__)', '#[__label__]'])
				const input = '@[hello #[world]](value)'
				const result = parser.split(input)

				expect(result).toMatchInlineSnapshot(`
					[
					  {
					    "content": "",
					    "position": {
					      "end": 0,
					      "start": 0,
					    },
					    "type": "text",
					  },
					  {
					    "children": [
					      {
					        "content": "hello ",
					        "position": {
					          "end": 6,
					          "start": 0,
					        },
					        "type": "text",
					      },
					      {
					        "children": [],
					        "content": "#[world]",
					        "data": {
					          "label": "world",
					          "optionIndex": 1,
					          "value": undefined,
					        },
					        "position": {
					          "end": 14,
					          "start": 6,
					        },
					        "type": "mark",
					      },
					      {
					        "content": "",
					        "position": {
					          "end": 14,
					          "start": 14,
					        },
					        "type": "text",
					      },
					    ],
					    "content": "@[hello #[world]](value)",
					    "data": {
					      "label": "hello ",
					      "optionIndex": 0,
					      "value": "value",
					    },
					    "position": {
					      "end": 24,
					      "start": 0,
					    },
					    "type": "mark",
					  },
					  {
					    "content": "",
					    "position": {
					      "end": 24,
					      "start": 24,
					    },
					    "type": "text",
					  },
					]
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

				expect(result).toMatchInlineSnapshot(`
					[
					  {
					    "content": "",
					    "position": {
					      "end": 0,
					      "start": 0,
					    },
					    "type": "text",
					  },
					  {
					    "children": [],
					    "content": "@[first](1)",
					    "data": {
					      "label": "first",
					      "optionIndex": 0,
					      "value": "1",
					    },
					    "position": {
					      "end": 11,
					      "start": 0,
					    },
					    "type": "mark",
					  },
					  {
					    "content": "",
					    "position": {
					      "end": 11,
					      "start": 11,
					    },
					    "type": "text",
					  },
					  {
					    "children": [],
					    "content": "@[second](2)",
					    "data": {
					      "label": "second",
					      "optionIndex": 0,
					      "value": "2",
					    },
					    "position": {
					      "end": 23,
					      "start": 11,
					    },
					    "type": "mark",
					  },
					  {
					    "content": "",
					    "position": {
					      "end": 23,
					      "start": 23,
					    },
					    "type": "text",
					  },
					]
				`)
			})
		})
	})

	describe('integration', () => {
			it('handles complex real-world scenarios', () => {
				const input = 'Hello @[user](admin) welcome to #[project]! Check @[docs](https://example.com) for more info.'
				const result = parser.split(input)

				expect(result).toMatchInlineSnapshot(`
					[
					  {
					    "content": "Hello ",
					    "position": {
					      "end": 6,
					      "start": 0,
					    },
					    "type": "text",
					  },
					  {
					    "children": [],
					    "content": "@[user](admin)",
					    "data": {
					      "label": "user",
					      "optionIndex": 0,
					      "value": "admin",
					    },
					    "position": {
					      "end": 20,
					      "start": 6,
					    },
					    "type": "mark",
					  },
					  {
					    "content": " welcome to ",
					    "position": {
					      "end": 32,
					      "start": 20,
					    },
					    "type": "text",
					  },
					  {
					    "children": [],
					    "content": "#[project]",
					    "data": {
					      "label": "project",
					      "optionIndex": 1,
					      "value": undefined,
					    },
					    "position": {
					      "end": 42,
					      "start": 32,
					    },
					    "type": "mark",
					  },
					  {
					    "content": "! Check ",
					    "position": {
					      "end": 50,
					      "start": 42,
					    },
					    "type": "text",
					  },
					  {
					    "children": [],
					    "content": "@[docs](https://example.com)",
					    "data": {
					      "label": "docs",
					      "optionIndex": 0,
					      "value": "https://example.com",
					    },
					    "position": {
					      "end": 78,
					      "start": 50,
					    },
					    "type": "mark",
					  },
					  {
					    "content": " for more info.",
					    "position": {
					      "end": 93,
					      "start": 78,
					    },
					    "type": "text",
					  },
					]
				`)
			})
		})
	})
})
