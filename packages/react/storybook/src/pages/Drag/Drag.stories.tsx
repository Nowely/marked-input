import {MarkedInput, useMark} from '@markput/react'
import type {MarkProps, Option} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import type {CSSProperties, ReactNode} from 'react'
import {useState} from 'react'

import {Text} from '../../shared/components/Text'
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

const MarkdownMark = ({
	children,
	value,
	style,
}: {
	value?: string
	children?: ReactNode
	style?: React.CSSProperties
}) => <span style={{...style, margin: '0 1px'}}>{children || value}</span>

export const Markdown: Story = {
	render: () => {
		const [value, setValue] = useState(DRAG_MARKDOWN)

		return (
			<div style={{maxWidth: 700, margin: '0 auto', paddingLeft: 52}}>
				<MarkedInput
					Mark={MarkdownMark}
					options={markdownOptions}
					value={value}
					onChange={setValue}
					drag
					style={{minHeight: 300, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

// ─── Todo list (all marks include \n\n) ───────────────────────────────────────

interface TodoMarkProps extends MarkProps {
	style?: CSSProperties
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
		markup: '- [__value__] __nested__\n\n',
		mark: (props: MarkProps) => {
			const isDone = props.value === 'x'
			return {
				...props,
				style: {
					display: 'block',
					textDecoration: isDone ? 'line-through' : undefined,
					opacity: isDone ? 0.5 : undefined,
				} as CSSProperties,
			}
		},
	},
	{
		markup: '\t- [__value__] __nested__\n\n',
		mark: (props: MarkProps) => {
			const isDone = props.value === 'x'
			return {
				...props,
				style: {
					display: 'block',
					paddingLeft: '1.5em',
					textDecoration: isDone ? 'line-through' : undefined,
					opacity: isDone ? 0.5 : undefined,
				} as CSSProperties,
			}
		},
	},
	{
		markup: '\t\t- [__value__] __nested__\n\n',
		mark: (props: MarkProps) => {
			const isDone = props.value === 'x'
			return {
				...props,
				style: {
					display: 'block',
					paddingLeft: '3em',
					textDecoration: isDone ? 'line-through' : undefined,
					opacity: isDone ? 0.5 : undefined,
				} as CSSProperties,
			}
		},
	},
	{
		markup: '> __nested__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			style: {display: 'block', fontSize: '0.85em', color: '#888', fontStyle: 'italic'} as CSSProperties,
		}),
	},
]

const TodoMark = ({nested, style}: TodoMarkProps) => {
	const {value, change, readOnly} = useMark()
	const isDone = value === 'x'

	return (
		<span style={{...style, margin: '0 1px'}}>
			<input
				type="checkbox"
				checked={isDone}
				onChange={() => change({content: isDone ? ' ' : 'x'})}
				disabled={readOnly}
				style={{marginRight: 6}}
			/>
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

> \u2610 = pending  \u2611 = done`

// ─── Test helper stories (used by Drag.spec.tsx) ─────────────────────────────

const testStyle: React.CSSProperties = {minHeight: 100, padding: 8, border: '1px solid #e0e0e0'}

export const PlainTextDrag: Story = {
	parameters: {docs: {disable: true}},
	render: () => {
		const [value, setValue] = useState(
			'First block of plain text\n\nSecond block of plain text\n\nThird block of plain text\n\nFourth block of plain text\n\nFifth block of plain text'
		)
		return (
			<>
				<MarkedInput value={value} onChange={setValue} drag style={testStyle} />
				<Text value={value} />
			</>
		)
	},
}

export const MarkdownDrag: Story = {
	parameters: {docs: {disable: true}},
	render: () => {
		const [value, setValue] = useState(
			'# Welcome to Draggable Blocks\n\nThis is the first paragraph.\n\nThis is the second paragraph.\n\n## Features\n\n- Drag handles appear on hover'
		)
		return (
			<>
				<MarkedInput
					Mark={MarkdownMark}
					options={markdownOptions}
					value={value}
					onChange={setValue}
					drag
					style={testStyle}
				/>
				<Text value={value} />
			</>
		)
	},
}

export const ReadOnlyDrag: Story = {
	parameters: {docs: {disable: true}},
	render: () => <MarkedInput value="Read-Only Content\n\nSection A\n\nSection B" readOnly drag style={testStyle} />,
}

// ─── Todo list (all marks include \n\n) ───────────────────────────────────────

export const TodoList: Story = {
	render: () => {
		const [value, setValue] = useState(TODO_VALUE)

		return (
			<div style={{maxWidth: 700, margin: '0 auto', paddingLeft: 52}}>
				<MarkedInput
					Mark={TodoMark}
					options={todoOptions}
					value={value}
					onChange={setValue}
					drag
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}