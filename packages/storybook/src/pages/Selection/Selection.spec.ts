import {describe, expect, it} from 'vitest'

import {editingHost, firstChild} from '../../shared/lib/dom'
import {mountComponent} from '../../shared/lib/page'
import {Span} from './Selection.fixtures'

describe('Cross-select', () => {
	it('keeps an adapter-owned text surface when a custom Span is configured', async () => {
		const {host} = await mountComponent({defaultValue: 'hello', Span})
		const surface = firstChild(host)

		expect(host).toHaveAttribute('contenteditable', 'true')
		expect(editingHost(surface!)).toBe(host)
		expect(surface?.tagName).toBe('STRONG')
		expect(surface?.textContent).toBe('hello')
		expect(surface).not.toHaveAttribute('contenteditable')
	})
})