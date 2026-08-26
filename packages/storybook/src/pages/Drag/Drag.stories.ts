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
	title: 'Markput/Drag',
	tags: ['autodocs'],
	component,
	parameters: {
		docs: {
			description: {
				component:
					'Drag mode: each separator-delimited row is its own draggable unit (issue 08). The separator is an editor-level setting, never part of a markup; the piece after the final separator is a row even when empty.',
			},
		},
	},
} satisfies PageMeta

export const Markdown = story({
	args: {
		Mark: fixtures.MarkdownMark,
		options: markdownOptions,
		defaultValue: DRAG_MARKDOWN,
		separator: '\n\n',
		draggable: true,
	},
})

/**
 * The three helper stories below are UNCONTROLLED. The shared spec drives them both ways —
 * `mount` for the uncontrolled contract, `mountEcho` for a controlled field whose `onChange`
 * is echoed back — and `mountEcho` refuses a story that opts into the plain-value panel,
 * because the decorator owns `onChange` there.
 *
 * They used to carry `style: {marginLeft: '64px'}`, and the note here called it load-bearing:
 * the controls layer hangs the grip band off its row's LEFT edge
 * (`.SidePanel { margin-left: -24px }`), and core's 24px gutter was a NUMERIC `paddingLeft`
 * that React turned into `24px` and Vue dropped, so flush against the viewport Vue's grip was
 * outside it and unclickable. Core emits `'24px'` now, the gutter exists in both frameworks,
 * the band sits inside the container's padding box, and the margin is gone.
 */
export const PlainTextDrag = story({
	parameters: {docs: {disable: true}},
	args: {
		Mark: fixtures.ParagraphMark,
		options: fixtures.paragraphOptions,
		defaultValue: PLAIN_TEXT_VALUE,
		separator: '\n\n',
		draggable: true,
	},
})

export const MarkdownDrag = story({
	parameters: {docs: {disable: true}},
	args: {
		Mark: fixtures.MarkdownMark,
		options: markdownOptions,
		defaultValue: MARKDOWN_DRAG_VALUE,
		separator: '\n\n',
		draggable: true,
	},
})

export const ReadOnlyDrag = story({
	parameters: {docs: {disable: true}},
	args: {
		Mark: fixtures.ParagraphMark,
		options: fixtures.paragraphOptions,
		value: READ_ONLY_VALUE,
		readOnly: true,
		separator: '\n\n',
		draggable: true,
	},
})

/**
 * A single-newline separator: each todo line is its own draggable row.
 *
 * `indent: ''` because this document stores its leading tabs as CONTENT — the indented markup
 * begins with one. At the default `'\t'` that tab is a row's lead, which is structural, so the
 * markup would never match and the nested items would lose their checkboxes. This is the lever
 * ADR-0010 names for exactly that consumer, and it turns off nesting for this editor.
 */
export const TodoList = story({
	args: {
		options: TODO_OPTIONS,
		value: TODO_VALUE,
		separator: '\n',
		indent: '',
		draggable: true,
	},
	parameters: {plainValue: 'right'},
})