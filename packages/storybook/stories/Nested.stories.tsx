import {Meta, StoryObj} from '@storybook/react-vite'
import {MarkedInput, createMarkedInput, useMark} from 'rc-marked-input'
import type {MarkToken, Markup} from 'rc-marked-input'
import {ReactNode, useState} from 'react'
import {Text} from '../assets/Text'

export default {
	title: 'MarkedInput/Nested',
	tags: ['autodocs'],
	component: MarkedInput,
	parameters: {
		docs: {
			description: {
				component:
					'Examples demonstrating nested marks support with ParserV2. Nested marks allow creating rich, hierarchical text structures.',
			},
		},
	},
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput<MarkToken>>>

// ============================================================================
// Example 1: Simple Nesting (Markdown-style)
// ============================================================================

const BoldMarkup: Markup = '**__nested__**'
const ItalicMarkup: Markup = '*__nested__*'

const SimpleMark = ({children, style, value}: {value?: string; children?: ReactNode; style?: React.CSSProperties}) => (
	<span style={style}>{children || value}</span>
)

export const SimpleNesting: Story = {
	render: () => {
		const [value, setValue] = useState('This is *italic text with **bold** inside* and more text.')

		return (
			<>
				<MarkedInput
					Mark={SimpleMark}
					value={value}
					onChange={setValue}
					options={[
						{
							markup: BoldMarkup,
							initMark: ({value, children}) => ({
								value,
								children,
								style: {fontWeight: 'bold'},
							}),
						},
						{
							markup: ItalicMarkup,
							initMark: ({value, children}) => ({
								value,
								children,
								style: {fontStyle: 'italic'},
							}),
						},
					]}
				/>
				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

// ============================================================================
// Example 2: Multiple Nesting Levels
// ============================================================================

const TagMarkup: Markup = '#[__nested__]'
const MentionMarkup: Markup = '@[__nested__]'
const CodeMarkup: Markup = '`__nested__`'

const MultiLevelMark = ({
	children,
	style,
	value,
}: {
	value?: string
	children?: ReactNode
	style?: React.CSSProperties
}) => <span style={{...style, margin: '0 2px'}}>{children || value}</span>

export const MultipleLevels: Story = {
	render: () => {
		const [value, setValue] = useState(
			'Check #[this tag with @[nested mention with `code`]] and #[another #[deeply nested] tag]'
		)

		return (
			<>
				<MarkedInput
					Mark={MultiLevelMark}
					value={value}
					onChange={setValue}
					options={[
						{
							markup: TagMarkup,
							initMark: ({value, children}) => ({
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
							initMark: ({value, children}) => ({
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
							initMark: ({value, children}) => ({
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
					]}
				/>
				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

// ============================================================================
// Example 3: HTML-like Tags
// ============================================================================

const HtmlMarkup: Markup = '<__value__>__nested__</__value__>'

const HtmlLikeMark = ({children, value, nested}: {value?: string; children?: ReactNode; nested?: string}) => {
	const Tag = value! as React.ElementType
	return <Tag>{children || nested}</Tag>
}

export const HtmlLikeTags: Story = {
	render: () => {
		const [value, setValue] = useState(
			'<div>This is a div with <mark>a mark inside</mark> and <b>bold text with <del>nested del</del></b></div>'
		)

		return (
			<>
				<MarkedInput Mark={HtmlLikeMark} value={value} onChange={setValue} options={[{markup: HtmlMarkup}]} />
				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

// ============================================================================
// Example 4: Interactive Nested Marks with Tree Navigation
// ============================================================================

const InteractiveMark = ({children, nested}: {value?: string; children?: ReactNode; nested?: string}) => {
	const mark = useMark()
	const [isHighlighted, setIsHighlighted] = useState(false)

	return (
		<span
			onClick={e => {
				e.stopPropagation()
				console.log('Mark clicked:', {
					depth: mark.depth,
					hasChildren: mark.hasChildren,
					childrenCount: mark.children.length,
					parent: mark.parent ? 'has parent' : 'root level',
				})
			}}
			onMouseEnter={() => setIsHighlighted(true)}
			onMouseLeave={() => setIsHighlighted(false)}
			style={{
				display: 'inline-block',
				padding: '4px 8px',
				margin: '2px',
				border: isHighlighted ? '2px solid #2196f3' : '1px solid #ccc',
				borderRadius: '4px',
				backgroundColor: isHighlighted ? '#e3f2fd' : '#f5f5f5',
				cursor: 'pointer',
				transition: 'all 0.2s',
			}}
			title={`Depth: ${mark.depth}, Children: ${mark.children.length}`}
		>
			{children || nested}
		</span>
	)
}

export const InteractiveNested: Story = {
	render: () => {
		const [value, setValue] = useState('@[Click me @[or me @[or even me]]]')

		return (
			<>
				<MarkedInput
					Mark={InteractiveMark}
					value={value}
					onChange={setValue}
					options={[{markup: '@[__nested__]'}]}
				/>
				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

// ============================================================================
// Example 5: Editable Nested Content
// ============================================================================

const EditableMark = ({children}: {value?: string; children?: ReactNode}) => {
	const mark = useMark()

	return (
		<span
			ref={mark.ref}
			contentEditable
			suppressContentEditableWarning
			style={{
				display: 'inline-block',
				padding: '4px 8px',
				margin: '2px',
				border: '1px dashed #999',
				borderRadius: '4px',
				backgroundColor: '#fff9e6',
				minWidth: '20px',
			}}
		>
			{children}
		</span>
	)
}

//TODO fix it
 const EditableNested: Story = {
	render: () => {
		const [value, setValue] = useState('@[Edit this @[and this @[and even this]]]')

		return (
			<>
				<MarkedInput
					Mark={EditableMark}
					value={value}
					onChange={setValue}
					options={[{markup: '@[__nested__]', trigger: '@'}]}
				/>
				<Text label="Raw value:" value={value} />
				<div style={{marginTop: '10px', fontSize: '12px', color: '#666'}}>
					<p>
						<strong>Instructions:</strong> Click inside any mark to edit its content. Nested marks are
						independently editable.
					</p>
				</div>
			</>
		)
	},
}

// ============================================================================
// Example 6: Complex Real-World Example (Rich Text Editor)
// ============================================================================


