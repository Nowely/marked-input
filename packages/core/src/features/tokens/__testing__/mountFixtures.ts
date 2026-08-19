import {Store} from '../../../store/Store'
import {offsetOfAnchor} from '../tree/anchors'
import type {NodeAnchor, TreeNode} from '../tree/types'

/**
 * A document offset as the anchor `EditController.replace` takes. TEST-ONLY: the production
 * callers name nodes directly (spec S2 §4.5), but a spec whose subject is the WRITE — not
 * the addressing — is clearer stating the offsets it means.
 *
 * `anchorAt` is right-affine and does NOT round-trip: an offset inside a mark's markup
 * resolves to the mark's own boundary. Every call site below picks an offset that lies in a
 * text node or on a root boundary, where it does.
 */
export function anchorsAt(store: Store, start: number, end: number = start): [NodeAnchor, NodeAnchor] {
	return [store.tokens.anchorAt(start), store.tokens.anchorAt(end)]
}

/** Collapse the stored selection onto a document offset — the write half of the deleted `Selection.position`. */
export function caretAt(store: Store, offset: number): void {
	store.tokens.selection.select(store.tokens.anchorAt(offset))
}

/**
 * The stored selection as `{start, end}` offsets — the projection `Selection.range` was
 * until S2.6 (spec S2 D11 deleted it: nothing outside these specs read it).
 *
 * A FRESH read, not a cached computed, which is the whole reason the deleted member needed
 * a generation marker: an anchor that survives an edit unchanged still has to re-resolve
 * against the positions adoption just moved.
 */
export function selectionRange(store: Store): {start: number; end: number} | undefined {
	const anchors = store.tokens.selection.anchors()
	if (!anchors) return undefined
	const roots = store.tokens.nodes()
	const anchor = offsetOfAnchor(roots, anchors.anchor)
	const head = offsetOfAnchor(roots, anchors.head)
	return anchor <= head ? {start: anchor, end: head} : {start: head, end: anchor}
}

/**
 * Consign the elements a fixture built, the way an adapter's refs would.
 *
 * `bind` takes its elements from the consignment registries rather than walking the DOM, so a
 * fixture that renders by hand has to say which element belongs to which token — that IS the
 * adapter's job in production.
 *
 * FLAT PAIRING ONLY, and the limit is deliberate rather than unfinished: it pairs a parent's
 * element children with its tokens in order, so it fits the shapes where a mark's children are its
 * own element children. It CANNOT follow a child-sequence host, because the registry that knows
 * about hosts is private to the model — and a fixture whose slot children live inside a host must
 * name them itself, or the first child is consigned the host and the per-Surface writer replaces
 * the host's contents with that child's text. `mountNested` and `mountBlock` below do exactly
 * that; so does any spec with a bespoke shape.
 */
export function consignRendered(store: Store, container: HTMLElement): void {
	const visit = (nodes: readonly TreeNode[], parent: HTMLElement): void => {
		const elements = Array.from(parent.children).filter((c): c is HTMLElement => c instanceof HTMLElement)
		nodes.forEach((node, index) => {
			// `.at`, not `[]`: `noUncheckedIndexedAccess` is off, so an index read types as
			// non-nullable and the short fixture guard below is linted away as impossible.
			const element = elements.at(index)
			if (!element) return
			store.tokens.consign(node.id)(element)
			if (node.kind !== 'mark') return
			const children = node.children()
			if (children.length > 0) visit(children, element)
		})
	}
	visit(store.tokens.nodes(), container)
}

/** A store seeded from props alone: a tree, no container, so nothing below is mounted. */
export function enableStructuralStore(value: string, props: Parameters<Store['props']['set']>[0] = {}) {
	const store = new Store()
	store.props.set({defaultValue: value, ...props})
	return store
}

/**
 * The DOM half of a single-text-surface mount: one span for the one text token the value
 * parses to. Takes the store rather than the value, because the controlled fixtures build
 * their own with extra props before mounting.
 */
export function mountInline(store: Store) {
	const container = document.createElement('div')
	const textSurface = document.createElement('span')
	container.append(textSurface)
	document.body.append(container)
	store.host.container(container)
	consignRendered(store, container)
	store.host.rendered()
	const textNode = textSurface.firstChild
	if (!(textNode instanceof Text)) throw new Error('Structural text surface did not render a text node')
	return {store, container, textSurface, textNode}
}

/** {@link mountInline} over a plain uncontrolled store. */
export function mountStructuralInline(value: string) {
	return mountInline(enableStructuralStore(value))
}

/**
 * Three bare root elements — text, `<mark>`, text — for a value with one mark. Unlike
 * {@link mountWithMark} the mark element is EMPTY, so it is the fixture for the cases that
 * append their own presentation descendants to it.
 */
export function mountStructuralInlineMark(value = 'hello @[world]') {
	const store = enableStructuralStore(value, {Mark: () => null, options: [{markup: '@[__value__]'}]})
	const container = document.createElement('div')
	const before = document.createElement('span')
	const mark = document.createElement('mark')
	const after = document.createElement('span')
	container.append(before, mark, after)
	document.body.append(container)
	store.host.container(container)
	consignRendered(store, container)
	store.host.rendered()
	return {store, container, before, mark, after}
}

