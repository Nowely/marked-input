import type {Markup} from '@markput/core'
import type {Option} from '@markput/react'

import {defineMark} from '../../shared/lib/marks'
import {markdownOptions} from '../Nested/MarkdownOptions'
import {MentionOverlay} from './components/MentionOverlay'
import {PropertiesMark} from './components/PropertiesMark'
import {SlashMenu} from './components/SlashMenu'
import {TableMark} from './components/TableMark'

import styles from './components/notion.module.css'

/**
 * The document's own markups, on top of the markdown preset the `Nested` and `Drag` pages
 * already share.
 *
 * Every one of them is a fence or a prefix around ONE placeholder, because that is all a markup
 * can be: at most two `__value__`, one `__meta__`, one `__slot__`, and never a leading
 * placeholder (`packages/core/src/features/tokens/parser/core/MarkupDescriptor.ts:169-198`).
 */

/** Frontmatter. The closing literal is `\n---`, and a closing literal that STARTS with `\n`
 * would match nothing at all (notion-like issue 07) — this one survives because its first
 * character is `-`. It also matches ONLY at offset 0: anywhere else the separator's second
 * newline opens the closing literal before the opening one is read (notion-like issue 09). */
const PROPERTIES_MARKUP: Markup = '---\n__value__\n---'

/** A whole markdown table. The trailing value closes at the row boundary, so it takes every
 * line of the table; a bounded value could not cross a newline. */
const TABLE_MARKUP: Markup = '|__value__'

/** A quote keeps a `__slot__`, so unlike the table its text stays editable in place. Multi-line
 * quotes nest rather than continue (notion-like issue 06). */
const QUOTE_MARKUP: Markup = '> __slot__'

/** Registering this is what stops the preset's link markup from taking `@[Name](id)`'s bracket
 * half and leaving a bare `@` behind — the first story on this page shows that damage. */
const MENTION_MARKUP: Markup = '@[__value__](__meta__)'

const QuoteMark = defineMark({tag: 'span', class: styles.quote})
const MentionMark = defineMark({tag: 'span', class: styles.mention})

/**
 * Order does NOT decide matching. The parser puts every static segment in one alternation
 * sorted by literal length and keeps the earliest-starting match
 * (`packages/core/src/features/tokens/parser/core/SegmentMatcher.ts:83-88`, `RowBuilder`'s
 * `acceptMatches`), so `@[` beats `[` and a table's leading `|` beats the `- ` inside its own
 * `| --- |` rule — by position, not by index.
 *
 * What the index DOES decide is which `Mark` component a match resolves to
 * (`packages/core/src/features/slots/resolveSlot.ts:77`), so reordering these reorders the
 * components.
 */
export const notionOptions: Option[] = [
	{markup: PROPERTIES_MARKUP, Mark: PropertiesMark},
	{markup: TABLE_MARKUP, Mark: TableMark},
	{markup: QUOTE_MARKUP, Mark: QuoteMark},
	{markup: MENTION_MARKUP, Mark: MentionMark},
	...(markdownOptions as Option[]),
]

/**
 * The same document plus its editor chrome: `@` opens the people list, `/` opens the block
 * menu. Trigger lookup — unlike matching — IS order-sensitive: `#findTrigger` answers with the
 * FIRST option carrying the trigger character
 * (`packages/core/src/features/overlay/OverlayController.ts:218-224`).
 *
 * The `/` option carries no markup at all. A markup-less option is legal, and this one exists
 * only to own a trigger, because the menu writes its own text rather than the option's.
 */
export const editorOptions: Option[] = [
	{markup: MENTION_MARKUP, Mark: MentionMark, Overlay: MentionOverlay, overlay: {trigger: '@'}},
	{Overlay: SlashMenu, overlay: {trigger: '/'}},
	...notionOptions.filter(option => option.markup !== MENTION_MARKUP),
]