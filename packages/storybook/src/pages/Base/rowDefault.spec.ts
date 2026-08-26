import {describe, expect, it} from 'vitest'

import {ROW_CONTROLS, rowsOf} from '../../shared/lib/dom'
import {defineMark, Mark} from '../../shared/lib/marks'
import {mountComponent} from '../../shared/lib/page'

/**
 * THE default, and the one prop that decides it (ADR-0011). An editor that configures nothing is
 * a ROW editor whose rows are lines; `separator: null` is how a consumer asks for the plain
 * annotated field that used to be `layout="inline"`.
 *
 * Framework-free, because the default is core's and both adapters must show it identically.
 *
 * Every mount below passes `separator` only where it is the subject: the whole point is that the
 * absent prop is what is under test, so a fixture that spelled it out would pin nothing.
 */

const BULLET = '- __slot__'
const Bullet = defineMark({tag: 'li', class: 'bullet'})

describe('the default separator', () => {
	it('splits an unconfigured editor at every newline', async () => {
		const {host} = await mountComponent({value: 'alpha\nbeta\ngamma', Mark})

		expect(rowsOf(host).map(row => row.textContent)).toEqual(['alpha', 'beta', 'gamma'])
	})

	/**
	 * Issue 05, and the gesture it was blocking. Under `'\n\n'` a tight list is ONE row: it drags,
	 * reorders and menus as a whole, so "move this item up" has no expression — and a `'- __slot__'`
	 * KIND made that worse, swallowing every item into one bullet whose body was their flat text.
	 * A line is a row, so each item is a row with its own kind, its own grip and its own menu.
	 */
	it('makes each item of a tight list its own row', async () => {
		const {host} = await mountComponent({
			value: '- alpha\n- beta\n- gamma',
			Mark,
			options: [{markup: BULLET, row: {Component: Bullet}}],
		})

		const rows = rowsOf(host)
		expect(rows.map(row => row.tagName)).toEqual(['LI', 'LI', 'LI'])
		expect(rows.map(row => row.textContent)).toEqual(['alpha', 'beta', 'gamma'])
	})

	it('leaves a null separator unsplit, with no row controls', async () => {
		const {host} = await mountComponent({value: 'alpha\nbeta\ngamma', separator: null, Mark})

		expect(host.textContent).toBe('alpha\nbeta\ngamma')
		expect(host.querySelector(ROW_CONTROLS)).toBeNull()
	})

	/**
	 * The bullets are the SAME markup as the row-kind case above, and here they are read as inline
	 * marks in one undivided document — which is what `null` means: no row starts, so no row kind
	 * is ever matched.
	 */
	it('matches no row kind at all under a null separator', async () => {
		const {host} = await mountComponent({
			value: '- alpha\n- beta\n- gamma',
			separator: null,
			Mark,
			options: [{markup: BULLET, row: {Component: Bullet}}],
		})

		expect(host.querySelector('li')).toBeNull()
		expect(host.textContent).toBe('- alpha\n- beta\n- gamma')
	})
})