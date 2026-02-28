import {KEYBOARD} from '../../shared/constants'
import {TriggerFinder} from '../caret'
import type {OverlayMatch, OverlayTrigger} from '../../shared/types'
import type {Store} from '../store/Store'

type TriggerExtractor<T> = (option: T, index: number) => string | undefined

export class OverlayController {
	#clearUnsubscribe?: () => void
	#checkUnsubscribe?: () => void
	#changeUnsubscribe?: () => void
	#selectionChangeHandler?: () => void
	#focusinHandler?: (e: FocusEvent) => void
	#focusoutHandler?: (e: FocusEvent) => void
	#escHandler?: (e: KeyboardEvent) => void
	#clickHandler?: (e: MouseEvent) => void

	constructor(private store: Store) {}

	enableTrigger<T>(getTrigger: TriggerExtractor<T>, onMatch: (match: OverlayMatch | undefined) => void) {
		if (this.#clearUnsubscribe) return

		this.#clearUnsubscribe = this.store.state.$clearOverlay.on(() => {
			onMatch(undefined)
		})

		this.#checkUnsubscribe = this.store.state.$checkOverlay.on(() => {
			const match = TriggerFinder.find(this.store.props.options as T[], getTrigger) as OverlayMatch | undefined
			onMatch(match)
		})

		this.#changeUnsubscribe = this.store.state.$change.on(() => {
			const showOverlayOn = this.store.props.showOverlayOn!
			const type: OverlayTrigger = 'change'

			if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
				this.store.state.$checkOverlay.emit()
			}
		})

		this.#selectionChangeHandler = () => {
			const showOverlayOn = this.store.props.showOverlayOn!
			const type: OverlayTrigger = 'selectionChange'

			if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
				this.store.state.$checkOverlay.emit()
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

	enableClose() {
		if (this.#escHandler) return

		this.#escHandler = e => {
			if (e.key === KEYBOARD.ESC) {
				this.store.state.$clearOverlay.emit()
			}
		}

		this.#clickHandler = e => {
			const target = e.target as HTMLElement | null
			if (this.store.refs.overlay?.contains(target)) return
			if (this.store.refs.container?.contains(target)) return
			this.store.state.$clearOverlay.emit()
		}

		window.addEventListener('keydown', this.#escHandler)
		document.addEventListener('click', this.#clickHandler, true)
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

		if (this.#escHandler) {
			window.removeEventListener('keydown', this.#escHandler)
			document.removeEventListener('click', this.#clickHandler!, true)
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
		this.#escHandler = undefined
		this.#clickHandler = undefined
	}
}
