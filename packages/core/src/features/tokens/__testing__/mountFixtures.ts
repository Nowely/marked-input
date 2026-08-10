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