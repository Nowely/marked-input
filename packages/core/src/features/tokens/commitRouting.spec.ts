import {afterEach, describe, expect, it} from 'vitest'

import {Store} from '../../store/Store'
import {isTextPath} from './commitRouting'
import {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import type {Changeset} from './tokenIdentity'
import {createIdentityTracker} from './tokenIdentity'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTracker() {
	return createIdentityTracker()
}

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

// ---------------------------------------------------------------------------
// Pure classifier tests
// ---------------------------------------------------------------------------

describe('isTextPath classifier', () => {
	const tracker = makeTracker()
	const parser = new Parser(['@[__value__]'])
	const tokens = parser.parse('he@[x]llo')
	// Assign ids to the tree so idOf works
	tokens.forEach(t => tracker.idOf(t))

	const idOf = (t: Token) => tracker.idOf(t)
	// text tokens are at index 0 and 2; mark at index 1
	const textToken0 = tokens[0]
	const markToken = tokens[1]
	const textToken2 = tokens[2]

	it('full changeset → structural (not text path)', () => {
		const changeset: Changeset = {kind: 'full'}
		expect(isTextPath(tokens, changeset, idOf)).toBe(false)
	})

	it('delta with non-empty added → structural', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [],
			added: [tracker.idOf(textToken0)],
			removed: [],
			shifted: [],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(false)
	})

	it('delta with non-empty removed → structural', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [],
			added: [],
			removed: [tracker.idOf(textToken2)],
			shifted: [],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(false)
	})

	it('delta with textChanged containing a MARK id → structural', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [tracker.idOf(markToken)],
			added: [],
			removed: [],
			shifted: [],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(false)
	})

	it('delta with only text-token textChanged → text path', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [tracker.idOf(textToken2)],
			added: [],
			removed: [],
			shifted: [],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(true)
	})

	it('delta with only shifted (no textChanged) → text path', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [],
			added: [],
			removed: [],
			shifted: [tracker.idOf(textToken2)],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(true)
	})

	it('empty delta (no textChanged, no shifted) → text path', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [],
			added: [],
			removed: [],
			shifted: [],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(true)
	})

	it('delta with textChanged id not found in the tree → structural (conservative, stale-tree guard)', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [99999],
			added: [],
			removed: [],
			shifted: [],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Mounted structure computed tests
// ---------------------------------------------------------------------------

describe('TokenModel.structure computed', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('tail text edit — structure() reference-equal to pre-edit reference, current() is new array', () => {
		const {store} = mountWithMark()
		// Pin actual parse output: value 'he@[x]llo' → 3 tokens
		expect(store.tokens.current()).toHaveLength(3)

		const before = store.tokens.structure()

		// Append '!' at end: text 'llo' [6,9] → 'llo!' [6,10]; mark unchanged
		// This is a text-only edit (only the trailing text token textChanged)
		store.edit.replace({start: 9, end: 9}, '!')

		const after = store.tokens.structure()

		// structure() must be reference-stable across a text-path reconcile
		expect(after).toBe(before)
		// but current() must reflect the new tokens (different array)
		expect(store.tokens.current()).not.toBe(before)
		expect(store.tokens.current()[2].content).toBe('llo!')
	})

	it('structural edit (insert a new mark) — structure() is a new reference, deep-equal to current()', () => {
		const {store} = mountWithMark()
		// Pin: starts with 3 tokens
		expect(store.tokens.current()).toHaveLength(3)

		const before = store.tokens.structure()

		// Insert a second mark at the end: 'he@[x]llo' → 'he@[x]llo@[y]'
		// This adds tokens → changeset has non-empty added → structural path
		store.edit.replace({start: 9, end: 9}, '@[y]')

		const after = store.tokens.structure()

		// structure() must be a new reference on the structural path
		expect(after).not.toBe(before)
		// and it must equal current()
		expect(after).toEqual(store.tokens.current())
	})
})