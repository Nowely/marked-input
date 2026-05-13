import type {Range} from '../../shared/editorContracts'
import {replaceInString} from '../../shared/utils'
import type {CaretModel} from '../caret/CaretModel'
import type {PropsModel} from '../props/PropsModel'
import type {ValueModel} from '../value'

/**
 * Single write path for text edits — centralizes read-only gating and caret
 * placement so callers (clipboard, keyboard, overlay) don't reimplement them.
 */
export class EditController {
	constructor(
		private readonly props: PropsModel,
		private readonly value: ValueModel,
		private readonly caret: CaretModel
	) {}

	/**
	 * Replaces `range` with `replacement` and collapses the caret to the end
	 * of the inserted text. Caret is set before {@link ValueModel.replace} so
	 * subscribers observe a consistent value/selection pair on the same tick.
	 */
	replace(range: Range, replacement: string): void {
		if (this.props.readOnly()) return
		const next = replaceInString(this.value.current(), range, replacement)
		if (next === undefined) return

		this.caret.position(range.start + replacement.length)
		this.value.replace(range, replacement)
	}
}