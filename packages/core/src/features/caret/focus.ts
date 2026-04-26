import {firstHtmlChild, isHtmlElement} from '../../shared/checkers'
import {effectScope, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export function enableFocus(store: Store): () => void {
	const container = store.dom.container()
	if (!container) return () => {}

	const scope = effectScope(() => {
		listen(container, 'focusin', e => {
			const target = isHtmlElement(e.target) ? e.target : undefined
			if (!target) {
				store.caret.location(undefined)
				return
			}
			const result = store.dom.locateNode(target)
			if (!result.ok) {
				if (result.reason === 'control') return
				store.caret.location(undefined)
				return
			}

			const role = result.value.textElement?.contains(target) ? 'text' : 'markDescendant'
			store.caret.location({address: result.value.address, role})
		})

		listen(container, 'focusout', () => {
			store.caret.location(undefined)
		})

		listen(container, 'click', () => {
			const tokens = store.parsing.tokens()
			if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
				const container = store.dom.container()
				const element = container ? firstHtmlChild(container) : null
				element?.focus()
			}
		})
	})

	return () => scope()
}