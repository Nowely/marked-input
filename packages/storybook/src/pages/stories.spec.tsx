import {render} from 'vitest-browser-react'
import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'

// Automatically import all stories files
// @ts-expect-error - import.meta.glob is a Vite feature
const storiesModules = import.meta.glob('./**/*.stories.tsx', {eager: true})

// Group stories by category
const storiesByCategory = new Map<string, Record<string, any>>()

for (const [path, module] of Object.entries(storiesModules)) {
	// Extract category from the path: ./Ant/Ant.stories.tsx -> Ant
	const match = path.match(/\.\/([^/]+)\//)
	if (!match) continue

	const category = match[1]
	const stories = composeStories(module as any)

	if (!storiesByCategory.has(category)) {
		storiesByCategory.set(category, {})
	}

	// Merge stories from the same category file
	const categoryStories = storiesByCategory.get(category)!
	Object.assign(categoryStories, stories)
}

//TODO correct type
const getTests =
	() =>
	([name, Story]: [string, any]) =>
		it(`Story ${name}`, async () => {
			const {container} = await render(<Story />)
			expect(container.textContent?.length).toBeTruthy()
		})

describe('Component: stories', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(`${category} stories`, () => {
			Object.entries(stories).map(getTests())
		})
	}
})
