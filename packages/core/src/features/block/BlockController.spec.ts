import {describe, it, expect, vi, beforeEach} from 'vitest'

import {effect} from '../../shared/signals'
import {Store} from '../../store/Store'
import {anchorsAt, selectionRange} from '../tokens/__testing__/mountFixtures'

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
			options: [],
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
			options: [],
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
			options: [],
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
			options: [],
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
			options: [],
		})
		store.host.container(document.createElement('div'))
		store.tokens.setValue('alpha\n\nbeta\n\n')
		const writeSpy = vi.spyOn(store.edit, 'setValue')
		const selectSpy = vi.spyOn(store.tokens.selection, 'select')

		store.block.action({type: 'reorder', source: 0, target: 0})

		expect(writeSpy).not.toHaveBeenCalled()
		expect(selectSpy).not.toHaveBeenCalled()
	})

	describe('adds no anchor can name', () => {
		const blockProps: Parameters<Store['props']['set']>[0] = {
			layout: 'block',
			draggable: true,
			Mark: () => null,
			options: [],
		}

		it('adds a row to an empty document', () => {
			store.props.set(blockProps)
			store.host.container(document.createElement('div'))
			store.tokens.setValue('')

			// An empty document already IS one empty row (issue 08), so the menu add goes
			// through the anchored path: one separator after it yields two empty rows.
			store.block.action({type: 'add', afterIndex: 0})

			expect(store.tokens.value()).toBe('\n\n')
			expect(store.tokens.nodes()).toHaveLength(2)
			expect(selectionRange(store)).toEqual({start: 2, end: 2})
		})

		it('inserts BEFORE the first row for a negative afterIndex', () => {
			store.props.set(blockProps)
			store.host.container(document.createElement('div'))
			store.tokens.setValue('alpha\n\nbeta\n\n')

			store.block.action({type: 'add', afterIndex: -1})

			// `insertAfter` cannot express "before the first row", so this stays composed too.
			expect(store.tokens.value()).toBe('\n\nalpha\n\nbeta\n\n')
		})

		it('writes nothing for a row index no row answers to', () => {
			store.props.set(blockProps)
			store.host.container(document.createElement('div'))
			store.tokens.setValue('alpha\n\nbeta\n\n')

			store.block.action({type: 'delete', index: 5})
			// NEGATIVE, which is the case `Array.prototype.at` would wrap onto the LAST row.
			store.block.action({type: 'duplicate', index: -1})
			store.block.action({type: 'reorder', source: -1, target: 0})

			expect(store.tokens.value()).toBe('alpha\n\nbeta\n\n')
		})
	})

	it('menu Delete on the final unterminated row shrinks the row count', () => {
		// The final row owns no separator; its removal takes the PREVIOUS row's, so
		// Delete cannot merely convert it into the trailing empty row (review finding).
		store.props.set({
			layout: 'block',
			draggable: true,
			options: [],
		})
		store.host.container(document.createElement('div'))
		store.tokens.setValue('alpha\n\nbeta')

		store.block.action({type: 'delete', index: 1})

		expect(store.tokens.value()).toBe('alpha')
		expect(store.tokens.nodes()).toHaveLength(1)
	})

	describe('row identity', () => {
		it('removes the addressed row, not a byte-identical neighbour', () => {
			store.props.set({
				layout: 'block',
				draggable: true,
				Mark: () => null,
				options: [],
			})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('First\n\nFirst\n\nSecond\n\n')

			const [first, second, third, tail] = store.tokens.nodes().map(node => node.id)

			store.block.action({type: 'delete', index: 0})

			// The SURVIVORS name which row actually went — the value alone cannot, because
			// the two candidates compose to the same string. Row identity is what both
			// adapters key rendering on and what `BlockController` keys per-row state by.
			expect(store.tokens.value()).toBe('First\n\nSecond\n\n')
			expect(store.tokens.nodes().map(node => node.id)).toEqual([second, third, tail])
			expect(first).not.toBe(second)
		})

		it('keeps the original row when it is duplicated', () => {
			store.props.set({
				layout: 'block',
				draggable: true,
				Mark: () => null,
				options: [],
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

		it('carries a row AND its state to the new index on reorder', () => {
			store.props.set({
				layout: 'block',
				draggable: true,
				Mark: () => null,
				options: [],
			})
			const container = document.createElement('div')
			document.body.append(container)
			store.host.container(container)
			store.tokens.setValue('First\n\nFirst\n\nSecond\n\n')

			const [a, b, c, tail] = store.tokens.nodes().map(node => node.id)
			const dragged = store.block.get(store.tokens.nodes()[0])
			dragged.state.isDragging(true)

			store.block.action({type: 'reorder', source: 0, target: 2})

			// The document is UNCHANGED, because the two moved-past rows are byte-identical. So
			// the ids are the only evidence the move happened at all — and the whole reason the
			// commit carries an identity claim the string cannot.
			expect(store.tokens.value()).toBe('First\n\nFirst\n\nSecond\n\n')
			expect(store.tokens.nodes().map(node => node.id)).toEqual([b, a, c, tail])
			expect(store.block.get(store.tokens.nodes()[1])).toBe(dragged)
			expect(dragged.state.isDragging()).toBe(true)
			document.body.replaceChildren()
		})

		it('keeps every existing row when one is added below', () => {
			store.props.set({
				layout: 'block',
				draggable: true,
				Mark: () => null,
				options: [],
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
			// of two byte-identical rows retained the WRONG node, so the store below was reset
			// and the open menu closed itself on an unrelated row's deletion. Kept on the
			// mounted fixture even though the store no longer rides the announcement: the
			// bind is what an adapter actually does between the two reads.
			store.props.set({
				layout: 'block',
				draggable: true,
				Mark: () => null,
				options: [],
			})
			const container = document.createElement('div')
			document.body.append(container)
			store.host.container(container)
			store.tokens.setValue('First\n\nFirst\n\nSecond\n\n')

			const survivor = store.block.get(store.tokens.nodes()[1])
			survivor.state.menuOpen(true)
			survivor.state.isHovered(true)

			store.block.action({type: 'delete', index: 0})

			expect(store.block.get(store.tokens.nodes()[0])).toBe(survivor)
			expect(survivor.state.menuOpen()).toBe(true)
			expect(survivor.state.isHovered()).toBe(true)
			document.body.replaceChildren()
		})

		it('keeps a row store across an edit above it with NOTHING mounted', () => {
			// The object key needs no announcement, so this holds with no container and no
			// a re-bind — the id-keyed Map's prune rode the id lists the old fused
			// the delta carried, whose removals only ever came from a bind, so an unmounted
			// input could hand a row a store and never shed it. Both clocks are payload-free now,
			// so there is no removal list left to ride even where one binds.
			store.props.set({
				layout: 'block',
				draggable: true,
				Mark: () => null,
				options: [],
			})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('alpha\n\nbeta\n\n')

			const second = store.block.get(store.tokens.nodes()[1])
			second.state.menuOpen(true)

			store.edit.replace(...anchorsAt(store, 1, 1), 'X')

			expect(store.tokens.value()).toBe('aXlpha\n\nbeta\n\n')
			expect(store.block.get(store.tokens.nodes()[1])).toBe(second)
			expect(second.state.menuOpen()).toBe(true)
		})

		it('hands the row that takes a deleted row’s INDEX its own store', () => {
			// The prune case restated as what protects a user: an index is not an identity, so
			// the row that slides into slot 0 must not inherit the deleted row's open menu.
			store.props.set({
				layout: 'block',
				draggable: true,
				Mark: () => null,
				options: [],
			})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('alpha\n\nbeta\n\n')

			const first = store.tokens.nodes()[0]
			const firstStore = store.block.get(first)
			firstStore.state.menuOpen(true)

			store.block.action({type: 'delete', index: 0})

			const survivor = store.tokens.nodes()[0]
			expect(survivor).not.toBe(first)
			expect(store.block.get(survivor)).not.toBe(firstStore)
			expect(store.block.get(survivor).state.menuOpen()).toBe(false)
		})

		it('still answers for a node that has LEFT the tree — the one WeakMap divergence', () => {
			// MEASURED COST of object keying, pinned rather than argued. The id-keyed Map pruned
			// on the `removed` list the old fused `changed` carried, so re-asking with a dead
			// node built a fresh store;
			// a WeakMap keeps the entry as long as the caller keeps the node. Harmless here
			// because every caller (`Block`, `DragHandle`, `BlockMenu`, `DropIndicator` in
			// both adapters) passes a node straight out of `tokens.nodes()`, and the entry
			// collects with the node once the caller drops it.
			store.props.set({
				layout: 'block',
				draggable: true,
				Mark: () => null,
				options: [],
			})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('alpha\n\nbeta\n\n')

			const dead = store.tokens.nodes()[0]
			const deadStore = store.block.get(dead)

			store.block.action({type: 'delete', index: 0})

			expect(store.tokens.nodes()).not.toContain(dead)
			expect(store.block.get(dead)).toBe(deadStore)
		})
	})
})