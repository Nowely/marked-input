import {describe, expect, it, vi} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {rowsOf} from '../../shared/lib/dom'
import {focusAtStart} from '../../shared/lib/focus'
import {Mark} from '../../shared/lib/marks'
import {mountComponent} from '../../shared/lib/page'
import {rows} from './Base.fixtures'

/**
 * BLOCK SELECTION AND NESTED DRAG, driven through the DOM in both adapters. Framework-free on
 * purpose: the two `Rows` implementations paint the same tree through the same core resolver and
 * the same `RowController` decides every drop, so a divergence between them is a failing test
 * here rather than a difference nobody diffs.
 *
 * TWO CLAIMS PER DROP, and neither implies the other. The emitted VALUE says the rows landed at
 * the depth the pointer asked for — indentation is the whole of what a nested drop writes. The
 * `data-id` of each moved row says the move addressed the rows it named: a row's id is minted at
 * node birth and never reused, so an id that came through is a node that came through, and a mover
 * that emits the right bytes while re-minting the nodes takes the caret and every consumer
 * subscription keyed on `node.id` with it — which no string assertion sees.
 *
 * The ELEMENT is deliberately NOT the oracle here, and that is a finding rather than a shortcut:
 * neither framework can move a DOM element between two parents, so a row that changes parent is
 * rebuilt in both. See the collapse case at the bottom for what that costs.
 */
const BLOCK = {separator: '\n', indent: '\t', Mark, draggable: true} as const

// `as const` on the markup: `Option.markup` is the template-literal `Markup`, which a widened
// `string` does not satisfy.
const ITEM = {markup: '- __slot__', row: {Component: rows.Bullet, indents: true}} as const
const TOGGLE = {markup: '> __slot__', row: {Component: rows.Toggle, indents: true}} as const

const DOCUMENT = '- alpha\n- beta\n> toggle\n\t- kid'

const GRIP = {name: 'Drag to reorder or click for options'} as const

/** The ONE grip: it lives in the editor's controls layer, and hovering a row is what puts it there. */
async function gripOfRow(host: HTMLElement, row: HTMLElement) {
	await userEvent.hover(row)
	return page.elementLocator(host).getByRole('button', GRIP).findElement()
}

/**
 * A whole drag, start to finish, at an exact POINT — both coordinates, because the pointer's Y
 * names the gap and its X names the depth inside it.
 */
async function dragTo(host: HTMLElement, from: HTMLElement, clientX: number, clientY: number) {
	const grip = await gripOfRow(host, from)
	const dataTransfer = new DataTransfer()
	grip.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer}))
	const at = {bubbles: true, cancelable: true, dataTransfer, clientX, clientY}
	host.dispatchEvent(new DragEvent('dragover', at))
	host.dispatchEvent(new DragEvent('drop', at))
	grip.dispatchEvent(new DragEvent('dragend', {bubbles: true, cancelable: true}))
}

/**
 * Every row element in the document, at every depth, in document order. `[data-id]` and not the
 * `Block` class: a row KIND paints its own element, so the class core would have merged in is
 * whatever the fixture chose to spread — here, nothing.
 */
const everyRow = (host: HTMLElement): HTMLElement[] => Array.from(host.querySelectorAll<HTMLElement>('[data-id]'))

function rowWith(host: HTMLElement, text: string): HTMLElement {
	const found = everyRow(host).find(row => row.textContent.trim().startsWith(text))
	if (!found) throw new Error(`no row reading ${JSON.stringify(text)}`)
	return found
}

const idOf = (row: HTMLElement): string => row.dataset.id ?? 'unidentified'

/** Esc escalates the caret into a row selection; Shift+Down grows it by one row. */
async function selectRows(host: HTMLElement, first: HTMLElement, more: number) {
	await focusAtStart(first)
	await userEvent.keyboard('{Escape}')
	for (let step = 0; step < more; step++) await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
}

