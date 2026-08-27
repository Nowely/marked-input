import type {Option, Suggestion} from '@markput/vue'
import {defineComponent} from 'vue'

import {CoverBand, kinds, NOTION_THEME, notionOptions, PageChrome, Paragraph, theme} from './notion'
import {TEAM} from './team'

/**
 * The FRAMEWORK HALF of the showcase page, in Vue. `Notion.stories.ts` names `options`, `slots`
 * and `decorators`, and `Notion.fixtures.react.tsx` answers with the same three — a story that
 * drifts fails to compile under one project or the other.
 *
 * Everything with a markup in it comes from `notion/`, whose vocabulary is shared and whose paint
 * is this project's.
 */

/**
 * Trigger lookup — unlike matching — IS order-sensitive: the FIRST option carrying the character
 * owns it. So the mention kind is re-listed at the head with its picker attached, and the `/`
 * option carries no markup at all: it exists only to own a trigger, and what it writes is the
 * kind the chosen entry names.
 */
const options: Option[] = [
	{...kinds.mention, overlay: {trigger: '@', data: TEAM satisfies readonly Suggestion[]}},
	{overlay: {trigger: '/'}},
	...notionOptions.filter(option => option !== kinds.mention),
]

/** The page around the editor: breadcrumb, cover band, and the centred content column. */
const Page = defineComponent({
	components: {CoverBand, PageChrome},
	setup: () => ({NOTION_THEME, theme, breadcrumb: ['Product', 'Launches', 'Apollo']}),
	template: `
		<div :class="[NOTION_THEME, theme.page]" style="min-height: 100vh">
			<PageChrome :breadcrumb="breadcrumb" edited-label="Edited 14m ago" />
			<div :class="theme.column">
				<CoverBand icon="🚀" />
				<slot />
			</div>
		</div>
	`,
})

export const fixtures = {
	options,
	/** `slots.paragraph` is the row with no kind, and the only fallback. */
	slots: {paragraph: Paragraph},
	/**
	 * The page furniture, as a STORY decorator rather than as a story of its own: the shared spec
	 * mounts the editor's args directly, so a wrapper that only dresses the page must not be a
	 * thing the assertions depend on. What the spec DOES need — the theme's own variables — it
	 * puts on the body itself.
	 */
	decorators: [() => ({components: {Page}, template: '<Page><story /></Page>'})],
}