/**
 * Mounted inline fixture: text "he" [0,2], mark "@[x]" [2,6], text "llo" [6,9],
 * one span per top-level token with the mark holding a bare text child.
 *
 * Shared because the DOM↔model mapping suites all need the same bound shape to
 * probe against; the per-token elements are returned so a caller can address a
 * single surface without re-deriving it from `container.childNodes`.
 */
export function mountWithMark() {
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
	consignRendered(store, container)
	store.host.rendered()
	return {store, container, text1, mark, text2}
}

/**
 * Mounted fixture for an arbitrary value: one bare span per top-level token,
 * the shape `bind` expects an adapter to have rendered. Sibling of
 * {@link mountWithMark} for the cases that need a different value or props (a
 * rootless block document, a value with an astral char).
 *
 * The surfaces are appended AFTER `host.container` because their count comes
 * from the parse, which only runs once the container is set; binding happens at
 * `rendered()`, so the DOM is complete by the time it is read.
 */
export function mountValue(value: string, props: Parameters<Store['props']['set']>[0] = {}) {
	const store = new Store()
	store.props.set({defaultValue: value, ...props})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)
	const surfaces = store.tokens.nodes().map(() => {
		const surface = document.createElement('span')
		container.append(surface)
		return surface
	})
	consignRendered(store, container)
	store.host.rendered()
	return {store, container, surfaces}
}

/**
 * Mounted nested fixture: '@[a @[b] c]' — a mark [0,11] whose slot children
 * ('a ' [2,4], the nested mark [4,8], ' c' [8,10]) hang off a registered
 * child-sequence host, the shape an adapter renders for a `__slot__` markup.
 * The parse brackets the mark with empty text tokens [0,0] and [11,11], so the
 * container holds three root elements and the mark is `nodes()[1]`.
 *
 * The host registration is id-keyed, so it has to come AFTER `host.container`
 * publishes a tree and BEFORE `rendered()` binds against it.
 */
export function mountNested() {
	const store = new Store()
	store.props.set({
		defaultValue: '@[a @[b] c]',
		options: [{markup: '@[__slot__]'}],
		Mark: () => null,
	})
	const container = document.createElement('div')
	const leading = document.createElement('span')
	const outer = document.createElement('mark')
	const host = document.createElement('span')
	const before = document.createElement('span')
	const inner = document.createElement('mark')
	const after = document.createElement('span')
	const trailing = document.createElement('span')
	host.style.display = 'contents'
	host.append(before, inner, after)
	outer.append(host)
	container.append(leading, outer, trailing)
	document.body.append(container)
	store.host.container(container)
	const roots = store.tokens.nodes()
	const owner = roots[1]
	if (owner.kind !== 'mark') throw new Error('expected a mark root')
	store.tokens.children(owner.id)(host)
	// Named one by one rather than through `consignRendered`: the slot children live inside the
	// HOST, one level below the mark's own element, which flat pairing cannot express.
	const rootElements = [leading, outer, trailing]
	roots.forEach((node, index) => store.tokens.consign(node.id)(rootElements[index]))
	const childElements = [before, inner, after]
	owner.children().forEach((child, index) => store.tokens.consign(child.id)(childElements[index]))
	store.host.rendered()
	return {store, container, leading, outer, host, before, inner, after, trailing}
}

/**
 * Mounted block fixture (pattern from BlockController.spec.ts): mark "one\n\n"
 * [0,5] with child text "one" [0,3], mark "two\n\n" [5,10] with child text
 * "two" [5,8]. One row div per mark, the mark element holding one text surface;
 * the rows are returned because they are the only handle on the row binding.
 */
export function mountBlock() {
	const store = new Store()
	store.props.set({
		defaultValue: 'one\n\ntwo\n\n',
		layout: 'block',
		Mark: () => null,
		options: [{markup: '__slot__\n\n'}],
	})
	const container = document.createElement('div')
	const rows: HTMLElement[] = []
	const marks: HTMLElement[] = []
	const surfaces: HTMLElement[] = []
	for (let i = 0; i < 2; i++) {
		const row = document.createElement('div')
		const mark = document.createElement('span')
		const text = document.createElement('span')
		mark.append(text)
		row.append(mark)
		container.append(row)
		rows.push(row)
		marks.push(mark)
		surfaces.push(text)
	}
	document.body.append(container)
	store.host.container(container)
	// A ROW and a TOKEN ELEMENT are different elements of the same token, registered separately —
	// `Block` consigns the row, `Token` its own element — and that pairing is the only way a handle
	// gets a `rowElement`. Flat pairing would file the row wrapper as the mark's element instead.
	store.tokens.nodes().forEach((node, index) => {
		store.tokens.consignRow(node.id)(rows[index])
		store.tokens.consign(node.id)(marks[index])
		if (node.kind === 'mark') store.tokens.consign(node.children()[0].id)(surfaces[index])
	})
	store.host.rendered()
	return {store, container, rows}
}