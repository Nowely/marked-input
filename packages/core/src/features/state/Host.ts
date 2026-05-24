import {effectScope, event, signal, watch} from '../../shared/signals'

// Owns adapter-fed runtime state: lifecycle events emitted by the embedding
// component (mounted/unmounted/rendered) and the host element ref. Features
// read these; only the React/Vue adapter writes them.

export class Host {
	readonly mounted = event()
	readonly unmounted = event()
	readonly rendered = event()
	readonly container = signal<HTMLElement | null>({initial: null})

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