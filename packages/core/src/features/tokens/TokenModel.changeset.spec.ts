import {afterEach, describe, expect, it} from 'vitest'

import {Store} from '../../store/Store'

/** Inline fixture (from TokenModel.facade.spec.ts): text 'he' [0,2], mark '@[x]' [2,6], text 'llo' [6,9]. */
function mountWithMark() {
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

describe('TokenModel changeset', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('first parse reports full and idOf yields distinct numeric ids', () => {
		const {store} = mountWithMark()

		expect(store.tokens.changeset()).toEqual({kind: 'full'})

		const ids = store.tokens.current().map(token => store.tokens.idOf(token))
		expect(ids).toHaveLength(3)
		expect(new Set(ids).size).toBe(3)
		ids.forEach(id => expect(typeof id).toBe('number'))
		// stable across repeated reads
		expect(store.tokens.current().map(token => store.tokens.idOf(token))).toEqual(ids)
	})

	it('edit.replace yields a delta changeset with the edited token in textChanged by id', () => {
		const {store} = mountWithMark()
		const markId = store.tokens.idOf(store.tokens.current()[1])
		const tailId = store.tokens.idOf(store.tokens.current()[2])

		// append '!' at the end of the trailing text: 'he@[x]llo' → 'he@[x]llo!'
		store.edit.replace({start: 9, end: 9}, '!')

		expect(store.tokens.changeset()).toEqual({
			kind: 'delta',
			textChanged: [tailId],
			added: [],
			removed: [],
			shifted: [],
		})
		// identity survives the edit: same ids on the new tree
		expect(store.tokens.idOf(store.tokens.current()[1])).toBe(markId)
		expect(store.tokens.idOf(store.tokens.current()[2])).toBe(tailId)
	})

	it('edit.replace before the mark flows the precise hint: suffix tokens shifted, ids stable', () => {
		const {store} = mountWithMark()
		const markId = store.tokens.idOf(store.tokens.current()[1])
		const tailId = store.tokens.idOf(store.tokens.current()[2])

		// prepend 'X' at position 0: mark and tail shift right by 1
		store.edit.replace({start: 0, end: 0}, 'X')

		const changeset = store.tokens.changeset()
		expect(changeset.kind).toBe('delta')
		if (changeset.kind !== 'delta') throw new Error('expected delta')
		expect(changeset.shifted).toContain(markId)
		expect(changeset.shifted).toContain(tailId)
		expect(changeset.added).toEqual([])
		expect(changeset.removed).toEqual([])
		expect(store.tokens.idOf(store.tokens.current()[1])).toBe(markId)
		expect(store.tokens.idOf(store.tokens.current()[2])).toBe(tailId)
	})

	// Plan deviation (Task 3): the plan predicted `kind: 'full'` after a direct
	// value set, but since Task 2 the tracker self-derives the hint via findGap
	// from previous/next values — only the FIRST reconcile is 'full'. The
	// intent (identity survives a hint-less set) is asserted instead.
	it('direct value.current set keeps identity via the findGap-derived hint and reports delta', () => {
		const {store} = mountWithMark()
		const markId = store.tokens.idOf(store.tokens.current()[1])
		const tailId = store.tokens.idOf(store.tokens.current()[2])

		store.value.current('he@[x]llo!')

		expect(store.tokens.changeset()).toEqual({
			kind: 'delta',
			textChanged: [tailId],
			added: [],
			removed: [],
			shifted: [],
		})
		// the mark id survived a set that carried no edit hint
		expect(store.tokens.idOf(store.tokens.current()[1])).toBe(markId)
	})
})