import {BlockController} from '../features/block'
import {ClipboardController} from '../features/clipboard'
import {EditController} from '../features/edit'
import {KeyboardController} from '../features/keyboard'
import {OverlayController} from '../features/overlay'
import {SlotsFeature} from '../features/slots'
import {Host, PropsModel} from '../features/state'
import {TokenModel} from '../features/tokens'
import {MarkputHandle} from './MarkputHandle'

//TODO rename to Markput, Core, Engine, Editor?
export class Store {
	readonly host = new Host()
	readonly props = new PropsModel()

	readonly tokens = new TokenModel(this.props, this.host)

	readonly slots = new SlotsFeature(this.props)

	readonly edit = new EditController(this.tokens, this.props)

	readonly keyboard = new KeyboardController(this.host, this.edit, this.tokens, this.props)

	readonly overlay = new OverlayController(this.host, this.props, this.edit, this.tokens)
	readonly block = new BlockController(this.props, this.tokens)

	readonly clipboard = new ClipboardController(this.host, this.edit, this.tokens)

	readonly api = new MarkputHandle(this.host, this.tokens)
}