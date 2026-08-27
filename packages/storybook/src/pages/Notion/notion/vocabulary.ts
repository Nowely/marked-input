/**
 * THE VOCABULARY, with no framework in it. Every kind of the showcase is declared once here —
 * what a line of the document looks like, how it behaves under Enter and Tab, and how it reaches
 * the `/` menu — and each adapter's option file supplies only the components that paint it.
 *
 * The split is not cosmetic. Two option files spelling `'|= __slot__'`, `split: {at: ' | '}` and
 * `menu.text` for themselves are two implementations of one rule, and a divergence between them
 * is a page that behaves differently in one framework with nothing to say so. What is genuinely
 * per-framework is the paint, and that is all either options file holds.
 *
 * IT IMPORTS NOTHING, which is what lets it be read by both projects: no adapter, no core, no
 * component library. `Slot` is a type parameter here rather than the adapter's own, so the same
 * declarations compile against a React component and against a Vue one.
 */

/**
 * A markup carrying a body placeholder. It is spelled here rather than imported: the union both
 * adapters publish as `Markup` is built out of exactly these two template literals, so a value of
 * this type is assignable to it without this module depending on either package.
 */
export type MarkupText = `${string}__value__${string}` | `${string}__slot__${string}`

/** Everything a row kind declares that is not a component. */
interface RowRules {
	/** `true` is this kind again; a NAME is that kind — a table header continues into a table line. */
	continues?: true | string
	indents?: boolean
	/** `as` names a kind of this same record; the assembler resolves it to the assembled option. */
	split?: {at: string; as: string}
}

interface MenuDeclaration {
	label: string
	keywords?: readonly string[]
	meta?: string
	text?: string
}

interface KindDeclaration {
	markup?: MarkupText
	menu?: MenuDeclaration
	/** Present makes the kind a ROW; absent with a `markup` makes it an inline mark. */
	row?: RowRules
}

/**
 * EVERY KIND, IN THE ORDER THE OPTIONS ARRAY TAKES THEM. The order is not decoration: it decides
 * which option owns a trigger character, which component a match resolves to, and what an untyped
 * `/` query leaves — the menu's sort is stable, so declaration order is the tie-break.
 *
 * Inline matching does NOT read it: every static segment goes into one alternation sorted by
 * literal length and the earliest-starting match wins, and among row kinds a longer opener always
 * wins whatever the order.
 */
