import {describe, expect, it} from 'vitest'

import {snapshotHtml} from '../shared/lib/htmlSnapshot'
import type {StoryComponent} from '../shared/lib/page'
import {composePage, renderStoryHtml} from '../shared/lib/page'

/**
 * Every story that exists in BOTH frameworks, snapshotted into ONE file that both vitest
 * projects compare against. That is the point: the two adapters must render the same story
 * identically, and any divergence fails here instead of hiding in two files nobody diffs.
 *
 * The glob is the framework-free story files, which is exactly the set of pages both
 * frameworks have. React-only pages are swept by `stories.react.spec.tsx`.
 *
 * Updating with `-u` writes from whichever project runs first; run one project at a time when
 * a snapshot legitimately moves.
 */
const storiesModules = import.meta.glob('./**/*.stories.ts', {eager: true})

const storiesByCategory = new Map<string, Record<string, StoryComponent>>()

for (const [path, module] of Object.entries(storiesModules)) {
	const match = path.match(/\.\/([^/]+)\//)
	if (!match) continue

	const category = match[1]!
	// oxlint-disable-next-line no-unsafe-type-assertion
	const stories = composePage(module as Parameters<typeof composePage>[0])

	if (!storiesByCategory.has(category)) storiesByCategory.set(category, {})
	Object.assign(storiesByCategory.get(category)!, stories)
}

describe('Component: stories', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(`${category} stories`, () => {
			for (const [name, Story] of Object.entries(stories)) {
				it(`Story ${name}`, async () => {
					expect(snapshotHtml(await renderStoryHtml(Story))).toMatchSnapshot()
				})
			}
		})
	}
})