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
		store.lifecycle.mounted()
		expect(addSpy).toHaveBeenCalled()
	})

	it('set up is idempotent across multiple construction events', () => {
		store.lifecycle.mounted()
		const callCount = addSpy.mock.calls.length
		addSpy.mockClear()
		store = new Store()
		store.lifecycle.mounted()
		expect(addSpy).toHaveBeenCalledTimes(callCount)
	})

	it('disabling resets selecting from drag to undefined', () => {
		store.lifecycle.mounted()
		store.caret.selecting('drag')
		store.lifecycle.unmounted()
		expect(store.caret.selecting()).toBe(undefined)
	})

	it('selecting set to "drag" reconciles indexed text roots to non-editable', () => {
		const container = document.createElement('div')
		const span = document.createElement('span')
		container.appendChild(span)
		document.body.appendChild(container)

		store.props.set({defaultValue: 'hello'})
		store.lifecycle.mounted()
		store.dom.container(container)
		store.lifecycle.rendered()

		expect(span.contentEditable).toBe('true')

		store.caret.selecting('drag')

		expect(span.contentEditable).toBe('false')

		container.remove()
	})
})