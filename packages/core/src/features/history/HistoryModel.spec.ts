import {describe, expect, it, vi} from 'vitest'

import type {CoreOption} from '../../shared/types'
import {Store} from '../../store/Store'
import type {NodeAnchor, RowNode} from '../tokens'
import {anchorsAt, caretAt, selectionRange} from '../tokens/__testing__/mountFixtures'

/**
 * THE PROVING SUITE FOR THE UNDO STACK, and every case here is stated in BOTH value modes or is
 * about one of them on purpose. Controlled mode is the point: it is the mode the whole seam is
 * built around, and the one where an edit's pre-image exists for exactly the length of a commit.
 *
 * The parent is spelled out per case rather than hidden in a fixture, because WHAT THE PARENT DOES
 * WITH THE EMISSION is the subject of half of them.
 */

/** A mounted editor whose parent echoes faithfully, or none at all when uncontrolled. */
function mount(value: string, props: Parameters<Store['props']['set']>[0] = {}): Store {
	const store = new Store()
	store.props.set({defaultValue: value, separator: null, options: [], ...props})
	store.host.container(document.createElement('div'))
	return store
}

function mountControlled(value: string, parent: (store: Store, emitted: string) => void): Store {
	const store = new Store()
	store.props.set({
		value,
		separator: null,
		options: [],
		onChange: emitted => parent(store, emitted),
	})
	store.host.container(document.createElement('div'))
	return store
}

const echoes = (store: Store, emitted: string): void => store.props.update({value: emitted})

/** One keystroke: the caret goes where the user is, and the character is spliced there. */
function type(store: Store, offset: number, character: string): void {
	caretAt(store, offset)
	store.edit.replace(...anchorsAt(store, offset, offset), character)
}

const rowsOf = (store: Store): RowNode[] => store.tokens.nodes().filter((node): node is RowNode => node.kind === 'row')

const rowTexts = (store: Store): string[] => rowsOf(store).map(row => row.slot())

/** A row kind the slash menu can name — the shape `OverlayController.menu.spec` drives. */
const HEADING: CoreOption = {markup: '# __slot__', row: {Component: 'h1'}, menu: {label: 'Heading 1'}}

/**
 * Does the stored selection name nodes the tree STILL HOLDS? The oracle offsets cannot give: a
 * node adoption dropped keeps the `position` it died with, so every numeric reading of a caret
 * anchored in it answers correctly while `handle()` — and therefore `placeCaret` — declines.
 */
function namesLiveNodes(store: Store): boolean {
	const anchors = store.tokens.selection.anchors()
	if (!anchors) return false
	const held = (anchor: NodeAnchor): boolean => {
		if (typeof anchor === 'string') return true // a document edge names no node
		const node = 'node' in anchor ? anchor.node : 'before' in anchor ? anchor.before : anchor.after
		return store.tokens.find(node.id) === node
	}
	return held(anchors.anchor) && held(anchors.head)
}

describe('history: undo and redo', () => {
	for (const mode of ['uncontrolled', 'controlled'] as const) {
		const open = (value: string): Store => (mode === 'controlled' ? mountControlled(value, echoes) : mount(value))

		it(`restores the value AND the caret the edit was made from (${mode})`, () => {
			const store = open('hello')
			type(store, 2, 'X')
			expect(store.tokens.value()).toBe('heXllo')
			expect(selectionRange(store)).toEqual({start: 3, end: 3})

			// The user carries on somewhere else before undoing. This is what separates a caret
			// RESTORED from a caret MAPPED: mapping the live caret through the inverted window
			// answers 5 here, and the position the edit was made from is 2.
			caretAt(store, 6)

			expect(store.history.undo()).toBe(true)
			expect(store.tokens.value()).toBe('hello')
			expect(selectionRange(store)).toEqual({start: 2, end: 2})

			expect(store.history.redo()).toBe(true)
			expect(store.tokens.value()).toBe('heXllo')
			expect(selectionRange(store)).toEqual({start: 3, end: 3})
		})

		it(`discards the redo branch once a fresh edit lands (${mode})`, () => {
			const store = open('hello')
			type(store, 5, '!')
			expect(store.history.undo()).toBe(true)
			expect(store.history.canRedo()).toBe(true)

			type(store, 0, '?')
			expect(store.tokens.value()).toBe('?hello')
			expect(store.history.canRedo()).toBe(false)
			expect(store.history.redo()).toBe(false)
			expect(store.tokens.value()).toBe('?hello')
		})

		it(`does not bring an abandoned branch back when the document returns to its base (${mode})`, () => {
			// What DISCARDING the branch buys over merely finding it unusable: the value coming
			// back to where the abandoned entry starts must not make it live again.
			const store = open('hello')
			type(store, 5, '!')
			expect(store.history.undo()).toBe(true)

			type(store, 5, 'X') // a different future; the '!' branch is gone
			caretAt(store, 6)
			store.edit.replace(...anchorsAt(store, 5, 6), '') // and back to 'hello' by editing, not undoing

			expect(store.tokens.value()).toBe('hello')
			expect(store.history.canRedo()).toBe(false)
			expect(store.history.redo()).toBe(false)
			expect(store.tokens.value()).toBe('hello')
		})

		it(`answers false, and writes nothing, with an empty stack (${mode})`, () => {
			const store = open('hello')
			expect(store.history.canUndo()).toBe(false)
			expect(store.history.undo()).toBe(false)
			expect(store.history.canRedo()).toBe(false)
			expect(store.history.redo()).toBe(false)
			expect(store.tokens.value()).toBe('hello')
		})
	}
})

