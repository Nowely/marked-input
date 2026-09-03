import {afterEach, describe, expect, it, vi} from 'vitest'

import {watch} from '../../shared/signals'
import type {CoreOption} from '../../shared/types'
import {Store} from '../../store/Store'
import type {TreeNode} from '../tokens'
import {selectionRange} from '../tokens/__testing__/mountFixtures'

const rowProps: Parameters<Store['props']['set']>[0] = {
	separator: '\n\n',
	draggable: true,
	Mark: () => null,
	options: [],
}

/**
 * A mounted row document with one measurable div per row. The rows carry a real height because
 * the row controller hit-tests by RECT — where the per-row store it replaced learned its row
 * from DOM containment and needed no geometry at all.
 *
 * Rendered by hand rather than through `consignRendered`, which pairs a parent's element children
 * with its tokens and would file the row wrapper as its own text child's surface.
 */
const ROW_HEIGHT = 20
const NESTED_INDENT = 30

const mounted: Store[] = []

function mountRows(value: string, props: Parameters<Store['props']['set']>[0] = {}) {
	const store = new Store()
	mounted.push(store)
	store.props.set({...rowProps, ...props})
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
	return {store, controller: store.rows, container, rows}
}

/**
 * The same document painted NESTED — every row inside its parent, which is the shape both adapters
 * render and the one the hit test has to descend. Its own fixture rather than a flag on
 * {@link mountRows}: the flat one-div-per-root loop cannot express a box that contains another.
 *
 * A row's own LINE carries the height, on a block-level surface inside the wrapper, so a parent's
 * box is its line plus its children's — which is exactly the containment that costs the flat
 * search its sorted axis.
 */
function mountNestedRows(value: string, props: Parameters<Store['props']['set']>[0] = {}) {
	const store = new Store()
	mounted.push(store)
	store.props.set({...rowProps, separator: '\n', indent: '\t', ...props})
	const container = document.createElement('div')
	container.style.position = 'relative'
	document.body.append(container)
	store.host.container(container)
	store.tokens.setValue(value)

	const painted = new Map<number, HTMLElement>()
	const paint = (node: TreeNode, parent: HTMLElement, depth: number): void => {
		const row = document.createElement('div')
		// A real horizontal inset, so the layer has an indent unit to MEASURE. Deliberately not 24:
		// that is the width it assumes when there is no pair to read, and the two must be
		// distinguishable.
		if (depth > 0) row.style.marginLeft = `${NESTED_INDENT}px`
		parent.append(row)
		painted.set(node.id, row)
		store.tokens.consign(node.id)(row)
		if (node.kind !== 'row') return
		const surface = document.createElement('span')
		surface.style.display = 'block'
		surface.style.height = `${ROW_HEIGHT}px`
		row.append(surface)
		// `.at`, because `noUncheckedIndexedAccess` is off and a carved row has no inline child.
		const child = node.inline().at(0)
		if (child?.kind === 'text') {
			surface.textContent = child.text()
			store.tokens.consign(child.id)(surface)
		}
		// The child-rows host, filed WHETHER OR NOT the row has children — both adapters do, and it
		// is what says this kind paints the rows it is handed (`DomModel.nestingIsPainted`).
		const host = document.createElement('span')
		host.style.display = 'contents'
		row.append(host)
		store.tokens.children(node.id, 'rows')(host)
		for (const kid of node.rows()) paint(kid, host, depth + 1)
	}
	for (const node of store.tokens.nodes()) paint(node, container, 0)
	return {store, controller: store.rows, container, painted}
}

/**
 * The grip's own mousedown and `dragstart`, in that order — the whole press, which is what the
 * adapters wire and what the controller reads: `pinHover` freezes the hovered row AND takes the row
 * selection the drag is picking up, because by `dragstart` Chromium has already moved the text
 * selection the row selection is derived from.
 *
 * `dragstart` is also the only thing that tells an editor a later drop is ITS OWN row. Every drop
 * test goes through this: without one, `dragover` paints no edge at all.
 */
function startDrag({controller, store}: ReturnType<typeof mountRows>, index: number): number {
	const id = store.tokens.nodes()[index].id
	controller.pinHover()
	controller.beginDrag(id, new DragEvent('dragstart', {dataTransfer: new DataTransfer()}))
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
	dragOverAt(container, 0, edge === 'before' ? rect.top + 1 : rect.bottom - 1)
}

