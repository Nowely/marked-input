import {describe, it, expect, beforeEach} from 'vitest'

import {watch} from '../../shared/signals'
import type {CoreOption} from '../../shared/types'
import {Store} from '../../store/Store'
import {anchorsAt, selectionRange} from '../tokens/__testing__/mountFixtures'

const blockProps: Parameters<Store['props']['set']>[0] = {
	layout: 'block',
	draggable: true,
	Mark: () => null,
	options: [],
}

/**
 * A bare container is enough: commits settle structurally and the live tree stays the
 * reconciled parse, so the row verbs resolve without a rendered DOM.
 */
function blockSetup(value: string, props: Parameters<Store['props']['set']>[0] = {}) {
	const store = new Store()
	store.props.set({...blockProps, ...props})
	store.host.container(document.createElement('div'))
	store.tokens.setValue(value)
	return store
}

/**
 * A real drop on a row's own container, which is the only way in: the handler is a DOM
 * listener `attachContainer` wires, and `source` reaches it as an untrusted `text/plain`
 * payload rather than as an argument. Split from the dispatch so a case can attach the
 * container and drop on it under DIFFERENT props.
 */
function dropOnRow(store: Store, rowIndex: number, payload: string) {
	const container = document.createElement('div')
	store.block.get(store.tokens.nodes()[rowIndex]).attachContainer(container)
	dropOn(container, payload)
}

function dropOn(container: HTMLElement, payload: string) {
	const dataTransfer = new DataTransfer()
	dataTransfer.setData('text/plain', payload)
	container.dispatchEvent(new DragEvent('drop', {cancelable: true, dataTransfer}))
}

describe('BlockStore row verbs', () => {
	it('adds a row below the row the menu belongs to', () => {
		const store = blockSetup('alpha\n\nbeta\n\n')

		store.block.get(store.tokens.nodes()[0]).addBlock()

		expect(store.tokens.value()).toBe('alpha\n\n\n\nbeta\n\n')
		expect(selectionRange(store)).toEqual({start: 7, end: 7})
	})

	it('adds the first row to an empty document', () => {
		const store = blockSetup('')

		// An empty document already IS one empty row (issue 08), so there is always a row to
		// hang the insert on — the composed "add with no anchor" arm the index-addressed
		// protocol needed has nothing left to answer.
		expect(store.tokens.nodes()).toHaveLength(1)
		store.block.get(store.tokens.nodes()[0]).addBlock()

		expect(store.tokens.value()).toBe('\n\n')
		expect(store.tokens.nodes()).toHaveLength(2)
		expect(selectionRange(store)).toEqual({start: 2, end: 2})
	})

	it('deletes the row the menu belongs to, on the final unterminated row too', () => {
		// The final row owns no separator; its removal takes the PREVIOUS row's, so Delete
		// cannot merely convert it into the trailing empty row.
		const store = blockSetup('alpha\n\nbeta')

		store.block.get(store.tokens.nodes()[1]).deleteBlock()

		expect(store.tokens.value()).toBe('alpha')
		expect(store.tokens.nodes()).toHaveLength(1)
	})

	it('duplicates the row the menu belongs to', () => {
		const store = blockSetup('alpha\n\nbeta\n\n')

		store.block.get(store.tokens.nodes()[0]).duplicateBlock()

		expect(store.tokens.value()).toBe('alpha\n\nalpha\n\nbeta\n\n')
	})

	it('closes the menu after a verb that applies', () => {
		const store = blockSetup('alpha\n\nbeta\n\n')
		const first = store.block.get(store.tokens.nodes()[0])
		first.state.menuOpen(true)

		first.duplicateBlock()

		expect(store.tokens.value()).toBe('alpha\n\nalpha\n\nbeta\n\n')
		expect(first.state.menuOpen()).toBe(false)
	})

	it('runs the menu verbs with draggable:false — menu and keyboard row edits are not drag UI', () => {
		const store = blockSetup('alpha\n\nbeta\n\n', {draggable: false})

		store.block.get(store.tokens.nodes()[0]).deleteBlock()

		expect(store.tokens.value()).toBe('beta\n\n')
	})

	it('refuses the menu verbs once the layout leaves block, and closes the menu anyway', () => {
		// A row node cannot outlive block layout, so what refuses the write here is the
		// transaction layer meeting a dead node; the store's own block check is the second
		// belt. The menu close is the half this pins alone — it runs on the refused branch.
		const store = blockSetup('alpha\n\nbeta\n\n')
		const first = store.block.get(store.tokens.nodes()[0])
		first.state.menuOpen(true)

		store.props.set({layout: 'inline', draggable: false})
		first.deleteBlock()

		expect(store.tokens.value()).toBe('alpha\n\nbeta\n\n')
		expect(first.state.menuOpen()).toBe(false)
	})
})

