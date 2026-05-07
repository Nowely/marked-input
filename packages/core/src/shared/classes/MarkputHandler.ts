import type {DomController} from '../../features/dom/DomController'
import type {OverlayController} from '../../features/overlay/OverlayController'
import type {ParseController} from '../../features/parsing/ParseController'

export class MarkputHandler {
	constructor(
		private readonly dom: DomController,
		private readonly overlayFeature: OverlayController,
		private readonly parsing: ParseController
	) {}

	get container() {
		return this.dom.container()
	}

	get overlay() {
		return this.overlayFeature.element()
	}

	focus() {
		const firstAddress = this.parsing.index().addressFor([0])
		if (firstAddress && this.dom.focusAddress(firstAddress).ok) return
		this.container?.focus()
	}
}