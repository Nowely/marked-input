import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {resolvePath} from '../tokens/tokenIndex'

type KbCtx = Pick<Store, 'selection' | 'props' | 'tokens'>

export function enableArrowNav(store: KbCtx, container: HTMLElement): void {
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
	const handle = active ? store.tokens.handleAt(active) : undefined
	if (!handle || handle === 'control') return false

	const isFocusedOnMarkElement = active === handle.element() && !handle.hasTextSurface()
	const address = handle.address()
	// The handle IS the fresh read: its token carries current positions.
	const token = handle.token()

	if (!isFocusedOnMarkElement) {
		const selection = store.selection.readRaw()
		if (!selection || selection.range.start !== selection.range.end) return false

		const atStart = selection.range.start <= token.position.start
		const atEnd = selection.range.end >= token.position.end
		if (direction === 'prev' && !atStart) return false
		if (direction === 'next' && !atEnd) return false
	}

	const path = address.path
	const siblingIndex = direction === 'prev' ? path[path.length - 1] - 1 : path[path.length - 1] + 1
	const siblingPath = [...path.slice(0, -1), siblingIndex]
	const sibling = resolvePath(store.tokens.tree(), siblingPath)
	if (!sibling) return false

	event.preventDefault()
	// Address-based placement disambiguates the sibling from any neighbouring
	// token that shares a boundary position. Position-only placement would pick
	// the wrong token at text↔mark boundaries. (A stale tree() sibling object is
	// fine: placeAtAddress bridges it to the live handle by identity.)
	return store.selection.placeAtAddress({path: siblingPath, token: sibling}, direction === 'prev' ? 'end' : 'start')
}