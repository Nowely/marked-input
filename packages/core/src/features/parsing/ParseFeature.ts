import {signal, computed, event, effectScope, watch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'
import {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import {toString} from './parser/utils/toString'
import {getTokensByUI, computeTokensFromValue, parseWithParser} from './utils/valueParser'

export class ParsingFeature implements Feature {
	readonly state = {
		tokens: signal<Token[]>([]),
	}

	readonly computed: {
		parser: Computed<Parser | undefined>
	} = {
		parser: computed(() => {
			if (!this._store.feature.mark.hasMark()) return

			const markups = this._store.props.options().map(opt => opt.markup)
			if (!markups.some(Boolean)) return

			return new Parser(markups, this._store.feature.slots.isBlock() ? {skipEmptyText: true} : undefined)
		}),
	}

	readonly emit = {
		reparse: event(),
	}

	#scope?: () => void

	constructor(private readonly _store: Store) {}

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
		const inputValue = this._store.props.value() ?? this._store.props.defaultValue() ?? ''
		this.state.tokens(parseWithParser(this._store, inputValue))
		this._store.feature.value.previousValue(inputValue)
	}

	#subscribeParse() {
		watch(this.emit.reparse, () => {
			if (this._store.feature.caret.recovery()) {
				const text = toString(this.state.tokens())
				this.state.tokens(parseWithParser(this._store, text))
				this._store.feature.value.previousValue(text)
				return
			}
			this.state.tokens(
				this._store.nodes.focus.target ? getTokensByUI(this._store) : computeTokensFromValue(this._store)
			)
		})
	}

	#subscribeReactiveParse() {
		const deps = computed(() => [this._store.props.value(), this.computed.parser()] as const)

		watch(deps, () => {
			if (!this._store.feature.caret.recovery()) {
				this.emit.reparse()
			}
		})
	}
}