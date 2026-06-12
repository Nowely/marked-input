import {afterEach, describe, it, expect} from 'vitest'

import type {Markup} from '.'
import {Store} from '../../store/Store'
import {MarkController} from './MarkController'

/**
 * Mounted fixture: one span per top-level token (marks render childless),
 * bound on rendered(). The model resolves through the live node layer, so a
 * controller needs a bound store — there is no headless resolution path.
 */
function setup(value = 'hello @[world]', markup: Markup = '@[__value__]') {
	const store = new Store()
	store.props.set({defaultValue: value, Mark: () => null, options: [{markup}]})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)
	container.replaceChildren(...store.tokens.tree().map(() => document.createElement('span')))
	store.host.rendered()
	const token = store.tokens.tree().find(t => t.type === 'mark')
	if (!token) throw new Error('expected parsed mark token')
	const controller = MarkController.fromToken(store, token)
	return {store, token, controller}
}

/**
 * Mounted fixture: text 'he' [0,2], mark '@[x]' [2,6], text 'llo' [6,9] —
 * with a bound DOM, so text-path edits patch in place and the identity
 * bridge is live.
 */
function mountedSetup() {
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
	const token = store.tokens.tree().find(t => t.type === 'mark')
	if (!token) throw new Error('expected parsed mark token')
	const controller = MarkController.fromToken(store, token)
	return {store, token, controller}
}

describe('MarkController', () => {
	it('exposes readonly snapshot fields', () => {
		const {controller} = setup()

		expect(controller.value).toBe('world')
		expect(controller.meta).toBeUndefined()
		expect(controller.slot).toBeUndefined()
		expect(controller.readOnly).toBe(false)
	})

	it('reads an EMPTY slot as the empty string, not undefined', () => {
		// '@[user]()' parses with a zero-width slot window (empty slot ≠ no slot —
		// the Phase 0 parser contract): the controller surfaces '' where a
		// slotless markup (pinned above) surfaces undefined.
		const {controller} = setup('hi @[user]()', '@[__value__](__slot__)')

		expect(controller.slot).toBe('')
	})

	it('removes a mark through the value pipeline', () => {
		const {store, controller} = setup()

		controller.remove()

		expect(store.value.current()).toBe('hello ')
	})

	it('updates mark value through descriptor serialization', () => {
		const {store, controller} = setup()

		controller.update({value: 'markput'})

		expect(store.value.current()).toBe('hello @[markput]')
	})

	it('clears metadata without leaking placeholder text', () => {
		const {store, controller} = setup('hello @[world](meta)', '@[__value__](__meta__)')

		controller.update({meta: {kind: 'clear'}})

		expect(store.value.current()).toBe('hello @[world]()')
		expect(store.value.current()).not.toContain('__meta__')
	})

	it('clears slot content without leaking placeholder text', () => {
		const {store, controller} = setup('#[nested]', '#[__slot__]')

		controller.update({slot: {kind: 'clear'}})

		expect(store.value.current()).not.toContain('__slot__')
	})

	it('fails closed when the mark is gone from the value', () => {
		const {store, controller} = setup()
		// Wholesale replacement WITHOUT a successor mark: the identity dies, the
		// structural apply latches, and the captured address no longer resolves
		// in the new tree — the mutation must no-op. (A replacement mark of the
		// same descriptor in the same slot would INHERIT the identity instead —
		// continuity the id bridge deliberately preserves; see
		// 'same-slot replacement inherits identity — controller bridges without rendered()'.)
		store.value.current('different text')

		controller.update({value: 'bad'})
		expect(store.value.current()).toBe('different text')
	})

	it('does not mutate in read-only mode', () => {
		const {store, controller} = setup()
		store.props.set({readOnly: true})

		controller.remove()
		expect(store.value.current()).toBe('hello @[world]')
	})
})

describe('MarkController across text-path commits (identity bridge)', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	// Data-corruption regression: a controller captured BEFORE a text-path
	// commit holds a stale token whose position no longer matches the value.
	// The adapter never re-rendered (structure() kept its reference), so the
	// controller must bridge to the token's CURRENT address — mutating the
	// shifted (correct) range, not the captured one, and never no-opping.

	it('update() after a preceding text edit mutates the shifted (correct) range', () => {
		const {store, token, controller} = mountedSetup()

		// Preceding text edit: 'he@[x]llo' → 'XXhe@[x]llo' — text path
		// (text token textChanged; mark + tail shifted by +2)
		store.edit.replace({start: 0, end: 0}, 'XX')
		expect(store.value.current()).toBe('XXhe@[x]llo')
		// Sanity: reconcile replaced the mark object — the captured token is stale
		expect(store.tokens.handleOf(token)?.token()).not.toBe(token)

		controller.update({value: 'markput'})

		// The mark now lives at [4,8]; replacing the captured [2,6] would
		// corrupt the value ('XX@[markput]e@[x]llo'-style), no-opping would drop the edit
		expect(store.value.current()).toBe('XXhe@[markput]llo')
	})

	it('remove() after a preceding text edit removes the shifted (correct) range', () => {
		const {store, controller} = mountedSetup()

		store.edit.replace({start: 0, end: 0}, 'XX')
		expect(store.value.current()).toBe('XXhe@[x]llo')

		controller.remove()

		expect(store.value.current()).toBe('XXhello')
	})

	it('survives several consecutive text-path commits before mutating', () => {
		const {store, controller} = mountedSetup()

		store.edit.replace({start: 0, end: 0}, 'X')
		store.edit.replace({start: 1, end: 1}, 'Y')
		store.edit.replace({start: 2, end: 2}, 'Z')
		expect(store.value.current()).toBe('XYZhe@[x]llo')

		controller.update({value: 'ok'})

		expect(store.value.current()).toBe('XYZhe@[ok]llo')
	})

	it('still fails closed once the mark is structurally removed', () => {
		const {store, token, controller} = mountedSetup()

		// Remove the mark entirely: structural path; the identity is gone.
		store.edit.replace({start: 2, end: 6}, '')
		expect(store.value.current()).toBe('hello')

		// Render the new tree so bind kills the removed mark's handle and the
		// bridge exercises the intended "identity gone" path rather than the
		// pre-bind latch. Two layers of protection:
		//   1. handleOf returns undefined (handle killed and dropped at bind)
		//   2. the captured address's object-identity check against the new tree
		//      covers the latched pre-bind window
		const container = document.querySelector('div')!
		container.replaceChildren(document.createElement('span'))
		store.host.rendered()

		expect(store.tokens.handleOf(token)).toBeUndefined()

		controller.update({value: 'bad'})

		expect(store.value.current()).toBe('hello')
	})

	it('same-slot replacement inherits identity — controller bridges without rendered()', () => {
		// Structural path: the whole value is replaced wholesale, but the new
		// value carries the SAME descriptor in the SAME slot position. Reconcile
		// pairs tokens by index and the mark inherits its predecessor's id — the
		// id bridge therefore keeps the controller live with no manual rendered().
		// The textChanged-mark escalation is synchronous, so the handle is fresh
		// the instant value.current() returns.
		const {store, controller} = mountedSetup()

		// Same descriptor (@[__value__]) in the same slot (index 0): identity inherited.
		store.value.current('different @[x]')

		// No rendered() call needed — the escalation re-binds synchronously.
		controller.update({value: 'probe'})

		expect(store.value.current()).toBe('different @[probe]')
	})
})