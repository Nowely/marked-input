import {describe, expect, it, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('UserSelectingTracker', () => {
	function mountWithContainer() {
		const store = new Store()
		const container = document.createElement('div')
		document.body.appendChild(container)
		store.dom.container(container)
		store.lifecycle.mounted()
		return {store, container}
	}

	it('flips isSelecting when mouse drags across nodes inside the editor', () => {
		const {store, container} = mountWithContainer()
		const a = document.createElement('span')
		const b = document.createElement('span')
		a.textContent = 'a'
		b.textContent = 'b'
		container.append(a, b)

		const mockSel = {containsNode: () => true, isCollapsed: false, focusNode: null, rangeCount: 0}
		// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub of Selection for tracking logic
		vi.spyOn(window, 'getSelection').mockReturnValue(mockSel as unknown as Selection)

		a.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
		b.dispatchEvent(new MouseEvent('mousemove', {bubbles: true}))
		expect(store.caret.isUserSelecting()).toBe(true)

		container.remove()
		vi.restoreAllMocks()
	})

	it('does not flip isSelecting when drag stays on the same element', () => {
		const {store, container} = mountWithContainer()
		const a = document.createElement('span')
		a.textContent = 'a'
		container.append(a)

		const mockSel = {containsNode: () => true, isCollapsed: true, focusNode: null, rangeCount: 0}
		// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub of Selection for tracking logic
		vi.spyOn(window, 'getSelection').mockReturnValue(mockSel as unknown as Selection)

		a.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
		a.dispatchEvent(new MouseEvent('mousemove', {bubbles: true}))
		expect(store.caret.isUserSelecting()).toBe(false)

		container.remove()
		vi.restoreAllMocks()
	})

	it('clears isSelecting on mouseup when the resulting selection is collapsed', () => {
		const {store, container} = mountWithContainer()
		store.caret.isUserSelecting(true)

		const mockSel = {isCollapsed: true, focusNode: null, rangeCount: 0}
		// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub of Selection for tracking logic
		vi.spyOn(window, 'getSelection').mockReturnValue(mockSel as unknown as Selection)

		document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}))
		expect(store.caret.isUserSelecting()).toBe(false)

		container.remove()
		vi.restoreAllMocks()
	})
})