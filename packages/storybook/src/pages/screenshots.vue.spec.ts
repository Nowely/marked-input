// oxlint-disable typescript-eslint/no-explicit-any typescript-eslint/no-non-null-assertion typescript-eslint/no-unsafe-type-assertion
import {faker} from '@faker-js/faker'
import {composeStories} from '@storybook/vue3-vite'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
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

// Determinism scoped to this file so functional specs keep real timers + unseeded faker.
beforeAll(() => {
	faker.seed(123)
	vi.useFakeTimers({toFake: ['Date']})
	vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})

afterAll(() => {
	vi.useRealTimers()
})

describe('Storybook visual regression (Vue)', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(category, () => {
			for (const [name, Story] of Object.entries(stories)) {
				it(name, async () => {
					const {container} = await render(Story)

					// `document.fonts.ready` settles font-metric-driven heights; one RAF gives
					// Vue a frame to flush post-mount effects before Vitest's stable-screenshot
					// loop starts. Without these, some stories capture an intermediate layout frame.
					await document.fonts.ready
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					// Blur whatever element vitest-browser-vue auto-focused after mount.
					// Chromium's `:focus-visible` heuristic differs between macOS and Linux
					// (Linux often shows the focus ring after programmatic focus, macOS
					// doesn't), which adds 2 px of cyan outline around focused buttons in
					// `Nested/InteractiveNested` — a pure dimension mismatch no pixel
					// tolerance can mask. Moving focus to `<body>` produces identical,
					// ring-free baselines on every platform.
					if (document.activeElement instanceof HTMLElement) {
						document.activeElement.blur()
					}
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					if (Story.parameters?.screenshot === false) {
						expect(container.textContent.length).toBeTruthy()
						return
					}

					// `${category}/${name}` is parsed by resolveScreenshotPath() in vite.config.ts
					// and routed to `<Category>/__screenshots__/<Story>-vue-<browser>.png`.
					await expect.element(page.elementLocator(container)).toMatchScreenshot(`${category}/${name}`)
				})
			}
		})
	}
})