import {afterEach, describe, expect, it} from 'vitest'

import {Store} from '../../../store/Store'
import type {Markup} from '../parser/types'
import type {MarkNode} from './types'

/**
 * Ported from the deleted `MarkController.spec.ts` at S1.7 (plan decision D-d): the class
 * was the second implementation of these semantics once `mark.update`/`remove` moved onto
 * the node, so the behaviors it pinned are the NODE's now. A captured node object is the
 * exact equivalent of the controller's captured id: adoption keeps a node object exactly
 * when it keeps its id.
 */
function markNodeOf(store: Store, token: {id?: number}): MarkNode {
	if (token.id === undefined) throw new Error('token has no id')
	const node = store.tokens.find(token.id)
	if (node?.kind !== 'mark') throw new Error('expected a live mark node')
	return node
}

/**
 * Mounted fixture: one span per top-level token (marks render childless),
 * bound on rendered(). The model resolves through the live node layer, so the
 * verbs need a bound store — there is no headless resolution path.
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
	return {store, token, node: markNodeOf(store, token)}
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
	return {store, token, node: markNodeOf(store, token)}
}

describe('MarkNode verbs', () => {
	it('exposes readonly snapshot fields', () => {
		const {node} = setup()

		expect(node.markup).toBe('@[__value__]')
		expect(node.value()).toBe('world')
		expect(node.meta()).toBeUndefined()
		expect(node.slot()).toBeUndefined()
	})

	it('reads an EMPTY slot as the empty string, not undefined', () => {
		// '@[user]()' parses with a zero-width slot window (empty slot ≠ no slot —
		// the Phase 0 parser contract): the node surfaces '' where a slotless
		// markup (pinned above) surfaces undefined.
		const {node} = setup('hi @[user]()', '@[__value__](__slot__)')

		expect(node.slot()).toBe('')
	})

	it('removes a mark through the value pipeline', () => {
		const {store, node} = setup()

		node.remove()

		expect(store.value.current()).toBe('hello ')
	})

	it('updates mark value through descriptor serialization', () => {
		const {store, node} = setup()

		node.update({value: 'markput'})

		expect(store.value.current()).toBe('hello @[markput]')
	})

	it('clears metadata without leaking placeholder text', () => {
		const {store, node} = setup('hello @[world](meta)', '@[__value__](__meta__)')

		node.update({meta: null})

		expect(store.value.current()).toBe('hello @[world]()')
		expect(store.value.current()).not.toContain('__meta__')
	})

	it('preserves an unpatched META when only the value changes', () => {
		// The `null`-vs-omitted split (plan decision D-b) needs BOTH directions pinned: this
		// one dies if `serializeMark` treats an omitted key as a clear.
		const {store, node} = setup('hello @[world](keep)', '@[__value__](__meta__)')

		node.update({value: 'other'})

		expect(store.value.current()).toBe('hello @[other](keep)')
	})

	it('sets meta from a plain string', () => {
		const {store, node} = setup('hello @[world]()', '@[__value__](__meta__)')

		node.update({meta: 'user:1'})

		expect(store.value.current()).toBe('hello @[world](user:1)')
	})

	it('preserves an unpatched slot when only the value changes', () => {
		// The slot default is DERIVED — `slot()` joins the live children, because
		// `MarkNode.slotRange` stores positions only. Dropping the derivation was a silent
		// pass before this case existed.
		const {store, node} = setup('hi @[user](inner)', '@[__value__](__slot__)')

		node.update({value: 'other'})

		expect(store.value.current()).toBe('hi @[other](inner)')
	})

	it('clears slot content without leaking placeholder text', () => {
		const {store, node} = setup('#[nested]', '#[__slot__]')

		node.update({slot: null})

		expect(store.value.current()).not.toContain('__slot__')
	})

	it('fails closed when the mark is gone from the value', () => {
		const {store, node} = setup()
		// Wholesale replacement WITHOUT a successor mark: the identity dies, so the captured
		// node is no longer reachable from the roots — the mutation must no-op.
		// (A replacement mark of the same descriptor in the same slot would INHERIT
		// the identity instead — continuity the id bridge deliberately preserves;
		// see 'same-slot replacement inherits identity'.)
		store.value.current('different text')

		node.update({value: 'bad'})
		expect(store.value.current()).toBe('different text')
	})

	it('does not mutate in read-only mode', () => {
		const {store, node} = setup()
		store.props.set({readOnly: true})

		node.remove()
		expect(store.value.current()).toBe('hello @[world]')
	})
})

describe('MarkNode across text-path commits (identity bridge)', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	// Data-corruption regression: a node captured BEFORE a text-path commit is the
	// same object, but the token the adapter rendered is stale — its position no
	// longer matches the value. The adapter never re-rendered (structure() kept its
	// reference), so the write must land on the node's CURRENT address — mutating the
	// shifted (correct) range, not the captured one, and never no-opping.

	it('update() after a preceding text edit mutates the shifted (correct) range', () => {
		const {store, token, node} = mountedSetup()

		// Preceding text edit: 'he@[x]llo' → 'XXhe@[x]llo' — text path
		// (text token textChanged; mark + tail shifted by +2)
		store.edit.replace({start: 0, end: 0}, 'XX')
		expect(store.value.current()).toBe('XXhe@[x]llo')
		// Sanity: reconcile replaced the TOKEN object — the captured token is stale
		expect(store.tokens.handle(token.id!)?.token()).not.toBe(token)

		node.update({value: 'markput'})

		// The mark now lives at [4,8]; replacing the captured [2,6] would
		// corrupt the value ('XX@[markput]e@[x]llo'-style), no-opping would drop the edit
		expect(store.value.current()).toBe('XXhe@[markput]llo')
	})

	it('remove() after a preceding text edit removes the shifted (correct) range', () => {
		const {store, node} = mountedSetup()

		store.edit.replace({start: 0, end: 0}, 'XX')
		expect(store.value.current()).toBe('XXhe@[x]llo')

		node.remove()

		expect(store.value.current()).toBe('XXhello')
	})

	it('survives several consecutive text-path commits before mutating', () => {
		const {store, node} = mountedSetup()

		store.edit.replace({start: 0, end: 0}, 'X')
		store.edit.replace({start: 1, end: 1}, 'Y')
		store.edit.replace({start: 2, end: 2}, 'Z')
		expect(store.value.current()).toBe('XYZhe@[x]llo')

		node.update({value: 'ok'})

		expect(store.value.current()).toBe('XYZhe@[ok]llo')
	})

	it('still fails closed once the mark is structurally removed', () => {
		const {store, token, node} = mountedSetup()

		// Remove the mark entirely: structural path; the identity is gone.
		store.edit.replace({start: 2, end: 6}, '')
		expect(store.value.current()).toBe('hello')

		// Render the new tree so bind kills the removed mark's handle: the node has left
		// the roots, so the liveness walk misses and update() fails closed.
		const container = document.querySelector('div')!
		container.replaceChildren(document.createElement('span'))
		store.host.rendered()

		expect(store.tokens.handle(token.id!)).toBeUndefined()

		node.update({value: 'bad'})

		expect(store.value.current()).toBe('hello')
	})

	it('same-slot replacement inherits identity — the captured node SURVIVES across the structural commit', () => {
		// Structural path: the whole value is replaced wholesale, but the new
		// value carries the SAME descriptor in the SAME slot position. Adoption
		// pairs the mark by index and it keeps its id — and keeping its id is keeping
		// the node OBJECT, so the captured node is still live ACROSS the commit WITHOUT
		// re-derivation. (Fail-closed semantics bite only when the mark is genuinely
		// REMOVED — see the dead-mark no-op case — not when its id is inherited.)
		const {store, node} = mountedSetup()

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

		// The ORIGINAL captured node applies — it survived the inheriting commit
		// (NOT re-derived from the fresh token).
		node.update({value: 'probe'})

		expect(store.value.current()).toBe('different @[probe]')
	})
})

/**
 * MarkNode live-read parity tables (spec §2.3).
 *
 * The node IS the live object: every read is a signal call on the object adoption
 * retains, and every write re-checks reachability from the roots, which has no pending
 * window (§4.6 item 4, S1.6d). The parity table:
 *
 *   read       | live source                     | mark no longer in the tree
 *   -----------|---------------------------------|---------------------------
 *   value()    | node.value()                    | the last adopted value (detached)
 *   meta()     | node.meta()                     | the last adopted meta (detached)
 *   slot()     | joinNodes(node.children())      | the last adopted children (detached)
 *   update()   | mutate the live mark's range    | false (fail-closed)
 *   remove()   | replace that range with ''      | false (fail-closed)
 *
 * `readOnly` LEFT the mark surface at S1.7 — §2.3 does not put editor state on a node;
 * userland reads it through `useMarkput(s => s.props.readOnly)`. What is left to pin is
 * the gating, which lives in the transaction layer.
 */
