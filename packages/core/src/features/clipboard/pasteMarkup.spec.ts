import {describe, expect, it} from 'vitest'

import {captureMarkupPaste, clearMarkupPaste, consumeMarkupPaste, MARKPUT_MIME} from './pasteMarkup'

function makeContainer(): HTMLElement {
	// oxlint-disable-next-line no-unsafe-type-assertion -- plain object used as WeakMap key; no DOM methods needed
	return {} as HTMLElement
}

function makePasteEvent(markup: string): ClipboardEvent {
	// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub; only clipboardData.getData is accessed
	return {
		clipboardData: {
			getData: (mime: string) => (mime === MARKPUT_MIME ? markup : ''),
		},
	} as unknown as ClipboardEvent
}

describe('captureMarkupPaste / consumeMarkupPaste', () => {
	it('returns markup captured for its own container', () => {
		const containerA = makeContainer()
		const event = makePasteEvent('hello @[world](1)')
		captureMarkupPaste(event, containerA)
		expect(consumeMarkupPaste(containerA)).toBe('hello @[world](1)')
	})

	it('does not leak captured markup to another container', () => {
		const containerA = makeContainer()
		const containerB = makeContainer()
		captureMarkupPaste(makePasteEvent('@[a](1)'), containerA)
		expect(consumeMarkupPaste(containerB)).toBeUndefined()
		// A's markup is still there and consumable
		expect(consumeMarkupPaste(containerA)).toBe('@[a](1)')
	})

	it('consumeMarkupPaste clears after first call', () => {
		const container = makeContainer()
		captureMarkupPaste(makePasteEvent('@[a](1)'), container)
		expect(consumeMarkupPaste(container)).toBe('@[a](1)')
		expect(consumeMarkupPaste(container)).toBeUndefined()
	})

	it('returns undefined when no markup was captured', () => {
		const container = makeContainer()
		captureMarkupPaste(makePasteEvent(''), container)
		expect(consumeMarkupPaste(container)).toBeUndefined()
	})

	it('clearMarkupPaste removes pending markup for that container', () => {
		const container = makeContainer()
		captureMarkupPaste(makePasteEvent('@[a](1)'), container)
		clearMarkupPaste(container)
		expect(consumeMarkupPaste(container)).toBeUndefined()
	})
})