describe('the row drop handler', () => {
	it('moves the dragged row onto the drop slot', () => {
		const store = blockSetup('alpha\n\nbeta\n\ngamma\n\n')

		// No preceding `dragover`, so `dropPosition` is its own default: after row 1.
		dropOnRow(store, 1, '0')

		expect(store.tokens.value()).toBe('beta\n\nalpha\n\ngamma\n\n')
	})

	it('refuses a NEGATIVE source index instead of wrapping onto the last row', () => {
		// The payload carries no provenance, so any external drag reaches this handler with
		// any text at all. `Array.prototype.at` WRAPS: unguarded, `at(-1)` addresses the LAST
		// row and moves it to the top.
		const store = blockSetup('First\n\nSecond\n\nThird')
		const before = store.tokens.nodes().map(node => node.id)

		dropOnRow(store, 0, '-1')

		expect(store.tokens.value()).toBe('First\n\nSecond\n\nThird')
		expect(store.tokens.nodes().map(node => node.id)).toEqual(before)
	})

	it('refuses a payload that names no index at all', () => {
		const store = blockSetup('First\n\nSecond\n\nThird')

		dropOnRow(store, 0, 'not an index')

		expect(store.tokens.value()).toBe('First\n\nSecond\n\nThird')
	})

	it('refuses a drop once the layout leaves block — the move addresses whatever nodes() holds', () => {
		// The one gate the menu verbs do NOT get for free from their own node: the move reads
		// `nodes().at(source)` live, so in inline layout it finds the INLINE nodes and reorders
		// those. Marks are what makes that visible — plain inline text is a single node.
		const options: CoreOption[] = [{markup: '@[__value__]'}]
		const store = blockSetup('alpha @[x] tail\n\nbeta @[y] tail\n\n', {options})
		const container = document.createElement('div')
		store.block.get(store.tokens.nodes()[1]).attachContainer(container)

		store.props.set({...blockProps, options, layout: 'inline'})
		dropOn(container, '2')

		expect(store.tokens.value()).toBe('alpha @[x] tail\n\nbeta @[y] tail\n\n')
	})

	it('refuses a drop with draggable:false — reorder is drag-originated', () => {
		const store = blockSetup('alpha\n\nbeta\n\n', {draggable: false})

		dropOnRow(store, 1, '0')

		expect(store.tokens.value()).toBe('alpha\n\nbeta\n\n')
	})

	it('writes nothing when a row is dropped on its own trailing edge', () => {
		const store = blockSetup('alpha\n\nbeta\n\n')
		let committed = 0
		watch(store.tokens.committed, () => committed++)

		dropOnRow(store, 0, '0')

		// The drop target names a SLOT BETWEEN rows, so this collapses onto `to === from`,
		// which `movePlan` refuses.
		expect(committed).toBe(0)
		expect(store.tokens.value()).toBe('alpha\n\nbeta\n\n')
	})
})

