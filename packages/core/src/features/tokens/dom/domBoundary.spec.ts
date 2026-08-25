import {afterEach, describe, expect, it} from 'vitest'

import {computed} from '../../../shared/signals'
import {
	domModelOf,
	enableStructuralStore,
	mountStructuralInlineMark,
	mountValue,
	mountWithMark,
} from '../__testing__/mountFixtures'
import {offsetOfAnchor} from '../tree/anchors'

/**
 * '@[a @[b] c]' — a mark [0,11] whose slot children ('a ' [2,4], the nested mark [4,8], ' c'
 * [8,10]) hang off a registered child-sequence host, bracketed by the empty text tokens the
 * parse puts at [0,0] and [11,11]. The mark is `nodes()[1]`.
 *
 * Local rather than the shared `mountNested` because the children live inside the HOST, one
 * level below the mark's own element: the shared `consignRendered` pairs a mark's children
 * against the mark ELEMENT's children, which on this shape files the host itself as the first
 * child's text surface — and the per-surface writer then replaces the host's contents with that
 * child's text. Both adapters render the children inside the host (`TokenChildren`), so they are
 * named here one by one.
 */
function mountNestedSlot({extra = false, control = true} = {}) {
	const store = enableStructuralStore('@[a @[b] c]', {options: [{markup: '@[__slot__]'}], Mark: () => null})
	const container = document.createElement('div')
	const leading = document.createElement('span')
	const outer = document.createElement('mark')
	// The CONSUMER'S OWN element, between the mark root and the slot host — the shape both
	// adapters render (`Token` consigns a `display: contents` wrapper, the consumer's `Mark`
	// sits inside it, and `TokenChildren` is the host below that). `bindingsFor` records the
	// host through `contains`, so the extra level changes no host boundary; what it adds is
	// the one element `applyEditableState` leaves BARE on the root→host path.
	const presentation = document.createElement('span')
	const host = document.createElement('span')
	const before = document.createElement('span')
	const inner = document.createElement('mark')
	const after = document.createElement('span')
	const trailing = document.createElement('span')
	host.style.display = 'contents'
	host.append(before, inner, after)
	// `extra` is a consumer's own presentation AMONG the slot children — a per-item button, say.
	// It is what gives the host an interior boundary whose right-hand neighbour belongs to no
	// token, and `control` decides whether the button inside it is registered. That one bit is
	// the whole difference between a neighbour that resolves to a token and one that resolves to
	// `'control'`, which is what selects the fallback.
	if (extra) {
		const box = document.createElement('span')
		const button = document.createElement('button')
		box.append(button)
		host.append(box)
		if (control) store.tokens.control()(button)
	}
	presentation.append(host)
	outer.append(presentation)
	container.append(leading, outer, trailing)
	document.body.append(container)
	store.host.container(container)
	const roots = store.tokens.nodes()
	const owner = roots[1]
	if (owner.kind !== 'mark') throw new Error('expected a mark root')
	// Both registrations are id-keyed, so they come AFTER `host.container` publishes a tree and
	// BEFORE any ref binds against it.
	store.tokens.children(owner.id)(host)
	const rootElements = [leading, outer, trailing]
	roots.forEach((node, index) => store.tokens.consign(node.id)(rootElements[index]))
	const childElements = [before, inner, after]
	owner.children().forEach((child, index) => store.tokens.consign(child.id)(childElements[index]))
	return {store, container, leading, outer, presentation, host, before, inner, after, trailing}
}

/**
 * Block layout: mark "one\n\n" [0,5] with child text "one" [0,3], mark "two\n\n" [5,10] with
 * child text "two" [5,8]. One row div per mark, the mark element holding one text surface.
 *
 * The row and the token element are DIFFERENT elements of the same token and are consigned
 * separately, which is how the adapters register them (`Block` consigns the row, `Token` its own
 * element) and the only way a handle gets a `rowElement`. Local rather than the shared
 * `mountBlock` because `consignRendered` knows only about token elements: it files the row
 * wrapper as the mark's element, so no row is ever registered and the mark's element becomes its
 * child's text surface.
 *
 * `grip` puts a registered control BEFORE the token inside the row. The block controls no longer
 * renders there — it is one layer beside the rows — but a consumer's own `slots.block` may still
 * put a control inside a row, and this is the shape that asks whether a boundary can escape it.
 */
