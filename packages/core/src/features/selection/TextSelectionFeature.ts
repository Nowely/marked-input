import {nodeTarget} from '../../shared/checkers'
import {effectScope, effect, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export class TextSelectionFeature {
	#scope?: () => void
	#pressedNode: Node | null = null
	#isPressed = false

	constructor(private store: Store) {}

	enable() {
		if (this.#scope) return

		this.#scope = effectScope(() => {
			listen(document, 'mousedown', e => {
				this.#pressedNode = nodeTarget(e)
				this.#isPressed = true
			})

			listen(document, 'mousemove', e => {
				const container = this.store.refs.container
				if (!container) return
				const isPressed = this.#isPressed
				const isNotInnerSome = !container.contains(this.#pressedNode) || this.#pressedNode !== e.target
				const isInside = window.getSelection()?.containsNode(container, true)

				if (isPressed && isNotInnerSome && isInside) {
					if (this.store.state.selecting() !== 'drag') {
						this.store.state.selecting('drag')
					}
				}
			})

			listen(document, 'mouseup', () => {
				this.#isPressed = false
				this.#pressedNode = null
				if (this.store.state.selecting() === 'drag') {
					const sel = window.getSelection()
					if (!sel || sel.isCollapsed) {
						this.store.state.selecting(undefined)
					}
				}
			})

			listen(document, 'selectionchange', () => {
				if (this.store.state.selecting() !== 'drag') return
				const sel = window.getSelection()
				if (!sel || sel.isCollapsed) {
					this.store.state.selecting(undefined)
				}
			})

			effect(() => {
				const value = this.store.state.selecting()
				if (value !== 'drag') return
				const container = this.store.refs.container
				if (!container) return
				container
					.querySelectorAll<HTMLElement>('[contenteditable="true"]')
					.forEach(el => (el.contentEditable = 'false'))
			})
		})
	}

	disable() {
		if (this.store.state.selecting() === 'drag') {
			this.store.state.selecting(undefined)
		}

		this.#scope?.()
		this.#scope = undefined
		this.#pressedNode = null
		this.#isPressed = false
	}
}