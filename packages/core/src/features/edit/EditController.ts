import type {Range} from '../../shared/editorContracts'
import {batch} from '../../shared/signals'
import type {SelectionController} from '../selection/SelectionController'
import type {ValueModel} from '../state'

/**
 * Single write path for text edits — delegates gating to {@link ValueModel.replace}
 * and only moves the caret when the edit is accepted. Wrapped in {@link batch}
 * so subscribers observe a consistent value/selection pair on one tick.
 *
 * - `range.end < 0` is normalized to the current value length. Use
 *   `{start: 0, end: -1}` for whole-value replacements.
 * - `caretAt` overrides the default post-edit caret (which is
 *   `range.start + replacement.length`). Used by sites whose desired caret
 *   is not the natural end of the replacement (e.g. block reorder).
 */
export class EditController {
	constructor(
		private readonly value: ValueModel,
		private readonly selection: SelectionController
	) {}

	replace(range: Range, replacement: string, caretAt?: number): void {
		batch(() => {
			const normalized: Range = range.end < 0 ? {start: range.start, end: this.value.current().length} : range
			if (!this.value.replace(normalized, replacement)) return
			const caret = caretAt ?? normalized.start + replacement.length
			this.selection.range({start: caret, end: caret})
		})
	}
}