function mountBlockRows({grip = false} = {}) {
	const store = enableStructuralStore('one\n\ntwo\n\n', {
		separator: '\n\n',
		options: [],
	})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)
	const rows: HTMLElement[] = []
	store.tokens.nodes().forEach(node => {
		const row = document.createElement('div')
		if (grip) {
			const handle = document.createElement('div')
			row.append(handle)
			store.tokens.control()(handle)
		}
		const surface = document.createElement('span')
		row.append(surface)
		container.append(row)
		rows.push(row)
		store.tokens.consign(node.id)(row)
		if (node.kind === 'row' && node.children()[0]?.kind === 'text') {
			store.tokens.consign(node.children()[0].id)(surface)
		}
	})
	return {store, container, rows}
}

describe('anchorFor', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('returns undefined for a node outside the container', () => {
		const {store} = mountWithMark()
		const orphan = document.createElement('span')
		expect(store.tokens.anchorFor(orphan, 0)).toBeUndefined()
	})

	it('anchors an empty block document to its single empty row', () => {
		// Rootless documents no longer exist (issue 08): an empty block value IS one
		// empty unterminated row, and the container boundary resolves to it.
		const {store, container} = mountValue('', {separator: '\n\n'})
		expect(store.tokens.anchorFor(container, 0)).toEqual({before: store.tokens.nodes()[0]})
	})

	it('anchors a container boundary before the first root', () => {
		const {store, container} = mountWithMark()
		const roots = store.tokens.nodes()
		expect(store.tokens.anchorFor(container, 0)).toEqual({before: roots[0]})
	})

	it('anchors a container boundary past the last child after the last root', () => {
		const {store, container} = mountWithMark()
		const roots = store.tokens.nodes()
		expect(store.tokens.anchorFor(container, 3)).toEqual({after: roots[2]})
	})

	it('resolves an interior container boundary by affinity', () => {
		const {store, container} = mountWithMark()
		const roots = store.tokens.nodes()
		expect(store.tokens.anchorFor(container, 1, 'before')).toEqual({after: roots[0]})
		expect(store.tokens.anchorFor(container, 1, 'after')).toEqual({before: roots[1]})
	})

	it('anchors a text-surface boundary to the live node and a local offset', () => {
		const {store, text1} = mountWithMark()
		const roots = store.tokens.nodes()
		const textNode = text1.firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a rendered text node')
		expect(store.tokens.anchorFor(textNode, 1)).toEqual({node: roots[0], offset: 1})
	})

	it('anchors the second text surface with an offset local to ITS node, not the document', () => {
		const {store, text2} = mountWithMark()
		const roots = store.tokens.nodes()
		const textNode = text2.firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a rendered text node')
		// The document position here is 7; the anchor must say 1.
		expect(store.tokens.anchorFor(textNode, 1)).toEqual({node: roots[2], offset: 1})
	})

	it('returns undefined for a boundary that splits a surrogate pair', () => {
		const {store, surfaces} = mountValue('\u{1F600}a')
		const textNode = surfaces[0].firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a rendered text node')
		expect(store.tokens.anchorFor(textNode, 1)).toBeUndefined()
	})

	it('holds a text anchor through the adopt→bind window that goes stale numerically', () => {
		const {store, text1, text2} = mountWithMark()
		const dom1 = text1.firstChild
		const dom2 = text2.firstChild
		if (!(dom1 instanceof Text) || !(dom2 instanceof Text)) throw new Error('expected rendered text nodes')

		// Structural (a mark is added), and the commit's own bind can only re-project what is
		// consigned — nothing repaints here, so the DOM stays one generation behind
		// STRUCTURALLY: no element exists for either fresh mark. 'he' shrinks to 'h' in the
		// same edit.
		store.tokens.setValue('h@[x]llo@[z]')
		// The captured node is still the LIVE one and already carries the new text: the
		// surface writer splices in place, so a `Text` reference (and any DOM Range anchored
		// in it) survives a commit instead of being orphaned with pre-edit data. Before that
		// change this read answered 'he' — the detached node's stale content.
		expect(dom1.data).toBe('h')
		expect(dom1.isConnected).toBe(true)

		// G2: the offset is local to a node the edit did not touch, so the anchor is
		// right. The numeric walk deleted at S2.6 added that node's stale
		// `position.start` here and answered 7, where the live document position is 6.
		const roots = store.tokens.nodes()
		expect(store.tokens.anchorFor(dom2, 1)).toEqual({node: roots[2], offset: 1})
		expect(roots[2].range().start + 1).toBe(6)

		// D4's second fail-closed arm: the DOM offset outlives the text it indexes.
		//
		// BLUNTED, and recorded rather than quietly kept: this used to discriminate WHICH length
		// the walk consults, because the detached node still read 'he' (2) while its node read
		// 'h' (1), so only a model-side bound refused. The in-place splice keeps the two equal,
		// so measuring the surface instead would now pass here too. What it still pins is the
		// refusal itself; a case that separates the lengths again needs the DOM to run ahead of
		// the model, which no edit in this file produces.
		expect(store.tokens.anchorFor(dom1, 2)).toBeUndefined()
	})

	it('returns undefined for a node the edit deleted', () => {
		const {store, mark} = mountWithMark()

		// D4's FIRST fail-closed arm — the id bridge misses. Handles are killed by
		// `bind`, not by the apply (bind.ts), so a structural edit with no repaint is
		// the only state where a node stays bound and locatable after leaving the tree.
		store.tokens.setValue('hello')
		expect(store.tokens.nodes().every(node => node.kind === 'text')).toBe(true)

		expect(store.tokens.anchorFor(mark, 0)).toBeUndefined()
	})

	it('anchors a child-sequence boundary at index 0 before the FIRST CHILD', () => {
		// The slot's own start, not the owner's: the mark's boundary is one `@[` outside the
		// content this host holds, and a caret at the host's leading edge can only mean the
		// slot. FLIPPED from `{before: outer}` — the escape that answer bought is pinned end
		// to end below ('X@[a @[b] c]' instead of '@[Xa @[b] c]').
		const {store, host} = mountNestedSlot()
		const outer = store.tokens.nodes()[1]
		if (outer.kind !== 'mark') throw new Error('expected a mark root')
		const first = outer.children()[0]
		expect(store.tokens.anchorFor(host, 0)).toEqual({before: first})
		// The OFFSETS are what make this discriminate: both anchors are legal shapes, and
		// only their projections say which side of the markup the caret landed on.
		expect(offsetOfAnchor(store.tokens.nodes(), {before: first})).toBe(outer.slotRange?.start)
	})

	it('anchors a child-sequence boundary past the last child after the LAST CHILD', () => {
		const {store, host} = mountNestedSlot()
		const outer = store.tokens.nodes()[1]
		if (outer.kind !== 'mark') throw new Error('expected a mark root')
		const last = outer.children()[2]
		expect(store.tokens.anchorFor(host, 3)).toEqual({after: last})
		// The 'before' probe is what makes this case DISCRIMINATING, and it is the only
		// thing that does: the edge answers by SIDE and ignores affinity, while the
		// interior path one `>=`→`>` away answers `{before: owner}` here (no child sits at
		// index 3, so it reaches the inverted fallback). Without this line the mutation is
		// invisible — the default 'after' affinity makes the two paths agree.
		expect(store.tokens.anchorFor(host, 3, 'before')).toEqual({after: last})
		expect(offsetOfAnchor(store.tokens.nodes(), {after: last})).toBe(outer.slotRange?.end)
	})

	it('resolves an interior child boundary to its two neighbours by affinity', () => {
		const {store, host} = mountNestedSlot()
		const outer = store.tokens.nodes()[1]
		if (outer.kind !== 'mark') throw new Error('expected a mark root')
		const [first, second] = outer.children()
		expect(store.tokens.anchorFor(host, 1, 'before')).toEqual({after: first})
		expect(store.tokens.anchorFor(host, 1, 'after')).toEqual({before: second})
	})

	it('falls back to the owner when a neighbour is a registered CONTROL', () => {
		// RE-AIMED, and the reason is worth keeping. This case used to reach the fallback by
		// killing a neighbour NODE while its element stayed bound, which it got by relying on a
		// structural commit not binding before the repaint. Every commit binds now and the bind's
		// kill sweep is tree-driven, so that state is gone and the old fixture takes the paired
		// branch instead.
		//
		// The fallback is NOT dead for it. The line's own comment claimed a dead neighbour was
		// the only door — "`locate` walks up to the nearest bound ancestor, so every child of a
		// bound element resolves to SOMETHING" — and that is false: `#locate` answers
		// `{kind: 'control'}` for a control root and stops walking, and `computeControlRoots`
		// marks every ancestor of a control up to the container. So a neighbour that merely
		// CONTAINS a registered control resolves to no token, with every node alive, every
		// element bound and no timing window anywhere.
		const {store, host} = mountNestedSlot({extra: true})
		const owner = store.tokens.nodes()[1]
		if (owner.kind !== 'mark') throw new Error('expected a mark root')

		// The door, pinned rather than assumed: the extra element among the slot children is a control root.
		expect(store.tokens.handleAt(host.children[3])).toBe('control')

		// The boundary between the last slot child and that element. The answer LEANS INWARD like
		// every other arm: a range END asks with 'before' and gets the owner's far side, so a
		// selection touching this boundary swallows the mark instead of stopping short of it
		// (`beforeInput.ts`'s `anchorsFromTargetRange` is what asks that way).
		expect(store.tokens.anchorFor(host, 3, 'before')).toEqual({after: owner})
		expect(store.tokens.anchorFor(host, 3, 'after')).toEqual({before: owner})

		// THE DISCRIMINATOR: byte-identical shape minus the registration. Both neighbours now
		// resolve — the extra element walks up to the owner — so the PAIRED branch answers with the
		// slot CHILD, not with the owner. That is what makes the pair above a measurement of the
		// fallback line and not of some other return.
		const plain = mountNestedSlot({extra: true, control: false})
		const plainOwner = plain.store.tokens.nodes()[1]
		if (plainOwner.kind !== 'mark') throw new Error('expected a mark root')
		expect(plain.store.tokens.anchorFor(plain.host, 3, 'before')).toEqual({after: plainOwner.children()[2]})
	})

	it('anchors a token-shell boundary to the owner by side', () => {
		// The mark's element, not a text surface: a text token's element IS its
		// `textElement`, so it is the text branch above that answers for one.
		const {store, mark} = mountWithMark()
		const markNode = store.tokens.nodes()[1]
		expect(store.tokens.anchorFor(mark, 0)).toEqual({before: markNode})
		expect(store.tokens.anchorFor(mark, 1)).toEqual({after: markNode})
	})

	it('anchors a mark presentation descendant by affinity', () => {
		const {store, mark} = mountWithMark()
		const markNode = store.tokens.nodes()[1]
		const inner = mark.firstChild
		if (!inner) throw new Error('expected mark presentation content')
		expect(store.tokens.anchorFor(inner, 0, 'after')).toEqual({before: markNode})
		expect(store.tokens.anchorFor(inner, 0, 'before')).toEqual({after: markNode})
	})

	it('takes the NEAR edge of a mark for a boundary read with the collapsed affinity', () => {
		// `'nearest'` is the COLLAPSED reader's affinity and the only one that reads the
		// OFFSET. Chromium puts a click's caret at the clicked character inside the mark's own
		// text; the model owns no position in there, so the answer has to be one of the mark's
		// two edges — and the one the click aimed at is the near one. Four characters, so the
		// midpoint is a real boundary and the TIE rule is visible: 2 of 4 still answers
		// `before`.
		const {store, mark} = mountStructuralInlineMark('ab@[wxyz]cd')
		const inner = mark.appendChild(document.createTextNode('wxyz'))
		const markNode = store.tokens.nodes()[1]

		expect(store.tokens.anchorFor(inner, 0, 'nearest')).toEqual({before: markNode})
		expect(store.tokens.anchorFor(inner, 1, 'nearest')).toEqual({before: markNode})
		expect(store.tokens.anchorFor(inner, 2, 'nearest')).toEqual({before: markNode})
		expect(store.tokens.anchorFor(inner, 3, 'nearest')).toEqual({after: markNode})
		expect(store.tokens.anchorFor(inner, 4, 'nearest')).toEqual({after: markNode})
	})

	it('leaves the RANGED affinities offset-blind inside a mark', () => {
		// THE semantics the near-edge rule must not reach, and the reason it needed an affinity
		// of its own: the ranged reader leans its two ends INWARD so a drag that starts
		// mid-mark swallows the whole mark, and one that ends mid-mark swallows it too —
		// Chromium's own atomic behavior. An offset-aware `'after'` would answer `{after}` for
		// the start at 3 and drop everything left of the click out of the selection.
		const {store, mark} = mountStructuralInlineMark('ab@[wxyz]cd')
		const inner = mark.appendChild(document.createTextNode('wxyz'))
		const markNode = store.tokens.nodes()[1]

		expect(store.tokens.anchorFor(inner, 3, 'after')).toEqual({before: markNode})
		expect(store.tokens.anchorFor(inner, 1, 'before')).toEqual({after: markNode})
	})

	it('returns undefined inside an EXPLICIT editable island in a mark', () => {
		const {store, mark} = mountWithMark()
		const editable = document.createElement('span')
		editable.contentEditable = 'true'
		const inner = document.createTextNode('z')
		editable.append(inner)
		mark.append(editable)
		expect(store.tokens.anchorFor(inner, 0)).toBeUndefined()
		// The island declines BEFORE the near-edge rule gets to measure anything: an explicit
		// editable inside a mark owns its own caret, and a collapsed read must not drag it onto
		// one of the mark's edges.
		expect(store.tokens.anchorFor(inner, 0, 'nearest')).toBeUndefined()
	})

	it('answers a mark EDGE on a slot mark presentation that is merely INHERITED-editable', () => {
		// The island test above reads the `contentEditable` PROPERTY, never `isContentEditable`,
		// and this is its twin: a SLOT mark's root and slot host go BARE by policy
		// (`bind.ts`'s `applyEditableState`), so the consumer's own element between them inherits
		// `isContentEditable === true` from the container. Under the inherited reading EVERY
		// boundary on a slot mark's presentation declined, `SelectionDriver.domAnchors` declined
		// with it, and `dropUnexpressedInput` cancelled the keystroke with no model edit —
		// a silently dropped key. Gated end to end by `Drag.spec`'s "insert at the list mark's
		// near edge when the click lands on the mark's own padding".
		const {store, presentation} = mountNestedSlot()
		const owner = store.tokens.nodes()[1]

		expect(presentation.getAttribute('contenteditable')).toBeNull()
		expect(presentation.isContentEditable).toBe(true)
		expect(store.tokens.anchorFor(presentation, 0, 'nearest')).toEqual({before: owner})
		expect(store.tokens.anchorFor(presentation, 0, 'after')).toEqual({before: owner})
		expect(store.tokens.anchorFor(presentation, 0, 'before')).toEqual({after: owner})
	})

	it('does not subscribe its caller to the text it reads', () => {
		const {store, text1} = mountWithMark()
		const textNode = text1.firstChild
		if (!(textNode instanceof Text)) throw new Error('expected a rendered text node')

		// The walk reads `owner.text()` to bound the local offset, so a caller inside a
		// reactive scope would subscribe to that node's text without the `untracked` at
		// `DomModel.anchorFor`'s entry. CHECKED, and narrower than the pre-cutover note
		// claimed: `SelectionDriver`'s `sync` reaches it from DOM event handlers, where
		// nothing is tracking. This case is therefore the guard's only gate — not a
		// production path — and it has to stay for the guard to mean anything.
		let runs = 0
		const probe = computed(() => {
			runs++
			return store.tokens.anchorFor(textNode, 1)
		})
		expect(probe()).toEqual({node: store.tokens.nodes()[0], offset: 1})
		expect(runs).toBe(1)

		// A TEXT-path edit on that very node: its `text` signal fires, nothing structural.
		store.tokens.replaceBetween(store.tokens.anchorAt(0), store.tokens.anchorAt(2), 'HEY')
		const edited = store.tokens.nodes()[0]
		if (edited.kind !== 'text') throw new Error('expected the first root to stay a text node')
		expect(edited.text()).toBe('HEY')

		probe()
		expect(runs).toBe(1)
	})

	it('anchors a row boundary to its owner by side', () => {
		const {store, rows} = mountBlockRows()
		const second = store.tokens.nodes()[1]
		expect(store.tokens.anchorFor(rows[1], 0)).toEqual({before: second})
		expect(store.tokens.anchorFor(rows[1], 1)).toEqual({after: second})
	})

	it('returns undefined inside a bound element that owns no boundary there', () => {
		// THE final fallthrough: `locate` resolves every node to the nearest element in
		// `byElement`, which holds a token element, a row and a child-sequence host (bind.ts),
		// and each of those has its own arm above. What is left is a node under a ROW but
		// outside that row's token element. Once a row was pairing-relevant that took a
		// contrived shape; now nothing pairs a row's children with anything, so it is the
		// ordinary case — the drop indicators, grip and menu the `Block` renderers put in
		// every row all land here, and the bare Text node below stands in for them.
		const {store, rows} = mountBlockRows()
		const stray = rows[1].appendChild(document.createTextNode(' '))

		expect(store.tokens.handleAt(stray)).toBe(store.tokens.handle(store.tokens.nodes()[1].id))
		expect(store.tokens.anchorFor(stray, 0)).toBeUndefined()
	})
})

