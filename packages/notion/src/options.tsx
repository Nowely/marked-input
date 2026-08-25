import type {Option, RowProps} from '@markput/react'
import {useControlRef} from '@markput/react'
import type {ReactNode} from 'react'
import {useCallback, useEffect, useRef, useState} from 'react'

import {Due, Effort, Highlight, Link, Mention, Status, Who} from './marks'
import {theme} from './theme'
import {Avatar} from './ui/Avatar'
import {AvatarStack} from './ui/AvatarStack'
import {Board} from './ui/Board'
import {BookmarkCard} from './ui/BookmarkCard'
import type {CalloutTone} from './ui/Callout'
import {Callout} from './ui/Callout'
import {CardGrid} from './ui/CardGrid'
import type {ChipTone} from './ui/Chip'
import {Chip} from './ui/Chip'
import {CommentThread} from './ui/CommentThread'
import {MetricCard} from './ui/MetricCard'
import {PropertiesPanel} from './ui/PropertiesPanel'
import {ViewTabs} from './ui/ViewTabs'

import rows from './rows.module.css'

/**
 * THE PACKAGE. Every block kind in `docs/scratch/notion-like/showcase.md` is one entry of the
 * array at the bottom of this file, and each entry is `{markup, row, menu}` — the markup says
 * what a line of the document looks like, `row.Component` says what it paints, and `menu` is the
 * whole of its registration in the `/` menu.
 *
 * Two things nothing here does, which is the point: it never reaches into `@markput/core`'s
 * internals and it never touches `store.edit` or `store.tokens`. A row's own verbs arrive on
 * `RowProps.node`, and a control that must not be document content takes `useControlRef()`.
 *
 * A kind's component is a SLOT component: it spreads `ref`, `className` and `style` onto the one
 * element it renders. Dropping the ref leaves the row unbound and the caret cannot resolve into
 * it.
 */

const cls = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

const CHIP_TONES: ChipTone[] = ['grey', 'red', 'amber', 'green', 'blue', 'purple']

/** A tone the document names wrongly is drawn grey rather than dropping what carries it. */
const chipTone = (name: string): ChipTone => CHIP_TONES.find(tone => tone === name) ?? 'grey'

/**
 * A kind whose component paints no `{children}` is an ATOMIC row: its text round-trips, it drags
 * and selects as a row, and the caret cannot enter it — there is no surface to enter. Every card
 * below is one, because the leaves they render take strings rather than nodes, and Notion's own
 * bookmark, board and properties panel behave the same way.
 */

/* ── page furniture ─────────────────────────────────────────────────────── */

export const title: Option = {
	markup: '@title __slot__',
	row: {
		Component: ({children, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, rows.title)} style={style}>
				{children}
			</div>
		),
	},
	menu: {label: 'Page title', keywords: ['title', 'name']},
}

export const caption: Option = {
	markup: '@caption __slot__',
	row: {
		Component: ({children, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, rows.caption)} style={style}>
				{children}
			</div>
		),
	},
	menu: {label: 'Caption', keywords: ['small', 'muted']},
}

/**
 * The page properties. A CLOSED kind with a RAW body, so its interior keeps its newlines and is
 * never re-parsed — the panel reads its own `key: value` lines, exactly as a YAML block is read.
 *
 * `'---\n'` is a LONGER opener than `'---'`, so a `---` line that finds a matching close below it
 * is frontmatter and a lone one is a divider. That collision is deliberate and the ordering is
 * what resolves it.
 */
export const properties: Option = {
	markup: '---\n__value__\n---',
	row: {
		Component: ({node, ref, className, style}: RowProps) => (
			<div ref={ref} className={className} style={style}>
				<PropertiesPanel properties={readProperties(node.slot())} />
			</div>
		),
	},
	menu: {label: 'Page properties', keywords: ['frontmatter', 'meta']},
}

