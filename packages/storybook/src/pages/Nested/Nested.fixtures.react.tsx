// oxlint-disable jsx_a11y/prefer-tag-over-role -- a nested mark shell can contain interactive children
import type {MarkProps} from '@markput/react'
import {MarkedInput, useMark, useMarkInfo} from '@markput/react'
import type {ElementType} from 'react'
import {useState} from 'react'

import {useTab} from '../../shared/components/Tabs'
import {defineMark} from '../../shared/lib/marks'
import type {PageArgs} from '../../shared/lib/stories'
import {HTML_TAG_STYLES} from './HtmlTagStyles'
import {markdownOptions} from './MarkdownOptions'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Nested.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */

/** `ComplexMarkdown`'s mark: the markdown preset hands it the `style` of whichever markup matched. */
const MarkdownMark = defineMark({tag: 'span', style: {margin: '0 1px'}})

/** `ComplexHtmlDocument`'s mark: this markup's VALUE is the tag name, so the mark IS that element. */
const HtmlDocMark = ({children, value}: MarkProps) => {
	const tagName = value?.toLowerCase() ?? 'span'
	// oxlint-disable-next-line no-unsafe-type-assertion -- this mark's VALUE is the tag name
	const Tag = tagName as ElementType
	const style = HTML_TAG_STYLES[tagName] ?? {}

	return <Tag style={style}>{children}</Tag>
}

const TABS = [
	{value: 'preview', label: 'Preview'},
	{value: 'write', label: 'Write'},
] as const

/**
 * `ComplexMarkdown`'s harness. The harness owns the value: the Write tab is controlled, and
 * without a local writer its `onChange` would land nowhere and the tab would look frozen.
 *
 * The two tabs are two different editors — the preview one is read-only and rendered through
 * the markdown preset, the write one is a plain field over the same string — which is why the
 * options are not simply forwarded from the story's args.
 */
function TabbedMarkdown({defaultValue}: PageArgs) {
	const [value, setValue] = useState(defaultValue)
	const {Tab, activeTab} = useTab(TABS)

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

/** See {@link TabbedMarkdown}: the Write tab is controlled, so the harness has to own the writer. */
function TabbedHtml({defaultValue, options}: PageArgs) {
	const [value, setValue] = useState(defaultValue)
	const {Tab, activeTab} = useTab(TABS)

	return (
		<>
			<Tab />

			{activeTab === 'preview' ? (
				<MarkedInput key={activeTab} Mark={HtmlDocMark} value={value} readOnly={true} options={options} />
			) : (
				<MarkedInput key={activeTab} value={value} onChange={setValue} options={[]} />
			)}
		</>
	)
}

export const fixtures = {
	MultiLevelMark: defineMark({tag: 'span', style: {margin: '0 2px'}}),
	HtmlLikeMark: ({children, value}: MarkProps) => {
		// oxlint-disable-next-line no-unsafe-type-assertion -- this mark's VALUE is the tag name
		const Tag = (value ?? 'span') as ElementType
		return <Tag>{children}</Tag>
	},
	/** The page's only `useMarkInfo()` story in either framework. */
	InteractiveMark: ({children}: MarkProps) => {
		const info = useMarkInfo()
		const [isHighlighted, setIsHighlighted] = useState(false)
		const handleAction = () => {
			console.log('Mark clicked:', {depth: info.depth, hasNestedMarks: info.hasNestedMarks})
		}

		return (
			<span
				role="button"
				tabIndex={0}
				onClick={e => {
					e.stopPropagation()
					handleAction()
				}}
				onKeyDown={e => {
					if (e.key !== 'Enter' && e.key !== ' ') return
					e.preventDefault()
					e.stopPropagation()
					handleAction()
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
				title={`Depth: ${info.depth}, Nested: ${info.hasNestedMarks}`}
			>
				{children}
			</span>
		)
	},
	renderTabbedMarkdown: (args: PageArgs) => <TabbedMarkdown {...args} />,
	renderTabbedHtml: (args: PageArgs) => <TabbedHtml {...args} />,
}

/**
 * What the capturing marks record. A mark can only report a hook's value by writing it
 * somewhere the spec can read, and the spec resets these before each mount.
 */
export const capture = {rootChildren: false, rootHasNestedMarks: false}

/** Spec fixtures: mark components the shared spec mounts through component args. */
export const marks = {
	/**
	 * Reports both `useMarkInfo()` readings as attributes, which is how the spec finds a mark AND
	 * asserts on it: `[data-depth="1"]` identifies without a test-only id.
	 */
	Info: ({children}: MarkProps) => {
		const info = useMarkInfo()
		return (
			<span data-depth={info.depth} data-has-children={info.hasNestedMarks}>
				{children}
			</span>
		)
	},
	/** Reports the root mark's hook readings into {@link capture}, which the spec reads back. */
	Capture: ({children}: MarkProps) => {
		const info = useMarkInfo()
		if (info.depth === 0) {
			capture.rootHasNestedMarks = info.hasNestedMarks
			if (info.hasNestedMarks) capture.rootChildren = children != null
		}
		return <span>{children}</span>
	},
	/** Renders the slot itself when there is nothing nested to render. */
	Rendering: ({children}: MarkProps) => {
		const mark = useMark()
		const info = useMarkInfo()
		return <span>{info.hasNestedMarks ? children : mark.slot()}</span>
	},
}