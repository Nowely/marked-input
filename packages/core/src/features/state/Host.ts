import {effectScope, signal, watch} from '../../shared/signals'

// Owns adapter-fed runtime state: the host element ref, and nothing else. Features read it;
// only the React/Vue adapter writes it.
//
// The `rendered` event is GONE. It existed so an adapter could say "I painted, go and walk the
// DOM" — and with elements consigned through refs there is nothing to walk and no reason for an
// adapter to call back in. Binding is an effect on the token layer now.

export class Host {
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