import type {DomModel} from '../features/dom/DomModel'
import type {OverlayController} from '../features/overlay/OverlayController'
import type {SelectionController} from '../features/selection/SelectionController'

export class MarkputHandler {
	constructor(
		private readonly dom: DomModel,
		private readonly overlayFeature: OverlayController,
		private readonly selection: SelectionController
	) {}

	get container() {
		return this.dom.container()
	}

	get overlay() {
		return this.overlayFeature.element()
	}

	focus() {
		this.selection.focusFirst()
	}
}