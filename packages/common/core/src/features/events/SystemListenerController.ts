import {createNewSpan} from '../editing'
import {annotate, toString} from '../parsing'
import type {Store} from '../store/Store'

export class SystemListenerController {
	#changeUnsubscribe?: () => void
	#deleteUnsubscribe?: () => void
	#selectUnsubscribe?: () => void

	constructor(private store: Store) {}

	enable() {
		if (this.#changeUnsubscribe) return

		this.#changeUnsubscribe = this.store.events.change.on(() => {
			const onChange = this.store.state.onChange.get()
			const {focus} = this.store.nodes

			// Programmatic mark change or non-editable focus (e.g. a checkbox):
			// the token was already mutated in-place by MarkHandler — serialize it
			// directly and force a re-render without reading stale DOM content.
			if (!focus.target || !focus.target.isContentEditable) {
				const tokens = this.store.state.tokens.get()
				const serialized = toString(tokens)
				onChange?.(serialized)
				this.store.state.previousValue.set(serialized)
				this.store.state.tokens.set([...tokens])
				return
			}

			// User typed in a contentEditable element: sync DOM content → token state.
			const tokens = this.store.state.tokens.get()
			const token = tokens[focus.index]
			if (token.type === 'text') {
				token.content = focus.content
			} else if (token.type === 'mark') {
				token.value = focus.content
			}

			onChange?.(toString(tokens))
			this.store.events.parse()
		})

		this.#deleteUnsubscribe = this.store.events.delete.on(data => {
			if (!data) return
			const {token} = data
			const onChange = this.store.state.onChange.get()

			const tokens = this.store.state.tokens.get()
			const index = tokens.indexOf(token)
			this.store.state.tokens.set(tokens.toSpliced(index, 1))

			onChange?.(toString(this.store.state.tokens.get()))
		})

		this.#selectUnsubscribe = this.store.events.select.on(event => {
			if (!event) return
			const Mark = this.store.state.Mark.get()
			const onChange = this.store.state.onChange.get()
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

			this.store.state.recovery.set(
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
				const tokens = this.store.state.tokens.get()
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