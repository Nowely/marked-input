import {MarkedInput, useMark} from '@markput/react'
import type {MarkProps, MarkedInputProps, Option} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import type {CSSProperties} from 'react'
import {useState} from 'react'

import {DRAG_MARKDOWN} from '../../shared/lib/sampleTexts'
import {markdownOptions} from '../Nested/MarkdownOptions'

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
		style: {minHeight: 300, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8},
	},
}

// ─── Todo list (all marks include \n\n) ───────────────────────────────────────

interface TodoMarkProps extends MarkProps {
	style?: CSSProperties
	todo?: 'pending' | 'done'
}

const todoOptions: Option<TodoMarkProps>[] = [
	{
		markup: '# __nested__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			style: {display: 'block', fontSize: '1.4em', fontWeight: 'bold', margin: '0.3em 0'} as CSSProperties,
		}),
	},
	{
		markup: '- [__value__] __nested__\n',
		mark: (props: MarkProps) => {
			const isDone = props.value === 'x'
			return {
				...props,
				todo: isDone ? 'done' : 'pending',
				style: {
					display: 'block',
					opacity: isDone ? 0.55 : undefined,
				} as CSSProperties,
			}
		},
	},
	{
		markup: '\t- [__value__] __nested__\n',
		mark: (props: MarkProps) => {
			const isDone = props.value === 'x'
			return {
				...props,
				todo: isDone ? 'done' : 'pending',
				style: {
					display: 'block',
					paddingLeft: '22px',
					borderLeft: '2px solid #d0d7de',
					opacity: isDone ? 0.55 : undefined,
				} as CSSProperties,
			}
		},
	},
	{
		markup: '\t\t- [__value__] __nested__\n',
		mark: (props: MarkProps) => {
			const isDone = props.value === 'x'
			return {
				...props,
				todo: isDone ? 'done' : 'pending',
				style: {
					display: 'block',
					paddingLeft: '22px',
					marginLeft: '24px',
					borderLeft: '2px solid #d0d7de',
					opacity: isDone ? 0.55 : undefined,
				} as CSSProperties,
			}
		},
	},
	{
		markup: '> __nested__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			style: {
				display: 'block',
				fontSize: '0.85em',
				color: '#888',
				fontStyle: 'italic',
				marginTop: 16,
			} as CSSProperties,
		}),
	},
]

const TodoMark = ({nested, style, todo}: TodoMarkProps) => {
	const mark = useMark()
	const [isDone, setIsDone] = useState(mark.value === 'x')

	return (
		<span
			style={{
				...style,
				margin: '0 1px',
				opacity: isDone ? 0.55 : undefined,
			}}
		>
			{todo !== undefined && (
				<input
					type="checkbox"
					checked={isDone}
					onChange={() => {
						const next = !isDone
						setIsDone(next)
						mark.value = next ? 'x' : ' '
					}}
					disabled={mark.readOnly}
					style={{marginRight: 6}}
				/>
			)}
			{nested}
		</span>
	)
}

const TODO_VALUE = `# \u{1F4CB} Project Launch Checklist

- [ ] Design Phase
\t- [ ] Create wireframes
\t- [x] Define color palette
\t- [ ] Design component library
- [x] Research
\t- [x] Analyze competitors
\t- [x] User interviews
\t\t- [x] Draft interview questions
\t\t- [x] Schedule 5 sessions
- [ ] Development
\t- [ ] Set up CI/CD pipeline
\t- [x] Write unit tests
\t- [ ] API integration
\t\t- [ ] Auth endpoints
\t\t- [ ] Data sync
- [ ] Launch
\t- [ ] Final QA pass
\t- [ ] Deploy to production
> \u2610 = pending  \u2611 = done

`

// ─── Test helper stories (used by Drag.spec.tsx) ─────────────────────────────

const testStyle: React.CSSProperties = {minHeight: 100, padding: 8, border: '1px solid #e0e0e0'}

export const PlainTextDrag: Story = {
	parameters: {docs: {disable: true}, plainValue: 'bottom'},
	args: {
		value: 'First block of plain text\n\nSecond block of plain text\n\nThird block of plain text\n\nFourth block of plain text\n\nFifth block of plain text',
		drag: true,
		style: testStyle,
	},
}

export const MarkdownDrag: StoryObj<MarkedInputProps<MarkdownMarkProps>> = {
	parameters: {docs: {disable: true}, plainValue: 'bottom'},
	args: {
		Mark: MarkdownMark,
		options: markdownOptions,
		value: '# Welcome to Draggable Blocks\n\nThis is the first paragraph.\n\nThis is the second paragraph.\n\n## Features\n\n- Drag handles appear on hover',
		drag: true,
		style: testStyle,
	},
}

export const ReadOnlyDrag: Story = {
	parameters: {docs: {disable: true}},
	args: {
		value: 'Read-Only Content\n\nSection A\n\nSection B',
		readOnly: true,
		drag: true,
		style: testStyle,
	},
}

// ─── Todo list (all marks include \n\n) ───────────────────────────────────────

export const TodoList: StoryObj<MarkedInputProps<TodoMarkProps>> = {
	args: {
		Mark: TodoMark,
		options: todoOptions,
		value: TODO_VALUE,
		drag: true,
	},
	parameters: {
		plainValue: 'right',
	},
}