import type {RefCallback} from 'react'
import {beforeEach, describe, expect, it} from 'vitest'

import {editingHost, rowsOf} from '../../shared/lib/dom'
import {focusAtStart, settle} from '../../shared/lib/focus'
import {composePage, mountEcho} from '../../shared/lib/page'
import {NOTION_THEME, theme} from './notion'
import * as NotionStories from './Notion.stories'

/**
 * A STRUCTURAL EDIT MUST NOT REPAINT THE ROWS AFTER IT, and this counts the repaints rather than
 * timing them: a budget in milliseconds says nothing on a loaded machine, while the count is the
 * mechanism itself.
 *
 * The defect this pins cost 4000 row repaints on one Enter at the top of a 4000-row document —
 * about half of the whole 250 ms, measured — because `Rows` handed each row its position among its
 * siblings and `Row` is memoised on what it is given. Inserting one row shifts that position for
 * every later sibling, so the memo missed on all of them while their content was unchanged.
 * ADR-0013 has the numbers and the trade.
 *
 * REACT-ONLY, and deliberately: the memo is React's. Vue re-renders off its own reactivity and
 * never carried this shape — its own cost at document scale is issue 47.
 *
 * The counter rides `slots.paragraph`, which is published API: every row in the document below is
 * a plain paragraph, so one render of that component is one repainted row.
 */
const {Showcase} = composePage(NotionStories)

let paints = 0

const CountingParagraph = ({
	ref,
	children,
	...rest
}: {ref?: RefCallback<HTMLElement>; children?: React.ReactNode} & Record<string, unknown>) => {
	paints += 1
	return (
		<div ref={ref} {...rest}>
			{children}
		</div>
	)
}

beforeEach(() => {
	document.body.classList.add(NOTION_THEME, theme.page)
	paints = 0
	return () => document.body.classList.remove(NOTION_THEME, theme.page)
})

const SIZE = 400

const plainDoc = (rows: number) => Array.from({length: rows}, (_, i) => `row ${i} some plain prose here`).join('\n')

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

describe('a structural edit at scale', () => {
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

			paints = 0
			editingHost(host).dispatchEvent(
				new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})
			)
			await frame()

			// The row that split, the row it grew, and room for the editor's own settle to touch a
			// neighbour. Anything proportional to the document is the regression.
			expect(paints).toBeLessThan(10)
		}, 120000)
	}
})