import {htmlChildren, nodeTarget} from '../../shared/checkers'
import type {Store} from '../store/Store'

export class TextSelectionController {
	#mousedownHandler?: (e: MouseEvent) => void
	#mousemoveHandler?: (e: MouseEvent) => void
	#mouseupHandler?: () => void
	#selectionchangeHandler?: () => void
	#pressedNode: Node | null = null
	#isPressed = false

	constructor(private store: Store) {}

	enable() {
		if (this.#mousedownHandler) return

		this.#mousedownHandler = e => {
			this.#pressedNode = nodeTarget(e)
			this.#isPressed = true
		}

		this.#mousemoveHandler = e => {
			const container = this.store.refs.container
			if (!container) return
			const isPressed = this.#isPressed
			const isNotInnerSome = !container.contains(this.#pressedNode) || this.#pressedNode !== e.target
			const isInside = window.getSelection()?.containsNode(container, true)

			if (isPressed && isNotInnerSome && isInside) {
				this.store.state.selecting.set('drag')
			}
		}

		this.#mouseupHandler = () => {
			this.#isPressed = false
			this.#pressedNode = null
			this.store.state.selecting.set(undefined)
		}

		this.#selectionchangeHandler = () => {
			if (this.store.state.selecting.get() !== 'drag') return
			const container = this.store.refs.container
			if (!container) return

			const nodes = htmlChildren(container)
			const preservedState = nodes.map(value => value.contentEditable)

			nodes.forEach(value => (value.contentEditable = 'false'))
			nodes.forEach((value, index) => (value.contentEditable = preservedState[index]))
		}

		document.addEventListener('mousedown', this.#mousedownHandler)
		document.addEventListener('mousemove', this.#mousemoveHandler)
		document.addEventListener('mouseup', this.#mouseupHandler)
		document.addEventListener('selectionchange', this.#selectionchangeHandler)
	}

	disable() {
		if (this.#mousedownHandler) {
			document.removeEventListener('mousedown', this.#mousedownHandler)
			if (this.#mousemoveHandler) document.removeEventListener('mousemove', this.#mousemoveHandler)
			if (this.#mouseupHandler) document.removeEventListener('mouseup', this.#mouseupHandler)
			if (this.#selectionchangeHandler)
				document.removeEventListener('selectionchange', this.#selectionchangeHandler)

			this.#mousedownHandler = undefined
			this.#mousemoveHandler = undefined
			this.#mouseupHandler = undefined
			this.#selectionchangeHandler = undefined
		}

		this.#pressedNode = null
		this.#isPressed = false
	}
}