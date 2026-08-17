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

	it('block actions apply with draggable:false (menu/keyboard actions are not drag UI)', () => {
		store.props.set({
			layout: 'block',
			draggable: false,
			Mark: () => null,
			options: [{markup: '__slot__\n\n'}],
		})
		store.host.container(document.createElement('div'))
		store.tokens.setValue('alpha\n\nbeta\n\n')

		store.block.action({type: 'delete', index: 0})

		expect(store.tokens.value()).toBe('beta\n\n')
	})

	it('drops reorder with draggable:false (reorder is drag-originated)', () => {
		store.props.set({
			layout: 'block',
			draggable: false,
			Mark: () => null,
			options: [{markup: '__slot__\n\n'}],
		})
		store.host.container(document.createElement('div'))
		store.tokens.setValue('alpha\n\nbeta\n\n')

		store.block.action({type: 'reorder', source: 0, target: 2})

		expect(store.tokens.value()).toBe('alpha\n\nbeta\n\n')
	})

	it('commits drag edits through the live token read and writes caret.selection', () => {
		store.props.set({
			layout: 'block',
			draggable: true,
			Mark: () => null,
			options: [{markup: '__slot__\n\n'}],
		})
		// Drag actions read the mounted token layer (a bare container is enough:
		// commits settle structurally and the live tree stays the reconciled parse).
		store.host.container(document.createElement('div'))
		store.tokens.setValue('alpha\n\nbeta\n\n')

		store.block.action({type: 'delete', index: 0})

		// The OUTCOME, not the write channel: `applyDragAction` composes a complete new
		// string from anchor-slice reads of the tree and `edit.setValue` commits it. The
		// caret lands at the start of the row that replaced the deleted one.
		expect(store.tokens.value()).toBe('beta\n\n')
		expect(selectionRange(store)).toEqual({start: 0, end: 0})
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
		const selectSpy = vi.spyOn(store.tokens.selection, 'select')

		store.block.action({type: 'reorder', source: 0, target: 0})

		expect(writeSpy).not.toHaveBeenCalled()
		expect(selectSpy).not.toHaveBeenCalled()
	})

	describe('row identity', () => {
		it('removes the addressed row, not a byte-identical neighbour', () => {
			store.props.set({
				layout: 'block',
				draggable: true,
				Mark: () => null,
				options: [{markup: '__slot__\n\n'}],
			})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('First\n\nFirst\n\nSecond\n\n')

			const [first, second, third] = store.tokens.nodes().map(node => node.id)

			store.block.action({type: 'delete', index: 0})

			// The SURVIVORS name which row actually went — the value alone cannot, because
			// the two candidates compose to the same string. Row identity is what both
			// adapters key rendering on and what `BlockController` prunes per-row state by.
			expect(store.tokens.value()).toBe('First\n\nSecond\n\n')
			expect(store.tokens.nodes().map(node => node.id)).toEqual([second, third])
			expect(first).not.toBe(second)
		})

		it('keeps the original row when it is duplicated', () => {
			store.props.set({
				layout: 'block',
				draggable: true,
				Mark: () => null,
				options: [{markup: '__slot__\n\n'}],
			})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('alpha\n\nbeta\n\n')
			const [alpha, beta] = store.tokens.nodes().map(node => node.id)

			store.block.action({type: 'duplicate', index: 0})

			// The composer's answers, unchanged — the copy glues to its original and the caret
			// lands at the copy's start.
			expect(store.tokens.value()).toBe('alpha\n\nalpha\n\nbeta\n\n')
			expect(selectionRange(store)).toEqual({start: 7, end: 7})
			// ...and only the copy is new: a whole-document rewrite could not promise this.
			const after = store.tokens.nodes().map(node => node.id)
			expect(after[0]).toBe(alpha)
			expect(after[2]).toBe(beta)
			expect(after[1]).not.toBe(alpha)
		})

		it('keeps every existing row when one is added below', () => {
			store.props.set({
				layout: 'block',
				draggable: true,
				Mark: () => null,
				options: [{markup: '__slot__\n\n'}],
			})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('alpha\n\nbeta\n\n')
			const [alpha, beta] = store.tokens.nodes().map(node => node.id)

			store.block.action({type: 'add', afterIndex: 0})

			expect(store.tokens.value()).toBe('alpha\n\n\n\nbeta\n\n')
			expect(selectionRange(store)).toEqual({start: 7, end: 7})
			const after = store.tokens.nodes().map(node => node.id)
			expect(after[0]).toBe(alpha)
			expect(after[2]).toBe(beta)
		})
	})

	describe('per-row stores (identity-keyed)', () => {
		it('keeps a row store, and its state, across an operation on another row', () => {
			// The CONSEQUENCE-level gate for row identity: the id assertions above say which node
			// survived, this says what that costs a user. Before the row verbs, deleting the first
			// of two byte-identical rows announced the SECOND row's id as removed, so the store
			// below was pruned and the open menu closed itself on an unrelated row's deletion.
			store.props.set({
				layout: 'block',
				draggable: true,
				Mark: () => null,
				options: [{markup: '__slot__\n\n'}],
			})
			const container = document.createElement('div')
			document.body.append(container)
			store.host.container(container)
			store.tokens.setValue('First\n\nFirst\n\nSecond\n\n')
			// The announcement drives the prune, and it fires whether or not the DOM walk aligns.
			store.host.rendered()

			const survivor = store.block.get(store.tokens.nodes()[1])
			survivor.state.menuOpen(true)
			survivor.state.isHovered(true)

			store.block.action({type: 'delete', index: 0})
			store.host.rendered()

			expect(store.block.get(store.tokens.nodes()[0])).toBe(survivor)
			expect(survivor.state.menuOpen()).toBe(true)
			expect(survivor.state.isHovered()).toBe(true)
			document.body.replaceChildren()
		})

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