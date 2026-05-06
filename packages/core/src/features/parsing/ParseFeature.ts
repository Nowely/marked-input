import {signal, computed, event, effectScope, watch, batch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import {toString} from './parser/utils/toString'
import {createTokenIndex, type TokenIndex} from './tokenIndex'
import {parseWithParser} from './utils/valueParser'

export class ParsingFeature {
	readonly tokens = signal<Token[]>([])
	readonly #generation = signal(0)
	readonly index: Computed<TokenIndex> = computed(() => createTokenIndex(this.tokens(), this.#generation()))

	readonly parser: Computed<Parser | undefined> = computed(() => {
		if (!this._store.mark.enabled()) return

		const markups = this._store.props.options().map(opt => opt.markup)
		if (!markups.some(Boolean)) return

		return new Parser(markups, this._store.slots.isBlock() ? {skipEmptyText: true} : undefined)
	})

	readonly reparse = event()

	#scope?: () => void

	constructor(private readonly _store: Store) {
		watch(this._store.mark.enabled, enabled => {
			if (enabled && !this.#scope) {
				this.sync()
				this.#scope = effectScope(() => {
					this.#subscribeParse()
					this.#subscribeReactiveParse()
				})
			}
			if (!enabled && this.#scope) {
				this.#scope()
				this.#scope = undefined
			}
		})
	}

	parseValue(value: string): Token[] {
		return parseWithParser(this._store, value)
	}

	acceptTokens(tokens: Token[]): void {
		batch(
			() => {
				this.tokens(tokens)
				this.#generation(this.#generation() + 1)
			},
			{mutable: true}
		)
	}

	sync(value = this._store.value.current()) {
		this.acceptTokens(this.parseValue(value))
	}

	#subscribeParse() {
		watch(this.reparse, () => {
			if (this._store.caret.recovery()) {
				const text = toString(this.tokens())
				this.acceptTokens(this.parseValue(text))
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