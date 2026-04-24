import {event} from '../../shared/signals'
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'

export type RenderedPayload = {
	readonly container: HTMLElement
	readonly layout: 'inline' | 'block'
}

export class LifecycleFeature implements Feature {
	readonly mounted = event()
	readonly unmounted = event()
	readonly rendered = event<RenderedPayload>()

	constructor(private readonly _store: Store) {}

	enable() {}
	disable() {}
}