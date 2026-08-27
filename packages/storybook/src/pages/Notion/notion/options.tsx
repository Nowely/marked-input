import type {Option, RowProps} from '@markput/react'
import {Atomic, useControlRef} from '@markput/react'
import type {ReactNode} from 'react'
import {useCallback, useState} from 'react'

import {Due, Effort, Highlight, Link, Mention, Status, Who} from './marks'
import {theme} from './theme'
import {Avatar} from './ui/Avatar'
import {AvatarStack} from './ui/AvatarStack'
import {Board} from './ui/Board'
import type {BoardColumnData} from './ui/Board'
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
 *
 * A kind whose component paints no `{children}` is an ATOMIC row: its text round-trips and it
 * drags and selects as a row, but nothing it paints is document surface. Every card below is one,
 * because the leaves they render take strings rather than nodes, and Notion's own bookmark, board
 * and properties panel behave the same way. Such a kind wraps its whole interior in ONE
 * {@link Atomic}, which the adapter ships.
 *
 * AND IT MUST BE SEEDED. `/` turns THIS ROW into the chosen kind, so a menu entry with no
 * `menu.text` inserts an EMPTY body — which for an atomic kind is a block that can never be
 * filled, because there is no surface to fill it through. Seven entries used to insert a blank
 * panel, a blank grid or a blank card; every atomic kind below now carries a seed.
 *
 * WHAT THE OPTION API STILL CANNOT EXPRESS, named rather than worked around: after inserting an
 * atomic kind the caret has nowhere to go. An atomic row generates no caret position, and the
 * menu's contract is turn-this-row rather than insert-a-row, so nothing a consumer can write asks
 * for the empty paragraph Notion leaves below such a block. On a one-row document that means the
 * editor has no caret target at all until the user clicks elsewhere.
 */

const cls = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

const CHIP_TONES: ChipTone[] = ['grey', 'red', 'amber', 'green', 'blue', 'purple']

/** A tone the document names wrongly is drawn grey rather than dropping what carries it. */
const chipTone = (name: string): ChipTone => CHIP_TONES.find(tone => tone === name) ?? 'grey'

/* ── page furniture ─────────────────────────────────────────────────────── */

export const title: Option = {
	markup: '@title __slot__',
	row: {
		Component: ({children, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, theme.block, theme.title)} style={style}>
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
			<div ref={ref} className={cls(className, theme.block, theme.caption)} style={style}>
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
 * IT DOES NOT SHARE THE DIVIDER'S OPENER, and that is a correction rather than a choice.
 * `'---\n'` and `'---'` resolve deterministically — the longer opener wins — but "deterministic"
 * is not "correct": a raw body may cross separators, because that is what makes a closed kind
 * closed, so a SECOND `---` line anywhere below the first was read as this kind's close. Picking
 * **Divider** from the `/` menu at the end of the showcase page collapsed it from 36 rows to 3,
 * with every row between the two rules swallowed into one panel the caret could not enter. The
 * text survived in the value; nothing on the screen did.
 *
 * `'@properties\n…\n@end'` is the shape the four other closed kinds already use, and it collides
 * with nothing.
 */
export const properties: Option = {
	markup: '@properties\n__value__\n@end',
	row: {
		Component: ({node, ref, className, style}: RowProps) => (
			<div ref={ref} className={className} style={style}>
				<Atomic>
					<PropertiesPanel properties={readProperties(node.slot())} />
				</Atomic>
			</div>
		),
	},
	menu: {label: 'Page properties', keywords: ['frontmatter', 'meta'], text: 'Status: chip:grey:Not started'},
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
	if (kind === 'people') return <AvatarStack max={3} names={argument.split(';')} />
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
		Component: ({children, ref, className, style}: RowProps) => {
			// The rule is the row's only large target, so without this a click on it — or an arrow
			// that lands on it — resolves to no anchor and the next keystroke is dropped.
			const controlRef = useControlRef()
			return (
				<div ref={ref} className={cls(className, theme.block)} style={style}>
					<span className={theme.divider} ref={controlRef} />
					{children}
				</div>
			)
		},
	},
	menu: {label: 'Divider', keywords: ['hr', 'rule', 'line']},
}

/** The page's own headings, listed by hand. Which heading exists is a fact about other rows. */
export const toc: Option = {
	markup: '@toc\n__value__\n@end',
	row: {
		Component: ({node, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, theme.block)} style={style}>
				<Atomic className={theme.tableOfContents}>
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
				</Atomic>
			</div>
		),
	},
	menu: {label: 'Table of contents', keywords: ['toc', 'outline'], text: 'Section'},
}

