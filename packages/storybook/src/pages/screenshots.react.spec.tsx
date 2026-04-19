// oxlint-disable typescript-eslint/no-explicit-any typescript-eslint/no-non-null-assertion typescript-eslint/no-unsafe-type-assertion
import {faker} from '@faker-js/faker'
import {composeStories} from '@storybook/react-vite'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'
import {page} from 'vitest/browser'

const storyModules = import.meta.glob('./**/*.react.stories.tsx', {eager: true})

const storiesByCategory = new Map<string, Record<string, any>>()

for (const [path, mod] of Object.entries(storyModules)) {
	const match = path.match(/\.\/([^/]+)\//)
	if (!match) continue

	const category = match[1]
	const stories = composeStories(mod as Parameters<typeof composeStories>[0])

	if (!storiesByCategory.has(category)) {
		storiesByCategory.set(category, {})
	}

	Object.assign(storiesByCategory.get(category)!, stories)
}

// Determinism scoped to this file so functional specs keep real timers + unseeded faker.
beforeAll(() => {
	faker.seed(123)
	vi.useFakeTimers({toFake: ['Date']})
	vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})

afterAll(() => {
	vi.useRealTimers()
})

describe('Storybook visual regression (React)', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(category, () => {
			for (const [name, Story] of Object.entries(stories)) {
				it(name, async () => {
					const {container} = await render(<Story />)

					// `document.fonts.ready` settles font-metric-driven heights; one RAF gives
					// React a frame to flush post-commit effects before Vitest's stable-screenshot
					// loop starts. Without these, some stories capture an intermediate layout frame.
					await document.fonts.ready
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					if (Story.parameters?.screenshot === false) {
						expect(container.textContent.length).toBeTruthy()
						return
					}

					// `${category}/${name}` is parsed by resolveScreenshotPath() in vite.config.ts
					// and routed to `<Category>/__screenshots__/<Story>-react-<browser>-<platform>.png`.
					await expect.element(page.elementLocator(container)).toMatchScreenshot(`${category}/${name}`)
				})
			}
		})
	}
})