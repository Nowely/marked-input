import {computed} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {SlotsFeature} from '../slots/SlotsFeature'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import {createTextToken} from './parser/utils/createTextToken'
import {createTokenIndex, type TokenIndex} from './tokenIndex'

export class TokenModel {
	readonly current: Computed<Token[]> = computed(() => {
		const parser = this.#parser()
		const value = this.value.current()
		return parser ? parser.parse(value) : [createTextToken(value)]
	})
	readonly index: Computed<TokenIndex> = computed(() => createTokenIndex(this.current()))

	readonly #parser: Computed<Parser | undefined> = computed(() => {
		const Mark = this.props.Mark()
		const options = this.props.options()
		// TODO maybe in the future it place in one again
		const hasMark = Mark != null || options.some(opt => 'Mark' in opt && opt.Mark != null)
		if (!hasMark) return
		const markups = options.map(opt => opt.markup)
		if (!markups.some(Boolean)) return
		//TODO this.slots.isBlock() smelling here
		return new Parser(markups, this.slots.isBlock() ? {skipEmptyText: true} : undefined)
	})

	constructor(
		private readonly value: ValueModel,
		private readonly props: PropsModel,
		private readonly slots: SlotsFeature
	) {}
}