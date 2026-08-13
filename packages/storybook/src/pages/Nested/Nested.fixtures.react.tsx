// oxlint-disable jsx_a11y/prefer-tag-over-role -- a nested mark shell can contain interactive children
import type {CSSProperties} from '@markput/core'
import type {MarkProps} from '@markput/react'
import {useMark, useMarkInfo} from '@markput/react'
import type {ElementType} from 'react'
import {useState} from 'react'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Nested.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */

/**
 * The mark props this page's styled stories map to. Declared here rather than in the story
 * file because `children` is a framework type: react's is a `ReactNode`, vue's a `VNodeChild`,
 * and the story's `mark` mappers pass it straight through.
 */
export type StyledMarkProps = MarkProps & {style?: CSSProperties}

export const fixtures = {
	/** The panel sits under the editor here; the vue fixtures put it beside it. */
	SimpleMark: ({children, style, value}: StyledMarkProps) => <span style={style}>{children ?? value}</span>,
	MultiLevelMark: ({children, style, value}: StyledMarkProps) => (
		<span style={{...style, margin: '0 2px'}}>{children ?? value}</span>
	),
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
}

/**
 * What the capturing marks record. A mark can only report a hook's value by writing it
 * somewhere the spec can read, and the spec resets these before each mount.
 */
export const capture = {rootChildren: false, rootHasNestedMarks: false}

/** Spec fixtures: mark components the shared spec mounts through component args. */
export const marks = {
	Info: ({children}: MarkProps) => {
		const info = useMarkInfo()
		return (
			<span
				data-testid={`mark-depth-${info.depth}`}
				data-depth={info.depth}
				data-has-children={info.hasNestedMarks}
			>
				{children}
			</span>
		)
	},
	/** Names itself by depth, so one component covers two markups in the same value. */
	Tagged: ({children}: MarkProps) => {
		const info = useMarkInfo()
		return (
			<span data-testid={info.depth === 0 ? 'tag-mark' : 'mention-mark'} data-depth={info.depth}>
				{children}
			</span>
		)
	},
	Capturing: ({children}: MarkProps) => {
		const info = useMarkInfo()
		if (info.depth === 0 && info.hasNestedMarks) capture.rootChildren = children != null
		return <span data-testid="mark">{children}</span>
	},
	RootInfo: ({children}: MarkProps) => {
		const info = useMarkInfo()
		if (info.depth === 0) capture.rootHasNestedMarks = info.hasNestedMarks
		return <span>{children}</span>
	},
	Depth: ({children}: MarkProps) => {
		const info = useMarkInfo()
		return <span data-depth={info.depth}>{children}</span>
	},
	HasChildren: ({children}: MarkProps) => {
		const info = useMarkInfo()
		return <span data-has-children={info.hasNestedMarks}>{children}</span>
	},
	/** Renders only `value`: the backward-compatibility marks predate nesting. */
	Flat: ({value}: MarkProps) => <span data-testid="flat-mark">{value}</span>,
	Plain: ({children}: MarkProps) => <span data-testid="mark">{children}</span>,
	Bare: ({children}: MarkProps) => <span>{children}</span>,
	Mixed: ({children}: MarkProps) => {
		const info = useMarkInfo()
		return (
			<span data-testid="mark" data-has-children={info.hasNestedMarks}>
				{children}
			</span>
		)
	},
	/** Renders the slot itself when there is nothing nested to render. */
	Rendering: ({children}: MarkProps) => {
		const mark = useMark()
		const info = useMarkInfo()
		return <span data-testid="rendering-mark">{info.hasNestedMarks ? children : mark.slot()}</span>
	},
	/** A `<mark>` root, so the spec can tell mark roots from the spans around them. */
	Testid: ({children, value}: MarkProps) => <mark data-testid="mark">{children ?? value}</mark>,
}