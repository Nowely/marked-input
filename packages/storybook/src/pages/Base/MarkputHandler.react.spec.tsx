import type {MarkputHandler} from '@markput/react'
import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'

import * as BaseStories from './Base.react.stories'

const {Default} = composeStories(BaseStories)

describe('API: MarkputHandler', () => {
	it('support the ref prop for accessing component handler', async () => {
		const handler: {current: MarkputHandler | null} = {current: null}

		await render(
			<Default
				ref={el => {
					handler.current = el
				}}
			/>
		)

		expect(handler.current).not.toBeNull()
		expect(handler.current?.container).toBeInstanceOf(HTMLElement)
	})
})