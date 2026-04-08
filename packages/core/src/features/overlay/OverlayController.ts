import {KEYBOARD} from '../../shared/constants'
import {effectScope, setActiveSub, watch} from '../../shared/signals/index.js'
import type {CoreOption, OverlayMatch, OverlayTrigger} from '../../shared/types'
import {TriggerFinder} from '../caret'
import type {Store} from '../store/Store'

type TriggerExtractor<T> = (option: T, index: number) => string | undefined

export class OverlayController {
	#triggerScope?: () => void
	#selectionChangeHandler?: () => void
	#focusinHandler?: (e: FocusEvent) => void
	#focusoutHandler?: (e: FocusEvent) => void
	#escHandler?: (e: KeyboardEvent) => void
	#clickHandler?: (e: MouseEvent) => void

	constructor(private store: Store) {}

	enableTrigger<T extends CoreOption>(
		getTrigger: TriggerExtractor<T>,
		onMatch: (match: OverlayMatch<T> | undefined) => void
	) {
		if (this.#triggerScope) return

		this.#triggerScope = effectScope(() => {
			watch(
				() => this.store.events.clearOverlay(),
				() => {
					onMatch(undefined)
				}
			)

			watch(
				() => this.store.events.checkOverlay(),
				() => {
					// oxlint-disable-next-line no-unsafe-type-assertion -- state.options is CoreOption[] but callers always pass T[] which extends CoreOption
					const match = TriggerFinder.find(this.store.state.options.get() as T[], getTrigger)
					onMatch(match)
				}
			)

			watch(
				() => this.store.events.change(),
				() => {
					const showOverlayOn = this.store.state.showOverlayOn.get()
					if (!showOverlayOn) return
					const type: OverlayTrigger = 'change'

					if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
						// Break out of reactive context so checkOverlay emits instead of reads
						const prevSub = setActiveSub(undefined)
						try {
							this.store.events.checkOverlay()
						} finally {
							setActiveSub(prevSub)
						}
					}
				}
			)
		})

		const selectionChangeHandler = () => {
			const showOverlayOn = this.store.state.showOverlayOn.get()
			if (!showOverlayOn) return
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
			const target = e.target instanceof HTMLElement ? e.target : null
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

		this.#triggerScope?.()
		this.#triggerScope = undefined
		this.#selectionChangeHandler = undefined
		this.#focusinHandler = undefined
		this.#focusoutHandler = undefined
	}
}