/** `Name: value`, where a value is one or more comma-separated cells of the small vocabulary below. */
function readProperties(source: string): {name: string; value: ReactNode}[] {
	return source
		.split('\n')
		.map(line => /^([^:]+):\s*(.*)$/.exec(line))
		.filter(match => match !== null)
		.map(([, name = '', raw = '']) => ({name, value: readPropertyValue(raw)}))
}

function readPropertyValue(raw: string): ReactNode {
	return raw.split(', ').map(cell => <span key={cell}>{readPropertyCell(cell)}</span>)
}

function readPropertyCell(cell: string): ReactNode {
	const [kind = '', ...rest] = cell.split(':')
	const argument = rest.join(':')
	if (kind === 'chip') {
		const [tone = '', ...label] = argument.split(':')
		return <Chip tone={chipTone(tone)}>{label.join(':')}</Chip>
	}
	if (kind === 'person') {
		return (
			<>
				<Avatar name={argument} />
				{argument}
			</>
		)
	}
	if (kind === 'people') return <AvatarStack max={3} names={argument.split(', ')} />
	if (kind === 'link') {
		const [label = '', ...url] = argument.split(' ')
		return (
			<span className={theme.link} title={url.join(' ')}>
				{label}
			</span>
		)
	}
	return cell
}

/**
 * The rule is an EMPTY SIBLING of the row's own line rather than the line itself: the theme draws
 * a divider as a zero-height border, and a row with no line box is a row the caret cannot stand
 * on. The row's own (normally empty) text stays after it.
 */
export const divider: Option = {
	markup: '---__slot__',
	row: {
		Component: ({children, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, rows.divider)} style={style}>
				<span className={rows.dividerRule} />
				{children}
			</div>
		),
	},
	menu: {label: 'Divider', keywords: ['hr', 'rule', 'line']},
}

/** The page's own headings, listed by hand. Which heading exists is a fact about other rows. */
export const toc: Option = {
	markup: '@toc\n__value__\n@end',
	row: {
		Component: ({node, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, rows.toc)} style={style}>
				{node
					.slot()
					.split('\n')
					.map(entry => (
						<span
							className={
								entry.startsWith('\t') ? theme.tableOfContentsItemNested : theme.tableOfContentsItem
							}
							key={entry}
						>
							{entry.trim()}
						</span>
					))}
			</div>
		),
	},
	menu: {label: 'Table of contents', keywords: ['toc', 'outline']},
}

/* ── prose ──────────────────────────────────────────────────────────────── */

const heading = (className: string) =>
	function Heading({children, ref, style}: RowProps) {
		return (
			<div ref={ref} className={className} style={style}>
				{children}
			</div>
		)
	}

export const h1: Option = {
	markup: '# __slot__',
	row: {Component: heading(rows.heading1)},
	menu: {label: 'Heading 1', keywords: ['h1', 'title']},
}

export const h2: Option = {
	markup: '## __slot__',
	row: {Component: heading(rows.heading2)},
	menu: {label: 'Heading 2', keywords: ['h2']},
}

export const h3: Option = {
	markup: '### __slot__',
	row: {Component: heading(rows.heading3)},
	menu: {label: 'Heading 3', keywords: ['h3']},
}

export const quote: Option = {
	markup: '> __slot__',
	row: {
		continues: true,
		indents: true,
		Component: ({children, rows: childRows, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, rows.quote)} style={style}>
				{children}
				{childRows}
			</div>
		),
	},
	menu: {label: 'Quote', keywords: ['blockquote', 'cite']},
}

const CALLOUT_ICON: Record<string, string> = {
	neutral: '💡',
	info: 'ℹ️',
	success: '✅',
	warning: '⚠️',
	danger: '🚨',
}

const CALLOUT_TONES: CalloutTone[] = ['neutral', 'info', 'success', 'warning', 'danger']

/** A tone the document names wrongly is drawn neutral rather than dropping the row. */
const calloutTone = (name: string): CalloutTone => CALLOUT_TONES.find(tone => tone === name) ?? 'neutral'