describe('history: what is one step', () => {
	it('coalesces a typing run into one entry, and gives a structural verb its own', () => {
		const store = mount('one\ntwo', {separator: '\n'})
		type(store, 3, 'X')
		type(store, 4, 'Y')
		expect(store.tokens.value()).toBe('oneXY\ntwo')

		const duplicated = rowsOf(store)[0].duplicate()
		expect(duplicated).toBe(true)
		expect(rowTexts(store)).toEqual(['oneXY', 'oneXY', 'two'])

		// The verb first, alone: it is not a keystroke, so nothing merged it into the run above.
		expect(store.history.undo()).toBe(true)
		expect(rowTexts(store)).toEqual(['oneXY', 'two'])

		// Then BOTH characters at once — one entry for the run.
		expect(store.history.undo()).toBe(true)
		expect(rowTexts(store)).toEqual(['one', 'two'])
		expect(store.history.canUndo()).toBe(false)
	})

	it('makes a slash-menu turn-into ONE step, the trigger and the kind together', () => {
		// The gesture the user made is "pick a kind", and it must cost ONE undo however many
		// things the splice changed — the trigger comes back and the kind goes, together. It is
		// one entry because it is one splice, which is what `turnInto` taking the body text buys.
		const store = mount('plain row', {
			separator: '\n',
			Mark: () => null,
			options: [{overlay: {trigger: '/'}}, HEADING],
		})
		caretAt(store, 9)
		store.edit.replace(...anchorsAt(store, 9, 9), '/')
		expect(store.overlay.choose({option: HEADING})).toBe(true)
		expect(store.tokens.value()).toBe('# plain row')

		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('plain row/')

		// And the trigger keystroke is its own step, as any other typed character is.
		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('plain row')
	})

	it('keeps a paste out of the typing run it lands in the middle of', () => {
		// One gesture, one entry, however many characters it carries — and the character typed
		// right before it does not join it just because the two are adjacent.
		const store = mount('hello')
		type(store, 5, 'X')
		caretAt(store, 6)
		store.edit.replace(...anchorsAt(store, 6, 6), 'YZ')
		expect(store.tokens.value()).toBe('helloXYZ')

		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('helloX')
		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('hello')
	})

	it('closes the run on a pause, and does not reopen it across an undo', () => {
		vi.useFakeTimers()
		try {
			const store = mount('hello')
			type(store, 5, 'A')
			vi.advanceTimersByTime(600) // long enough that the next character is its own entry
			type(store, 6, 'B')
			expect(store.tokens.value()).toBe('helloAB')

			expect(store.history.undo()).toBe(true)
			expect(store.tokens.value()).toBe('helloA')

			// Typed straight after the undo, at exactly where the earlier entry left off: the run
			// it would join belongs to a document the user has just stepped back out of.
			type(store, 6, 'C')
			expect(store.tokens.value()).toBe('helloAC')
			expect(store.history.undo()).toBe(true)
			expect(store.tokens.value()).toBe('helloA')
		} finally {
			vi.useRealTimers()
		}
	})

	it('does not merge across a value the editor did not write', () => {
		// A change from outside — another author, a parent's own sanitising pass — that keeps the
		// length leaves the next keystroke sitting exactly where the run left off. Merging there
		// would build an entry claiming a base from before that change, and undoing it would
		// silently throw the change away.
		const store = mountControlled('hello', echoes)
		type(store, 5, 'X')
		store.props.update({value: 'aelloX'})
		type(store, 6, 'Y')
		expect(store.tokens.value()).toBe('aelloXY')

		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('aelloX')
	})

	it('does not merge two characters typed at unrelated places', () => {
		const store = mount('hello')
		type(store, 0, 'A')
		type(store, 5, 'B')
		expect(store.tokens.value()).toBe('AhellBo')

		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('Ahello')
		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('hello')
	})
})

