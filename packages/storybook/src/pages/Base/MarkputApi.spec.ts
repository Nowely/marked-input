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

	it('runs a method through the framework ref, not just a getter', async () => {
		// Vue hands the handle out through `defineExpose`, which wraps it in a Proxy — so a method
		// reaching `this` is worth one assertion beyond the getter above. (The native `#private`
		// hazard this test was written for is gone with the verbs that had one; a TS-private field
		// is a plain property and survives the proxy.)
		const {api, host} = await mountApi({Mark, defaultValue: VALUE})

		api()?.focus()

		const range = document.getSelection()?.getRangeAt(0)
		expect(range?.collapsed).toBe(true)
		expect(host.contains(range?.startContainer ?? null)).toBe(true)
	})
})