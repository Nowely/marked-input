/* oxlint-disable no-extraneous-class */
// packages/core/src/features/keyboard/KeyboardController.ts
import type {EditController} from '../edit'
import type {SelectionController} from '../selection/SelectionController'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {TokenModel} from '../tokens'
import {enableArrowNav} from './arrowNav'
import {enableBlockEdit} from './blockEdit'
import {enableInput} from './input'

export class KeyboardController {
	constructor(
		host: Host,
		selection: SelectionController,
		edit: EditController,
		tokens: TokenModel,
		props: PropsModel
	) {
		const ctx = {selection, edit, tokens, props}
		host.onMounted(container => {
			enableInput(ctx, container)
			enableBlockEdit(ctx, container)
			enableArrowNav(ctx, container)
		})
	}
}