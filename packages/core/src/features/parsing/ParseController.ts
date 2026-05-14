import {signal, computed, event, effectScope, watch, batch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {SlotsFeature} from '../slots/SlotsFeature'
import type {Lifecycle} from '../state/Lifecycle'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import type {MarkFeature} from './MarkFeature'
import {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import {createTokenIndex, type TokenIndex} from './tokenIndex'

export class ParseController {
	readonly tokens = signal<Token[]>([])
	readonly #generation = signal(0)
	readonly index: Computed<TokenIndex> = computed(() => createTokenIndex(this.tokens(), this.#generation()))

	readonly parser: Computed<Parser | undefined> = computed(() => {
		if (!this.mark.enabled()) return

		const markups = this.props.options().map(opt => opt.markup)
		if (!markups.some(Boolean)) return

		return new Parser(markups, this.slots.isBlock() ? {skipEmptyText: true} : undefined)
	})

	readonly reparse = event()

	#scope?: () => void

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly value: ValueModel,
		private readonly mark: MarkFeature,
		private readonly props: PropsModel,
		private readonly slots: SlotsFeature
	) {
		lifecycle.onMounted(() => {
			// Parse current value immediately so tokens are ready before other
			// mounted subscribers (like OverlayController) read them.
			this.acceptTokens(this.#parseValue(value.current()))
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

		watch(this.mark.enabled, toggle)
		toggle(this.mark.enabled())
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
		// Pass value.current directly — it is already a Computed<string>.
		watch(this.value.current, v => {
			this.acceptTokens(this.#parseValue(v))
		})
	}

	#subscribeReactiveParse(): void {
		watch(
			computed(() => this.parser()),
			() => {
				this.acceptTokens(this.#parseValue(this.value.current()))
			}
		)
	}

	#subscribeReparse(): void {
		watch(this.reparse, () => {
			this.acceptTokens(this.#parseValue(this.value.current()))
		})
	}
}