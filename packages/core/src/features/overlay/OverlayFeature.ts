import {KEYBOARD} from '../../shared/constants'
import {effectScope, watch} from '../../shared/signals/index.js'
import type {OverlayTrigger} from '../../shared/types'
import {TriggerFinder} from '../caret'
import type {Store} from '../store/Store'

export class OverlayFeature {
	#scope?: () => void
	#selectionChangeHandler?: () => void
	#focusinHandler?: (e: FocusEvent) => void
	#focusoutHandler?: (e: FocusEvent) => void
	#escHandler?: (e: KeyboardEvent) => void
	#clickHandler?: (e: MouseEvent) => void

	constructor(private store: Store) {}

	enable() {
		if (this.#scope) return

		this.#scope = effectScope(() => {
			watch(this.store.on.clearOverlay, () => {
				this.store.state.overlayMatch.set(undefined)
			})

			watch(this.store.on.checkOverlay, () => {
				const getTrigger = this.store.state.overlayTrigger.get()
				if (!getTrigger) return
				const match = TriggerFinder.find(this.store.state.options.get(), getTrigger)
				this.store.state.overlayMatch.set(match)
			})

			watch(this.store.on.change, () => {
				const showOverlayOn = this.store.state.showOverlayOn.get()
				const type: OverlayTrigger = 'change'

				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.store.on.checkOverlay.emit()
				}
			})

			watch(this.store.state.overlayMatch, match => {
				if (match) {
					this.store.nodes.input.target = this.store.nodes.focus.target
					this.#enableClose()
				} else {
					this.#disableClose()
				}
			})
		})

		const selectionChangeHandler = () => {
			const showOverlayOn = this.store.state.showOverlayOn.get()
			const type: OverlayTrigger = 'selectionChange'

			if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
				this.store.on.checkOverlay.emit()
			}
		}
		this.#selectionChangeHandler = selectionChangeHandler

		this.#focusinHandler = () => {
			document.addEventListener('selectionchange', selectionChangeHandler)
		}

		this.#focusoutHandler = () => {
			document.removeEventListener('selectionchange', selectionChangeHandler)
		}

		const container = this.store.refs.container
		if (container) {
			container.addEventListener('focusin', this.#focusinHandler)
			container.addEventListener('focusout', this.#focusoutHandler)
		}
	}

	disable() {
		const container = this.store.refs.container

		if (container && this.#focusinHandler) {
			container.removeEventListener('focusin', this.#focusinHandler)
			if (this.#focusoutHandler) container.removeEventListener('focusout', this.#focusoutHandler)
		}

		if (this.#selectionChangeHandler) {
			document.removeEventListener('selectionchange', this.#selectionChangeHandler)
		}

		this.#disableClose()

		this.#scope?.()
		this.#scope = undefined
		this.#selectionChangeHandler = undefined
		this.#focusinHandler = undefined
		this.#focusoutHandler = undefined
	}

	#enableClose() {
		if (this.#escHandler) return

		this.#escHandler = e => {
			if (e.key === KEYBOARD.ESC) {
				this.store.on.clearOverlay.emit()
			}
		}

		this.#clickHandler = e => {
			const target = e.target instanceof HTMLElement ? e.target : null
			if (this.store.refs.overlay?.contains(target)) return
			if (this.store.refs.container?.contains(target)) return
			this.store.on.clearOverlay.emit()
		}

		window.addEventListener('keydown', this.#escHandler)
		document.addEventListener('click', this.#clickHandler, true)
	}

	#disableClose() {
		if (this.#escHandler) {
			window.removeEventListener('keydown', this.#escHandler)
			if (this.#clickHandler) document.removeEventListener('click', this.#clickHandler, true)
			this.#escHandler = undefined
			this.#clickHandler = undefined
		}
	}
}