describe('history: identity', () => {
	it('gives every row back its OWN id when it undoes a move', () => {
		// A `setValue`-shaped undo restores the same string and re-pairs the rows BY INDEX:
		// measured on this exact document, the row reading 'a' afterwards is the node that used
		// to be 'b', so every consumer keyed by row id — drag state, block selection, a collapse
		// flag — lands on the wrong row.
		//
		// A ROTATION, not a swap, and that is not decoration: a transposition is its own inverse,
		// so reading the recorded pairing FORWARDS passes a swap case and this one reddens it.
		const store = mount('a\nb\nc', {separator: '\n'})
		const [first, second, third] = rowsOf(store)
		expect(rowTexts(store)).toEqual(['a', 'b', 'c'])

		expect(first.moveTo({parent: null, index: 2})).toBe(true)
		expect(rowTexts(store)).toEqual(['b', 'c', 'a'])
		expect(rowsOf(store)).toEqual([second, third, first])

		expect(store.history.undo()).toBe(true)
		expect(rowTexts(store)).toEqual(['a', 'b', 'c'])
		expect(rowsOf(store)).toEqual([first, second, third])
	})

	it('restores a caret into the document it rebuilt, not into the nodes the edit destroyed', () => {
		// A selection spanning a mark: undoing the delete brings the mark back as a NEW node, and
		// the text it was cut out of with it. A caret kept as anchors names the dead ones — right
		// offset, no handle, and the browser caret does not move.
		const store = mount('he@[x]llo', {options: [{markup: '@[__value__]'}], Mark: () => null})
		store.tokens.selection.select(store.tokens.anchorAt(7), store.tokens.anchorAt(1))
		store.edit.replace(...anchorsAt(store, 1, 7), '')
		expect(store.tokens.value()).toBe('hlo')

		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('he@[x]llo')
		expect(selectionRange(store)).toEqual({start: 1, end: 7})
		expect(namesLiveNodes(store)).toBe(true)
	})

	it('restores a caret the row merge it undoes had swallowed', () => {
		// The everyday shape of the same defect: Backspace at the start of a row merges it away,
		// so BOTH ends of the caret sit in a row the undo cannot bring back as the same object.
		const store = mount('one\ntwo', {separator: '\n'})
		caretAt(store, 4)
		const span = store.tokens.boundarySpan(store.tokens.anchorAt(4), -1)
		expect(span).toBeDefined()
		store.edit.replace(span!.anchor, span!.head, '')
		expect(store.tokens.value()).toBe('onetwo')

		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('one\ntwo')
		expect(selectionRange(store)).toEqual({start: 4, end: 4})
		expect(namesLiveNodes(store)).toBe(true)
	})

	it('keeps the mark it restores, rather than minting a new one', () => {
		const store = mount('he@[x]llo', {options: [{markup: '@[__value__]'}], Mark: () => null})
		const mark = store.tokens.nodes()[1]
		type(store, 9, '!')
		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('he@[x]llo')
		expect(store.tokens.nodes()[1]).toBe(mark)
	})
})

