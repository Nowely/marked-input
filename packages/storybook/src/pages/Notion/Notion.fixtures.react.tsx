import type {Option, Suggestion} from '@markput/react'
import {RowMenu} from '@markput/react'
import type {ReactNode} from 'react'

import {CoverBand, mention, NOTION_THEME, notionOptions, PageChrome, Paragraph, theme} from './notion'

/**
 * The FRAMEWORK HALF of the showcase page: the option array the editor is given, the paragraph
 * slot, and the page furniture the editor sits inside. The story file names these and nothing
 * else, so porting the page to Vue is writing this file again rather than writing the page again.
 *
 * Everything with a markup in it comes from `notion/`. What is added here is what belongs
 * to a PAGE rather than to the block vocabulary: who the `@` picker may name, and the fact that
 * `/` opens the shipped row menu.
 */

/** The people a `@` can name. `meta` is the id the document stores, `value` is what it shows. */
const TEAM: Suggestion[] = [
	{value: 'Kara Vance', meta: 'kara.vance'},
	{value: 'Ines Duarte', meta: 'ines.duarte'},
	{value: 'Milo Freeman', meta: 'milo.freeman'},
	{value: 'Priya Raman', meta: 'priya.raman'},
	{value: 'Tomas Alvarez', meta: 'tomas.alvarez'},
	{value: 'Platform', meta: 'team-platform'},
]

/**
 * Trigger lookup — unlike matching — IS order-sensitive: the FIRST option carrying the character
 * owns it. So the mention kind is re-listed at the head with its picker attached, and the `/`
 * option carries no markup at all: it exists only to own a trigger, and what it writes is the
 * kind the chosen entry names.
 *
 * Neither overlay is a component this page wrote. `@` is the built-in suggestion list over
 * `overlay.data`; `/` is the adapter's `RowMenu` over the entries the options themselves
 * declare, so nothing here filters, labels or inserts.
 */
const options: Option[] = [
	{...mention, overlay: {trigger: '@', data: TEAM}},
	{Overlay: RowMenu, overlay: {trigger: '/'}},
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
	Page,
}