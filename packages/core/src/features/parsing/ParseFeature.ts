import {computed, effectScope, watch} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {toString} from './parser/utils/toString'
import {getTokensByUI, computeTokensFromValue, parseWithParser} from './utils/valueParser'

export class ParseFeature {
	#scope?: () => void

	constructor(private readonly store: Store) {}

	enable() {
		if (this.#scope) return
		this.sync()
		this.#scope = effectScope(() => {
			this.#subscribeParse()
			this.#subscribeReactiveParse()
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}

	sync() {
		const {store} = this
		const inputValue = store.props.value() ?? store.props.defaultValue() ?? ''
		store.state.tokens(parseWithParser(store, inputValue))
		store.feature.value.state.previousValue(inputValue)
	}

	#subscribeParse() {
		const {store} = this

		watch(store.emit.reparse, () => {
			if (store.state.recovery()) {
				const text = toString(store.state.tokens())
				store.state.tokens(parseWithParser(store, text))
				store.feature.value.state.previousValue(text)
				return
			}
			store.state.tokens(store.nodes.focus.target ? getTokensByUI(store) : computeTokensFromValue(store))
		})
	}

	#subscribeReactiveParse() {
		const {store} = this

		const deps = computed(() => [store.props.value(), store.computed.parser()] as const)

		watch(deps, () => {
			if (!store.state.recovery()) {
				store.emit.reparse()
			}
		})
	}
}