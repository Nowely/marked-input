import {BlockController} from '../features/block'
import {ClipboardController} from '../features/clipboard'
import {EditController} from '../features/edit'
import {KeyboardController} from '../features/keyboard'
import {OverlayController} from '../features/overlay'
import {SelectionController} from '../features/selection'
import {SlotsFeature} from '../features/slots'
import {Host, PropsModel, ValueModel} from '../features/state'
import {TokenModel} from '../features/tokens'
import {MarkputHandler} from './MarkputHandler'

//TODO rename to Markput, Core, Engine, Editor?
export class Store {
	readonly host = new Host()
	readonly props = new PropsModel()

	// Explicit type annotations on BOTH SIDES OF THE CYCLE — `tokens` and `selection`
	// — are REQUIRED, not stylistic: without them `tsc` fails with TS7022 ("implicitly
	// has type 'any' because it is referenced directly or indirectly in its own
	// initializer"). Measured: TS7022 fires only when both lack an annotation.
	readonly tokens: TokenModel = new TokenModel(this.props, this.host, () => this.selection.range())
	// NOT in the cycle — `value` depends on `tokens` only, so its annotation is
	// ordinary style rather than a TS7022 workaround.
	readonly value: ValueModel = new ValueModel(this.tokens)

	readonly slots = new SlotsFeature(this.props)

	// Built AFTER `tokens`, which is why the capture above is a thunk: it is invoked
	// only from the boundary's `fold`, at commit/arrival time (spec D7).
	readonly selection: SelectionController = new SelectionController(this.host, this.tokens, this.value, this.props)
	readonly edit = new EditController(this.value, this.selection)

	readonly keyboard = new KeyboardController(
		this.host,
		this.value,
		this.selection,
		this.edit,
		this.tokens,
		this.props
	)

	readonly overlay = new OverlayController(this.host, this.props, this.value, this.selection, this.edit, this.tokens)
	readonly block = new BlockController(this.props, this.value, this.tokens, this.edit)

	readonly clipboard = new ClipboardController(this.host, this.edit, this.selection, this.tokens)

	readonly handler = new MarkputHandler(this.host, this.overlay, this.selection)
}