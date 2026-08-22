/* oxlint-disable no-extraneous-class */
// packages/core/src/features/keyboard/KeyboardController.ts
import type {EditController} from '../edit'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {TokenModel} from '../tokens'
import {enableInput} from './input'

export class KeyboardController {
	constructor(host: Host, edit: EditController, tokens: TokenModel, props: PropsModel) {
		const ctx = {edit, tokens, props}
		// ONE registration: `enableInput` owns the whole keyboard tier and calls `blockEdit`'s
		// arms itself. A second pair of listeners on the same container had to re-derive every
		// shared verdict and could only see the first pair's answer through `defaultPrevented`.
		host.onMounted(container => enableInput(ctx, container))
	}
}