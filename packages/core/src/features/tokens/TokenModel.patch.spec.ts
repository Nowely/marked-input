import {afterEach, describe, expect, it, vi} from 'vitest'

import {watch} from '../../shared/signals/index.js'
import {Store} from '../../store/Store'
import type {TokenNode} from './domTypes'
import type {Token} from './parser/types'
import {createTextToken} from './parser/utils/createTextToken'
import type {TokenChange} from './TokenHandle'
import {createTokenIndex, pathKey} from './tokenIndex'
import {preparePatch} from './TokenModel'

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
	return {store, container, text1, mark, text2}
}

describe('TokenModel patch commits (text path, no renderer)', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('tail text edit without rendered() patches the surface and re-indexes in place', () => {
		const {store, text2} = mountWithMark()
		// The first adapter commit reconciled the surfaces: 'llo' is on screen.
		expect(text2.textContent).toBe('llo')
		expect(text2.contentEditable).toBe('true')

		const tail = store.tokens.tokenAt(8)
		if (!tail) throw new Error('expected tail handle')
		const changes: TokenChange[] = []
		watch(tail.changed, change => changes.push(change))
		const indexedSpy = vi.fn()
		watch(store.tokens.indexed, indexedSpy)

		// Append '!' at the end: text 'llo' [6,9] → 'llo!' [6,10] — pure text path.
		// The adapter would NOT re-render (structure() is reference-stable), so
		// host.rendered() is deliberately not called again.
		store.edit.replace({start: 9, end: 9}, '!')

		// The surface was patched directly, without the renderer.
		expect(text2.textContent).toBe('llo!')
		// Exactly one more commit wave.
		expect(indexedSpy).toHaveBeenCalledTimes(1)
		// The edited token's handle saw the change and reads fresh.
		expect(changes).toEqual([{kind: 'text', previous: 'llo'}])
		expect(tail.text()).toBe('llo!')
		// Index addresses were refreshed in place: post-edit positions resolve.
		const textNode = text2.firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a text node')
		expect(store.tokens.boundaryFor(textNode, 4)).toBe(10)
		expect(store.tokens.tokenAt(10)?.address().path).toEqual([2])
		// contentEditable survives the patch.
		expect(text2.contentEditable).toBe('true')
	})

	it('structural edit without rendered() does not patch — indexed stays quiet until rendered()', () => {
		const {store, text2} = mountWithMark()
		const indexedSpy = vi.fn()
		watch(store.tokens.indexed, indexedSpy)

		// Insert a second mark: 'he@[x]llo' → 'he@[x]llo@[y]' — structural (added
		// tokens). The patch path must stay quiet; the renderer owns this change.
		store.edit.replace({start: 9, end: 9}, '@[y]')

		expect(indexedSpy).not.toHaveBeenCalled()
		expect(text2.textContent).toBe('llo')

		// The adapter re-renders (structure() reference changed) and reports
		// rendered() → the full commit runs exactly once.
		store.host.rendered()
		expect(indexedSpy).toHaveBeenCalledTimes(1)
	})
})

/**
 * Escalation seam (design spec "Error handling"): a text-only patch whose
 * target is missing from the index must escalate to the structural path
 * instead of silently dropping the edit. The failure branches are unreachable
 * through the public API while text-path routing invariants hold — buildIndex
 * always gives an indexed text token a text surface, and the text path keeps
 * paths stable, so addressFor and the id projection cannot miss. Hence the
 * detection seam (preparePatch, pass 1 of #patchCommit) is unit-tested
 * directly here: #patchCommit escalates to a full rebuild exactly when it
 * returns undefined, and the happy path is covered end-to-end above. A
 * black-box DOM-corruption trigger would require monkey-patching internals.
 */
describe('preparePatch (patch pass 1 — escalation detection)', () => {
	function indexedNode(path: readonly number[], token: Token, withSurface = true): TokenNode {
		const tokenElement = document.createElement('span')
		return {
			path,
			address: {path, token},
			tokenElement,
			textElement: withSurface ? tokenElement : undefined,
		}
	}

	/** One stale indexed text node + the post-edit index: 'llo' → 'llo!' (id 7). */
	function staleFixture(withSurface = true) {
		const previousToken = createTextToken('llo')
		const nextToken = createTextToken('llo!')
		const node = indexedNode([0], previousToken, withSurface)
		const previous = new Map([[pathKey([0]), node]])
		const index = createTokenIndex([nextToken])
		const idOf = (token: Token) => (token === nextToken ? 7 : -1)
		return {previous, index, idOf, node, nextToken}
	}

	it('resolves a full patch: refreshed addresses, same elements, surface writes', () => {
		const {previous, index, idOf, node, nextToken} = staleFixture()
		// Set a sentinel so the purity assertion proves no write occurred (not just the default '').
		node.tokenElement.textContent = 'sentinel'
		const prepared = preparePatch(previous, index, idOf, [7])
		if (!prepared) throw new Error('expected a prepared patch')
		// Address refreshed from the new index; elements carried over untouched.
		expect(prepared.byPath.get(pathKey([0]))?.address.token).toBe(nextToken)
		expect(prepared.byPath.get(pathKey([0]))?.tokenElement).toBe(node.tokenElement)
		expect(prepared.byId.get(7)).toBe(prepared.byPath.get(pathKey([0])))
		expect(prepared.targets).toEqual([{element: node.tokenElement, content: 'llo!'}])
		// Pass 1 is pure: sentinel survives — nothing was written to the DOM or the input map.
		expect(node.tokenElement.textContent).toBe('sentinel')
		expect(previous.get(pathKey([0]))?.address.token.content).toBe('llo')
	})

	it('returns undefined when an indexed path no longer resolves (addressFor miss)', () => {
		const {previous, index, idOf, node} = staleFixture()
		const orphan = new Map([...previous, [pathKey([1]), {...node, path: [1]}]])
		expect(preparePatch(orphan, index, idOf, [7])).toBeUndefined()
	})

	it('returns undefined when a changed id is missing from the projection', () => {
		const {previous, index, idOf} = staleFixture()
		expect(preparePatch(previous, index, idOf, [99])).toBeUndefined()
	})

	it('returns undefined when the target surface is missing from the index', () => {
		const {previous, index, idOf} = staleFixture(false)
		expect(preparePatch(previous, index, idOf, [7])).toBeUndefined()
	})
})