export const KINDS = {
	/**
	 * THE WAY BACK TO PLAIN TEXT, and the only entry declaring no `markup`: that is the spelling
	 * for an option naming the row with NO kind — the paragraph, which is `slots.paragraph` and
	 * which no option can declare. Without it a row turned into a quote or a toggle stayed one.
	 *
	 * FIRST, so an empty `/` opens on it: "back to plain text" is the entry Notion's own menu
	 * opens with. It carries no `row` either, so it compiles to nothing and paints nothing.
	 */
	text: {menu: {label: 'Text', keywords: ['paragraph', 'plain', 'body']}},

	/* ── page furniture ─────────────────────────────────────────────────── */

	title: {markup: '@title __slot__', menu: {label: 'Page title', keywords: ['title', 'name']}, row: {}},
	caption: {markup: '@caption __slot__', menu: {label: 'Caption', keywords: ['small', 'muted']}, row: {}},
	/**
	 * The page properties. A CLOSED kind with a RAW body, so its interior keeps its newlines and
	 * is never re-parsed — the panel reads its own `key: value` lines, exactly as a YAML block is.
	 *
	 * IT DOES NOT SHARE THE DIVIDER'S OPENER, and that is a correction rather than a choice.
	 * `'---\n'` and `'---'` resolve deterministically — the longer opener wins — but a raw body
	 * may cross separators, because that is what makes a closed kind closed, so a SECOND `---`
	 * line anywhere below the first was read as this kind's close. Picking **Divider** at the end
	 * of the showcase page collapsed it from 36 rows to 3, with every row between the two rules
	 * swallowed into one panel the caret could not enter.
	 */
	properties: {
		markup: '@properties\n__value__\n@end',
		menu: {label: 'Page properties', keywords: ['frontmatter', 'meta'], text: 'Status: chip:grey:Not started'},
		row: {},
	},
	divider: {markup: '---__slot__', menu: {label: 'Divider', keywords: ['hr', 'rule', 'line']}, row: {}},
	/** The page's own headings, listed by hand. Which heading exists is a fact about other rows. */
	toc: {
		markup: '@toc\n__value__\n@end',
		menu: {label: 'Table of contents', keywords: ['toc', 'outline'], text: 'Section'},
		row: {},
	},

	/* ── prose ──────────────────────────────────────────────────────────── */

	h1: {markup: '# __slot__', menu: {label: 'Heading 1', keywords: ['h1', 'title']}, row: {}},
	h2: {markup: '## __slot__', menu: {label: 'Heading 2', keywords: ['h2']}, row: {}},
	h3: {markup: '### __slot__', menu: {label: 'Heading 3', keywords: ['h3']}, row: {}},
	quote: {
		markup: '> __slot__',
		menu: {label: 'Quote', keywords: ['blockquote', 'cite']},
		row: {continues: true, indents: true},
	},
	/**
	 * `'> [!tone] '` is a LONGER opener than `'> '`, so a callout wins over a quote without either
	 * declaring anything about the other. Clicking the icon cycles the tone, which is a `turnInto`
	 * onto the same kind with a different `meta` — the row keeps its id, its text and its caret.
	 */
	callout: {
		markup: '> [!__meta__] __slot__',
		menu: {label: 'Callout', keywords: ['note', 'warning', 'aside'], meta: 'warning'},
		row: {continues: true, indents: true},
	},
	/**
	 * A closed kind with a RAW body: the fence's interior keeps its newlines and no markup inside
	 * it is matched, which is what a code block means. Enter inside it writes a newline rather
	 * than splitting the row, and that falls out of the compiled kind rather than being declared.
	 */
	code: {
		markup: '```__meta__\n__value__\n```',
		menu: {label: 'Code', keywords: ['fence', 'snippet', 'bash'], meta: 'bash'},
		row: {},
	},

	/* ── lists ──────────────────────────────────────────────────────────── */

	bullet: {
		markup: '- __slot__',
		menu: {label: 'Bulleted list', keywords: ['ul', 'list', 'bullet']},
		row: {continues: true, indents: true},
	},
	numbered: {
		markup: '1. __slot__',
		menu: {label: 'Numbered list', keywords: ['ol', 'ordered', 'number']},
		row: {continues: true, indents: true},
	},
	/** `'- [x] '` is a longer opener than `'- '`, so a to-do wins over a bullet. */
	todo: {
		markup: '- [__meta__] __slot__',
		menu: {label: 'To-do list', keywords: ['todo', 'task', 'check'], meta: ' '},
		row: {continues: true, indents: true},
	},
	/**
	 * THE COLLAPSED TOGGLE as TWO KINDS, and `meta` is not usable for it: a row's markup may not
	 * begin with a gap, so `'▸-'` would be the only spelling left. Openness is the DOCUMENT's
	 * fact — clicking the arrow is a `turnInto` onto the sibling kind, the shape `todo` and
	 * `callout` already use, and the row keeps its id, its text, its children and its caret.
	 *
	 * NEITHER CONTINUES, which is one word and was the whole of why prose could not be typed
	 * inside a toggle. `continues: true` meant Enter at the end of a title opened ANOTHER toggle.
	 * A list item continues because a second bullet is what Enter after a bullet means; a toggle
	 * is a CONTAINER, and what Enter after its title means is a line INSIDE it.
	 *
	 * The `menu` sits on the OPEN one: a toggle a user has just asked for is one they are about to
	 * put something IN, and born closed the Enter-then-Tab that puts the first line there aimed
	 * the caret into a subtree with no boxes.
	 */
	toggle: {markup: '▸ __slot__', row: {indents: true}},
	toggleOpen: {
		markup: '▾ __slot__',
		menu: {label: 'Toggle list', keywords: ['collapse', 'details', 'fold']},
		row: {indents: true},
	},

	/* ── the inline database ────────────────────────────────────────────── */

	/**
	 * A CELL: an anonymous kind, which nothing scans and which exists only as a line's split
	 * target. Its structural bytes are the delimiter it was carved at, and it holds ordinary
	 * inline content, so a chip, an avatar or a mention inside a cell is a mark like any other.
	 */
	cell: {row: {}},
	headerCell: {row: {}},
	/**
	 * The line above the data. The HEADER is a kind of its own rather than "the first line of a
	 * run": a row is recognised by its own first bytes alone, and which line is the header is a
	 * fact about the line after it. `'|= '` is a longer opener than `'| '`, so they never compete.
	 *
	 * THE SEED IS ONE LINE, and that is a limit of `menu.text` rather than a choice: a body may
	 * not carry the document separator, so the header seeds alone and `continues` opens the first
	 * data line on Enter.
	 */
	tableHeader: {
		markup: '|= __slot__',
		menu: {label: 'Table', keywords: ['database', 'grid', 'table'], text: 'Task | Status | Owner | Due | Effort'},
		row: {continues: 'tableLine', split: {at: ' | ', as: 'headerCell'}},
	},
	/**
	 * ONE LINE of the inline database. Consecutive `display: table-row` siblings are wrapped by
	 * CSS in a single anonymous table box, which is what aligns the columns of a run of lines
	 * without a wrapper element existing anywhere in the tree.
	 */
	tableLine: {
		markup: '| __slot__',
		menu: {label: 'Table row', keywords: ['database', 'record', 'row']},
		row: {continues: true, split: {at: ' | ', as: 'cell'}},
	},
	/**
	 * The database's footer. `'|+ '` beats both table openers, and the row's own text is the
	 * summary — a count a component could not derive, since a row sees only itself.
	 */
	tableFooter: {markup: '|+ __slot__', menu: {label: 'Table footer', keywords: ['count', 'summary']}, row: {}},
	/** The view bar above a database. Its active tab is view state and belongs to nobody else. */
	views: {
		markup: '@views __slot__',
		menu: {label: 'View tabs', keywords: ['database', 'views', 'tabs'], text: 'Table|Timeline'},
		row: {},
	},

	/* ── the board ──────────────────────────────────────────────────────── */

	/**
	 * The board is ONE row whose raw body describes its columns, and a card dragged between them
	 * is WRITTEN BACK to that body — `turnInto` with the same kind and a new text, the same splice
	 * the checkbox, the callout icon and the toggle arrow already use.
	 *
	 * Not nested rows, and the reason is measured rather than aesthetic: the editor's own row drag
	 * resolves a drop by the pointer's Y through a vertical tiling of the document, and a board's
	 * columns share one Y span.
	 */
	board: {
		markup: '@board\n__value__\n@end',
		menu: {label: 'Board', keywords: ['kanban', 'database', 'columns'], text: 'To do\n- First card'},
		row: {},
	},

	/* ── metrics, bookmark, comments ────────────────────────────────────── */

	metrics: {
		markup: '@metrics\n__value__\n@end',
		menu: {label: 'Metric cards', keywords: ['metrics', 'stats', 'numbers'], text: 'Metric|0'},
		row: {},
	},
	/** `meta` is `url|description`; the row's own text is the card's title. */
	bookmark: {
		markup: '@bookmark(__meta__) __slot__',
		menu: {
			label: 'Bookmark',
			keywords: ['link', 'preview', 'url'],
			meta: 'https://example.com|What this page is about.',
			text: 'Bookmark',
		},
		row: {},
	},
	comments: {
		markup: '@comments\n__value__\n@end',
		menu: {label: 'Comment thread', keywords: ['comment', 'discussion', 'reply'], text: 'You|now|Start the thread'},
		row: {},
	},

	/* ── inline marks ───────────────────────────────────────────────────── */

	mention: {markup: '@[__value__](__meta__)'},
	link: {markup: '[__value__](__meta__)'},
	highlight: {markup: '==__slot__=='},
	status: {markup: '<status:__value__>'},
	who: {markup: '<who:__value__>'},
	due: {markup: '<due:__value__>'},
	effort: {markup: '<bar:__value__>'},
} as const satisfies Record<string, KindDeclaration>

