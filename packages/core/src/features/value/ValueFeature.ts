import {signal, computed, event, batch, effectScope, trigger, watch} from '../../shared/signals/index.js'
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'
import {parseWithParser, toString} from '../parsing'

export class ValueFeature implements Feature {
	readonly state = {
		previousValue: signal<string | undefined>(undefined),
		innerValue: signal<string | undefined>(undefined),
	}

	readonly computed = {
		currentValue: computed(() => this.state.previousValue() ?? this._store.props.value() ?? ''),
	}

	readonly emit = {
		change: event(),
	}

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#scope = effectScope(() => {
			watch(this.emit.change, () => {
				const onChange = this._store.props.onChange()
				const {focus} = this._store.nodes

				if (!focus.target || !focus.target.isContentEditable) {
					const tokens = this._store.feature.parsing.state.tokens()
					const serialized = toString(tokens)
					onChange?.(serialized)
					this.state.previousValue(serialized)
					trigger(this._store.feature.parsing.state.tokens)
					return
				}

				const tokens = this._store.feature.parsing.state.tokens()
				if (focus.index >= tokens.length) return
				const token = tokens[focus.index]
				if (token.type === 'text') {
					token.content = focus.content
				} else {
					token.value = focus.content
				}

				onChange?.(toString(tokens))
				this._store.feature.parsing.emit.reparse()
			})

			watch(this.state.innerValue, newValue => {
				if (newValue === undefined) return
				const newTokens = parseWithParser(this._store, newValue)
				batch(() => {
					this._store.feature.parsing.state.tokens(newTokens)
					this.state.previousValue(newValue)
				})
				this._store.props.onChange()?.(newValue)
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}