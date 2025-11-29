import '@testing-library/jest-dom'
import {render} from '@testing-library/react'
import {describe, expect, it} from 'vitest'
import type {MarkedInputHandler} from 'rc-marked-input'
import {composeStories} from '@storybook/react-vite'
import * as BaseStories from './Base.stories'

const {Default} = composeStories(BaseStories)

type UseMarkedInputHandler = {
	value: MarkedInputHandler | null
	set: (el: MarkedInputHandler | null) => MarkedInputHandler | null
}

function useMarkedInputHandler(): UseMarkedInputHandler {
	let value: MarkedInputHandler | null = null

	function set(el: MarkedInputHandler | null) {
		return (value = el)
	}

	return {value, set}
}

describe('API: MarkedInputHandler', () => {
	it('should support the ref prop for accessing component handler', async () => {
		const handler = useMarkedInputHandler()

		render(<Default ref={handler.set} />)

		expect(handler.value?.container).not.toBeNull()
	})
})

