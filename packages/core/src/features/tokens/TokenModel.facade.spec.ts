import {describe, expect, it} from 'vitest'

import {Store} from '../../store/Store'

type Mounted = {store: Store; container: HTMLElement}

/** Inline fixture: text "he" [0,2], mark "@[x]" [2,6], text "llo" [6,9]. */
function mountWithMark(): Mounted {
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
	return {store, container}
}

/**
 * Block fixture (pattern from BlockController.spec.ts): mark "one\n\n" [0,5]
 * with child text "one" [0,3], mark "two\n\n" [5,10] with child text "two"
 * [5,8]. One row div per mark, the mark element holding one text surface.
 */
function mountBlock(): Mounted {
	const store = new Store()
	store.props.set({
		defaultValue: 'one\n\ntwo\n\n',
		layout: 'block',
		Mark: () => null,
		options: [{markup: '__slot__\n\n'}],
	})
	const container = document.createElement('div')
	for (let i = 0; i < 2; i++) {
		const row = document.createElement('div')
		const mark = document.createElement('span')
		const text = document.createElement('span')
		mark.append(text)
		row.append(mark)
		container.append(row)
	}
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container}
}

/**
 * All (node, offset) probes worth checking in a container.
 * @yields each [node, offset] DOM boundary, including the container itself
 */
function* probes(container: HTMLElement): Generator<[Node, number]> {
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
	for (let node: Node | null = container; node; node = walker.nextNode()) {
		const max = node instanceof Text ? node.length : node.childNodes.length
		for (let offset = 0; offset <= max; offset++) yield [node, offset]
	}
}

describe('TokenModel facade parity (dual-run vs SelectionController)', () => {
	for (const [name, mount] of [
		['inline with mark', mountWithMark],
		['block layout', mountBlock],
	] as const) {
		it(`boundaryFor matches rawPositionFromBoundary — ${name}`, () => {
			const {store, container} = mount()
			let defined = 0
			for (const [node, offset] of probes(container)) {
				for (const affinity of ['before', 'after'] as const) {
					const actual = store.tokens.boundaryFor(node, offset, affinity)
					expect(actual, `${node.nodeName}@${offset}/${affinity}`).toBe(
						store.selection.rawPositionFromBoundary(node, offset, affinity)
					)
					if (actual !== undefined) defined++
				}
			}
			// Guard against a vacuous pass (fixture not indexing → all undefined).
			expect(defined).toBeGreaterThan(0)
			container.remove()
		})

		it(`readSelection matches readRaw — ${name}`, () => {
			const {store, container} = mount()
			const firstText = document.createTreeWalker(container, NodeFilter.SHOW_TEXT).nextNode()
			if (!(firstText instanceof Text) || firstText.length === 0) throw new Error('expected a text node')
			const sel = window.getSelection()
			const range = document.createRange()
			range.setStart(firstText, 0)
			range.setEnd(firstText, Math.min(1, firstText.length))
			sel?.removeAllRanges()
			sel?.addRange(range)
			expect(store.tokens.readSelection()).toBeDefined()
			expect(store.tokens.readSelection()).toEqual(store.selection.readRaw())
			expect(store.tokens.selectedContent()).toEqual(store.selection.readSelectedContent())
			sel?.removeAllRanges()
			container.remove()
		})
	}

	it('tokenAt finds the containing text surface and the next one after a gap', () => {
		const {store, container} = mountWithMark()
		// value: he@[x]llo → text "he" [0,2], mark [2,6], text "llo" [6,9]
		expect(store.tokens.tokenAt(1)?.address().path).toEqual([0])
		expect(store.tokens.tokenAt(2)?.address().path).toEqual([0]) // inclusive end of "he"
		expect(store.tokens.tokenAt(5)?.address().path).toEqual([2]) // inside mark: no containing surface → next start ≥ 5 is "llo"
		expect(store.tokens.tokenAt(9)?.address().path).toEqual([2])
		expect(store.tokens.tokenAt(10)).toBeUndefined() // past the last surface
		container.remove()
	})
})