import {KEYBOARD} from '../../shared/constants'
import {effectScope, effect, watch, listen} from '../../shared/signals/index.js'
import type {OverlayTrigger} from '../../shared/types'
import type {Store} from '../../store/Store'
import {TriggerFinder} from '../caret'

export class OverlayFeature {
	#scope?: () => void

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
				const match = TriggerFinder.find(this.store.props.options(), getTrigger)
				this.store.state.overlayMatch(match)
			})

			watch(this.store.event.change, () => {
				const showOverlayOn = this.store.props.showOverlayOn()
				const type: OverlayTrigger = 'change'

				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.store.event.checkOverlay()
				}
			})

			// Overlay match tracking + conditional close handlers
			effect(() => {
				const match = this.store.state.overlayMatch()
				if (match) {
					this.store.nodes.input.target = this.store.nodes.focus.target

					listen(window, 'keydown', e => {
						if (e.key === KEYBOARD.ESC) {
							this.store.event.clearOverlay()
						}
					})

					listen(
						document,
						'click',
						e => {
							const target = e.target instanceof HTMLElement ? e.target : null
							if (this.store.refs.overlay?.contains(target)) return
							if (this.store.refs.container?.contains(target)) return
							this.store.event.clearOverlay()
						},
						true
					)
				}
			})

			// Focus-based selection change tracking
			const selectionChangeHandler = () => {
				const container = this.store.refs.container
				if (!container?.contains(document.activeElement)) return

				const showOverlayOn = this.store.props.showOverlayOn()
				const type: OverlayTrigger = 'selectionChange'

				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.store.event.checkOverlay()
				}
			}

			listen(document, 'selectionchange', selectionChangeHandler)
		})
	}

	disable() {
		this.store.state.overlayTrigger(undefined)
		this.#scope?.()
		this.#scope = undefined
	}
}