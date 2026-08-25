import {afterEach, describe, expect, it} from 'vitest'

import {effect, watch} from '../../../shared/signals'
import {Store} from '../../../store/Store'
import {anchorsAt, selectionRange} from '../__testing__/mountFixtures'
import type {Markup} from '../parser/types'
import type {MarkNode} from './types'

/**
 * Ported from the deleted `MarkController.spec.ts` at S1.7 (plan decision D-d): the class
 * was the second implementation of these semantics once `mark.update`/`remove` moved onto
 * the node, so the behaviors it pinned are the NODE's now. A captured node object is the
 * exact equivalent of the controller's captured id: adoption keeps a node object exactly
 * when it keeps its id.
 */
function firstMark(store: Store): MarkNode {
	const node = store.tokens.nodes().find(root => root.kind === 'mark')
	if (node?.kind !== 'mark') throw new Error('expected a live mark node')
	return node
}

/**
 * Mounted fixture: one span per top-level token (marks render childless),
 * bound by their refs. The model resolves through the live node layer, so the
 * verbs need a bound store — there is no headless resolution path.
 */
function setup(value = 'hello @[world]', markup: Markup = '@[__value__]') {
	const store = new Store()
	store.props.set({separator: null, defaultValue: value, Mark: () => null, options: [{markup}]})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)
	container.replaceChildren(...store.tokens.nodes().map(() => document.createElement('span')))
	return {store, node: firstMark(store)}
}

/**
 * Mounted fixture: text 'he' [0,2], mark '@[x]' [2,6], text 'llo' [6,9] —
 * with a bound DOM, so text-path edits patch in place and the identity
 * bridge is live.
 */