export type KindName = keyof typeof KINDS

/** A kind that types a ROW — every declaration carrying `row`. */
export type RowKindName = {
	[K in KindName]: (typeof KINDS)[K] extends {row: RowRules} ? K : never
}[KindName]

/** An INLINE kind — a markup with no `row`. `text` is neither: it names the row with no kind. */
export type MarkKindName = {
	[K in KindName]: (typeof KINDS)[K] extends {row: RowRules}
		? never
		: (typeof KINDS)[K] extends {markup: string}
			? K
			: never
}[KindName]

/** What an assembled kind is: the declaration above with this framework's components in it. */
export interface NotionOption<TRow, TMark> {
	markup?: MarkupText
	menu?: MenuDeclaration
	row?: {
		Component: TRow
		continues?: boolean | NotionOption<TRow, TMark>
		indents?: boolean
		split?: {at: string; as: NotionOption<TRow, TMark>}
	}
	Mark?: TMark
}

/**
 * Wires each declaration to the component that paints it, in declaration order.
 *
 * `continues` and `split.as` are NAMES above and become the ASSEMBLED neighbour here, which is
 * what core resolves them by: a continuation is looked up by the option's `markup`, but a split's
 * `as` is matched against the `row` object by IDENTITY, so it has to be the very object the
 * options array holds. Naming the kind rather than importing it is what keeps that identity local
 * to one framework while the declaration stays shared.
 */
