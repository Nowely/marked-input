import {BlockController, BlockRegistry} from '../features/block'
import {ClipboardController} from '../features/clipboard'
import {DomModel} from '../features/dom'
import {EditController} from '../features/edit'
import {KeyboardController} from '../features/keyboard'
import {OverlayController} from '../features/overlay'
import {TokenModel} from '../features/parsing'
import {SelectionController} from '../features/selection'
import {SlotsFeature} from '../features/slots'
import {Host, PropsModel, ValueModel} from '../features/state'
import {KeyGenerator} from '../shared/classes'
import {MarkputHandler} from './MarkputHandler'

export type {DragAction} from '../shared/types'

export class Store {
	readonly key = new KeyGenerator()

	readonly host = new Host()
	readonly props = new PropsModel()
	readonly value = new ValueModel(this.props)
	readonly tokens = new TokenModel(this.value, this.props)

	readonly slots = new SlotsFeature(this.props)

	readonly dom = new DomModel(this.host, this.props, this.tokens)

	readonly selection = new SelectionController(this.host, this.dom, this.tokens, this.value, this.props)
	readonly edit = new EditController(this.value, this.selection)

	readonly overlay = new OverlayController(
		this.host,
		this.props,
		this.value,
		this.dom,
		this.selection,
		this.edit,
		this.tokens
	)
	readonly keyboard = new KeyboardController(
		this.host,
		this.dom,
		this.value,
		this.selection,
		this.edit,
		this.tokens,
		this.props
	)
	readonly block = new BlockController(this.props, this.value, this.tokens, this.selection, this.edit)
	readonly blocks = new BlockRegistry()

	readonly clipboard = new ClipboardController(this.host, this.edit, this.dom, this.tokens)

	readonly handler = new MarkputHandler(this.host, this.overlay, this.selection)
}