function mountedSetup() {
	const store = new Store()
	store.props.set({separator: null, defaultValue: 'he@[x]llo', options: [{markup: '@[__value__]'}], Mark: () => null})
	const container = document.createElement('div')
	const text1 = document.createElement('span')
	const mark = document.createElement('span')
	mark.append(document.createTextNode('x'))
	const text2 = document.createElement('span')
	container.append(text1, mark, text2)
	document.body.append(container)
	store.host.container(container)
	return {store, node: firstMark(store)}
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

		expect(store.tokens.value()).toBe('hello ')
	})

	it('updates mark value through descriptor serialization', () => {
		const {store, node} = setup()

		node.update({value: 'markput'})

		expect(store.tokens.value()).toBe('hello @[markput]')
	})

	it('pulses committed exactly once on a value-only change, which moves no root list', () => {
		// THE VALUE-ONLY commit: `render` is true, `structural` is false. Adoption writes `roots`
		// only when the root list changes by reference, so this one leaves the tree read, the id
		// space and the element set untouched — it is precisely the commit a DOM clock is blind to.
		// The reorder case below pins the same count for a move; this is the shape nothing else here
		// gates. It read the clock through the public handle until the handle stopped carrying one.
		const {store, node} = setup()
		const before = store.tokens.nodes()
		let committed = 0
		watch(store.tokens.committed, () => committed++)

		expect(node.update({value: 'markput'})).toBe(true)

		expect(committed).toBe(1)
		expect(store.tokens.nodes()).toBe(before)
	})

	it('clears metadata without leaking placeholder text', () => {
		const {store, node} = setup('hello @[world](meta)', '@[__value__](__meta__)')

		node.update({meta: null})

		expect(store.tokens.value()).toBe('hello @[world]()')
		expect(store.tokens.value()).not.toContain('__meta__')
	})

	it('preserves an unpatched META when only the value changes', () => {
		// The `null`-vs-omitted split (plan decision D-b) needs BOTH directions pinned: this
		// one dies if `serializeMark` (`seam/TokenModel.ts`) treats an omitted key as a clear.
		const {store, node} = setup('hello @[world](keep)', '@[__value__](__meta__)')

		node.update({value: 'other'})

		expect(store.tokens.value()).toBe('hello @[other](keep)')
	})

	it('sets meta from a plain string', () => {
		const {store, node} = setup('hello @[world]()', '@[__value__](__meta__)')

		node.update({meta: 'user:1'})

		expect(store.tokens.value()).toBe('hello @[world](user:1)')
	})

	it('preserves an unpatched slot when only the value changes', () => {
		// The slot default is DERIVED — `slot()` joins the live children, because
		// `MarkNode.slotRange` stores positions only. Dropping the derivation was a silent
		// pass before this case existed.
		const {store, node} = setup('hi @[user](inner)', '@[__value__](__slot__)')

		node.update({value: 'other'})

		expect(store.tokens.value()).toBe('hi @[other](inner)')
	})

	it('clears slot content without leaking placeholder text', () => {
		const {store, node} = setup('#[nested]', '#[__slot__]')

		node.update({slot: null})

		expect(store.tokens.value()).not.toContain('__slot__')
	})

	it('fails closed when the mark is gone from the value', () => {
		const {store, node} = setup()
		// Wholesale replacement WITHOUT a successor mark: the identity dies, so the captured
		// node is no longer reachable from the roots — the mutation must no-op.
		// (A replacement mark of the same descriptor in the same slot would INHERIT
		// the identity instead — continuity the id bridge deliberately preserves;
		// see 'same-slot replacement inherits identity'.)
		store.tokens.setValue('different text')

		node.update({value: 'bad'})
		expect(store.tokens.value()).toBe('different text')
	})

	it('does not mutate in read-only mode', () => {
		const {store, node} = setup()
		store.props.set({separator: null, readOnly: true})

		node.remove()
		expect(store.tokens.value()).toBe('hello @[world]')
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
		const {store, node} = mountedSetup()

		// Preceding text edit: 'he@[x]llo' → 'XXhe@[x]llo' — text path
		// (text node text changed; mark + tail shifted by +2)
		store.edit.replace(...anchorsAt(store, 0, 0), 'XX')
		expect(store.tokens.value()).toBe('XXhe@[x]llo')
		// Sanity: the captured node SURVIVED the shift and moved with it — the whole reason
		// a captured node is safe where the deleted snapshot's captured token was not.
		expect(firstMark(store)).toBe(node)
		expect(node.range()).toEqual({start: 4, end: 8})

		node.update({value: 'markput'})

		// The mark now lives at [4,8]; replacing the captured [2,6] would
		// corrupt the value ('XX@[markput]e@[x]llo'-style), no-opping would drop the edit
		expect(store.tokens.value()).toBe('XXhe@[markput]llo')
	})

	it('remove() after a preceding text edit removes the shifted (correct) range', () => {
		const {store, node} = mountedSetup()

		store.edit.replace(...anchorsAt(store, 0, 0), 'XX')
		expect(store.tokens.value()).toBe('XXhe@[x]llo')

		node.remove()

		expect(store.tokens.value()).toBe('XXhello')
	})

	it('survives several consecutive text-path commits before mutating', () => {
		const {store, node} = mountedSetup()

		store.edit.replace(...anchorsAt(store, 0, 0), 'X')
		store.edit.replace(...anchorsAt(store, 1, 1), 'Y')
		store.edit.replace(...anchorsAt(store, 2, 2), 'Z')
		expect(store.tokens.value()).toBe('XYZhe@[x]llo')

		node.update({value: 'ok'})

		expect(store.tokens.value()).toBe('XYZhe@[ok]llo')
	})

	it('still fails closed once the mark is structurally removed', () => {
		const {store, node} = mountedSetup()

		// Remove the mark entirely: structural path; the identity is gone.
		store.edit.replace(...anchorsAt(store, 2, 6), '')
		expect(store.tokens.value()).toBe('hello')

		// Render the new tree so bind kills the removed mark's handle: the node has left
		// the roots, so the liveness walk misses and update() fails closed.
		const container = document.querySelector('div')!
		container.replaceChildren(document.createElement('span'))

		expect(store.tokens.handle(node.id)).toBeUndefined()

		node.update({value: 'bad'})

		expect(store.tokens.value()).toBe('hello')
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
		store.tokens.setValue('different @[x]')

		// Paint the FULL render tree (text, value-only mark, trailing empty text)
		// and complete the handshake — bind re-resolves the inherited-id mark in
		// place onto the new surface. A short-count repaint would bail the frame
		// (all-or-nothing alignment) and leave every handle unbound.
		const container = document.querySelector('div')!
		const spans = store.tokens.nodes().map(node => {
			const span = document.createElement('span')
			if (node.kind === 'mark') span.append(document.createTextNode(node.value()))
			return span
		})
		container.replaceChildren(...spans)

		// The ORIGINAL captured node applies — it survived the inheriting commit
		// (NOT re-derived from the fresh token).
		node.update({value: 'probe'})

		expect(store.tokens.value()).toBe('different @[probe]')
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
		store.edit.replace(...anchorsAt(store, 0, 0), 'XX')
		expect(store.tokens.value()).toBe('XXhe@[x]llo')
		// The node's value is a LIVE read of the (shifted, same-value) mark.
		expect(node.value()).toBe('x')
	})

	it('update() reflects a value change made through the node itself (live read)', () => {
		const {store, node} = mountedSetup()
		node.update({value: 'y'})
		expect(store.tokens.value()).toBe('he@[y]llo')
		// After the structural commit re-binds, the live read sees the new value.
		const container = document.querySelector('div')!
		const text1 = document.createElement('span')
		const markEl = document.createElement('span')
		markEl.append(document.createTextNode('y'))
		const text2 = document.createElement('span')
		container.replaceChildren(text1, markEl, text2)
		expect(node.value()).toBe('y')
	})

	it('meta and slot are live reads (parity table)', () => {
		const store = new Store()
		store.props.set({
			separator: null,
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
		const node = firstMark(store)
		expect(node.value()).toBe('v')
		expect(node.meta()).toBe('m')
		expect(node.slot()).toBeUndefined()
	})

	it('both write verbs fail closed the moment readOnly flips', () => {
		// `readOnly` LEFT the mark surface at S1.7 (§2.3 does not put editor state on a node),
		// so what is left to pin is the gating itself, which lives in the transaction layer.
		const {store, node} = mountedSetup()
		store.props.set({separator: null, readOnly: true})
		expect(node.update({value: 'bad'})).toBe(false)
		expect(node.remove()).toBe(false)
		expect(store.tokens.value()).toBe('he@[x]llo')
	})

	it('update() against a dead node is a fail-closed no-op returning false', () => {
		const {store, node} = mountedSetup()
		// Structurally remove the mark and re-bind so its handle is killed.
		store.edit.replace(...anchorsAt(store, 2, 6), '')
		expect(store.tokens.value()).toBe('hello')
		const container = document.querySelector('div')!
		container.replaceChildren(document.createElement('span'))

		const result = node.update({value: 'bad'})
		expect(result).toBe(false)
		expect(store.tokens.value()).toBe('hello')
	})

	it('update() while a structural apply awaits its bind SUCCEEDS and folds into the pending pass', () => {
		const {store, node} = mountedSetup()
		// Trigger a structural commit but do NOT render() — the pending latch is closed.
		// The fixture ADDS roots on purpose: adoption pairs roots by index, so a
		// whole-value write that keeps the root count ('he@[x]llo' → 'different @[x]')
		// removes nothing, takes the TEXT path and opens no pending window at all. The
		// extra mark keeps the commit structural while the FIRST mark keeps its id, so
		// this still exercises the window rather than a dead mark.
		store.tokens.setValue('he@[x]llo@[y]')
		// INVERTED at S1.6d (§4.6 item 4, SEMVER-MAJOR): the write latch is gone. The node
		// is the live object, which has no pending window, and the write folds into the
		// pending structural pass (the pipeline's fold guard).
		const result = node.update({value: 'bad'})
		expect(result).toBe(true)
		expect(store.tokens.value()).toBe('he@[bad]llo@[y]')
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

		// Structural commit and NO repaint, so nothing is re-consigned. The resolution
		// (which both adapters run synchronously during render) must find the node by id.
		// The fixture ADDS roots for the reason spelled out on the mid-window case above: a
		// whole-value write that keeps the root count is a text-path commit and opens no
		// pending window.
		store.tokens.setValue('he@[x]llo@[y]')
		const node = firstMark(store)

		// READ resolves the live node mid-window: the rendered mark shows its value
		// immediately instead of flashing empty until a re-render the adapter never
		// schedules.
		expect(node.value()).toBe('x')

		// Paint the render tree and complete the handshake — the same-id handle
		// binds and reads/writes go live WITHOUT re-derivation.
		const container = document.querySelector('div')!
		const spans = store.tokens.nodes().map(node => {
			const span = document.createElement('span')
			if (node.kind === 'mark') span.append(document.createTextNode(node.value()))
			return span
		})
		container.replaceChildren(...spans)

		expect(node.value()).toBe('x')
		expect(node.update({value: 'ok'})).toBe(true)
		expect(store.tokens.value()).toBe('he@[ok]llo@[y]')
	})
})

