import {effectScope, event, watch} from '../../shared/signals/index.js'
import {createCoreFeatures} from '../feature-manager'
import {Parser, toString, getTokensByUI, getTokensByValue, parseWithParser} from '../parsing'
import type {Store} from '../store'

export class Lifecycle {
	/** Framework emits after every render (props may have changed). Drives syncParser. */
	readonly updated = event()
	/** Framework emits after token changes are rendered to the DOM. Drives sync/recoverFocus. */
	readonly afterTokensRendered = event()
	/** Framework emits when component unmounts. */
	readonly unmounted = event()

	#scope?: () => void
	#stopFeatures?: () => void
	#initialized = false
	#lastSyncValue: string | undefined
	#lastSyncMark: unknown
	#lastSyncOptions: unknown

	constructor(private store: Store) {
		effectScope(() => {
			watch(this.updated, () => this.#onUpdated())
			watch(this.afterTokensRendered, () => this.recoverFocus())
			watch(this.unmounted, () => this.disable())
		})
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

	enable() {
		if (this.#scope) return

		const {store} = this

		store.state.overlayTrigger.set(option => option.overlay?.trigger)

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
				store.events.parse.emit()
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