/** The pointer at an exact point: X chooses the DEPTH, so the depth cases need both coordinates. */
function dragOverAt(container: HTMLElement, clientX: number, clientY: number) {
	container.dispatchEvent(
		new DragEvent('dragover', {bubbles: true, cancelable: true, dataTransfer: new DataTransfer(), clientX, clientY})
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
		const {controller, container, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const ids = store.tokens.nodes().map(node => node.id)

		mouseMove(container, midOf(rows[1]))
		expect(controller.state.hovered()).toBe(ids[1])

		container.dispatchEvent(new MouseEvent('mouseleave', {clientY: 0}))
		expect(controller.state.hovered()).toBeNull()
	})

	it('snaps a point in the GAP between rows to the NEAREST row, not to the far side of it', () => {
		// DECLARED BEHAVIOUR CHANGE: hover was DOM containment, which showed nothing in a
		// margin gap. Geometric Y has to answer something, and the nearest row is the answer.
		//
		// The distances are deliberately LOPSIDED, and there are four rows: a binary search
		// that answers with its last probe rather than its closest one lands on row 2 here,
		// 36px away, while row 1 is 4px away — and a symmetric gap cannot tell the two apart.
		const {controller, container, rows, store} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const ids = store.tokens.nodes().map(node => node.id)
		expect(rows).toHaveLength(4)
		for (const row of rows) row.style.marginBottom = '40px'

		mouseMove(container, rows[1].getBoundingClientRect().bottom + 4)
		expect(controller.state.hovered()).toBe(ids[1])

		// Past the last row there is only one side, and it is still the nearest one.
		mouseMove(container, rows[3].getBoundingClientRect().bottom + 200)
		expect(controller.state.hovered()).toBe(ids[3])
	})

	/**
	 * THE DESCENT. A parent's box CONTAINS its children's, so a point inside a child is inside the
	 * parent too and the flat search would always answer the outermost row — every nested drag
	 * would then be a root drag. The row under the pointer is the DEEPEST one whose box holds it.
	 */
	it('answers the DEEPEST row whose box holds the point', () => {
		const {controller, painted, store} = mountNestedRows('alpha\n\tbeta\n\t\tgamma')
		const [root] = store.tokens.nodes()
		if (root.kind !== 'row') throw new Error('expected a row')
		const child = root.rows()[0]
		const grandchild = child.rows()[0]

		expect(controller.rowAt(midOf(painted.get(grandchild.id)!))?.id).toBe(grandchild.id)

		// The parent's own LINE is what is left over once no child claims the point: its first
		// 20px, above where its children start.
		const rootBox = painted.get(root.id)!.getBoundingClientRect()
		expect(controller.rowAt(rootBox.top + ROW_HEIGHT / 2)?.id).toBe(root.id)
	})

	/**
	 * THE NEAREST FALLBACK IS ROOT-ONLY, and the difference is what the gap between two children
	 * means: at the top it is nobody's, so the nearer row takes it, while inside a parent the
	 * leftover space IS the parent's own line.
	 */
	it('never answers a NEAREST child for a point its parent owns', () => {
		const {controller, painted, store} = mountNestedRows('alpha\n\tbeta\n\tgamma')
		const [root] = store.tokens.nodes()
		if (root.kind !== 'row') throw new Error('expected a row')
		const [first, second] = root.rows()
		painted.get(first.id)!.style.marginBottom = '40px'

		const gap = painted.get(first.id)!.getBoundingClientRect().bottom + 4
		expect(controller.rowAt(gap)?.id).toBe(root.id)
		expect(controller.rowAt(midOf(painted.get(second.id)!))?.id).toBe(second.id)
	})

	/**
	 * THE COLLAPSE HAZARD: a row the consumer hid is still in the tree and still bound, and it has
	 * no box at all. The search must not order by a coordinate that does not exist, and the descent
	 * must stop at the row that was collapsed — which is the row a drop should land beside.
	 */
	it('stops at a collapsed row, whose children have no box', () => {
		const {controller, painted, store} = mountNestedRows('alpha\n\tbeta\n\tgamma')
		const [root] = store.tokens.nodes()
		if (root.kind !== 'row') throw new Error('expected a row')
		for (const child of root.rows()) painted.get(child.id)!.hidden = true

		const rootBox = painted.get(root.id)!.getBoundingClientRect()
		expect(rootBox.height).toBe(ROW_HEIGHT)
		expect(controller.rowAt(midOf(painted.get(root.id)!))?.id).toBe(root.id)
	})

	/**
	 * PAST A ROOT'S BOX IS PAST ITS SUBTREE, so the answer is the subtree's last painted line and
	 * not the root whose box the point missed — a root's own line is at the TOP of that box.
	 */
	it('answers the last painted line of the subtree a point sits below', () => {
		const {controller, painted, store} = mountNestedRows('alpha\n\tbeta\n\t\tgamma')
		const [root] = store.tokens.nodes()
		if (root.kind !== 'row') throw new Error('expected a row')
		const grandchild = root.rows()[0].rows()[0]

		const below = painted.get(root.id)!.getBoundingClientRect().bottom + 30
		expect(controller.rowAt(below)?.id).toBe(grandchild.id)
		expect(controller.rowAt(below)?.depth).toBe(2)

		// A COLLAPSED level has no last painted line, so the walk stops at the row above it.
		painted.get(root.rows()[0].id)!.hidden = true
		expect(controller.rowAt(painted.get(root.id)!.getBoundingClientRect().bottom + 30)?.id).toBe(root.id)
	})

	/** And an unpainted row among painted SIBLINGS leaves the rest of the level searchable. */
	it('searches past an unpainted row rather than giving up on the level', () => {
		const {controller, painted, store} = mountNestedRows('alpha\nbeta\ngamma\ndelta')
		const ids = store.tokens.nodes().map(node => node.id)
		painted.get(ids[1])!.hidden = true

		expect(controller.rowAt(midOf(painted.get(ids[2])!))?.id).toBe(ids[2])
		expect(controller.rowAt(midOf(painted.get(ids[3])!))?.id).toBe(ids[3])
		expect(controller.rowAt(midOf(painted.get(ids[0])!))?.id).toBe(ids[0])
	})

	/**
	 * A CARVED row is a leaf to the hit test: its child rows are its own cells, a cell has no line
	 * of its own and no verb can address one, so pointing anywhere in a table line answers the LINE.
	 */
	it('answers a carved row rather than the cell under the pointer', () => {
		const cell: CoreOption = {row: {Component: 'td'}}
		const table: CoreOption = {
			markup: '|__slot__',
			row: {Component: 'tr', split: {at: ' | ', as: cell}},
		}
		const {controller, painted, store} = mountNestedRows('| a | b\nplain', {options: [table, cell]})
		const [line] = store.tokens.nodes()
		if (line.kind !== 'row') throw new Error('expected a row')

		for (const piece of line.rows()) {
			expect(controller.rowAt(midOf(painted.get(piece.id)!))?.id).toBe(line.id)
		}
	})

	it('hit-tests nothing where the document has no rows', () => {
		const {controller, container, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const y = midOf(rows[1])

		mouseMove(container, y)
		expect(controller.state.hovered()).toBe(store.tokens.nodes()[1].id)

		store.props.set({separator: null, options: []})
		mouseMove(container, y)

		expect(controller.rowAt(y)).toBeUndefined()
		expect(controller.state.hovered()).toBeNull()
	})
})

