import React from 'react'
import {render} from 'vitest-browser-react'
import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'

/**
 * Создает скриншотные тесты для всех stories модуля.
 *
 * @param storiesModule - импортированный stories файл (namespace import)
 */
export function createVisualTests(storiesModule: any) {
	const stories = composeStories(storiesModule)

	describe('Visual regression tests', () => {
		for (const [name, Story] of Object.entries(stories)) {
			it(`Story ${name}`, async () => {
				const StoryComponent = Story as React.ComponentType<any>
				const {container} = await render(React.createElement(StoryComponent))
				expect(container.textContent?.length).toBeTruthy()
				await expect(container).toMatchScreenshot()
			})
		}
	})
}

