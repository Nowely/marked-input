import {event} from '../../shared/signals'
import type {Feature} from '../../shared/types'

export class LifecycleFeature implements Feature {
	readonly mounted = event()
	readonly unmounted = event()
	readonly rendered = event()

	enable() {}
	disable() {}
}