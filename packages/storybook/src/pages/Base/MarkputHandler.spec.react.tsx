import type {MarkputHandler} from '@markput/react'
import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'

import * as BaseStories from './Base.stories.react'

const {Default} = composeStories(BaseStories)

type UseMarkputHandler = {
	value: MarkputHandler | null
	set: (el: MarkputHandler | null) => void
}

function useMarkputHandler(): UseMarkputHandler {
	let value: MarkputHandler | null = null

	function set(el: MarkputHandler | null) {
		value = el
	}

	return {value, set}
}

describe('API: MarkputHandler', () => {
	it('should support the ref prop for accessing component handler', async () => {
		const handler = useMarkputHandler()

		await render(<Default ref={handler.set} />)

		expect(handler.value?.container).not.toBeNull()
	})
})