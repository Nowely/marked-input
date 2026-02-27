import type {OverlayTrigger} from '../../shared/types'
import type {Store} from '../store/Store'

export class CheckTriggerController {
	#selectionChangeHandler?: () => void
	#focusinHandler?: (e: FocusEvent) => void
	#focusoutHandler?: (e: FocusEvent) => void
	#changeUnsubscribe?: () => void

	constructor(private store: Store) {}

	enable() {
		if (this.#selectionChangeHandler) return

		this.#selectionChangeHandler = () => {
			const showOverlayOn = this.store.props.showOverlayOn!
			const type: OverlayTrigger = 'selectionChange'

			if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
				this.store.events.checkTrigger.emit()
			}
		}

		this.#focusinHandler = () => {
			document.addEventListener('selectionchange', this.#selectionChangeHandler!)
		}

		this.#focusoutHandler = () => {
			document.removeEventListener('selectionchange', this.#selectionChangeHandler!)
		}

		this.#changeUnsubscribe = this.store.events.change.subscribe(() => {
			const showOverlayOn = this.store.props.showOverlayOn!
			const type: OverlayTrigger = 'change'

			if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
				this.store.events.checkTrigger.emit()
			}
		})

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
			container.removeEventListener('focusout', this.#focusoutHandler!)
		}

		if (this.#selectionChangeHandler) {
			document.removeEventListener('selectionchange', this.#selectionChangeHandler)
		}

		this.#changeUnsubscribe?.()

		this.#selectionChangeHandler = undefined
		this.#focusinHandler = undefined
		this.#focusoutHandler = undefined
		this.#changeUnsubscribe = undefined
	}
}
