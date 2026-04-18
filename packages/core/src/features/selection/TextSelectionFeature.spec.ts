import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

import {Store} from '../../store/Store'

// Stub global `document` for TextSelectionFeature which calls document.addEventListener/removeEventListener
const listeners: Record<string, Function[]> = {}
const mockDocument = {
	addEventListener: vi.fn((event: string, handler: Function) => {
		;(listeners[event] ??= []).push(handler)
	}),
	removeEventListener: vi.fn((event: string, handler: Function) => {
		const list = listeners[event] ?? []
		const idx = list.indexOf(handler)
		if (idx >= 0) list.splice(idx, 1)
	}),
}

describe('TextSelectionFeature', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		for (const key of Object.keys(listeners)) listeners[key] = []
		// Provide a global document stub
		vi.stubGlobal('document', mockDocument)
		store = new Store()
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('enable() sets up the selecting subscription via effect', () => {
		const controller = store.feature.textSelection
		controller.enable()
		// The effect runs immediately; no error means subscription is established.
		expect(mockDocument.addEventListener).toHaveBeenCalledTimes(4)
	})

	it('enable() is idempotent — calling twice does not double-subscribe', () => {
		const controller = store.feature.textSelection
		controller.enable()
		const callCount = mockDocument.addEventListener.mock.calls.length
		controller.enable()
		expect(mockDocument.addEventListener).toHaveBeenCalledTimes(callCount)
	})

	it('disable() removes the reactive subscription', () => {
		const controller = store.feature.textSelection
		controller.enable()
		controller.disable()
		// After disable, setting selecting to "drag" should not cause errors
		expect(() => store.state.selecting('drag')).not.toThrow()
	})

	it('disable() resets selecting from drag to undefined', () => {
		const controller = store.feature.textSelection
		controller.enable()
		store.state.selecting('drag')
		controller.disable()
		expect(store.state.selecting()).toBe(undefined)
	})

	it('selecting set to "drag" disables contenteditable on container elements', () => {
		// Create a minimal mock container
		const span = {contentEditable: 'true'}
		const container = {
			querySelectorAll: vi.fn(() => [span]),
		}
		// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub object satisfies the API surface used by TextSelectionFeature in tests
		store.state.container(container as unknown as HTMLDivElement)

		const controller = store.feature.textSelection
		controller.enable()
		store.state.selecting('drag')

		expect(container.querySelectorAll).toHaveBeenCalledWith('[contenteditable="true"]')
		expect(span.contentEditable).toBe('false')
	})
})