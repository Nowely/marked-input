import {KEYBOARD} from '../../shared/constants'
import {effectScope, effect, watch, listen} from '../../shared/signals/index.js'
import type {OverlayTrigger} from '../../shared/types'
import type {Store} from '../../store/Store'
import {TriggerFinder} from '../caret'

export class OverlayFeature {
	#scope?: () => void

	constructor(private readonly store: Store) {}

	#probeTrigger() {
		const match = TriggerFinder.find(this.store.props.options(), option => option.overlay?.trigger)
		this.store.state.overlayMatch(match)
	}

	enable() {
		if (this.#scope) return

		this.#scope = effectScope(() => {
			watch(this.store.emit.overlayClose, () => {
				this.store.state.overlayMatch(undefined)
			})

			watch(this.store.emit.change, () => {
				const showOverlayOn = this.store.props.showOverlayOn()
				const type: OverlayTrigger = 'change'

				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.#probeTrigger()
				}
			})

			// Overlay match tracking + conditional close handlers
			effect(() => {
				const match = this.store.state.overlayMatch()
				if (match) {
					this.store.nodes.input.target = this.store.nodes.focus.target

					listen(window, 'keydown', e => {
						if (e.key === KEYBOARD.ESC) {
							this.store.emit.overlayClose()
						}
					})

					listen(
						document,
						'click',
						e => {
							const target = e.target instanceof HTMLElement ? e.target : null
							if (this.store.state.overlay()?.contains(target)) return
							if (this.store.state.container()?.contains(target)) return
							this.store.emit.overlayClose()
						},
						true
					)
				}
			})

			// Focus-based selection change tracking
			const selectionChangeHandler = () => {
				const container = this.store.state.container()
				if (!container?.contains(document.activeElement)) return

				const showOverlayOn = this.store.props.showOverlayOn()
				const type: OverlayTrigger = 'selectionChange'

				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.#probeTrigger()
				}
			}

			listen(document, 'selectionchange', selectionChangeHandler)
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}