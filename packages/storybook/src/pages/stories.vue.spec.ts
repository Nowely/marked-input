// oxlint-disable typescript-eslint/no-explicit-any typescript-eslint/no-non-null-assertion
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'

const storiesModules = import.meta.glob('./**/*.vue.stories.ts', {eager: true})

const storiesByCategory = new Map<string, Record<string, any>>()

for (const [path, module] of Object.entries(storiesModules)) {
	const match = path.match(/\.\/([^/]+)\//)
	if (!match) continue

	const category = match[1]
	// oxlint-disable-next-line no-unsafe-type-assertion
	const stories = composeStories(module as Parameters<typeof composeStories>[0])

	if (!storiesByCategory.has(category)) {
		storiesByCategory.set(category, {})
	}

	const categoryStories = storiesByCategory.get(category)!
	Object.assign(categoryStories, stories)
}

const getTests =
	() =>
	([name, Story]: [string, any]) =>
		it(`Story ${name}`, async () => {
			const {container} = await render(Story)
			expect(container.innerHTML).toMatchSnapshot()
		})

describe('Component: stories', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(`${category} stories`, () => {
			Object.entries(stories).map(getTests())
		})
	}
})