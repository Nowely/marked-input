import {composeStories} from '@storybook/react-vite'
import React from 'react'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'

/**
 * Builds screenshot-based tests for every story in a module.
 *
 * @param storiesModule - imported stories file (namespace import)
 */
export function createVisualTests(storiesModule: any) {
	const stories = composeStories(storiesModule)

	describe('Visual regression tests', () => {
		for (const [name, Story] of Object.entries(stories)) {
			it(`Story ${name}`, async () => {
				const StoryComponent = Story as React.ComponentType<any>
				const {container} = await render(React.createElement(StoryComponent))
				expect(container.textContent.length).toBeTruthy()
				await expect(container).toMatchScreenshot()
			})
		}
	})
}