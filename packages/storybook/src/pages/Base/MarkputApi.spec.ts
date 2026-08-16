import {describe, expect, it} from 'vitest'

import {Mark} from '../../shared/lib/marks'
import {mountApi} from '../../shared/lib/page'

const VALUE = 'Hello @[mark](1)!'

describe('API: MarkputApi', () => {
	it('support the ref prop for accessing the component API', async () => {
		const {api} = await mountApi({Mark, defaultValue: VALUE})

		expect(api()).not.toBeNull()
		expect(api()?.container).toBeInstanceOf(HTMLElement)
	})

	it('runs API methods that touch private state through the framework ref', async () => {
		// Vue hands the API out through a Proxy, so a native `#private` in `MarkputApi` makes
		// every method reaching it throw `Receiver must be an instance of class MarkputApi`.
		const {api} = await mountApi({Mark, defaultValue: VALUE})

		expect(api()?.caret('start')).toBe(true)
	})
})