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
	 * Run `setup` while the editor is mounted with a host element. The callback
	 * receives the live container; any subscriptions created inside it
	 * (`watch`, `listen`, `effect`, nested `effectScope`) are auto-disposed
	 * when the container swaps to a different element or `unmounted` fires,
	 * and re-created with the new element on swap. The callback is not invoked
	 * while either condition is unmet.
	 */
	onMounted(setup: (container: HTMLElement) => void): void {
		let scope: (() => void) | undefined
		let mounted = false
		let active: HTMLElement | null = null

		const reattach = (): void => {
			const next = mounted ? this.container() : null
			if (next === active) return
			scope?.()
			scope = undefined
			active = next
			if (next) scope = effectScope(() => setup(next))
		}

		watch(this.mounted, () => {
			mounted = true
			reattach()
		})
		watch(this.unmounted, () => {
			mounted = false
			reattach()
		})
		watch(this.container, reattach)
	}
}