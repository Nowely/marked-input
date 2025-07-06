import '@testing-library/jest-dom'
import {act, render} from '@testing-library/react'
import user from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'
import {Story} from '../_utils/stories'

const {Default} = Story.Base

describe('API: Overlay and Triggers', () => {
	it('should appear a overlay component by trigger', async () => {
		//override event listener because 'selectionchange' don't work in here
		let events: Record<string, EventListenerOrEventListenerObject> = {}
		document.addEventListener = vi.fn((event, callback) => events[event] = callback)
		document.removeEventListener = vi.fn((event, callback) => delete events[event])

		const {getByText, findByText} = render(<Default
			trigger="selectionChange" defaultValue="@ @[mark](1)!"
			options={[{markup: '@[__label__](__value__)', data: ['Item']}]}
		/>)
		const span = getByText(/@/i)

		await user.pointer({target: span, offset: 0, keys: '[MouseLeft]'})
		await user.pointer({target: span, offset: 1, keys: '[MouseLeft]'})

		await act(() => {
			// @ts-ignore
			events['selectionchange']({})
		})

		expect(await findByText('Item')).toBeInTheDocument()
	})

})