/**
 * `'> [!tone] '` is a LONGER opener than `'> '`, so a callout wins over a quote without either
 * declaring anything about the other. Clicking the icon cycles the tone, which is a `turnInto`
 * onto the same kind with a different `meta` — the row keeps its id, its text and its caret.
 */
export const callout: Option = {
	markup: '> [!__meta__] __slot__',
	row: {
		continues: true,
		indents: true,
		Component: ({meta = 'neutral', children, rows: childRows, node, ref, className, style}: RowProps) => {
			const controlRef = useControlRef()
			const next = CALLOUT_TONES[(CALLOUT_TONES.indexOf(calloutTone(meta)) + 1) % CALLOUT_TONES.length]
			return (
				<div ref={ref} className={className} style={style}>
					<Callout
						icon={
							<button
								className={theme.calloutIcon}
								onClick={() => node.turnInto(callout, {meta: next})}
								ref={controlRef}
								type="button"
							>
								{CALLOUT_ICON[meta] ?? CALLOUT_ICON.neutral}
							</button>
						}
						tone={calloutTone(meta)}
					>
						{children}
						{childRows}
					</Callout>
				</div>
			)
		},
	},
	menu: {label: 'Callout', keywords: ['note', 'warning', 'aside'], meta: 'warning'},
}

const LANGUAGES = ['bash', 'ts', 'json', 'sql']

/**
 * A closed kind with a RAW body: the fence's interior keeps its newlines and no markup inside it
 * is matched, which is what a code block means. Enter inside it writes a newline rather than
 * splitting the row, and that falls out of the compiled kind rather than being declared.
 */
export const code: Option = {
	markup: '```__meta__\n__value__\n```',
	row: {
		Component: ({meta = 'bash', children, node, ref, className, style}: RowProps) => {
			const controlRef = useControlRef()
			return (
				<div ref={ref} className={cls(className, rows.code)} style={style}>
					<select
						className={rows.codeLanguage}
						onChange={event => node.turnInto(code, {meta: event.target.value})}
						ref={controlRef}
						value={meta}
					>
						{LANGUAGES.map(language => (
							<option key={language}>{language}</option>
						))}
					</select>
					{children}
				</div>
			)
		},
	},
	menu: {label: 'Code', keywords: ['fence', 'snippet', 'bash'], meta: 'bash'},
}

/* ── lists ──────────────────────────────────────────────────────────────── */

export const bullet: Option = {
	markup: '- __slot__',
	row: {
		continues: true,
		indents: true,
		Component: ({children, rows: childRows, depth, ref, className, style}: RowProps) => {
			const controlRef = useControlRef()
			return (
				<div ref={ref} className={cls(className, rows.listItem)} style={style}>
					<span className={depth > 0 ? theme.listBulletHollow : theme.listBullet} ref={controlRef} />
					{children}
					{childRows}
				</div>
			)
		},
	},
	menu: {label: 'Bulleted list', keywords: ['ul', 'list', 'bullet']},
}

export const numbered: Option = {
	markup: '1. __slot__',
	row: {
		continues: true,
		indents: true,
		Component: ({children, rows: childRows, ref, className, style}: RowProps) => {
			const controlRef = useControlRef()
			return (
				<div ref={ref} className={cls(className, rows.numbered)} style={style}>
					<span className={rows.ordinal} ref={controlRef} />
					{children}
					{childRows}
				</div>
			)
		},
	},
	menu: {label: 'Numbered list', keywords: ['ol', 'ordered', 'number']},
}

/** `'- [x] '` is a longer opener than `'- '`, so a to-do wins over a bullet. */
export const todo: Option = {
	markup: '- [__meta__] __slot__',
	row: {
		continues: true,
		indents: true,
		Component: ({meta, children, rows: childRows, node, ref, className, style}: RowProps) => {
			const controlRef = useControlRef()
			const done = meta === 'x'
			return (
				<div ref={ref} className={cls(className, rows.todo)} style={style}>
					<input
						checked={done}
						className={rows.todoBox}
						onChange={event => node.turnInto(todo, {meta: event.target.checked ? 'x' : ' '})}
						ref={controlRef}
						type="checkbox"
					/>
					<span className={done ? rows.todoDone : undefined}>{children}</span>
					{childRows}
				</div>
			)
		},
	},
	menu: {label: 'To-do list', keywords: ['todo', 'task', 'check'], meta: ' '},
}