describe('block selection and nested drag', () => {
	/**
	 * THE PHASE'S PIN: two rows selected with Shift, dropped INTO a toggle at a chosen depth, with
	 * the depth coming from the pointer's horizontal position alone.
	 */
	it('drops a Shift-selected pair into a toggle at the depth the pointer chooses', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mountComponent({defaultValue: DOCUMENT, ...BLOCK, options: [ITEM, TOGGLE], onChange})

		const alpha = rowWith(host, 'alpha')
		const ids = [idOf(alpha), idOf(rowWith(host, 'beta'))]
		await selectRows(host, alpha, 1)

		// The gap after `kid`, which offers depth 0 (a root after the toggle), depth 1 (the
		// toggle's second child) and depth 2 (the kid's own first child).
		const box = rowWith(host, 'kid').getBoundingClientRect()
		await dragTo(host, alpha, box.left, box.bottom - 1)

		await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('> toggle\n\t- kid\n\t- alpha\n\t- beta')
		// The pair landed INSIDE the toggle's own element, which is where its `rows` prop paints,
		// and both rows are the nodes that were picked up. Polled, because Vue patches the DOM on
		// its own tick while React has already committed when `onChange` returns.
		await expect.poll(() => rowsOf(host)).toHaveLength(1)
		expect([idOf(rowWith(host, 'alpha')), idOf(rowWith(host, 'beta'))]).toEqual(ids)
	})

	it('lands the same pair at the ROOT when the pointer stays left of the indent', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mountComponent({defaultValue: DOCUMENT, ...BLOCK, options: [ITEM, TOGGLE], onChange})

		const alpha = rowWith(host, 'alpha')
		const ids = [idOf(alpha), idOf(rowWith(host, 'beta'))]
		await selectRows(host, alpha, 1)

		// The SAME gap and the SAME Y — only the X differs, and it is left of every indent.
		const box = rowWith(host, 'kid').getBoundingClientRect()
		await dragTo(host, alpha, 0, box.bottom - 1)

		await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('> toggle\n\t- kid\n- alpha\n- beta')
		await expect.poll(() => rowsOf(host)).toHaveLength(3)
		expect([idOf(rowWith(host, 'alpha')), idOf(rowWith(host, 'beta'))]).toEqual(ids)
	})

	/**
	 * THE DEFERRED EXPERIMENT this phase owes, and it comes back with a NEGATIVE answer that is
	 * worth more than the assertion it was meant to make.
	 *
	 * The toggle's collapse flag is component-local state — a `useState` in React, `data` in Vue —
	 * keyed to nothing but the component instance. The row's NODE survives the move (its `data-id`
	 * is unchanged, which is what core promises). The component does not: a row that changes parent
	 * moves between two different framework parents, and neither React nor Vue can carry a DOM
	 * element or a component instance across that boundary, so the state resets.
	 *
	 * That is the measurement the spec said would buy `store.rows.collapsed` — a core-owned,
	 * node-keyed store of per-row view state — and it is now made rather than argued. It is not
	 * built here: this phase's mandate is selection and drag, and a keyed signal registry is its
	 * own change with its own pruning clock.
	 *
	 * It is ALSO the collapse hazard end to end: the toggle's child is `hidden`, so it sits in the
	 * tree with no box at all, and the drop has to land beside it without hit-testing it.
	 */
	it('drops a COLLAPSED toggle into another row, keeping its node and losing its component state', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mountComponent({
			defaultValue: '> outer\n\t- child\n> inner\n\t- kid',
			...BLOCK,
			options: [ITEM, TOGGLE],
			onChange,
		})

		const toggle = rowWith(host, 'inner')
		const open = toggle.querySelector<HTMLInputElement>('input[type="checkbox"]')
		if (!open) throw new Error('the toggle painted no control')
		const id = idOf(toggle)

		open.click()
		await expect.poll(() => open.checked).toBe(false)
		// COLLAPSED: the child is in the tree and has no box, which is what the hit test must not
		// try to order itself by.
		expect(rowWith(host, 'kid').getClientRects()).toHaveLength(0)

		await selectRows(host, toggle, 0)

		// `child`'s own line, lower half: the gap after it, at the outer toggle's child depth.
		const box = rowWith(host, 'child').getBoundingClientRect()
		await dragTo(host, toggle, box.left, box.bottom - 1)

		await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('> outer\n\t- child\n\t> inner\n\t\t- kid')
		// THE NODE came through — same id, one level deeper, under a new parent.
		expect(idOf(rowWith(host, 'inner'))).toBe(id)
		// THE COMPONENT did not: re-parented, so re-mounted, so back to its initial state.
		expect(rowWith(host, 'inner').querySelector<HTMLInputElement>('input')?.checked).toBe(true)
	})
})