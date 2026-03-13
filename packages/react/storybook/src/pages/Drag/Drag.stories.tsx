import {MarkedInput} from '@markput/react'
import type {MarkProps, Option} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import type {CSSProperties, ReactNode} from 'react'
import {useState} from 'react'

import {Text} from '../../shared/components/Text'
import {COMPLEX_MARKDOWN} from '../../shared/lib/sampleTexts'
import {blockLevelMarkdownOptions} from '../Nested/MarkdownOptions'

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
		const [value, setValue] = useState(COMPLEX_MARKDOWN)

		return (
			<div style={{maxWidth: 700, margin: '0 auto', paddingLeft: 52}}>
				<MarkedInput
					Mark={MarkdownMark}
					options={blockLevelMarkdownOptions}
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
					drag
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}