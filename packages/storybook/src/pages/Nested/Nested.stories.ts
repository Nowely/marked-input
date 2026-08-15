import type {Markup} from '@markput/core'

import type {StyledMarkProps} from '../../shared/lib/marks'
import {Span} from '../../shared/lib/marks'
import {COMPLEX_MARKDOWN} from '../../shared/lib/sampleTexts'
import {component, story, type PageMeta} from '../../shared/lib/stories'
import {fixtures} from './Nested.fixtures'

const BoldMarkup: Markup = '**__slot__**'
const ItalicMarkup: Markup = '*__slot__*'

const TagMarkup: Markup = '#[__slot__]'
const MentionMarkup: Markup = '@[__slot__]'
const CodeMarkup: Markup = '`__slot__`'

const HtmlMarkup: Markup = '<__value__>__slot__</__value__>'

const SIMPLE_VALUE = 'This is *italic text with **bold** inside* and more text.'

const MULTI_LEVEL_VALUE = 'Check #[this tag with @[nested mention with `code`]] and #[another #[deeply nested] tag]'

const HTML_VALUE =
	'<div>This is a div with <mark>a mark inside</mark> and <b>bold text with <del>nested del</del></b></div>'

const INTERACTIVE_VALUE = '@[Click me @[or me @[or even me]]]'

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

/**
 * Every named export of a CSF file is indexed as a story, so this file exports stories and
 * nothing else — page constants stay module-private.
 */
export default {
	title: 'MarkedInput/Nested',
	tags: ['autodocs'],
	component,
	parameters: {
		docs: {
			description: {
				component:
					'Examples demonstrating nested marks support. Nested marks allow creating rich, hierarchical text structures.',
			},
		},
	},
} satisfies PageMeta

export const SimpleNesting = story<StyledMarkProps>({
	args: {
		Mark: Span,
		value: SIMPLE_VALUE,
		options: [
			{markup: BoldMarkup, mark: ({value, children}) => ({value, children, style: {fontWeight: 'bold'}})},
			{markup: ItalicMarkup, mark: ({value, children}) => ({value, children, style: {fontStyle: 'italic'}})},
		],
	},
	parameters: {plainValue: 'right'},
})

export const MultipleLevels = story<StyledMarkProps>({
	args: {
		Mark: fixtures.MultiLevelMark,
		value: MULTI_LEVEL_VALUE,
		options: [
			{
				markup: TagMarkup,
				mark: ({value, children}) => ({
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
				mark: ({value, children}) => ({
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
				mark: ({value, children}) => ({
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
	parameters: {plainValue: 'right'},
})

export const HtmlLikeTags = story({
	args: {Mark: fixtures.HtmlLikeMark, value: HTML_VALUE, options: [{markup: HtmlMarkup}]},
	parameters: {plainValue: 'right'},
})

export const InteractiveNested = story({
	args: {Mark: fixtures.InteractiveMark, defaultValue: INTERACTIVE_VALUE, options: [{markup: MentionMarkup}]},
})

/**
 * The two tabbed documents. Each renders through a harness that owns the value, because its
 * Write tab is a controlled field: `render` is the fixture, so the harness is the only part of
 * the story that has to be written twice.
 */
export const ComplexMarkdown = story({
	args: {defaultValue: COMPLEX_MARKDOWN},
	render: fixtures.renderTabbedMarkdown,
})

export const ComplexHtmlDocument = story({
	args: {defaultValue: HTML_DOCUMENT, options: [{markup: HtmlMarkup}]},
	render: fixtures.renderTabbedHtml,
})