function mountStructuralBlockWithControl(value: string) {
	const store = enableStructuralStore(value, {separator: '\n\n'})
	const container = document.createElement('div')
	const row = document.createElement('div')
	const control = document.createElement('button')
	const textSurface = document.createElement('span')
	control.textContent = 'x'
	row.append(control, textSurface)
	container.append(row)
	document.body.append(container)
	store.host.container(container)
	store.tokens.control()(control)
	const [node] = store.tokens.nodes()
	store.tokens.consign(node.id)(row)
	if (node.kind === 'row' && node.children()[0]?.kind === 'text') {
		store.tokens.consign(node.children()[0].id)(textSurface)
	}
	const textNode = textSurface.firstChild
	const controlText = control.firstChild
	if (!(textNode instanceof Text)) throw new Error('Structural block text surface did not render a text node')
	if (!(controlText instanceof Text)) throw new Error('Structural control did not render a text node')
	return {store, container, row, control, controlText, textSurface, textNode}
}

/**
 * Block layout with a drag grip before each row's token — the shape the React and Vue
 * `Block` renderers produce (the drop indicator and the handle precede the token).
 */
function mountBlockWithGrip() {
	return mountBlockRows({grip: true})
}

/**
 * Inline mount whose container holds elements the tree does not own: a registered control
 * before the roots, and the framework's own placeholders between them — an EMPTY TEXT
 * NODE (what a Vue fragment anchors on, and the shipped Vue adapter renders one around
 * every token list) plus a comment (`v-if`). Container children therefore do NOT index
 * the roots: `[control, '', text1, <!---->, mark, text2, '']` against three of them.
 */
