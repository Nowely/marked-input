import type {RawRange} from '../../shared/editorContracts'
import {listen} from '../../shared/signals/index.js'
import type {CaretFeature} from '../caret/CaretFeature'
import type {DomFeature} from '../dom/DomFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import {toString} from '../parsing'
import type {Token} from '../parsing'
import type {ParsingFeature} from '../parsing/ParseFeature'
import type {ValueFeature} from '../value/ValueFeature'
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
				return Object.assign({}, token, {content: token.content.slice(start, end)})
			}

			if (token.children.length === 0) return token
			return Object.assign({}, token, {children: trimTokensForRawRange(token.children, range)})
		})
}

export class ClipboardFeature {
	constructor(
		private readonly lifecycle: LifecycleFeature,
		private readonly value: ValueFeature,
		private readonly dom: DomFeature,
		private readonly parsing: ParsingFeature,
		private readonly caret: CaretFeature
	) {
		lifecycle.onMounted(() => {
			// The container must be registered before mounted() fires (adapter
			// calls dom.container() in its ref/onMounted, then lifecycle.mounted).
			const container = dom.container()
			if (!container) return

			listen(container, 'copy', e => {
				this.#handleCopy(e)
			})
			listen(container, 'cut', e => {
				if (!this.#handleCopy(e)) return
				const raw = dom.readRawSelection()
				if (!raw.ok || raw.value.range.start === raw.value.range.end) return
				caret.range({start: raw.value.range.start, end: raw.value.range.start})
				value.replace(raw.value.range, '')
			})
		})
	}

	#handleCopy(e: ClipboardEvent): boolean {
		const container = this.dom.container()
		if (!container) return false

		const raw = this.dom.readRawSelection()
		if (!raw.ok || raw.value.range.start === raw.value.range.end) return false

		// text/plain: visual selected text
		const sel = window.getSelection()
		const range = sel?.rangeCount ? sel.getRangeAt(0) : undefined
		if (!range) return false
		const plainText = range.toString()

		// text/html: rendered DOM HTML from the actual selection
		const html = htmlFromRange(range)

		// application/x-markput: raw-selected text tokens are trimmed; overlapping plain marks keep markup syntax.
		const markup = serializeRawRange(this.parsing.tokens(), raw.value.range)

		e.preventDefault()
		e.clipboardData?.setData('text/plain', plainText)
		e.clipboardData?.setData('text/html', html)
		e.clipboardData?.setData(MARKPUT_MIME, markup)
		return true
	}
}