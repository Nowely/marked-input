import {afterEach, describe, expect, it, vi} from 'vitest'

import {watch} from '../../shared/signals'
import type {CoreOption} from '../../shared/types'
import {Store} from '../../store/Store'
import {selectionRange} from '../tokens/__testing__/mountFixtures'

const blockProps: Parameters<Store['props']['set']>[0] = {
	separator: '\n\n',
	draggable: true,
	Mark: () => null,
	options: [],
}

/**
 * A mounted block document with one measurable div per row. The rows carry a real height because
 * the block controller hit-tests by RECT — where the per-row store it replaced learned its row
 * from DOM containment and needed no geometry at all.
 *
 * Rendered by hand rather than through `consignRendered`, which pairs a parent's element children
 * with its tokens and would file the row wrapper as its own text child's surface.
 */
const ROW_HEIGHT = 20

const mounted: Store[] = []

function mountRows(value: string, props: Parameters<Store['props']['set']>[0] = {}) {
	const store = new Store()
	mounted.push(store)
	store.props.set({separator: null, ...blockProps, ...props})
	const container = document.createElement('div')
	container.style.position = 'relative'
	document.body.append(container)
	store.host.container(container)
	store.tokens.setValue(value)

	const rows: HTMLElement[] = []
	for (const node of store.tokens.nodes()) {
		const row = document.createElement('div')
		row.style.height = `${ROW_HEIGHT}px`
		const surface = document.createElement('span')
		row.append(surface)
		container.append(row)
		rows.push(row)
		store.tokens.consign(node.id)(row)
		const child = node.kind === 'row' ? node.children()[0] : undefined
		if (!child) continue
		// PAINTED, not just consigned: `beginDrag` hands the row's own text to the drag, so a
		// fixture whose rows render nothing cannot see what the payload carries.
		if (child.kind === 'text') surface.textContent = child.text()
		store.tokens.consign(child.id)(surface)
	}
	return {store, block: store.block, container, rows}
}

/**
 * The grip's own `dragstart`, and the only thing that tells an editor a later drop is ITS OWN
 * row. Every drop test goes through it: without one, `dragover` paints no edge at all.
 */
function startDrag({block, store}: ReturnType<typeof mountRows>, index: number): number {
	const id = store.tokens.nodes()[index].id
	block.beginDrag(id, new DragEvent('dragstart', {dataTransfer: new DataTransfer()}))
	return id
}

/** The pointer at a viewport Y inside the container, as a real mouse gesture. */
function mouseMove(container: HTMLElement, clientY: number, buttons = 0) {
	container.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, clientY, buttons}))
}

function midOf(row: HTMLElement): number {
	const rect = row.getBoundingClientRect()
	return rect.top + rect.height / 2
}

function dragOver(container: HTMLElement, row: HTMLElement, edge: 'before' | 'after') {
	const rect = row.getBoundingClientRect()
	container.dispatchEvent(
		new DragEvent('dragover', {
			bubbles: true,
			cancelable: true,
			dataTransfer: new DataTransfer(),
			clientY: edge === 'before' ? rect.top + 1 : rect.bottom - 1,
		})
	)
}

/** Returns the event, so a caller can ask whether the editor CLAIMED the drop. */
function dropOn(container: HTMLElement, payload = 'dropped text') {
	const dataTransfer = new DataTransfer()
	dataTransfer.setData('text/plain', payload)
	const event = new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer})
	container.dispatchEvent(event)
	return event
}

/** Long enough for the painted-row watcher to have run several frames, or to have run none. */
const severalFrames = () => new Promise(resolve => setTimeout(resolve, 100))

afterEach(() => {
	// Detaching the container disposes the mount scope, and the tests below count FRAMES:
	// emptying the body leaves every previous editor's mount effects — including the painted-row
	// loop — running against detached elements for the rest of the file.
	for (const store of mounted.splice(0)) store.host.container(null)
	document.body.replaceChildren()
})