describe('per-row stores (identity-keyed)', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
	})

	it('keeps a row store, and its state, across an operation on another row', () => {
		// The CONSEQUENCE-level gate for row identity: the id assertions in `markNode.spec`
		// say which node survived, this says what that costs a user. Before the row verbs,
		// deleting the first of two byte-identical rows retained the WRONG node, so the store
		// below was reset and the open menu closed itself on an unrelated row's deletion.
		// Kept on the mounted fixture even though the store no longer rides the announcement:
		// the bind is what an adapter actually does between the two reads.
		store.props.set(blockProps)
		const container = document.createElement('div')
		document.body.append(container)
		store.host.container(container)
		store.tokens.setValue('First\n\nFirst\n\nSecond\n\n')

		const survivor = store.block.get(store.tokens.nodes()[1])
		survivor.state.menuOpen(true)
		survivor.state.isHovered(true)

		store.tokens.nodes()[0].remove()

		expect(store.block.get(store.tokens.nodes()[0])).toBe(survivor)
		expect(survivor.state.menuOpen()).toBe(true)
		expect(survivor.state.isHovered()).toBe(true)
		document.body.replaceChildren()
	})

	it('carries a row store AND its state to the new index on reorder', () => {
		store.props.set(blockProps)
		const container = document.createElement('div')
		document.body.append(container)
		store.host.container(container)
		store.tokens.setValue('First\n\nFirst\n\nSecond\n\n')

		const dragged = store.block.get(store.tokens.nodes()[0])
		dragged.state.isDragging(true)

		// The document is UNCHANGED, because the two moved-past rows are byte-identical — so
		// the store is the only evidence the move happened at all.
		expect(store.tokens.nodes()[0].moveTo(1)).toBe(true)

		expect(store.tokens.value()).toBe('First\n\nFirst\n\nSecond\n\n')
		expect(store.block.get(store.tokens.nodes()[1])).toBe(dragged)
		expect(dragged.state.isDragging()).toBe(true)
		document.body.replaceChildren()
	})

	it('keeps a row store across an edit above it with NOTHING mounted', () => {
		// The object key needs no announcement, so this holds with no container and no
		// re-bind — the id-keyed Map's prune rode the id lists the old fused delta carried,
		// whose removals only ever came from a bind, so an unmounted input could hand a row a
		// store and never shed it. Both clocks are payload-free now, so there is no removal
		// list left to ride even where one binds.
		store.props.set(blockProps)
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
		// An index is not an identity, so the row that slides into slot 0 must not inherit the
		// deleted row's open menu.
		store.props.set(blockProps)
		store.host.container(document.createElement('div'))
		store.tokens.setValue('alpha\n\nbeta\n\n')

		const first = store.tokens.nodes()[0]
		const firstStore = store.block.get(first)
		firstStore.state.menuOpen(true)

		firstStore.deleteBlock()

		const survivor = store.tokens.nodes()[0]
		expect(survivor).not.toBe(first)
		expect(store.block.get(survivor)).not.toBe(firstStore)
		expect(store.block.get(survivor).state.menuOpen()).toBe(false)
	})

	it('still answers for a node that has LEFT the tree — the one WeakMap divergence', () => {
		// MEASURED COST of object keying, pinned rather than argued. The id-keyed Map pruned
		// on the `removed` list the old fused `changed` carried, so re-asking with a dead
		// node built a fresh store; a WeakMap keeps the entry as long as the caller keeps the
		// node. Harmless here because every caller (`Block`, `DragHandle`, `BlockMenu`,
		// `DropIndicator` in both adapters) passes a node straight out of `tokens.nodes()`,
		// and the entry collects with the node once the caller drops it.
		store.props.set(blockProps)
		store.host.container(document.createElement('div'))
		store.tokens.setValue('alpha\n\nbeta\n\n')

		const dead = store.tokens.nodes()[0]
		const deadStore = store.block.get(dead)

		dead.remove()

		expect(store.tokens.nodes()).not.toContain(dead)
		expect(store.block.get(dead)).toBe(deadStore)
	})
})