/**
 * THE COLLAPSED TOGGLE, and the one design question this page had to answer.
 *
 * A row that is not painted has left the DOM layer and taken its anchors with it, so a toggle
 * that renders no children when closed is a caret defect: `End`, select-all and every arrow that
 * resolves through the last row walk into a row with no element. The children are therefore
 * always rendered, and `hidden` is what closes them.
 *
 * `hidden="until-found"` rather than plain `hidden`, because plain `hidden` loses three things a
 * user expects: find-in-page cannot see the closed text, the browser cannot scroll to it, and a
 * match cannot open the toggle. `until-found` keeps the subtree searchable, fires `beforematch`
 * when a search lands inside it, and this component opens itself there. What it still costs is
 * the caret: a closed subtree generates no boxes, so arrowing down from the title jumps over it
 * to the next visible row — which is Notion's own behaviour, and the price of not unmounting.
 *
 * The open flag is the CONSUMER'S state, keyed by nothing: the component is keyed by the row's
 * published `node.id` and a row keeps its id across a retype, so `useState` here survives a
 * turn-into. It does not survive a drop into a DIFFERENT parent — that re-parents the element
 * between two framework parents and neither adapter can carry a component instance across it.
 */
export const toggle: Option = {
	markup: '▸ __slot__',
	row: {
		continues: true,
		indents: true,
		Component: ({children, rows: childRows, ref, className, style}: RowProps) => {
			const controlRef = useControlRef()
			const [open, setOpen] = useState(false)
			// `beforematch` reaches no synthetic event system and `until-found` is a value React's
			// `hidden` typing does not carry, so the closed state is written straight onto the
			// element. The listener is attached once, on mount, and released with it.
			const body = useRef<HTMLElement | null>(null)
			const bodyRef = useCallback((element: HTMLElement | null) => {
				body.current = element
				if (!element) return undefined
				const reveal = () => setOpen(true)
				element.addEventListener('beforematch', reveal)
				return () => element.removeEventListener('beforematch', reveal)
			}, [])
			useEffect(() => {
				if (open) body.current?.removeAttribute('hidden')
				else body.current?.setAttribute('hidden', 'until-found')
			}, [open])
			return (
				<div ref={ref} className={cls(className, rows.toggle)} style={style}>
					<button
						aria-expanded={open}
						aria-label={open ? 'Collapse' : 'Expand'}
						className={open ? theme.toggleArrowOpen : theme.toggleArrow}
						onClick={() => setOpen(!open)}
						ref={controlRef}
						type="button"
					/>
					{children}
					<div className={rows.toggleBody} ref={bodyRef}>
						{childRows}
					</div>
				</div>
			)
		},
	},
	menu: {label: 'Toggle list', keywords: ['collapse', 'details', 'fold']},
}

/* ── the inline database ────────────────────────────────────────────────── */

/**
 * A CELL: an anonymous kind, which nothing scans and which exists only as a line's split target.
 * Its structural bytes are the delimiter it was carved at, and it holds ordinary inline content,
 * so a chip, an avatar or a mention inside a cell is a mark like any other.
 */
export const cell: Option = {
	row: {
		Component: ({children, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, rows.tableCell)} style={style}>
				{children}
			</div>
		),
	},
}

export const headerCell: Option = {
	row: {
		Component: ({children, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, rows.tableHeadCell)} style={style}>
				{children}
			</div>
		),
	},
}

/**
 * ONE LINE of the inline database. Consecutive `display: table-row` siblings are wrapped by CSS
 * in a single anonymous table box, which is what aligns the columns of a run of lines without a
 * wrapper element existing anywhere in the tree.
 *
 * The HEADER is a kind of its own rather than "the first line of a run": a row is recognised by
 * its own first bytes alone, and which line is the header is a fact about the line after it.
 * `'|= '` is a longer opener than `'| '`, so the two never compete.
 */
