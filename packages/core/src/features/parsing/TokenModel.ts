import type {Range} from '../../shared/editorContracts'
import {signal, computed, event, effectScope, watch, batch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {SlotsFeature} from '../slots/SlotsFeature'
import type {Lifecycle} from '../state/Lifecycle'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import {createTextToken} from './parser/utils/createTextToken'
import {createTokenIndex, type TokenIndex} from './tokenIndex'
import {serializeRange as serializeRangeUtil} from './utils/serializeRange'

export class TokenModel {
	readonly #current = signal<Token[]>([])
	readonly current: Computed<Token[]> = computed(() => this.#current())
	readonly #generation = signal(0)
	readonly index: Computed<TokenIndex> = computed(() => createTokenIndex(this.#current(), this.#generation()))

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

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly value: ValueModel,
		private readonly props: PropsModel,
		private readonly slots: SlotsFeature
	) {
		lifecycle.onMounted(() => {
			// Parse the initial value before any other onMounted subscriber
			// (e.g. OverlayController) reads tokens.
			this.#update()
			watch(this.value.current, () => this.#update())

			let scope: (() => void) | undefined
			const reparseIfEnabled = () => {
				if (this.#markEnabled()) this.#update()
			}
			const toggle = (enabled: boolean) => {
				if (enabled && !scope) {
					scope = effectScope(() => {
						watch(this.#parser, reparseIfEnabled)
						watch(this.invalidate, reparseIfEnabled)
					})
				}
				if (!enabled && scope) {
					scope()
					scope = undefined
				}
			}
			watch(this.#markEnabled, toggle)
			toggle(this.#markEnabled())
		})
	}

	serializeRange(range: Range): string {
		return serializeRangeUtil(this.#current(), range)
	}

	set(tokens: Token[]): void {
		batch(
			() => {
				this.#current(tokens)
				this.#generation(this.#generation() + 1)
			},
			{mutable: true}
		)
	}

	#parse(value: string): Token[] {
		const parser = this.#parser()
		if (!parser) return [createTextToken(value)]
		return parser.parse(value)
	}

	#update(): void {
		this.set(this.#parse(this.value.current()))
	}
}