import {component, story, type PageMeta} from '../../shared/lib/stories'
import {APOLLO_DOC} from './document'
import {fixtures} from './Notion.fixtures'

/**
 * THE SHOWCASE — `docs/scratch/notion-like/showcase.md`, built out of `notion/` and a published
 * adapter alone. Framework-free, so BOTH projects run it and a divergence between the two
 * adapters is a failing test rather than a difference nobody diffs.
 *
 * Every block on the page is an OPTION: the properties panel, the table of contents, the inline
 * database with its editable cells, the board, the metric cards, the callout, the lists, the
 * toggles, the code fence, the quote, the bookmark and the comment thread. Nothing on this page
 * filters a menu, inserts a markup or reaches into a store — the story hands over an options array
 * and a paragraph component, and the editor does the rest.
 *
 * Every named export of a CSF file is indexed as a story, so this file exports stories and
 * nothing else — page constants stay module-private.
 */
export default {
	title: 'Notion/Showcase',
	component,
	parameters: {
		docs: {
			description: {
				component:
					'A Notion page written as markput options. Type `/` on a row for the block menu, `@` for ' +
					'the people picker, Tab to nest, and drag a row by its grip.',
			},
		},
	},
	decorators: fixtures.decorators,
} satisfies PageMeta

export const Showcase = story({
	args: {
		options: fixtures.options,
		slots: fixtures.slots,
		defaultValue: APOLLO_DOC,
		draggable: true,
	},
})

/**
 * The page a user starts from: one empty row carrying its placeholder. It is what `/` on an empty
 * row is driven against, and the only place the placeholder is visible at all.
 */
export const Empty = story({
	args: {
		options: fixtures.options,
		slots: fixtures.slots,
		defaultValue: '',
		draggable: true,
	},
})