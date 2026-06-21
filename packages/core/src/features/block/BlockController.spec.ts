import {describe, it, expect, vi, beforeEach} from 'vitest'

import {effect} from '../../shared/signals'
import {Store} from '../../store/Store'
import type {Token} from '../tokens'

describe('BlockController', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		store = new Store()
	})

	describe('activation via props', () => {
		it('does not leak a watcher when props toggle', () => {
			store.props.set({
				layout: 'block',
				draggable: true,
				value: 'test',
				onChange: () => {},
			})
			// disable drag
			store.props.set({layout: 'inline', draggable: false})

			const currentSpy = vi.spyOn(store.value, 'current')
			store.block.action({type: 'delete', index: 0})
			expect(currentSpy).not.toHaveBeenCalled()
		})
	})

	it('owns the drag event', () => {
		const store = new Store()
		expect(typeof store.block.action).toBe('function')
	})

	it('commits drag edits through the live token read and writes caret.selection', () => {
		store.props.set({
			layout: 'block',
			draggable: true,
			Mark: () => null,
			options: [{markup: '__slot__\n\n'}],
		})
		// Drag actions read the mounted token layer (a bare container is enough:
		// commits settle structurally and current() stays the reconciled parse).
		store.host.container(document.createElement('div'))
		store.value.current('alpha\n\nbeta\n\n')
		const currentSpy = vi.spyOn(store.value, 'current')

		store.block.action({type: 'delete', index: 0})

		expect(currentSpy).toHaveBeenCalledWith('beta\n\n')
		expect(store.selection.range()).toEqual({start: 6, end: 6})
	})

	it('writes value and caret as a single batched tick', () => {
		store.props.set({
			layout: 'block',
			draggable: true,
			Mark: () => null,
			options: [{markup: '__slot__\n\n'}],
		})
		store.host.container(document.createElement('div'))
		store.value.current('alpha\n\nbeta\n\n')

		let runs = 0
		const dispose = effect(() => {
			store.value.current()
			store.selection.range()
			runs++
		})
		const initial = runs

		store.block.action({type: 'delete', index: 0})

		expect(runs - initial).toBe(1)
		dispose()
	})

	it('skips writes when reorder is a no-op', () => {
		store.props.set({
			layout: 'block',
			draggable: true,
			Mark: () => null,
			options: [{markup: '__slot__\n\n'}],
		})
		store.host.container(document.createElement('div'))
		store.value.current('alpha\n\nbeta\n\n')
		const replaceSpy = vi.spyOn(store.value, 'replace')
		const positionSpy = vi.spyOn(store.selection, 'position')

		store.block.action({type: 'reorder', source: 0, target: 0})

		expect(replaceSpy).not.toHaveBeenCalled()
		expect(positionSpy).not.toHaveBeenCalled()
	})

	describe('per-row stores (identity-keyed)', () => {
		it('keys stores by stable token id — a suffix-shifted row keeps its store', () => {
			// Fabricated same-id pair: exactly the suffix-shift shape (new object,
			// inherited id) whose drag/hover state the old object-keyed WeakMap
			// silently reset.
			const before: Token = {type: 'text', content: 'a', position: {start: 0, end: 1}, id: 101}
			const shifted: Token = {type: 'text', content: 'a', position: {start: 1, end: 2}, id: 101}
			const other: Token = {type: 'text', content: 'b', position: {start: 2, end: 3}, id: 102}

			expect(store.block.get(shifted)).toBe(store.block.get(before))
			expect(store.block.get(other)).not.toBe(store.block.get(before))
		})

		it('prunes the store of a structurally removed token after the removal commit', () => {
			// Mounted fixture (the MarkController.spec pattern): text 'he' [0,2],
			// mark '@[x]' [2,6], text 'llo' [6,9], bound on rendered().
			store.props.set({defaultValue: 'he@[x]llo', options: [{markup: '@[__value__]'}], Mark: () => null})
			const container = document.createElement('div')
			const text1 = document.createElement('span')
			const markEl = document.createElement('span')
			markEl.append(document.createTextNode('x'))
			const text2 = document.createElement('span')
			container.append(text1, markEl, text2)
			document.body.append(container)
			store.host.container(container)
			store.host.rendered()
			const token = store.tokens.current().find(t => t.type === 'mark')
			if (!token) throw new Error('expected parsed mark token')
			const blockStore = store.block.get(token)

			// Remove the mark structurally and bind the new tree — the changed
			// event fires after the bind; its removed ids drive the prune.
			store.edit.replace({start: 2, end: 6}, '')
			container.replaceChildren(document.createElement('span'))
			store.host.rendered()

			// Same captured token object, same id — but the identity is gone, so
			// a FRESH store comes back: removed rows leak no per-row UI state.
			expect(store.block.get(token)).not.toBe(blockStore)
			document.body.replaceChildren()
		})
	})
})