import {batch} from '../../shared/signals'
import type {SelectionController} from '../selection/SelectionController'
import type {PropsModel} from '../state'
import type {NodeAnchor, TokenModel} from '../tokens'

/**
 * Single write path for text edits — delegates gating to the token layer's write verbs and
 * only moves the caret when the edit is accepted. Wrapped in {@link batch} so subscribers
 * observe a consistent value/selection pair on one tick.
 *
 * Addressed by NODE ANCHORS since S2.5 (spec S2 §4.5). {@link setValue}'s `caretOffset` is
 * the one absolute offset left in any core module, and D6 is why: `block/operations.ts`
 * synthesizes a complete new string from row positions and computes the caret against THAT
 * string, before it is parsed — so no node exists to name it. It is unreachable from the
 * public export, so "no export of @markput/core takes or returns an absolute offset" holds
 * without an exception.
 */
export class EditController {
	constructor(
		private readonly tokens: TokenModel,
		private readonly selection: SelectionController,
		private readonly props: PropsModel
	) {}

	/** Replace the span between two anchors; the pair is normalized, so `from` after `to` is legal. */
	replace(from: NodeAnchor, to: NodeAnchor, text: string): void {
		batch(() => {
			const caret = this.tokens.replaceBetween(from, to, text)
			if (!caret) return
			// Controlled mode moves no DERIVED caret here (spec D6): the tree has not changed
			// yet, so this position would be captured as `selectionBefore` at the echo and
			// shifted a SECOND time by `map` — measured 'hello' + 'X' at 2 landing the caret at
			// 4 instead of 3. The echo's repair owns it, and a parent that never echoes now
			// leaves the caret alone instead of moving it and having it clamped back.
			if (this.props.value() !== undefined) return
			this.selection.select(caret)
		})
	}

	/**
	 * Whole-value rewrite (spec D6). `caretOffset` overrides the default post-edit caret
	 * (the end of `text`) and indexes `text` itself.
	 *
	 * It is EXEMPT from the controlled-mode rule above, and the exemption is measured rather
	 * than defensive: it is a caller INTENT (block reorder, row merge) that `map` cannot
	 * reconstruct. Dropping it made `Drag.{react,vue}.spec`'s "backspace on empty row › delete
	 * the row and reduce count by 1" fail in both frameworks — PlainTextDrag is controlled AND
	 * echoes. Those callers keep the double-shift; see plan decision D-e.
	 */
	setValue(text: string, caretOffset?: number): void {
		batch(() => {
			if (!this.tokens.setValue(text)) return
			if (this.props.value() !== undefined && caretOffset === undefined) return
			this.selection.select(this.tokens.anchorAt(caretOffset ?? text.length))
		})
	}
}