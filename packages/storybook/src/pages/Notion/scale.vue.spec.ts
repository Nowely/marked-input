import {beforeEach, describe, expect, it} from 'vitest'
import {defineComponent, h} from 'vue'

import {editingHost, rowsOf} from '../../shared/lib/dom'
import {focusAtStart, settle} from '../../shared/lib/focus'
import {composePage, mountEcho} from '../../shared/lib/page'
import {NOTION_THEME, theme} from './notion'
import * as NotionStories from './Notion.stories'

/**
 * AN EDIT IN ONE ROW MUST NOT REPAINT THE OTHERS — the Vue twin of `scale.react.spec.tsx`, and a
 * different defect from the one that spec pins. React's was the tail AFTER the caret; Vue repainted
 * the WHOLE document wherever the caret was, because `slots.node` is one computed every row
 * subscribes to and the adapter rebuilt its inputs on every props sync (issue 47).
 *
 * Counted, not timed, for the same reason as the React twin: a millisecond budget says nothing on a
 * loaded machine. The counter rides `slots.paragraph`, published surface — every row in the
 * document below is a plain paragraph, so one render of it is one repainted row.
 */
const {Showcase} = composePage(NotionStories)

let paints = 0

const CountingParagraph = defineComponent({
	name: 'CountingParagraph',
	setup(_props, {slots}) {
		return () => {
			paints += 1
			return h('div', slots.default?.())
		}
	},
})

beforeEach(() => {
	document.body.classList.add(NOTION_THEME, theme.page)
	paints = 0
	return () => document.body.classList.remove(NOTION_THEME, theme.page)
})

const SIZE = 400

const plainDoc = (rows: number) => Array.from({length: rows}, (_, i) => `row ${i} some plain prose here`).join('\n')

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

describe('an edit at scale', () => {
	for (const where of ['top', 'bottom'] as const) {
		it(`repaints a handful of rows for Enter at the ${where}`, async () => {
			const {host} = await mountEcho(Showcase, {
				value: plainDoc(SIZE),
				draggable: false,
				slots: {paragraph: CountingParagraph},
			})
			const rows = rowsOf(host)
			expect(rows.length).toBeGreaterThan(SIZE - 5)
			await focusAtStart(where === 'top' ? rows[0] : rows[rows.length - 2])
			await settle()
			await frame()

			const before = rowsOf(host).length
			paints = 0
			editingHost(host).dispatchEvent(
				new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})
			)
			await frame()

			// THE EDIT HAS TO HAVE HAPPENED, or a swallowed Enter passes the count below with zero.
			expect(rowsOf(host).length).toBe(before + 1)
			// Measured at 1; at SIZE + 7 when the adapter rebuilds `slots.node`'s inputs per sync.
			expect(paints).toBeLessThanOrEqual(3)
		}, 120000)
	}
})