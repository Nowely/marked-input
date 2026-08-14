import {DRAG_MARKDOWN} from '../../shared/lib/sampleTexts'
import {component, story, type PageMeta} from '../../shared/lib/stories'
import {markdownOptions} from '../Nested/MarkdownOptions'
import {TODO_OPTIONS, TODO_VALUE} from './components/TodoMark'
import {fixtures} from './Drag.fixtures'

const PLAIN_TEXT_VALUE =
	'First block of plain text\n\nSecond block of plain text\n\nThird block of plain text\n\nFourth block of plain text\n\nFifth block of plain text\n\n'

const MARKDOWN_DRAG_VALUE =
	'# Welcome to Draggable Blocks\n\nThis is the first paragraph.\n\nThis is the second paragraph.\n\n## Features\n\n- Drag handles appear on hover\n\n'

const READ_ONLY_VALUE = 'Read-Only Content\n\nSection A\n\nSection B\n\n'

/**
 * Every named export of a CSF file is indexed as a story, so this file exports stories and
 * nothing else — page constants stay module-private.
 */
export default {
	title: 'MarkedInput/Drag',
	tags: ['autodocs'],
	component,
	parameters: {
		docs: {
			description: {
				component:
					'Drag mode: each top-level token (mark or text fragment) is its own draggable row. Adjacent marks need no separator; adjacent text rows use \\n\\n.',
			},
		},
	},
} satisfies PageMeta

export const Markdown = story({
	args: {
		Mark: fixtures.MarkdownMark,
		options: markdownOptions,
		defaultValue: DRAG_MARKDOWN,
		layout: 'block',
		draggable: true,
	},
})

/**
 * The three helper stories below are UNCONTROLLED. The shared spec drives them both ways —
 * `mount` for the uncontrolled contract, `mountEcho` for a controlled field whose `onChange`
 * is echoed back — and `mountEcho` refuses a story that opts into the plain-value panel,
 * because the decorator owns `onChange` there.
 *
 * The left margin is load-bearing for the spec, not decoration: the grip sits at `left: -24px`
 * of its row, and the 24px gutter core asks for is a NUMERIC `paddingLeft`, which React turns
 * into `24px` and Vue drops (it assigns numbers to `style` verbatim). Flush against the
 * viewport the button is unclickable in Vue — `element is outside of the viewport` — so the
 * story reserves the gutter itself, exactly as the pre-migration React harness did.
 */
export const PlainTextDrag = story({
	parameters: {docs: {disable: true}},
	args: {
		Mark: fixtures.ParagraphMark,
		options: fixtures.paragraphOptions,
		defaultValue: PLAIN_TEXT_VALUE,
		layout: 'block',
		draggable: true,
		style: {marginLeft: '64px'},
	},
})

export const MarkdownDrag = story({
	parameters: {docs: {disable: true}},
	args: {
		Mark: fixtures.MarkdownMark,
		options: markdownOptions,
		defaultValue: MARKDOWN_DRAG_VALUE,
		layout: 'block',
		draggable: true,
		style: {marginLeft: '64px'},
	},
})

export const ReadOnlyDrag = story({
	parameters: {docs: {disable: true}},
	args: {
		Mark: fixtures.ParagraphMark,
		options: fixtures.paragraphOptions,
		value: READ_ONLY_VALUE,
		readOnly: true,
		layout: 'block',
		draggable: true,
	},
})

/** Every markup ends in `\n`, so each todo line is its own draggable row. */
export const TodoList = story({
	args: {
		options: TODO_OPTIONS,
		value: TODO_VALUE,
		layout: 'block',
		draggable: true,
	},
	parameters: {plainValue: 'right'},
})