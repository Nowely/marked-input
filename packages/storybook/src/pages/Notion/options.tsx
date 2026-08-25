import type {CSSProperties, Markup, MenuSpec, Suggestion} from '@markput/core'
import {BlockMenu} from '@markput/react'
import type {Option, RowProps} from '@markput/react'

import {defineMark} from '../../shared/lib/marks'
import {defaultMarkdownTheme, markdownOptions} from '../Nested/MarkdownOptions'
import {PropertiesRow} from './components/PropertiesRow'
import {TableRow} from './components/TableRow'

import styles from './components/notion.module.css'

/**
 * The document's own kinds and marks, on top of the markdown preset the `Nested` and `Drag`
 * pages already share.
 *
 * A ROW OPTION carries `row`, and its markup is matched only at a row's own start. That is what
 * lets the frontmatter and the table be described at all: both are closed or open kinds whose
 * body spans lines, and both used to be inline marks that could only ever match at offset 0.
 */

/** Frontmatter. A closed kind with a RAW body, so its interior keeps its newlines verbatim. */
const PROPERTIES_MARKUP: Markup = '---\n__value__\n---'

/** A whole markdown table: an OPEN kind, so its raw body runs to the row's own separator. */
const TABLE_MARKUP: Markup = '|__value__'

/** A quote keeps a `__slot__`, so unlike the table its text stays editable in place. */
const QUOTE_MARKUP: Markup = '> __slot__'

/** Registering this is what stops the preset's link markup from taking `@[Name](id)`'s bracket
 * half and leaving a bare `@` behind — the first story on this page shows that damage. */
const MENTION_MARKUP: Markup = '@[__value__](__meta__)'

const MentionMark = defineMark({tag: 'span', class: styles.mention})

/** A row kind's component: the preset's styling, wrapped around the row's own inline content. */
const styledRow = (ownStyle: CSSProperties) =>
	function StyledRow({children, ref, className, style}: RowProps) {
		return (
			<div ref={ref} className={className} style={{...style, ...ownStyle}}>
				{children}
			</div>
		)
	}

/**
 * The preset's BLOCK-LEVEL entries become row kinds. `'# __slot__'` matched anywhere used to take
 * the `#` out of the middle of a line (notion-like issue 01); as a kind it is read at a row's
 * start and nowhere else.
 *
 * `list` held out until the separator default became `'\n'` (ADR-0011): under `'\n\n'` a tight
 * list is ONE row, so a `'- __slot__'` KIND swallowed all four items into a single bullet whose
 * body was their flat text — worse than the nesting it replaced. One line is one row now, so each
 * item is a row of its own with its own grip and menu, which is issue 05.
 *
 * `codeBlock` follows it for the opposite reason. It spans lines, and an inline mark cannot span
 * a row boundary (ADR-0010) — left inline it shattered into four rows whose `'# → rollout'` line
 * was then read as a heading. Its body is `__value__`, so the fence's interior is raw and no
 * markup inside it is matched, which is what a code block means.
 */
const ROW_KEYS = new Set(['h1', 'h2', 'h3', 'list', 'codeBlock'])

/**
 * What each preset kind contributes to the `/` menu. Declaring it is the WHOLE registration: the
 * menu is `overlay.entries`, assembled from the options that carry one, so nothing here is
 * repeated in a component and no component filters it.
 */
const PRESET_MENU: Record<string, MenuSpec> = {
	h1: {label: 'Heading 1', section: 'Basic', keywords: ['h1', 'title']},
	h2: {label: 'Heading 2', section: 'Basic', keywords: ['h2']},
	h3: {label: 'Heading 3', section: 'Basic', keywords: ['h3']},
	list: {label: 'Bulleted list', section: 'Basic', keywords: ['ul', 'list']},
	codeBlock: {label: 'Code', section: 'Media', keywords: ['fence', 'snippet']},
}

const presetKinds: Option[] = Object.entries(defaultMarkdownTheme)
	.filter(([key]) => ROW_KEYS.has(key))
	.map(([key, preset]) => ({
		markup: preset.markup,
		row: {Component: styledRow(preset.style ?? {})},
		menu: PRESET_MENU[key],
	}))

const quoteStyle: CSSProperties = {
	display: 'block',
	borderLeft: '3px solid #d0d0d0',
	paddingLeft: '0.75em',
	color: '#5f5f5f',
	fontStyle: 'italic',
}

/**
 * Order does NOT decide inline matching: the parser puts every static segment in one alternation
 * sorted by literal length and keeps the earliest-starting match. Among ROW KINDS it breaks ties
 * only after opener length, so a longer opener always wins.
 *
 * What the index DOES decide is which component a match resolves to
 * (`packages/core/src/features/slots/resolveSlot.ts`), so reordering these reorders the
 * components.
 */
export const notionOptions: Option[] = [
	{markup: PROPERTIES_MARKUP, row: {Component: PropertiesRow}, menu: {label: 'Page properties', section: 'Page'}},
	{
		markup: TABLE_MARKUP,
		row: {Component: TableRow},
		// `menu.text` SEEDS the row this entry writes, and only where there is nothing to keep —
		// choosing Table on a row that already has text keeps that text as the table's first line.
		menu: {label: 'Table', section: 'Database', text: 'Task | Status | Owner | Due | Effort'},
	},
	{markup: QUOTE_MARKUP, row: {Component: styledRow(quoteStyle)}, menu: {label: 'Quote', section: 'Basic'}},
	{markup: MENTION_MARKUP, Mark: MentionMark},
	...presetKinds,
	...(markdownOptions.filter(option => !ROW_KEYS.has(markupKey(option.markup))) as Option[]),
]

/** The preset entry a markup came from, so a kind's markup is not registered twice. */
function markupKey(markup: Markup): string {
	return Object.entries(defaultMarkdownTheme).find(([, preset]) => preset.markup === markup)?.[0] ?? ''
}

/** The people a `@` can name. `meta` is the id the document stores, `value` is what it shows. */
const TEAM: Suggestion[] = [
	{value: 'Sarah Chen', meta: 'sarah.chen'},
	{value: 'Marcus Kane', meta: 'marcus.kane'},
	{value: 'Jia Lin', meta: 'jia.lin'},
	{value: 'Amara Reed', meta: 'amara.reed'},
	{value: 'Platform', meta: 'team-platform'},
]

/**
 * The same document plus its editor chrome, and NEITHER overlay is written here any more.
 *
 * `@` is the built-in suggestion list: a row of `overlay.data` carries the id beside the name,
 * so the picker that used to filter its own array and call `select({value, meta})` is gone.
 * `/` is `BlockMenu` over the entries the options above declare, so the component that used to
 * hold a list of nine markdown strings and write them through `store.edit` is gone with it.
 *
 * Trigger lookup — unlike matching — IS order-sensitive: `#findTrigger` answers with the FIRST
 * option carrying the trigger character.
 *
 * The `/` option carries no markup at all. A markup-less option is legal, and this one exists
 * only to own a trigger: what it writes is the kind the chosen entry names, never its own.
 */
export const editorOptions: Option[] = [
	{markup: MENTION_MARKUP, Mark: MentionMark, overlay: {trigger: '@', data: TEAM}},
	{Overlay: BlockMenu, overlay: {trigger: '/'}},
	...notionOptions.filter(option => option.markup !== MENTION_MARKUP),
]