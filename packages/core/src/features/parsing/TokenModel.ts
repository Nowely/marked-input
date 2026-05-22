import {computed} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
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
		const tokens = parser ? parser.parse(value) : [createTextToken(value)]
		return this.props.layout.isBlock() ? filterEmptyText(tokens) : tokens
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
		return new Parser(markups)
	})

	constructor(
		private readonly value: ValueModel,
		private readonly props: PropsModel
	) {}
}

function filterEmptyText(tokens: Token[]): Token[] {
	return tokens.filter(token => {
		if (token.type !== 'text') return true
		return token.position.start !== token.position.end
	})
}