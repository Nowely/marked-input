import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('TextSelectionFeature', () => {
	let store: Store
	let addSpy: ReturnType<typeof vi.spyOn>
	let removeSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		addSpy = vi.spyOn(document, 'addEventListener')
		removeSpy = vi.spyOn(document, 'removeEventListener')
		store = new Store()
	})

	afterEach(() => {
		addSpy.mockRestore()
		removeSpy.mockRestore()
	})

	it('enable() sets up the selecting subscription via effect', () => {
		const controller = store.caret
		controller.enable()
		expect(addSpy).toHaveBeenCalledTimes(4)
	})

	it('enable() is idempotent — calling twice does not double-subscribe', () => {
		const controller = store.caret
		controller.enable()
		const callCount = addSpy.mock.calls.length
		controller.enable()
		expect(addSpy).toHaveBeenCalledTimes(callCount)
	})

	it('disable() removes the reactive subscription', () => {
		const controller = store.caret
		controller.enable()
		controller.disable()
		expect(() => store.caret.selecting('drag')).not.toThrow()
	})

	it('disable() resets selecting from drag to undefined', () => {
		const controller = store.caret
		controller.enable()
		store.caret.selecting('drag')
		controller.disable()
		expect(store.caret.selecting()).toBe(undefined)
	})

	it('selecting set to "drag" disables contenteditable on container elements', () => {
		const container = document.createElement('div')
		const span = document.createElement('span')
		span.contentEditable = 'true'
		container.appendChild(span)
		document.body.appendChild(container)

		store.dom.container(container)

		const controller = store.caret
		controller.enable()
		store.caret.selecting('drag')

		expect(span.contentEditable).toBe('false')

		container.remove()
	})
})