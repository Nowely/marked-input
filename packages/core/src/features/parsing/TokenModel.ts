import type {Range} from '../../shared/editorContracts'
import {signal, computed, watch} from '../../shared/signals/index.js'
import type {Computed, Signal} from '../../shared/signals/index.js'
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
	readonly current: Signal<Token[]> = signal<Token[]>([])
	readonly index: Computed<TokenIndex> = computed(() => createTokenIndex(this.current()))

	readonly #parser: Computed<Parser | undefined> = computed(() => {
		const Mark = this.props.Mark()
		const options = this.props.options()
		const hasMark = Mark != null || options.some(opt => 'Mark' in opt && opt.Mark != null)
		if (!hasMark) return
		const markups = options.map(opt => opt.markup)
		if (!markups.some(Boolean)) return
		return new Parser(markups, this.slots.isBlock() ? {skipEmptyText: true} : undefined)
	})

	constructor(
		lifecycle: Lifecycle,
		private readonly value: ValueModel,
		private readonly props: PropsModel,
		private readonly slots: SlotsFeature
	) {
		lifecycle.onMounted(() => {
			this.#reparse()
			watch(this.value.current, () => this.#reparse())
			watch(this.#parser, () => this.#reparse())
		})
	}

	serializeRange(range: Range): string {
		return serializeRangeUtil(this.current(), range)
	}

	#reparse(): void {
		const parser = this.#parser()
		const value = this.value.current()
		this.current(parser ? parser.parse(value) : [createTextToken(value)])
	}
}