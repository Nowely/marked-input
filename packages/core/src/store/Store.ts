import {CaretModel} from '../features/caret'
import {ClipboardController} from '../features/clipboard'
import {DomController} from '../features/dom'
import {DragController} from '../features/drag'
import {EditController} from '../features/edit'
import {KeyboardController} from '../features/keyboard'
import {Lifecycle} from '../features/lifecycle'
import {MarkFeature} from '../features/mark'
import {OverlayController} from '../features/overlay'
import {ParseController} from '../features/parsing/ParseController'
import {PropsModel} from '../features/props/PropsModel'
import {SlotsFeature} from '../features/slots'
import {ValueModel} from '../features/value'
import {KeyGenerator, MarkputHandler} from '../shared/classes'
import {BlockRegistry} from './BlockRegistry'

export type {DragAction} from '../shared/types'

export class Store {
	readonly key = new KeyGenerator()
	// 0 from 10
	readonly blocks = new BlockRegistry()

	readonly lifecycle = new Lifecycle()
	readonly props = new PropsModel()
	readonly value = new ValueModel(this.props)

	readonly mark = new MarkFeature(this.props)
	readonly slots = new SlotsFeature(this.props)

	readonly parsing = new ParseController(this.lifecycle, this.value, this.mark, this.props, this.slots)

	readonly dom = new DomController(this.lifecycle, this.props, this.parsing, this.value)

	readonly caret = new CaretModel(this.lifecycle, this.dom, this.value)
	readonly edit = new EditController(this.value, this.caret)

	readonly overlay = new OverlayController(
		this.lifecycle,
		this.props,
		this.value,
		this.dom,
		this.caret,
		this.edit,
		this.parsing
	)
	readonly keyboard = new KeyboardController(
		this.lifecycle,
		this.dom,
		this.value,
		this.caret,
		this.edit,
		this.slots,
		this.parsing,
		this.props
	)
	readonly drag = new DragController(this.props, this.value, this.parsing, this.caret)
	readonly clipboard = new ClipboardController(this.lifecycle, this.edit, this.dom, this.parsing)

	readonly handler = new MarkputHandler(this.dom, this.overlay, this.parsing)
}