describe('the hover pin', () => {
	it('freezes the hovered row from the grip press, and heals on the first idle-button move', () => {
		// Without the pin the pointer travels a few px between mousedown and Chromium's
		// dragstart, the grip re-points at another row and walks out from under the cursor, and
		// no native drag event fires at all.
		const {controller, container, rows, store} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const ids = store.tokens.nodes().map(node => node.id)

		mouseMove(container, midOf(rows[0]))
		expect(controller.state.hovered()).toBe(ids[0])

		controller.pinHover()
		// The press is still down, so the pointer drifting onto another row changes nothing.
		mouseMove(container, midOf(rows[2]), 1)
		expect(controller.state.hovered()).toBe(ids[0])

		// The physical release happened outside the container — the pin attaches nothing to
		// hear about it, and expires on the next move with no button held.
		mouseMove(container, midOf(rows[2]))
		expect(controller.state.hovered()).toBe(ids[2])
	})

	it('is released by endDrag, where Chromium delivers no mouseup at all', () => {
		const {controller, container, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const ids = store.tokens.nodes().map(node => node.id)

		mouseMove(container, midOf(rows[0]))
		controller.pinHover()
		controller.endDrag()

		// Still "pressed" as far as the button state goes, and the hover moves anyway.
		mouseMove(container, midOf(rows[1]), 1)
		expect(controller.state.hovered()).toBe(ids[1])
	})
})

describe('geometry', () => {
	it('measures a row box in the CONTAINER-local space, unaffected by page scroll', () => {
		// Container-local coordinates are scroll-proof by construction, which is what lets the
		// layer paint at a box it measured a gesture ago.
		const {controller, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const ids = store.tokens.nodes().map(node => node.id)
		const before = controller.boxOf(ids[1])
		// `offsetTop` is measured from the offset parent's PADDING edge, which is exactly the
		// layer's origin — the container is `position: relative`, so it IS the offset parent.
		expect(before?.top).toBe(rows[1].offsetTop)

		const spacer = document.createElement('div')
		spacer.style.height = '2000px'
		document.body.prepend(spacer)
		window.scrollTo(0, 500)

		expect(controller.boxOf(ids[1])).toEqual(before)
		window.scrollTo(0, 0)
	})

	it('measures the same box when the CONTAINER itself scrolls', () => {
		// The `+ scrollTop` term of the transform, which the page-scroll case above cannot see:
		// the layer is `position: absolute` inside the container, so it scrolls WITH the rows,
		// and a box that did not carry the scroll offset would slide off its row by it.
		const {controller, container, store} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const ids = store.tokens.nodes().map(node => node.id)
		container.style.height = '30px'
		container.style.overflow = 'auto'
		const before = controller.boxOf(ids[2])

		container.scrollTop = 20
		expect(container.scrollTop).toBe(20)

		expect(controller.boxOf(ids[2])).toEqual(before)
	})

	it('re-measures on every commit, because a row that reflows moves the rows BELOW it', () => {
		// The container's own `ResizeObserver` is blind to this inside a fixed-height consumer
		// container: the rows move, the container does not, and the layer would keep painting
		// the grip at the box it measured before the edit.
		const {controller, store} = mountRows('alpha\n\nbeta\n\n')
		const before = controller.state.geometry()

		store.tokens.nodes()[0].duplicate()

		expect(controller.state.geometry()).toBeGreaterThan(before)
	})

	it('answers nothing for a row with no bound element', () => {
		const {controller} = mountRows('alpha\n\n')
		expect(controller.boxOf(9999)).toBeUndefined()
	})

	it('re-measures when a row ABOVE the painted one moves with no commit and no container resize', async () => {
		// The third clock. A fixed-height container does not resize when its rows move, the
		// painted row keeps its own SIZE so its observer stays silent, and no commit happened —
		// the two older clocks are both blind, and so is a mousemove that keeps hovering the
		// same row. Row 0 grows here the way an image, a webfont or an animation grows it.
		const {controller, container, rows} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		container.style.height = '30px'
		container.style.overflow = 'auto'
		mouseMove(container, midOf(rows[2]))
		// Settled first: the container's own observer delivers once for its initial size, and
		// again for the height set above, and neither of those is what this test is about.
		await severalFrames()
		const before = controller.state.geometry()

		rows[0].style.height = `${ROW_HEIGHT * 4}px`

		await expect.poll(() => controller.state.geometry()).toBeGreaterThan(before)
	})

	it('keeps still while the controls are painted and nothing moves', async () => {
		// The other half: the loop bumps the clock only when a box actually changed, so a
		// resting pointer costs frames and no re-render at all.
		const {controller, container, rows} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		mouseMove(container, midOf(rows[2]))
		await severalFrames()
		const before = controller.state.geometry()

		await severalFrames()

		expect(controller.state.geometry()).toBe(before)
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
		const {controller, rows, store} = mountRows('alpha\n\nbeta\n\n')
		controller.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())

		controller.addRow()

		expect(store.tokens.value()).toBe('alpha\n\n\n\nbeta\n\n')
		expect(selectionRange(store)).toEqual({start: 7, end: 7})
		expect(controller.state.menu()).toBeNull()
	})

	/**
	 * The row the menu was opened on decides the DEPTH, which is what the verb carries and a bare
	 * separator did not: a row added under a nested one used to open at depth 0 and cut the list
	 * in two — `'alpha\n\tbeta\ngamma'` became `'alpha\n\tbeta\n\ngamma'`.
	 */
	it('adds the row beside the NESTED row the menu belongs to', () => {
		const {controller, painted, store} = mountNestedRows('alpha\n\tbeta\ngamma')
		const alpha = store.tokens.nodes()[0]
		if (alpha.kind !== 'row') throw new Error('expected a row')
		const beta = alpha.rows()[0]
		controller.openMenu(beta.id, painted.get(beta.id)!.getBoundingClientRect())

		controller.addRow()

		expect(store.tokens.value()).toBe('alpha\n\tbeta\n\t\ngamma')
		expect(alpha.rows()).toHaveLength(2)
	})

	it('adds the first row to an empty document', () => {
		// An empty document already IS one empty row (issue 08), so there is always a row to
		// hang the insert on.
		const {controller, rows, store} = mountRows('')
		expect(store.tokens.nodes()).toHaveLength(1)
		controller.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())

		controller.addRow()

		expect(store.tokens.value()).toBe('\n\n')
		expect(store.tokens.nodes()).toHaveLength(2)
		expect(selectionRange(store)).toEqual({start: 2, end: 2})
	})

	it('deletes the row the menu belongs to, on the final unterminated row too', () => {
		// The final row owns no separator; its removal takes the PREVIOUS row's, so Delete
		// cannot merely convert it into the trailing empty row.
		const {controller, rows, store} = mountRows('alpha\n\nbeta')
		controller.openMenu(store.tokens.nodes()[1].id, rows[1].getBoundingClientRect())

		controller.deleteRow()

		expect(store.tokens.value()).toBe('alpha')
		expect(store.tokens.nodes()).toHaveLength(1)
	})

	it('duplicates the row the menu belongs to', () => {
		const {controller, rows, store} = mountRows('alpha\n\nbeta\n\n')
		controller.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())

		controller.duplicateRow()

		expect(store.tokens.value()).toBe('alpha\n\nalpha\n\nbeta\n\n')
	})

	it('runs the menu verbs with draggable:false — menu and keyboard row edits are not drag UI', () => {
		const {controller, rows, store} = mountRows('alpha\n\nbeta\n\n', {draggable: false})
		controller.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())

		controller.deleteRow()

		expect(store.tokens.value()).toBe('beta\n\n')
	})

	it('refuses the menu verbs once the document loses its rows, and closes the menu anyway', () => {
		// A row node cannot outlive its document's rows, so what refuses the write is the transaction
		// layer meeting a dead node; the model's own row check is the second belt. The menu
		// close is the half this pins alone — it runs on the refused branch.
		const {controller, rows, store} = mountRows('alpha\n\nbeta\n\n')
		controller.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())

		store.props.set({separator: null, draggable: false})
		controller.deleteRow()

		expect(store.tokens.value()).toBe('alpha\n\nbeta\n\n')
		expect(controller.state.menu()).toBeNull()
	})

	it('refuses a verb whose row has left the tree', () => {
		// The menu is addressed by ID, where the per-row store held the node itself and kept
		// answering for a dead one. An id that resolves to nothing is simply no row.
		const {controller, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const doomed = store.tokens.nodes()[0]
		controller.openMenu(doomed.id, rows[0].getBoundingClientRect())
		doomed.remove()

		controller.duplicateRow()

		expect(store.tokens.value()).toBe('beta\n\n')
	})

	it('closes on Escape and on a mousedown outside the menu, and on nothing inside it', () => {
		const {controller, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const menu = document.createElement('div')
		document.body.append(menu)
		controller.menuElement(menu)

		controller.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())
		menu.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
		expect(controller.state.menu()).not.toBeNull()

		document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
		expect(controller.state.menu()).toBeNull()

		controller.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())
		document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))
		expect(controller.state.menu()).toBeNull()
	})

	it('attaches its dismissal listeners only while a menu is open', () => {
		// The interaction-scoped shape `OverlayController` already ships: mounting an editor
		// attaches nothing (gated in `SelectionDriver.spec`), the interaction attaches, and the
		// close takes it back.
		const {controller, rows, store} = mountRows('alpha\n\nbeta\n\n')
		const menu = document.createElement('div')
		document.body.append(menu)
		controller.menuElement(menu)

		const addSpy = vi.spyOn(document, 'addEventListener')
		const removeSpy = vi.spyOn(document, 'removeEventListener')
		controller.openMenu(store.tokens.nodes()[0].id, rows[0].getBoundingClientRect())
		expect(addSpy.mock.calls.map(([type]) => type)).toEqual(['mousedown', 'keydown'])

		controller.closeMenu()
		expect(removeSpy.mock.calls.map(([type]) => type)).toEqual(['mousedown', 'keydown'])
		addSpy.mockRestore()
		removeSpy.mockRestore()
	})
})