describe('hover', () => {
	it('answers the row under the pointer, and clears it when the pointer leaves', () => {
		const {block, container, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const ids = store.tokens.nodes().map(node => node.id)

		mouseMove(container, midOf(rows[1]))
		expect(block.state.hovered()).toBe(ids[1])

		container.dispatchEvent(new MouseEvent('mouseleave', {clientY: 0}))
		expect(block.state.hovered()).toBeNull()
	})

	it('snaps a point in the GAP between rows to the NEAREST row, not to the far side of it', () => {
		// DECLARED BEHAVIOUR CHANGE: hover was DOM containment, which showed nothing in a
		// margin gap. Geometric Y has to answer something, and the nearest row is the answer.
		//
		// The distances are deliberately LOPSIDED, and there are four rows: a binary search
		// that answers with its last probe rather than its closest one lands on row 2 here,
		// 36px away, while row 1 is 4px away — and a symmetric gap cannot tell the two apart.
		const {block, container, rows, store} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const ids = store.tokens.nodes().map(node => node.id)
		expect(rows).toHaveLength(4)
		for (const row of rows) row.style.marginBottom = '40px'

		mouseMove(container, rows[1].getBoundingClientRect().bottom + 4)
		expect(block.state.hovered()).toBe(ids[1])

		// Past the last row there is only one side, and it is still the nearest one.
		mouseMove(container, rows[3].getBoundingClientRect().bottom + 200)
		expect(block.state.hovered()).toBe(ids[3])
	})

	it('hit-tests nothing outside block layout, which parses no rows', () => {
		const {block, container, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const y = midOf(rows[1])

		mouseMove(container, y)
		expect(block.state.hovered()).toBe(store.tokens.nodes()[1].id)

		store.props.set({separator: null, options: []})
		mouseMove(container, y)

		expect(block.rowAt(y)).toBeUndefined()
		expect(block.state.hovered()).toBeNull()
	})
})

describe('the hover pin', () => {
	it('freezes the hovered row from the grip press, and heals on the first idle-button move', () => {
		// Without the pin the pointer travels a few px between mousedown and Chromium's
		// dragstart, the grip re-points at another row and walks out from under the cursor, and
		// no native drag event fires at all.
		const {block, container, rows, store} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const ids = store.tokens.nodes().map(node => node.id)

		mouseMove(container, midOf(rows[0]))
		expect(block.state.hovered()).toBe(ids[0])

		block.pinHover()
		// The press is still down, so the pointer drifting onto another row changes nothing.
		mouseMove(container, midOf(rows[2]), 1)
		expect(block.state.hovered()).toBe(ids[0])

		// The physical release happened outside the container — the pin attaches nothing to
		// hear about it, and expires on the next move with no button held.
		mouseMove(container, midOf(rows[2]))
		expect(block.state.hovered()).toBe(ids[2])
	})

	it('is released by endDrag, where Chromium delivers no mouseup at all', () => {
		const {block, container, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const ids = store.tokens.nodes().map(node => node.id)

		mouseMove(container, midOf(rows[0]))
		block.pinHover()
		block.endDrag()

		// Still "pressed" as far as the button state goes, and the hover moves anyway.
		mouseMove(container, midOf(rows[1]), 1)
		expect(block.state.hovered()).toBe(ids[1])
	})
})

describe('geometry', () => {
	it('measures a row box in the CONTAINER-local space, unaffected by page scroll', () => {
		// Container-local coordinates are scroll-proof by construction, which is what lets the
		// layer paint at a box it measured a gesture ago.
		const {block, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const ids = store.tokens.nodes().map(node => node.id)
		const before = block.boxOf(ids[1])
		// `offsetTop` is measured from the offset parent's PADDING edge, which is exactly the
		// layer's origin — the container is `position: relative`, so it IS the offset parent.
		expect(before?.top).toBe(rows[1].offsetTop)

		const spacer = document.createElement('div')
		spacer.style.height = '2000px'
		document.body.prepend(spacer)
		window.scrollTo(0, 500)

		expect(block.boxOf(ids[1])).toEqual(before)
		window.scrollTo(0, 0)
	})

	it('measures the same box when the CONTAINER itself scrolls', () => {
		// The `+ scrollTop` term of the transform, which the page-scroll case above cannot see:
		// the layer is `position: absolute` inside the container, so it scrolls WITH the rows,
		// and a box that did not carry the scroll offset would slide off its row by it.
		const {block, container, store} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const ids = store.tokens.nodes().map(node => node.id)
		container.style.height = '30px'
		container.style.overflow = 'auto'
		const before = block.boxOf(ids[2])

		container.scrollTop = 20
		expect(container.scrollTop).toBe(20)

		expect(block.boxOf(ids[2])).toEqual(before)
	})

	it('re-measures on every commit, because a row that reflows moves the rows BELOW it', () => {
		// The container's own `ResizeObserver` is blind to this inside a fixed-height consumer
		// container: the rows move, the container does not, and the layer would keep painting
		// the grip at the box it measured before the edit.
		const {block, store} = mountRows('alpha\n\nbeta\n\n')
		const before = block.state.geometry()

		store.tokens.nodes()[0].duplicate()

		expect(block.state.geometry()).toBeGreaterThan(before)
	})

	it('answers nothing for a row with no bound element', () => {
		const {block} = mountRows('alpha\n\n')
		expect(block.boxOf(9999)).toBeUndefined()
	})

	it('re-measures when a row ABOVE the painted one moves with no commit and no container resize', async () => {
		// The third clock. A fixed-height container does not resize when its rows move, the
		// painted row keeps its own SIZE so its observer stays silent, and no commit happened —
		// the two older clocks are both blind, and so is a mousemove that keeps hovering the
		// same row. Row 0 grows here the way an image, a webfont or an animation grows it.
		const {block, container, rows} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		container.style.height = '30px'
		container.style.overflow = 'auto'
		mouseMove(container, midOf(rows[2]))
		// Settled first: the container's own observer delivers once for its initial size, and
		// again for the height set above, and neither of those is what this test is about.
		await severalFrames()
		const before = block.state.geometry()

		rows[0].style.height = `${ROW_HEIGHT * 4}px`

		await expect.poll(() => block.state.geometry()).toBeGreaterThan(before)
	})

	it('keeps still while the controls are painted and nothing moves', async () => {
		// The other half: the loop bumps the clock only when a box actually changed, so a
		// resting pointer costs frames and no re-render at all.
		const {block, container, rows} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		mouseMove(container, midOf(rows[2]))
		await severalFrames()
		const before = block.state.geometry()

		await severalFrames()

		expect(block.state.geometry()).toBe(before)
	})

	it('requests no frames at all while no controls are painted', async () => {
		// The requirement the loop has to keep: bounded by pointer presence, never a
		// page-lifetime stream per mounted editor. Counted in FRAMES and not in clock bumps —
		// a loop with nothing painted has nothing to compare, so it bumps the clock either way
		// and a geometry assertion here passes with the guard deleted.
		const frames = vi.spyOn(globalThis, 'requestAnimationFrame')
		try {
			const {container, rows} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
			await severalFrames()
			expect(frames).not.toHaveBeenCalled()

			mouseMove(container, midOf(rows[2]))
			await severalFrames()
			expect(frames.mock.calls.length).toBeGreaterThan(0)

			frames.mockClear()
			container.dispatchEvent(new MouseEvent('mouseleave', {clientY: 0}))
			await severalFrames()

			expect(frames).not.toHaveBeenCalled()
		} finally {
			frames.mockRestore()
		}
	})
})

describe('the row menu', () => {
	it('adds a row below the row the menu belongs to', () => {
		const {block, rows, store} = mountRows('alpha\n\nbeta\n\n')
		block.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())

		block.addRow()

		expect(store.tokens.value()).toBe('alpha\n\n\n\nbeta\n\n')
		expect(selectionRange(store)).toEqual({start: 7, end: 7})
		expect(block.state.menu()).toBeNull()
	})

	it('adds the first row to an empty document', () => {
		// An empty document already IS one empty row (issue 08), so there is always a row to
		// hang the insert on.
		const {block, rows, store} = mountRows('')
		expect(store.tokens.nodes()).toHaveLength(1)
		block.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())

		block.addRow()

		expect(store.tokens.value()).toBe('\n\n')
		expect(store.tokens.nodes()).toHaveLength(2)
		expect(selectionRange(store)).toEqual({start: 2, end: 2})
	})

	it('deletes the row the menu belongs to, on the final unterminated row too', () => {
		// The final row owns no separator; its removal takes the PREVIOUS row's, so Delete
		// cannot merely convert it into the trailing empty row.
		const {block, rows, store} = mountRows('alpha\n\nbeta')
		block.openMenu(store.tokens.nodes()[1].id, rows[1].getBoundingClientRect())

		block.deleteRow()

		expect(store.tokens.value()).toBe('alpha')
		expect(store.tokens.nodes()).toHaveLength(1)
	})

	it('duplicates the row the menu belongs to', () => {
		const {block, rows, store} = mountRows('alpha\n\nbeta\n\n')
		block.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())

		block.duplicateRow()

		expect(store.tokens.value()).toBe('alpha\n\nalpha\n\nbeta\n\n')
	})

	it('runs the menu verbs with draggable:false — menu and keyboard row edits are not drag UI', () => {
		const {block, rows, store} = mountRows('alpha\n\nbeta\n\n', {draggable: false})
		block.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())

		block.deleteRow()

		expect(store.tokens.value()).toBe('beta\n\n')
	})

	it('refuses the menu verbs once the layout leaves block, and closes the menu anyway', () => {
		// A row node cannot outlive block layout, so what refuses the write is the transaction
		// layer meeting a dead node; the model's own block check is the second belt. The menu
		// close is the half this pins alone — it runs on the refused branch.
		const {block, rows, store} = mountRows('alpha\n\nbeta\n\n')
		block.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())

		store.props.set({separator: null, draggable: false})
		block.deleteRow()

		expect(store.tokens.value()).toBe('alpha\n\nbeta\n\n')
		expect(block.state.menu()).toBeNull()
	})

	it('refuses a verb whose row has left the tree', () => {
		// The menu is addressed by ID, where the per-row store held the node itself and kept
		// answering for a dead one. An id that resolves to nothing is simply no row.
		const {block, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const doomed = store.tokens.nodes()[0]
		block.openMenu(doomed.id, rows[0].getBoundingClientRect())
		doomed.remove()

		block.duplicateRow()

		expect(store.tokens.value()).toBe('beta\n\n')
	})

	it('closes on Escape and on a mousedown outside the menu, and on nothing inside it', () => {
		const {block, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const menu = document.createElement('div')
		document.body.append(menu)
		block.menuElement(menu)

		block.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())
		menu.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
		expect(block.state.menu()).not.toBeNull()

		document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
		expect(block.state.menu()).toBeNull()

		block.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())
		document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))
		expect(block.state.menu()).toBeNull()
	})

	it('attaches its dismissal listeners only while a menu is open', () => {
		// The interaction-scoped shape `OverlayController` already ships: mounting an editor
		// attaches nothing (gated in `SelectionDriver.spec`), the interaction attaches, and the
		// close takes it back.
		const {block, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const menu = document.createElement('div')
		document.body.append(menu)
		block.menuElement(menu)

		const addSpy = vi.spyOn(document, 'addEventListener')
		const removeSpy = vi.spyOn(document, 'removeEventListener')
		block.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())
		expect(addSpy.mock.calls.map(([type]) => type)).toEqual(['mousedown', 'keydown'])

		block.closeMenu()
		expect(removeSpy.mock.calls.map(([type]) => type)).toEqual(['mousedown', 'keydown'])
		addSpy.mockRestore()
		removeSpy.mockRestore()
	})
})

