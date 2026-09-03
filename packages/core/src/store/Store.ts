import {ClipboardController} from '../features/clipboard'
import {EditController} from '../features/edit'
import {HistoryModel} from '../features/history'
import {KeyboardController} from '../features/keyboard'
import {OverlayController} from '../features/overlay'
import {RowController} from '../features/rows'
import {SlotsFeature} from '../features/slots'
import {Host, PropsModel} from '../features/state'
import {TokenModel} from '../features/tokens'
import {MarkputHandle} from './MarkputHandle'

/**
 * ONE editor: every feature's state hangs off a field here, and the field name is how core, both
 * adapters and a consumer's own selector all address it.
 *
 * THE NAME STAYS, and that is a decision rather than an omission. It carried
 * `//TODO rename to Markput, Core, Engine, Editor?` from before either adapter published it; all
 * four name the PRODUCT or the PACKAGE rather than this object's role, `MarkputHandle` already
 * carries the product name for the thing a consumer holds, and this is `useMarkput`'s selector
 * parameter — so a rename lands in the first line of every consumer that reaches the imperative
 * surface, against no defect and no better name.
 */
// TODO Extract MarkputContext with core 0 primitives that used controllers?
// Outside the docblock on purpose: TypeDoc publishes what is inside it, and this note reached
// the consumer-facing `api/Store.md` page.
export class Store {
	readonly host = new Host()
	readonly props = new PropsModel()

	readonly tokens = new TokenModel(this.props, this.host)

	readonly slots = new SlotsFeature(this.props, this.tokens)

	readonly edit = new EditController(this.tokens, this.props)

	readonly history = new HistoryModel(this.props, this.tokens)

	readonly overlay = new OverlayController(this.host, this.props, this.edit, this.tokens)
	// Names the CONCERN, like every other field here — not the rows themselves, which
	// `tokens.nodes()` holds. `RowNode.rows()` is the child list of one row; this is the editor's
	// one owner of row hover, drag, drop, menu, selection and geometry.
	readonly rows = new RowController(this.host, this.props, this.tokens)

	// AFTER the overlay and the row controller, and the order is load-bearing rather than tidy:
	// Esc is the one key three features want, and the row-selection arm defers to an open overlay
	// or an open row menu by asking each of them.
	readonly keyboard = new KeyboardController(this.host, this.edit, this.tokens, this.history, this.overlay, this.rows)

	readonly clipboard = new ClipboardController(this.host, this.edit, this.tokens)

	readonly handle = new MarkputHandle(this.host, this.tokens)
}