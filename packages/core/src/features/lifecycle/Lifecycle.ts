import {effectScope, watch} from '../../shared/signals/index.js'
import type {CoreOption} from '../../shared/types'
import {createCoreFeatures} from '../feature-manager'
import {Parser, toString, getTokensByUI, getTokensByValue, parseWithParser} from '../parsing'
import type {Store} from '../store'

type TriggerExtractor<T> = (option: T) => string | undefined

export interface LifecycleOptions<TOption extends CoreOption = CoreOption> {
	getTrigger?: TriggerExtractor<TOption>
}

export class Lifecycle {
	#scope?: () => void
	#stopFeatures?: () => void
	#stopOverlay?: () => void
	#initialized = false

	constructor(private store: Store) {}

	enable<TOption extends CoreOption = CoreOption>(options?: LifecycleOptions<TOption>) {
		if (this.#scope) return // idempotency guard

		const {store} = this

		const features = createCoreFeatures(store)
		features.enableAll()
		this.#stopFeatures = () => features.disableAll()

		this.#scope = effectScope(() => {
			this.#subscribeParse()

			if (options?.getTrigger) {
				this.#subscribeOverlay(options.getTrigger)
			}
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
		this.#stopFeatures?.()
		this.#stopFeatures = undefined
		this.#stopOverlay?.()
		this.#stopOverlay = undefined
		this.#initialized = false
	}

	/**
	 * Synchronizes the parser with current options and handles parsing.
	 * Must be called by the framework layer when value or options change,
	 * since these are props set synchronously during render.
	 */
	syncParser(value: string | undefined, options: CoreOption[] | undefined) {
		const {store} = this

		const markups = options?.map(opt => opt.markup)
		if (markups?.some(Boolean)) {
			const isDrag = !!store.state.drag.get()
			const parseOptions = isDrag ? {skipEmptyText: true} : undefined
			store.state.parser.set(new Parser(markups, parseOptions))
		} else {
			store.state.parser.set(undefined)
		}

		if (this.#initialized) {
			if (!store.state.recovery.get()) {
				store.events.parse.emit()
			}
			return
		}

		const inputValue = value ?? store.state.defaultValue.get() ?? ''
		store.state.tokens.set(parseWithParser(store, inputValue))
		store.state.previousValue.set(inputValue)

		this.#initialized = true
	}

	/**
	 * Recovers focus after tokens change.
	 * Must be called by the framework layer after DOM updates,
	 * since focus recovery requires the new DOM to be committed.
	 */
	recoverFocus() {
		this.store.controllers.contentEditable.sync()
		if (!this.store.state.Mark.get()) return
		this.store.controllers.focus.recover()
	}

	#subscribeParse() {
		const {store} = this

		watch(store.events.parse, () => {
			if (store.state.recovery.get()) {
				const text = toString(store.state.tokens.get())
				store.state.tokens.set(parseWithParser(store, text))
				store.state.previousValue.set(text)
				return
			}
			store.state.tokens.set(store.nodes.focus.target ? getTokensByUI(store) : getTokensByValue(store))
		})
	}

	#subscribeOverlay<TOption extends CoreOption = CoreOption>(getTrigger: TriggerExtractor<TOption>) {
		const {store} = this

		store.controllers.overlay.enableTrigger(getTrigger, match => store.state.overlayMatch.set(match))
		this.#stopOverlay = () => store.controllers.overlay.disable()

		watch(
			store.state.overlayMatch,
			(match: typeof store.state.overlayMatch extends () => infer T ? Exclude<T, void> : never) => {
				// oxlint-disable-next-line no-unnecessary-condition -- match type cannot be narrowed correctly by static analysis
				if (match) {
					store.nodes.input.target = store.nodes.focus.target
					store.controllers.overlay.enableClose()
				} else {
					store.controllers.overlay.disableClose()
				}
			}
		)
	}
}