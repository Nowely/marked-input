import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import type {NodeAnchor, TreeNode} from '../tokens'
import {anchorEquals} from '../tokens'

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
	const node = store.tokens.find(handle.id)
	if (!node) return

	if (!isFocusedOnMarkElement) {
		// DOM truth, and the FOLDED `undefined` is right here: "no window selection" and "a
		// boundary this layer cannot resolve" both mean the caret's position is unknown, and
		// the pre-S2.5 code bailed on both through the same `!selection` test. Only
		// collapsed-ness needed splitting out, and that is `anchorEquals` — an anchor
		// comparison, not a second `undefined`.
		const anchors = store.selection.domAnchors()
		if (!anchors || !anchorEquals(anchors.anchor, anchors.head)) return
		if (!atBoundary(anchors.anchor, node, direction === 'prev' ? 'start' : 'end')) return
	}

	const sibling = store.tokens.siblingOf(handle.id, direction === 'prev' ? -1 : 1)
	const siblingHandle = sibling ? store.tokens.handle(sibling.id) : undefined
	// The latch-gated `handle(id)` plus `alive()` is the mount check `placeAtHandle` used to
	// run for this caller; the placement itself is now the NODE's, which is what disambiguates
	// the sibling from a neighbour sharing its boundary offset.
	if (!sibling || !siblingHandle?.alive()) return

	event.preventDefault()
	store.selection.selectNode(sibling, direction === 'prev' ? 'end' : 'start')
}

/** Whether the caret names this node's own start/end — the node-identity form of the old `<=`/`>=` on positions. */
function atBoundary(anchor: NodeAnchor, node: TreeNode, boundary: 'start' | 'end'): boolean {
	if (typeof anchor === 'string') return false
	if ('node' in anchor) {
		if (anchor.node !== node) return false
		return anchor.offset === (boundary === 'start' ? 0 : anchor.node.text().length)
	}
	if ('before' in anchor) return boundary === 'start' && anchor.before === node
	return boundary === 'end' && anchor.after === node
}