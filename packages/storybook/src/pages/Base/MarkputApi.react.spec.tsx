import type {MarkputApi} from '@markput/react'
import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'

import * as BaseStories from './Base.react.stories'

const {Default} = composeStories(BaseStories)

describe('API: MarkputApi', () => {
	it('support the ref prop for accessing the component API', async () => {
		const api: {current: MarkputApi | null} = {current: null}

		await render(
			<Default
				ref={el => {
					api.current = el
				}}
			/>
		)

		expect(api.current).not.toBeNull()
		expect(api.current?.container).toBeInstanceOf(HTMLElement)
	})
})