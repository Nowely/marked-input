import {computed, event, effectScope, watch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'
import type {Token} from '../parsing'
import {toString} from '../parsing/parser/utils/toString'
import {findToken} from '../parsing/utils/findToken'
import {resolveMarkSlot} from '../slots'
import type {MarkSlot} from '../slots'

export class MarkFeature implements Feature {
	readonly state = {} as const

	readonly computed: {
		hasMark: Computed<boolean>
		mark: MarkSlot
	} = {
		hasMark: computed(() => {
			const Mark = this._store.props.Mark()
			if (Mark) return true
			return this._store.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
		}),
		mark: computed(() => {
			const options = this._store.props.options()
			const Mark = this._store.props.Mark()
			const Span = this._store.props.Span()
			return (token: Token) => resolveMarkSlot(token, options, Mark, Span)
		}),
	}

	readonly emit = {
		markRemove: event<{token: Token}>(),
	}

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			watch(this.emit.markRemove, payload => {
				const {token} = payload
				const tokens = this._store.feature.parsing.state.tokens()
				if (!findToken(tokens, token)) return
				const value = toString(tokens)
				const nextValue = value.slice(0, token.position.start) + value.slice(token.position.end)
				this._store.feature.value.innerValue(nextValue)
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}