import {effectScope, watch} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import type {Parser} from './parser/Parser'
import {toString} from './parser/utils/toString'
import {getTokensByUI, getTokensByValue, parseWithParser} from './utils/valueParser'

export class ParseFeature {
	#scope?: () => void
	#initialized = false
	#lastValue: string | undefined
	#lastParser: Parser | undefined

	constructor(private readonly store: Store) {}

	enable() {
		if (this.#scope) return
		this.sync()
		this.#scope = effectScope(() => {
			this.#subscribeParse()
			this.#subscribeUpdated()
		})
	}

	disable() {
		this.#initialized = false
		this.#scope?.()
		this.#scope = undefined
	}

	sync() {
		const {store} = this
		const inputValue = store.props.value() ?? store.props.defaultValue() ?? ''
		store.state.tokens(parseWithParser(store, inputValue))
		store.state.previousValue(inputValue)
		this.#lastValue = store.props.value()
		this.#lastParser = store.computed.parser()
		this.#initialized = true
	}

	hasChanged(): boolean {
		const value = this.store.props.value()
		const parser = this.store.computed.parser()
		if (this.#initialized && value === this.#lastValue && parser === this.#lastParser) return false
		this.#lastValue = value
		this.#lastParser = parser
		return true
	}

	#subscribeParse() {
		const {store} = this

		watch(store.event.parse, () => {
			if (store.state.recovery()) {
				const text = toString(store.state.tokens())
				store.state.tokens(parseWithParser(store, text))
				store.state.previousValue(text)
				return
			}
			store.state.tokens(store.nodes.focus.target ? getTokensByUI(store) : getTokensByValue(store))
		})
	}

	#subscribeUpdated() {
		const {store} = this

		watch(store.event.updated, () => {
			if (!this.hasChanged()) return
			if (!store.state.recovery()) {
				store.event.parse()
			}
		})
	}
}