export const tableHeader: Option = {
	markup: '|= __slot__',
	row: {
		split: {at: ' | ', as: headerCell},
		Component: ({rows: childRows, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, rows.tableHeadLine)} style={style}>
				{childRows}
			</div>
		),
	},
	menu: {label: 'Table', keywords: ['database', 'grid', 'table'], text: 'Task | Status | Owner | Due | Effort'},
}

export const tableLine: Option = {
	markup: '| __slot__',
	row: {
		continues: true,
		split: {at: ' | ', as: cell},
		Component: ({rows: childRows, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, rows.tableLine)} style={style}>
				{childRows}
			</div>
		),
	},
	menu: {label: 'Table row', keywords: ['database', 'record', 'row']},
}

/**
 * The database's footer. `'|+ '` beats both table openers, and the row's own text is the summary
 * — a count a component could not derive, since a row sees only itself.
 */
export const tableFooter: Option = {
	markup: '|+ __slot__',
	row: {
		Component: ({children, ref, className, style}: RowProps) => {
			const controlRef = useControlRef()
			return (
				<div ref={ref} className={cls(className, rows.tableFooterLine)} style={style}>
					<button className={theme.tableFooterAction} ref={controlRef} type="button">
						+ New
					</button>
					<span className={theme.tableFooterSummary}>{children}</span>
				</div>
			)
		},
	},
	menu: {label: 'Table footer', keywords: ['count', 'summary']},
}

/** The view bar above a database. Its active tab is view state and belongs to nobody else. */
export const views: Option = {
	markup: '@views __slot__',
	row: {
		Component: ({node, ref, className, style}: RowProps) => {
			const controlRef = useControlRef()
			const tabs = node.slot().split('|')
			const [active, setActive] = useState(tabs[0] ?? '')
			return (
				<div className={className} ref={ref} style={style}>
					<span ref={controlRef}>
						<ViewTabs active={active} onSelect={setActive} tabs={tabs} />
					</span>
				</div>
			)
		},
	},
	menu: {label: 'View tabs', keywords: ['database', 'views', 'tabs']},
}

/* ── the board ──────────────────────────────────────────────────────────── */

/**
 * The board is ONE row whose raw body describes its columns, and its cards drag between columns
 * through the `Board` component's own state — which `showcase.md` assigns to the consumer.
 *
 * Not nested rows, and the reason is measured rather than aesthetic: the editor's own row drag
 * resolves a drop by the pointer's Y through a vertical tiling of the document, and a board's
 * columns share one Y span. Cross-axis hit-testing is out of scope by ADR, so columns-as-rows
 * would offer a drag that lands in an arbitrary column.
 */
export const board: Option = {
	markup: '@board\n__value__\n@end',
	row: {
		Component: ({node, ref, className, style}: RowProps) => {
			const controlRef = useControlRef()
			return (
				<div className={className} ref={ref} style={style}>
					<span ref={controlRef}>
						<Board columns={readBoard(node.slot())} />
					</span>
				</div>
			)
		},
	},
	menu: {label: 'Board', keywords: ['kanban', 'database', 'columns']},
}

type BoardColumn = {
	id: string
	title: string
	cards: {id: string; title: string; tag?: {label: string; tone: ChipTone}}[]
}

/** A line starting with `'- '` is a card of the column above it; any other line opens a column. */
function readBoard(source: string): BoardColumn[] {
	const columns: BoardColumn[] = []
	let current: BoardColumn | undefined
	for (const line of source.split('\n')) {
		if (!line.startsWith('- ')) {
			current = {id: line, title: line, cards: []}
			columns.push(current)
			continue
		}
		if (!current) continue
		const [title = '', tag = ''] = line.slice(2).split('|')
		const [tone = '', label = ''] = tag.split(':')
		current.cards.push({id: title, title, ...(tag ? {tag: {label, tone: chipTone(tone)}} : {})})
	}
	return columns
}