describe('drag and drop', () => {
	it("carries the dragged row's own TEXT as the payload and marks the row dragging", () => {
		const {controller, store} = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const id = store.tokens.nodes()[2].id
		const dataTransfer = new DataTransfer()

		controller.pinHover()
		controller.beginDrag(id, new DragEvent('dragstart', {dataTransfer}))

		// The payload is what a drag OUT of this editor delivers, and nothing more: the drop
		// handler learns its source row from `state.dragging` instead of reading it back.
		expect(dataTransfer.getData('text/plain')).toBe('gamma')
		expect(controller.state.dragging()).toBe(id)
		controller.endDrag()
		expect(controller.state.dragging()).toBeNull()
	})

	it('resolves the gap the pointer is over into a PLACEMENT, and clears it when the drag leaves', () => {
		const mounted = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const {controller, container, rows} = mounted
		startDrag(mounted, 0)

		dragOver(container, rows[2], 'before')
		expect(controller.state.drop()?.placement).toEqual({parent: null, index: 1})

		dragOver(container, rows[2], 'after')
		expect(controller.state.drop()?.placement).toEqual({parent: null, index: 2})

		container.dispatchEvent(new DragEvent('dragleave', {bubbles: true, relatedTarget: document.body}))
		expect(controller.state.drop()).toBeNull()
	})

	/**
	 * WHAT IS PAINTED AND WHAT WILL HAPPEN ARE ONE FACT: the candidates a gap offers are planned by
	 * the mover, so the line stands exactly where the release will put the rows. At the gap a row
	 * ALREADY holds that is the place it is in — the drop resolves, the indicator says "here", and
	 * the release writes nothing.
	 */
	it('resolves a row’s own gap to the placement it already holds', () => {
		const mounted = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const {controller, container, rows, store} = mounted
		let committed = 0
		watch(store.tokens.committed, () => committed++)
		startDrag(mounted, 0)

		// One gap, named from either side: row 0's trailing edge and row 1's leading edge.
		dragOver(container, rows[0], 'after')
		expect(controller.state.drop()?.placement).toEqual({parent: null, index: 0})
		dragOver(container, rows[1], 'before')
		expect(controller.state.drop()?.placement).toEqual({parent: null, index: 0})

		dropOn(container)
		expect(committed).toBe(0)
		expect(store.tokens.value()).toBe('alpha\n\nbeta\n\ngamma\n\n')
	})

	it('moves the dragged row onto the drop slot', () => {
		const mounted = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const {controller, container, rows, store} = mounted

		startDrag(mounted, 0)
		dragOver(container, rows[1], 'after')
		dropOn(container)

		expect(store.tokens.value()).toBe('beta\n\nalpha\n\ngamma\n\n')
		expect(controller.state.drop()).toBeNull()
	})

	it('refuses a drop from a drag this editor never started, and does not claim the event', () => {
		// The defect this replaces: the handler parsed `text/plain` as an index and refused only
		// NaN, so the bare text `0` dragged in from ANY other application reordered the document.
		// `state.dragging` is what says a drag is ours, and no `dragover` of ours paints an edge
		// without one — so the drop falls through to the browser's own editable drop, where
		// `insertFromDrop` inserts the dragged text.
		const {controller, container, rows, store} = mountRows('First\n\nSecond\n\nThird')

		dragOver(container, rows[0], 'after')
		expect(controller.state.drop()).toBeNull()
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
		expect(b.controller.state.drop()).toBeNull()
		expect(event.defaultPrevented).toBe(false)
	})

	it('refuses a drop once the document loses its rows — both ends resolve through the LIVE tree', () => {
		// The one gate the menu verbs get for free from their own row: the re-parse mints new
		// ids, so neither the dragged row nor the drop edge's row is a root any more. Marks are
		// what makes an inline reorder visible — plain inline text is a single node.
		const options: CoreOption[] = [{markup: '@[__value__]'}]
		const mounted = mountRows('alpha @[x] tail\n\nbeta @[y] tail\n\n', {options})
		const {container, rows, store} = mounted

		startDrag(mounted, 0)
		dragOver(container, rows[1], 'after')
		store.props.set({...rowProps, options, separator: null})
		dropOn(container)

		expect(store.tokens.value()).toBe('alpha @[x] tail\n\nbeta @[y] tail\n\n')
	})

	it('leaves a drop it did not paint an edge for alone, so an INLINE editor still receives it', () => {
		// The listener is on the CONTAINER in every layout, where the per-row one existed only
		// on a row. Cancelling the event is how a handler claims the drop, so
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

	/**
	 * THE DROP DEPTH IS THE POINTER'S X, clamped to the depths the gap actually offers — and which
	 * those are is asked of the MOVER rather than restated here. The unit is MEASURED: the hit row
	 * is inset from the parent the descent came through by exactly one level of whatever the
	 * consumer paints, so nothing in core has to know a CSS rule.
	 */
	it('takes the deepest depth the pointer has reached, out of the ones the gap offers', () => {
		const mounted = mountNestedRows('alpha\n\tkid\nbeta\ngamma')
		const {controller, container, painted, store} = mounted
		const alpha = store.tokens.nodes()[0]
		if (alpha.kind !== 'row') throw new Error('expected a row')
		const kid = alpha.rows()[0]
		controller.pinHover()
		controller.beginDrag(store.tokens.nodes()[2].id, new DragEvent('dragstart', {dataTransfer: new DataTransfer()}))

		const kidBox = painted.get(kid.id)!.getBoundingClientRect()
		const y = kidBox.bottom - 1

		// Left of every candidate: the shallowest the gap offers — a root, after `alpha`.
		dragOverAt(container, 0, y)
		expect(controller.state.drop()?.placement).toEqual({parent: null, index: 1})

		// At the hit row's own left edge: its depth — `alpha`'s second child.
		dragOverAt(container, kidBox.left, y)
		expect(controller.state.drop()?.placement).toEqual({parent: alpha, index: 1})

		// One measured indent further right: one deeper, as the hit row's own first child.
		dragOverAt(container, kidBox.left + NESTED_INDENT, y)
		expect(controller.state.drop()?.placement).toEqual({parent: kid, index: 0})

		// And the painted line moves with it, which is what makes the indicator say the DEPTH.
		const deep = controller.state.drop()?.line
		dragOverAt(container, kidBox.left, y)
		expect(deep?.left).toBe((controller.state.drop()?.line.left ?? 0) + NESTED_INDENT)
	})

	/**
	 * THE INDENT UNIT IS MEASURED OFF THE ROW'S OWN CHILD when the hit came through no parent — the
	 * second of `#indentStep`'s two pairs, and the one a hit at depth 0 needs. Reached here through
	 * a gap whose ceiling is two levels deep, which is what gives the X more than one depth to
	 * choose between at depth 0.
	 */
	it('measures the indent off the hit row own child when the descent came through no parent', () => {
		const mounted = mountNestedRows('alpha\n\tkid\nbeta\n\tbkid\ngamma')
		const {controller, container, painted, store} = mounted
		const [alpha, beta] = store.tokens.nodes()
		if (alpha.kind !== 'row' || beta.kind !== 'row') throw new Error('expected rows')
		controller.pinHover()
		controller.beginDrag(store.tokens.nodes()[2].id, new DragEvent('dragstart', {dataTransfer: new DataTransfer()}))

		const betaBox = painted.get(beta.id)!.getBoundingClientRect()
		const y = betaBox.top + 1

		// Past the ASSUMED 24 but short of the 30 this document actually paints: still a root.
		dragOverAt(container, betaBox.left + 25, y)
		expect(controller.state.drop()?.placement).toEqual({parent: null, index: 1})

		// One MEASURED unit right: `alpha`'s second child, after `kid`.
		dragOverAt(container, betaBox.left + NESTED_INDENT, y)
		expect(controller.state.drop()?.placement).toEqual({parent: alpha, index: 1})
	})

	/**
	 * THE ASSUMED UNIT, and it is live rather than defensive: a FLAT document paints no parent and
	 * no child to measure against, so the only horizontal unit core owns is what decides whether
	 * the pointer is asking for depth 0 or depth 1 — the ordinary drag in the ordinary document.
	 */
	it('falls back to the assumed indent where the document paints nothing to measure', () => {
		const mounted = mountNestedRows('alpha\nbeta\ngamma')
		const {controller, container, painted, store} = mounted
		const [alpha] = store.tokens.nodes()
		if (alpha.kind !== 'row') throw new Error('expected a row')
		controller.pinHover()
		controller.beginDrag(store.tokens.nodes()[2].id, new DragEvent('dragstart', {dataTransfer: new DataTransfer()}))

		const box = painted.get(alpha.id)!.getBoundingClientRect()
		const y = box.bottom - 1

		dragOverAt(container, box.left + 23, y)
		expect(controller.state.drop()?.placement).toEqual({parent: null, index: 1})

		dragOverAt(container, box.left + 24, y)
		expect(controller.state.drop()?.placement).toEqual({parent: alpha, index: 0})
	})

	/**
	 * A CARVED ROW'S WHOLE BOX IS ITS LINE, because its children are its own body rather than rows
	 * under it. Read the way an ordinary parent is read, the first CELL's top ends the line and the
	 * gap before a table line becomes unreachable — every point in it is called "after".
	 */
	it('takes a carved row own box as its line, so both of its gaps stay reachable', () => {
		const cell: CoreOption = {row: {Component: 'td'}}
		const table: CoreOption = {markup: '|__slot__', row: {Component: 'tr', split: {at: ' | ', as: cell}}}
		const mounted = mountNestedRows('| a | b\nplain\ntail', {options: [table, cell]})
		const {controller, container, painted, store} = mounted
		const [line] = store.tokens.nodes()
		controller.pinHover()
		controller.beginDrag(store.tokens.nodes()[2].id, new DragEvent('dragstart', {dataTransfer: new DataTransfer()}))

		const box = painted.get(line.id)!.getBoundingClientRect()
		// Three stacked boxes — the line's own surface and its two cells — so the box middle is a
		// long way below where the first cell starts.
		expect(box.height).toBe(ROW_HEIGHT * 3)

		dragOverAt(container, 0, box.top + box.height / 2 - 1)
		expect(controller.state.drop()?.placement).toEqual({parent: null, index: 0})

		dragOverAt(container, 0, box.top + box.height / 2 + 1)
		expect(controller.state.drop()?.placement).toEqual({parent: null, index: 1})
	})

	/**
	 * THE RESOLVED DROP IS A VALUE, not the objects it was built from: `placement` and `line` are
	 * freshly constructed every `dragover` tick, so a shallow compare of the two nested references
	 * calls every tick a change and re-renders both adapters' control layers at pointer-move rate.
	 */
	it('reports no change for a tick that resolves to the same placement and line', () => {
		const mounted = mountRows('alpha\n\nbeta\n\ngamma\n\n')
		const {controller, container, rows} = mounted
		startDrag(mounted, 0)

		let ticks = 0
		watch(controller.state.drop, () => ticks++)
		const rect = rows[2].getBoundingClientRect()

		dragOverAt(container, 0, rect.top + 1)
		expect(ticks).toBe(1)
		dragOverAt(container, 0, rect.top + 2)
		expect(ticks).toBe(1)
	})

	/**
	 * THE EDGE IS READ OFF THE ROW'S OWN LINE, not its box, and nesting is what makes the two
	 * different: a parent's box covers its whole subtree, so its lower half is its CHILDREN. Read
	 * from the box, the lower half of a parent's own line is called the upper half of the parent
	 * and the drop lands above it instead of inside it.
	 */
	it("reads the edge off the row's own LINE rather than its subtree box", () => {
		const mounted = mountNestedRows('alpha\n\tkid\nbeta')
		const {controller, container, painted, store} = mounted
		const alpha = store.tokens.nodes()[0]
		if (alpha.kind !== 'row') throw new Error('expected a row')
		controller.pinHover()
		controller.beginDrag(store.tokens.nodes()[1].id, new DragEvent('dragstart', {dataTransfer: new DataTransfer()}))

		const box = painted.get(alpha.id)!.getBoundingClientRect()
		expect(box.height).toBe(ROW_HEIGHT * 2)

		dragOverAt(container, 0, box.top + ROW_HEIGHT - 1)
		expect(controller.state.drop()?.placement).toEqual({parent: alpha, index: 0})
	})

	/**
	 * A POINT BELOW THE WHOLE DOCUMENT names the gap after its LAST LINE, and a nested last root is
	 * what tells the two readings apart: answering the root there reads the edge off the root's own
	 * line, whose "after" is the slot its FIRST CHILD occupies — so the rows landed above the very
	 * children the pointer was below.
	 */
	it('drops below the document at the end of it, not inside the last root', () => {
		const mounted = mountNestedRows('beta\nalpha\n\tkid')
		const {controller, container, painted, store} = mounted
		const alpha = store.tokens.nodes()[1]
		if (alpha.kind !== 'row') throw new Error('expected a row')
		const kidBottom = painted.get(alpha.rows()[0].id)!.getBoundingClientRect().bottom

		controller.pinHover()
		controller.beginDrag(store.tokens.nodes()[0].id, new DragEvent('dragstart', {dataTransfer: new DataTransfer()}))
		dragOverAt(container, 0, kidBottom + 30)
		dropOn(container)

		expect(store.tokens.value()).toBe('alpha\n\tkid\nbeta')
	})

	/** And the X still chooses the depth down there, out of the depths that last line offers. */
	it('lets the pointer nest into the last line it is below', () => {
		const mounted = mountNestedRows('beta\nalpha\n\tkid')
		const {controller, container, painted, store} = mounted
		const alpha = store.tokens.nodes()[1]
		if (alpha.kind !== 'row') throw new Error('expected a row')
		const kidBox = painted.get(alpha.rows()[0].id)!.getBoundingClientRect()

		controller.pinHover()
		controller.beginDrag(store.tokens.nodes()[0].id, new DragEvent('dragstart', {dataTransfer: new DataTransfer()}))
		dragOverAt(container, kidBox.left, kidBox.bottom + 30)
		dropOn(container)

		expect(store.tokens.value()).toBe('alpha\n\tkid\n\tbeta')
	})

	/**
	 * A MULTI-ROW DRAG is one move of a set, not a move per row: two verbs cannot compose in
	 * controlled mode, and the rows land side by side wherever the set was picked up from.
	 */
	it('moves the whole ROW SELECTION when the gripped row is part of it', () => {
		const mounted = mountNestedRows('one\ntwo\nthree\nfour')
		const {controller, container, painted, store} = mounted
		const ids = store.tokens.nodes().map(node => node.id)
		// Rows `two` and `three`, whole — offsets 4..13 of 'one\ntwo\nthree\nfour'.
		store.tokens.selection.select(store.tokens.anchorAt(4), store.tokens.anchorAt(13))
		expect(controller.selected()).toEqual([ids[1], ids[2]])

		controller.pinHover()
		controller.beginDrag(ids[1], new DragEvent('dragstart', {dataTransfer: new DataTransfer()}))
		dragOver(container, painted.get(ids[3])!, 'after')
		dropOn(container)

		expect(store.tokens.value()).toBe('one\nfour\ntwo\nthree')
		// Every moved node kept its object: a set move that re-mints them emits the same bytes.
		expect(store.tokens.nodes().map(node => node.id)).toEqual([ids[0], ids[3], ids[1], ids[2]])
	})

	/** A grip taken on a row OUTSIDE the selection drags that row alone. */
	it('drags the gripped row alone when the selection does not hold it', () => {
		const mounted = mountNestedRows('one\ntwo\nthree\nfour')
		const {controller, container, painted, store} = mounted
		const ids = store.tokens.nodes().map(node => node.id)
		store.tokens.selection.select(store.tokens.anchorAt(4), store.tokens.anchorAt(13))

		controller.pinHover()
		controller.beginDrag(ids[0], new DragEvent('dragstart', {dataTransfer: new DataTransfer()}))
		dragOver(container, painted.get(ids[3])!, 'after')
		dropOn(container)

		expect(store.tokens.value()).toBe('two\nthree\nfour\none')
	})

	it('writes nothing when a row is dropped on its own trailing edge, and still CLAIMS the drop', () => {
		const mounted = mountRows('alpha\n\nbeta\n\n')
		const {container, rows, store} = mounted
		let committed = 0
		watch(store.tokens.committed, () => committed++)

		startDrag(mounted, 0)
		dragOver(container, rows[0], 'after')
		const event = dropOn(container)

		// The gap collapses onto the row's own place, which `movePlan` refuses — so nothing is
		// written. The event is claimed anyway: our OWN row falling through to the browser's
		// editable drop would insert the row's text into the document it is being dragged inside.
		expect(committed).toBe(0)
		expect(store.tokens.value()).toBe('alpha\n\nbeta\n\n')
		expect(event.defaultPrevented).toBe(true)
	})

	/**
	 * A DROP INTO A ROW'S OWN GAP CAN DECLINE. The gap a nested row already sits in offers its own
	 * depth like any other candidate, so the pointer resting at the row's own left edge means
	 * "leave it where it was" — and only an X that has reached ANOTHER depth's edge moves it.
	 * Before the mover told `'unchanged'` apart from a refusal, the identity candidate was dropped
	 * from the list and every horizontal position of this gap re-indented the row.
	 *
	 * Three X positions across the one gap: left of the document, at the row's own indent, and far
	 * to the right. Only the first is a depth the row is not already at.
	 */
	it('leaves the row where it was at its own depth, and outdents only left of it', () => {
		const outcomes = [0, NESTED_INDENT + 8, 400].map(clientX => {
			const {store, controller, container, painted} = mountNestedRows('alpha\n\tbeta\ngamma')
			const alpha = store.tokens.nodes()[0]
			if (alpha.kind !== 'row') throw new Error('expected a row')
			const beta = alpha.rows()[0]
			controller.pinHover()
			controller.beginDrag(beta.id, new DragEvent('dragstart', {dataTransfer: new DataTransfer()}))
			const own = painted.get(beta.id)!.getBoundingClientRect()
			dragOverAt(container, clientX, own.bottom - 1)
			dropOn(container)
			return store.tokens.value()
		})

		expect(outcomes).toEqual(['alpha\nbeta\ngamma', 'alpha\n\tbeta\ngamma', 'alpha\n\tbeta\ngamma'])
	})
})