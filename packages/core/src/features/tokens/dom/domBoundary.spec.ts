import {afterEach, describe, expect, it} from 'vitest'

import {computed} from '../../../shared/signals'
import {enableStructuralStore, mountBlock, mountNested, mountValue, mountWithMark} from '../__testing__/mountFixtures'
import {offsetOfAnchor} from '../tree/anchors'

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

	it('returns start for a boundary in a rootless document', () => {
		// Only block layout can be rootless: inline keeps the empty text token of an
		// empty value, block filters it out.
		const {store, container} = mountValue('', {layout: 'block'})
		expect(store.tokens.anchorFor(container, 0)).toBe('start')
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

		// Structural (a mark is added), so the commit latches for its bind instead of
		// self-healing; no `host.rendered()` follows, so the DOM stays one generation
		// behind. 'he' shrinks to 'h' in the same edit.
		store.tokens.setValue('h@[x]llo@[z]')
		expect(dom1.data).toBe('he')

		// G2: the offset is local to a node the edit did not touch, so the anchor is
		// right. The numeric walk deleted at S2.6 added that node's stale
		// `position.start` here and answered 7, where the live document position is 6.
		const roots = store.tokens.nodes()
		expect(store.tokens.anchorFor(dom2, 1)).toEqual({node: roots[2], offset: 1})
		expect(roots[2].range().start + 1).toBe(6)

		// D4's second fail-closed arm: the DOM offset outlives the text it indexes.
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

	it('anchors a child-sequence boundary at index 0 before the owner', () => {
		const {store, host} = mountNested()
		const outer = store.tokens.nodes()[1]
		expect(store.tokens.anchorFor(host, 0)).toEqual({before: outer})
	})

	it('anchors a child-sequence boundary past the last child after the owner', () => {
		const {store, host} = mountNested()
		const outer = store.tokens.nodes()[1]
		expect(store.tokens.anchorFor(host, 3)).toEqual({after: outer})
		// The 'before' probe is what makes this case DISCRIMINATING, and it is the only
		// thing that does: the edge answers by SIDE and ignores affinity, while the
		// interior path one `>=`→`>` away answers `{before: owner}` here (no child sits at
		// index 3, so it reaches the inverted fallback). Without this line the mutation is
		// invisible — the default 'after' affinity makes the two paths agree.
		expect(store.tokens.anchorFor(host, 3, 'before')).toEqual({after: outer})
	})

	it('resolves an interior child boundary to its two neighbours by affinity', () => {
		const {store, host} = mountNested()
		const outer = store.tokens.nodes()[1]
		if (outer.kind !== 'mark') throw new Error('expected a mark root')
		const [first, second] = outer.children()
		expect(store.tokens.anchorFor(host, 1, 'before')).toEqual({after: first})
		expect(store.tokens.anchorFor(host, 1, 'after')).toEqual({before: second})
	})

	it('falls back to the owner INVERTED when a neighbour left the tree', () => {
		const {store, host} = mountNested()

		// The fallback needs an interior boundary whose two neighbours do not BOTH resolve
		// to live nodes, and a dead neighbour is the only way to get one: `locate` walks up
		// to the nearest bound ancestor, so every child of a bound element resolves to
		// SOMETHING. Structural with no repaint, so the elements stay bound while their
		// nodes leave the tree (the state D4's first fail-closed arm is measured in).
		store.tokens.setValue('@[q]')
		const outer = store.tokens.nodes()[1]
		if (outer.kind !== 'mark') throw new Error('expected the outer mark to survive the edit')
		expect(outer.children()).toHaveLength(1)

		// INVERTED, and this is the only case that gates it: 'before' answers with the
		// owner's START. Reads backwards, preserved verbatim from the numeric projection.
		expect(store.tokens.anchorFor(host, 2, 'before')).toEqual({before: outer})
		expect(store.tokens.anchorFor(host, 2, 'after')).toEqual({after: outer})
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

	it('returns undefined inside an editable descendant of a mark', () => {
		const {store, mark} = mountWithMark()
		const editable = document.createElement('span')
		editable.contentEditable = 'true'
		const inner = document.createTextNode('z')
		editable.append(inner)
		mark.append(editable)
		expect(store.tokens.anchorFor(inner, 0)).toBeUndefined()
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
		const {store, rows} = mountBlock()
		const second = store.tokens.nodes()[1]
		expect(store.tokens.anchorFor(rows[1], 0)).toEqual({before: second})
		expect(store.tokens.anchorFor(rows[1], 1)).toEqual({after: second})
	})

	it('returns undefined inside a bound element that owns no boundary there', () => {
		// THE final fallthrough, and reaching it takes work: `locate` resolves every node to
		// the nearest element in `byElement`, which holds only a token element, a row and a
		// child-sequence host (bind.ts), and each of those has its own arm above. What is
		// left is a node under a ROW but outside that row's token element — and a row admits
		// exactly ONE non-control element (bind.ts's all-or-nothing row alignment), so it can
		// only be a bare Text node beside it: formatting whitespace, or a node contenteditable
		// dropped into the row. The mark arm does not catch it because the mark's element does
		// not contain it, and it is not the row itself.
		const {store, rows} = mountBlock()
		const stray = rows[1].appendChild(document.createTextNode(' '))

		expect(store.tokens.handleAt(stray)).toBe(store.tokens.handle(store.tokens.nodes()[1].id))
		expect(store.tokens.anchorFor(stray, 0)).toBeUndefined()
	})
})

function mountStructuralBlockWithControl(value: string) {
	const store = enableStructuralStore(value, {layout: 'block'})
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
	store.host.rendered()
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
	const store = enableStructuralStore('one\n\ntwo\n\n', {
		layout: 'block',
		Mark: () => null,
		options: [{markup: '__slot__\n\n'}],
	})
	const container = document.createElement('div')
	const rows: HTMLElement[] = []
	const grips: HTMLElement[] = []
	for (let i = 0; i < 2; i++) {
		const row = document.createElement('div')
		const grip = document.createElement('div')
		const mark = document.createElement('span')
		mark.append(document.createElement('span'))
		row.append(grip, mark)
		container.append(row)
		rows.push(row)
		grips.push(grip)
	}
	document.body.append(container)
	store.host.container(container)
	for (const grip of grips) store.tokens.control()(grip)
	store.host.rendered()
	return {store, container, rows}
}

/**
 * Inline mount whose container holds chrome the tree does not own: a registered control
 * before the roots, and the framework's own placeholders between them — an EMPTY TEXT
 * NODE (what a Vue fragment anchors on, and the shipped Vue adapter renders one around
 * every token list) plus a comment (`v-if`). Container children therefore do NOT index
 * the roots: `[control, '', text1, <!---->, mark, text2, '']` against three of them.
 */
function mountInlineWithChrome() {
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
	store.host.rendered()
	return {store, container, control, text1, mark, text2}
}

describe('anchorFor across chrome the tree does not own', () => {
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
		const {store, container} = mountInlineWithChrome()
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
		const {store} = mountInlineWithChrome()
		const roots = store.tokens.nodes()
		const mark = roots[1]

		expect(store.tokens.placeCaret({after: mark})).toBe(true)

		// The SHAPE is affinity's: the DOM boundary after the mark is read right-affine, so
		// it answers from the next root's side. The POSITION is what the raw-index read got
		// wrong — it ran off the end of `roots` and answered the document end.
		const anchor = store.tokens.domAnchors()?.anchor
		expect(anchor).toEqual({before: roots[2]})
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