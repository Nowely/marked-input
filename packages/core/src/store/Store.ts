import {BlockController, BlockRegistry} from '../features/block'
import {CaretModel} from '../features/caret'
import {ClipboardController} from '../features/clipboard'
import {DomModel} from '../features/dom'
import {EditController} from '../features/edit'
import {KeyboardController} from '../features/keyboard'
import {OverlayController} from '../features/overlay'
import {MarkFeature, ParseController} from '../features/parsing'
import {SlotsFeature} from '../features/slots'
import {Lifecycle, PropsModel, ValueModel} from '../features/state'
import {KeyGenerator} from '../shared/classes'
import {MarkputHandler} from './MarkputHandler'

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

	readonly dom = new DomModel(this.lifecycle, this.props, this.parsing)

	readonly caret = new CaretModel(this.lifecycle, this.dom, this.parsing, this.value, this.props)
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
	readonly block = new BlockController(this.props, this.value, this.parsing, this.caret)
	readonly clipboard = new ClipboardController(this.lifecycle, this.edit, this.dom, this.parsing)

	readonly handler = new MarkputHandler(this.dom, this.overlay, this.parsing, this.caret)
}