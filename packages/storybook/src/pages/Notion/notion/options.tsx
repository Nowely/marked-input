import type {Option, RowProps} from '@markput/react'
import {Atomic, useControlRef} from '@markput/react'
import type {ReactNode} from 'react'
import {useCallback, useState} from 'react'

import {Due, Effort, Highlight, Link, Mention, Status, Who} from './marks'
import {theme} from './theme'
import {Avatar} from './ui/Avatar'
import {AvatarStack} from './ui/AvatarStack'
import {Board} from './ui/Board'
import {BookmarkCard} from './ui/BookmarkCard'
import {Callout} from './ui/Callout'
import {CardGrid} from './ui/CardGrid'
import {Chip} from './ui/Chip'
import {CommentThread} from './ui/CommentThread'
import {MetricCard} from './ui/MetricCard'
import {PropertiesPanel} from './ui/PropertiesPanel'
import {ViewTabs} from './ui/ViewTabs'
import type {PropertyCell} from './vocabulary'
import {
	assembleNotion,
	CALLOUT_ICON,
	calloutTone,
	cls,
	LANGUAGES,
	newTableLineText,
	nextCalloutTone,
	readBoard,
	readBookmark,
	readComments,
	readMetrics,
	readProperties,
	readTocEntries,
	writeBoard,
} from './vocabulary'

import rows from './rows.module.css'

/**
 * THE REACT PAINT. Every kind of the showcase is declared in `vocabulary.ts` — what a line looks
 * like, what continues, what carves, what the `/` menu offers — and this file supplies only the
 * components. `options.vue.ts` is its twin, and the two share every byte of the vocabulary.
 *
 * A kind's component is a SLOT component: it spreads `ref`, `className` and `style` onto the one
 * element it renders. Dropping the ref leaves the row unbound and the caret cannot resolve into
 * it.
 *
 * A kind whose component paints no `{children}` is an ATOMIC row: its text round-trips and it
 * drags and selects as a row, but nothing it paints is document surface. Every card below is one,
 * because the leaves they render take strings rather than nodes, and Notion's own bookmark, board
 * and properties panel behave the same way. Such a kind wraps its whole interior in ONE
 * {@link Atomic}, which the adapter ships.
 *
 * AND IT MUST BE SEEDED. `/` turns THIS ROW into the chosen kind, so a menu entry with no
 * `menu.text` inserts an EMPTY body — which for an atomic kind is a block that can never be
 * filled, because there is no surface to fill it through.
 *
 * WHAT THE OPTION API STILL CANNOT EXPRESS, named rather than worked around: after inserting an
 * atomic kind the caret has nowhere to go. An atomic row generates no caret position, and the
 * menu's contract is turn-this-row rather than insert-a-row, so nothing a consumer can write asks
 * for the empty paragraph Notion leaves below such a block.
 */

/* ── page furniture ─────────────────────────────────────────────────────── */

const Title = ({children, ref, className, style}: RowProps) => (
	<div ref={ref} className={cls(className, theme.block, theme.title)} style={style}>
		{children}
	</div>
)

const Caption = ({children, ref, className, style}: RowProps) => (
	<div ref={ref} className={cls(className, theme.block, theme.caption)} style={style}>
		{children}
	</div>
)

const Properties = ({node, ref, className, style}: RowProps) => (
	<div ref={ref} className={className} style={style}>
		<Atomic>
			<PropertiesPanel
				properties={readProperties(node.slot()).map(property => ({
					name: property.name,
					// A cell holds no id, so its own reading IS its identity — the same key the
					// raw substring used to give, without splitting the line a second time.
					value: property.cells.map(cell => (
						<span key={JSON.stringify(cell)}>{paintPropertyCell(cell)}</span>
					)),
				}))}
			/>
		</Atomic>
	</div>
)

