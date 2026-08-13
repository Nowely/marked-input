import type {CSSProperties, Markup} from '@markput/core'
import type {MarkProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {ElementType} from 'react'
import {useState} from 'react'

import {useTab} from '../../shared/components/Tabs'
import {COMPLEX_MARKDOWN} from '../../shared/lib/sampleTexts'
import {component, story, type PageMeta} from '../../shared/lib/stories'
import {markdownOptions} from './MarkdownOptions'

/**
 * The react-only half of this page. `Nested.stories.ts` carries the four cross-framework
 * stories and the same `title`, so the two files land on one docs entry here and the vue
 * instance never sees this one: both documents below render through `shared/components/Tabs`,
 * which is a React component.
 */

const HtmlMarkup: Markup = '<__value__>__slot__</__value__>'

const HTML_DOCUMENT = `<article>
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
</article>`

interface MarkdownMarkProps extends MarkProps {
	style?: CSSProperties
}

const MarkdownMark = ({children, value, style}: MarkdownMarkProps) => (
	<span style={{...style, margin: '0 1px'}}>{children ?? value}</span>
)

function TabbedMarkdownView({defaultValue}: {defaultValue: string}) {
	// The story owns the value: the Write tab is controlled, and without a local writer its
	// `onChange` would land nowhere and the tab would look frozen.
	const [value, setValue] = useState(defaultValue)
	const {Tab, activeTab} = useTab([
		{value: 'preview', label: 'Preview'},
		{value: 'write', label: 'Write'},
	])

	return (
		<>
			<Tab />

			{activeTab === 'preview' ? (
				<MarkedInput Mark={MarkdownMark} options={markdownOptions} value={value} readOnly={true} />
			) : (
				<MarkedInput options={[]} value={value} onChange={setValue} />
			)}
		</>
	)
}

const HTML_TAG_STYLES: Record<string, CSSProperties> = {
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

const HtmlDocMark = ({children, value}: MarkProps) => {
	const tagName = value?.toLowerCase() ?? 'span'
	// oxlint-disable-next-line no-unsafe-type-assertion -- this mark's VALUE is the tag name
	const Tag = tagName as ElementType
	const style = HTML_TAG_STYLES[tagName] ?? {}

	return <Tag style={style}>{children}</Tag>
}

function TabbedHtmlView({defaultValue}: {defaultValue: string}) {
	// See TabbedMarkdownView: the Write tab is controlled, so the story has to own the writer.
	const [value, setValue] = useState(defaultValue)
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
				<MarkedInput key={activeTab} value={value} onChange={setValue} options={[]} />
			)}
		</>
	)
}

/**
 * Every named export of a CSF file is indexed as a story, so this file exports stories and
 * nothing else — page constants stay module-private.
 */
export default {
	title: 'MarkedInput/Nested',
	tags: ['autodocs'],
	component,
} satisfies PageMeta

export const ComplexMarkdown = story({
	args: {defaultValue: COMPLEX_MARKDOWN},
	render: args => <TabbedMarkdownView defaultValue={args.defaultValue!} />,
})

export const ComplexHtmlDocument = story({
	args: {defaultValue: HTML_DOCUMENT},
	render: args => <TabbedHtmlView defaultValue={args.defaultValue!} />,
})