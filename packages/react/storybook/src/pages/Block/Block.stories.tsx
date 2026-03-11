import {MarkedInput} from '@markput/react'
import type {MarkProps, Option} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import type {CSSProperties, ReactNode} from 'react'
import {useState} from 'react'

import {Text} from '../../shared/components/Text'
import {COMPLEX_MARKDOWN} from '../../shared/lib/sampleTexts'
import {markdownOptions} from '../Nested/MarkdownOptions'

export default {
	title: 'MarkedInput/Block',
	tags: ['autodocs'],
	component: MarkedInput,
	parameters: {
		docs: {
			description: {
				component:
					'Notion-like draggable blocks. Hover over a block to reveal the + and drag handle buttons. Drag to reorder, click + to add a block, click the grip to open a block menu (delete/duplicate).',
			},
		},
	},
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

const MarkdownMark = ({
	children,
	value,
	style,
}: {
	value?: string
	children?: ReactNode
	style?: React.CSSProperties
}) => <span style={{...style, margin: '0 1px'}}>{children || value}</span>

export const BasicDraggable: Story = {
	render: () => {
		const [value, setValue] = useState(`# Welcome to Draggable Blocks

This is the first paragraph. Hover to see the drag handle on the left.

This is the second paragraph. Try dragging it above the first one!

## Features

- Drag handles appear on hover
- Drop indicators show where the block will land
- Blocks reorder by manipulating the underlying string`)

		return (
			<div style={{maxWidth: 700, margin: '0 auto', paddingLeft: 52}}>
				<MarkedInput
					Mark={MarkdownMark}
					options={markdownOptions}
					value={value}
					onChange={setValue}
					block
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

export const MarkdownDocument: Story = {
	render: () => {
		const [value, setValue] = useState(COMPLEX_MARKDOWN)

		return (
			<div>
				<MarkedInput Mark={MarkdownMark} options={markdownOptions} value={value} onChange={setValue} block />
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

export const ReadOnlyDraggable: Story = {
	render: () => {
		const value = `# Read-Only Mode

Drag handles are hidden in read-only mode.

## Section A

Content cannot be reordered.

## Section B

This is static content.`

		return (
			<div style={{maxWidth: 700, margin: '0 auto', paddingLeft: 52}}>
				<MarkedInput
					Mark={MarkdownMark}
					options={markdownOptions}
					value={value}
					readOnly
					block
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
			</div>
		)
	},
}

export const MobileBlocks: Story = {
	render: () => {
		const [value, setValue] = useState(`# Always-visible handles

Drag handles are always visible — ideal for touch devices.

## Try it

Tap the grip icon to open the block menu.`)

		return (
			<div style={{maxWidth: 700, margin: '0 auto', paddingLeft: 52}}>
				<MarkedInput
					Mark={MarkdownMark}
					options={markdownOptions}
					value={value}
					onChange={setValue}
					block={{alwaysShowHandle: true}}
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

export const PlainTextBlocks: Story = {
	render: () => {
		const [value, setValue] = useState(`First block of plain text

Second block of plain text

Third block of plain text

Fourth block of plain text

Fifth block of plain text`)

		return (
			<div style={{maxWidth: 700, margin: '0 auto', paddingLeft: 52}}>
				<MarkedInput
					value={value}
					onChange={setValue}
					block
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

// ---------------------------------------------------------------------------
// Todo List — Notion-like checklist with nested hierarchy
// ---------------------------------------------------------------------------

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
		markup: '- [ ] __nested__\n\n',
		mark: (props: MarkProps) => ({...props, todo: 'pending' as const, style: {display: 'block'} as CSSProperties}),
	},
	{
		markup: '- [x] __nested__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			todo: 'done' as const,
			style: {display: 'block', textDecoration: 'line-through', opacity: 0.5} as CSSProperties,
		}),
	},
	{
		markup: '\t- [ ] __nested__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			todo: 'pending' as const,
			style: {display: 'block', paddingLeft: '1.5em'} as CSSProperties,
		}),
	},
	{
		markup: '\t- [x] __nested__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			todo: 'done' as const,
			style: {
				display: 'block',
				paddingLeft: '1.5em',
				textDecoration: 'line-through',
				opacity: 0.5,
			} as CSSProperties,
		}),
	},
	{
		markup: '\t\t- [ ] __nested__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			todo: 'pending' as const,
			style: {display: 'block', paddingLeft: '3em'} as CSSProperties,
		}),
	},
	{
		markup: '\t\t- [x] __nested__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			todo: 'done' as const,
			style: {
				display: 'block',
				paddingLeft: '3em',
				textDecoration: 'line-through',
				opacity: 0.5,
			} as CSSProperties,
		}),
	},
	{
		markup: '> __nested__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			style: {display: 'block', fontSize: '0.85em', color: '#888', fontStyle: 'italic'} as CSSProperties,
		}),
	},
]

const TodoMark = ({children, value, style, todo}: TodoMarkProps) => (
	<span style={{...style, margin: '0 1px'}}>
		{todo && <span style={{marginRight: 6}}>{todo === 'done' ? '\u2611' : '\u2610'}</span>}
		{children || value}
	</span>
)

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
					block
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}