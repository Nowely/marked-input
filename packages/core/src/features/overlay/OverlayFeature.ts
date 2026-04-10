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

		this.store.state.overlayTrigger(option => option.overlay?.trigger)

		this.#scope = effectScope(() => {
			watch(this.store.event.clearOverlay, () => {
				this.store.state.overlayMatch(undefined)
			})

			watch(this.store.event.checkOverlay, () => {
				const getTrigger = this.store.state.overlayTrigger()
				if (!getTrigger) return
				const match = TriggerFinder.find(this.store.state.options(), getTrigger)
				this.store.state.overlayMatch(match)
			})

			watch(this.store.event.change, () => {
				const showOverlayOn = this.store.state.showOverlayOn()
				const type: OverlayTrigger = 'change'

				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.store.event.checkOverlay()
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
			const showOverlayOn = this.store.state.showOverlayOn()
			const type: OverlayTrigger = 'selectionChange'

			if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
				this.store.event.checkOverlay()
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

		this.store.state.overlayTrigger(undefined)

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
				this.store.event.clearOverlay()
			}
		}

		this.#clickHandler = e => {
			const target = e.target instanceof HTMLElement ? e.target : null
			if (this.store.refs.overlay?.contains(target)) return
			if (this.store.refs.container?.contains(target)) return
			this.store.event.clearOverlay()
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