import {event} from '../../shared/signals'

export class LifecycleFeature {
	readonly mounted = event()
	readonly unmounted = event()
	readonly rendered = event()
}