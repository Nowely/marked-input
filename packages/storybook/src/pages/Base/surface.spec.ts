import {describe, expect, it} from 'vitest'
import {page} from 'vitest/browser'

import {getElement} from '../../shared/lib/dom'
import {focusAtOffset, verifyCaretPosition} from '../../shared/lib/focus'
import {Mark} from '../../shared/lib/marks'
import {mountComponent} from '../../shared/lib/page'

/**
 * The Surface writer's contract, held against both adapters from one file.
 *
 * WHAT THIS PINS, and what it deliberately does not. The writer splices a Surface in place
 * (`Text.replaceData`) instead of assigning `textContent`, so the `Text` node — and every DOM
 * Range anchored in it — survives an edit. Core pins the survival itself
 * (`dom/domBoundary.spec.ts`). What only a real adapter can answer is whether the framework
 * leaves that node alone across the same commit: React and Vue each own the `<span>`, and either
 * one re-creating it on a text commit would defeat the writer entirely.
 *
 * The edit arrives as a NEW CONTROLLED VALUE rather than through an imperative verb: the handle
 * stopped exposing writes, and a props arrival is the path a parent actually drives. It reaches
 * the same commit, and the caret cases below are only expressible this way — typing would have
 * to move the caret to the edit site, which is the opposite of what they measure.
 *
 * The caret gates below pass BEFORE the in-place writer too, and that is stated rather than
 * hidden: `SelectionDriver` re-places the caret after every commit, so it repairs whatever the
 * old replace-all destroyed. They are regression guards for the write, not the gate that
 * justified it — there is no red-turns-green caret test to write here, and the reason why is
 * written out at `core/features/tokens/dom/TokenHandle.ts`'s `writeSurface`.
 */

const VALUE = 'Hello @[mark](1)!'
/** Same length before the caret: 'H' -> 'J'. */
const SAME_LENGTH = 'Jello @[mark](1)!'
/** Longer before the caret: 'H' -> 'Howd'. */
const LONGER = 'Howdello @[mark](1)!'

const ARGS = {Mark, value: VALUE}

/**
 * `focusAtOffset` writes the DOM selection directly, and `selectionchange` reaches the model on
 * a TASK — so without this the model still holds the click position and the post-commit re-place
 * applies THAT. Measured: the model read offset 2 while the DOM caret sat at 5.
 */
async function settleSelection(): Promise<void> {
	await new Promise(resolve => {
		setTimeout(resolve, 0)
	})
}

describe('Surface writer: an edit splices the surface in place', () => {
	it('keeps the surface element and its text node across a text edit, in both adapters', async () => {
		const {rerender} = await mountComponent(ARGS)
		const surface = getElement(page.getByText('Hello'))
		const textNode = surface.firstChild
		expect(textNode).toBeInstanceOf(Text)

		await rerender({...ARGS, value: SAME_LENGTH})

		await expect.element(page.getByText('Jello')).toBeInTheDocument()

		// The framework did not re-create either one, and the node carries the new text.
		expect(surface.isConnected).toBe(true)
		expect(surface.firstChild).toBe(textNode)
		expect(textNode instanceof Text ? textNode.data : null).toBe('Jello ')
		expect(surface.childNodes.length).toBe(1)
	})

	it('keeps the caret when a same-length edit lands earlier in the same surface', async () => {
		const {rerender} = await mountComponent(ARGS)
		const surface = getElement(page.getByText('Hello'))

		// Offset 5 — inside 'Hello ', after the last letter and clear of the edit below.
		await focusAtOffset(surface, 5)
		await settleSelection()

		await rerender({...ARGS, value: SAME_LENGTH})

		await expect.element(page.getByText('Jello')).toBeInTheDocument()
		verifyCaretPosition(getElement(page.getByText('Jello')), 5)
	})

	it('moves the caret with the text when a longer edit lands earlier in the same surface', async () => {
		const {rerender} = await mountComponent(ARGS)
		const surface = getElement(page.getByText('Hello'))

		await focusAtOffset(surface, 5)
		await settleSelection()

		await rerender({...ARGS, value: LONGER})

		await expect.element(page.getByText('Howdello')).toBeInTheDocument()
		verifyCaretPosition(getElement(page.getByText('Howdello')), 8)
	})
})