/* ── prose ──────────────────────────────────────────────────────────────── */

/**
 * THE WAY BACK TO PLAIN TEXT, and the only entry on this page that declares no `markup`: that is
 * the spelling for an option naming the row with NO kind — the paragraph, which is `slots.paragraph`
 * and which no option can declare. Without it a row turned into a quote or a toggle stayed one,
 * because every other entry names a kind to turn INTO.
 *
 * It carries no `row` either, so it compiles to nothing and paints nothing; it exists to put a
 * label on the menu, which is what `CoreOption.menu` has meant since P7.
 */
export const text: Option = {
	menu: {label: 'Text', keywords: ['paragraph', 'plain', 'body']},
}

const heading = (kindClassName: string) =>
	function Heading({children, ref, className, style}: RowProps) {
		return (
			<div ref={ref} className={cls(className, kindClassName)} style={style}>
				{children}
			</div>
		)
	}

export const h1: Option = {
	markup: '# __slot__',
	row: {Component: heading(cls(theme.block, theme.heading1))},
	menu: {label: 'Heading 1', keywords: ['h1', 'title']},
}

export const h2: Option = {
	markup: '## __slot__',
	row: {Component: heading(cls(theme.block, theme.heading2))},
	menu: {label: 'Heading 2', keywords: ['h2']},
}

export const h3: Option = {
	markup: '### __slot__',
	row: {Component: heading(cls(theme.block, theme.heading3))},
	menu: {label: 'Heading 3', keywords: ['h3']},
}

