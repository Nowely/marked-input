import type {CaretFeature} from '../caret/CaretFeature'
import type {DomFeature} from '../dom/DomFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {ParsingFeature} from '../parsing/ParseFeature'
import type {PropsFeature} from '../props/PropsFeature'
import type {SlotsFeature} from '../slots/SlotsFeature'
import type {ValueFeature} from '../value/ValueFeature'
import {enableArrowNav} from './arrowNav'
import {enableBlockEdit} from './blockEdit'
import {enableInput} from './input'

export class KeyboardFeature {
	constructor(
		lifecycle: LifecycleFeature,
		dom: DomFeature,
		value: ValueFeature,
		caret: CaretFeature,
		slots: SlotsFeature,
		parsing: ParsingFeature,
		props: PropsFeature
	) {
		const ctx = {dom, value, caret, slots, parsing, props}
		lifecycle.onMounted(() => {
			enableInput(ctx)
			enableBlockEdit(ctx)
			enableArrowNav(ctx)
		})
	}
}