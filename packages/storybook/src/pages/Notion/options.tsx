import type {Markup} from '@markput/core'
import type {Option} from '@markput/react'

import {defineMark} from '../../shared/lib/marks'
import {markdownOptions} from '../Nested/MarkdownOptions'
import {PropertiesMark} from './components/PropertiesMark'
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
 * character is `-`. */
const PROPERTIES_MARKUP: Markup = '---\n__value__\n---'

/** A whole markdown table. The trailing value closes at the row boundary, so it takes every
 * line of the table; a bounded value could not cross a newline. */
const TABLE_MARKUP: Markup = '|__value__'

/** A quote keeps a `__slot__`, so unlike the table its text stays editable in place. Multi-line
 * quotes nest rather than continue (notion-like issue 06). */
const QUOTE_MARKUP: Markup = '> __slot__'

const QuoteMark = defineMark({tag: 'span', class: styles.quote})

/**
 * Order is deliberate: the table and the frontmatter are registered BEFORE the preset, so that
 * where both could match — the `- ` inside a table's `| --- |` rule, for one — the whole-block
 * markup is the one that takes the text.
 */
export const notionOptions: Option[] = [
	{markup: PROPERTIES_MARKUP, Mark: PropertiesMark},
	{markup: TABLE_MARKUP, Mark: TableMark},
	{markup: QUOTE_MARKUP, Mark: QuoteMark},
	...(markdownOptions as Option[]),
]