export function assembleNotion<TRow, TMark>(
	Row: {readonly [K in RowKindName]: TRow},
	Mark: {readonly [K in MarkKindName]: TMark}
): {kinds: {readonly [K in KindName]: NotionOption<TRow, TMark>}; options: NotionOption<TRow, TMark>[]} {
	// Widened on purpose: the loop walks every declaration and the paint maps answer for the ones
	// they were given, so the completeness check lives in the parameter types above rather than in
	// a lookup here.
	const paintRow: Readonly<Record<string, TRow | undefined>> = Row
	const paintMark: Readonly<Record<string, TMark | undefined>> = Mark
	const assembled: Record<string, NotionOption<TRow, TMark>> = {}
	const declarations: Record<string, KindDeclaration> = KINDS

	for (const [name, declaration] of Object.entries(declarations)) {
		const option: NotionOption<TRow, TMark> = {}
		if (declaration.markup !== undefined) option.markup = declaration.markup
		if (declaration.menu !== undefined) option.menu = declaration.menu

		const Component = paintRow[name]
		const MarkComponent = paintMark[name]
		if (Component !== undefined) option.row = {Component}
		else if (MarkComponent !== undefined) option.Mark = MarkComponent
		if (option.row && declaration.row?.indents !== undefined) option.row.indents = declaration.row.indents

		assembled[name] = option
	}

	// A second pass: both cross-references may name a kind declared after their own referrer.
	for (const [name, declaration] of Object.entries(declarations)) {
		const rules = declaration.row
		const row = assembled[name]?.row
		if (!rules || !row) continue
		if (rules.continues !== undefined) {
			row.continues = rules.continues === true ? true : assembled[rules.continues]
		}
		if (rules.split !== undefined) row.split = {at: rules.split.at, as: assembled[rules.split.as]}
	}

	// Every key of `KINDS` was just written, in its own order — which the widened record cannot say.
	// oxlint-disable-next-line no-unsafe-type-assertion -- see above
	const kinds = assembled as {readonly [K in KindName]: NotionOption<TRow, TMark>}
	return {kinds, options: Object.values(assembled)}
}

/* ── the readings a kind makes of its own body, which are text and not paint ───────────────── */

/** A palette slot, not a meaning: the caller maps its own statuses onto it. */
export type ChipTone = 'grey' | 'red' | 'amber' | 'green' | 'blue' | 'purple'

export const CHIP_TONES: readonly ChipTone[] = ['grey', 'red', 'amber', 'green', 'blue', 'purple']

/** A tone the document names wrongly is drawn grey rather than dropping what carries it. */
export const chipTone = (name: string): ChipTone => CHIP_TONES.find(tone => tone === name) ?? 'grey'

/** A PERSON'S initials, from the name the document spells — at most two, upper-cased. */
export const initialsOf = (name: string): string =>
	name
		.split(/\s+/)
		.filter(part => part.length > 0)
		.slice(0, 2)
		.map(part => part.charAt(0).toUpperCase())
		.join('')

/**
 * The colour an avatar takes from its NAME: same name, same colour, on every page and in any
 * order — a sum over the code units, not a counter, so a stack rendered twice does not recolour
 * itself. It is a reading of the document's own text, so both paints share it rather than each
 * hashing the same name their own way.
 */
export const avatarTone = (name: string): ChipTone => {
	let hash = 0
	for (let index = 0; index < name.length; index += 1) {
		hash = (hash * 31 + name.charCodeAt(index)) % 1000003
	}
	return CHIP_TONES[hash % CHIP_TONES.length]
}

export type CalloutTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export const CALLOUT_TONES: readonly CalloutTone[] = ['neutral', 'info', 'success', 'warning', 'danger']

/** A tone the document names wrongly is drawn neutral rather than dropping the row. */
export const calloutTone = (name: string): CalloutTone => CALLOUT_TONES.find(tone => tone === name) ?? 'neutral'

export const CALLOUT_ICON: Record<CalloutTone, string> = {
	neutral: '💡',
	info: 'ℹ️',
	success: '✅',
	warning: '⚠️',
	danger: '🚨',
}

/** The tone the icon cycles to — one `turnInto` onto the same kind with the next `meta`. */
export const nextCalloutTone = (name: string): CalloutTone => {
	const at = CALLOUT_TONES.indexOf(calloutTone(name))
	return CALLOUT_TONES[(at + 1) % CALLOUT_TONES.length]
}

