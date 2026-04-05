import {toString} from '../parsing'
import type {Store} from '../store'
import {MARKPUT_MIME} from './pasteMarkup'
import {selectionToTokens} from './selectionToTokens'

export class CopyController {
	#copyHandler?: (e: ClipboardEvent) => void

	constructor(private store: Store) {}

	enable() {
		if (this.#copyHandler) return

		this.#copyHandler = (e: ClipboardEvent) => {
			const container = this.store.refs.container
			if (!container) return

			const sel = window.getSelection()
			if (!sel || sel.isCollapsed || !sel.rangeCount) return

			const range = sel.getRangeAt(0)
			if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
				return
			}

			const result = selectionToTokens(this.store)
			if (!result) return

			// text/plain: visual selected text (partial marks = just selected text)
			const plainText = range.toString()

			// text/html: rendered DOM HTML from the actual selection
			const fragment = range.cloneContents()
			const div = document.createElement('div')
			div.appendChild(fragment)
			const html = div.innerHTML

			// application/x-markput: only when selection covers complete tokens
			// partial selections fall back to text/plain on paste
			const isFullTokenRange = result.firstFullySelected && result.lastFullySelected

			e.preventDefault()
			e.clipboardData?.setData('text/plain', plainText)
			e.clipboardData?.setData('text/html', html)
			if (isFullTokenRange) {
				e.clipboardData?.setData(MARKPUT_MIME, toString(result.tokens))
			}
		}

		this.store.refs.container?.addEventListener('copy', this.#copyHandler)
	}

	disable() {
		if (this.#copyHandler) {
			this.store.refs.container?.removeEventListener('copy', this.#copyHandler)
			this.#copyHandler = undefined
		}
	}
}