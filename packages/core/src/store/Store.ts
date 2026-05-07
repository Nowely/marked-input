import {CaretFeature} from '../features/caret'
import {enableFocus} from '../features/caret/focus'
import {enableSelection} from '../features/caret/selection'
import {ClipboardFeature} from '../features/clipboard'
import {DomFeature} from '../features/dom'
import {DragFeature} from '../features/drag'
import {KeyboardFeature} from '../features/keyboard'
import {LifecycleFeature} from '../features/lifecycle'
import {MarkFeature} from '../features/mark'
import {OverlayFeature} from '../features/overlay'
import {ParsingFeature} from '../features/parsing/ParseFeature'
import {PropsFeature} from '../features/props/PropsFeature'
import {SlotsFeature} from '../features/slots'
import {ValueFeature} from '../features/value'
import {KeyGenerator, MarkputHandler} from '../shared/classes'
import {BlockRegistry} from './BlockRegistry'

export type {DragAction} from '../shared/types'

export class Store {
	readonly key = new KeyGenerator()
	readonly blocks = new BlockRegistry()

	// Layer 0 — no feature deps
	readonly lifecycle = new LifecycleFeature()
	readonly props = new PropsFeature()
	readonly caret = new CaretFeature()

	// Layer 1 — props only
	readonly mark = new MarkFeature(this.props)
	readonly slots = new SlotsFeature(this.props)

	// Layer 2 — lifecycle + props + caret
	readonly value = new ValueFeature(this.lifecycle, this.props, this.caret)

	// Layer 3 — value + mark + slots (+ lifecycle + props)
	readonly parsing = new ParsingFeature(this.lifecycle, this.value, this.mark, this.props, this.slots)

	// Layer 4 — caret + parsing (+ lifecycle + props)
	readonly dom = new DomFeature(this.lifecycle, this.props, this.caret, this.parsing)

	// Layer 5 — everything below
	readonly overlay = new OverlayFeature(this.lifecycle, this.props, this.value, this.dom, this.caret, this.parsing)
	readonly keyboard = new KeyboardFeature(this) // behavior modules; keeps full Store
	readonly drag = new DragFeature(this.props, this.value, this.parsing)
	readonly clipboard = new ClipboardFeature(this.lifecycle, this.value, this.dom, this.parsing)

	readonly handler = new MarkputHandler(this)

	constructor() {
		// Wire caret behavior modules here rather than in CaretFeature: they need
		// dom, which is declared after caret in topological order.
		this.lifecycle.onMounted(() => {
			enableFocus(this)
			enableSelection(this)
		})
	}
}