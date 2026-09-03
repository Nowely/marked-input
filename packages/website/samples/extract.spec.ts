import {describe, expect, it} from 'vitest'

import {DirectiveError, extractSamples, parseDirectives, stripElisions} from './extract'

const page = (body: string) => extractSamples(body, 'guides/x.md')

describe('extractSamples', () => {
	it('takes the typed fences and leaves the prose ones', () => {
		const samples = page('intro\n\n```tsx\nconst a = 1\n```\n\n```bash\npnpm i\n```\n\n```ts\nconst b = 2\n```\n')
		expect(samples.map(s => s.code)).toEqual(['const a = 1', 'const b = 2'])
	})

	it('numbers a sample by the line its FIRST code line sits on', () => {
		const samples = page('a\nb\n\n```tsx\nconst a = 1\n```\n')
		expect(samples[0]!.line).toBe(5)
	})

	it('keeps a longer fence whole when a shorter one is quoted inside it', () => {
		const samples = page('````tsx\nconst a = "```"\n```\nstill inside\n````\n')
		expect(samples).toHaveLength(1)
		expect(samples[0]!.code).toBe('const a = "```"\n```\nstill inside')
	})

	it('strips the indent an indented fence carries and records it', () => {
		const samples = page('    ```tsx\n    const a = 1\n    ```\n')
		expect(samples[0]!.code).toBe('const a = 1')
		expect(samples[0]!.indent).toBe(4)
	})

	it('reads the fence directives', () => {
		const samples = page('```tsx fragment uses=Mention,node:RowNode\nconst a = 1\n```\n')
		expect(samples[0]!.directives.fragment).toBe(true)
		expect(samples[0]!.directives.uses).toEqual([
			{name: 'Mention', type: 'any'},
			{name: 'node', type: 'RowNode'},
		])
	})

	it('does not leak one fence’s directives into the next', () => {
		const samples = page('```tsx uses=A\nconst a = 1\n```\n\n```tsx\nconst b = 2\n```\n')
		expect(samples[1]!.directives.uses).toEqual([])
	})
})

describe('parseDirectives', () => {
	it('refuses a word it does not know, rather than ignoring it', () => {
		expect(() => parseDirectives('fragmnet', 'x.md:1')).toThrow(DirectiveError)
	})

	it('refuses two shapes on one fence', () => {
		expect(() => parseDirectives('fragment markup', 'x.md:1')).toThrow(DirectiveError)
	})

	it('refuses a sketch with no reason', () => {
		expect(() => parseDirectives('sketch=""', 'x.md:1')).toThrow(DirectiveError)
	})

	it('keeps a quoted reason whole', () => {
		expect(parseDirectives('sketch="two shapes side by side"', 'x.md:1').sketch).toBe('two shapes side by side')
	})
})

describe('stripElisions', () => {
	it('blanks an elision that stands where a value would, keeping the columns', () => {
		expect(stripElisions('const a = {b: 1, ...}')).toBe('const a = {b: 1,    }')
		expect(stripElisions('row: {…}')).toBe('row: { }')
	})

	it('leaves a spread alone', () => {
		expect(stripElisions('const a = {...props}')).toBe('const a = {...props}')
	})
})