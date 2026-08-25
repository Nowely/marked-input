import type {MarkedInputProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'

import {defineMark, type StyledMarkProps} from '../../shared/lib/marks'
import {markdownOptions} from '../Nested/MarkdownOptions'
import {APOLLO_DOC} from './document'
import {editorOptions, notionOptions} from './options'

/**
 * The notion-like probe (`docs/scratch/notion-like/map.md`). It builds a Notion-shaped
 * document out of nothing but the published API — no core edits, no fixture that dodges a
 * parser limit — so that every place the API refuses shows up here as damage rather than as
 * an argument.
 *
 * React-only on purpose: the probe is expected to churn, and the shared-spec harness would
 * cost a second fixture implementation per iteration.
 */

/** `white-space: pre-wrap` is the consumer's job: nothing in core sets it, and a row full of
 * soft breaks — a table, the frontmatter, a tight list — is unreadable without it. */
const PAGE_STYLE = {
	whiteSpace: 'pre-wrap',
	maxWidth: '52em',
	margin: '0 auto',
	padding: '2em',
	fontFamily: 'ui-sans-serif, -apple-system, Segoe UI, sans-serif',
	fontSize: '16px',
	lineHeight: 1.6,
	color: '#37352f',
	outline: 'none',
} as const

const DocumentMark = defineMark({tag: 'span'})

export default {
	title: 'Notion/Document',
	component: MarkedInput,
	parameters: {
		docs: {
			description: {
				component:
					'Probe: a Notion page in the OKF/Obsidian shape, rendered by the published API alone. ' +
					'Gaps it exposes are tracked in `docs/scratch/notion-like/`.',
			},
		},
	},
} satisfies Meta<typeof MarkedInput>

/**
 * What the existing markdown preset alone makes of the document: headings, the tight list,
 * bold, links and the fenced code block. The frontmatter, both tables and the blockquote have
 * no markup yet and stay raw text — the later stories on this page give them one.
 */
export const MarkdownPreset: StoryObj<MarkedInputProps<StyledMarkProps>> = {
	args: {
		Mark: DocumentMark,
		options: markdownOptions,
		defaultValue: APOLLO_DOC,
		separator: '\n\n',
		draggable: true,
		slotProps: {container: {style: PAGE_STYLE}},
	},
}

/**
 * The same document with the page's own markups added: the frontmatter becomes a properties
 * panel, each table becomes a table, the quote gets its rule, and `@[Name](id)` becomes a
 * mention instead of a link with a stray `@` in front of it. Two of the four are atomic — the
 * price of blocks the parser cannot describe part by part.
 */
export const Document: StoryObj<MarkedInputProps<StyledMarkProps>> = {
	args: {
		Mark: DocumentMark,
		options: notionOptions,
		defaultValue: APOLLO_DOC,
		separator: '\n\n',
		draggable: true,
		slotProps: {container: {style: PAGE_STYLE}},
	},
}

/**
 * The document with its editor chrome: type `@` for the people list, `/` for the block menu,
 * and hover a row for its drag grip. All three run on machinery that already ships — overlay
 * triggers, `store.edit`, and `draggable` — which is the claim this story exists to test.
 */
export const Editor: StoryObj<MarkedInputProps<StyledMarkProps>> = {
	args: {
		Mark: DocumentMark,
		options: editorOptions,
		defaultValue: APOLLO_DOC,
		separator: '\n\n',
		draggable: true,
		slotProps: {container: {style: PAGE_STYLE}},
	},
}