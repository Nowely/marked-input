import {batch, effectScope, watch} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {createNewSpan} from '../editing'
import {annotate, findToken, parseWithParser, toString} from '../parsing'

export class SystemListenerFeature {
	#scope?: () => void

	constructor(private store: Store) {}

	enable() {
		if (this.#scope) return

		this.#scope = effectScope(() => {
			watch(this.store.event.change, () => {
				const onChange = this.store.state.onChange()
				const {focus} = this.store.nodes

				// Programmatic mark change or non-editable focus (e.g. a checkbox):
				// the token was already mutated in-place by MarkHandler — serialize it
				// directly and force a re-render without reading stale DOM content.
				if (!focus.target || !focus.target.isContentEditable) {
					const tokens = this.store.state.tokens()
					const serialized = toString(tokens)
					onChange?.(serialized)
					this.store.state.previousValue(serialized)
					this.store.state.tokens([...tokens])
					return
				}

				// User typed in a contentEditable element: sync DOM content → token state.
				const tokens = this.store.state.tokens()
				const token = tokens[focus.index]
				if (token.type === 'text') {
					token.content = focus.content
				} else {
					token.value = focus.content
				}

				onChange?.(toString(tokens))
				this.store.event.parse()
			})

			watch(this.store.event.delete, payload => {
				const {token} = payload
				const tokens = this.store.state.tokens()
				if (!findToken(tokens, token)) return

				const value = toString(tokens)
				const nextValue = value.slice(0, token.position.start) + value.slice(token.position.end)
				this.store.state.innerValue(nextValue)
			})

			watch(this.store.state.innerValue, newValue => {
				if (newValue === undefined) return
				const newTokens = parseWithParser(this.store, newValue)
				batch(() => {
					this.store.state.tokens(newTokens)
					this.store.state.previousValue(newValue)
				})
				this.store.state.onChange()?.(newValue)
			})

			watch(this.store.event.select, event => {
				const Mark = this.store.state.Mark()
				const onChange = this.store.state.onChange()
				const {
					mark,
					match: {option, span, index, source},
				} = event

				const markup = option.markup
				if (!markup) return

				const annotation =
					mark.type === 'mark'
						? annotate(markup, {
								value: mark.value,
								meta: mark.meta,
							})
						: annotate(markup, {
								value: mark.content,
							})

				const newSpan = createNewSpan(span, annotation, index, source)

				this.store.state.recovery(
					Mark
						? {
								caret: 0,
								anchor: this.store.nodes.input.next,
								isNext: true,
								childIndex: this.store.nodes.input.index,
							}
						: {caret: index + annotation.length, anchor: this.store.nodes.input}
				)

				if (this.store.nodes.input.target) {
					this.store.nodes.input.content = newSpan
					const tokens = this.store.state.tokens()
					const inputToken = tokens[this.store.nodes.input.index]
					if (inputToken.type === 'text') {
						inputToken.content = newSpan
					}

					this.store.nodes.focus.target = this.store.nodes.input.target
					this.store.nodes.input.clear()
					onChange?.(toString(tokens))
					this.store.event.parse()
				}
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}