import {describe, expect, it} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {childrenOf, textSurfaces} from '../../shared/lib/dom'
import {focusAtEnd} from '../../shared/lib/focus'
import {composePage, mount} from '../../shared/lib/page'
import * as ApiStories from './Api.stories'

const {Default, Block} = composePage(ApiStories)

const read = () => page.getByLabelText('value').element().textContent

const press = (name: string) => userEvent.click(page.getByRole('button', {name}))

describe('US-5: the editor API drives every scenario through node anchors', () => {
	it('edits a mark meta in place', async () => {
		await mount(Default)
		await press('edit meta')
		expect(read()).toBe('hello @[world](edited) foo')
	})

	it('clears a mark meta with a null patch', async () => {
		// `null` is the clear (plan decision D-b): an omitted key would leave 'u1' alone.
		await mount(Default)
		await press('clear meta')
		expect(read()).toBe('hello @[world]() foo')
	})

	it('removes a mark', async () => {
		await mount(Default)
		await press('remove mark')
		expect(read()).toBe('hello  foo')
	})

	it('replaces a span inside one text node', async () => {
		await mount(Default)
		await press('replace span')
		expect(read()).toBe('Howdy @[world](u1) foo')
	})

	it('replaces a range that spans a mark', async () => {
		await mount(Default)
		await press('replace across')
		expect(read()).toBe('hello nobody foo')
	})

	it("sets the whole value and clears it with setValue('')", async () => {
		await mount(Default)
		await press('set value')
		expect(read()).toBe('reset @[all](u9)')
		await press('clear value')
		expect(read()).toBe('')
	})

	it("inserts a mark at 'caret' from a toolbar button", async () => {
		const {host} = await mount(Default)
		// The FIRST text token, not the host: `[contenteditable]` answers the container now,
		// and its end is the end of the document, which is a different insertion point.
		const [head] = textSurfaces(host)
		await focusAtEnd(head)
		await press('insert at caret')
		expect(read()).toBe('hello @[carol](u3)@[world](u1) foo')
	})

	it('inserts a mark between block rows', async () => {
		const {host} = await mount(Block)
		expect(childrenOf(host)).toHaveLength(2)
		await press('insert between rows')
		// BETWEEN the two rows, not appended: `{after: rows[0]}` is the only addressing form
		// for a between-row position, because block mode filters the empty text tokens that
		// would otherwise sit there (spec §2.3's NodeAnchor paragraph).
		expect(read()).toBe('@[a](x)@[row](r)@[b](y)')
	})
})