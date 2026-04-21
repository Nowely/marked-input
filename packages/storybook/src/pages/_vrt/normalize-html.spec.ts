import {describe, expect, it} from 'vitest'

import {normalizeHtml} from './normalize-html'

describe('normalizeHtml', () => {
	it('strips React useId outputs of the :rXX: form', () => {
		const input = '<div id=":r0:" aria-labelledby=":r1:"><span id=":rab:">x</span></div>'
		expect(normalizeHtml(input)).toBe('<div id="__ID__" aria-labelledby="__ID__"><span id="__ID__">x</span></div>')
	})

	it('strips legacy React useId outputs of the «rXX» form', () => {
		const input = '<div id="«ra»">x</div>'
		expect(normalizeHtml(input)).toBe('<div id="__ID__">x</div>')
	})

	it('strips Vue scoped-style 8-hex hashes', () => {
		const input = '<div data-v-abc12345 class="foo" data-v-1234abcd>x</div>'
		expect(normalizeHtml(input)).toBe('<div data-v-__HASH__ class="foo" data-v-__HASH__>x</div>')
	})

	it('collapses whitespace inside inline style attributes', () => {
		const input = '<div style="  color:  red;\n  padding: 10px  ">x</div>'
		expect(normalizeHtml(input)).toBe('<div style="color: red; padding: 10px">x</div>')
	})

	it('collapses inter-tag whitespace', () => {
		const input = '<div>\n  <span>x</span>\n  <span>y</span>\n</div>'
		expect(normalizeHtml(input)).toBe('<div><span>x</span><span>y</span></div>')
	})

	it('preserves text content whitespace', () => {
		const input = '<p>hello  world</p>'
		expect(normalizeHtml(input)).toBe('<p>hello  world</p>')
	})

	it('preserves class names and non-id attributes', () => {
		const input = '<button class="MuiButton-root Mui-focused" type="button" aria-expanded="false">x</button>'
		expect(normalizeHtml(input)).toBe(
			'<button class="MuiButton-root Mui-focused" type="button" aria-expanded="false">x</button>'
		)
	})

	it('is idempotent', () => {
		const input = '<div id=":r0:" data-v-abcdef12>\n  <span style="  color: red  ">x</span>\n</div>'
		const once = normalizeHtml(input)
		expect(normalizeHtml(once)).toBe(once)
	})
})