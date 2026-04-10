import {effectScope, watch} from '../../shared/signals/index.js'
import {Parser, toString, getTokensByUI, getTokensByValue, parseWithParser} from '../parsing'
import type {Store} from '../store'

export class Lifecycle {
	#scope?: () => void
	#featuresEnabled = false
	#initialized = false
	#lastSyncValue: string | undefined
	#lastSyncMark: unknown
	#lastSyncOptions: unknown

	constructor(private store: Store) {
		watch(store.on.updated, () => this.#onUpdated())
		watch(store.on.afterTokensRendered, () => this.recoverFocus())
		watch(store.on.unmounted, () => this.disable())
	}

	#onUpdated() {
		if (!this.#scope) this.enable()
		this.#maybeSyncParser()
	}

	#maybeSyncParser() {
		const {store} = this
		const value = store.state.value.get()
		const Mark = store.state.Mark.get()
		const options = store.state.options.get()
		if (
			this.#initialized &&
			value === this.#lastSyncValue &&
			Mark === this.#lastSyncMark &&
			options === this.#lastSyncOptions
		)
			return
		this.#lastSyncValue = value
		this.#lastSyncMark = Mark
		this.#lastSyncOptions = options
		this.syncParser()
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

		store.state.overlayTrigger.set(option => option.overlay?.trigger)

		this.#enableFeatures()

		this.#scope = effectScope(() => {
			this.#subscribeParse()
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
		this.#disableFeatures()
		this.store.state.overlayTrigger.set(undefined)
		this.#initialized = false
	}

	syncParser() {
		const {store} = this

		const options = this.#getEffectiveOptions()

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
				store.on.parse.emit()
			}
			return
		}

		const inputValue = store.state.value.get() ?? store.state.defaultValue.get() ?? ''
		store.state.tokens.set(parseWithParser(store, inputValue))
		store.state.previousValue.set(inputValue)

		this.#initialized = true
	}

	#getEffectiveOptions() {
		const Mark = this.store.state.Mark.get()
		const coreOptions = this.store.state.options.get()
		const hasPerOptionMark = (coreOptions as unknown[] | undefined)?.some(
			opt =>
				typeof opt === 'object' &&
				opt !== null &&
				'Mark' in opt &&
				(opt as Record<string, unknown>).Mark != null
		)
		return Mark || hasPerOptionMark ? coreOptions : undefined
	}

	recoverFocus() {
		this.store.on.sync.emit()
		if (!this.store.state.Mark.get()) return
		this.store.on.recoverFocus.emit()
	}

	#subscribeParse() {
		const {store} = this

		watch(store.on.parse, () => {
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