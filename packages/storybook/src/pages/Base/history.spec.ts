import {describe, expect, it, vi} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {getElement} from '../../shared/lib/dom'
import {focusAtEnd} from '../../shared/lib/focus'
import {composePage, mount, mountEcho} from '../../shared/lib/page'
import * as BaseStories from './Base.stories'

const {Default} = composePage(BaseStories)

/** No mark and nothing repeated, so `getByText` names exactly one surface to type into. */
const VALUE = 'Undo me'

const undo = () => userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}')
const redo = () => userEvent.keyboard('{Shift>}{ControlOrMeta>}z{/ControlOrMeta}{/Shift}')

/**
 * The keys, driven for real, in BOTH adapters — the core suite drives the same arms through
 * synthesised events, and what this adds is the wiring: the prop reaching the model, and the
 * container's own listener answering a key Chromium delivered.
 */
describe('API: history', () => {
	it('undoes a typed run on Mod+Z and redoes it on Shift+Mod+Z', async () => {
		const onChange = vi.fn()
		await mount(Default, {defaultValue: VALUE, onChange})
		await focusAtEnd(getElement(page.getByText(VALUE)))

		await userEvent.keyboard('XY')
		expect(onChange).toHaveBeenLastCalledWith('Undo meXY')

		// One entry for the run, so one press takes both characters.
		await undo()
		expect(onChange).toHaveBeenLastCalledWith(VALUE)

		await redo()
		expect(onChange).toHaveBeenLastCalledWith('Undo meXY')
	})

	it('undoes through the parent, in a CONTROLLED editor', async () => {
		const {host, value} = await mountEcho(Default, {value: VALUE})
		await focusAtEnd(getElement(page.getByText(VALUE)))

		await userEvent.keyboard('X')
		expect(value()).toBe('Undo meX')

		await undo()
		expect(value()).toBe(VALUE)
		expect(host.textContent).toBe(VALUE)
	})

	it('leaves the keys inert with `history` off', async () => {
		const onChange = vi.fn()
		await mount(Default, {defaultValue: VALUE, history: false, onChange})
		await focusAtEnd(getElement(page.getByText(VALUE)))

		await userEvent.keyboard('X')
		expect(onChange).toHaveBeenLastCalledWith('Undo meX')

		await undo()
		expect(onChange).toHaveBeenLastCalledWith('Undo meX')
	})
})