import {effectScope, event, watch} from '../../shared/signals'

export class LifecycleFeature {
	readonly mounted = event()
	readonly unmounted = event()
	readonly rendered = event()

	/**
	 * Run `setup` when the editor is mounted. Any reactive subscription
	 * created inside `setup` (`watch`, `listen`, `effect`, nested
	 * `effectScope`) is automatically disposed on `unmounted` and re-created
	 * on the next `mounted`.
	 */
	onMounted(setup: () => void): void {
		let scope: (() => void) | undefined
		watch(this.mounted, () => {
			if (scope) return
			scope = effectScope(setup)
		})
		watch(this.unmounted, () => {
			scope?.()
			scope = undefined
		})
	}
}