import type {Range} from '../../shared/editorContracts'
import {batch} from '../../shared/signals'
import type {SelectionController} from '../selection/SelectionController'
import type {ValueModel} from '../state'

/**
 * Single write path for text edits — delegates gating to {@link ValueModel.replace}
 * and only moves the caret when the edit is accepted. Wrapped in {@link batch}
 * so subscribers observe a consistent value/selection pair on one tick.
 */
export class EditController {
	constructor(
		private readonly value: ValueModel,
		private readonly selection: SelectionController
	) {}

	replace(range: Range, replacement: string): void {
		batch(() => {
			if (!this.value.replace(range, replacement)) return
			this.selection.position(range.start + replacement.length)
		})
	}
}