describe('MarkNode live-read parity', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	// value / meta / slot are LIVE reads of the retained node — they track text-path
	// commits WITHOUT re-resolving.
	it('value tracks the current token across a text-path edit', () => {
		const {store, node} = mountedSetup()
		expect(node.value()).toBe('x')
		// Text-path edit before the mark shifts its position but not its value.
		store.edit.replace({start: 0, end: 0}, 'XX')
		expect(store.value.current()).toBe('XXhe@[x]llo')
		// The node's value is a LIVE read of the (shifted, same-value) mark.
		expect(node.value()).toBe('x')
	})

	it('update() reflects a value change made through the node itself (live read)', () => {
		const {store, node} = mountedSetup()
		node.update({value: 'y'})
		expect(store.value.current()).toBe('he@[y]llo')
		// After the structural commit re-binds, the live read sees the new value.
		const container = document.querySelector('div')!
		const text1 = document.createElement('span')
		const markEl = document.createElement('span')
		markEl.append(document.createTextNode('y'))
		const text2 = document.createElement('span')
		container.replaceChildren(text1, markEl, text2)
		store.host.rendered()
		expect(node.value()).toBe('y')
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
		const node = markNodeOf(store, token)
		expect(node.value()).toBe('v')
		expect(node.meta()).toBe('m')
		expect(node.slot()).toBeUndefined()
	})

	it('both write verbs fail closed the moment readOnly flips', () => {
		// `readOnly` LEFT the mark surface at S1.7 (§2.3 does not put editor state on a node),
		// so what is left to pin is the gating itself, which lives in the transaction layer.
		const {store, node} = mountedSetup()
		store.props.set({readOnly: true})
		expect(node.update({value: 'bad'})).toBe(false)
		expect(node.remove()).toBe(false)
		expect(store.value.current()).toBe('he@[x]llo')
	})

	it('update() against a dead node is a fail-closed no-op returning false', () => {
		const {store, node} = mountedSetup()
		// Structurally remove the mark and re-bind so its handle is killed.
		store.edit.replace({start: 2, end: 6}, '')
		expect(store.value.current()).toBe('hello')
		const container = document.querySelector('div')!
		container.replaceChildren(document.createElement('span'))
		store.host.rendered()

		const result = node.update({value: 'bad'})
		expect(result).toBe(false)
		expect(store.value.current()).toBe('hello')
	})

	it('update() while a structural apply awaits its bind SUCCEEDS and folds into the pending pass', () => {
		const {store, node} = mountedSetup()
		// Trigger a structural commit but do NOT render() — the pending latch is closed.
		// The fixture ADDS roots on purpose: adoption pairs roots by index, so a
		// whole-value write that keeps the root count ('he@[x]llo' → 'different @[x]')
		// removes nothing, takes the TEXT path and opens no pending window at all. The
		// extra mark keeps the commit structural while the FIRST mark keeps its id, so
		// this still exercises the window rather than a dead mark.
		store.value.current('he@[x]llo@[y]')
		// INVERTED at S1.6d (§4.6 item 4, SEMVER-MAJOR): the write latch is gone. The node
		// is the live object, which has no pending window, and the write folds into the
		// pending structural pass (the pipeline's fold guard).
		const result = node.update({value: 'bad'})
		expect(result).toBe(true)
		expect(store.value.current()).toBe('he@[bad]llo@[y]')
	})

	// Render-path contract: BOTH adapters resolve the node synchronously during render
	// (react useMark inside useMemo, vue useMark inside setup), so the resolution runs in
	// the routine pending window on every structural commit — BEFORE the freshly-painted
	// DOM binds, and the adapter never schedules a re-render once it does. So the
	// resolution must NOT throw there, AND reads must surface the mark's value (not flash
	// empty). A throw here crashes the rendered component (the storybook regression this
	// pins against). The mid-window WRITE is pinned by the case above, which S1.6d inverted.
	it('resolution during the pending window reads the live node, then stays live after bind', () => {
		const {store} = mountedSetup()

		// Structural commit, NO rendered() — the pending latch is closed. The resolution
		// (which both adapters run synchronously during render) must find the node by id.
		// The fixture ADDS roots for the reason spelled out on the mid-window case above: a
		// whole-value write that keeps the root count is a text-path commit and opens no
		// pending window.
		store.value.current('he@[x]llo@[y]')
		const freshToken = store.tokens.renderTree().find(t => t.type === 'mark')!
		const node = markNodeOf(store, freshToken)

		// READ resolves the live node mid-window: the rendered mark shows its value
		// immediately instead of flashing empty until a re-render the adapter never
		// schedules.
		expect(node.value()).toBe('x')

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

		expect(node.value()).toBe('x')
		expect(node.update({value: 'ok'})).toBe(true)
		expect(store.value.current()).toBe('he@[ok]llo@[y]')
	})
})