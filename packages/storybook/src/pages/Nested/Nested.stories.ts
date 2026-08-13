import type {Markup} from '@markput/core'

import {component, story, type PageMeta} from '../../shared/lib/stories'
import type {StyledMarkProps} from './Nested.fixtures'
import {fixtures} from './Nested.fixtures'

const BoldMarkup: Markup = '**__slot__**'
const ItalicMarkup: Markup = '*__slot__*'

const TagMarkup: Markup = '#[__slot__]'
const MentionMarkup: Markup = '@[__slot__]'
const CodeMarkup: Markup = '`__slot__`'

const HtmlMarkup: Markup = '<__value__>__slot__</__value__>'

const SIMPLE_VALUE = 'This is *italic text with **bold** inside* and more text.'

const MULTI_LEVEL_VALUE = 'Check #[this tag with @[nested mention with `code`]] and #[another #[deeply nested] tag]'

const HTML_VALUE =
	'<div>This is a div with <mark>a mark inside</mark> and <b>bold text with <del>nested del</del></b></div>'

const INTERACTIVE_VALUE = '@[Click me @[or me @[or even me]]]'

/**
 * Every named export of a CSF file is indexed as a story, so this file exports stories and
 * nothing else — page constants stay module-private.
 *
 * `Nested.stories.react.tsx` carries the same `title` and adds the two tabbed documents, whose
 * harness is built on the React-only `Tabs` component.
 */
export default {
	title: 'MarkedInput/Nested',
	tags: ['autodocs'],
	component,
	parameters: {
		docs: {
			description: {
				component:
					'Examples demonstrating nested marks support. Nested marks allow creating rich, hierarchical text structures.',
			},
		},
	},
} satisfies PageMeta

export const SimpleNesting = story<StyledMarkProps>({
	args: {
		Mark: fixtures.SimpleMark,
		value: SIMPLE_VALUE,
		options: [
			{markup: BoldMarkup, mark: ({value, children}) => ({value, children, style: {fontWeight: 'bold'}})},
			{markup: ItalicMarkup, mark: ({value, children}) => ({value, children, style: {fontStyle: 'italic'}})},
		],
	},
	parameters: {plainValue: 'right'},
})

export const MultipleLevels = story<StyledMarkProps>({
	args: {
		Mark: fixtures.MultiLevelMark,
		value: MULTI_LEVEL_VALUE,
		options: [
			{
				markup: TagMarkup,
				mark: ({value, children}) => ({
					value,
					children,
					style: {
						backgroundColor: '#e7f3ff',
						border: '1px solid #2196f3',
						color: '#1976d2',
						padding: '2px 6px',
						borderRadius: '4px',
					},
				}),
			},
			{
				markup: MentionMarkup,
				mark: ({value, children}) => ({
					value,
					children,
					style: {
						backgroundColor: '#fff3e0',
						border: '1px solid #ff9800',
						color: '#f57c00',
						padding: '2px 6px',
						borderRadius: '4px',
					},
				}),
			},
			{
				markup: CodeMarkup,
				mark: ({value, children}) => ({
					value,
					children,
					style: {
						backgroundColor: '#f3e5f5',
						border: '1px solid #9c27b0',
						color: '#7b1fa2',
						padding: '2px 6px',
						borderRadius: '4px',
					},
				}),
			},
		],
	},
	parameters: {plainValue: 'right'},
})

export const HtmlLikeTags = story({
	args: {Mark: fixtures.HtmlLikeMark, value: HTML_VALUE, options: [{markup: HtmlMarkup}]},
	parameters: {plainValue: 'right'},
})

export const InteractiveNested = story({
	args: {Mark: fixtures.InteractiveMark, defaultValue: INTERACTIVE_VALUE, options: [{markup: MentionMarkup}]},
})