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

		this.#changeUnsubscribe = this.store.state.$change.on(() => {
			const {onChange} = this.store.props

			if (!this.store.nodes.focus.target) return

			const tokens = this.store.state.tokens.get()
			const token = tokens[this.store.nodes.focus.index]
			if (token.type === 'text') {
				token.content = this.store.nodes.focus.content
			} else if (token.type === 'mark') {
				token.value = this.store.nodes.focus.content
			}

			onChange?.(toString(tokens))
			this.store.state.$parse.emit()
		})

		this.#deleteUnsubscribe = this.store.state.$delete.on(data => {
			if (!data) return
			const {token} = data
			const {onChange} = this.store.props

			const tokens = this.store.state.tokens.get()
			const index = tokens.indexOf(token)
			this.store.state.tokens.set(tokens.toSpliced(index, 1))

			onChange?.(toString(this.store.state.tokens.get()))
		})

		this.#selectUnsubscribe = this.store.state.$select.on(event => {
			if (!event) return
			const {Mark, onChange} = this.store.props as any
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
					? {caret: 0, anchor: this.store.nodes.input.next, isNext: true}
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
				this.store.state.$parse.emit()
			}
		})

		this.#deleteUnsubscribe = this.store.state.$delete.on(data => {
			if (!data) return
			const {token} = data
			const {onChange} = this.store.props

			const tokens = this.store.state.tokens.get()
			const index = tokens.indexOf(token)
			this.store.state.tokens.set(tokens.toSpliced(index, 1))

			onChange?.(toString(this.store.state.tokens.get()))
		})

		this.#selectUnsubscribe = this.store.state.$select.on(event => {
			if (!event) return
			const {Mark, onChange} = this.store.props as any
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
					? {caret: 0, anchor: this.store.nodes.input.next, isNext: true}
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
				this.store.state.$parse.emit()
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
