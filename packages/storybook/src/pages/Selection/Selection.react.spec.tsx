import {MarkedInput} from '@markput/react'
import type {ReactNode} from 'react'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'

import {editingHost, firstChild} from '../../shared/lib/dom'

describe('Cross-select', () => {
	it('keeps an adapter-owned text surface when a custom Span is configured', async () => {
		const Span = ({children}: {children?: ReactNode}) => <strong>{children}</strong>
		const {container} = await render(<MarkedInput defaultValue="hello" Span={Span} />)

		const host = firstChild(container)!
		const surface = firstChild(host)

		expect(host).toHaveAttribute('contenteditable', 'true')
		expect(editingHost(surface!)).toBe(host)
		expect(surface?.tagName).toBe('STRONG')
		expect(surface?.textContent).toBe('hello')
		expect(surface).not.toHaveAttribute('contenteditable')
	})
})