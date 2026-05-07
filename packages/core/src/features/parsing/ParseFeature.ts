import {signal, computed, event, effectScope, watch, batch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import {createTokenIndex, type TokenIndex} from './tokenIndex'

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

	constructor(private readonly _store: Pick<Store, 'lifecycle' | 'mark' | 'props' | 'slots' | 'value'>) {
		_store.lifecycle.onMounted(() => {
			// Parse current value immediately so tokens are ready before other
			// mounted subscribers (like OverlayFeature) read them.
			this.acceptTokens(this.#parseValue(_store.value.current()))
			this.#subscribeValue()
		})

		const toggle = (enabled: boolean) => {
			if (enabled && !this.#scope) {
				this.#scope = effectScope(() => {
					this.#subscribeReactiveParse()
					this.#subscribeReparse()
				})
			}
			if (!enabled && this.#scope) {
				this.#scope()
				this.#scope = undefined
			}
		}

		watch(this._store.mark.enabled, toggle)
		toggle(this._store.mark.enabled())
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

	#parseValue(value: string): Token[] {
		const parser = this.parser()
		if (!parser) {
			return [{type: 'text' as const, content: value, position: {start: 0, end: value.length}}]
		}
		return parser.parse(value)
	}

	#subscribeValue(): void {
		watch(
			computed(() => this._store.value.current()),
			v => {
				this.acceptTokens(this.#parseValue(v))
			}
		)
	}

	#subscribeReactiveParse(): void {
		watch(
			computed(() => this.parser()),
			() => {
				this.acceptTokens(this.#parseValue(this._store.value.current()))
			}
		)
	}

	#subscribeReparse(): void {
		watch(this.reparse, () => {
			this.acceptTokens(this.#parseValue(this._store.value.current()))
		})
	}
}