function paintPropertyCell(cell: PropertyCell): ReactNode {
	if (cell.kind === 'chip') return <Chip tone={cell.tone}>{cell.label}</Chip>
	if (cell.kind === 'person') {
		return (
			<>
				<Avatar name={cell.name} />
				{cell.name}
			</>
		)
	}
	if (cell.kind === 'people') return <AvatarStack max={3} names={cell.names} />
	if (cell.kind === 'link') {
		return (
			<span className={theme.link} title={cell.url}>
				{cell.label}
			</span>
		)
	}
	return cell.text
}

/**
 * The rule is an EMPTY SIBLING of the row's own line rather than the line itself: the theme draws
 * a divider as a zero-height border, and a row with no line box is a row the caret cannot stand
 * on. The row's own (normally empty) text stays after it.
 */
const Divider = ({children, ref, className, style}: RowProps) => {
	// The rule is the row's only large target, so without this a click on it — or an arrow that
	// lands on it — resolves to no anchor and the next keystroke is dropped.
	const controlRef = useControlRef()
	return (
		<div ref={ref} className={cls(className, theme.block)} style={style}>
			<span className={theme.divider} ref={controlRef} />
			{children}
		</div>
	)
}

const Toc = ({node, ref, className, style}: RowProps) => (
	<div ref={ref} className={cls(className, theme.block)} style={style}>
		<Atomic className={theme.tableOfContents}>
			{readTocEntries(node.slot()).map(entry => (
				<span
					className={entry.nested ? theme.tableOfContentsItemNested : theme.tableOfContentsItem}
					key={entry.line}
				>
					{entry.text}
				</span>
			))}
		</Atomic>
	</div>
)

/* ── prose ──────────────────────────────────────────────────────────────── */

const heading = (kindClassName: string) =>
	function Heading({children, ref, className, style}: RowProps) {
		return (
			<div ref={ref} className={cls(className, kindClassName)} style={style}>
				{children}
			</div>
		)
	}

const Quote = ({children, rows: childRows, ref, className, style}: RowProps) => (
	<div ref={ref} className={cls(className, theme.block, theme.quote)} style={style}>
		{children}
		{childRows}
	</div>
)

const CalloutRow = ({meta = 'neutral', children, rows: childRows, node, ref, className, style}: RowProps) => {
	const controlRef = useControlRef()
	return (
		<div ref={ref} className={className} style={style}>
			<Callout
				icon={
					<button
						className={theme.calloutIcon}
						onClick={() => node.turnInto(kinds.callout, {meta: nextCalloutTone(meta)})}
						ref={controlRef}
						type="button"
					>
						{CALLOUT_ICON[calloutTone(meta)]}
					</button>
				}
				tone={calloutTone(meta)}
			>
				{children}
				{childRows}
			</Callout>
		</div>
	)
}

