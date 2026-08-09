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
	container.replaceChildren(...store.tokens.current().map(() => document.createElement('span')))
	store.host.rendered()
	const token = store.tokens.current().find(t => t.type === 'mark')
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
	const token = store.tokens.current().find(t => t.type === 'mark')
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

	it('preserves an unpatched slot when only the value changes', () => {
		// The slot default is DERIVED at S1.6d — `joinNodes(node.children())`, because
		// `MarkNode.slot` stores positions only. Dropping the derivation was a silent
		// pass before this case existed (mutation-checked on both the token-backed and
		// the node-backed implementation).
		const {store, controller} = setup('hi @[user](inner)', '@[__value__](__slot__)')

		controller.update({value: 'other'})

		expect(store.value.current()).toBe('hi @[other](inner)')
	})

	it('clears slot content without leaking placeholder text', () => {
		const {store, controller} = setup('#[nested]', '#[__slot__]')

		controller.update({slot: {kind: 'clear'}})

		expect(store.value.current()).not.toContain('__slot__')
	})

	it('fails closed when the mark is gone from the value', () => {
		const {store, controller} = setup()
		// Wholesale replacement WITHOUT a successor mark: the identity dies, so
		// `find(id)` no longer resolves in the new tree — the mutation must no-op.
		// (A replacement mark of the same descriptor in the same slot would INHERIT
		// the identity instead — continuity the id bridge deliberately preserves;
		// see 'same-slot replacement inherits identity'.)
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
		expect(store.tokens.handle(token.id!)?.token()).not.toBe(token)

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

		// Render the new tree so bind kills the removed mark's handle: handle(id)
		// returns undefined (the handle is killed and dropped at bind), so the
		// controller's live read sees no mark and update() fails closed.
		const container = document.querySelector('div')!
		container.replaceChildren(document.createElement('span'))
		store.host.rendered()

		expect(store.tokens.handle(token.id!)).toBeUndefined()

		controller.update({value: 'bad'})

		expect(store.value.current()).toBe('hello')
	})

	it('same-slot replacement inherits identity — the captured id SURVIVES across the structural commit', () => {
		// Structural path: the whole value is replaced wholesale, but the new
		// value carries the SAME descriptor in the SAME slot position. Adoption
		// pairs the mark by index and it keeps its id, so the controller's
		// `find(id)` still lands on a live mark node ACROSS the commit WITHOUT
		// re-derivation. (Fail-closed semantics bite only when the mark is genuinely
		// REMOVED — see the dead-mark no-op case — not when its id is inherited.)
		const {store, controller} = mountedSetup()

		// Same descriptor (@[__value__]) in the same slot (index 0): identity inherited.
		store.value.current('different @[x]')

		// Paint the FULL render tree (text, value-only mark, trailing empty text)
		// and complete the handshake — bind re-resolves the inherited-id mark in
		// place onto the new surface. A short-count repaint would bail the frame
		// (all-or-nothing alignment) and leave every handle unbound.
		const container = document.querySelector('div')!
		const spans = store.tokens.renderTree().map(tok => {
			const span = document.createElement('span')
			if (tok.type === 'mark') span.append(document.createTextNode(tok.value))
			return span
		})
		container.replaceChildren(...spans)
		store.host.rendered()

		// The ORIGINAL captured controller applies — its handle survived the
		// inheriting commit (NOT re-derived from the fresh token).
		controller.update({value: 'probe'})

		expect(store.value.current()).toBe('different @[probe]')
	})
})

/**
 * MarkController live-read parity tables (spec §MarkController semantics).
 *
 * The controller is ID-BACKED: every read and every write re-resolves
 * `store.tokens.find(id)` against the LIVE TREE, which has no pending window, so
 * there is no captured-token fallback to fall back TO (§4.6 item 4, S1.6d). The
 * parity table:
 *
 *   read       | live source                     | mark no longer in the tree
 *   -----------|---------------------------------|---------------------------
 *   value      | node.value()                    | ''
 *   meta       | node.meta()                     | undefined
 *   slot       | joinNodes(node.children())      | undefined
 *   readOnly   | store.props.readOnly()          | (always live)
 *   update()   | mutate the live mark's range    | false (fail-closed)
 *   remove()   | replace that range with ''      | false (fail-closed)
 *
 * SEMVER-MAJOR: a controller captured before a structural commit that REMOVES its
 * mark no longer auto-bridges its WRITES — they fail closed; the adapter
 * re-derives it from the fresh token (useMark's useMemo re-runs on the new token
 * object). A write during the pending window, by contrast, now SUCCEEDS (it folds
 * into the pending structural pass) where the retired write latch refused it.
 */
