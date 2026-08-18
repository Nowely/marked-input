import type {MarkputApi, TextNode} from '@markput/core'
import {describe, expect, it} from 'vitest'
import {page} from 'vitest/browser'

import {getElement} from '../../shared/lib/dom'
import {focusAtOffset, verifyCaretPosition} from '../../shared/lib/focus'
import {Mark} from '../../shared/lib/marks'
import {mountApi} from '../../shared/lib/page'

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
 * The caret gates below pass BEFORE the in-place writer too, and that is stated rather than
 * hidden: `SelectionDriver` re-places the caret after every commit, so it repairs whatever the
 * old replace-all destroyed. They are regression guards for the write, not the gate that
 * justified it — there is no red-turns-green caret test to write here, and the reason why is
 * written out at `core/features/tokens/dom/TokenHandle.ts`'s `writeSurface`.
 */

const VALUE = 'Hello @[mark](1)!'

/** The document's first text token — 'Hello ' in {@link VALUE}. */
function firstTextToken(api: MarkputApi): TextNode {
	const token = api.nodes().find(node => node.kind === 'text')
	if (!token) throw new Error('expected a text token')
	return token
}

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
		const {api} = await mountApi({Mark, defaultValue: VALUE})
		const surface = getElement(page.getByText('Hello'))
		const textNode = surface.firstChild
		expect(textNode).toBeInstanceOf(Text)

		const live = api()
		expect(live).not.toBeNull()
		if (!live) return
		expect(live.replaceText({node: firstTextToken(live), start: 0, end: 1}, 'J')).toBe(true)

		await expect.element(page.getByText('Jello')).toBeInTheDocument()

		// The framework did not re-create either one, and the node carries the new text.
		expect(surface.isConnected).toBe(true)
		expect(surface.firstChild).toBe(textNode)
		expect(textNode instanceof Text ? textNode.data : null).toBe('Jello ')
		expect(surface.childNodes.length).toBe(1)
	})

	it('keeps the caret when a same-length edit lands earlier in the same surface', async () => {
		const {api} = await mountApi({Mark, defaultValue: VALUE})
		const surface = getElement(page.getByText('Hello'))

		// Offset 5 — inside 'Hello ', after the last letter and clear of the edit below.
		await focusAtOffset(surface, 5)
		await settleSelection()

		const live = api()
		expect(live).not.toBeNull()
		if (!live) return
		// 'H' -> 'J': same length, entirely before the caret.
		expect(live.replaceText({node: firstTextToken(live), start: 0, end: 1}, 'J')).toBe(true)

		await expect.element(page.getByText('Jello')).toBeInTheDocument()
		verifyCaretPosition(getElement(page.getByText('Jello')), 5)
	})

	it('moves the caret with the text when a longer edit lands earlier in the same surface', async () => {
		const {api} = await mountApi({Mark, defaultValue: VALUE})
		const surface = getElement(page.getByText('Hello'))

		await focusAtOffset(surface, 5)
		await settleSelection()

		const live = api()
		expect(live).not.toBeNull()
		if (!live) return
		// 'H' -> 'Howd': the caret is past the splice, so it must move with the text.
		expect(live.replaceText({node: firstTextToken(live), start: 0, end: 1}, 'Howd')).toBe(true)

		await expect.element(page.getByText('Howdello')).toBeInTheDocument()
		verifyCaretPosition(getElement(page.getByText('Howdello')), 8)
	})
})