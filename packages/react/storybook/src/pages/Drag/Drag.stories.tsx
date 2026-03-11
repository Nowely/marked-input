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

// ─── Shared mark component ────────────────────────────────────────────────────

const Chip = ({value, style}: {value?: string; style?: CSSProperties}) => (
	<span
		style={{
			display: 'inline-block',
			padding: '2px 10px',
			borderRadius: 14,
			background: '#e8f0fe',
			color: '#1a73e8',
			fontWeight: 500,
			fontSize: 13,
			...style,
		}}
	>
		{value}
	</span>
)

const mentionOptions: Option[] = [{markup: '@[__value__](__meta__)'}, {markup: '#[__value__]'}]

// ─── Basic: mark rows are auto-delimited ──────────────────────────────────────

export const BasicMentions: Story = {
	render: () => {
		const [value, setValue] = useState('@[Alice](alice)@[Bob](bob)@[Carol](carol)')

		return (
			<div style={{maxWidth: 500, margin: '0 auto', paddingLeft: 52}}>
				<p style={{color: '#555', fontSize: 13, marginBottom: 8}}>
					Three adjacent marks — no <code>\n\n</code> separator needed between them. Each mark is its own
					draggable row.
				</p>
				<MarkedInput
					Mark={Chip}
					options={mentionOptions}
					value={value}
					onChange={setValue}
					drag
					style={{minHeight: 120, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

// ─── Mixed: text rows and mark rows ───────────────────────────────────────────

export const MixedTokens: Story = {
	render: () => {
		const [value, setValue] = useState('Introduction\n\n@[Alice](alice)@[Bob](bob)\n\nConclusion')

		return (
			<div style={{maxWidth: 500, margin: '0 auto', paddingLeft: 52}}>
				<p style={{color: '#555', fontSize: 13, marginBottom: 8}}>
					Text rows use <code>\n\n</code> as separator; mark rows are auto-delimited. Drag to reorder.
				</p>
				<MarkedInput
					Mark={Chip}
					options={mentionOptions}
					value={value}
					onChange={setValue}
					drag
					style={{minHeight: 160, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

// ─── Tag list: marks only ─────────────────────────────────────────────────────

const TagChip = ({value}: {value?: string}) => (
	<span
		style={{
			display: 'inline-block',
			padding: '3px 10px',
			borderRadius: 4,
			background: '#f1f3f4',
			color: '#333',
			fontSize: 13,
			fontFamily: 'monospace',
		}}
	>
		#{value}
	</span>
)

const tagOptions: Option[] = [{markup: '#[__value__]'}]

export const TagList: Story = {
	render: () => {
		const [value, setValue] = useState('#[react]#[typescript]#[drag-and-drop]#[editor]')

		return (
			<div style={{maxWidth: 500, margin: '0 auto', paddingLeft: 52}}>
				<p style={{color: '#555', fontSize: 13, marginBottom: 8}}>
					Tag list where every row is a mark. No separators in the value string.
				</p>
				<MarkedInput
					Mark={TagChip}
					options={tagOptions}
					value={value}
					onChange={setValue}
					drag
					style={{minHeight: 120, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

// ─── Always-visible handles ───────────────────────────────────────────────────

export const AlwaysShowHandle: Story = {
	render: () => {
		const [value, setValue] = useState('@[Alice](alice)@[Bob](bob)@[Carol](carol)')

		return (
			<div style={{maxWidth: 500, margin: '0 auto', paddingLeft: 52}}>
				<MarkedInput
					Mark={Chip}
					options={mentionOptions}
					value={value}
					onChange={setValue}
					drag={{alwaysShowHandle: true}}
					style={{minHeight: 120, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

// ─── Nested marks inside a top-level mark ────────────────────────────────────

interface BoldMarkProps extends MarkProps {
	style?: CSSProperties
}

// For nested marks the outer mark receives `children` (rendered inner marks),
// not a plain `value` string — so render both.
const NestedChip = ({value, children, style}: BoldMarkProps) => (
	<span
		style={{
			display: 'inline-block',
			padding: '2px 10px',
			borderRadius: 14,
			background: '#e8f0fe',
			color: '#1a73e8',
			fontWeight: 500,
			fontSize: 13,
			...style,
		}}
	>
		{children ?? value}
	</span>
)

// Use __nested__ so the parser supports marks inside the outer @[...](meta).
// Use the function form of `mark` so base props (including `children`) are preserved.
const boldOptions: Option<BoldMarkProps>[] = [
	{markup: '@[__nested__](__meta__)', mark: (props: MarkProps) => ({...props, style: {color: '#1a73e8'}})},
	{markup: '**__nested__**', mark: (props: MarkProps) => ({...props, style: {fontWeight: 700}})},
]

export const NestedMarks: Story = {
	render: () => {
		const [value, setValue] = useState('@[Hello **world**](demo)@[**Bold** mention](bold)\n\nPlain text row')

		return (
			<div style={{maxWidth: 500, margin: '0 auto', paddingLeft: 52}}>
				<p style={{color: '#555', fontSize: 13, marginBottom: 8}}>
					Nested marks stay inside their parent mark — they are NOT separate rows.
				</p>
				<MarkedInput
					Mark={NestedChip}
					options={boldOptions}
					value={value}
					onChange={setValue}
					drag
					style={{minHeight: 140, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

// ─── Plain text rows ──────────────────────────────────────────────────────────

export const PlainTextDrag: Story = {
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
					drag
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

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

export const MarkdownDrag: Story = {
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
					options={blockLevelMarkdownOptions}
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

export const MarkdownDocumentDrag: Story = {
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

export const ReadOnlyDrag: Story = {
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
					options={blockLevelMarkdownOptions}
					value={value}
					readOnly
					drag
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
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

export const TodoListDrag: Story = {
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