/**
 * Block rows (issue 08): paragraph rows need no markup at all — the separator is
 * structural, every root is a RowNode, and the boundary `mergeWith` removes is the
 * first row's own separator. The trailing empty piece is a row too, so a value
 * ending in a separator carries one more root than it used to.
 */
function rowSetup(value: string) {
	const store = new Store()
	store.props.set({defaultValue: value, separator: '\n\n', Mark: () => null, options: []})
	store.host.container(document.createElement('div'))
	return store
}

describe('mergeWith', () => {
	it('deletes the first row separator and joins the rows', () => {
		const store = rowSetup('a\n\nb\n\n')
		const [a, b] = store.tokens.nodes()

		expect(a.mergeWith(b)).toBe(true)

		// The composer's own answers, carried over from the deleted `mergeDragRows` specs.
		expect(store.tokens.value()).toBe('ab\n\n')
		expect(store.tokens.selection.anchors()).toBeDefined()
	})

	it('merging into an EMPTY previous row drops its separator entirely', () => {
		const store = rowSetup('\n\nb\n\n')
		const [a, b] = store.tokens.nodes()

		expect(a.mergeWith(b)).toBe(true)
		expect(store.tokens.value()).toBe('b\n\n')
	})

	it('leaves the rows before and after the merged pair untouched', () => {
		const store = rowSetup('a\n\nb\n\nc\n\n')
		const rows = store.tokens.nodes()
		const first = rows[0].id

		expect(rows[1].mergeWith(rows[2])).toBe(true)

		expect(store.tokens.value()).toBe('a\n\nbc\n\n')
		expect(store.tokens.nodes()[0].id).toBe(first)
	})

	it('keeps the FIRST row identity and retires the second', () => {
		const store = rowSetup('a\n\nb\n\n')
		const [a, b] = store.tokens.nodes()
		const [kept, retired] = [a.id, b.id]

		expect(a.mergeWith(b)).toBe(true)

		// `a` survives because it re-pairs at its own index — a row pairs on kind alone; a
		// whole-document rewrite could promise neither half of this. The second root is the
		// merged pair; the trailing empty row stays.
		const after = store.tokens.nodes()
		expect(after).toHaveLength(2)
		expect(after[0].id).toBe(kept)
		expect(kept).not.toBe(retired)
	})

	it('answers false when the pair has no boundary to remove', () => {
		const store = new Store()
		store.props.set({
			separator: null,
			defaultValue: 'he@[x]llo',
			Mark: () => null,
			options: [{markup: '@[__value__]'}],
		})
		store.host.container(document.createElement('div'))
		const rows = store.tokens.nodes()

		// Text next to a value-only mark: neither side is slot-leading, so there is no
		// trailing literal holding them apart.
		expect(rows[0].mergeWith(rows[1])).toBe(false)
		expect(store.tokens.value()).toBe('he@[x]llo')
	})
})
describe('row removal and duplication at the document end (review findings)', () => {
	it('removing the document-final row takes the previous separator with it', () => {
		const store = rowSetup('alpha\n\nbeta')
		const rows = store.tokens.nodes()
		expect(rows).toHaveLength(2)

		expect(rows[1].remove()).toBe(true)

		expect(store.tokens.value()).toBe('alpha')
		expect(store.tokens.nodes()).toHaveLength(1)
	})

	it('removing the trailing empty row deletes the previous separator', () => {
		const store = rowSetup('alpha\n\n')
		const rows = store.tokens.nodes()
		expect(rows).toHaveLength(2)

		expect(rows[1].remove()).toBe(true)

		expect(store.tokens.value()).toBe('alpha')
		expect(store.tokens.nodes()).toHaveLength(1)
	})

	it('refuses to remove the only empty row', () => {
		const store = rowSetup('')
		const row = store.tokens.nodes()[0]

		// Nothing to remove: a zero-width splice would only fire onChange with the
		// unchanged value.
		expect(row.remove()).toBe(false)
		expect(store.tokens.value()).toBe('')
		expect(store.tokens.nodes()).toHaveLength(1)
	})

	it('duplicating the document-final row yields two rows, not a fused one', () => {
		const store = rowSetup('alpha\n\nbeta')

		expect(store.tokens.nodes()[1].duplicate()).toBe(true)

		expect(store.tokens.value()).toBe('alpha\n\nbeta\n\nbeta')
		expect(store.tokens.nodes()).toHaveLength(3)
	})
})

