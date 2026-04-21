// oxlint-disable typescript-eslint/no-explicit-any typescript-eslint/no-non-null-assertion typescript-eslint/no-unsafe-type-assertion
import {faker} from '@faker-js/faker'
import {composeStories} from '@storybook/vue3-vite'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-vue'

import {normalizeHtml} from './_vrt/normalize-html'

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

// Determinism scoped to this file. `data-vrt` activates the kill-switches in
// `vitest.setup.ts` (pointer-events, transitions, animations) so that hover
// and in-flight CSS state don't leak into the serialized innerHTML.
beforeAll(() => {
	faker.seed(123)
	vi.useFakeTimers({toFake: ['Date']})
	vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
	document.documentElement.setAttribute('data-vrt', '')
})

afterAll(() => {
	vi.useRealTimers()
	document.documentElement.removeAttribute('data-vrt')
})

describe('Storybook visual regression (Vue)', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(category, () => {
			for (const [name, Story] of Object.entries(stories)) {
				it(name, async () => {
					const {container} = await render(Story)

					await document.fonts.ready
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					if (document.activeElement instanceof HTMLElement) {
						document.activeElement.blur()
					}
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					const htmlPath = `./${category}/__screenshots__/${name}-vue.html`
					await expect(normalizeHtml(container.innerHTML)).toMatchFileSnapshot(htmlPath)
				})
			}
		})
	}
})