import type {Option, Suggestion} from '@markput/react'
import type {ComponentType, ReactNode} from 'react'

import {CoverBand, mention, NOTION_THEME, notionOptions, PageChrome, Paragraph, theme} from './notion'
import {TEAM} from './team'

/**
 * The FRAMEWORK HALF of the showcase page: the option array the editor is given, the paragraph
 * slot, and the page furniture the editor sits inside. `Notion.stories.ts` names these and nothing
 * else, and `Notion.fixtures.vue.ts` answers with the same three names.
 *
 * Everything with a markup in it comes from `notion/`. What is added here is what belongs
 * to a PAGE rather than to the block vocabulary: who the `@` picker may name, and the fact that
 * `/` opens the shipped row menu.
 */

/**
 * Trigger lookup — unlike matching — IS order-sensitive: the FIRST option carrying the character
 * owns it. So the mention kind is re-listed at the head with its picker attached, and the `/`
 * option carries no markup at all: it exists only to own a trigger, and what it writes is the
 * kind the chosen entry names.
 *
 * Neither overlay is a component this page wrote, and neither is even NAMED here: the built-in
 * `OverlayList` paints both. `@` offers the option's own `overlay.data`; `/` declares none, so
 * the same list offers the ROW MENU the options themselves declare. Nothing here filters, labels
 * or inserts.
 */
const options: Option[] = [
	{...mention, overlay: {trigger: '@', data: TEAM satisfies readonly Suggestion[]}},
	{overlay: {trigger: '/'}},
	...notionOptions.filter(option => option !== mention),
]

/** The page around the editor: breadcrumb, cover band, and the centred content column. */
const Page = ({children}: {children?: ReactNode}) => (
	<div className={`${NOTION_THEME} ${theme.page}`} style={{minHeight: '100vh'}}>
		<PageChrome breadcrumb={['Product', 'Launches', 'Apollo']} editedLabel="Edited 14m ago" />
		<div className={theme.column}>
			<CoverBand icon="🚀" />
			{children}
		</div>
	</div>
)

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
	decorators: [
		(Story: ComponentType) => (
			<Page>
				<Story />
			</Page>
		),
	],
}