import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'
import {mountBlock} from '../tokens/__testing__/mountFixtures'

/**
 * Row identity comes from the selection (DOM-resolved or stored), not
 * document.activeElement. Under one host activeElement is always the
 * container; these pin the topology-independent path.
 */
describe('blockEdit row identity', () => {
	it('Enter with a DOM-resolvable selection (tier 1) splits the selected row', () => {
		const {store, container} = mountBlock()
		const second = store.tokens.nodes()[1]
		store.tokens.selection.selectNode(second, 'end')
		// Applying the stored anchor to the DOM focuses the row (an N-host artifact:
		// the row is a real tabindex target). Blur it so activeElement sits on
		// <body> — the one-host shape this fix has to work under — while the
		// underlying DOM Range stays put, live for domAnchors() to read.
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur()

		container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}))

		expect(store.tokens.value()).toBe('one\n\ntwo\n\n\n\n')
	})

	it('Enter with only a stored selection (tier 2) splits the selected row', () => {
		const {store, container} = mountBlock()
		const second = store.tokens.nodes()[1]
		store.tokens.selection.selectNode(second, 'end')
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
		// Kill tier 1: no live DOM Range at all, so only the model-stored anchor
		// `selectNode` wrote above can resolve the row.
		window.getSelection()?.removeAllRanges()

		container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}))

		expect(store.tokens.value()).toBe('one\n\ntwo\n\n\n\n')
	})

	it('does nothing when there is no selection anywhere', () => {
		const {store, container} = mountBlock()
		store.tokens.selection.clear()
		window.getSelection()?.removeAllRanges()

		container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}))

		expect(store.tokens.nodes().length).toBe(2)
	})
})

/**
 * A control root (drag handle, block menu button) is not a row: `SelectionDriver`
 * deliberately leaves the stored selection standing when focus lands on one
 * (`SelectionDriver.ts`'s `syncIfInEditor`), so a keypress landing on a control
 * must be judged by its EVENT TARGET, not by whatever selection happens to be
 * stored for some row elsewhere.
 */
describe('blockEdit control guard', () => {
	function mountBlockWithControl(controlRow: 0 | 1) {
		const store = new Store()
		store.props.set({
			defaultValue: 'one\n\ntwo\n\n',
			layout: 'block',
			draggable: true,
			Mark: () => null,
			options: [{markup: '__slot__\n\n'}],
		})
		const container = document.createElement('div')
		const control = document.createElement('button')
		control.setAttribute('aria-label', 'drag')
		for (let i = 0; i < 2; i++) {
			const row = document.createElement('div')
			if (i === controlRow) row.append(control)
			const mark = document.createElement('span')
			const text = document.createElement('span')
			mark.append(text)
			row.append(mark)
			container.append(row)
		}
		document.body.append(container)
		store.host.container(container)
		store.tokens.control()(control)
		store.host.rendered()
		return {store, container, control}
	}

	it('ignores Enter targeting a control even with a row selection stored', () => {
		const {store, control} = mountBlockWithControl(0)
		const row0 = store.tokens.nodes()[0]
		store.tokens.selection.selectNode(row0, 'end')
		control.focus()

		const event = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})
		control.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.nodes().length).toBe(2)
	})

	it('ignores Backspace targeting a control even with a row selection stored', () => {
		const {store, control} = mountBlockWithControl(1)
		const row1 = store.tokens.nodes()[1]
		store.tokens.selection.selectNode(row1, 'start')
		control.focus()

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		control.dispatchEvent(event)

		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})
})