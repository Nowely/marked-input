import {afterEach, describe, expect, it, vi} from 'vitest'

import {watch} from '../../shared/signals/index.js'
import {Store} from '../../store/Store'
import type {TokenChange} from './TokenHandle'

/** Inline fixture (from TokenModel.facade.spec.ts): text 'he' [0,2], mark '@[x]' [2,6], text 'llo' [6,9]. */
function mountWithMark() {
	const store = new Store()
	store.props.set({
		defaultValue: 'he@[x]llo',
		options: [{markup: '@[__value__]'}],
		Mark: () => null,
	})
	const container = document.createElement('div')
	const text1 = document.createElement('span')
	const mark = document.createElement('span')
	mark.append(document.createTextNode('x'))
	const text2 = document.createElement('span')
	container.append(text1, mark, text2)
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container, text1, mark, text2}
}

describe('TokenModel patch commits (text path, no renderer)', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('tail text edit without rendered() patches the surface and re-indexes in place', () => {
		const {store, text2} = mountWithMark()
		// The first adapter commit reconciled the surfaces: 'llo' is on screen.
		expect(text2.textContent).toBe('llo')
		expect(text2.contentEditable).toBe('true')

		const tail = store.tokens.tokenAt(8)
		if (!tail) throw new Error('expected tail handle')
		const changes: TokenChange[] = []
		watch(tail.changed, change => changes.push(change))
		const indexedSpy = vi.fn()
		watch(store.tokens.indexed, indexedSpy)

		// Append '!' at the end: text 'llo' [6,9] → 'llo!' [6,10] — pure text path.
		// The adapter would NOT re-render (structure() is reference-stable), so
		// host.rendered() is deliberately not called again.
		store.edit.replace({start: 9, end: 9}, '!')

		// The surface was patched directly, without the renderer.
		expect(text2.textContent).toBe('llo!')
		// Exactly one more commit wave.
		expect(indexedSpy).toHaveBeenCalledTimes(1)
		// The edited token's handle saw the change and reads fresh.
		expect(changes).toEqual([{kind: 'text', previous: 'llo'}])
		expect(tail.text()).toBe('llo!')
		// Index addresses were refreshed in place: post-edit positions resolve.
		const textNode = text2.firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a text node')
		expect(store.tokens.boundaryFor(textNode, 4)).toBe(10)
		expect(store.tokens.tokenAt(10)?.address().path).toEqual([2])
		// contentEditable survives the patch.
		expect(text2.contentEditable).toBe('true')
	})

	it('structural edit without rendered() does not patch — indexed stays quiet until rendered()', () => {
		const {store, text2} = mountWithMark()
		const indexedSpy = vi.fn()
		watch(store.tokens.indexed, indexedSpy)

		// Insert a second mark: 'he@[x]llo' → 'he@[x]llo@[y]' — structural (added
		// tokens). The patch path must stay quiet; the renderer owns this change.
		store.edit.replace({start: 9, end: 9}, '@[y]')

		expect(indexedSpy).not.toHaveBeenCalled()
		expect(text2.textContent).toBe('llo')

		// The adapter re-renders (structure() reference changed) and reports
		// rendered() → the full commit runs exactly once.
		store.host.rendered()
		expect(indexedSpy).toHaveBeenCalledTimes(1)
	})
})