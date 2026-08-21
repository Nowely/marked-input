import {describe, expect, it, vi} from 'vitest'

import {batch, event, watch} from './index.js'

describe('event delivery', () => {
	it('a subscriber registered after the emission does not cancel the ones queued before it', () => {
		const e = event<void>()
		const first = vi.fn()
		watch(e, first)

		batch(() => {
			e()
			// A LATE subscriber, registered while the emission is still queued. `watch` runs its
			// effect immediately, and that first run reads the event.
			watch(e, () => {})
		})

		expect(first).toHaveBeenCalledTimes(1)
	})
})