describe('history: a parent that does not echo', () => {
	it('records nothing when the parent refuses the emission', () => {
		const store = mountControlled('hello', () => {})
		type(store, 5, '!')

		expect(store.tokens.value()).toBe('hello') // the parent owns the value; it declined
		expect(store.history.canUndo()).toBe(false)
		expect(store.history.undo()).toBe(false)
		expect(store.tokens.value()).toBe('hello')
	})

	it('records nothing when the parent transforms the value on the way back', () => {
		const store = mountControlled('hello', (self, emitted) => self.props.update({value: emitted.toUpperCase()}))
		type(store, 5, '!')

		expect(store.tokens.value()).toBe('HELLO!')
		// An entry here would name 'hello!' — a document that never existed — and replay a window
		// in its coordinates.
		expect(store.history.canUndo()).toBe(false)
	})

	it('leaves the edits under a refused one undoable', () => {
		// THE case that separates "the entry is dropped" from "the entry is unusable". With the
		// second edit recorded anyway, it buries the first: the stack's top names a document that
		// never existed, and everything under it is unreachable for good.
		let accepting = true
		const store = mountControlled('hello', (self, emitted) => {
			if (accepting) echoes(self, emitted)
		})
		type(store, 5, 'X')
		accepting = false
		type(store, 6, 'Y')
		accepting = true // the parent declined one edit — a validation refusal — and carries on

		expect(store.tokens.value()).toBe('helloX')
		expect(store.history.canUndo()).toBe(true)
		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('hello')
	})

	it('leaves them undoable when the parent answers the second edit with a value of its own', () => {
		// The same hole through the other door — a parent that clamps the length, so the second
		// edit comes back as the value the document already holds. It IS an arrival, and it is not
		// this emission's echo, so it owes nothing.
		const store = mountControlled('hello', (self, emitted) => self.props.update({value: emitted.slice(0, 6)}))
		type(store, 5, 'X')
		type(store, 6, 'Y')

		expect(store.tokens.value()).toBe('helloX')
		expect(store.history.canUndo()).toBe(true)
		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('hello')
	})

	it('leaves the entry where it was when the parent refuses the UNDO', () => {
		// The mirror of a refused edit, and the same rule: an emission the document never takes
		// moves nothing. Consumed on the emission, the entry lands in the redo stack naming a
		// document that never appeared — unusable there, unreachable back here — so one refusal
		// costs the user every entry underneath it too.
		let floor = 0
		const store = mountControlled('hello', (self, emitted) => {
			if (emitted.length >= floor) echoes(self, emitted)
		})
		type(store, 5, 'X')
		expect(store.tokens.value()).toBe('helloX')

		floor = 6 // a parent that validates a minimum length: the undo would take the value under it
		store.history.undo()
		expect(store.tokens.value()).toBe('helloX')
		expect(store.history.canUndo()).toBe(true)
		expect(store.history.canRedo()).toBe(false)

		floor = 0 // and it is still there to press again
		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('hello')
		expect(store.history.canRedo()).toBe(true)
	})

	it('moves the entry on an echo that arrives LATER, not only on one inside the call', () => {
		// Why the move rides on the landing rather than on a value comparison after the call: a
		// React parent's echo is a render apart, so at the moment `undo` returns, "refused" and
		// "not yet" look exactly alike.
		let pending: string | undefined
		const store = mountControlled('hello', (_self, emitted) => {
			pending = emitted
		})
		type(store, 5, 'X')
		store.props.update({value: pending})
		expect(store.tokens.value()).toBe('helloX')

		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('helloX') // the parent has not answered yet
		store.props.update({value: pending})

		expect(store.tokens.value()).toBe('hello')
		expect(store.history.canUndo()).toBe(false)
		expect(store.history.canRedo()).toBe(true)
	})

	it('stops offering an entry once the parent writes the value itself', () => {
		const store = mountControlled('hello', echoes)
		type(store, 5, '!')
		expect(store.history.canUndo()).toBe(true)

		store.props.update({value: 'something else entirely'})
		expect(store.history.canUndo()).toBe(false)
		expect(store.history.undo()).toBe(false)
		expect(store.tokens.value()).toBe('something else entirely')

		// Derived, not cleared: the entry is usable again exactly when the document is what it
		// was recorded against.
		store.props.update({value: 'hello!'})
		expect(store.history.canUndo()).toBe(true)
		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('hello')
	})
})

describe('history: the prop', () => {
	it('records nothing and offers nothing when history is off', () => {
		const store = mount('hello', {history: false})
		type(store, 5, '!')
		expect(store.tokens.value()).toBe('hello!')
		expect(store.history.canUndo()).toBe(false)
		expect(store.history.undo()).toBe(false)
		expect(store.tokens.value()).toBe('hello!')
	})

	it('makes what an earlier `history: true` recorded unreachable', () => {
		const store = mount('hello')
		type(store, 5, '!')
		expect(store.history.canUndo()).toBe(true)

		store.props.update({history: false})
		expect(store.history.canUndo()).toBe(false)
		expect(store.history.undo()).toBe(false)
		expect(store.tokens.value()).toBe('hello!')
	})

	it('does not make an edit taken while history was off undoable when it comes back on', () => {
		// The other half of the prop, and the one the query-side read cannot cover: an editor
		// that was not recording has nothing to give back, so turning history on offers the
		// document it finds rather than the edits that reached it unrecorded.
		const store = mount('hello', {history: false})
		type(store, 5, '!')

		store.props.update({history: true})
		expect(store.history.canUndo()).toBe(false)
		expect(store.history.undo()).toBe(false)
		expect(store.tokens.value()).toBe('hello!')

		// And it starts recording from there, so the next edit is undoable.
		type(store, 6, '?')
		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('hello!')
	})

	it('offers nothing while the editor is read-only, and everything again after', () => {
		// `replay` refuses under `readOnly`, so an offer this does not share would be a button
		// the user may press and nothing happens. Refusing is not forgetting: the entries were
		// recorded while the editor was writable and are still there when it is again.
		const store = mount('hello')
		type(store, 5, '!')
		expect(store.history.canUndo()).toBe(true)

		store.props.update({readOnly: true})
		expect(store.history.canUndo()).toBe(false)
		expect(store.history.undo()).toBe(false)
		expect(store.tokens.value()).toBe('hello!')

		store.props.update({readOnly: false})
		expect(store.history.canUndo()).toBe(true)
		expect(store.history.undo()).toBe(true)
		expect(store.tokens.value()).toBe('hello')
		expect(store.history.canRedo()).toBe(true)
	})
})