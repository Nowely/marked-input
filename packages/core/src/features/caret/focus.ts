import {childAt, firstHtmlChild, isHtmlElement} from '../../shared/checkers'
import {effectScope, watch, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export function enableFocus(store: Store): () => void {
	const container = store.feature.slots.container()
	if (!container) return () => {}

	const scope = effectScope(() => {
		listen(container, 'focusin', e => {
			const target = isHtmlElement(e.target) ? e.target : undefined
			store.nodes.focus.target = target
		})

		listen(container, 'focusout', () => {
			store.nodes.focus.target = undefined
		})

		listen(container, 'click', () => {
			const tokens = store.feature.parsing.state.tokens()
			if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
				const container = store.feature.slots.container()
				const element = container ? firstHtmlChild(container) : null
				element?.focus()
			}
		})

		watch(store.feature.lifecycle.rendered, () => {
			store.feature.dom.reconcile()
			if (!store.props.Mark()) return
			recover(store)
		})
	})

	return () => {
		scope()
		store.nodes.focus.clear()
	}
}

function recover(store: Store) {
	const recovery = store.feature.caret.state.recovery()
	if (!recovery) return

	const {anchor, caret, isNext} = recovery
	const isStale = !anchor.target || !anchor.target.isConnected
	let target: HTMLElement | undefined

	// eslint-disable-next-line switch-exhaustiveness-check
	switch (true) {
		case isNext && isStale: {
			const container = store.feature.slots.container()
			const targetChild = recovery.childIndex != null ? childAt(container, recovery.childIndex + 2) : undefined
			target = targetChild ?? store.nodes.focus.tail ?? undefined
			break
		}
		case isNext:
			target = anchor.prev.target
			break
		case isStale:
			target = store.nodes.focus.head ?? undefined
			break
		default:
			target = anchor.next.target
	}

	store.nodes.focus.target = target
	target?.focus()
	queueMicrotask(() => {
		if (!target?.isConnected) return
		store.nodes.focus.target = target
		store.nodes.focus.caret = caret
	})
	store.feature.caret.state.recovery(undefined)
}