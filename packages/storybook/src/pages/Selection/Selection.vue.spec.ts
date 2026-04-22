import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'

import * as Stories from './Selection.vue.stories'

const {Inline, Drag} = composeStories(Stories)

describe('Cross-select', () => {
	it('inline: should flip spans to non-editable during cross-element drag', async () => {
		const {container} = await render(Inline)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement here
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('span'))
		const [span1, span2] = spans

		// Set a selection spanning both spans (programmatic — crosses editing hosts)
		const sel = window.getSelection()!
		sel.setBaseAndExtent(span1.firstChild!, 0, span2.firstChild!, 3)

		// Simulate mousedown on span1 (records pressedNode)
		span1.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))

		// Simulate mousemove on span2 (cross-element → should trigger flip)
		span2.dispatchEvent(new MouseEvent('mousemove', {bubbles: true}))

		expect(span1.contentEditable).toBe('false')
		expect(span2.contentEditable).toBe('false')
	})

	it('inline: should restore spans after selection collapses', async () => {
		const {container} = await render(Inline)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement here
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('span'))
		const [span1, span2] = spans

		// Trigger cross-select (same as above)
		const sel = window.getSelection()!
		sel.setBaseAndExtent(span1.firstChild!, 0, span2.firstChild!, 3)
		span1.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
		span2.dispatchEvent(new MouseEvent('mousemove', {bubbles: true}))
		expect(span1.contentEditable).toBe('false')

		// Collapse selection then fire mouseup — should restore
		sel.removeAllRanges()
		document.dispatchEvent(new MouseEvent('mouseup', {bubbles: false}))

		expect(span1.contentEditable).toBe('true')
		expect(span2.contentEditable).toBe('true')
	})

	it('drag: should flip block rows to non-editable during cross-block drag', async () => {
		const {container} = await render(Drag)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement here
		const root = container.firstElementChild as HTMLElement
		// oxlint-disable-next-line no-unsafe-type-assertion -- children of HTMLElement are HTMLElements
		const blocks = Array.from(root.children) as HTMLElement[]
		// drag mode renders: [textBlock("hello"), markBlock("world"), textBlock("foo")]
		const [textBlock1, , textBlock3] = blocks

		// Use TreeWalker to find text nodes — block structure has drag handles and
		// indicators as siblings so querySelector('span') is not reliable here
		const w1 = document.createTreeWalker(textBlock1, NodeFilter.SHOW_TEXT)
		const w3 = document.createTreeWalker(textBlock3, NodeFilter.SHOW_TEXT)
		// oxlint-disable-next-line no-unsafe-type-assertion -- nodeType === 3 guarantees Text; instanceof Text breaks in test envs
		const textNode1 = w1.nextNode() as Text | null
		// oxlint-disable-next-line no-unsafe-type-assertion -- nodeType === 3 guarantees Text; instanceof Text breaks in test envs
		const textNode3 = w3.nextNode() as Text | null
		if (!textNode1 || !textNode3) throw new Error('text nodes not found in drag blocks')

		// Set selection spanning both text blocks
		const sel = window.getSelection()!
		sel.setBaseAndExtent(textNode1, 0, textNode3, 2)

		// Simulate cross-block drag
		textBlock1.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
		textBlock3.dispatchEvent(new MouseEvent('mousemove', {bubbles: true}))

		// Text blocks should be flipped to non-editable
		expect(textBlock1.contentEditable).toBe('false')
		expect(textBlock3.contentEditable).toBe('false')
	})
})