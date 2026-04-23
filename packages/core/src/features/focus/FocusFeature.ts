import {childAt, firstHtmlChild, isHtmlElement} from '../../shared/checkers'
import {effectScope, watch, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export class FocusFeature {
	#scope?: () => void

	constructor(private readonly store: Store) {}

	enable() {
		if (this.#scope) return

		const container = this.store.state.container()
		if (!container) return

		this.#scope = effectScope(() => {
			listen(container, 'focusin', e => {
				const target = isHtmlElement(e.target) ? e.target : undefined
				this.store.nodes.focus.target = target
			})

			listen(container, 'focusout', () => {
				this.store.nodes.focus.target = undefined
			})

			listen(container, 'click', () => {
				const tokens = this.store.state.tokens()
				if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
					const container = this.store.state.container()
					const element = container ? firstHtmlChild(container) : null
					element?.focus()
				}
			})

			watch(this.store.feature.lifecycle.emit.rendered, () => {
				this.store.emit.sync()
				if (!this.store.props.Mark()) return
				this.#recover()
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
		this.store.nodes.focus.clear()
	}

	#recover() {
		const recovery = this.store.state.recovery()
		if (!recovery) return

		const {anchor, caret, isNext} = recovery
		const isStale = !anchor.target || !anchor.target.isConnected
		let target: HTMLElement | undefined

		// eslint-disable-next-line switch-exhaustiveness-check
		switch (true) {
			case isNext && isStale: {
				const container = this.store.state.container()
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
		this.store.state.recovery(undefined)
	}
}