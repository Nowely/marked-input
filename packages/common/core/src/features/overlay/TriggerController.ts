import {SystemEvent} from '../events'
import {TriggerFinder} from '../caret'
import type {OverlayMatch} from '../../shared/types'
import type {Store} from '../store/Store'

type TriggerExtractor<T> = (option: T, index: number) => string | undefined
type OverlayMatchHandler = (match: OverlayMatch | undefined) => void

export class TriggerController {
	#unsubscribeClear?: () => void
	#unsubscribeCheck?: () => void

	constructor(private store: Store) {}

	enable<T>(getTrigger: TriggerExtractor<T>, onMatch: OverlayMatchHandler) {
		if (this.#unsubscribeClear) return

		this.#unsubscribeClear = this.store.bus.on(SystemEvent.ClearTrigger, () => {
			onMatch(undefined)
		})

		this.#unsubscribeCheck = this.store.bus.on(SystemEvent.CheckTrigger, () => {
			const match = TriggerFinder.find(this.store.props.options as T[], getTrigger) as OverlayMatch | undefined
			onMatch(match)
		})
	}

	disable() {
		this.#unsubscribeClear?.()
		this.#unsubscribeCheck?.()
		this.#unsubscribeClear = undefined
		this.#unsubscribeCheck = undefined
	}
}
