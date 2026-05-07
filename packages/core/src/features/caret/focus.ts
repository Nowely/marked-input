import {firstHtmlChild, isHtmlElement} from '../../shared/checkers'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export function enableFocus(store: Pick<Store, 'dom' | 'caret' | 'parsing'>): void {
	const container = store.dom.container()
	if (!container) return

	listen(container, 'focusin', e => {
		const target = isHtmlElement(e.target) ? e.target : undefined
		if (!target) {
			store.caret.location(undefined)
			store.caret.range(undefined)
			return
		}
		const result = store.dom.locateNode(target)
		if (!result.ok) {
			if (result.reason === 'control') return
			store.caret.location(undefined)
			store.caret.range(undefined)
			return
		}

		const role = result.value.textElement?.contains(target) ? 'text' : 'markDescendant'
		store.caret.location({address: result.value.address, role}) // bridge; removed in Task 11

		const rawSel = store.dom.readRawSelection()
		if (rawSel.ok) store.caret.range(rawSel.value.range)
	})

	listen(container, 'focusout', () => {
		store.caret.location(undefined)
		// Defer clearing range so intra-editor focus shifts caused by value
		// edits (e.g. a mark element being removed during re-render) do not
		// wipe an explicit caret.range write. Only clear when focus has
		// actually left the editor.
		queueMicrotask(() => {
			if (!container.contains(document.activeElement)) {
				store.caret.range(undefined)
			}
		})
	})

	listen(container, 'click', () => {
		const tokens = store.parsing.tokens()
		if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
			const container = store.dom.container()
			const element = container ? firstHtmlChild(container) : null
			element?.focus()
		}
	})
}