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
	 * Run `setup` whenever a host container is attached. The callback receives
	 * the live container; any subscriptions created inside it (`watch`,
	 * `listen`, `effect`, nested `effectScope`) are auto-disposed when the
	 * container is detached or swapped, and re-created with the new element on
	 * swap.
	 */
	onMounted(setup: (container: HTMLElement) => void): void {
		let scope: (() => void) | undefined
		watch(this.container, container => {
			scope?.()
			scope = container ? effectScope(() => setup(container)) : undefined
		})
	}
}