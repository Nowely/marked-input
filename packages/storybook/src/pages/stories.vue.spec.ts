// oxlint-disable typescript-eslint/no-explicit-any typescript-eslint/no-non-null-assertion typescript-eslint/no-unsafe-type-assertion
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page} from 'vitest/browser'

const storyModules = import.meta.glob('./**/*.vue.stories.ts', {eager: true})

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

describe('Storybook visual regression (Vue)', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(category, () => {
			for (const [name, Story] of Object.entries(stories)) {
				it(name, async () => {
					const {container} = await render(Story)

					// `document.fonts.ready` settles font-metric-driven heights; one RAF gives
					// Vue a frame to flush post-mount effects before Vitest's stable-screenshot
					// loop starts. Without these, a handful of stories capture an intermediate
					// layout frame.
					await document.fonts.ready
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					if (Story.parameters?.screenshot === false) {
						expect(container.textContent.length).toBeTruthy()
						return
					}

					// Explicit short name so the baseline file is `<Category>-<Story>-<browser>-<platform>.png`
					// instead of the verbose nested-describe-path Vitest would auto-derive.
					await expect.element(page.elementLocator(container)).toMatchScreenshot(`${category}-${name}`)
				})
			}
		})
	}
})