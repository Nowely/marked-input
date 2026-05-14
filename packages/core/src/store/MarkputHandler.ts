import type {CaretModel} from '../features/caret/CaretModel'
import type {DomModel} from '../features/dom/DomModel'
import type {OverlayController} from '../features/overlay/OverlayController'

export class MarkputHandler {
	constructor(
		private readonly dom: DomModel,
		private readonly overlayFeature: OverlayController,
		private readonly caret: CaretModel
	) {}

	get container() {
		return this.dom.container()
	}

	get overlay() {
		return this.overlayFeature.element()
	}

	focus() {
		this.caret.focusFirst()
	}
}