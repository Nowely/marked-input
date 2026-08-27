import type {RowProps} from '@markput/react'
import {describe, expect, it, vi} from 'vitest'

import {Mark} from '../../shared/lib/marks'
import {mountComponent} from '../../shared/lib/page'

/**
 * THE REACT-SHAPED MISTAKE, which is the one issue 23 is named for: a row kind that paints a
 * perfectly good element and drops the `ref` it was handed. `RowProps.ref` is optional, so this
 * type-checks, and nothing on screen says the row is unusable.
 *
 * `rowKinds.spec.ts` provokes the same report with a component that paints NOTHING, because that is
 * the one spelling both frameworks share — a Vue row kind takes the editor's ref through its
 * instance and cannot drop it. The path is the same either way; this file pins the spelling a React
 * consumer can actually write.
 */
const Unbound = ({className, style, children}: RowProps) => (
	<h1 className={className} style={style}>
		{children}
	</h1>
)

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

describe('a row kind that drops the ref', () => {
	it('is reported even though it painted its element', async () => {
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			const {host} = await mountComponent({
				value: '# Title',
				separator: '\n',
				Mark,
				options: [{markup: '# __slot__', row: {Component: Unbound}}],
			})
			await nextFrame()

			// The row is on screen and reads correctly — which is exactly why nothing else says so.
			expect(host.querySelector('h1')?.textContent).toBe('Title')
			expect(errors.mock.calls.map(call => String(call[0]))).toEqual([
				'[markput] The row kind "# __slot__" rendered no element the editor could bind: spread `ref` onto ' +
					'the one element the component renders. Until it does, the caret cannot resolve into this row.',
			])
		} finally {
			errors.mockRestore()
		}
	})
})