/**
 * The ADR-0007 oracle for the three verbs that are not `moveTo` (which has its own describe
 * below): the SURVIVORS name which row a verb actually addressed, where the value alone
 * cannot — the two candidates compose to the same string. Both adapters key rendering on
 * `node.id`, and a consumer's own row component and its local state ride that key, so this is
 * the property they depend on rather than an internal detail.
 */
describe('row identity across the structural verbs', () => {
	it('removes the addressed row, not a byte-identical neighbour', () => {
		const store = rowSetup('First\n\nFirst\n\nSecond\n\n')
		const [first, second, third, tail] = store.tokens.nodes().map(node => node.id)

		expect(store.tokens.nodes()[0].remove()).toBe(true)

		expect(store.tokens.value()).toBe('First\n\nSecond\n\n')
		expect(store.tokens.nodes().map(node => node.id)).toEqual([second, third, tail])
		expect(first).not.toBe(second)
		// A removal takes a position out of the document, so the caret is told where it went:
		// the start of the row that replaced the deleted one.
		expect(selectionRange(store)).toEqual({start: 0, end: 0})
	})

	it('writes value and caret as a single batched tick', () => {
		const store = rowSetup('alpha\n\nbeta\n\n')
		let runs = 0
		const dispose = effect(() => {
			store.tokens.value()
			selectionRange(store)
			runs++
		})
		const initial = runs

		expect(store.tokens.nodes()[0].remove()).toBe(true)

		expect(runs - initial).toBe(1)
		dispose()
	})

	it('keeps the original row when it is duplicated', () => {
		const store = rowSetup('alpha\n\nbeta\n\n')
		const [alpha, beta] = store.tokens.nodes().map(node => node.id)

		expect(store.tokens.nodes()[0].duplicate()).toBe(true)

		expect(store.tokens.value()).toBe('alpha\n\nalpha\n\nbeta\n\n')
		expect(selectionRange(store)).toEqual({start: 7, end: 7})
		// ...and only the copy is new: a whole-document rewrite could not promise this.
		const after = store.tokens.nodes().map(node => node.id)
		expect(after[0]).toBe(alpha)
		expect(after[2]).toBe(beta)
		expect(after[1]).not.toBe(alpha)
	})

	it('keeps every existing row when one is added below', () => {
		const store = rowSetup('alpha\n\nbeta\n\n')
		const [alpha, beta] = store.tokens.nodes().map(node => node.id)

		expect(store.tokens.nodes()[0].insertAfter('\n\n')).toBe(true)

		expect(store.tokens.value()).toBe('alpha\n\n\n\nbeta\n\n')
		expect(selectionRange(store)).toEqual({start: 7, end: 7})
		const after = store.tokens.nodes().map(node => node.id)
		expect(after[0]).toBe(alpha)
		expect(after[2]).toBe(beta)
	})
})

