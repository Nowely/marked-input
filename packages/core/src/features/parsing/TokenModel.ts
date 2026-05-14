import type {Range} from '../../shared/editorContracts'
import {signal, computed, event, effectScope, watch, batch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {SlotsFeature} from '../slots/SlotsFeature'
import type {Lifecycle} from '../state/Lifecycle'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import {createTokenIndex, type TokenIndex} from './tokenIndex'
import {serializeRange as serializeRangeUtil} from './utils/serializeRange'

export class TokenModel {
	readonly current = signal<Token[]>([])
	readonly #generation = signal(0)
	readonly index: Computed<TokenIndex> = computed(() => createTokenIndex(this.current(), this.#generation()))

	readonly #markEnabled: Computed<boolean> = computed(() => {
		const Mark = this.props.Mark()
		if (Mark) return true
		return this.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
	})

	readonly #parser: Computed<Parser | undefined> = computed(() => {
		if (!this.#markEnabled()) return

		const markups = this.props.options().map(opt => opt.markup)
		if (!markups.some(Boolean)) return

		return new Parser(markups, this.slots.isBlock() ? {skipEmptyText: true} : undefined)
	})

	readonly invalidate = event()

	#scope?: () => void

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly value: ValueModel,
		private readonly props: PropsModel,
		private readonly slots: SlotsFeature
	) {
		lifecycle.onMounted(() => {
			// Parse current value immediately so tokens are ready before other
			// mounted subscribers (like OverlayController) read them.
			this.#update()
			this.#watchValue()
		})

		const toggle = (enabled: boolean) => {
			if (enabled && !this.#scope) {
				this.#scope = effectScope(() => {
					this.#watchParser()
					this.#watchInvalidate()
				})
			}
			if (!enabled && this.#scope) {
				this.#scope()
				this.#scope = undefined
			}
		}

		watch(this.#markEnabled, toggle)
		toggle(this.#markEnabled())
	}

	serializeRange(range: Range): string {
		return serializeRangeUtil(this.current(), range)
	}

	set(tokens: Token[]): void {
		batch(
			() => {
				this.current(tokens)
				this.#generation(this.#generation() + 1)
			},
			{mutable: true}
		)
	}

	#parse(value: string): Token[] {
		const parser = this.#parser()
		if (!parser) {
			return [{type: 'text' as const, content: value, position: {start: 0, end: value.length}}]
		}
		return parser.parse(value)
	}

	#update(): void {
		this.set(this.#parse(this.value.current()))
	}

	#watchValue(): void {
		watch(this.value.current, () => this.#update())
	}

	#watchParser(): void {
		watch(
			computed(() => this.#parser()),
			() => this.#update()
		)
	}

	#watchInvalidate(): void {
		watch(this.invalidate, () => this.#update())
	}
}