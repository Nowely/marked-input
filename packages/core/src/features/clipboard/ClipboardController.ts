// packages/core/src/features/clipboard/ClipboardController.ts
import {listen} from '../../shared/signals/index.js'
import type {EditController} from '../edit'
import type {Host} from '../state/Host'
import type {Anchors, TokenModel} from '../tokens'
import {anchorEquals} from '../tokens'
import {MARKPUT_MIME} from './pasteMarkup'

export class ClipboardController {
	constructor(
		host: Host,
		edit: EditController,
		private readonly tokens: TokenModel
	) {
		host.onMounted(container => {
			listen(container, 'copy', e => {
				this.#handleCopy(e)
			})
			listen(container, 'cut', e => {
				const anchors = this.#handleCopy(e)
				if (!anchors) return
				// A cut takes what the copy above put on the clipboard, and over whole rows that is
				// their LINES — openers included, which is what `valueBetween` projected. Removing
				// the span between the anchors left the first row's opener behind as an empty row
				// of that kind, so cut and copy disagreed about what was selected.
				//
				// ONE SHAPE WHERE THEY STILL DISAGREE, and it is this call's doing: the copy above
				// projects the RAW anchors, `replaceRows` excludes the subtrees the frame paints no
				// box for (`TokenModel.#hiddenWithin`), so a cut over a cover holding a collapsed
				// toggle clipboards the hidden body AND leaves it — measured `'beforeheadbody'` on
				// the clipboard with `'\tbody\nafter'` still in the value. It fails in the safe
				// direction, a duplicate on paste rather than a loss. The fix is the copy path's
				// own clip, which is wider than this branch: `selectedContent`/`valueBetween` serve
				// plain `copy` too. Ticket 40 in `docs/scratch/notion-like/issues/`.
				if (this.tokens.replaceRows(anchors, null)) return
				edit.replace(anchors.anchor, anchors.head, '')
			})
		})
	}

	/** The live DOM selection when it actually spans something; `undefined` for a caret or no selection. */
	#selected(): Anchors | undefined {
		const anchors = this.tokens.domAnchors()
		if (!anchors || anchorEquals(anchors.anchor, anchors.head)) return undefined
		return anchors
	}

	#handleCopy(e: ClipboardEvent): Anchors | undefined {
		const anchors = this.#selected()
		if (!anchors) return

		const content = this.tokens.selectedContent()
		if (!content) return

		e.preventDefault()
		e.clipboardData?.setData('text/plain', content.text)
		e.clipboardData?.setData('text/html', content.html)
		// The markup entry is the LIVE tree's own projection of the copied span, so a copy
		// right after typing is fresh by construction — there is no snapshot to fall behind.
		e.clipboardData?.setData(MARKPUT_MIME, this.tokens.valueBetween(anchors.anchor, anchors.head))
		return anchors
	}
}