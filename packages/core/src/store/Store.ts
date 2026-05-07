import {CaretFeature} from '../features/caret'
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
	// 0 from 10
	readonly blocks = new BlockRegistry()

	// Providers?
	readonly lifecycle = new LifecycleFeature()
	readonly props = new PropsFeature()

	// in current state it rudementary?
	readonly caret = new CaretFeature()

	// rudementary?
	readonly mark = new MarkFeature(this.props)
	// rudementary?
	readonly slots = new SlotsFeature(this.props)

	// in progress. use service terminology?
	readonly value = new ValueFeature(this.lifecycle, this.props, this.caret)

	readonly parsing = new ParsingFeature(this.lifecycle, this.value, this.mark, this.props, this.slots)

	readonly dom = new DomFeature(this.lifecycle, this.props, this.caret, this.parsing, this.value)

	// Controllers?
	readonly overlay = new OverlayFeature(this.lifecycle, this.props, this.value, this.dom, this.caret, this.parsing)
	readonly keyboard = new KeyboardFeature(
		this.lifecycle,
		this.dom,
		this.value,
		this.caret,
		this.slots,
		this.parsing,
		this.props
	)
	readonly drag = new DragFeature(this.props, this.value, this.parsing)
	readonly clipboard = new ClipboardFeature(this.lifecycle, this.value, this.dom, this.parsing)

	readonly handler = new MarkputHandler(this.dom, this.overlay, this.parsing)

	constructor() {
		this.caret.wire(this.parsing)
	}
}