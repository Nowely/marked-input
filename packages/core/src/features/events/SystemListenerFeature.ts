import {effectScope, watch} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {createNewSpan} from '../editing'
import {annotate, toString} from '../parsing'

export class SystemListenerFeature {
	#scope?: () => void

	constructor(private readonly store: Store) {}

	enable() {
		if (this.#scope) return

		this.#scope = effectScope(() => {
			watch(this.store.emit.overlaySelect, event => {
				const Mark = this.store.props.Mark()
				const onChange = this.store.props.onChange()
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
					this.store.feature.parsing.emit.reparse()
				}
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}