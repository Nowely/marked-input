import {describe, it, expect, vi, beforeEach} from 'vitest'

import {effect} from '../../shared/signals'
import {Store} from '../../store/Store'
import {anchorsAt, selectionRange} from '../tokens/__testing__/mountFixtures'
import {nodesOf, textToken} from '../tokens/__testing__/tokenFactories'

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

			const writeSpy = vi.spyOn(store.edit, 'setValue')
			store.block.action({type: 'delete', index: 0})
			expect(writeSpy).not.toHaveBeenCalled()
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
		store.tokens.setValue('alpha\n\nbeta\n\n')

		store.block.action({type: 'delete', index: 0})

		// The OUTCOME, not the write channel: `applyDragAction` synthesizes a complete new
		// string from row positions and `edit.setValue` commits it, so the value is only
		// ever READ on this path.
		expect(store.tokens.value()).toBe('beta\n\n')
		expect(selectionRange(store)).toEqual({start: 6, end: 6})
	})

	it('writes value and caret as a single batched tick', () => {
		store.props.set({
			layout: 'block',
			draggable: true,
			Mark: () => null,
			options: [{markup: '__slot__\n\n'}],
		})
		store.host.container(document.createElement('div'))
		store.tokens.setValue('alpha\n\nbeta\n\n')

		let runs = 0
		const dispose = effect(() => {
			store.tokens.value()
			selectionRange(store)
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
		store.tokens.setValue('alpha\n\nbeta\n\n')
		const writeSpy = vi.spyOn(store.edit, 'setValue')
		const selectSpy = vi.spyOn(store.selection, 'select')

		store.block.action({type: 'reorder', source: 0, target: 0})

		expect(writeSpy).not.toHaveBeenCalled()
		expect(selectSpy).not.toHaveBeenCalled()
	})

	describe('per-row stores (identity-keyed)', () => {
		it('keys stores by stable node id, not by the node object', () => {
			// Two DISTINCT node objects carrying the same id — each tree allocates from 1.
			// That is the discriminator: object keying (the pre-identity WeakMap) hands the
			// second one a fresh store and silently resets its drag/hover state.
			const [before] = nodesOf([textToken('a', 0)])
			const [shifted] = nodesOf([textToken('a', 1)])
			const [, other] = nodesOf([textToken('a', 0), textToken('b', 1)])
			expect(shifted).not.toBe(before)
			expect(shifted.id).toBe(before.id)
			expect(other.id).not.toBe(before.id)

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
			const node = store.tokens.nodes().find(n => n.kind === 'mark')
			if (!node) throw new Error('expected parsed mark node')
			const blockStore = store.block.get(node)

			// Remove the mark structurally and bind the new tree — the changed
			// event fires after the bind; its removed ids drive the prune.
			store.edit.replace(...anchorsAt(store, 2, 6), '')
			container.replaceChildren(document.createElement('span'))
			store.host.rendered()

			// Same captured node object, same id — but the identity is gone, so
			// a FRESH store comes back: removed rows leak no per-row UI state.
			expect(store.block.get(node)).not.toBe(blockStore)
			document.body.replaceChildren()
		})
	})
})