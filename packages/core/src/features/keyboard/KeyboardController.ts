import type {DomModel} from '../dom/DomModel'
import type {EditController} from '../edit'
import type {TokenModel} from '../parsing/TokenModel'
import type {SelectionController} from '../selection/SelectionController'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {enableArrowNav} from './arrowNav'
import {enableBlockEdit} from './blockEdit'
import {enableInput} from './input'

export class KeyboardController {
	constructor(
		host: Host,
		dom: DomModel,
		value: ValueModel,
		selection: SelectionController,
		edit: EditController,
		tokens: TokenModel,
		props: PropsModel
	) {
		const ctx = {dom, value, selection, edit, tokens, props}
		host.onMounted(container => {
			enableInput(ctx, container)
			enableBlockEdit(ctx, container)
			enableArrowNav(ctx, container)
		})
	}
}