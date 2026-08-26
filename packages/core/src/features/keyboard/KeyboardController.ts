import type {EditController} from '../edit'
import type {HistoryModel} from '../history'
import type {OverlayController} from '../overlay'
/* oxlint-disable no-extraneous-class */
// packages/core/src/features/keyboard/KeyboardController.ts
import type {RowController} from '../rows'
import type {Host} from '../state/Host'
import type {TokenModel} from '../tokens'
import {enableInput} from './input'

export class KeyboardController {
	constructor(
		host: Host,
		edit: EditController,
		tokens: TokenModel,
		history: HistoryModel,
		overlay: OverlayController,
		rows: RowController
	) {
		const ctx = {edit, tokens, history, overlay, rows}
		// ONE registration: `enableInput` owns the whole keyboard tier and calls `rowKeys`'s
		// arms itself. A second pair of listeners on the same container had to re-derive every
		// shared verdict and could only see the first pair's answer through `defaultPrevented`.
		host.onMounted(container => enableInput(ctx, container))
	}
}