describe('drag and drop', () => {
	it("carries the dragged row's own TEXT as the payload and marks the row dragging", () => {
		const {block, store} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const id = store.tokens.nodes()[2].id
		const dataTransfer = new DataTransfer()

		block.beginDrag(id, new DragEvent('dragstart', {dataTransfer}))

		// The payload is what a drag OUT of this editor delivers, and nothing more: the drop
		// handler learns its source row from `state.dragging` instead of reading it back.
		expect(dataTransfer.getData('text/plain')).toBe('gamma')
		expect(block.state.dragging()).toBe(id)
		block.endDrag()
		expect(block.state.dragging()).toBeNull()
	})

	it('names the row edge the pointer is over, and clears it when the drag leaves', () => {
		const mounted = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const {block, container, rows, store} = mounted
		const ids = store.tokens.nodes().map(node => node.id)
		startDrag(mounted, 0)

		dragOver(container, rows[1], 'before')
		expect(block.state.drop()).toEqual({id: ids[1], edge: 'before'})

		dragOver(container, rows[1], 'after')
		expect(block.state.drop()).toEqual({id: ids[1], edge: 'after'})

		container.dispatchEvent(new DragEvent('dragleave', {bubbles: true, relatedTarget: document.body}))
		expect(block.state.drop()).toBeNull()
	})

	it('moves the dragged row onto the drop slot', () => {
		const mounted = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const {block, container, rows, store} = mounted

		startDrag(mounted, 0)
		dragOver(container, rows[1], 'after')
		dropOn(container)

		expect(store.tokens.value()).toBe('beta\n\nalpha\n\ngamma\n\n')
		expect(block.state.drop()).toBeNull()
	})

	it('refuses a drop from a drag this editor never started, and does not claim the event', () => {
		// The defect this replaces: the handler parsed `text/plain` as an index and refused only
		// NaN, so the bare text `0` dragged in from ANY other application reordered the document.
		// `state.dragging` is what says a drag is ours, and no `dragover` of ours paints an edge
		// without one — so the drop falls through to the browser's own editable drop, where
		// `insertFromDrop` inserts the dragged text.
		const {block, container, rows, store} = mountRows('First\n\nSecond\n\nThird')

		dragOver(container, rows[0], 'after')
		expect(block.state.drop()).toBeNull()
		const event = dropOn(container, '0')

		expect(store.tokens.value()).toBe('First\n\nSecond\n\nThird')
		expect(event.defaultPrevented).toBe(false)
	})

	it("refuses a SECOND editor's row drag — the payload cannot tell two editors apart", () => {
		// Editor A's drag carries A's row; nothing in it names A. Each editor answers from its
		// OWN `state.dragging`, which is null in B for the whole of A's gesture.
		const a = mountRows('A1\n\nA2\n\nA3')
		const b = mountRows('B1\n\nB2\n\nB3')

		startDrag(a, 2)
		dragOver(b.container, b.rows[0], 'after')
		const event = dropOn(b.container, '2')

		expect(b.store.tokens.value()).toBe('B1\n\nB2\n\nB3')
		expect(b.block.state.drop()).toBeNull()
		expect(event.defaultPrevented).toBe(false)
	})

	it('refuses a drop once the layout leaves block — both ends resolve through the LIVE tree', () => {
		// The one gate the menu verbs get for free from their own row: the re-parse mints new
		// ids, so neither the dragged row nor the drop edge's row is a root any more. Marks are
		// what makes an inline reorder visible — plain inline text is a single node.
		const options: CoreOption[] = [{markup: '@[__value__]'}]
		const mounted = mountRows('alpha @[x] tail\n\nbeta @[y] tail\n\n', {options})
		const {container, rows, store} = mounted

		startDrag(mounted, 0)
		dragOver(container, rows[1], 'after')
		store.props.set({...blockProps, options, separator: null})
		dropOn(container)

		expect(store.tokens.value()).toBe('alpha @[x] tail\n\nbeta @[y] tail\n\n')
	})

	it('leaves a drop it did not paint an edge for alone, so an INLINE editor still receives it', () => {
		// The listener is on the CONTAINER in every layout, where the per-row one existed only
		// on a row in block layout. Cancelling the event is how a handler claims the drop, so
		// claiming one it refuses would suppress core's own `insertFromDrop` edit.
		const {container, store} = mountRows('alpha\n\nbeta\n\n')
		store.props.set({separator: null, options: []})

		const dataTransfer = new DataTransfer()
		dataTransfer.setData('text/plain', 'dropped text')
		const event = new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
	})

	it('refuses a drop once draggable is turned off MID-DRAG — reorder is drag-originated', () => {
		// The only way this guard is reached: the grip carries `draggable` too, so with it off
		// no `dragstart` fires and no drop edge is ever painted. `update` is a PATCH, so the
		// parse inputs are untouched and the row ids the drag is holding stay live.
		const mounted = mountRows('alpha\n\nbeta\n\n')
		const {container, rows, store} = mounted

		startDrag(mounted, 0)
		dragOver(container, rows[1], 'after')
		store.props.update({draggable: false})
		dropOn(container)

		expect(store.tokens.value()).toBe('alpha\n\nbeta\n\n')
	})

	it('writes nothing when a row is dropped on its own trailing edge', () => {
		const mounted = mountRows('alpha\n\nbeta\n\n')
		const {container, rows, store} = mounted
		let committed = 0
		watch(store.tokens.committed, () => committed++)

		startDrag(mounted, 0)
		dragOver(container, rows[0], 'after')
		dropOn(container)

		// The drop target names a SLOT BETWEEN rows, so this collapses onto `to === from`,
		// which `movePlan` refuses.
		expect(committed).toBe(0)
		expect(store.tokens.value()).toBe('alpha\n\nbeta\n\n')
	})
})