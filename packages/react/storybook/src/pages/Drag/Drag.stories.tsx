import {MarkedInput} from '@markput/react'
import type {MarkProps, MarkedInputProps} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import type {CSSProperties} from 'react'

import {DRAG_MARKDOWN} from '../../shared/lib/sampleTexts'
import {markdownOptions} from '../Nested/MarkdownOptions'
import {TODO_OPTIONS, TODO_VALUE} from './components/TodoMark'

export default {
	title: 'MarkedInput/Drag',
	tags: ['autodocs'],
	component: MarkedInput,
	parameters: {
		docs: {
			description: {
				component:
					'Drag mode: each top-level token (mark or text fragment) is its own draggable row. Adjacent marks need no separator; adjacent text rows use \\n\\n.',
			},
		},
	},
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

// ─── Markdown with block-level marks (headings + list) ────────────────────────

interface MarkdownMarkProps extends MarkProps {
	style?: CSSProperties
}

const MarkdownMark = ({children, value, style}: MarkdownMarkProps) => (
	<span style={{...style, margin: '0 1px'}}>{children || value}</span>
)

export const Markdown: StoryObj<MarkedInputProps<MarkdownMarkProps>> = {
	args: {
		Mark: MarkdownMark,
		options: markdownOptions,
		value: DRAG_MARKDOWN,
		drag: true,
	},
}

export const PlainTextDrag: Story = {
	parameters: {docs: {disable: true}, plainValue: 'bottom'},
	args: {
		value: 'First block of plain text\n\nSecond block of plain text\n\nThird block of plain text\n\nFourth block of plain text\n\nFifth block of plain text',
		drag: true,
	},
}

export const MarkdownDrag: StoryObj<MarkedInputProps<MarkdownMarkProps>> = {
	parameters: {docs: {disable: true}, plainValue: 'bottom'},
	args: {
		Mark: MarkdownMark,
		options: markdownOptions,
		value: '# Welcome to Draggable Blocks\n\nThis is the first paragraph.\n\nThis is the second paragraph.\n\n## Features\n\n- Drag handles appear on hover',
		drag: true,
	},
}

export const ReadOnlyDrag: Story = {
	parameters: {docs: {disable: true}},
	args: {
		value: 'Read-Only Content\n\nSection A\n\nSection B',
		readOnly: true,
		drag: true,
	},
}

// ─── Todo list (all marks include \n\n) ───────────────────────────────────────

export const TodoList: Story = {
	args: {
		options: TODO_OPTIONS,
		value: TODO_VALUE,
		drag: true,
	},
	parameters: {
		plainValue: 'right',
	},
}