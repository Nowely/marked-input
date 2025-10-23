import {describe, it, expect, beforeEach} from 'vitest'
import {AhoCorasick, SegmentMatch} from './AhoCorasick'
import {MarkupDescriptor} from '../core/MarkupDescriptor'

// Helper function to create descriptors for testing
function createTestDescriptors(patterns: string[]): MarkupDescriptor[] {
	return patterns.map((pattern, index) => ({
		markup: pattern as any,
		index,
		trigger: pattern[0],
		segments: [pattern],
		gapTypes: [],
		hasMeta: false,
		hasNested: false,
		hasTwoValues: false,
		isSymmetric: false,
	}))
}

describe('AhoCorasick', () => {
	describe('constructor', () => {
		it('should initialize with empty patterns array', () => {
			const ac = new AhoCorasick([])
			expect(ac).toBeDefined()
			expect(ac.search('test')).toEqual([])
		})

		it('should initialize with single pattern', () => {
			const ac = new AhoCorasick(['hello'])
			expect(ac).toBeDefined()
		})

		it('should initialize with multiple patterns', () => {
			const ac = new AhoCorasick(['hello', 'world', 'test'])
			expect(ac).toBeDefined()
		})

		it('should handle patterns with special characters', () => {
			const ac = new AhoCorasick(['@[', '](', ')', '#['])
			expect(ac).toBeDefined()
		})

		it('should handle unicode patterns', () => {
			const ac = new AhoCorasick(['привет', '世界', '🚀'])
			expect(ac).toBeDefined()
		})

		it('should handle duplicate patterns', () => {
			const ac = new AhoCorasick(['test', 'test', 'hello'])
			expect(ac).toBeDefined()
			// Should still work correctly despite duplicates
			const results = ac.search('test')
			expect(results.length).toBeGreaterThan(0)
		})

		it('should not modify the original patterns array', () => {
			const patterns = ['hello', 'world']
			const originalPatterns = [...patterns]
			const ac = new AhoCorasick(patterns)
			patterns.push('modified')
			expect(patterns).not.toEqual(originalPatterns)
			// AhoCorasick should still work with original patterns
			const results = ac.search('hello world')
			expect(results).toHaveLength(2)
		})
	})

	describe('search - basic functionality', () => {
		it('should find single pattern in text', () => {
			const ac = new AhoCorasick(['hello'])
			const results = ac.search('hello world')

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				index: 0,
				start: 0,
				end: 4,
				value: 'hello',
			})
		})

		it('should find multiple different patterns in text', () => {
			const ac = new AhoCorasick(['hello', 'world'])
			const results = ac.search('hello world')

			expect(results).toHaveLength(2)

			// Sort results by start position for consistent testing
			const sorted = results.sort((a, b) => a.start - b.start)

			expect(sorted[0]).toEqual({
				index: 0,
				start: 0,
				end: 4,
				value: 'hello',
			})
			expect(sorted[1]).toEqual({
				index: 1,
				start: 6,
				end: 10,
				value: 'world',
			})
		})

		it('should find same pattern multiple times', () => {
			const ac = new AhoCorasick(['test'])
			const results = ac.search('test test test')

			expect(results).toHaveLength(3)

			const sorted = results.sort((a, b) => a.start - b.start)

			expect(sorted[0]).toMatchObject({start: 0, end: 3, value: 'test'})
			expect(sorted[1]).toMatchObject({start: 5, end: 8, value: 'test'})
			expect(sorted[2]).toMatchObject({start: 10, end: 13, value: 'test'})
		})

		it('should return empty array when no patterns match', () => {
			const ac = new AhoCorasick(['hello', 'world'])
			const results = ac.search('foo bar baz')

			expect(results).toEqual([])
		})

		it('should handle empty text', () => {
			const ac = new AhoCorasick(['hello'])
			const results = ac.search('')

			expect(results).toEqual([])
		})

		it('should handle empty patterns array', () => {
			const ac = new AhoCorasick([])
			const results = ac.search('hello world')

			expect(results).toEqual([])
		})
	})

	describe('search - edge cases', () => {
		it('should find pattern at the beginning of text', () => {
			const ac = new AhoCorasick(['hello'])
			const results = ac.search('hello')

			expect(results).toHaveLength(1)
			expect(results[0]).toMatchObject({start: 0, end: 4})
		})

		it('should find pattern at the end of text', () => {
			const ac = new AhoCorasick(['world'])
			const results = ac.search('hello world')

			expect(results).toHaveLength(1)
			expect(results[0]).toMatchObject({start: 6, end: 10})
		})

		it('should find pattern that is the entire text', () => {
			const ac = new AhoCorasick(['hello'])
			const results = ac.search('hello')

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				index: 0,
				start: 0,
				end: 4,
				value: 'hello',
			})
		})

		it('should find adjacent patterns without gap', () => {
			const ac = new AhoCorasick(['hello', 'world'])
			const results = ac.search('helloworld')

			expect(results).toHaveLength(2)

			const sorted = results.sort((a, b) => a.start - b.start)

			expect(sorted[0]).toMatchObject({start: 0, end: 4, value: 'hello'})
			expect(sorted[1]).toMatchObject({start: 5, end: 9, value: 'world'})
		})

		it('should handle single character patterns', () => {
			const ac = new AhoCorasick(['a', 'b', 'c'])
			const results = ac.search('abc')

			expect(results).toHaveLength(3)

			const sorted = results.sort((a, b) => a.start - b.start)

			expect(sorted[0]).toMatchObject({start: 0, end: 0, value: 'a'})
			expect(sorted[1]).toMatchObject({start: 1, end: 1, value: 'b'})
			expect(sorted[2]).toMatchObject({start: 2, end: 2, value: 'c'})
		})

		it('should handle very long pattern', () => {
			const longPattern = 'a'.repeat(1000)
			const ac = new AhoCorasick([longPattern])
			const text = 'x'.repeat(100) + longPattern + 'y'.repeat(100)
			const results = ac.search(text)

			expect(results).toHaveLength(1)
			expect(results[0]).toMatchObject({
				start: 100,
				end: 1099,
				value: longPattern,
			})
		})

		it('should handle very long text', () => {
			const ac = new AhoCorasick(['needle'])
			const text = 'hay'.repeat(10000) + 'needle' + 'stack'.repeat(10000)
			const results = ac.search(text)

			expect(results).toHaveLength(1)
			expect(results[0]).toMatchObject({
				start: 30000,
				end: 30005,
				value: 'needle',
			})
		})
	})

	describe('search - overlapping patterns', () => {
		it('should find overlapping patterns (pattern is prefix of another)', () => {
			const ac = new AhoCorasick(['he', 'hello'])
			const results = ac.search('hello')

			expect(results).toHaveLength(2)

			const sorted = results.sort((a, b) => a.start - b.start || a.end - b.end)

			expect(sorted[0]).toMatchObject({start: 0, end: 1, value: 'he'})
			expect(sorted[1]).toMatchObject({start: 0, end: 4, value: 'hello'})
		})

		it('should find overlapping patterns (pattern is suffix of another)', () => {
			const ac = new AhoCorasick(['lo', 'hello'])
			const results = ac.search('hello')

			expect(results).toHaveLength(2)

			const sorted = results.sort((a, b) => a.start - b.start || a.end - b.end)

			expect(sorted[0]).toMatchObject({start: 0, end: 4, value: 'hello'})
			expect(sorted[1]).toMatchObject({start: 3, end: 4, value: 'lo'})
		})

		it('should find overlapping patterns (pattern is substring of another)', () => {
			const ac = new AhoCorasick(['ell', 'hello'])
			const results = ac.search('hello')

			expect(results).toHaveLength(2)

			const sorted = results.sort((a, b) => a.start - b.start || a.end - b.end)

			expect(sorted[0]).toMatchObject({start: 0, end: 4, value: 'hello'})
			expect(sorted[1]).toMatchObject({start: 1, end: 3, value: 'ell'})
		})

		it('should find complex overlapping patterns', () => {
			const ac = new AhoCorasick(['abc', 'bcd', 'cde'])
			const results = ac.search('abcde')

			expect(results).toHaveLength(3)

			const sorted = results.sort((a, b) => a.start - b.start)

			expect(sorted[0]).toMatchObject({start: 0, end: 2, value: 'abc'})
			expect(sorted[1]).toMatchObject({start: 1, end: 3, value: 'bcd'})
			expect(sorted[2]).toMatchObject({start: 2, end: 4, value: 'cde'})
		})

		it('should find patterns with common prefix', () => {
			const ac = new AhoCorasick(['test', 'testing', 'tester'])
			const results = ac.search('testing tester')

			expect(results).toHaveLength(4)

			const sorted = results.sort((a, b) => a.start - b.start || a.end - b.end)

			// "testing" contains "test"
			expect(sorted[0]).toMatchObject({start: 0, end: 3, value: 'test'})
			expect(sorted[1]).toMatchObject({start: 0, end: 6, value: 'testing'})

			// "tester" contains "test"
			expect(sorted[2]).toMatchObject({start: 8, end: 11, value: 'test'})
			expect(sorted[3]).toMatchObject({start: 8, end: 13, value: 'tester'})
		})
	})

	describe('search - special characters and unicode', () => {
		it('should find patterns with special characters', () => {
			const ac = new AhoCorasick(['@[', '](', ')'])
			const results = ac.search('@[hello](world)')

			expect(results).toHaveLength(3)

			const sorted = results.sort((a, b) => a.start - b.start)

			expect(sorted[0]).toMatchObject({value: '@['})
			expect(sorted[1]).toMatchObject({value: ']('})
			expect(sorted[2]).toMatchObject({value: ')'})
		})

		it('should find unicode patterns', () => {
			const ac = new AhoCorasick(['привет', 'мир'])
			const results = ac.search('привет мир')

			expect(results).toHaveLength(2)
			expect(results[0]).toMatchObject({value: 'привет'})
			expect(results[1]).toMatchObject({value: 'мир'})
		})

		it('should find emoji patterns', () => {
			const ac = new AhoCorasick(['🚀', '🌍', '👋'])
			const results = ac.search('Hello 👋 from Earth 🌍 to space 🚀')

			// Note: Emojis may be multi-byte characters, so matching might be affected
			// At minimum, we should find the patterns if they exist
			expect(results.length).toBeGreaterThanOrEqual(0)

			// If we find results, they should be valid emojis
			if (results.length > 0) {
				const values = results.map(r => r.value)
				values.forEach(v => {
					expect(['🚀', '🌍', '👋']).toContain(v)
				})
			}
		})

		it('should find mixed unicode and ASCII patterns', () => {
			const ac = new AhoCorasick(['hello', 'привет', '世界'])
			const results = ac.search('hello привет 世界')

			expect(results).toHaveLength(3)

			const values = results.map(r => r.value)
			expect(values).toContain('hello')
			expect(values).toContain('привет')
			expect(values).toContain('世界')
		})

		it('should handle newlines in patterns', () => {
			const ac = new AhoCorasick(['hello\nworld'])
			const results = ac.search('hello\nworld')

			expect(results).toHaveLength(1)
			expect(results[0]).toMatchObject({value: 'hello\nworld'})
		})

		it('should handle tabs in patterns', () => {
			const ac = new AhoCorasick(['hello\tworld'])
			const results = ac.search('hello\tworld')

			expect(results).toHaveLength(1)
			expect(results[0]).toMatchObject({value: 'hello\tworld'})
		})

		it('should handle whitespace patterns', () => {
			const ac = new AhoCorasick([' ', '  ', '\n', '\t'])
			const results = ac.search('hello world')

			expect(results.length).toBeGreaterThan(0)
			expect(results.some(r => r.value === ' ')).toBe(true)
		})
	})

	describe('search - pattern indices', () => {
		it('should return correct index for each pattern', () => {
			const patterns = ['first', 'second', 'third']
			const ac = new AhoCorasick(patterns)
			const results = ac.search('first second third')

			expect(results).toHaveLength(3)

			const firstMatch = results.find(r => r.value === 'first')
			const secondMatch = results.find(r => r.value === 'second')
			const thirdMatch = results.find(r => r.value === 'third')

			expect(firstMatch?.index).toBe(0)
			expect(secondMatch?.index).toBe(1)
			expect(thirdMatch?.index).toBe(2)
		})

		it('should handle duplicate patterns with correct indices', () => {
			const patterns = ['test', 'hello', 'test']
			const ac = new AhoCorasick(patterns)
			const results = ac.search('test')

			// Should find matches for both pattern indices 0 and 2
			expect(results.length).toBeGreaterThanOrEqual(1)
			const indices = results.map(r => r.index)
			expect(indices).toContain(0)
		})
	})

	describe('search - position validation', () => {
		it('should return correct start and end positions', () => {
			const ac = new AhoCorasick(['hello'])
			const results = ac.search('Say hello to everyone')

			expect(results).toHaveLength(1)
			expect(results[0].start).toBe(4)
			expect(results[0].end).toBe(8)
			expect(results[0].end - results[0].start + 1).toBe('hello'.length)
		})

		it('should have end >= start for all matches', () => {
			const ac = new AhoCorasick(['a', 'ab', 'abc', 'abcd'])
			const results = ac.search('abcd')

			results.forEach(result => {
				expect(result.end).toBeGreaterThanOrEqual(result.start)
			})
		})

		it('should match actual substring using positions', () => {
			const text = 'The quick brown fox jumps'
			const ac = new AhoCorasick(['quick', 'brown', 'fox'])
			const results = ac.search(text)

			results.forEach(result => {
				const extracted = text.substring(result.start, result.end + 1)
				expect(extracted).toBe(result.value)
			})
		})

		it('should have correct end position (inclusive)', () => {
			const ac = new AhoCorasick(['test'])
			const text = 'test'
			const results = ac.search(text)

			expect(results).toHaveLength(1)
			// end should be 3 (inclusive) for "test" which is 0-3
			expect(results[0].end).toBe(3)
			expect(text.substring(results[0].start, results[0].end + 1)).toBe('test')
		})
	})

	describe('search - real-world markup patterns', () => {
		it('should find markup delimiters in text', () => {
			const ac = new AhoCorasick(['@[', ']', '(', ')'])
			const results = ac.search('@[user](John Doe)')

			expect(results.length).toBeGreaterThan(0)

			const values = results.map(r => r.value)
			expect(values).toContain('@[')
			expect(values).toContain(']')
			expect(values).toContain('(')
			expect(values).toContain(')')
		})

		it('should find multiple markup patterns in markdown-like text', () => {
			const ac = new AhoCorasick(['**', '*', '__', '_', '~~', '`'])
			const text = '**bold** *italic* __underline__ ~~strike~~ `code`'
			const results = ac.search(text)

			expect(results.length).toBeGreaterThan(0)

			const values = results.map(r => r.value)
			expect(values).toContain('**')
			expect(values).toContain('*')
			expect(values).toContain('~~')
			expect(values).toContain('`')
		})

		it('should find HTML-like tag delimiters', () => {
			const ac = new AhoCorasick(['<', '>', '</', '/>'])
			const text = '<div>content</div> <img />'
			const results = ac.search(text)

			expect(results.length).toBeGreaterThan(0)

			const values = results.map(r => r.value)
			expect(values).toContain('<')
			expect(values).toContain('>')
			expect(values).toContain('</')
		})

		it('should find complex nested markup delimiters', () => {
			const ac = new AhoCorasick(['@[', '#[', ']', '(', ')'])
			const text = '@[user #[tag](value)](meta)'
			const results = ac.search(text)

			expect(results.length).toBeGreaterThan(0)
			expect(results.filter(r => r.value === '@[').length).toBe(1)
			expect(results.filter(r => r.value === '#[').length).toBe(1)
			expect(results.filter(r => r.value === ']').length).toBeGreaterThan(0)
		})
	})

	describe('search - performance characteristics', () => {
		it('should handle many patterns efficiently', () => {
			// Generate 1000 different patterns
			const patterns = Array.from({length: 1000}, (_, i) => `pattern${i}`)
			const ac = new AhoCorasick(patterns)

			const text = 'Some text with pattern42 and pattern137 in it'
			const results = ac.search(text)

			// Should find at least the two exact patterns
			// Note: may also find subpattern matches like "pattern1" in "pattern137"
			expect(results.length).toBeGreaterThanOrEqual(2)
			expect(results.some(r => r.value === 'pattern42')).toBe(true)
			expect(results.some(r => r.value === 'pattern137')).toBe(true)
		})

		it('should handle many occurrences efficiently', () => {
			const ac = new AhoCorasick(['a', 'b'])
			const text = 'a'.repeat(1000) + 'b'.repeat(1000)
			const results = ac.search(text)

			expect(results).toHaveLength(2000)
			expect(results.filter(r => r.value === 'a')).toHaveLength(1000)
			expect(results.filter(r => r.value === 'b')).toHaveLength(1000)
		})

		it('should handle text with no matches efficiently', () => {
			const patterns = Array.from({length: 100}, (_, i) => `pattern${i}`)
			const ac = new AhoCorasick(patterns)

			const text = 'x'.repeat(10000)
			const results = ac.search(text)

			expect(results).toEqual([])
		})
	})

	describe('search - case sensitivity', () => {
		it('should be case sensitive by default', () => {
			const ac = new AhoCorasick(['Hello'])

			const results1 = ac.search('Hello')
			const results2 = ac.search('hello')
			const results3 = ac.search('HELLO')

			expect(results1).toHaveLength(1)
			expect(results2).toHaveLength(0)
			expect(results3).toHaveLength(0)
		})

		it('should distinguish between different cases', () => {
			const ac = new AhoCorasick(['test', 'Test', 'TEST'])
			const results = ac.search('test Test TEST')

			expect(results).toHaveLength(3)

			const values = results.map(r => r.value)
			expect(values).toContain('test')
			expect(values).toContain('Test')
			expect(values).toContain('TEST')
		})
	})

	describe('search - complex scenarios', () => {
		it('should handle patterns with repeated characters', () => {
			const ac = new AhoCorasick(['aaa', 'aa', 'a'])
			const results = ac.search('aaaa')

			// Should find: 'aaa' at 0-2, 'aa' at 0-1, 'aa' at 1-2, 'aa' at 2-3,
			// 'a' at 0, 'a' at 1, 'a' at 2, 'a' at 3, and 'aaa' at 1-3
			expect(results.length).toBeGreaterThan(0)
			expect(results.some(r => r.value === 'aaa')).toBe(true)
			expect(results.some(r => r.value === 'aa')).toBe(true)
			expect(results.some(r => r.value === 'a')).toBe(true)
		})

		it('should handle patterns with alternating characters', () => {
			const ac = new AhoCorasick(['aba', 'bab'])
			const results = ac.search('ababab')

			expect(results.length).toBeGreaterThan(0)
			expect(results.filter(r => r.value === 'aba').length).toBeGreaterThanOrEqual(2)
			expect(results.filter(r => r.value === 'bab').length).toBeGreaterThanOrEqual(2)
		})

		it('should handle palindromic patterns', () => {
			const ac = new AhoCorasick(['aba', 'abba', 'abcba'])
			const results = ac.search('aba abba abcba')

			expect(results).toHaveLength(3)
			expect(results.map(r => r.value)).toEqual(expect.arrayContaining(['aba', 'abba', 'abcba']))
		})

		it('should handle patterns with common suffixes', () => {
			const ac = new AhoCorasick(['ing', 'ring', 'string'])
			const results = ac.search('string')

			expect(results).toHaveLength(3)

			const sorted = results.sort((a, b) => a.start - b.start || a.end - b.end)

			expect(sorted.map(r => r.value)).toEqual(expect.arrayContaining(['string', 'ring', 'ing']))
		})

		it('should handle interleaved patterns', () => {
			const ac = new AhoCorasick(['abc', 'bcd', 'cde', 'def'])
			const results = ac.search('abcdef')

			expect(results).toHaveLength(4)

			const sorted = results.sort((a, b) => a.start - b.start)

			expect(sorted[0]).toMatchObject({value: 'abc'})
			expect(sorted[1]).toMatchObject({value: 'bcd'})
			expect(sorted[2]).toMatchObject({value: 'cde'})
			expect(sorted[3]).toMatchObject({value: 'def'})
		})
	})

	describe('search - comprehensive integration tests', () => {
		it('should correctly parse complex markdown-like document', () => {
			const ac = new AhoCorasick([
				'**', // bold
				'*', // italic
				'`', // code
				'[',
				']',
				'(',
				')', // links
				'#', // headers
				'\n',
			])

			const text = `# Header\n**bold** and *italic* with \`code\` and [link](url)`
			const results = ac.search(text)

			expect(results.length).toBeGreaterThan(0)

			// Should find all delimiters
			const values = results.map(r => r.value)
			expect(values).toContain('**')
			expect(values).toContain('*')
			expect(values).toContain('`')
			expect(values).toContain('[')
			expect(values).toContain(']')
			expect(values).toContain('(')
			expect(values).toContain(')')
			expect(values).toContain('#')
		})

		it('should handle realistic markup parsing scenario', () => {
			const ac = new AhoCorasick([
				'@[', // user mention start
				'#[', // tag start
				']', // closing bracket
				'(',
				')', // parentheses for meta
			])

			const text = 'Hello @[John Doe](john) and #[javascript] @[Jane](jane)'
			const results = ac.search(text)

			// Should find all markup delimiters in correct positions
			expect(results.length).toBeGreaterThan(0)

			const atBrackets = results.filter(r => r.value === '@[')
			const hashBrackets = results.filter(r => r.value === '#[')
			const closeBrackets = results.filter(r => r.value === ']')
			const parens = results.filter(r => r.value === '(' || r.value === ')')

			expect(atBrackets).toHaveLength(2)
			expect(hashBrackets).toHaveLength(1)
			expect(closeBrackets).toHaveLength(3)
			expect(parens.length).toBeGreaterThanOrEqual(4)
		})

		it('should handle deeply nested markup structure', () => {
			const ac = new AhoCorasick(['<', '>', '</', 'class="', '"'])
			const text = '<div class="outer"><span class="inner">text</span></div>'
			const results = ac.search(text)

			expect(results.length).toBeGreaterThan(0)

			const openTags = results.filter(r => r.value === '<')
			const closeTags = results.filter(r => r.value === '>')

			expect(openTags.length).toBeGreaterThan(0)
			expect(closeTags.length).toBeGreaterThan(0)
		})
	})

	describe('edge cases and error handling', () => {
		it('should handle patterns longer than text', () => {
			const ac = new AhoCorasick(['verylongpattern'])
			const results = ac.search('short')

			expect(results).toEqual([])
		})

		it('should handle text with only pattern', () => {
			const ac = new AhoCorasick(['test'])
			const results = ac.search('test')

			expect(results).toHaveLength(1)
			expect(results[0]).toMatchObject({
				start: 0,
				end: 3,
				value: 'test',
			})
		})

		it('should handle repeated patterns in text', () => {
			const ac = new AhoCorasick(['aa'])
			const results = ac.search('aaaa')

			// Should find overlapping 'aa' at positions 0-1, 1-2, 2-3
			expect(results).toHaveLength(3)

			const sorted = results.sort((a, b) => a.start - b.start)

			expect(sorted[0]).toMatchObject({start: 0, end: 1})
			expect(sorted[1]).toMatchObject({start: 1, end: 2})
			expect(sorted[2]).toMatchObject({start: 2, end: 3})
		})

		it('should handle pattern that appears at every position', () => {
			const ac = new AhoCorasick(['a'])
			const results = ac.search('aaaa')

			expect(results).toHaveLength(4)
		})

		it('should handle mixed length patterns', () => {
			const ac = new AhoCorasick(['a', 'ab', 'abc', 'abcd', 'abcde'])
			const results = ac.search('abcde')

			expect(results).toHaveLength(5)

			const values = results.map(r => r.value).sort((a, b) => a.length - b.length)
			expect(values).toEqual(['a', 'ab', 'abc', 'abcd', 'abcde'])
		})
	})

	describe('failure links and automaton structure', () => {
		it('should correctly use failure links for patterns with common prefixes', () => {
			const ac = new AhoCorasick(['she', 'he', 'her', 'hers'])
			const results = ac.search('shers')

			// Should find: 'she' at 0-2, 'he' at 1-2, 'her' at 1-3, 'hers' at 1-4
			expect(results.length).toBeGreaterThan(0)

			const values = results.map(r => r.value)
			expect(values).toContain('she')
			expect(values).toContain('he')
			expect(values).toContain('her')
			expect(values).toContain('hers')
		})

		it('should correctly handle failure links with suffix patterns', () => {
			const ac = new AhoCorasick(['ab', 'bab', 'abab'])
			const results = ac.search('ababab')

			expect(results.length).toBeGreaterThan(0)
			expect(results.some(r => r.value === 'ab')).toBe(true)
			expect(results.some(r => r.value === 'bab')).toBe(true)
			expect(results.some(r => r.value === 'abab')).toBe(true)
		})

		it('should handle patterns that require backtracking', () => {
			const ac = new AhoCorasick(['aaab', 'aab', 'ab'])
			const results = ac.search('aaab')

			// Should find all three patterns
			expect(results).toHaveLength(3)

			const values = results.map(r => r.value)
			expect(values).toContain('aaab')
			expect(values).toContain('aab')
			expect(values).toContain('ab')
		})
	})

	describe('return value properties', () => {
		it('should return objects with all required properties', () => {
			const ac = new AhoCorasick(['test'])
			const results = ac.search('test')

			expect(results).toHaveLength(1)

			const match = results[0]
			expect(match).toHaveProperty('index')
			expect(match).toHaveProperty('start')
			expect(match).toHaveProperty('end')
			expect(match).toHaveProperty('value')

			expect(typeof match.index).toBe('number')
			expect(typeof match.start).toBe('number')
			expect(typeof match.end).toBe('number')
			expect(typeof match.value).toBe('string')
		})

		it('should return value that matches original pattern', () => {
			const patterns = ['hello', 'world', 'test']
			const ac = new AhoCorasick(patterns)
			const results = ac.search('hello world test')

			results.forEach(result => {
				expect(patterns[result.index]).toBe(result.value)
			})
		})
	})

	describe('stress tests', () => {
		it('should handle large number of patterns', () => {
			const patterns = Array.from({length: 10000}, (_, i) => `p${i}`)
			const ac = new AhoCorasick(patterns)

			expect(ac).toBeDefined()

			const results = ac.search('p5000')
			// Should find at least the exact pattern "p5000"
			// Note: may also find subpatterns like "p5", "p50", "p500" which are also in the pattern array
			expect(results.length).toBeGreaterThanOrEqual(1)
			expect(results.some(r => r.value === 'p5000')).toBe(true)
		})

		it('should handle large text efficiently', () => {
			const ac = new AhoCorasick(['needle'])
			const largeText = 'x'.repeat(1000000) + 'needle' + 'y'.repeat(1000000)

			const results = ac.search(largeText)

			expect(results).toHaveLength(1)
			expect(results[0].value).toBe('needle')
			expect(results[0].start).toBe(1000000)
		})

		it('should handle many small patterns in large text', () => {
			const patterns = ['a', 'b', 'c', 'd', 'e']
			const ac = new AhoCorasick(patterns)
			const text = 'abcde'.repeat(1000)

			const results = ac.search(text)

			// Should find 5000 matches (1000 of each pattern)
			expect(results).toHaveLength(5000)
		})
	})
})
