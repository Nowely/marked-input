import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'host' | 'dom' | 'selection' | 'props' | 'tokens'>

export function enableArrowNav(store: KbCtx): void {
	const container = store.host.container()
	if (!container) return

	listen(container, 'keydown', e => {
		if (store.props.layout.isBlock()) return

		if (e.key === KEYBOARD.LEFT) {
			shiftFocus(store, e, 'prev')
		} else if (e.key === KEYBOARD.RIGHT) {
			shiftFocus(store, e, 'next')
		}

		if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
			if (store.props.layout.isBlock()) return
			e.preventDefault()
			store.selection.selectAll()
		}
	})
}

function shiftFocus(store: KbCtx, event: KeyboardEvent, direction: 'prev' | 'next'): boolean {
	// Resolve the "current" token from the focused DOM element, not from
	// caret.selection. At a position exactly between two tokens the position alone
	// is ambiguous; the active element tells us which token the user is
	// actually standing on.
	const active = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
	const located = active ? store.dom.locateNode(active) : undefined
	if (!located?.ok) return false

	const isFocusedOnMarkElement = active === located.value.tokenElement && !located.value.textElement
	const address = located.value.address

	const token = store.tokens.index().resolveAddress(address)
	if (!token.ok) return false

	if (!isFocusedOnMarkElement) {
		const selection = store.dom.readRawSelection()
		if (!selection.ok || selection.value.range.start !== selection.value.range.end) return false

		const atStart = selection.value.range.start <= token.value.position.start
		const atEnd = selection.value.range.end >= token.value.position.end
		if (direction === 'prev' && !atStart) return false
		if (direction === 'next' && !atEnd) return false
	}

	const path = address.path
	const siblingIndex = direction === 'prev' ? path[path.length - 1] - 1 : path[path.length - 1] + 1
	const siblingPath = [...path.slice(0, -1), siblingIndex]
	const siblingAddress = store.tokens.index().addressFor(siblingPath)
	if (!siblingAddress) return false

	event.preventDefault()
	// Address-based placement disambiguates the sibling from any neighbouring
	// token that shares a boundary position. Position-only placement would pick
	// the wrong token at text↔mark boundaries.
	return store.selection.placeAtAddress(siblingAddress, direction === 'prev' ? 'end' : 'start')
}