import {Meta, StoryObj} from '@storybook/react-vite'
import {MarkedInput, createMarkedInput, useMark} from 'rc-marked-input'
import type {MarkToken, Markup} from 'rc-marked-input'
import {ReactNode, useState} from 'react'
import {Text} from '../assets/Text'
import {markdownOptions as MarkdownOptions} from './MarkdownOptions'

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
// Example 6: Complex Markdown Document
// ============================================================================

const MarkdownMark = ({
	children,
	value,
	style,
}: {
	value?: string
	children?: ReactNode
	style?: React.CSSProperties
}) => <span style={{...style, margin: '0 1px'}}>{children || value}</span>

const MarkdownInput = createMarkedInput({
	Mark: MarkdownMark,
	options: MarkdownOptions,
})

export const ComplexMarkdown: Story = {
	render: () => {
		const [value, setValue] = useState(`# Welcome to **Marked Input**

This is a *powerful* library for parsing **rich text** with *markdown* formatting.
You can use \`inline code\` snippets like \`const parser = new ParserV2()\` in your text.

## Features

- **Bold text** with **strong emphasis**
- *Italic text* and *emphasis* support
- \`Code snippets\` and \`code blocks\`
- ~~Strikethrough~~ for deleted content
- Links like [GitHub](https://github.com)

## Example

Here's how to use it:

\`\`\`javascript
const parser = new ParserV2(['**__value__**', '*__value__*'])
const result = parser.parse('Hello **world**!')
\`\`\`

Visit our [documentation](https://docs.example.com) for more details.
~~This feature is deprecated~~ and will be removed in v3.0.`)

		return (
			<>
				<MarkdownInput value={value} onChange={setValue} />
				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

// ============================================================================
// Example 7: Complex HTML Document
// ============================================================================

const HtmlDocMark = ({children, value, nested}: {value?: string; children?: ReactNode; nested?: string}) => {
	const tagName = value?.toLowerCase() || 'span'

	// Стили для разных HTML тегов
	const tagStyles: Record<string, React.CSSProperties> = {
		div: {
			display: 'block',
			padding: '10px',
			margin: '5px 0',
			border: '1px solid #e0e0e0',
			borderRadius: '4px',
			backgroundColor: '#fafafa',
		},
		p: {
			display: 'block',
			margin: '8px 0',
			lineHeight: '1.6',
		},
		h1: {
			display: 'block',
			fontSize: '2em',
			fontWeight: 'bold',
			margin: '0.67em 0',
		},
		h2: {
			display: 'block',
			fontSize: '1.5em',
			fontWeight: 'bold',
			margin: '0.75em 0',
		},
		h3: {
			display: 'block',
			fontSize: '1.17em',
			fontWeight: 'bold',
			margin: '0.83em 0',
		},
		strong: {
			fontWeight: 'bold',
		},
		b: {
			fontWeight: 'bold',
		},
		em: {
			fontStyle: 'italic',
		},
		i: {
			fontStyle: 'italic',
		},
		u: {
			textDecoration: 'underline',
		},
		mark: {
			backgroundColor: '#ffeb3b',
			padding: '2px 4px',
		},
		del: {
			textDecoration: 'line-through',
			opacity: 0.7,
		},
		code: {
			fontFamily: 'monospace',
			backgroundColor: '#f5f5f5',
			padding: '2px 6px',
			borderRadius: '3px',
			fontSize: '0.9em',
		},
		pre: {
			display: 'block',
			fontFamily: 'monospace',
			backgroundColor: '#f5f5f5',
			padding: '12px',
			borderRadius: '4px',
			overflow: 'auto',
			margin: '8px 0',
		},
		blockquote: {
			display: 'block',
			borderLeft: '4px solid #ccc',
			paddingLeft: '16px',
			margin: '8px 0',
			fontStyle: 'italic',
			color: '#666',
		},
		ul: {
			display: 'block',
			listStyleType: 'disc',
			paddingLeft: '40px',
			margin: '8px 0',
		},
		ol: {
			display: 'block',
			listStyleType: 'decimal',
			paddingLeft: '40px',
			margin: '8px 0',
		},
		li: {
			display: 'list-item',
			margin: '4px 0',
		},
		a: {
			color: '#1976d2',
			textDecoration: 'underline',
			cursor: 'pointer',
		},
		span: {
			display: 'inline',
		},
		article: {
			display: 'block',
			padding: '20px',
			backgroundColor: '#fff',
			border: '1px solid #ddd',
			borderRadius: '8px',
			margin: '10px 0',
		},
		section: {
			display: 'block',
			margin: '15px 0',
		},
		header: {
			display: 'block',
			padding: '10px',
			backgroundColor: '#f0f0f0',
			borderBottom: '2px solid #ddd',
			marginBottom: '10px',
		},
		footer: {
			display: 'block',
			padding: '10px',
			backgroundColor: '#f0f0f0',
			borderTop: '2px solid #ddd',
			marginTop: '10px',
			fontSize: '0.9em',
			color: '#666',
		},
		small: {
			fontSize: '0.8em',
		},
		sub: {
			fontSize: '0.8em',
			verticalAlign: 'sub',
		},
		sup: {
			fontSize: '0.8em',
			verticalAlign: 'super',
		},
	}

	const Tag = tagName as React.ElementType
	const style = tagStyles[tagName] || {}

	return <Tag style={style}>{children || nested}</Tag>
}

export const ComplexHtmlDocument: Story = {
	render: () => {
		const [value, setValue] = useState(`<article>
<header>
<h1>Understanding <strong>Nested HTML</strong> Structures</h1>
<p><small>Published on <time>November 13, 2025</time></small></p>
</header>

<section>
<h2>Introduction</h2>
<p>This is a <em>comprehensive example</em> of <strong>nested HTML tags</strong> working together. The <code>MarkedInput</code> library can parse and render <mark>complex HTML structures</mark> with multiple levels of nesting.</p>

<blockquote>
<p>HTML nesting allows us to create <strong>rich, semantic documents</strong> that are both <em>readable</em> and <u>well-structured</u>.</p>
</blockquote>
</section>

<section>
<h2>Key Features</h2>
<ul>
<li><strong>Bold text</strong> using <code>&lt;strong&gt;</code> or <code>&lt;b&gt;</code> tags</li>
<li><em>Italic text</em> with <code>&lt;em&gt;</code> or <code>&lt;i&gt;</code> tags</li>
<li><u>Underlined content</u> for emphasis</li>
<li><mark>Highlighted text</mark> to draw attention</li>
<li><del>Strikethrough</del> for deleted content</li>
<li><code>Inline code</code> snippets</li>
</ul>
</section>

<section>
<h2>Advanced Examples</h2>
<h3>Mathematical Notation</h3>
<p>The formula for water is H<sub>2</sub>O, and Einstein's famous equation is E=mc<sup>2</sup>.</p>

<h3>Code Blocks</h3>
<pre><code>function parseHTML(input) {
  return parser.parse(input);
}</code></pre>

<h3>Nested Lists</h3>
<ol>
<li>First level item
<ul>
<li>Second level <strong>nested</strong> item</li>
<li>Another nested item with <em>emphasis</em></li>
</ul>
</li>
<li>Another first level item</li>
</ol>
</section>

<section>
<h2>Complex Nesting</h2>
<div>
<p>Here's a <strong>complex example</strong> with <em>multiple <u>nested <mark>tags</mark></u> inside</em> each other.</p>
<p>You can even have <code>code with <strong>bold</strong> inside</code> or <mark>highlighted <em>italic <u>underlined</u></em> text</mark>.</p>
</div>
</section>

<footer>
<p><small>© 2025 MarkedInput Library. Built with <strong>React</strong> and <em>TypeScript</em>.</small></p>
</footer>
</article>`)

		return (
			<>
				<div style={{maxWidth: '800px', margin: '0 auto'}}>
					<MarkedInput
						Mark={HtmlDocMark}
						value={value}
						onChange={setValue}
						options={[{markup: HtmlMarkup}]}
					/>
				</div>
				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

// ============================================================================
// Example 8: Complex Real-World Example (Rich Text Editor)
// ============================================================================
