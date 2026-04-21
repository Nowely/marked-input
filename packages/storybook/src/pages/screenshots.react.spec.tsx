// oxlint-disable typescript-eslint/no-explicit-any typescript-eslint/no-non-null-assertion typescript-eslint/no-unsafe-type-assertion
import {faker} from '@faker-js/faker'
import {composeStories} from '@storybook/react-vite'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'

import {normalizeHtml} from './_vrt/normalize-html'

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

describe('Storybook visual regression (React)', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(category, () => {
			for (const [name, Story] of Object.entries(stories)) {
				it(name, async () => {
					const {container} = await render(<Story />)

					// `document.fonts.ready` settles any late font load that may
					// still mutate inline styles (some components write em-based
					// dimensions into `style=""` after font metrics resolve).
					// One RAF flushes React's post-commit effects.
					await document.fonts.ready
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					// Blur any auto-focused element. Chromium on some platforms
					// sets `aria-activedescendant` / `[data-focus-visible]` on
					// programmatic focus; blurring to `<body>` produces stable DOM.
					if (document.activeElement instanceof HTMLElement) {
						document.activeElement.blur()
					}
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					const htmlPath = `./${category}/__screenshots__/${name}-react.html`
					await expect(normalizeHtml(container.innerHTML)).toMatchFileSnapshot(htmlPath)
				})
			}
		})
	}
})