import type {MarkProps, MarkedInputProps, Markup} from '@markput/react'
import {MarkedInput, useMark} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import type {CSSProperties} from 'react'
import {useState} from 'react'

import {useTab} from '../../shared/components/Tabs'
import {COMPLEX_MARKDOWN} from '../../shared/lib/sampleTexts'
import {markdownOptions as MarkdownOptions} from './MarkdownOptions'

const meta = {
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

export default meta
type Story = StoryObj<typeof meta>

// ============================================================================
// Example 1: Simple Nesting (Markdown-style)
// ============================================================================

const BoldMarkup: Markup = '**__slot__**'
const ItalicMarkup: Markup = '*__slot__*'

interface SimpleMarkProps extends MarkProps {
	style?: CSSProperties
}

const SimpleMark = ({children, style, value}: SimpleMarkProps) => <span style={style}>{children ?? value}</span>

export const SimpleNesting: StoryObj<MarkedInputProps<SimpleMarkProps>> = {
	args: {
		Mark: SimpleMark,
		value: 'This is *italic text with **bold** inside* and more text.',
		options: [
			{
				markup: BoldMarkup,
				mark: ({value, children}: MarkProps) => ({
					value,
					children,
					style: {fontWeight: 'bold'},
				}),
			},
			{
				markup: ItalicMarkup,
				mark: ({value, children}: MarkProps) => ({
					value,
					children,
					style: {fontStyle: 'italic'},
				}),
			},
		],
	},
}

// ============================================================================
// Example 2: Multiple Nesting Levels
// ============================================================================

const TagMarkup: Markup = '#[__slot__]'
const MentionMarkup: Markup = '@[__slot__]'
const CodeMarkup: Markup = '`__slot__`'

interface MultiLevelMarkProps extends MarkProps {
	style?: CSSProperties
}

const MultiLevelMark = ({children, style, value}: MultiLevelMarkProps) => (
	<span style={{...style, margin: '0 2px'}}>{children ?? value}</span>
)

export const MultipleLevels: StoryObj<MarkedInputProps<MultiLevelMarkProps>> = {
	args: {
		Mark: MultiLevelMark,
		value: 'Check #[this tag with @[nested mention with `code`]] and #[another #[deeply nested] tag]',
		options: [
			{
				markup: TagMarkup,
				mark: ({value, children}: MarkProps) => ({
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
				mark: ({value, children}: MarkProps) => ({
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
				mark: ({value, children}: MarkProps) => ({
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
		],
	},
}

// ============================================================================
// Example 3: HTML-like Tags
// ============================================================================

const HtmlMarkup: Markup = '<__value__>__slot__</__value__>'

const HtmlLikeMark = ({children, value}: MarkProps) => {
	const Tag = value! as React.ElementType
	return <Tag>{children}</Tag>
}

export const HtmlLikeTags: StoryObj<MarkedInputProps> = {
	args: {
		Mark: HtmlLikeMark,
		value: '<div>This is a div with <mark>a mark inside</mark> and <b>bold text with <del>nested del</del></b></div>',
		options: [{markup: HtmlMarkup}],
	},
}

// ============================================================================
// Example 4: Interactive Nested Marks with Tree Navigation
// ============================================================================

const InteractiveMark = ({children}: MarkProps) => {
	const mark = useMark()
	const [isHighlighted, setIsHighlighted] = useState(false)

	return (
		<span
			onClick={e => {
				e.stopPropagation()
				console.log('Mark clicked:', {
					depth: mark.depth,
					hasChildren: mark.hasChildren,
					childrenCount: mark.tokens.length,
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
			title={`Depth: ${mark.depth}, Children: ${mark.tokens.length}`}
		>
			{children}
		</span>
	)
}

export const InteractiveNested: StoryObj<MarkedInputProps> = {
	args: {
		Mark: InteractiveMark,
		value: '@[Click me @[or me @[or even me]]]',
		options: [{markup: '@[__slot__]'}],
	},
}

// ============================================================================
// Example 6: Complex Markdown Document
// ============================================================================

interface MarkdownMarkProps extends MarkProps {
	style?: CSSProperties
}

const MarkdownMark = ({children, value, style}: MarkdownMarkProps) => (
	<span style={{...style, margin: '0 1px'}}>{children ?? value}</span>
)

function TabbedMarkdownView({value, onChange}: {value: string; onChange?: (v: string) => void}) {
	const {Tab, activeTab} = useTab([
		{value: 'preview', label: 'Preview'},
		{value: 'write', label: 'Write'},
	])

	return (
		<>
			<Tab />

			{activeTab === 'preview' ? (
				<MarkedInput Mark={MarkdownMark} options={MarkdownOptions} value={value} readOnly={true} />
			) : (
				<MarkedInput options={[]} value={value} onChange={onChange} />
			)}
		</>
	)
}

export const ComplexMarkdown: Story = {
	args: {
		value: COMPLEX_MARKDOWN,
	},
	render: args => <TabbedMarkdownView value={args.value!} onChange={args.onChange} />,
}

// ============================================================================
// Example 7: Complex HTML Document
// ============================================================================

const HtmlDocMark = ({children, value}: MarkProps) => {
	const tagName = value?.toLowerCase() ?? 'span'

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
	const style = tagStyles[tagName] ?? {}

	return <Tag style={style}>{children}</Tag>
}

function TabbedHtmlView({value, onChange}: {value: string; onChange?: (v: string) => void}) {
	const {Tab, activeTab} = useTab([
		{value: 'preview', label: 'Preview'},
		{value: 'write', label: 'Write'},
	])

	return (
		<>
			<Tab />

			{activeTab === 'preview' ? (
				<MarkedInput
					key={activeTab}
					Mark={HtmlDocMark}
					value={value}
					readOnly={true}
					options={[{markup: HtmlMarkup}]}
				/>
			) : (
				<MarkedInput key={activeTab} value={value} onChange={onChange} options={[]} />
			)}
		</>
	)
}

export const ComplexHtmlDocument: Story = {
	args: {
		value: `<article>
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
</article>`,
	},
	render: args => <TabbedHtmlView value={args.value!} onChange={args.onChange} />,
}