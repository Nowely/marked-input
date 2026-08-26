import type {MarkedInputProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'

import {APOLLO_DOC} from './document'
import {fixtures} from './Notion.fixtures'

/**
 * THE SHOWCASE — `docs/scratch/notion-like/showcase.md`, built out of `notion/` and the
 * published adapter alone.
 *
 * Every block on the page is an OPTION: the properties panel, the table of contents, the inline
 * database with its editable cells, the board, the metric cards, the callout, the lists, the
 * toggles, the code fence, the quote, the bookmark and the comment thread. Nothing on this page
 * filters a menu, inserts a markup or reaches into a store — the story hands over an options array
 * and a paragraph component, and the editor does the rest.
 */

export default {
	title: 'Notion/Showcase',
	component: MarkedInput,
	parameters: {
		docs: {
			description: {
				component:
					'A Notion page written as markput options. Type `/` on a row for the block menu, `@` for ' +
					'the people picker, Tab to nest, and drag a row by its grip.',
			},
		},
	},
	decorators: [
		Story => (
			<fixtures.Page>
				<Story />
			</fixtures.Page>
		),
	],
} satisfies Meta<typeof MarkedInput>

export const Showcase: StoryObj<MarkedInputProps> = {
	args: {
		options: fixtures.options,
		slots: fixtures.slots,
		defaultValue: APOLLO_DOC,
		draggable: true,
	},
}

/**
 * The page a user starts from: one empty row carrying its placeholder. It is what `/` on an empty
 * row is driven against, and the only place the placeholder is visible at all.
 */
export const Empty: StoryObj<MarkedInputProps> = {
	args: {
		options: fixtures.options,
		slots: fixtures.slots,
		defaultValue: '',
		draggable: true,
	},
}