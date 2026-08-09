import type {Range} from '../../shared/editorContracts'
import {batch} from '../../shared/signals'
import type {SelectionController} from '../selection/SelectionController'
import type {PropsModel, ValueModel} from '../state'

/**
 * Single write path for text edits — delegates gating to {@link ValueModel.replace}
 * and only moves the caret when the edit is accepted. Wrapped in {@link batch}
 * so subscribers observe a consistent value/selection pair on one tick.
 *
 * - `range.end < 0` means "to the end of the value"; the token layer's offset
 *   shim normalizes it. Use `{start: 0, end: -1}` for whole-value replacements.
 * - `caretAt` overrides the default post-edit caret (which is
 *   `range.start + replacement.length`). Used by sites whose desired caret
 *   is not the natural end of the replacement (e.g. block reorder).
 */
export class EditController {
	constructor(
		private readonly value: ValueModel,
		private readonly selection: SelectionController,
		private readonly props: PropsModel
	) {}

	replace(range: Range, replacement: string, caretAt?: number): void {
		batch(() => {
			// `range.end < 0` is normalized by the offset shim; the caret only ever needed
			// `range.start`, which normalization never touched.
			if (!this.value.replace(range, replacement)) return
			// Controlled mode moves no DERIVED caret here (spec D6): the tree has not changed
			// yet, so this position would be captured as `selectionBefore` at the echo and
			// shifted a SECOND time by `map` — measured 'hello' + 'X' at 2 landing the caret at
			// 4 instead of 3. The echo's repair owns it, and a parent that never echoes now
			// leaves the caret alone instead of moving it and having it clamped back.
			//
			// `caretAt` is EXEMPT and the exemption is measured, not defensive: it is a caller
			// INTENT (block reorder, row merge) that `map` cannot reconstruct. Dropping it made
			// Drag.{react,vue}.spec "backspace on empty row › delete the row and reduce count
			// by 1" fail in both frameworks — PlainTextDrag is controlled AND echoes. Those
			// callers keep the double-shift; see plan decision D-e for the trade-off and the
			// S1.7 follow-up.
			if (this.props.value() !== undefined && caretAt === undefined) return
			this.selection.position(caretAt ?? range.start + replacement.length)
		})
	}
}