import {toString} from '../parsing'
import type {Token} from '../parsing'
import type {Store} from '../store'
import {MARKPUT_MIME} from './pasteMarkup'
import {type SelectionTokenRange, selectionToTokens} from './selectionToTokens'

/**
 * Trim boundary text tokens to the selected portion.
 * Mark tokens are always kept in full — partial mark selection expands to full mark.
 */
function trimBoundaryTokens({tokens, startOffset, endOffset}: SelectionTokenRange): Token[] {
	if (tokens.length === 0) return tokens

	return tokens.map((token, i) => {
		if (token.type !== 'text') return token

		const isFirst = i === 0
		const isLast = i === tokens.length - 1

		if (isFirst && isLast) return {...token, content: token.content.slice(startOffset, endOffset)}
		if (isFirst) return {...token, content: token.content.slice(startOffset)}
		if (isLast) return {...token, content: token.content.slice(0, endOffset)}
		return token
	})
}

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

			// text/plain: visual selected text
			const plainText = range.toString()

			// text/html: rendered DOM HTML from the actual selection
			const fragment = range.cloneContents()
			const div = document.createElement('div')
			div.appendChild(fragment)
			const html = div.innerHTML

			// application/x-markput: boundary text tokens trimmed to selected portion,
			// mark tokens always expanded to full markup syntax
			const markup = toString(trimBoundaryTokens(result))

			e.preventDefault()
			e.clipboardData?.setData('text/plain', plainText)
			e.clipboardData?.setData('text/html', html)
			e.clipboardData?.setData(MARKPUT_MIME, markup)
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