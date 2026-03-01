import type {CoreOption} from '../../shared/types'
import type {Store} from '../store/Store'
import {createCoreFeatures} from '../coreFeatures'
import {Parser} from '../parsing/ParserV2/Parser'
import {getTokensByUI, getTokensByValue, parseWithParser} from '../parsing/utils/valueParser'
import {toString} from '../parsing/ParserV2/utils/toString'

type TriggerExtractor<T> = (option: T) => string | undefined

export interface LifecycleOptions<TOption = CoreOption> {
	getTrigger?: TriggerExtractor<TOption>
}

export class Lifecycle {
	#unsubscribers: (() => void)[] = []
	#initialized = false

	constructor(private store: Store) {}

	enable<TOption = CoreOption>(options?: LifecycleOptions<TOption>) {
		const {store} = this

		const features = createCoreFeatures(store)
		features.enableAll()
		this.#unsubscribers.push(() => features.disableAll())

		this.#subscribeParse()
		this.#subscribeInputEvent()

		if (options?.getTrigger) {
			this.#subscribeOverlay(options.getTrigger as TriggerExtractor<CoreOption>)
		}
	}

	disable() {
		for (const unsub of this.#unsubscribers) {
			unsub()
		}
		this.#unsubscribers = []
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
		if (markups && markups.some(Boolean)) {
			store.state.parser.set(new Parser(markups))
		} else {
			store.state.parser.set(undefined)
		}

		if (this.#initialized) {
			if (!store.state.recovery.get()) {
				store.events.parse()
			}
			return
		}

		const inputValue = value ?? store.state.defaultValue.get() ?? ''
		store.state.tokens.set(parseWithParser(store, inputValue))

		this.#initialized = true
	}

	/**
	 * Recovers focus after tokens change.
	 * Must be called by the framework layer after DOM updates,
	 * since focus recovery requires the new DOM to be committed.
	 */
	recoverFocus() {
		if (!this.store.state.Mark.get()) return
		this.store.controllers.focus.recover()
	}

	#subscribeInputEvent() {
		const container = this.store.refs.container
		if (!container) return

		const handler = () => this.store.events.change()
		container.addEventListener('input', handler)
		this.#unsubscribers.push(() => container.removeEventListener('input', handler))
	}

	#subscribeParse() {
		const {store} = this

		this.#unsubscribers.push(
			store.events.parse.on(() => {
				if (store.state.recovery.get()) {
					const text = toString(store.state.tokens.get())
					store.state.tokens.set(parseWithParser(store, text))
					store.state.previousValue.set(text)
					return
				}
				store.state.tokens.set(store.nodes.focus.target ? getTokensByUI(store) : getTokensByValue(store))
			})
		)
	}

	#subscribeOverlay(getTrigger: TriggerExtractor<CoreOption>) {
		const {store} = this

		store.controllers.overlay.enableTrigger(getTrigger, match => store.state.overlayMatch.set(match))
		this.#unsubscribers.push(() => store.controllers.overlay.disable())

		this.#unsubscribers.push(
			store.state.overlayMatch.on(match => {
				if (match) {
					store.nodes.input.target = store.nodes.focus.target
					store.controllers.overlay.enableClose()
				} else {
					store.controllers.overlay.disableClose()
				}
			})
		)
	}
}
