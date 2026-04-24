import type {RawRange} from '../../shared/editorContracts'
import {effectScope, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store'
import {toString} from '../parsing'
import type {Token} from '../parsing'
import {MARKPUT_MIME} from './pasteMarkup'

function htmlFromRange(range: Range): string {
	const fragment = range.cloneContents()
	const div = document.createElement('div')
	div.appendChild(fragment)
	return div.innerHTML
}

function serializeRawRange(tokens: readonly Token[], range: RawRange): string {
	return toString(trimTokensForRawRange(tokens, range))
}

function trimTokensForRawRange(tokens: readonly Token[], range: RawRange): Token[] {
	return tokens
		.filter(token => token.position.end > range.start && token.position.start < range.end)
		.map(token => {
			if (token.type === 'text') {
				const start = Math.max(0, range.start - token.position.start)
				const end = Math.min(token.content.length, range.end - token.position.start)
				return {...token, content: token.content.slice(start, end)}
			}

			if (token.children.length === 0) return token
			return {...token, children: trimTokensForRawRange(token.children, range)}
		})
}

export class ClipboardFeature {
	#scope?: () => void

	constructor(private readonly store: Store) {}

	enable() {
		if (this.#scope) return

		const container = this.store.slots.container()
		if (!container) return

		this.#scope = effectScope(() => {
			listen(container, 'copy', e => {
				this.#handleCopy(e)
			})

			listen(container, 'cut', e => {
				if (!this.#handleCopy(e)) return

				const raw = this.store.dom.readRawSelection()
				if (!raw.ok || raw.value.range.start === raw.value.range.end) return

				this.store.value.replaceRange(raw.value.range, '', {
					source: 'cut',
					recover: {kind: 'caret', rawPosition: raw.value.range.start},
				})
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}

	#handleCopy(e: ClipboardEvent): boolean {
		const container = this.store.slots.container()
		if (!container) return false

		const raw = this.store.dom.readRawSelection()
		if (!raw.ok || raw.value.range.start === raw.value.range.end) return false

		// text/plain: visual selected text
		const sel = window.getSelection()
		const range = sel?.rangeCount ? sel.getRangeAt(0) : undefined
		if (!range) return false
		const plainText = range.toString()

		// text/html: rendered DOM HTML from the actual selection
		const html = htmlFromRange(range)

		// application/x-markput: raw-selected text tokens are trimmed; overlapping plain marks keep markup syntax.
		const markup = serializeRawRange(this.store.parsing.tokens(), raw.value.range)

		e.preventDefault()
		e.clipboardData?.setData('text/plain', plainText)
		e.clipboardData?.setData('text/html', html)
		e.clipboardData?.setData(MARKPUT_MIME, markup)
		return true
	}
}