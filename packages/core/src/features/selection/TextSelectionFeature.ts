import {nodeTarget} from '../../shared/checkers'
import {effectScope, effect} from '../../shared/signals/index.js'
import type {Store} from '../store/Store'

export class TextSelectionFeature {
	#mousedownHandler?: (e: MouseEvent) => void
	#mousemoveHandler?: (e: MouseEvent) => void
	#mouseupHandler?: () => void
	#selectionchangeHandler?: () => void
	#scope?: () => void
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
				if (this.store.state.selecting.get() !== 'drag') {
					this.store.state.selecting.set('drag')
				}
			}
		}

		this.#mouseupHandler = () => {
			this.#isPressed = false
			this.#pressedNode = null
			if (this.store.state.selecting.get() === 'drag') {
				const sel = window.getSelection()
				if (!sel || sel.isCollapsed) {
					this.store.state.selecting.set(undefined)
				}
			}
		}

		this.#selectionchangeHandler = () => {
			if (this.store.state.selecting.get() !== 'drag') return
			const sel = window.getSelection()
			if (!sel || sel.isCollapsed) {
				this.store.state.selecting.set(undefined)
			}
		}

		this.#scope = effectScope(() => {
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

		document.addEventListener('mousedown', this.#mousedownHandler)
		document.addEventListener('mousemove', this.#mousemoveHandler)
		document.addEventListener('mouseup', this.#mouseupHandler)
		document.addEventListener('selectionchange', this.#selectionchangeHandler)
	}

	disable() {
		if (this.store.state.selecting.get() === 'drag') {
			// Set state before unsubscribing so ContentEditableFeature.sync() still fires
			this.store.state.selecting.set(undefined)
		}

		this.#scope?.()
		this.#scope = undefined

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