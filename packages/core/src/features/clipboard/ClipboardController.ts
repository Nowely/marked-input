// packages/core/src/features/clipboard/ClipboardController.ts
import {listen} from '../../shared/signals/index.js'
import type {EditController} from '../edit'
import type {SelectionController} from '../selection/SelectionController'
import type {Host} from '../state/Host'
import type {TokenModel} from '../tokens'
import {MARKPUT_MIME} from './pasteMarkup'
import {serializeRange} from './serializeRange'

export class ClipboardController {
	constructor(
		host: Host,
		edit: EditController,
		private readonly selection: SelectionController,
		private readonly tokens: TokenModel
	) {
		host.onMounted(container => {
			listen(container, 'copy', e => {
				this.#handleCopy(e)
			})
			listen(container, 'cut', e => {
				if (!this.#handleCopy(e)) return
				const raw = selection.readRaw()
				if (!raw || raw.range.start === raw.range.end) return
				edit.replaceRange(raw.range, '')
			})
		})
	}

	#handleCopy(e: ClipboardEvent): boolean {
		const raw = this.selection.readRaw()
		if (!raw || raw.range.start === raw.range.end) return false

		const content = this.tokens.selectedContent()
		if (!content) return false

		e.preventDefault()
		e.clipboardData?.setData('text/plain', content.text)
		e.clipboardData?.setData('text/html', content.html)
		// Fresh read: the copied range came from the live selection, so the
		// serialized tokens carry live positions — current() is the reconciled
		// tree consistent with value.current() (copy right after typing is fresh).
		e.clipboardData?.setData(MARKPUT_MIME, serializeRange(this.tokens.current(), raw.range))
		return true
	}
}