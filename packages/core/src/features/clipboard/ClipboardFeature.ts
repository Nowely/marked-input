import {effectScope, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store'
import {toString} from '../parsing'
import type {Token} from '../parsing'
import {MARKPUT_MIME} from './pasteMarkup'
import {type SelectionTokenRange, selectionToTokens} from './selectionToTokens'

/**
 * Trim boundary text tokens to the selected portion.
 * Mark tokens are always kept in full — partial mark selection expands to full mark.
 *
 * NOTE: Returned text tokens have stale `position` fields — the start/end positions
 * still reflect the original token, not the trimmed content. Only `content` is
 * authoritative on the returned tokens. `toString` is safe because it reads `content`
 * directly; do not use `position` on the returned tokens for any other purpose.
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

				const result = selectionToTokens(this.store)
				if (!result || result.tokens.length === 0) return

				const first = result.tokens[0]
				const last = result.tokens[result.tokens.length - 1]

				const rawStart =
					first.type === 'text' ? first.position.start + result.startOffset : first.position.start
				const rawEnd = last.type === 'text' ? last.position.start + result.endOffset : last.position.end

				const value = this.store.value.current()
				if (rawStart === rawEnd) return

				const newValue = value.slice(0, rawStart) + value.slice(rawEnd)
				this.store.value.next(newValue)
				if (this.store.value.isControlledMode()) return

				const newTokens = this.store.parsing.tokens()
				let targetIdx = newTokens.findIndex(
					t => t.type === 'text' && rawStart >= t.position.start && rawStart <= t.position.end
				)
				if (targetIdx === -1) targetIdx = newTokens.length - 1
				const caretWithinToken = rawStart - newTokens[targetIdx].position.start

				this.store.caret.recovery({
					anchor: this.store.nodes.focus,
					caret: caretWithinToken,
					isNext: true,
					childIndex: targetIdx - 2,
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

		const sel = window.getSelection()
		if (!sel || sel.isCollapsed || !sel.rangeCount) return false

		const range = sel.getRangeAt(0)
		if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
			return false
		}

		const result = selectionToTokens(this.store)
		if (!result) return false

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
		return true
	}
}