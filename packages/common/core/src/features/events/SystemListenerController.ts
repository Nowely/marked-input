import {annotate, toString} from '../parsing'
import {createNewSpan} from '../text-manipulation'
import type {Store} from '../store/Store'

export class SystemListenerController {
	#changeUnsubscribe?: () => void
	#deleteUnsubscribe?: () => void
	#selectUnsubscribe?: () => void

	constructor(private store: Store) {}

	enable() {
		if (this.#changeUnsubscribe) return

		this.#changeUnsubscribe = this.store.events.change.on(() => {
			const onChange = this.store.state.onChange()

			if (!this.store.nodes.focus.target) return

			const tokens = this.store.state.tokens()
			const token = tokens[this.store.nodes.focus.index]
			if (token.type === 'text') {
				token.content = this.store.nodes.focus.content
			} else if (token.type === 'mark') {
				token.value = this.store.nodes.focus.content
			}

			onChange?.(toString(tokens))
			this.store.events.parse()
		})

		this.#deleteUnsubscribe = this.store.events.delete.on(data => {
			if (!data) return
			const {token} = data
			const onChange = this.store.state.onChange()

			const tokens = this.store.state.tokens()
			const index = tokens.indexOf(token)
			this.store.state.tokens(tokens.toSpliced(index, 1))

			onChange?.(toString(this.store.state.tokens()))
		})

		this.#selectUnsubscribe = this.store.events.select.on(event => {
			if (!event) return
			const Mark = (this.store.props as any).Mark
			const onChange = this.store.state.onChange()
			const {
				mark,
				match: {option, span, index, source},
			} = event

			const annotation =
				mark.type === 'mark'
					? annotate(option.markup!, {
							value: mark.value,
							meta: mark.meta,
						})
					: annotate(option.markup!, {
							value: mark.content,
						})

			const newSpan = createNewSpan(span, annotation, index, source)

			this.store.state.recovery(
				Mark
					? {caret: 0, anchor: this.store.nodes.input.next, isNext: true}
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
				this.store.events.parse()
			}
		})
	}

	disable() {
		this.#changeUnsubscribe?.()
		this.#deleteUnsubscribe?.()
		this.#selectUnsubscribe?.()
		this.#changeUnsubscribe = undefined
		this.#deleteUnsubscribe = undefined
		this.#selectUnsubscribe = undefined
	}
}
