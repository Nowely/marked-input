import type {VoidEvent, PayloadEvent} from './signal.js'

type EventMap<T extends Record<string, unknown>> = {
	[K in keyof T]: T[K] extends void ? VoidEvent : PayloadEvent<T[K]>
}

/**
 * Identity wrapper for building a typed events object.
 * Accepts a pre-built object of voidEvent()/payloadEvent() instances
 * and returns it with proper type inference.
 */
export function defineEvents<T extends Record<string, unknown>>(events: EventMap<T>): EventMap<T> {
	return events
}