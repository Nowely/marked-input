import {nodeTarget} from '../../shared/checkers'
import {effectScope, effect, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export function enableSelection(store: Store): () => void {
	let pressedNode: Node | null = null
	let isPressed = false

	const scope = effectScope(() => {
		listen(document, 'mousedown', e => {
			pressedNode = nodeTarget(e)
			isPressed = true
		})

		listen(document, 'mousemove', e => {
			const container = store.dom.container()
			if (!container) return
			const currentIsPressed = isPressed
			const isNotInnerSome = !container.contains(pressedNode) || pressedNode !== e.target
			const isInside = window.getSelection()?.containsNode(container, true)

			if (currentIsPressed && isNotInnerSome && isInside) {
				if (store.caret.selecting() !== 'drag') {
					store.caret.selecting('drag')
				}
			}
		})

		listen(document, 'mouseup', () => {
			isPressed = false
			pressedNode = null
			if (store.caret.selecting() === 'drag') {
				const sel = window.getSelection()
				if (!sel || sel.isCollapsed) {
					store.caret.selecting(undefined)
				}
			}
		})

		listen(document, 'selectionchange', () => {
			const sel = window.getSelection()
			if (store.caret.selecting() === 'drag' && (!sel || sel.isCollapsed)) {
				store.caret.selecting(undefined)
			}
			if (!sel?.focusNode) return

			const result = store.dom.locateNode(sel.focusNode)
			if (!result.ok) {
				if (result.reason === 'control') return
				store.caret.location(undefined)
				return
			}

			const role = result.value.textElement?.contains(sel.focusNode) ? 'text' : 'markDescendant'
			store.caret.location({address: result.value.address, role})
		})

		effect(() => {
			const value = store.caret.selecting()
			if (value !== 'drag') return
			const container = store.dom.container()
			if (!container) return
			container
				.querySelectorAll<HTMLElement>('[contenteditable="true"]')
				.forEach(el => (el.contentEditable = 'false'))
		})
	})

	return () => {
		if (store.caret.selecting() === 'drag') {
			store.caret.selecting(undefined)
		}

		scope()
		pressedNode = null
		isPressed = false
	}
}