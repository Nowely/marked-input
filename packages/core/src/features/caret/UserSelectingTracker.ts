import {nodeTarget} from '../../shared/checkers'
import {listen, signal} from '../../shared/signals'
import type {DomModel} from '../dom/DomModel'
import type {Lifecycle} from '../lifecycle/Lifecycle'

/**
 * Owns the `isSelecting` signal that flips while the user is actively
 * drag-selecting text inside the editor (mouse drag across nodes, or any
 * non-collapsed window selection touching the editor container).
 *
 * Listens on `document` to cover drags that start outside the editor and
 * sweep into it. Pairs with `dom.reconcile({isUserSelecting})` which is
 * driven by CaretModel — this class is concerned only with detection.
 */
export class UserSelectingTracker {
	readonly isSelecting = signal<boolean>(false)

	constructor(lifecycle: Lifecycle, dom: DomModel) {
		lifecycle.onMounted(() => {
			// Track which node the mouse was pressed on. Lets us tell
			// "drag stayed on the original element" (no selection yet) from
			// "drag is sweeping across nodes" (real selection in progress).
			let pressedAt: Node | null = null

			listen(document, 'mousedown', e => {
				pressedAt = nodeTarget(e)
			})

			listen(document, 'mousemove', e => {
				if (pressedAt === null) return
				const container = dom.container()
				if (!container) return

				const startedOutsideEditor = !container.contains(pressedAt)
				const sweepingAcrossNodes = pressedAt !== e.target
				const selectionIntersectsEditor = window.getSelection()?.containsNode(container, true) ?? false

				if ((startedOutsideEditor || sweepingAcrossNodes) && selectionIntersectsEditor) {
					this.isSelecting(true)
				}
			})

			listen(document, 'mouseup', () => {
				pressedAt = null
				if (!this.isSelecting()) return
				const sel = window.getSelection()
				if (!sel || sel.isCollapsed) this.isSelecting(false)
			})

			listen(document, 'selectionchange', () => {
				if (!this.isSelecting()) return
				const sel = window.getSelection()
				if (!sel || sel.isCollapsed) this.isSelecting(false)
			})
		})
	}
}