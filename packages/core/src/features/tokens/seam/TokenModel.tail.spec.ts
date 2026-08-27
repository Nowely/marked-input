import {describe, expect, it} from 'vitest'

import type {CoreOption} from '../../../shared/types'
import {Store} from '../../../store/Store'
import {offsetOfAnchor} from '../tree/anchors'
import type {TreeNode} from '../tree/types'

/** A kind whose component is handed the row's text and paints none of it. */
const CARD: CoreOption = {markup: '@card __slot__', row: {Component: 'div'}}
/** A raw CLOSED body: `hasSlot` false and a closing literal, so its interior holds separators. */
const FENCE: CoreOption = {markup: '```__meta__\n__value__\n```', row: {Component: 'pre'}}

/** The invariant settles one microtask past the pulse — see `TokenModel.#afterFrame`. */
const settle = () => Promise.resolve()

/** Where the caret stands, as an offset into the value. */
const offsetOf = (store: Store): number | undefined => {
	const anchors = store.tokens.selection.anchors()
	return anchors && offsetOfAnchor(store.tokens.nodes(), anchors.anchor)
}

/**
 * The adapters' paint, with the ATOMIC kind's own text left unpainted, which is what an atomic
 * component does and what `DomModel.reachable` reads. Every row element is consigned, so
 * `rowPaint` answers `'painted'` for all of them.
 */
function mount(defaultValue: string, props: Parameters<Store['props']['set']>[0] = {}) {
	const store = new Store()
	store.props.set({defaultValue, separator: '\n', indent: '\t', options: [CARD, FENCE], Mark: () => null, ...props})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)
	const paint = (nodes: readonly TreeNode[], parent: HTMLElement): void => {
		for (const node of nodes) {
			const element = document.createElement('div')
			parent.append(element)
			store.tokens.consign(node.id)(element)
			store.tokens.children(node.id)(element)
			if (node.kind !== 'row') continue
			if (node.option() !== 0) {
				for (const child of node.inline()) {
					const surface = document.createElement('span')
					element.append(surface)
					store.tokens.consign(child.id)(surface)
				}
			}
			const host = document.createElement('span')
			element.append(host)
			store.tokens.children(node.id, 'rows')(host)
			paint(node.rows(), host)
		}
	}
	paint(store.tokens.nodes(), container)
	return {store, container}
}

/**
 * THE DOCUMENT MAY NOT END IN A ROW THE CARET CANNOT ENTER OR LEAVE — `TokenModel.#settleTail`.
 *
 * Two shapes, one rule. A RAW CLOSED body holds positions and no exit, because every Enter in it
 * is a line. An ATOMIC row holds no position at all, so the caret can never be inside it — which
 * is why the rule is asked of the document's LAST row rather than of the caret's own, and why
 * asking it of the caret's row could only ever answer the first shape.
 */
describe('the trailing row the caret invariant guarantees', () => {
	it('opens a row under a document-final ATOMIC row while a caret stands elsewhere', async () => {
		const {store, container} = mount('alpha\n@card panel')
		store.tokens.selection.select(store.tokens.anchorAt(0))

		await settle()

		expect(store.tokens.value()).toBe('alpha\n@card panel\n')
		container.remove()
	})

	/**
	 * AND FOR A ONE-ROW DOCUMENT, where the only gesture available is a click and a click on frozen
	 * presentation writes a ROW SELECTION rather than a caret. Held to a caret, the rule could never
	 * fire here at all: there is no position in the document to put one in.
	 */
	it('opens a row under a lone atomic row a click has merely selected', async () => {
		const {store, container} = mount('@card panel')
		const row = store.tokens.nodes()[0]
		store.tokens.selection.select({before: row}, {after: row})

		await settle()

		expect(store.tokens.value()).toBe('@card panel\n')
		container.remove()
	})

	it('opens a row under a document-final RAW CLOSED body', async () => {
		const {store, container} = mount('alpha\n```ts\nq\n```')
		store.tokens.selection.select(store.tokens.anchorAt(0))

		await settle()

		expect(store.tokens.value()).toBe('alpha\n```ts\nq\n```\n')
		container.remove()
	})

	/**
	 * A VALUE MERELY HANDED TO THE EDITOR IS NOT REWRITTEN, and that is the bound the whole rule is
	 * held to: the editor writes bytes no gesture asked for, so it writes them only once someone is
	 * in the document. `#settleRows` is gated the same way for the same reason.
	 */
	it('leaves a document nobody is standing in alone', async () => {
		const {store, container} = mount('alpha\n@card panel')

		await settle()

		expect(store.tokens.value()).toBe('alpha\n@card panel')
		container.remove()
	})

	it('adds nothing to a document that already ends in a row the caret can enter', async () => {
		const {store, container} = mount('@card panel\nalpha')
		store.tokens.selection.select(store.tokens.anchorAt(0))

		await settle()
		await settle()

		expect(store.tokens.value()).toBe('@card panel\nalpha')
		container.remove()
	})

	/** And it opens ONE door, not one per pulse: the row it grows is a row that needs none. */
	it('opens exactly one row however many times the invariant settles', async () => {
		const {store, container} = mount('alpha\n@card panel')
		store.tokens.selection.select(store.tokens.anchorAt(0))

		await settle()
		await settle()
		await settle()

		expect(store.tokens.value()).toBe('alpha\n@card panel\n')
		container.remove()
	})

	/**
	 * AND THE CARET GOES THROUGH THE DOOR when it was already past the row — `{after: row}`, which is
	 * what a person holds after typing a fence's closing literal, and the position the whole rule is
	 * about. Left to `#recoverCaret`, nothing places it: that walk stops on `'absent'` and the row
	 * opened here has no element yet, so the caret stayed at offset 13 — the end of the CODE — where
	 * the next Enter writes another line inside the fence. Asserted on the CARET rather than on the
	 * value, which is what a green suite could not tell.
	 */
	it('takes a caret already past the row through the door it opens', async () => {
		const {store, container} = mount('alpha\n```ts\nq\n```')
		const fence = store.tokens.nodes().at(-1)
		if (!fence) throw new Error('expected a fence row')
		store.tokens.selection.select({after: fence})

		await settle()

		expect(store.tokens.value()).toBe('alpha\n```ts\nq\n```\n')
		expect(offsetOf(store)).toBe(18)
		container.remove()
	})

	/** And a caret INSIDE the row stays there: a person who just picked **Code** keeps their fence. */
	it('leaves a caret inside the row where it is', async () => {
		const {store, container} = mount('alpha\n```ts\nq\n```')
		store.tokens.selection.select(store.tokens.anchorAt(12))

		await settle()

		expect(store.tokens.value()).toBe('alpha\n```ts\nq\n```\n')
		expect(offsetOf(store)).toBe(12)
		container.remove()
	})

	/**
	 * THE DOOR IS NOT A STEP OF THE USER'S. It is a repair, folded into the edit that provoked it —
	 * see `HistoryModel.spec`'s own case for the fence — so one undo takes back both.
	 */
	it('folds the row it opens into the edit that provoked it', async () => {
		const {store, container} = mount('alpha\n@card panel')
		const at = store.tokens.anchorAt(5)
		store.tokens.selection.select(at)

		store.edit.replace(at, at, 'X')
		await settle()
		expect(store.tokens.value()).toBe('alphaX\n@card panel\n')

		// ONE press takes the keystroke AND the door.
		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('alpha\n@card panel')
		container.remove()
	})
})