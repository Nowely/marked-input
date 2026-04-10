import {effectScope, watch} from '../../shared/signals/index.js'
import {toString, getTokensByUI, getTokensByValue, parseWithParser} from '../parsing'
import type {Parser} from '../parsing'
import type {Store} from '../store'

export class Lifecycle {
	#scope?: () => void
	#featuresEnabled = false
	#initialized = false
	#lastValue: string | undefined
	#lastParser: Parser | undefined

	constructor(private store: Store) {
		// Permanent watches — bridge from framework lifecycle events to Lifecycle methods.
		// These live for the Store's lifetime so that remount (e.g., React strict mode)
		// correctly re-triggers enable/sync via store.event.updated().
		watch(store.event.updated, () => this.#onUpdated())
		watch(store.event.afterTokensRendered, () => this.recoverFocus())
		watch(store.event.unmounted, () => this.disable())
	}

	#onUpdated() {
		if (!this.#scope) {
			this.enable()
			this.syncParser()
			return
		}
		const value = this.store.state.value()
		const parser = this.store.computed.parser()
		if (this.#initialized && value === this.#lastValue && parser === this.#lastParser) return
		this.#lastValue = value
		this.#lastParser = parser
		if (!this.store.state.recovery()) {
			this.store.event.parse()
		}
	}

	#enableFeatures() {
		if (this.#featuresEnabled) return
		this.#featuresEnabled = true
		const {features} = this.store
		for (const f of Object.values(features)) f.enable()
	}

	#disableFeatures() {
		if (!this.#featuresEnabled) return
		this.#featuresEnabled = false
		const {features} = this.store
		for (const f of Object.values(features)) f.disable()
	}

	enable() {
		if (this.#scope) return

		const {store} = this

		store.state.overlayTrigger(option => option.overlay?.trigger)

		this.#enableFeatures()

		this.#scope = effectScope(() => {
			this.#subscribeParse()
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
		this.#disableFeatures()
		this.store.state.overlayTrigger(undefined)
		this.#initialized = false
	}

	syncParser() {
		const {store} = this
		const inputValue = store.state.value() ?? store.state.defaultValue() ?? ''
		store.state.tokens(parseWithParser(store, inputValue))
		store.state.previousValue(inputValue)
		this.#lastValue = store.state.value()
		this.#lastParser = store.computed.parser()
		this.#initialized = true
	}

	recoverFocus() {
		this.store.event.sync()
		if (!this.store.state.Mark()) return
		this.store.event.recoverFocus()
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
}