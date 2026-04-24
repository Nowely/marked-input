import {signal, computed, event, effectScope, watch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'
import {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import {toString} from './parser/utils/toString'
import {getTokensByUI, parseWithParser} from './utils/valueParser'

export class ParsingFeature implements Feature {
	readonly tokens = signal<Token[]>([])

	readonly parser: Computed<Parser | undefined> = computed(() => {
		if (!this._store.mark.enabled()) return

		const markups = this._store.props.options().map(opt => opt.markup)
		if (!markups.some(Boolean)) return

		return new Parser(markups, this._store.slots.isBlock() ? {skipEmptyText: true} : undefined)
	})

	readonly reparse = event()

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	parseValue(value: string): Token[] {
		return parseWithParser(this._store, value)
	}

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

	sync(value = this._store.value.current()) {
		this.tokens(this.parseValue(value))
	}

	#subscribeParse() {
		watch(this.reparse, () => {
			if (this._store.caret.recovery()) {
				const text = toString(this.tokens())
				this.tokens(this.parseValue(text))
				return
			}
			if (this._store.nodes.focus.target) {
				this.tokens(getTokensByUI(this._store))
				return
			}
			this.sync()
		})
	}

	#subscribeReactiveParse() {
		const deps = computed(() => this.parser())

		watch(deps, () => {
			if (!this._store.caret.recovery()) {
				this.sync(this._store.value.current())
			}
		})
	}
}