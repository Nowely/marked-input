import {render} from 'vitest-browser-react'
import {describe, expect, it} from 'vitest'
import type {MarkedInputHandler} from '@markput/react'
import {composeStories} from '@storybook/react-vite'
import * as BaseStories from './Base.stories'

const {Default} = composeStories(BaseStories)

type UseMarkedInputHandler = {
	value: MarkedInputHandler | null
	set: (el: MarkedInputHandler | null) => void
}

function useMarkedInputHandler(): UseMarkedInputHandler {
	let value: MarkedInputHandler | null = null

	function set(el: MarkedInputHandler | null) {
		value = el
	}

	return {value, set}
}

describe('API: MarkedInputHandler', () => {
	it('should support the ref prop for accessing component handler', async () => {
		const handler = useMarkedInputHandler()

		await render(<Default ref={handler.set} />)

		expect(handler.value?.container).not.toBeNull()
	})
})
