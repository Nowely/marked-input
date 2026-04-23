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
			const container = store.feature.slots.container()
			if (!container) return
			const currentIsPressed = isPressed
			const isNotInnerSome = !container.contains(pressedNode) || pressedNode !== e.target
			const isInside = window.getSelection()?.containsNode(container, true)

			if (currentIsPressed && isNotInnerSome && isInside) {
				if (store.feature.caret.state.selecting() !== 'drag') {
					store.feature.caret.state.selecting('drag')
				}
			}
		})

		listen(document, 'mouseup', () => {
			isPressed = false
			pressedNode = null
			if (store.feature.caret.state.selecting() === 'drag') {
				const sel = window.getSelection()
				if (!sel || sel.isCollapsed) {
					store.feature.caret.state.selecting(undefined)
				}
			}
		})

		listen(document, 'selectionchange', () => {
			if (store.feature.caret.state.selecting() !== 'drag') return
			const sel = window.getSelection()
			if (!sel || sel.isCollapsed) {
				store.feature.caret.state.selecting(undefined)
			}
		})

		effect(() => {
			const value = store.feature.caret.state.selecting()
			if (value !== 'drag') return
			const container = store.feature.slots.container()
			if (!container) return
			container
				.querySelectorAll<HTMLElement>('[contenteditable="true"]')
				.forEach(el => (el.contentEditable = 'false'))
		})
	})

	return () => {
		if (store.feature.caret.state.selecting() === 'drag') {
			store.feature.caret.state.selecting(undefined)
		}

		scope()
		pressedNode = null
		isPressed = false
	}
}