export const quote: Option = {
	markup: '> __slot__',
	row: {
		continues: true,
		indents: true,
		Component: ({children, rows: childRows, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, theme.block, theme.quote)} style={style}>
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
				<div ref={ref} className={cls(className, theme.block, theme.codeBlock)} style={style}>
					<select
						className={cls(theme.codeLanguageLabel, rows.codeLanguage)}
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
				<div ref={ref} className={cls(className, theme.block, theme.listItem)} style={style}>
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
				<div ref={ref} className={cls(className, theme.block, theme.listItem, rows.numbered)} style={style}>
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
				<div ref={ref} className={cls(className, theme.block, theme.listItem)} style={style}>
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
 * THE COLLAPSED TOGGLE, and the one design question this page had to answer. Two halves.
 *
 * WHY THE CHILDREN ARE ALWAYS PAINTED. A row that is not painted has left the DOM layer and
 * taken its anchors with it, so a toggle that renders no children when closed is a caret defect:
 * `End`, select-all and every arrow that resolves through the last row walk into a row with no
 * element. The children are therefore always rendered, and `hidden` is what closes them.
 *
 * `hidden="until-found"` rather than plain `hidden`, because plain `hidden` loses three things a
 * user expects: find-in-page cannot see the closed text, the browser cannot scroll to it, and a
 * match cannot open the toggle. `until-found` keeps the subtree searchable, fires `beforematch`
 * when a search lands inside it, and this component opens itself there. What it still costs is
 * the caret: a closed subtree generates no boxes, so arrowing down from the title jumps over it
 * to the next visible row — which is Notion's own behaviour, and the price of not unmounting.
 *
 * WHO OWNS "OPEN". The document does, and the arrow is what it is drawn with: `▸` closed, `▾`
 * open, which is how a reader would draw it anyway. Openness was `useState` and that made it a
 * fact only the component knew — so it could not be authored (the reference page's first toggle
 * is open and no document could say so), could not be undone, and did not survive a drop into a
 * different parent, because that re-parents the element between two framework parents and
 * neither adapter carries a component instance across it. As a KIND it is none of those things:
 * clicking the arrow is `turnInto` onto the sibling kind, exactly the shape `todo` and `callout`
 * already use, and the row keeps its id, its text, its children and its caret.
 *
 * WHAT THAT COSTS, stated rather than argued: find-in-page landing inside a closed toggle now
 * EDITS the document — `beforematch` opens the row, and opening it is a retype. A consumer who
 * would rather a search not dirty the value should not use `until-found`, and then pays the
 * three things it buys.
 *
 * TWO OPTIONS, ONE COMPONENT: `meta` is not usable here, because a row's markup may not begin
 * with a gap and `'▸-'` would be the only spelling left. The `menu` sits on the OPEN one, and
 * that is a correction rather than a detail: it used to sit on the closed one, on the reading that
 * "a new toggle has nothing inside it to show". A toggle a user has just asked for is one they are
 * about to put something IN — and born closed, the Enter-then-Tab that puts the first line there
 * aimed the caret into a subtree with no boxes. Forty-seven characters were typed into the document
 * and none of them appeared. (The editor refuses that nesting now, so the same gesture is merely
 * inert instead of invisible; born open, it does what the user asked.)
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
				const reveal = () => node.turnInto(toggleOpen)
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
					onClick={() => node.turnInto(open ? toggle : toggleOpen)}
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

/**
 * AND THE KIND DOES NOT CONTINUE, which is one word and was the whole of why prose could not be
 * typed inside a toggle. `continues: true` meant Enter at the end of a title opened ANOTHER toggle
 * — `'▾ Why'` + Enter + text emitted `'▾ Why⏎▾ text'` — and Tab on it then nested a toggle inside a
 * toggle. A list item continues because a second bullet is what Enter after a bullet means; a
 * toggle is a CONTAINER, and what Enter after its title means is a line INSIDE it.
 *
 * WHAT IT BUYS AND WHAT IT STILL COSTS. Enter now opens a plain row and Tab puts it in the toggle,
 * so the gesture is Enter, Tab — the `/text` that used to be needed in the middle is gone. What no
 * declaration can say is the Tab: `continues` carries a KIND, and the tail is written at the row's
 * OWN lead ({@link splitPlan}'s `openedLine`), so an option can name what the next row IS and never
 * where it SITS. See `docs/scratch/notion-like/map.md` for what a depth-carrying form would take.
 */
export const toggle: Option = {
	markup: '▸ __slot__',
	row: {indents: true, Component: toggleRow(false)},
}

export const toggleOpen: Option = {
	markup: '▾ __slot__',
	row: {indents: true, Component: toggleRow(true)},
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
			<div ref={ref} className={cls(className, rows.tableCell, rows.tableHeadCell)} style={style}>
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
 * Declared BEFORE the header, which names it: `continues` takes an option value, so the reference
 * is read when this module is evaluated.
 */
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
 * The line above it. The HEADER is a kind of its own rather than "the first line of a run": a row
 * is recognised by its own first bytes alone, and which line is the header is a fact about the line
 * after it. `'|= '` is a longer opener than `'| '`, so the two never compete.
 *
 * IT CONTINUES INTO A LINE, not into a second header and not into a paragraph — Enter at the end of
 * a header opens the first data row, which is the obvious way to write one and used to emit a
 * paragraph holding literal pipes.
 */
export const tableHeader: Option = {
	markup: '|= __slot__',
	row: {
		continues: tableLine,
		split: {at: ' | ', as: headerCell},
		Component: ({rows: childRows, ref, className, style}: RowProps) => (
			<div ref={ref} className={cls(className, rows.tableLine, rows.tableHeadLine)} style={style}>
				{childRows}
			</div>
		),
	},
	/**
	 * THE SEED IS A GRID, not a header. `menu.text` is the row's own body, and a body may carry a
	 * separator — the footer's own `turnInto` already writes one — so the entry seeds the header
	 * line and one empty data line under it, with a cell for each column. Seeding the header alone
	 * gave `/table` a single line on a construct whose whole point is a grid, and left the user to
	 * know that Enter opens the next one.
	 */
	menu: {
		label: 'Table',
		keywords: ['database', 'grid', 'table'],
		// `'| '` then four delimiters: five empty cells, one per column of the header above it.
		text: `Task | Status | Owner | Due | Effort\n| ${' | '.repeat(4)}`,
	},
}

/**
 * The database's footer. `'|+ '` beats both table openers, and the row's own text is the summary
 * — a count a component could not derive, since a row sees only itself.
 */
export const tableFooter: Option = {
	markup: '|+ __slot__',
	row: {
		Component: ({children, node, ref, className, style}: RowProps) => {
			const controlRef = useControlRef()
			return (
				<div ref={ref} className={cls(className, theme.block, theme.tableFooter)} style={style}>
					<button
						className={theme.tableFooterAction}
						onClick={() => node.turnInto(tableLine, {text: `\n|+ ${node.slot()}`})}
						ref={controlRef}
						type="button"
					>
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
			const tabs = node.slot().split('|')
			const [active, setActive] = useState(tabs[0] ?? '')
			return (
				<div className={className} ref={ref} style={style}>
					<Atomic>
						<ViewTabs active={active} onSelect={setActive} tabs={tabs} />
					</Atomic>
				</div>
			)
		},
	},
	menu: {label: 'View tabs', keywords: ['database', 'views', 'tabs'], text: 'Table|Timeline'},
}

/* ── the board ──────────────────────────────────────────────────────────── */

/**
 * The board is ONE row whose raw body describes its columns, and a card dragged between them is
 * WRITTEN BACK to that body — `turnInto` with the same kind and a new text, which is the same one
 * splice the checkbox, the callout icon and the toggle arrow already use.
 *
 * IT USED TO LIVE IN THE COMPONENT'S OWN STATE, on `showcase.md`'s reading that the arrangement
 * is the consumer's. That reading is wrong HERE, and the argument is the markup above: the
 * columns ARE the document. Kept in the component, a drag moved the card on screen while the
 * value the editor emitted never changed — nothing to undo, nothing to persist, and every count
 * outside the board stale against what was on screen. The write is the ordinary published route,
 * so the board gets the undo stack and the controlled-mode echo for free.
 *
 * Not nested rows, and the reason is measured rather than aesthetic: the editor's own row drag
 * resolves a drop by the pointer's Y through a vertical tiling of the document, and a board's
 * columns share one Y span. Cross-axis hit-testing is out of scope by ADR, so columns-as-rows
 * would offer a drag that lands in an arbitrary column.
 */
export const board: Option = {
	markup: '@board\n__value__\n@end',
	row: {
		Component: ({node, ref, className, style}: RowProps) => (
			<div className={className} ref={ref} style={style}>
				<Atomic>
					<Board
						columns={readBoard(node.slot())}
						onMove={next => node.turnInto(board, {text: writeBoard(next)})}
					/>
				</Atomic>
			</div>
		),
	},
	menu: {label: 'Board', keywords: ['kanban', 'database', 'columns'], text: 'To do\n- First card'},
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

/** {@link readBoard}'s inverse, so a drag round-trips through the document rather than around it. */
function writeBoard(columns: readonly BoardColumnData[]): string {
	return columns
		.flatMap(column => [
			column.title,
			...column.cards.map(card =>
				card.tag ? `- ${card.title}|${card.tag.tone}:${card.tag.label}` : `- ${card.title}`
			),
		])
		.join('\n')
}

/* ── metrics, bookmark, comments ────────────────────────────────────────── */

export const metrics: Option = {
	markup: '@metrics\n__value__\n@end',
	row: {
		Component: ({node, ref, className, style}: RowProps) => (
			<div className={className} ref={ref} style={style}>
				<Atomic>
					<CardGrid>
						{node
							.slot()
							.split('\n')
							.map(line => {
								const [label = '', value = ''] = line.split('|')
								return <MetricCard key={label} label={label} value={value} />
							})}
					</CardGrid>
				</Atomic>
			</div>
		),
	},
	menu: {label: 'Metric cards', keywords: ['metrics', 'stats', 'numbers'], text: 'Metric|0'},
}

/** `meta` is `url|description`; the row's own text is the card's title. */
export const bookmark: Option = {
	markup: '@bookmark(__meta__) __slot__',
	row: {
		Component: ({meta = '', node, ref, className, style}: RowProps) => {
			const [url = '', description = ''] = meta.split('|')
			return (
				<div className={className} ref={ref} style={style}>
					<Atomic>
						<BookmarkCard description={description} title={node.slot()} url={url} />
					</Atomic>
				</div>
			)
		},
	},
	menu: {
		label: 'Bookmark',
		keywords: ['link', 'preview', 'url'],
		meta: 'https://example.com|What this page is about.',
		text: 'Bookmark',
	},
}

export const comments: Option = {
	markup: '@comments\n__value__\n@end',
	row: {
		Component: ({node, ref, className, style}: RowProps) => (
			<div className={className} ref={ref} style={style}>
				<Atomic>
					<CommentThread
						comments={node
							.slot()
							.split('\n')
							.map(line => {
								const [author = '', timestamp = '', body = ''] = line.split('|')
								return {author, timestamp, body}
							})}
					/>
				</Atomic>
			</div>
		),
	},
	menu: {label: 'Comment thread', keywords: ['comment', 'discussion', 'reply'], text: 'You|now|Start the thread'},
}

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
	// FIRST, so an empty `/` opens on it: the menu's sort is stable, so declaration order is what
	// an untyped query leaves, and "back to plain text" is the entry Notion's own menu opens with.
	text,
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
	toggleOpen,
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