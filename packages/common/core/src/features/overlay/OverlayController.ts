import {KEYBOARD} from '../../shared/constants'
import type {OverlayMatch, OverlayTrigger} from '../../shared/types'
import {TriggerFinder} from '../caret'
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

		this.#clearUnsubscribe = this.store.events.clearOverlay.on(() => {
			onMatch(undefined)
		})

		this.#checkUnsubscribe = this.store.events.checkOverlay.on(() => {
			const match = TriggerFinder.find(this.store.state.options.get() as T[], getTrigger) as
				| OverlayMatch
				| undefined
			onMatch(match)
		})

		this.#changeUnsubscribe = this.store.events.change.on(() => {
			const showOverlayOn = this.store.state.showOverlayOn.get()!
			const type: OverlayTrigger = 'change'

			if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
				this.store.events.checkOverlay()
			}
		})

		const selectionChangeHandler = () => {
			const showOverlayOn = this.store.state.showOverlayOn.get()!
			const type: OverlayTrigger = 'selectionChange'

			if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
				this.store.events.checkOverlay()
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

	enableClose() {
		if (this.#escHandler) return

		this.#escHandler = e => {
			if (e.key === KEYBOARD.ESC) {
				this.store.events.clearOverlay()
			}
		}

		this.#clickHandler = e => {
			const target = e.target as HTMLElement | null
			if (this.store.refs.overlay?.contains(target)) return
			if (this.store.refs.container?.contains(target)) return
			this.store.events.clearOverlay()
		}

		window.addEventListener('keydown', this.#escHandler)
		document.addEventListener('click', this.#clickHandler, true)
	}

	disableClose() {
		if (this.#escHandler) {
			window.removeEventListener('keydown', this.#escHandler)
			if (this.#clickHandler) document.removeEventListener('click', this.#clickHandler, true)
			this.#escHandler = undefined
			this.#clickHandler = undefined
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

		this.disableClose()

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