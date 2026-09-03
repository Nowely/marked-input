import {describe, expect, it, vi} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {editingHost, getElement} from '../../shared/lib/dom'
import {focusAtEnd, focusAtOffset, moveDomCaret, verifyCaretPosition} from '../../shared/lib/focus'
import {dispatchInsertText} from '../../shared/lib/inputEvents'
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

		// SIX characters, not two. At two the defect this length catches is invisible: coalescing
		// merged in PAIRS — the merged window carries `insertedLength: 2`, which the keystroke test
		// then refused — so an eleven-character run came off in six presses, one then two at a time.
		// The module's own contract is "consecutive characters typed forward inside this window are
		// ONE entry".
		await userEvent.keyboard('XYZABC')
		expect(onChange).toHaveBeenLastCalledWith('Undo meXYZABC')

		// One entry for the run, so one press takes every character of it.
		await undo()
		expect(onChange).toHaveBeenLastCalledWith(VALUE)

		await redo()
		expect(onChange).toHaveBeenLastCalledWith('Undo meXYZABC')
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

	/**
	 * An undo restores the CARET the edit was made from, and only a browser can say whether it
	 * does: core's own `HistoryModel` spec asserts the restored offsets against core's selection
	 * state, which is the very reading these two show can be a task out of date.
	 *
	 * `moveDomCaret` leaves the editor un-told on purpose — see its own note. The edit that
	 * follows is committed against the DOM's caret, so that is the caret the entry names and the
	 * one the undo has to put back.
	 */
	it('restores the caret the undone edit was made from', async () => {
		const onChange = vi.fn()
		const {host} = await mount(Default, {defaultValue: VALUE, onChange})
		await focusAtOffset(getElement(page.getByText(VALUE)), 0)

		moveDomCaret(getElement(page.getByText(VALUE)), 4)
		dispatchInsertText(editingHost(host), 'X')
		await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('UndoX me')

		await undo()
		await expect.poll(() => onChange.mock.lastCall?.[0]).toBe(VALUE)
		verifyCaretPosition(host, 4)
	})

	it('restores it through the parent too, in a CONTROLLED editor', async () => {
		const {host, value} = await mountEcho(Default, {value: VALUE})
		await focusAtOffset(getElement(page.getByText(VALUE)), 0)

		moveDomCaret(getElement(page.getByText(VALUE)), 4)
		dispatchInsertText(editingHost(host), 'X')
		await expect.poll(value).toBe('UndoX me')

		await undo()
		await expect.poll(value).toBe(VALUE)
		verifyCaretPosition(host, 4)
	})

	/**
	 * REAL KEYS ALONE, with nothing writing a DOM caret behind the editor's back. Chromium moves
	 * the caret three times and delivers the character before `selectionchange` for the arrows has
	 * landed, so the gap the two cases above manufacture is one a user opens by typing. The report
	 * that filed this phase said real keys could not reproduce it; measured, they do.
	 *
	 * Only the RESTORED caret is asserted. The broken reading is a race — measured at 6 and at 7
	 * on the same machine — so pinning it would pin the flake; 4 is the position the edit was made
	 * from and it is the same in every run.
	 */
	it('restores it after a run of real arrow keys, with no caret written by hand', async () => {
		const onChange = vi.fn()
		const {host} = await mount(Default, {defaultValue: VALUE, onChange})
		await focusAtEnd(getElement(page.getByText(VALUE)))

		await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}X')
		await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('UndoX me')

		await undo()
		await expect.poll(() => onChange.mock.lastCall?.[0]).toBe(VALUE)
		verifyCaretPosition(host, 4)
	})

	/**
	 * A ROW VERB, not an inline edit — Enter splits the row, and the split is addressed from the
	 * DOM's caret while the record used to name the mirror's. It is the same defect as the two
	 * cases above wearing a different verb, and it stayed open when the sync sat on
	 * `EditController.replace`: the row verbs reach the commit without passing through it.
	 */
	it('restores the caret an ENTER was pressed at', async () => {
		const {host, value} = await mountEcho(Default, {value: VALUE, separator: '\n'})
		await focusAtOffset(getElement(page.getByText(VALUE)), 0)

		moveDomCaret(getElement(page.getByText(VALUE)), 4)
		editingHost(host).dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}))
		await expect.poll(value).toBe('Undo\n me')

		await undo()
		await expect.poll(value).toBe(VALUE)
		verifyCaretPosition(host, 4)
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