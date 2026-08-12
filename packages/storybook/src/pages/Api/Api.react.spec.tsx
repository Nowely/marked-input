import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {textSurfaces} from '../../shared/lib/dom'
import {focusAtEnd} from '../../shared/lib/focus'
import * as Stories from './Api.react.stories'

const {Default, Block} = composeStories(Stories)

const read = () => page.getByTestId('value').element().textContent

describe('US-5: the editor API drives every scenario through node anchors', () => {
	it('edits a mark meta in place', async () => {
		await render(<Default />)
		await userEvent.click(page.getByTestId('edit-meta'))
		expect(read()).toBe('hello @[world](edited) foo')
	})

	it('clears a mark meta with a null patch', async () => {
		// `null` is the clear (plan decision D-b): an omitted key would leave 'u1' alone.
		await render(<Default />)
		await userEvent.click(page.getByTestId('clear-meta'))
		expect(read()).toBe('hello @[world]() foo')
	})

	it('removes a mark', async () => {
		await render(<Default />)
		await userEvent.click(page.getByTestId('remove-mark'))
		expect(read()).toBe('hello  foo')
	})

	it('replaces a span inside one text node', async () => {
		await render(<Default />)
		await userEvent.click(page.getByTestId('replace-span'))
		expect(read()).toBe('Howdy @[world](u1) foo')
	})

	it('replaces a range that spans a mark', async () => {
		await render(<Default />)
		await userEvent.click(page.getByTestId('replace-across'))
		expect(read()).toBe('hello nobody foo')
	})

	it("sets the whole value and clears it with setValue('')", async () => {
		await render(<Default />)
		await userEvent.click(page.getByTestId('set-value'))
		expect(read()).toBe('reset @[all](u9)')
		await userEvent.click(page.getByTestId('clear-value'))
		expect(read()).toBe('')
	})

	it("inserts a mark at 'caret' from a toolbar button", async () => {
		await render(<Default />)
		// The FIRST text token, not the host: `[contenteditable]` answers the container now,
		// and its end is the end of the document, which is a different insertion point.
		const [head] = textSurfaces(document.querySelector<HTMLElement>('[contenteditable="true"]')!)
		await focusAtEnd(head)
		await userEvent.click(page.getByTestId('insert-at-caret'))
		expect(read()).toBe('hello @[carol](u3)@[world](u1) foo')
	})

	it('inserts a mark between block rows', async () => {
		await render(<Block />)
		expect(page.getByTestId('block').elements()).toHaveLength(2)
		await userEvent.click(page.getByTestId('insert-between-rows'))
		// BETWEEN the two rows, not appended: `{after: rows[0]}` is the only addressing form
		// for a between-row position, because block mode filters the empty text tokens that
		// would otherwise sit there (spec §2.3's NodeAnchor paragraph).
		expect(read()).toBe('@[a](x)@[row](r)@[b](y)')
	})
})