describe('MarkController live-read parity (node-backed)', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	// value / meta / slot / readOnly are LIVE reads of the current token — they
	// track text-path commits WITHOUT re-capturing the controller.
	it('value tracks the current token across a text-path edit', () => {
		const {store, controller} = mountedSetup()
		expect(controller.value).toBe('x')
		// Text-path edit before the mark shifts its position but not its value.
		store.edit.replace({start: 0, end: 0}, 'XX')
		expect(store.value.current()).toBe('XXhe@[x]llo')
		// The controller's value is a LIVE read of the (shifted, same-value) token.
		expect(controller.value).toBe('x')
	})

	it('update() reflects a value change made through the controller itself (live read)', () => {
		const {store, controller} = mountedSetup()
		controller.update({value: 'y'})
		expect(store.value.current()).toBe('he@[y]llo')
		// After the structural commit re-binds, the live read sees the new value.
		const container = document.querySelector('div')!
		const text1 = document.createElement('span')
		const markEl = document.createElement('span')
		markEl.append(document.createTextNode('y'))
		const text2 = document.createElement('span')
		container.replaceChildren(text1, markEl, text2)
		store.host.rendered()
		expect(controller.value).toBe('y')
	})

	it('meta and slot are live reads (parity table)', () => {
		const store = new Store()
		store.props.set({
			defaultValue: 'a @[v](m)',
			options: [{markup: '@[__value__](__meta__)'}],
			Mark: () => null,
		})
		const container = document.createElement('div')
		// 'a @[v](m)' parses to text 'a ', mark '@[v](m)', trailing empty text — one
		// span per token (a short-count repaint bails the frame, binding nothing).
		container.append(document.createElement('span'), document.createElement('span'), document.createElement('span'))
		document.body.append(container)
		store.host.container(container)
		store.host.rendered()
		const token = store.tokens.current().find(t => t.type === 'mark')!
		const controller = MarkController.fromToken(store, token)
		expect(controller.value).toBe('v')
		expect(controller.meta).toBe('m')
		expect(controller.slot).toBeUndefined()
	})

	it('readOnly is a live read of props.readOnly()', () => {
		const {store, controller} = mountedSetup()
		expect(controller.readOnly).toBe(false)
		store.props.set({readOnly: true})
		expect(controller.readOnly).toBe(true)
	})

	it('update() against a dead handle is a fail-closed no-op returning false', () => {
		const {store, controller} = mountedSetup()
		// Structurally remove the mark and re-bind so its handle is killed.
		store.edit.replace({start: 2, end: 6}, '')
		expect(store.value.current()).toBe('hello')
		const container = document.querySelector('div')!
		container.replaceChildren(document.createElement('span'))
		store.host.rendered()

		const result = controller.update({value: 'bad'})
		expect(result).toBe(false)
		expect(store.value.current()).toBe('hello')
	})

	it('update() while a structural apply awaits its bind SUCCEEDS and folds into the pending pass', () => {
		const {store, controller} = mountedSetup()
		// Trigger a structural commit but do NOT render() — the pending latch is closed.
		// The fixture ADDS roots on purpose: adoption pairs roots by index, so a
		// whole-value write that keeps the root count ('he@[x]llo' → 'different @[x]')
		// removes nothing, takes the TEXT path and opens no pending window at all. The
		// extra mark keeps the commit structural while the FIRST mark keeps its id, so
		// this still exercises the window rather than a dead mark.
		store.value.current('he@[x]llo@[y]')
		// INVERTED at S1.6d (§4.6 item 4, SEMVER-MAJOR): the write latch is gone. The
		// controller resolves the LIVE NODE, which has no pending window, and the write
		// folds into the pending structural pass (the pipeline's fold guard).
		const result = controller.update({value: 'bad'})
		expect(result).toBe(true)
		expect(store.value.current()).toBe('he@[bad]llo@[y]')
	})

	// Render-path contract: BOTH adapters call fromToken synchronously during
	// render (react useMark inside useMemo, vue useMark inside setup), so fromToken
	// runs in the routine pending window on every structural commit — BEFORE the
	// freshly-painted DOM binds, and the adapter never schedules a re-render once it
	// does. So fromToken must NOT throw there, AND reads must surface the mark's
	// value (not flash empty). A throw here crashes the rendered component (the
	// storybook regression this pins against). The mid-window WRITE is pinned by the
	// case above, which S1.6d inverted.
	it('fromToken during the pending window reads the live node, then stays live after bind', () => {
		const {store} = mountedSetup()

		// Structural commit, NO rendered() — the pending latch is closed. fromToken
		// (which both adapters call synchronously during render) must build a
		// controller on the id. The fixture ADDS roots for the reason spelled out on
		// the mid-window case above: a whole-value write that keeps the root count is
		// a text-path commit and opens no pending window.
		store.value.current('he@[x]llo@[y]')
		const freshToken = store.tokens.renderTree().find(t => t.type === 'mark')!
		const controller = MarkController.fromToken(store, freshToken)
		expect(controller).toBeInstanceOf(MarkController)

		// READ resolves the live node mid-window: the rendered mark shows its value
		// immediately instead of flashing empty until a re-render the adapter never
		// schedules.
		expect(controller.value).toBe('x')

		// Paint the render tree and complete the handshake — the same-id handle
		// binds and reads/writes go live WITHOUT re-derivation.
		const container = document.querySelector('div')!
		const spans = store.tokens.renderTree().map(tok => {
			const span = document.createElement('span')
			if (tok.type === 'mark') span.append(document.createTextNode(tok.value))
			return span
		})
		container.replaceChildren(...spans)
		store.host.rendered()

		expect(controller.value).toBe('x')
		expect(controller.update({value: 'ok'})).toBe(true)
		expect(store.value.current()).toBe('he@[ok]llo@[y]')
	})
})