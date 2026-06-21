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
			e.preventDefault()
			store.selection.selectAll()
		}
	})
}

function shiftFocus(store: KbCtx, event: KeyboardEvent, direction: 'prev' | 'next'): void {
	// Resolve the "current" token from the focused DOM element, not from
	// caret.selection. At a position exactly between two tokens the position alone
	// is ambiguous; the active element tells us which token the user is
	// actually standing on.
	const active = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
	const handle = active ? store.tokens.handleAt(active) : undefined
	if (!handle || handle === 'control') return

	const isFocusedOnMarkElement = active === handle.element() && !handle.hasTextSurface()
	const path = handle.path()
	// The handle IS the fresh read: its token carries current positions.
	const token = handle.token()

	if (!isFocusedOnMarkElement) {
		const selection = store.selection.readRaw()
		if (!selection || selection.range.start !== selection.range.end) return

		const atStart = selection.range.start <= token.position.start
		const atEnd = selection.range.end >= token.position.end
		if (direction === 'prev' && !atStart) return
		if (direction === 'next' && !atEnd) return
	}

	const siblingIndex = direction === 'prev' ? path[path.length - 1] - 1 : path[path.length - 1] + 1
	const siblingPath = [...path.slice(0, -1), siblingIndex]
	const sibling = resolvePath(store.tokens.current(), siblingPath)
	const siblingHandle = store.tokens.handleOf(sibling)
	if (!siblingHandle) return

	event.preventDefault()
	// Handle-based placement disambiguates the sibling from any neighbouring
	// token that shares a boundary position. Position-only placement would pick
	// the wrong token at text↔mark boundaries. The sibling's id bridges to its
	// live handle; placeAtHandle reads the handle's current positions.
	store.selection.placeAtHandle(siblingHandle, direction === 'prev' ? 'end' : 'start')
	return
}