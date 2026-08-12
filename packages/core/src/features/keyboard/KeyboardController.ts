/* oxlint-disable no-extraneous-class */
// packages/core/src/features/keyboard/KeyboardController.ts
import type {EditController} from '../edit'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {TokenModel} from '../tokens'
import {enableBlockEdit} from './blockEdit'
import {enableInput} from './input'

export class KeyboardController {
	constructor(host: Host, edit: EditController, tokens: TokenModel, props: PropsModel) {
		const ctx = {edit, tokens, props}
		host.onMounted(container => {
			enableInput(ctx, container)
			enableBlockEdit(ctx, container)
		})
	}
}