import {childAt, firstHtmlChild, isHtmlElement} from '../../shared/checkers'
import {watch} from '../../shared/signals/index.js'
import type {Store} from '../store/Store'

export class FocusController {
	#focusinHandler?: (e: FocusEvent) => void
	#focusoutHandler?: () => void
	#clickHandler?: () => void

	constructor(private store: Store) {}

	enable() {
		if (this.#focusinHandler) return

		const container = this.store.refs.container
		if (!container) return

		this.#focusinHandler = e => {
			const target = isHtmlElement(e.target) ? e.target : undefined
			this.store.nodes.focus.target = target
		}

		this.#focusoutHandler = () => {
			this.store.nodes.focus.target = undefined
		}

		this.#clickHandler = () => {
			const tokens = this.store.state.tokens.get()
			if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
				const container = this.store.refs.container
				const element = container ? firstHtmlChild(container) : null
				element?.focus()
			}
		}

		container.addEventListener('focusin', this.#focusinHandler)
		container.addEventListener('focusout', this.#focusoutHandler)
		container.addEventListener('click', this.#clickHandler)

		watch(this.store.events.recoverFocus, () => {
			this.#recover()
		})
	}

	disable() {
		const container = this.store.refs.container
		if (!container || !this.#focusinHandler) return

		container.removeEventListener('focusin', this.#focusinHandler)
		if (this.#focusoutHandler) container.removeEventListener('focusout', this.#focusoutHandler)
		if (this.#clickHandler) container.removeEventListener('click', this.#clickHandler)

		this.#focusinHandler = undefined
		this.#focusoutHandler = undefined
		this.#clickHandler = undefined
	}

	#recover() {
		const recovery = this.store.state.recovery.get()
		if (!recovery) return

		const {anchor, caret, isNext} = recovery
		const isStale = !anchor.target || !anchor.target.isConnected
		let target: HTMLElement | undefined

		// eslint-disable-next-line switch-exhaustiveness-check
		switch (true) {
			case isNext && isStale: {
				const container = this.store.refs.container
				// After re-parse, text at childIndex splits into [text, mark, text]
				// Focus the text span after the mark (childIndex + 2)
				const targetChild =
					recovery.childIndex != null ? childAt(container, recovery.childIndex + 2) : undefined
				target = targetChild ?? this.store.nodes.focus.tail ?? undefined
				break
			}
			case isNext:
				target = anchor.prev.target
				break
			case isStale:
				target = this.store.nodes.focus.head ?? undefined
				break
			default:
				target = anchor.next.target
		}

		this.store.nodes.focus.target = target
		target?.focus()
		queueMicrotask(() => {
			if (!target?.isConnected) return
			this.store.nodes.focus.target = target
			this.store.nodes.focus.caret = caret
		})
		this.store.state.recovery.set(undefined)
	}
}