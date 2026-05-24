import type {OverlayController} from '../features/overlay/OverlayController'
import type {SelectionController} from '../features/selection/SelectionController'
import type {Host} from '../features/state/Host'

export class MarkputHandler {
	constructor(
		private readonly host: Host,
		private readonly overlayFeature: OverlayController,
		private readonly selection: SelectionController
	) {}

	get container() {
		return this.host.container()
	}

	get overlay() {
		return this.overlayFeature.element()
	}

	focus() {
		this.selection.focusFirst()
	}
}