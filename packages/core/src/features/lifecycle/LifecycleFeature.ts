import {event} from '../../shared/signals'
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'

export class LifecycleFeature implements Feature {
	readonly state = {} as const
	readonly computed = {} as const
	readonly emit = {
		mounted: event(),
		unmounted: event(),
		rendered: event(),
	}

	constructor(private readonly _store: Store) {}

	enable() {}
	disable() {}
}