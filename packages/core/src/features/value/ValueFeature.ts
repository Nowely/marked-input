import {signal, computed, event, batch, effectScope, trigger, watch} from '../../shared/signals/index.js'
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'
import {toString} from '../parsing'

export class ValueFeature implements Feature {
	readonly current = signal('')
	readonly isControlledMode = computed(() => this._store.props.value() !== undefined)
	readonly next = event<string>()
	readonly change = event()

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#commitAccepted(this._store.props.value() ?? this._store.props.defaultValue() ?? '')
		this.#scope = effectScope(() => {
			watch(this._store.props.value, value => {
				if (value === undefined) return
				if (value === this.current()) return
				this.#commitAccepted(value)
			})

			watch(this.change, () => {
				if (this._store.props.readOnly()) {
					this.#restoreCurrent()
					return
				}

				const onChange = this._store.props.onChange()
				const {focus} = this._store.nodes

				if (!focus.target || !focus.target.isContentEditable) {
					const tokens = this._store.parsing.tokens()
					const serialized = toString(tokens)
					onChange?.(serialized)
					if (this.isControlledMode()) {
						this.#restoreCurrent()
						return
					}
					this.current(serialized)
					trigger(this._store.parsing.tokens)
					return
				}

				const tokens = this._store.parsing.tokens()
				if (focus.index >= tokens.length) return
				const token = tokens[focus.index]
				if (token.type === 'text') {
					token.content = focus.content
				} else {
					token.value = focus.content
				}

				const candidate = toString(tokens)
				onChange?.(candidate)
				if (this.isControlledMode()) {
					this.#restoreCurrent()
					return
				}
				this.current(candidate)
				this._store.parsing.reparse()
			})

			watch(this.next, value => {
				if (this._store.props.readOnly()) return
				if (this.isControlledMode()) {
					this._store.props.onChange()?.(value)
					return
				}
				this.#commitAccepted(value)
				this._store.props.onChange()?.(value)
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}

	#commitAccepted(value: string) {
		const tokens = this._store.parsing.parseValue(value)
		batch(() => {
			this._store.parsing.acceptTokens(tokens)
			this.current(value)
		})
	}

	#restoreCurrent() {
		this._store.parsing.acceptTokens(this._store.parsing.parseValue(this.current()))
	}
}