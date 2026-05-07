import type {DomFeature} from '../../features/dom/DomFeature'
import type {OverlayFeature} from '../../features/overlay/OverlayFeature'
import type {ParsingFeature} from '../../features/parsing/ParseFeature'

export class MarkputHandler {
	constructor(
		private readonly dom: DomFeature,
		private readonly overlayFeature: OverlayFeature,
		private readonly parsing: ParsingFeature
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