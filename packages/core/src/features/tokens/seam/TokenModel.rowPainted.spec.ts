import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import type {CoreOption} from '../../../shared/types'
import {Store} from '../../../store/Store'
import type {RowNode} from '../tree/types'

/** The `reportBadProp` channel, silenced and collected for the duration of one test. */
function captureErrors(): () => string[] {
	const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
	return () => spy.mock.calls.map(call => String(call[0]))
}

const heading: CoreOption = {markup: '# __slot__', row: {Component: 'div'}}

/**
 * The one prop a row kind's component can drop with nothing on screen to say so. `RowProps.ref` is
 * optional, so forgetting to spread it type-checks; the row then binds to nothing and the caret
 * cannot resolve into it.
 *
 * Both adapters call this from the hook that runs after refs attach, which is the only place the
 * question is answerable at all — `bind` runs on the commit, a frame before the paint.
 */
describe('TokenModel.rowPainted', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
		store.props.set({separator: '\n', options: [heading], defaultValue: '# Title\nplain'})
		store.host.container(document.createElement('div'))
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	function rowAt(index: number): RowNode {
		const node = store.tokens.nodes()[index]
		if (node.kind !== 'row') throw new Error(`no row at ${index}`)
		return node
	}

	it('says nothing about a row whose component spread the ref', () => {
		const errors = captureErrors()
		store.tokens.consign(rowAt(0).id)(document.createElement('div'))

		store.tokens.rowPainted(rowAt(0))

		expect(errors()).toEqual([])
	})

	it('names the kind whose component painted no element the editor could bind', () => {
		const errors = captureErrors()

		store.tokens.rowPainted(rowAt(0))

		expect(errors()).toHaveLength(1)
		expect(errors()[0]).toContain('The row kind "# __slot__"')
		expect(errors()[0]).toContain('spread `ref`')
	})

	/** A row with no kind paints through `slots.paragraph`, so that is the component to name. */
	it('names slots.paragraph for a row with no kind', () => {
		const errors = captureErrors()

		store.tokens.rowPainted(rowAt(1))

		expect(errors()[0]).toContain('The `slots.paragraph` component')
	})

	/** Nothing accumulates: the check reads the registry, so a late ref makes the next row quiet. */
	it('goes quiet once the element arrives', () => {
		const errors = captureErrors()
		store.tokens.rowPainted(rowAt(1))
		store.tokens.consign(rowAt(1).id)(document.createElement('div'))

		store.tokens.rowPainted(rowAt(1))

		expect(errors()).toHaveLength(1)
	})
})