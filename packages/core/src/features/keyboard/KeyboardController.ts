import type {SelectionController} from '../caret/SelectionController'
import type {DomModel} from '../dom/DomModel'
import type {EditController} from '../edit'
import type {TokenModel} from '../parsing/TokenModel'
import type {SlotsFeature} from '../slots/SlotsFeature'
import type {Lifecycle} from '../state/Lifecycle'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {enableArrowNav} from './arrowNav'
import {enableBlockEdit} from './blockEdit'
import {enableInput} from './input'

export class KeyboardController {
	constructor(
		lifecycle: Lifecycle,
		dom: DomModel,
		value: ValueModel,
		selection: SelectionController,
		edit: EditController,
		slots: SlotsFeature,
		tokens: TokenModel,
		props: PropsModel
	) {
		const ctx = {dom, value, selection, edit, slots, tokens, props}
		lifecycle.onMounted(() => {
			enableInput(ctx)
			enableBlockEdit(ctx)
			enableArrowNav(ctx)
		})
	}
}