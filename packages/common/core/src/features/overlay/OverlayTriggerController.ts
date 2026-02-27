import {TriggerFinder} from '../caret'
import type {OverlayMatch, OverlayTrigger} from '../../shared/types'
import type {Store} from '../store/Store'

type TriggerExtractor<T> = (option: T, index: number) => string | undefined

export class OverlayTriggerController {
	#clearUnsubscribe?: () => void
	#checkUnsubscribe?: () => void
	#changeUnsubscribe?: () => void
	#selectionChangeHandler?: () => void
	#focusinHandler?: (e: FocusEvent) => void
	#focusoutHandler?: (e: FocusEvent) => void

	constructor(private store: Store) {}

	enable<T>(getTrigger: TriggerExtractor<T>, onMatch: (match: OverlayMatch | undefined) => void) {
		if (this.#clearUnsubscribe) return

		this.#clearUnsubscribe = this.store.events.clearTrigger.subscribe(() => {
			onMatch(undefined)
		})

		this.#checkUnsubscribe = this.store.events.checkTrigger.subscribe(() => {
			const match = TriggerFinder.find(this.store.props.options as T[], getTrigger) as OverlayMatch | undefined
			onMatch(match)
		})

		this.#changeUnsubscribe = this.store.events.change.subscribe(() => {
			const showOverlayOn = this.store.props.showOverlayOn!
			const type: OverlayTrigger = 'change'

			if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
				this.store.events.checkTrigger.emit()
			}
		})

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

		this.#clearUnsubscribe?.()
		this.#checkUnsubscribe?.()
		this.#changeUnsubscribe?.()

		this.#clearUnsubscribe = undefined
		this.#checkUnsubscribe = undefined
		this.#changeUnsubscribe = undefined
		this.#selectionChangeHandler = undefined
		this.#focusinHandler = undefined
		this.#focusoutHandler = undefined
	}
}