function mountInlineWithControl() {
	const store = enableStructuralStore('hello @[x] tail', {Mark: () => null, options: [{markup: '@[__value__]'}]})
	const container = document.createElement('div')
	const control = document.createElement('div')
	const text1 = document.createElement('span')
	const mark = document.createElement('mark')
	const text2 = document.createElement('span')
	container.append(
		control,
		document.createTextNode(''),
		text1,
		document.createComment('v-if'),
		mark,
		text2,
		document.createTextNode('')
	)
	document.body.append(container)
	store.host.container(container)
	store.tokens.control()(control)
	// Consigned by NAME, not by position: the control shares the container with the three roots,
	// so pairing container children against them lands every element one slot out.
	const [first, second, third] = store.tokens.nodes()
	store.tokens.consign(first.id)(text1)
	store.tokens.consign(second.id)(mark)
	store.tokens.consign(third.id)(text2)
	return {store, container, control, text1, mark, text2}
}

describe('anchorFor across elements the tree does not own', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('reads a row boundary against the token element, not child index 0', () => {
		// `[grip, token]`: the boundary before the token is index 1, and 2 — not 1 — is the
		// first one past it. Reading `offset <= 0` as "before" made every real boundary in a
		// gripped row answer the row's END.
		const {store, rows} = mountBlockWithGrip()
		const first = store.tokens.nodes()[0]

		expect(store.tokens.anchorFor(rows[0], 0)).toEqual({before: first})
		expect(store.tokens.anchorFor(rows[0], 1)).toEqual({before: first})
		expect(store.tokens.anchorFor(rows[0], 2)).toEqual({after: first})
	})

	it('places a row caret at the row start, not the row end', () => {
		// END-TO-END, and the regression the parent-coordinate write introduced: a mark row
		// has no text surface, so `placeCaret(0)` lands on the ROW at the token's own index,
		// which the raw-index read answered as "past the token".
		const {store} = mountBlockWithGrip()
		const first = store.tokens.nodes()[0]
		const handle = store.tokens.handle(first.id)
		if (!handle) throw new Error('expected a bound row handle')

		expect(handle.placeCaret(0)).toBe(true)

		expect(store.tokens.domAnchors()?.anchor).toEqual({before: first})
	})

	it('resolves a container boundary through its nearest TOKEN neighbours', () => {
		// Seven children, three roots: no index into `roots` answers any of these.
		const {store, container} = mountInlineWithControl()
		const [text1, mark, text2] = store.tokens.nodes()

		expect(store.tokens.anchorFor(container, 0)).toEqual({before: text1})
		// Past the control and the leading fragment anchor — still the document start.
		expect(store.tokens.anchorFor(container, 2)).toEqual({before: text1})
		expect(store.tokens.anchorFor(container, 3, 'before')).toEqual({after: text1})
		// The comment sits at index 3, so this boundary's left neighbour is two hops away.
		expect(store.tokens.anchorFor(container, 4, 'after')).toEqual({before: mark})
		expect(store.tokens.anchorFor(container, 7)).toEqual({after: text2})
	})

	it('scans past a DEAD neighbour to the nearest live token', () => {
		// Structural with no repaint, so the elements stay bound while their nodes leave the
		// tree — the same window `anchorFor`'s deletion case uses. The boundary between the
		// two dead elements has a live token only two hops to its left; stopping at the dead
		// one answers `'start'`, which is a different position, not a fail-closed.
		const {store, container} = mountWithMark()
		store.tokens.setValue('hello')
		const roots = store.tokens.nodes()

		expect(store.tokens.anchorFor(container, 2)).toEqual({after: roots[0]})
	})

	it('places a caret after a mark at the mark end, not the document end', () => {
		const {store, container} = mountInlineWithControl()
		const roots = store.tokens.nodes()
		const mark = roots[1]

		expect(domModelOf(store.tokens, container).placeCaret({after: mark})).toBe(true)

		// The SHAPE is affinity's, and `domAnchors` is the COLLAPSED reader, which is
		// left-affine at the container arm: the boundary answers from the MARK's side, so the
		// anchor placed comes back verbatim in ONE write. It read `{before: roots[2]}` until
		// the near-edge rule landed — the same POSITION spelled from the other side, but a
		// spelling that placed on into the next root's surface and cost two more writes.
		// The POSITION is what the raw-index read got wrong — it ran off the end of `roots`
		// and answered the document end — and it is the assertion below that proves it.
		const anchor = store.tokens.domAnchors()?.anchor
		expect(anchor).toEqual({after: mark})
		expect(anchor && offsetOfAnchor(roots, anchor)).toBe(offsetOfAnchor(roots, {after: mark}))
	})
})

describe('anchorFor across a control', () => {
	it('returns undefined for selections crossing controls', () => {
		const {store, container, textNode, controlText} = mountStructuralBlockWithControl('hello')
		const selection = window.getSelection()!
		const range = document.createRange()
		range.setStart(textNode, 0)
		range.setEnd(controlText, 1)
		selection.removeAllRanges()
		selection.addRange(range)

		// `locate` answers `'control'` for the end boundary, so the pair never forms.
		expect(store.tokens.domAnchors()).toBeUndefined()
		container.remove()
	})
})