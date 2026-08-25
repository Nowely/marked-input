import {BlockController} from '../features/block'
import {ClipboardController} from '../features/clipboard'
import {EditController} from '../features/edit'
import {HistoryModel} from '../features/history'
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

	readonly slots = new SlotsFeature(this.props, this.tokens)

	readonly edit = new EditController(this.tokens, this.props)

	readonly history = new HistoryModel(this.props, this.tokens)

	readonly overlay = new OverlayController(this.host, this.props, this.edit, this.tokens)
	readonly block = new BlockController(this.host, this.props, this.tokens)

	// AFTER the overlay, and the order is load-bearing rather than tidy: Esc is the one key two
	// features want, and the row-selection arm defers to an open overlay by asking it.
	readonly keyboard = new KeyboardController(this.host, this.edit, this.tokens, this.history, this.overlay)

	readonly clipboard = new ClipboardController(this.host, this.edit, this.tokens)

	readonly handle = new MarkputHandle(this.host, this.tokens)
}