import {Store} from '../../../store/Store'

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
	const surfaces = store.tokens.current().map(() => {
		const surface = document.createElement('span')
		container.append(surface)
		return surface
	})
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
 * publishes a tree and BEFORE `rendered()` binds against it (the ordering
 * `SelectionController.spec.ts`'s nested fixture documents).
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
	store.tokens.children(store.tokens.nodes()[1].id)(host)
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
	for (let i = 0; i < 2; i++) {
		const row = document.createElement('div')
		const mark = document.createElement('span')
		const text = document.createElement('span')
		mark.append(text)
		row.append(mark)
		container.append(row)
		rows.push(row)
	}
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container, rows}
}