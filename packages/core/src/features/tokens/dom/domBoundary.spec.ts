import {afterEach, describe, expect, it} from 'vitest'

import {mountWithMark} from '../__testing__/mountFixtures'

describe('anchorFor', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('returns undefined for a node outside the container', () => {
		const {store} = mountWithMark()
		const orphan = document.createElement('span')
		expect(store.tokens.anchorFor(orphan, 0)).toBeUndefined()
	})
})