import type {RefCallback} from 'react'
import {beforeEach, describe, expect, it} from 'vitest'

import {editingHost, rowsOf} from '../../shared/lib/dom'
import {focusAtStart, settle} from '../../shared/lib/focus'
import {composePage, mountEcho} from '../../shared/lib/page'
import {NOTION_THEME, theme} from './notion'
import * as NotionStories from './Notion.stories'

/**
 * A STRUCTURAL EDIT MUST NOT REPAINT THE ROWS AFTER IT — ADR-0013's first half, counted rather
 * than timed. A millisecond budget says nothing on a loaded machine; the count is the mechanism.
 *
 * REACT-ONLY, and deliberately: the mechanism is React's `memo`. Vue paints off its own reactivity
 * and never carried this shape; its own cost at document scale is issue 47.
 *
 * ADR-0013's SECOND half — that a repaint must not rebind the row's element — is NOT pinned here,
 * and that is recorded rather than papered over: once no position is handed down, no gesture in
 * reach of this harness repaints enough rows for a churning `ref` to show up at all, and a test
 * that stays green either way is not a pin. Pinning it needs a gesture that repaints MANY rows at
 * once — a select-all across rows is the candidate — and the harness has no helper for one.
 *
 * The counter rides PUBLISHED surface: `slots.paragraph` is the component every row in the document
 * below paints through, so one call of it is one repainted row.
 *
 * WHAT THIS DOES NOT COVER, said here so nobody reads it as more than it is: the `bottom` case
 * cannot redden (an Enter two rows from the end repaints two rows whatever the code does) and is a
 * CONTROL rather than a pin; the document is 400 rows against the 4000 the defect was measured at,
 * which is enough to catch anything proportional and no more; and `mountEcho` merges its args over
 * the story's, so the showcase's own `container` slot is not exercised here.
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

const mount = async (where: 'top' | 'bottom') => {
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
	return {host, before: rows.length}
}

describe('a structural edit at scale', () => {
	for (const where of ['top', 'bottom'] as const) {
		it(`repaints a handful of rows for Enter at the ${where}`, async () => {
			const {host, before} = await mount(where)

			paints = 0
			editingHost(host).dispatchEvent(
				new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})
			)
			await frame()

			// THE EDIT HAS TO HAVE HAPPENED, or a swallowed Enter passes the count below with zero.
			expect(rowsOf(host).length).toBe(before + 1)
			// The row that split and the row it grew, with room for the settle pass to touch a
			// neighbour. Anything proportional to the document is the regression; measured at 1, and
			// at SIZE + 1 when a sibling position is handed down again.
			expect(paints).toBeLessThanOrEqual(3)
		}, 120000)
	}
})