const Code = ({meta = 'bash', children, node, ref, className, style}: RowProps) => {
	const controlRef = useControlRef()
	return (
		<div ref={ref} className={cls(className, theme.block, theme.codeBlock)} style={style}>
			<select
				className={cls(theme.codeLanguageLabel, rows.codeLanguage)}
				onChange={event => node.turnInto(kinds.code, {meta: event.target.value})}
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
}

/* ── lists ──────────────────────────────────────────────────────────────── */

const Bullet = ({children, rows: childRows, depth, ref, className, style}: RowProps) => {
	const controlRef = useControlRef()
	return (
		<div ref={ref} className={cls(className, theme.block, theme.listItem)} style={style}>
			<span className={depth > 0 ? theme.listBulletHollow : theme.listBullet} ref={controlRef} />
			{children}
			{childRows}
		</div>
	)
}

const Numbered = ({children, rows: childRows, ref, className, style}: RowProps) => {
	const controlRef = useControlRef()
	return (
		<div ref={ref} className={cls(className, theme.block, theme.listItem, rows.numbered)} style={style}>
			<span className={rows.ordinal} ref={controlRef} />
			{children}
			{childRows}
		</div>
	)
}

const Todo = ({meta, children, rows: childRows, node, ref, className, style}: RowProps) => {
	const controlRef = useControlRef()
	const done = meta === 'x'
	return (
		<div ref={ref} className={cls(className, theme.block, theme.listItem)} style={style}>
			<input
				checked={done}
				className={rows.todoBox}
				onChange={event => node.turnInto(kinds.todo, {meta: event.target.checked ? 'x' : ' '})}
				ref={controlRef}
				type="checkbox"
			/>
			<span className={done ? rows.todoDone : undefined}>{children}</span>
			{childRows}
		</div>
	)
}

/**
 * THE COLLAPSED TOGGLE, and the one design question this page had to answer.
 *
 * WHY THE CHILDREN ARE ALWAYS PAINTED. A row that is not painted has left the DOM layer and taken
 * its anchors with it, so a toggle that renders no children when closed is a caret defect: `End`,
 * select-all and every arrow that resolves through the last row walk into a row with no element.
 * The children are therefore always rendered, and `hidden` is what closes them.
 *
 * `hidden="until-found"` rather than plain `hidden`, because plain `hidden` loses three things a
 * user expects: find-in-page cannot see the closed text, the browser cannot scroll to it, and a
 * match cannot open the toggle. What it still costs is the caret: a closed subtree generates no
 * boxes, so arrowing down from the title jumps over it to the next visible row.
 *
 * WHAT THAT COSTS, stated rather than argued: find-in-page landing inside a closed toggle now
 * EDITS the document — `beforematch` opens the row, and opening it is a retype.
 */
const toggleRow = (open: boolean) =>
	function Toggle({children, rows: childRows, node, ref, className, style}: RowProps) {
		const controlRef = useControlRef()
		// `until-found` is a value React's `hidden` typing does not carry — it serialises
		// `hidden="until-found"` as plain `hidden`, whose `display: none` loses the search — and
		// `beforematch` reaches no synthetic event system. Both go straight onto the element.
		// A flip of `open` is a flip of the row's KIND, so this element is minted fresh each time.
		const bodyRef = useCallback(
			(element: HTMLElement | null) => {
				if (!element) return undefined
				if (open) return undefined
				element.setAttribute('hidden', 'until-found')
				const reveal = () => node.turnInto(kinds.toggleOpen)
				element.addEventListener('beforematch', reveal)
				return () => element.removeEventListener('beforematch', reveal)
			},
			[node, open]
		)
		return (
			<div ref={ref} className={cls(className, theme.block, theme.toggleRow)} style={style}>
				<button
					aria-expanded={open}
					aria-label={open ? 'Collapse' : 'Expand'}
					className={open ? theme.toggleArrowOpen : theme.toggleArrow}
					onClick={() => node.turnInto(open ? kinds.toggle : kinds.toggleOpen)}
					ref={controlRef}
					type="button"
				/>
				{children}
				<div className={theme.toggleChildren} ref={bodyRef}>
					{childRows}
				</div>
			</div>
		)
	}

/* ── the inline database ────────────────────────────────────────────────── */

const Cell = ({children, ref, className, style}: RowProps) => (
	<div ref={ref} className={cls(className, rows.tableCell)} style={style}>
		{children}
	</div>
)

const HeaderCell = ({children, ref, className, style}: RowProps) => (
	<div ref={ref} className={cls(className, rows.tableCell, rows.tableHeadCell)} style={style}>
		{children}
	</div>
)

const TableLine = ({rows: childRows, ref, className, style}: RowProps) => (
	<div ref={ref} className={cls(className, rows.tableLine)} style={style}>
		{childRows}
	</div>
)

const TableHeader = ({rows: childRows, ref, className, style}: RowProps) => (
	<div ref={ref} className={cls(className, rows.tableLine, rows.tableHeadLine)} style={style}>
		{childRows}
	</div>
)

const TableFooter = ({children, node, ref, className, style}: RowProps) => {
	const controlRef = useControlRef()
	return (
		<div ref={ref} className={cls(className, theme.block, theme.tableFooter)} style={style}>
			<button
				className={theme.tableFooterAction}
				onClick={() => node.turnInto(kinds.tableLine, {text: newTableLineText(node.slot())})}
				ref={controlRef}
				type="button"
			>
				+ New
			</button>
			<span className={theme.tableFooterSummary}>{children}</span>
		</div>
	)
}

const Views = ({node, ref, className, style}: RowProps) => {
	const tabs = node.slot().split('|')
	const [active, setActive] = useState(tabs[0] ?? '')
	return (
		<div className={className} ref={ref} style={style}>
			<Atomic>
				<ViewTabs active={active} onSelect={setActive} tabs={tabs} />
			</Atomic>
		</div>
	)
}

/* ── the board, metrics, bookmark, comments ─────────────────────────────── */

const BoardRow = ({node, ref, className, style}: RowProps) => (
	<div className={className} ref={ref} style={style}>
		<Atomic>
			<Board
				columns={readBoard(node.slot())}
				onMove={next => node.turnInto(kinds.board, {text: writeBoard(next)})}
			/>
		</Atomic>
	</div>
)

const Metrics = ({node, ref, className, style}: RowProps) => (
	<div className={className} ref={ref} style={style}>
		<Atomic>
			<CardGrid>
				{readMetrics(node.slot()).map(metric => (
					<MetricCard key={metric.label} label={metric.label} value={metric.value} />
				))}
			</CardGrid>
		</Atomic>
	</div>
)

const Bookmark = ({meta = '', node, ref, className, style}: RowProps) => {
	const {url, description} = readBookmark(meta)
	return (
		<div className={className} ref={ref} style={style}>
			<Atomic>
				<BookmarkCard description={description} title={node.slot()} url={url} />
			</Atomic>
		</div>
	)
}

const Comments = ({node, ref, className, style}: RowProps) => (
	<div className={className} ref={ref} style={style}>
		<Atomic>
			<CommentThread comments={readComments(node.slot())} />
		</Atomic>
	</div>
)

/* ── the paragraph, which is the row with NO kind ───────────────────────── */

/**
 * `slots.paragraph` is the row with no kind and the only fallback left. It carries the
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
	<div
		className={cls(className, theme.block, theme.paragraph, rows.paragraph)}
		data-placeholder="Type / for commands…"
		ref={ref}
		style={style}
	>
		{children}
	</div>
)

/* ── the vocabulary, wired to the paint above ───────────────────────────── */

const {kinds, options} = assembleNotion(
	{
		title: Title,
		caption: Caption,
		properties: Properties,
		divider: Divider,
		toc: Toc,
		h1: heading(cls(theme.block, theme.heading1)),
		h2: heading(cls(theme.block, theme.heading2)),
		h3: heading(cls(theme.block, theme.heading3)),
		quote: Quote,
		callout: CalloutRow,
		code: Code,
		bullet: Bullet,
		numbered: Numbered,
		todo: Todo,
		toggle: toggleRow(false),
		toggleOpen: toggleRow(true),
		cell: Cell,
		headerCell: HeaderCell,
		tableHeader: TableHeader,
		tableLine: TableLine,
		tableFooter: TableFooter,
		views: Views,
		board: BoardRow,
		metrics: Metrics,
		bookmark: Bookmark,
		comments: Comments,
	},
	{mention: Mention, link: Link, highlight: Highlight, status: Status, who: Who, due: Due, effort: Effort}
)

// Every kind by name beside the array: a consumer that adds a trigger to one — the `@` picker
// rides on `mention` — needs to name it, and the row components above name their own kind to
// `turnInto`. ONE record rather than 34 re-exports, because the name list is `vocabulary.ts`'s and
// spelling it again per paint is the second implementation this file exists to not have.
export {kinds}

export const notionOptions: Option[] = options