export const LANGUAGES: readonly string[] = ['bash', 'ts', 'json', 'sql']

/**
 * The tone is a property of the STATUS, not of the document, so the map lives here: a value
 * nobody mapped falls back to grey rather than disappearing.
 */
const STATUS_TONE: Record<string, ChipTone> = {
	Blocked: 'red',
	'In progress': 'amber',
	Done: 'green',
	Planned: 'grey',
	'At risk': 'amber',
}

export const statusTone = (value: string): ChipTone => STATUS_TONE[value] ?? 'grey'

/**
 * The reference date the showcase is written against. A wall-clock read would make the page's
 * screenshot and its own story snapshot change colour on a date nobody chose.
 */
const TODAY = '2026-04-20'

/**
 * A due date's three readings. Red once it is past, muted once its row is done — and "done" is
 * not knowable from inside a mark, so the document says it: `<due:2026-04-02 done>`.
 */
export function readDue(value: string): {date: string; overdue: boolean} {
	const [date = '', flag] = value.split(' ')
	return {date, overdue: flag !== 'done' && date < TODAY}
}

/** One cell of a property's value — a small vocabulary, read out of the panel's raw body. */
export type PropertyCell =
	| {kind: 'chip'; tone: ChipTone; label: string}
	| {kind: 'person'; name: string}
	| {kind: 'people'; names: string[]}
	| {kind: 'link'; label: string; url: string}
	| {kind: 'text'; text: string}

export interface Property {
	name: string
	cells: PropertyCell[]
}

/** `Name: value`, where a value is one or more comma-separated cells of the vocabulary above. */
export function readProperties(source: string): Property[] {
	return source
		.split('\n')
		.map(line => /^([^:]+):\s*(.*)$/.exec(line))
		.filter(match => match !== null)
		.map(([, name = '', raw = '']) => ({name, cells: raw.split(', ').map(readPropertyCell)}))
}

function readPropertyCell(cell: string): PropertyCell {
	const [kind = '', ...rest] = cell.split(':')
	const argument = rest.join(':')
	if (kind === 'chip') {
		const [tone = '', ...label] = argument.split(':')
		return {kind: 'chip', tone: chipTone(tone), label: label.join(':')}
	}
	if (kind === 'person') return {kind: 'person', name: argument}
	if (kind === 'people') return {kind: 'people', names: argument.split(';')}
	if (kind === 'link') {
		const [label = '', ...url] = argument.split(' ')
		return {kind: 'link', label, url: url.join(' ')}
	}
	return {kind: 'text', text: cell}
}

export interface BoardCardData {
	id: string
	title: string
	tag?: {label: string; tone: ChipTone}
}

export interface BoardColumnData {
	id: string
	title: string
	cards: readonly BoardCardData[]
}

/** A line starting with `'- '` is a card of the column above it; any other line opens a column. */
export function readBoard(source: string): BoardColumnData[] {
	const columns: {id: string; title: string; cards: BoardCardData[]}[] = []
	let current: {id: string; title: string; cards: BoardCardData[]} | undefined
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
export function writeBoard(columns: readonly BoardColumnData[]): string {
	return columns
		.flatMap(column => [
			column.title,
			...column.cards.map(card =>
				card.tag ? `- ${card.title}|${card.tag.tone}:${card.tag.label}` : `- ${card.title}`
			),
		])
		.join('\n')
}

/**
 * One entry of the table of contents. A leading tab is the nested one, and the raw `line` rides
 * along because it is what tells two entries apart that trim to the same text.
 */
export const readTocEntries = (source: string): {line: string; text: string; nested: boolean}[] =>
	source.split('\n').map(line => ({line, text: line.trim(), nested: line.startsWith('\t')}))

export const readMetrics = (source: string): {label: string; value: string}[] =>
	source.split('\n').map(line => {
		const [label = '', value = ''] = line.split('|')
		return {label, value}
	})

export const readComments = (source: string): {author: string; timestamp: string; body: string}[] =>
	source.split('\n').map(line => {
		const [author = '', timestamp = '', body = ''] = line.split('|')
		return {author, timestamp, body}
	})

/** `meta` is `url|description`. */
export const readBookmark = (meta: string): {url: string; description: string} => {
	const [url = '', description = ''] = meta.split('|')
	return {url, description}
}

/** The card the footer's `+ New` retypes itself into: a data line, with the footer written back. */
export const newTableLineText = (summary: string): string => `\n|+ ${summary}`

export const cls = (...parts: (string | false | undefined)[]): string => parts.filter(Boolean).join(' ')