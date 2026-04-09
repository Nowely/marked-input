import {effectScope, watch} from '../../shared/signals/index.js'
import type {CoreOption} from '../../shared/types'
import {createCoreFeatures} from '../feature-manager'
import {Parser, toString, getTokensByUI, getTokensByValue, parseWithParser} from '../parsing'
import type {Store} from '../store'

export interface LifecycleOptions<TOption extends CoreOption = CoreOption> {
	getTrigger?: (option: TOption) => string | undefined
}

export class Lifecycle {
	#scope?: () => void
	#stopFeatures?: () => void
	#initialized = false

	constructor(private store: Store) {}

	enable<TOption extends CoreOption = CoreOption>(options?: LifecycleOptions<TOption>) {
		if (this.#scope) return

		const {store} = this

		if (options?.getTrigger) {
			// oxlint-disable-next-line no-unsafe-type-assertion -- TOption extends CoreOption, safe covariant cast for the signal
			store.state.overlayTrigger.set(options.getTrigger as (option: CoreOption) => string | undefined)
		}

		const features = createCoreFeatures(store)
		features.enableAll()
		this.#stopFeatures = () => features.disableAll()

		this.#scope = effectScope(() => {
			this.#subscribeParse()
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
		this.#stopFeatures?.()
		this.#stopFeatures = undefined
		this.store.state.overlayTrigger.set(undefined)
		this.#initialized = false
	}

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

	recoverFocus() {
		this.store.events.sync.emit()
		if (!this.store.state.Mark.get()) return
		this.store.events.recoverFocus.emit()
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
}