/* ── metrics, bookmark, comments ────────────────────────────────────────── */

export const metrics: Option = {
	markup: '@metrics\n__value__\n@end',
	row: {
		Component: ({node, ref, className, style}: RowProps) => (
			<div className={className} ref={ref} style={style}>
				<CardGrid>
					{node
						.slot()
						.split('\n')
						.map(line => {
							const [label = '', value = ''] = line.split('|')
							return <MetricCard key={label} label={label} value={value} />
						})}
				</CardGrid>
			</div>
		),
	},
	menu: {label: 'Metric cards', keywords: ['metrics', 'stats', 'numbers']},
}

/** `meta` is `url|description`; the row's own text is the card's title. */
export const bookmark: Option = {
	markup: '@bookmark(__meta__) __slot__',
	row: {
		Component: ({meta = '', node, ref, className, style}: RowProps) => {
			const [url = '', description = ''] = meta.split('|')
			return (
				<div className={className} ref={ref} style={style}>
					<BookmarkCard description={description} title={node.slot()} url={url} />
				</div>
			)
		},
	},
	menu: {label: 'Bookmark', keywords: ['link', 'preview', 'url']},
}

export const comments: Option = {
	markup: '@comments\n__value__\n@end',
	row: {
		Component: ({node, ref, className, style}: RowProps) => {
			const controlRef = useControlRef()
			return (
				<div className={className} ref={ref} style={style}>
					<span ref={controlRef}>
						<CommentThread
							comments={node
								.slot()
								.split('\n')
								.map(line => {
									const [author = '', timestamp = '', body = ''] = line.split('|')
									return {author, timestamp, body}
								})}
						/>
					</span>
				</div>
			)
		},
	},
	menu: {label: 'Comment thread', keywords: ['comment', 'discussion', 'reply']},
}

/* ── the paragraph, which is the row with NO kind ───────────────────────── */

/**
 * `slots.block` is the paragraph component and the only fallback left. It carries the
 * placeholder as an attribute the theme reads, and CSS decides when to show it: an empty row is
 * one whose only surface holds no text, which no component can be told.
 */
export const Paragraph = ({
	children,
	ref,
	className,
	style,
}: {
	children?: ReactNode
	ref?: RowProps['ref']
	className?: string
	style?: RowProps['style']
}) => (
	<div className={cls(className, rows.paragraph)} data-placeholder="Type / for commands…" ref={ref} style={style}>
		{children}
	</div>
)

/* ── inline marks ───────────────────────────────────────────────────────── */

export const mention: Option = {markup: '@[__value__](__meta__)', Mark: Mention}
export const link: Option = {markup: '[__value__](__meta__)', Mark: Link}
export const highlight: Option = {markup: '==__slot__==', Mark: Highlight}
export const status: Option = {markup: '<status:__value__>', Mark: Status}
export const who: Option = {markup: '<who:__value__>', Mark: Who}
export const due: Option = {markup: '<due:__value__>', Mark: Due}
export const effort: Option = {markup: '<bar:__value__>', Mark: Effort}

/**
 * ONE ARRAY, row kinds and marks together. Order does not decide inline matching — every static
 * segment goes into one alternation sorted by literal length and the earliest-starting match
 * wins — and among row kinds a longer opener always wins, whatever the order. What the index DOES
 * decide is which component a match resolves to, and which option owns a trigger character.
 */
export const notionOptions: Option[] = [
	title,
	caption,
	properties,
	divider,
	toc,
	h1,
	h2,
	h3,
	quote,
	callout,
	code,
	bullet,
	numbered,
	todo,
	toggle,
	cell,
	headerCell,
	tableHeader,
	tableLine,
	tableFooter,
	views,
	board,
	metrics,
	bookmark,
	comments,
	mention,
	link,
	highlight,
	status,
	who,
	due,
	effort,
]