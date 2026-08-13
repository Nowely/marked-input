import {describe, expect, it} from 'vitest'

import {snapshotHtml} from '../shared/lib/htmlSnapshot'

describe('snapshotHtml', () => {
	it('formats nested html, strips unstable attributes and drops framework comments', () => {
		const html =
			'<div class="wrapper" style="color: red"><span contenteditable="true">Hello</span><mark tabindex="0"><strong>wor</strong><em>ld</em></mark><!--v-if--></div>'

		expect(snapshotHtml(html)).toMatchInlineSnapshot(`
			"<div>
			  <span contenteditable="true">Hello</span>
			  <mark tabindex="0">
			    <strong>wor</strong>
			    <em>ld</em>
			  </mark>
			</div>"
		`)
	})

	it('represents multiline text and attribute values without raw snapshot line breaks', () => {
		const html = '<div><span contenteditable="true">hello\n</span><pre data-value="a\nb">a\nb</pre></div>'

		expect(snapshotHtml(html)).toMatchInlineSnapshot(`
			"<div>
			  <span contenteditable="true">hello&#10;</span>
			  <pre data-value="a&#10;b">a&#10;b</pre>
			</div>"
		`)
	})

	it('keeps browser serialization for void elements', () => {
		const html = '<div><input class="checkbox" style="color: red" type="checkbox"><span>Done</span></div>'

		expect(snapshotHtml(html)).toMatchInlineSnapshot(`
			"<div>
			  <input type="checkbox">
			  <span>Done</span>
			</div>"
		`)
	})

	it('escapes serialized text and attribute content', () => {
		const html = '<div data-value="a &amp; b &quot;c&quot;">Tom &amp; Jerry &lt;3</div>'

		expect(snapshotHtml(html)).toBe('<div data-value="a &amp; b &quot;c&quot;">Tom &amp; Jerry &lt;3</div>')
	})
})