describe('moveTo', () => {
	it('carries the row identity to its new index', () => {
		const store = rowSetup('alpha\n\nbeta\n\ngamma\n\n')
		const [a, b, c, tail] = store.tokens.nodes().map(node => node.id)

		expect(store.tokens.nodes()[0].moveTo(2)).toBe(true)

		expect(store.tokens.value()).toBe('beta\n\ngamma\n\nalpha\n\n')
		expect(store.tokens.nodes().map(node => node.id)).toEqual([b, c, a, tail])
	})

	it('carries identity across BYTE-IDENTICAL rows, where the string says nothing at all', () => {
		// THE case this channel exists for. The document before and after is the same string,
		// so no diff of any kind could distinguish this move from a no-op — the difference is
		// entirely in which row was grabbed.
		const store = rowSetup('First\n\nFirst\n\nSecond\n\n')
		const [a, b, c, tail] = store.tokens.nodes().map(node => node.id)

		expect(store.tokens.nodes()[0].moveTo(1)).toBe(true)

		expect(store.tokens.value()).toBe('First\n\nFirst\n\nSecond\n\n')
		expect(store.tokens.nodes().map(node => node.id)).toEqual([b, a, c, tail])
	})

	it('pulses each clock exactly once at the move', () => {
		// A reorder leaves the id space and the element set untouched, so only `committed` — the
		// MODEL clock — can see it as a change at all. `bound` answers the other question (does
		// every handle match an element in the document), and since bind became an effect it
		// answers it in the same synchronous step rather than waiting for a paint. What the split
		// still buys is the reverse direction: a consignment with no commit pulses `bound` alone.
		const store = rowSetup('alpha\n\nbeta\n\n')
		let committed = 0
		let bound = 0
		watch(store.tokens.committed, () => committed++)
		watch(store.tokens.bound, () => bound++)

		expect(store.tokens.nodes()[0].moveTo(1)).toBe(true)

		expect([committed, bound]).toEqual([1, 1])
	})

	it('keeps the selection anchored to the character it was on', () => {
		const store = rowSetup('alpha\n\nbeta\n\n')
		const first = store.tokens.nodes()[0]
		if (first.kind !== 'row') throw new Error('expected a row')
		const slot = first.children()[0]
		if (slot.kind !== 'text') throw new Error('expected a row text child')
		store.tokens.selection.select({node: slot, offset: 2})

		expect(first.moveTo(1)).toBe(true)

		// The anchor is node-relative and the node travelled, so the caret is still inside
		// 'alpha' at 2 — now at a different document offset.
		const anchor = store.tokens.selection.anchors()?.anchor
		if (!anchor || typeof anchor === 'string' || !('node' in anchor)) throw new Error('expected a text anchor')
		expect(anchor.node).toBe(slot)
		expect(anchor.offset).toBe(2)
	})

	it('keeps every row object when the document-final unterminated row moves', () => {
		// THE pairing × terminator guard (issue 08): the move flips `terminated` on two
		// rows — the one leaving the final position gains a separator, the one landing
		// there loses its own. Strict pair equality would reject the pairing and identity
		// would silently degrade to index pairing — the exact ADR-0007 failure mode.
		const store = rowSetup('alpha\n\nbeta\n\ngamma')
		const before = store.tokens.nodes()
		expect(before.map(node => node.kind)).toEqual(['row', 'row', 'row'])

		expect(before[2].moveTo(0)).toBe(true)

		// movePlan re-emits the span separator-normalized, so no pair of rows fuses.
		expect(store.tokens.value()).toBe('gamma\n\nalpha\n\nbeta')
		const after = store.tokens.nodes()
		expect(after[0]).toBe(before[2])
		expect(after[1]).toBe(before[0])
		expect(after[2]).toBe(before[1])
	})

	it('refuses a no-op, an out-of-range index, a non-root and read-only', () => {
		const store = rowSetup('alpha\n\nbeta\n\n')
		const rows = store.tokens.nodes()
		const first = rows[0]
		if (first.kind !== 'row') throw new Error('expected a row')

		expect(first.moveTo(0)).toBe(false)
		expect(first.moveTo(3)).toBe(false)
		expect(first.moveTo(-1)).toBe(false)
		// A row child is not a root, so `indexOf` answers -1 — the liveness check and the
		// index in one read.
		expect(first.children()[0].moveTo(1)).toBe(false)
		expect(store.tokens.value()).toBe('alpha\n\nbeta\n\n')

		store.props.set({
			defaultValue: 'alpha\n\nbeta\n\n',
			separator: '\n\n',
			readOnly: true,
			Mark: () => null,
			options: [],
		})
		expect(store.tokens.nodes()[0].moveTo(1)).toBe(false)
	})
})
describe('entering a fresh row', () => {
	/**
	 * A markup with a LITERAL PREFIX — the only shape that can tell the three old new-row caret
	 * conventions apart. A paragraph row's first text child starts at the row start, so all
	 * three coincide there and the unification is invisible.
	 */
	function headingSetup(value: string) {
		const store = new Store()
		store.props.set({
			defaultValue: value,
			separator: '\n\n',
			Mark: () => null,
			options: [{markup: '# __slot__', row: {Component: 'h1'}}],
		})
		store.host.container(document.createElement('div'))
		return store
	}

	it('lands INSIDE the slot, not at the row start', () => {
		const store = headingSetup('# a\n\n# b\n\n')

		expect(store.tokens.nodes()[0].insertAfter('# \n\n')).toBe(true)

		expect(store.tokens.value()).toBe('# a\n\n# \n\n# b\n\n')
		// The fresh row spans [5,9] and its slot is the zero-width text node at 7. The old rule
		// answered 5 — before the '# ' literal, where the next keystroke corrupts the markup.
		expect(selectionRange(store)).toEqual({start: 7, end: 7})
	})

	it('lands inside the slot of a whole-value replacement too', () => {
		const store = headingSetup('# a\n\n')

		expect(store.tokens.setValue('# \n\n', 0)).toBe(true)

		expect(selectionRange(store)).toEqual({start: 2, end: 2})
	})
})