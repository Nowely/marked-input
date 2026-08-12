import {MarkedInput} from '@markput/vue'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'
import {defineComponent, h} from 'vue'

import {editingHost, firstChild} from '../../shared/lib/dom'

describe('Cross-select', () => {
	it('keeps an adapter-owned text surface when a custom Span is configured', async () => {
		const Span = defineComponent({
			setup(_, {slots}) {
				return () => h('strong', {}, slots.default?.())
			},
		})
		const {container} = await render(MarkedInput, {props: {defaultValue: 'hello', Span}})

		const host = firstChild(container)!
		const surface = firstChild(host)

		expect(host).toHaveAttribute('contenteditable', 'true')
		expect(editingHost(surface!)).toBe(host)
		expect(surface?.tagName).toBe('STRONG')
		expect(surface?.textContent).toBe('hello')
		expect(surface).not.toHaveAttribute('contenteditable')
	})
})