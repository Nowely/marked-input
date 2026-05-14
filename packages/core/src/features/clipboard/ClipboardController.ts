import {listen} from '../../shared/signals/index.js'
import type {DomModel} from '../dom/DomModel'
import type {EditController} from '../edit'
import type {TokenModel} from '../parsing/TokenModel'
import {serializeRange} from '../parsing/utils/serializeRange'
import type {Lifecycle} from '../state/Lifecycle'
import {MARKPUT_MIME} from './pasteMarkup'

export class ClipboardController {
	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly edit: EditController,
		private readonly dom: DomModel,
		private readonly tokens: TokenModel
	) {
		lifecycle.onMounted(() => {
			const container = dom.container()
			if (!container) return

			listen(container, 'copy', e => {
				this.#handleCopy(e)
			})
			listen(container, 'cut', e => {
				if (!this.#handleCopy(e)) return
				const raw = dom.readRawSelection()
				if (!raw.ok || raw.value.range.start === raw.value.range.end) return
				edit.replace(raw.value.range, '')
			})
		})
	}

	#handleCopy(e: ClipboardEvent): boolean {
		const raw = this.dom.readRawSelection()
		if (!raw.ok || raw.value.range.start === raw.value.range.end) return false

		const content = this.dom.readSelectedContent()
		if (!content) return false

		e.preventDefault()
		e.clipboardData?.setData('text/plain', content.text)
		e.clipboardData?.setData('text/html', content.html)
		e.clipboardData?.setData(MARKPUT_MIME, serializeRange(this.tokens.current(), raw.value.range))
		return true
	}
}