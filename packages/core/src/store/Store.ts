import {BlockController} from '../features/block'
import {ClipboardController} from '../features/clipboard'
import {EditController} from '../features/edit'
import {KeyboardController} from '../features/keyboard'
import {OverlayController} from '../features/overlay'
import {SelectionController} from '../features/selection'
import {SlotsFeature} from '../features/slots'
import {Host, PropsModel} from '../features/state'
import {TokenModel} from '../features/tokens'
import {MarkputApi} from './MarkputApi'

//TODO rename to Markput, Core, Engine, Editor?
export class Store {
	readonly host = new Host()
	readonly props = new PropsModel()

	// Explicit type annotations on BOTH SIDES OF THE CYCLE — `tokens` and `selection`
	// — are REQUIRED, not stylistic: without them `tsc` fails with TS7022 ("implicitly
	// has type 'any' because it is referenced directly or indirectly in its own
	// initializer"). Measured: TS7022 fires only when both lack an annotation.
	readonly tokens: TokenModel = new TokenModel(this.props, this.host, () => this.selection)

	readonly slots = new SlotsFeature(this.props)

	// Built AFTER `tokens`, which is why the port above is a thunk: it is invoked only
	// from the boundary's `fold` and `onResult`, at commit/arrival time (spec D7). The
	// controller satisfies `SelectionPort` structurally — `range` is the capture, `repair`
	// the post-adoption caret fix.
	readonly selection: SelectionController = new SelectionController(this.host, this.tokens, this.props)
	readonly edit = new EditController(this.tokens, this.selection, this.props)

	readonly keyboard = new KeyboardController(this.host, this.selection, this.edit, this.tokens, this.props)

	readonly overlay = new OverlayController(this.host, this.props, this.selection, this.edit, this.tokens)
	readonly block = new BlockController(this.props, this.tokens, this.edit)

	readonly clipboard = new ClipboardController(this.host, this.edit, this.selection, this.tokens)

	readonly api = new MarkputApi(this.host, this.props, this.tokens, this.selection)
}