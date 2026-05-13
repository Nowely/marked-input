import type {CaretModel} from '../caret/CaretModel'
import type {DomModel} from '../dom/DomModel'
import type {EditController} from '../edit'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {ParseController} from '../parsing/ParseController'
import type {PropsModel} from '../props/PropsModel'
import type {SlotsFeature} from '../slots/SlotsFeature'
import type {ValueModel} from '../value/ValueModel'
import {enableArrowNav} from './arrowNav'
import {enableBlockEdit} from './blockEdit'
import {enableInput} from './input'

export class KeyboardController {
	constructor(
		lifecycle: Lifecycle,
		dom: DomModel,
		value: ValueModel,
		caret: CaretModel,
		edit: EditController,
		slots: SlotsFeature,
		parsing: ParseController,
		props: PropsModel
	) {
		const ctx = {dom, value, caret, edit, slots, parsing, props}
		lifecycle.onMounted(() => {
			enableInput(ctx)
			enableBlockEdit(ctx)
			enableArrowNav(ctx)
		})
	}
}