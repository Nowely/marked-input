# Typed, nested Rows — the design spec

Status: **approved direction, 2026-08-25.** Supersedes the deferral in ADR-0009. Every claim marked *proven* below was run on `b0` at HEAD; probe specs were temporary and removed (tree clean).

## Decision — the thesis in one paragraph

**A Row gains a descriptor exactly the way a Mark has one, compiled from the same `Markup` by the same compiler, and recognised by a different recognizer: a row scanner that runs *before* the inline matcher and only ever looks at a row's own start.** The parser inverts — carve the block skeleton first, parse inlines second, per row, over that row's own span — which is not a new mechanism but the *removal* of one: `rowPass`'s fixpoint, `findSeparators` and `groupRows` exist only because separators and matches are mutually dependent, and after the inversion they are not. This is proven cheaper, not just cleaner: today's `parseRows` is super-linear (0.75 ms at 250 rows, 7.60 ms at 1000, 38.84 ms at 4000), while a scan-then-parse-per-row shape is linear (0.25 / 0.72 / 3.10 ms) — 12× at 4000 rows, and it deletes code. A row's *kind* is therefore the row's own descriptor, not a mark hidden inside it; a row's structural bytes are its **lead** (the indent run, or a split delimiter) plus its opener, which no caret can enter; nesting is indentation in the one value string; and a table cell is an ordinary Row born from its parent's declared split. Consumers write **one options array** in which `{markup, Mark}` declares an inline mark and `{markup, row}` declares a row kind — same markup language, same descriptor, same props vocabulary, one menu contribution, one component resolver. `@markput/notion` is then options plus components, and its acceptance test is a grep that it imports nothing from core internals.

## Consumer API — the code a consumer writes, in full, for every block kind in the showcase

### The types core publishes

```ts
// @markput/core — shared/types.ts
export interface CoreOption {
	/** Stable key. Used by `turnInto`, `split.name`, `group`, and the menu. Defaults to the option index. */
	name?: string
	/** UNCHANGED. With `row` absent this is an inline mark, matched anywhere. */
	markup?: Markup
	/** Presence makes this a ROW option: `markup` is matched ONLY at a row's own start, and matching it TYPES the row. */
	row?: RowSpec
	overlay?: {trigger?: string; data?: ReadonlyArray<string | {value: string; meta?: string; label?: string}>}
	/** One contribution to the built-in block menu. Presence is what puts it there. */
	menu?: {label: string; group?: string; keywords?: readonly string[]; icon?: unknown; run?: (ctx: MenuRun) => void}
}

export interface RowSpec {
	/** The component this row renders as. Falls back to `slots.block`. */
	Component?: Slot
	/** Enter at the end of a NON-EMPTY row of this kind. Default 'paragraph'. */
	enter?: 'continue' | 'paragraph' | 'newline'
	/** Enter on an EMPTY row of this kind. Default 'paragraph'. */
	enterEmpty?: 'outdent' | 'paragraph'
	/** Backspace at this row's first caret position. Default 'paragraph'. */
	backspace?: 'paragraph' | 'outdent'
	/** Default 'none'; 'indent' is Tab/Shift+Tab depth, 'next' walks siblings (cells). */
	tab?: 'indent' | 'next' | 'none'
	/** May this row hold indented children? Default true. */
	nests?: boolean
	/** This row carves its OWN body into child rows at a literal — table cells. */
	split?: {at: string; name: string}
	/** Consecutive same-kind siblings render inside the wrapper named by this option. */
	group?: string
}

export type MenuRun = {row: RowNode; rows: RowsController; name: string}
export type MenuEntry = {name: string; label: string; group?: string; mode: 'insert' | 'turnInto'}
```

```ts
// @markput/react — types.ts   (Vue mirrors it)
export interface MarkProps {value?: string; meta?: string; children?: ReactNode; node: MarkNode}
export interface RowProps {
	meta?: string
	/** The row's own inline content, already rendered. */
	children?: ReactNode
	/** The row's CHILD ROWS, already rendered. `undefined` when there are none. */
	rows?: ReactNode
	/** Nesting depth, and position among siblings — both known by the parent that mapped them. */
	depth: number
	index: number
	node: RowNode
}
export interface GroupProps {children: ReactNode; depth: number}
```

A row option's markup obeys the markup rules already shipped (`MarkupDescriptor.validateMarkup`), and the ban on a *leading* placeholder becomes load-bearing rather than defensive: a row kind must open with a literal or line-start recognition is undecidable. Two rules are added for rows: exactly one body gap (`__slot__` **xor** `__value__`), and no two-`__value__` form (row openers are literal scans, never dynamic segments). Both are reported through `reportBadProp` and the option is dropped, exactly as `markupError` already does.

`__slot__` = the row's body is inline-parsed. `__value__` = the row's body is **raw**: one text child, never re-parsed, and — this is the whole of fences — a markup whose body gap is *closed* by a trailing literal may span separators.

### `@markput/notion` — blocks.tsx, in full

```tsx
import type {Option, RowProps, GroupProps, MarkProps} from '@markput/react'
import {useRowState} from '@markput/react'
import s from './theme.module.css'

/* ── page furniture ─────────────────────────────────────────────────────── */

export const properties: Option = {
	name: 'properties',
	markup: '---\n__value__\n---',                  // raw + closed ⇒ spans lines, matches anywhere
	row: {Component: ({node}: RowProps) => <PropertiesPanel yaml={node.slot() ?? ''} node={node} />, nests: false},
	menu: {label: 'Page properties', group: 'Page'},
}

export const divider: Option = {
	name: 'divider',
	markup: '***__slot__',
	row: {Component: () => <hr className={s.hr} />, nests: false},
	menu: {label: 'Divider', group: 'Basic', keywords: ['hr', 'rule']},
}

export const toc: Option = {
	name: 'toc',
	markup: '@toc __slot__',
	row: {Component: ({children}: RowProps) => <nav className={s.toc}>{children}</nav>, nests: false},
	menu: {label: 'Table of contents', group: 'Page'},
}

/* ── prose ──────────────────────────────────────────────────────────────── */

export const h1: Option = {
	name: 'h1',
	markup: '# __slot__',
	row: {Component: ({children}: RowProps) => <h1 className={s.h1}>{children}</h1>, nests: false},
	menu: {label: 'Heading 1', group: 'Basic', keywords: ['h1', 'title']},
}
export const h2: Option = {
	name: 'h2',
	markup: '## __slot__',
	row: {Component: ({children}: RowProps) => <h2 className={s.h2}>{children}</h2>, nests: false},
	menu: {label: 'Heading 2', group: 'Basic', keywords: ['h2']},
}
export const h3: Option = {
	name: 'h3',
	markup: '### __slot__',
	row: {Component: ({children}: RowProps) => <h3 className={s.h3}>{children}</h3>, nests: false},
	menu: {label: 'Heading 3', group: 'Basic', keywords: ['h3']},
}

export const quote: Option = {
	name: 'quote',
	markup: '> __slot__',
	row: {
		Component: ({children, rows}: RowProps) => <blockquote className={s.quote}>{children}{rows}</blockquote>,
		enter: 'continue', enterEmpty: 'paragraph', backspace: 'paragraph', tab: 'indent',
	},
	menu: {label: 'Quote', group: 'Basic'},
}

export const callout: Option = {
	name: 'callout',
	markup: '> [!__meta__] __slot__',                // longest first literal wins over `quote`
	row: {
		Component: ({meta = 'info', children, rows, node}: RowProps) => (
			<aside className={`${s.callout} ${s[meta]}`}>
				<button className={s.icon} ref={useControlRef()} onClick={() => node.turnInto('callout', {meta: nextTone(meta)})}>
					{ICON[meta]}
				</button>
				<div>{children}{rows}</div>
			</aside>
		),
		enter: 'continue', backspace: 'paragraph', tab: 'indent',
	},
	menu: {label: 'Callout', group: 'Basic', run: ({row, rows}) => rows.turnInto(row, 'callout', {meta: 'warn'})},
}

export const code: Option = {
	name: 'code',
	markup: '```__meta__\n__value__\n```',           // raw + closed ⇒ the interior keeps its newlines
	row: {
		Component: ({meta, children, node}: RowProps) => (
			<pre className={s.code} data-lang={meta}>
				<select ref={useControlRef()} value={meta ?? 'ts'} onChange={e => node.turnInto('code', {meta: e.target.value})}>
					{LANGS.map(l => <option key={l}>{l}</option>)}
				</select>
				<code>{children}</code>
			</pre>
		),
		enter: 'newline', nests: false,
	},
	menu: {label: 'Code', group: 'Media', keywords: ['fence', 'snippet']},
}

/* ── lists. `group` is what puts a <ul> around consecutive siblings. ─────── */

export const bulletList: Option = {name: 'bulletList', row: {Component: ({children}: GroupProps) => <ul className={s.ul}>{children}</ul>}}
export const numberedList: Option = {name: 'numberedList', row: {Component: ({children}: GroupProps) => <ol className={s.ol}>{children}</ol>}}
export const todoList: Option = {name: 'todoList', row: {Component: ({children}: GroupProps) => <ul className={s.todos}>{children}</ul>}}

const LIST_KEYS = {enter: 'continue', enterEmpty: 'outdent', backspace: 'paragraph', tab: 'indent'} as const

export const bullet: Option = {
	name: 'bullet',
	markup: '- __slot__',
	row: {...LIST_KEYS, group: 'bulletList',
		Component: ({children, rows, depth}: RowProps) => (
			<li className={s.li} data-depth={depth}>{children}{rows}</li>
		)},
	menu: {label: 'Bulleted list', group: 'Basic', keywords: ['ul', 'list']},
}

export const numbered: Option = {
	name: 'numbered',
	markup: '1. __slot__',                          // every item is literally `1.`, CommonMark-legal
	row: {...LIST_KEYS, group: 'numberedList',
		Component: ({children, rows, index}: RowProps) => (
			<li className={s.li} value={index + 1}>{children}{rows}</li>
		)},
	menu: {label: 'Numbered list', group: 'Basic', keywords: ['ol', 'ordered']},
}

export const todo: Option = {
	name: 'todo',
	markup: '- [__meta__] __slot__',                // longest first literal wins over `bullet`
	row: {...LIST_KEYS, group: 'todoList',
		Component: ({meta, children, rows, node}: RowProps) => (
			<li className={s.todo}>
				<input type="checkbox" ref={useControlRef()} checked={meta === 'x'}
				       onChange={e => node.turnInto('todo', {meta: e.target.checked ? 'x' : ' '})} />
				<span className={meta === 'x' ? s.done : undefined}>{children}</span>
				{rows}
			</li>
		)},
	menu: {label: 'To-do list', group: 'Basic', keywords: ['todo', 'task', 'check']},
}

export const toggle: Option = {
	name: 'toggle',
	markup: '▸ __slot__',
	row: {enter: 'continue', enterEmpty: 'outdent', backspace: 'paragraph', tab: 'indent',
		Component: ({children, rows, node}: RowProps) => {
			// CORE-owned per-row view state, keyed by node id: it survives a turn-into (the id does)
			// AND a nested drag (which remounts the component under a new React parent).
			const [open, setOpen] = useRowState(node, 'open', true)
			return (
				<div className={s.toggle}>
					<button ref={useControlRef()} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▾' : '▸'}</button>
					<div className={s.toggleTitle}>{children}</div>
					{open && <div className={s.toggleBody}>{rows}</div>}
				</div>
			)
		}},
	menu: {label: 'Toggle list', group: 'Basic', keywords: ['collapse', 'details']},
}
```

Value for the list and the toggle — nesting is indentation, nothing else:

```
- Vendor SLA unsigned
- EU region capacity unconfirmed
	- Awaiting quota approval
▸ Decision log
	Why we cut the Android target
	- [x] Signed off by Platform
```

```tsx
/* ── the inline database ────────────────────────────────────────────────── */

export const table: Option = {name: 'table', row: {Component: ({children}: GroupProps) =>
	<div role="table" className={s.table}>{children}</div>}}

export const cell: Option = {
	name: 'cell',
	// NO markup: an anonymous kind, never scanned, born only from its parent's `split`.
	row: {Component: ({children, index}: RowProps) => (
		<div role="cell" className={s.td} data-col={COLUMNS[index]?.key}>{children}</div>
	), nests: false, tab: 'next'},
}

export const tableRow: Option = {
	name: 'tr',
	markup: '|__slot__',
	row: {
		split: {at: ' | ', name: 'cell'},           // each cell is a real Row with its own text children
		group: 'table',
		enter: 'continue', tab: 'next', nests: false,
		Component: ({rows, index}: RowProps) => <div role="row" className={index === 0 ? s.thead : s.tr}>{rows}</div>,
	},
	menu: {label: 'Table', group: 'Database',
		run: ({row, rows}) => rows.insert(row, 'tr', 'Task | Status | Owner | Due | Effort')},
}

export const views: Option = {
	name: 'views',
	markup: '@views __slot__',
	row: {Component: ({children}: RowProps) => <ViewTabs>{children}</ViewTabs>, nests: false},
	menu: {label: 'View tabs', group: 'Database'},
}
```

```
@views Table|Board|Timeline|Calendar
| Task | Status | Owner | Due | Effort
| Auth migration | <status:Blocked> | <who:SC> | <due:2026-05-02> | <bar:20>
| Rate limiter | <status:In progress> | <who:KI> | <due:2026-05-14> | <bar:60>
```

Each cell holds ordinary inline content, so chips, avatars, dates and bars are ordinary inline options and the caret edits a cell in place.

```tsx
/* ── the board. Columns and cards are indented rows; a cross-column drag
      is the SAME nested move a list indent is. ───────────────────────────── */

export const board: Option = {
	name: 'board',
	markup: '@board __slot__',
	row: {Component: ({children, rows}: RowProps) => (
		<section className={s.board}><h4>{children}</h4><div className={s.columns}>{rows}</div></section>
	)},
	menu: {label: 'Board', group: 'Database'},
}
export const column: Option = {
	name: 'column',
	markup: '@col[__meta__] __slot__',
	row: {Component: ({meta, children, rows}: RowProps) => (
		<div className={s.column} data-tone={meta}><header>{children}</header>{rows}</div>
	), enter: 'continue', tab: 'indent'},
}
export const card: Option = {
	name: 'card',
	markup: '@card[__meta__] __slot__',
	row: {Component: ({meta, children}: RowProps) => (
		<article className={s.card}>{children}<Tag tone={meta} /></article>
	), enter: 'continue', enterEmpty: 'outdent', backspace: 'paragraph', tab: 'indent', nests: false},
	menu: {label: 'Card', group: 'Database'},
}

/* ── metrics, bookmark, comments ────────────────────────────────────────── */

export const metrics: Option = {
	name: 'metrics',
	markup: '@metrics\n__value__\n@end',            // raw + closed
	row: {Component: ({node}: RowProps) => <MetricGrid source={node.slot() ?? ''} />, nests: false},
	menu: {label: 'Metric cards', group: 'Media'},
}
export const bookmark: Option = {
	name: 'bookmark',
	markup: '@bookmark(__meta__) __slot__',
	row: {Component: ({meta, children}: RowProps) => <BookmarkCard url={meta}>{children}</BookmarkCard>, nests: false},
	menu: {label: 'Bookmark', group: 'Media'},
}
export const comment: Option = {
	name: 'comment',
	markup: '@comment(__meta__) __slot__',           // meta = "author|2h ago"
	row: {Component: ({meta, children, rows}: RowProps) => (
		<CommentThread who={meta}>{children}{rows}</CommentThread>
	), enter: 'continue', tab: 'indent'},
	menu: {label: 'Comment', group: 'Page'},
}
```

```tsx
/* ── inline marks: the recognizer is UNCHANGED, so nothing here can regress ─ */

export const mention: Option = {
	markup: '@[__value__](__meta__)',
	Mark: ({value, meta}: MarkProps) => <Avatar id={meta} name={value} />,
	overlay: {trigger: '@', data: PEOPLE.map(p => ({value: p.name, meta: p.id, label: p.email}))},
	menu: undefined,
}
export const link: Option = {markup: '[__value__](__meta__)', Mark: ({value, meta}: MarkProps) => <a href={meta}>{value}</a>}
export const highlight: Option = {markup: '==__slot__==', Mark: ({children}: MarkProps) => <mark>{children}</mark>}
export const status: Option = {markup: '<status:__value__>', Mark: ({value}: MarkProps) => <Chip tone={TONE[value!]}>{value}</Chip>}
export const who: Option = {markup: '<who:__value__>', Mark: ({value}: MarkProps) => <Initials>{value}</Initials>}
export const due: Option = {markup: '<due:__value__>', Mark: ({value}: MarkProps) => <Due at={value!} />}
export const bar: Option = {markup: '<bar:__value__>', Mark: ({value}: MarkProps) => <Progress pct={Number(value)} />}
```

### The editor, and the menu

```tsx
import {Markput} from '@markput/react'
import {notionOptions} from '@markput/notion'

export const NotionEditor = ({value, onChange}: Props) => (
	<Markput
		layout="block"
		separator="\n"           // the new default; shown for clarity
		indent="\t"              // the new default; '' turns nesting off
		draggable
		options={notionOptions}  // ONE array: row options and mark options together
		value={value}
		onChange={onChange}
	/>
)
```

The slash menu is one more option, and the consumer writes no filtering, no labels and no insert logic:

```tsx
import {BlockMenu} from '@markput/react'
export const slash: Option = {name: 'slash', overlay: {trigger: '/'}, Overlay: BlockMenu}
```

`BlockMenu` ships in each adapter beside `Suggestions` (core is framework-agnostic and ships no components). A consumer replacing it reads the same two things core owns:

```tsx
const {entries, mode, choose, close} = useOverlay()
// entries: MenuEntry[] derived from every option's own `menu`, already filtered by the typed query
// mode:    'insert' on a row holding only the trigger, 'turnInto' on a row that already has text
// choose({name}) removes the trigger span and turns the caret's row into that kind — one call, both gestures
```

Consumer components that are **not** document content (a toggle arrow, a checkbox, a language `<select>`) register through `useControlRef()`, the adapter wrapper over `tokens.control()`, which already exists and already freezes them.

## Core model — types, signatures, and the value encoding for nested rows

### The value encoding

```
document := row*
row      := lead  opener-annotated-body  terminator  childRows
lead     := indentUnit × depth        (an indent-nested row)
          | split.at                  (a cell, except the first, whose lead is '')
          | ''                        (a root row)
terminator := separator | ''          ('' only for the document-final row)
body     := annotate(descriptor.markup, {slot: join(inline)})   when descriptor.body === 'slot'
          | annotate(descriptor.markup, {value: rawText, meta}) when descriptor.body === 'value'
          | join(inline)                                        when the row is a paragraph (no descriptor)
```

Nesting is indentation, and nothing else is invented: a row whose indent run is deeper than the previous row's becomes its child, clamped **in the tree** to `previous.depth + 1` while the surplus bytes stay verbatim in `lead`, so a paste of over-indented markdown round-trips byte-exactly and merely renders shallower. Depth is therefore a fact about `lead`, never a stored mirror. A depth change is a splice on `lead` — the write path already is one.

A **split** row carves its own body at a literal: cell *k*'s `lead` is `''` for *k*=0 and `split.at` otherwise, and the parent's projection is `annotate(markup, {slot: cells.map(c => c.lead + join(c.inline())).join('')})`. Round trip is concatenation.

### Parser

```ts
// parser/core/RowDescriptor.ts  (new; compiled by createMarkupDescriptor, the SAME scanner)
export interface RowDescriptor {
	readonly name: string
	readonly index: number                 // option index — the same component-resolution rule marks use
	readonly markup: Markup
	readonly segments: readonly string[]   // literals, in order; segments[0] is the opener
	readonly gapTypes: readonly GapType[]
	readonly body: 'slot' | 'value'
	/** True when the body gap has no closing literal, so the row's own line ends it. */
	readonly open: boolean
	readonly spec: ResolvedRowSpec
}
export function rowMarkupError(markup: Markup): string | undefined   // non-throwing, props boundary

// parser/types.ts
export interface RowToken {
	type: 'row'
	content: string
	position: {start: number; end: number}
	id?: number
	descriptor?: RowDescriptor            // undefined ⇒ paragraph
	meta?: string
	lead: string
	terminator: string                    // REPLACES `terminated: boolean`
	slot: {content: string; start: number; end: number}
	children: Token[]                     // inline tokens of the body, absolute positions, text-edged
	rows: RowToken[]                      // child rows: indent-nested, or split cells
}

// parser/Parser.ts
export interface RowConfig {separator: string; indent: string; rows: readonly RowDescriptor[]}
class Parser {
	parse(value: string): Token[]                              // UNCHANGED
	parseRows(value: string, config: RowConfig): RowToken[]     // scan, then inline per row
}
```

`parseRows` is four linear passes and no fixpoint:

1. **Scan.** From offset *i*: consume the maximal run of `config.indent` → `lead`; try each row descriptor ordered by opener length descending then registry index, accepting the first whose `segments[0]` is a literal prefix at that offset; walk its remaining literals forward with `indexOf` — a missing literal rejects the candidate. A descriptor that is `open` stops its body at the next separator; a descriptor with a closing literal **may cross separators**, which is the whole of fences and frontmatter. No match ⇒ paragraph, body to the next separator. Emit a flat `RowToken` with `lead`, `descriptor`, `meta`, `slot`, `terminator`.
2. **Nest.** One stack pass over the flat list: `lead.length / indent.length` gives depth, clamped to `previous + 1`; a row whose descriptor declares `nests: false` takes no children.
3. **Split.** For a descriptor with `split`, carve its `slot` span at `at` into child `RowToken`s of the named kind.
4. **Inline.** For each non-raw row, run the *existing, unchanged* chain — `SegmentMatcher.search` → `PatternMatcher.process` → `acceptMatches` → `closeTrailingGaps(matches, [], length)` → `TreeBuilder.build` — over `value.slice(slot.start, slot.end)`, then shift the resulting token positions by `slot.start`. A raw row gets one text token spanning its body.

**Deleted:** `rowPass`, `findSeparators`, `groupRows`, `rowTokenTerminator`. `RowBuilder.ts` collapses to `acceptMatches` + `closeTrailingGaps`, both of which `parse()` already calls with an empty separator list.

### Tree

```ts
// tree/types.ts
export interface RowNode {
	readonly kind: 'row'
	readonly id: Id
	/** A SIGNAL, unlike MarkNode.descriptor: a mark IS its markup, a row HAS a kind, and a
	 *  turn-into must keep the row's identity. `undefined` is the paragraph. */
	readonly descriptor: Signal<RowDescriptor | undefined>
	readonly meta: Signal<string | undefined>
	/** INLINE children first, then CHILD ROWS. One list, so every generic walk in tree/ is untouched. */
	readonly children: Signal<readonly TreeNode[]>
	inline(): readonly TreeNode[]      // children before the first row child
	rows(): readonly RowNode[]         // the row-child tail
	/** The row's own editable interior — inline-parsed or raw. Same name and same meaning as MarkNode.slotRange. */
	slotRange: {start: number; end: number}
	/** Structural bytes BEFORE the body: the indent run, or a cell's split delimiter. Adoption-written. */
	lead: string
	terminator: string
	position: {start: number; end: number}
	slot(): string                     // the interior's TEXT, joined from inline children
	range(): {start: number; end: number}
	// verbs
	turnInto(name: string | undefined, patch?: {meta?: string | null}): boolean
	setDepth(depth: number): boolean
	splitAt(at: NodeAnchor, name?: string | undefined): boolean
	moveTo(placement: RowPlacement): boolean
	remove(): boolean; duplicate(): boolean; insertAfter(text: string): boolean; mergeWith(next: TreeNode): boolean
}

export type RowPlacement = {parent: RowNode | null; index: number}
export type TreeNode = TextNode | MarkNode | RowNode          // shape unchanged, reach new

/** pairing[j] = the PRE-ORDER ROW index of the previous row that becomes new pre-order row j. */
export type Pairing = readonly number[]
```

`RowNode` now mirrors `MarkNode` field for field — `descriptor`, `meta`, `children`, `slotRange`, `slot()`, `position` — plus `lead`, `terminator` and `rows()`. That symmetry is what buys one render path, one adoption rule and one props vocabulary. `MarkNode` and `TextNode` are unchanged except that `moveTo` leaves them (see breakage).

**No `depth` field.** `lead` is the truth; `tree/rowDepth(row, indent)` computes it for core, and the adapters pass `depth` down when they map, as `Token` already does.

`joinNodes` row arm:

```ts
lead + body(node) + terminator + joinNodes(node.rows())
```

### Adoption

- `adoptSiblings`' row arm keeps **kind-only pairing** — the reason it exists (`adopt.ts:91-96`) is exactly what makes a turn-into preserve the id, the DOM element, the drag grip and the collapse state. `adoptRow` additionally writes `descriptor`, `meta`, `lead`, `terminator`, `slotRange`.
- `snapshotNodeEquals`' row arm gains `descriptor`/`meta`/`lead`/`terminator` to its comparison, so a same-length retype can never be accepted by the prefix or suffix walk.
- `pairEquals` (the pairing gate only) compares a row pair on `descriptor`, `meta` and its **inline children under the pair's own CONTENT delta** (`token.slot.start − node.slotRange.start`), ignoring `lead`, `terminator` and `position`. This is load-bearing: adding one `'\t'` changes a row's start delta by 0 while its children's is +1, so the existing position-delta comparison fails every pair and identity silently degrades to index pairing — the exact ADR-0007 failure mode `pairEquals` was written to avoid.
- `resolvePairing` widens to pre-order rows: build `preorderRows(prev)` and `preorderRowTokens(parsed)`, keep the three gates (length, per-pair equality under its own delta, bijection), and produce a `Map<RowToken, RowNode>`. Adoption then walks the parsed row tree and, for each row token, adopts its paired node (or builds a fresh one) and writes `children = [...adoptedInline, ...adoptedChildRows]`. A flat root permutation is the degenerate case, so today's `movePlan` output stays valid input.

### Anchors and DOM

- `anchorAt`, `offsetOfAnchor`, `adjacentMark`, `stepAnchor`, `findNode`, `reachable`, `shiftPositions`, `collectTree` — **unchanged**, because a row keeps one `children` list and sibling positions still ascend.
- `separatorSpan` → **`boundarySpan(roots, anchor, direction)`**: walks pre-order rows at every depth; the bytes between row A's content end and row B's content start are `A.terminator + B.lead`.
- `entryAnchor` is rewritten. The shipped rule — "a row opening with a zero-width text then a mark enters that mark's slot" (`siblings.ts:143-149`) — is deleted, because a typed row's opener is no longer a child mark. A row enters its first inline text child at offset 0; a row with no inline children (a split row) enters `rows()[0]` recursively.
- `DomModel.#entryOf` (`DomModel.ts:222-228`) descends a row exactly one level to its edge child. Under nesting the last child **is a row**, so `{after: row}` resolves to a wrapper handle. Rewritten to descend recursively to the edge text/mark descendant.
- `bind`: `ElementBindings` gains `childRowsHost`, fed by a new `TokenModel.rows(ownerId)` ref registry, and `applyEditableState`'s control walk skips elements on **either** host's path to the root. Without this, `bind.ts:282-294` freezes the nested-rows container as a sibling of the inline host's path and **every nested row is untypeable** — a defect none of the four candidate designs named and one affirmatively denied.

### The new features

```ts
// features/rows/RowsController.ts — store.rows
class RowsController {
	descriptor(name: string): RowDescriptor | undefined
	entries(query: string, row: RowNode | undefined): readonly MenuEntry[]
	turnInto(row: RowNode, name: string | undefined, patch?: {meta?: string | null}): boolean
	insert(after: RowNode, name: string | undefined, text?: string): boolean
	move(ids: readonly Id[], placement: RowPlacement): boolean
	depthOf(row: RowNode): number
	/** Per-row VIEW state, keyed by node id, pruned on commit. Never in the value string. */
	view(id: Id): Signal<Record<string, unknown>>
}

// features/history/HistoryModel.ts — store.history
type FoldRecord = {origin: 'commit' | 'echo' | 'foreign' | 'reparse'; before: string; after: string
                   window: Window; selectionBefore?: Anchors; selectionAfter?: Anchors}
class HistoryModel {
	undo(): boolean; redo(): boolean
	readonly canUndo: Computed<boolean>; readonly canRedo: Computed<boolean>
}
```

`createBoundary` gains an `onFold(record)` dep, published as `TokenModel.folds: Event<FoldRecord>`. `fold` is the one funnel every adoption on the live path already runs through (commit, arrival, reparse) and it already holds both the pre-image (`tree.value()`, unmutated at that instant, per `CommitSink`'s own contract) and `selectionBefore`. `HistoryModel` records `origin === 'commit' | 'echo'`, coalesces consecutive single-character inserts at contiguous anchors within 500 ms, ignores `'reparse'`, and on `'foreign'` clears redo and pushes a boundary. Undo is `tokens.setValue(before)` plus `selection.select(selectionBefore)`, guarded by a `#replaying` flag.

## Ownership map

| Concern | Owner | Note |
|---|---|---|
| Row grammar, opener scan, nesting pass, split pass | `parser/core/RowScanner.ts` + `RowDescriptor.ts` | new; `MarkupRegistry` compiles both families with `createMarkupDescriptor` |
| Inline matching | `parser/core/{SegmentMatcher,PatternMatcher,TreeBuilder}` | **byte-identical**; a row literal never enters the alternation |
| Nodes, identity, adoption, pairing | `tree/{tree,adopt}.ts` | kind-only row pairing; `Pairing` over pre-order rows |
| Anchors, boundaries, entry, plans | `tree/{anchors,siblings}.ts` | the ONE place an offset is formed (ADR-0003) |
| Value, verbs, splices, seam | `tokens/seam/TokenModel.ts` | `folds` event added; `rowConfig` replaces `rowSeparator` in the parse tuple |
| DOM binding, caret, editable topology | `tokens/dom/{bind,DomModel,SelectionDriver}.ts` | `childRowsHost` added |
| Row kinds, menu entries, row commands, view state | `features/rows/RowsController.ts` → `store.rows` | new |
| Keyboard (Enter / Backspace / Tab / Mod+Z) | `features/keyboard/rowKeys.ts` | replaces `blockEdit.ts`; wired by the existing `enableInput` |
| Undo/redo stack | `features/history/HistoryModel.ts` → `store.history` | new; no DOM listener, hence `*Model` |
| Overlay trigger, entries, `mode`, `choose` | `features/overlay/OverlayController.ts` | gains `entries`/`mode`; the mark arm is untouched |
| Block selection, drag, drop indicator, geometry | `features/block/BlockController.ts` → `store.block` | **name and role unchanged** (CONTEXT.md records the decision) |
| Component + props resolution | `features/slots/resolveSlot.ts` | `resolveMarkSlot` → `resolveNodeSlot`, which answers for rows too |
| Group wrappers | the adapters, at render time | a group is presentation; it never enters the tree |
| Row/group/cell components, chips, avatars, board, cards | the consumer | core owns structure and behavior, the consumer owns rendering (2026-08-19 decision, unchanged) |

## Behavior changes and superseded ADRs

**ADRs.** **ADR-0009 superseded by ADR-0010, "Rows are typed and nest"**: the separator stays structural, and a row's *lead* and *opener* join it as structural bytes no caret may enter; nesting is no longer deferred. **New ADR-0011, "The block skeleton is scanned before inlines are parsed"**, records the inversion and its measurement. **ADR-0006 amended by ADR-0012, "The editor owns undo"**: the guard stays fail-closed, and `historyUndo`/`historyRedo` become expressed rather than dropped. **ADR-0007 is upheld and strengthened** — row pairing stays kind-only, so a turn-into keeps the id, and `Pairing` widens to pre-order so a re-parent keeps ids too. **ADR-0001/0002/0003/0004/0005/0008 stand.** ADR-0003's gate needs **no widening**: the row's content span is named `slotRange`, which `/\.(?:position|slotRange)\b/` (`addressSpace.spec.ts:53`) already matches, and `lead` is read only inside `features/tokens/` because `rowDepth` lives in `tree/`.

**Observable behavior:**

1. An inline mark can no longer span a row boundary. *Proven consequence:* today `'---\n__value__\n---'` and `'```__meta__\n__value__\n```'` match **only at offset 0** (probe: identical documents preceded by `'x\n'` produce zero marks under both `'\n'` and `'\n\n'`) — that accident is replaced by row kinds with closing literals, which match anywhere.
2. A row-option markup matches **only** at a row's own start: `'load 5# peak'` stops taking a heading (ticket 01), and repeats stop nesting inside their own slot (ticket 06).
3. A row-option markup **with a closing literal may cross separators** — fences and frontmatter work at any offset (tickets 07, 09).
4. `separator` default `'\n\n'` → `'\n'`: one line is one row, so a tight list is per-item rows (ticket 05). *Proven:* `'- a\n- b\n- c'` gives three sibling rows under `'\n'` and a three-deep staircase under `'\n\n'`.
5. **Shift+Enter is unbound in block layout.** Under one line per row a soft break has no representation that does not make some byte significant in every stored document; it is deferred to a named follow-up (a `softBreak` string scanned only inside a row's body) rather than paid for with a global escape character.
6. `indent` is a new prop defaulting to `'\t'`: a leading tab run at a row start becomes structural. A consumer storing leading tabs as content sets `indent: ''`.
7. Enter, Backspace-at-row-start and Tab change meaning per row kind. Tab is consumed only when the caret's row declares `tab`, so Tab still leaves the field elsewhere (ADR-0002's accepted cost preserved).
8. `/` on a row that already has text converts it (ticket 11).
9. `history` defaults to **true**: Ctrl/Cmd+Z goes from doing nothing (ADR-0006 swallowed it) to undoing. Strictly an improvement, declared because it is observable.
10. A row renders through its kind's component; `slots.block` becomes the fallback for untyped rows; `resolveMarkSlot` stops throwing for a row (`resolveSlot.ts:72-76`). **Every block-layout DOM snapshot changes shape** — rows nest, groups add wrappers. Diff and explain each; never regenerate.
11. Consecutive same-`group` siblings gain a wrapper element.
12. A markdown table stops being one atomic mark: cells become rows and caret motion through a table changes completely.
13. Drag changes depth and parent, and a drop moves the whole block selection.
14. The caret can no longer sit inside a row's lead or opener, and neither is `textContent`. Any test asserting a row's text includes `'- '` changes.

**Published API broken:**

- `moveTo` leaves `TextNode`/`MarkNode` and `NodeCommands`; it becomes `RowNode.moveTo(placement: RowPlacement)`. Every in-repo caller is block layout (`BlockController.ts:456` and `markNode.spec.ts`'s `rowSetup` cases).
- `Pairing`'s domain changes from root indices to pre-order row indices. Type-identical, semantics not.
- `Parser.parseRows(value, separator)` → `parseRows(value, config: RowConfig)`; `RowToken.terminated: boolean` → `terminator: string`, plus `descriptor`/`meta`/`lead`/`slot`/`rows`.
- `TokenModel.rowSeparator` → `TokenModel.rowConfig: Computed<RowConfig | undefined>`; `rowSeparator` survives as a derived read for `SlotsFeature`'s SSR gutter.
- `resolveMarkSlot` → `resolveNodeSlot`; `SlotName` keeps `'block'` as the untyped-row fallback.
- `CoreOption` gains `name`, `row`, `menu`; `overlay.data` widens from `string[]` to `ReadonlyArray<string | {value, meta?, label?}>`; `filterSuggestions` widens with it.
- `OverlayController.choose(value, meta?)` → `choose(pick: {name?: string; value?: string; meta?: string})`; `select({value, meta})` is unchanged for mention pickers. `OverlayMatch` gains `mode`.
- `BLOCK_MENU_ITEMS` is demoted to the default *row-control* menu; the slash menu's entries come from `store.rows.entries`.
- New core exports: `RowNode`, `RowPlacement`, `RowSpec`, `RowDescriptor`, `MenuEntry`, `RowsController`, `HistoryModel` (closes ticket 03 — React's `Extract<TreeNode, {kind:'row'}>` in `Block.tsx:15` goes away).
- New adapter exports: `RowProps`, `GroupProps`, `useRowState`, `useControlRef`, `BlockMenu`.
- New props: `indent`, `history`.
- New adapter SPI: `TokenModel.rows(ownerId): DomRef`.

**Deliberate non-changes:** `Mark`/`mark` keep their shipped shape — breaking them buys nothing this spec needs, and nesting the row component inside `row` is what keeps `row`/`Row` from becoming a third case-only pair (api-v2 issue 01's defect). `store.block` keeps its name and role.

## Phases

Each phase lands on `pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check` green, with no caller referencing a removed symbol.

**P1 — Row kinds and the scan-first parse.**
`RowDescriptor` compiled by `createMarkupDescriptor`; `RowScanner`; `Parser.parseRows(value, RowConfig)`; `RowToken`'s new fields; delete `rowPass`/`findSeparators`/`groupRows`/`rowTokenTerminator`. Tree: `RowNode.descriptor`/`meta`/`slotRange`/`slot()`, `adoptRow`, `pairEquals`, `joinNodes`, `sliceWithin`. Slots: `resolveNodeSlot`. Adapters render a row through its kind's component. **No nesting** (`indent: ''`), no split, separator default unchanged.
*Proving test:* `Parser` inline snapshots via `tokensToDebugTree` for the four closed tickets — `'load 5# peak'` is one paragraph whose `#` is text (01); `'- a\n- b'` is two siblings, not a staircase (06); `'x\n```js\nq\n```'` matches the fence mid-document (07); `'pre\n---\na: 1\n---'` matches frontmatter mid-document (09) — plus a faker-driven round-trip property `joinNodes(parseRows(v, cfg)) === v`, plus an identity oracle that `row.turnInto('h1')` keeps `row.id`.
*Exit:* five checks green; the existing `Notion` story renders from row options with its DOM snapshot diffed and explained.

**P2 — `'\n'` becomes the default separator.**
`PropsModel.separator` default; story and spec updates.
*Proving test:* the 05/06 specs, plus a parse-cost guard: `parseRows` of a 250-row document under 1 ms and a 4000-row document under 6 ms (measured today: 0.75 ms and 38.84 ms before, 0.25 ms and 3.10 ms after).
*Exit:* green, with the cost guard in CI.

**P3 — Nesting.**
`indent` prop; `lead`; the stack pass; `children` = inline-then-rows with `inline()`/`rows()`; recursive `Row` in both adapters; `rowDepth`; `boundarySpan`; `entryAnchor` rewrite; `DomModel.#entryOf` rewrite; `childRowsHost` + the `applyEditableState` skip; `Pairing` over pre-order rows.
*Proving test:* a round-trip property over generated indented documents; an `adopt` identity oracle that indenting row *k* changes no id anywhere in the tree; a browser spec that types into a **nested** row and asserts the emitted value (this is the `applyEditableState` gate).
*Exit:* green; nested rows are typeable in both adapters.

**P4 — Row verbs and `store.rows`.**
`turnInto`, `setDepth`, `splitAt`, `moveTo(placement)`, `insert`, `move(ids, placement)`; `movePlan` generalized to a common-ancestor splice with re-leading and terminator normalization; `RowRegistry`; `RowsController` including `view(id)`.
*Proving test:* per-verb specs asserting the exact emitted value string **and** that every surviving row keeps its id; a re-parent move keeps ids; a `movePlan` property test over generated nested documents — for every legal placement the result re-parses to the intended tree, and every illegal one answers `undefined`.
*Exit:* green; `store.rows` is the only surface the keymap and the overlay use.

**P5 — The row keymap.**
`features/keyboard/rowKeys.ts` replaces `blockEdit.ts`; `handleRowParagraph` extended to `insertLineBreak`.
*Proving test:* a table-driven unit spec, one case per rule × caret position, plus a shared-harness browser spec that types `- a⏎b⇥c⏎⏎` and asserts the emitted value at each step.
*Exit:* green; Enter continues a list, Enter on an empty item exits it, Backspace at row start demotes, Tab/Shift+Tab renest.

**P6 — Slash menu: entries in core, insert and turn-into.**
`Option.menu`; `OverlayController.entries`/`mode`; `choose({name})`; `BlockMenu` in both adapters; `overlay.data` widening.
*Proving test:* ticket 11's currently failing assertion — a row reading `plain row`, `/`, `Heading 1` must emit `'# plain row'`, not `'plain row# '` — plus an insert case on an empty row.
*Exit:* green; the showcase's menu component contains no filtering and no insert logic.

**P7 — History.**
`FoldRecord`, `TokenModel.folds`, `HistoryModel`, the `Mod+Z` keydown arm, the two inputType arms.
*Proving test:* type/undo/redo restores value **and** caret; a coalescing case; a structural verb (`duplicate`) is its own step; a controlled-mode case where the parent refuses the echo and the entry is dropped; an assertion that `historyUndo` no longer reaches `dropUnexpressedInput`.
*Exit:* green; ADR-0012 written.

**P8 — Split rows: editable cells.**
`split: {at, name}`; anonymous row kinds; cell projection; `tab: 'next'`.
*Proving test:* `'| a | b'` yields two cell rows and round-trips; a browser spec typing into cell 2 asserts the emitted value; a mention inserted in a cell parses as a mark inside that cell's children.
*Exit:* green; the database table is editable in place.

**P9 — Block selection and nested drag.**
`state.selected` + shift anchor; Esc escalation, Shift+arrows, Mod+A scope; `rowAtPoint` — binary search over roots, then recursive descent into the hit row's own `rows()`, because a parent's box **contains** its children's and the flat binary search has no sorted axis left; `state.drop.depth` from `clientX` clamped to the depths legal at that gap; drop → `store.rows.move`.
*Proving test:* a Playwright spec that Shift-selects two rows, drops them **into** a toggle at a chosen depth, and asserts both the emitted value's indentation and that every moved node kept its id.
*Exit:* green; nested drag preserves identity and collapse state.

**P10 — `@markput/notion` and the showcase.**
The option file above, the components, the theme, and the full showcase page.
*Proving test:* a shared-spec browser suite over the real page driving slash-insert, slash-turn-into on a row with text, Tab nesting, undo, and a cross-column card drag; plus a CI grep that `packages/notion/src` imports nothing from `@markput/core/src` and calls neither `store.edit` nor `store.tokens`.
*Exit:* the page in `showcase.md` renders and every interaction in its "Interactions that must work" list passes.

## Risks and the mitigation for each

1. **`movePlan` under nesting and multi-selection is the highest-risk function in the design.** It must normalize terminators, re-lead a moved subtree at its destination depth, and stay one contiguous splice. *Mitigation:* fail closed — refuse when the affected span does not tile, when the placement is inside the moved subtree, or when a needed terminator has no sibling to copy; a property test over generated nested documents for every legal placement; the selection set normalized to maximal subtrees before planning.
2. **Nested rows frozen by `applyEditableState`.** `bind.ts:282-294` freezes every sibling of the host→root path, and a nested-rows container is exactly such a sibling. *Mitigation:* the `childRowsHost` registration and the two-path skip, landed in P3 with a browser spec that types into a nested row as its gate.
3. **The opener scan is greedy over literals via `indexOf`,** so a closing literal appearing inside a raw body ends the row early (a code fence containing ```` ``` ````). *Mitigation:* declared limitation with a pinned spec — the same limitation `__value__` already has today.
4. **A split cell cannot contain its delimiter.** *Mitigation:* declared; the follow-up (a per-kind escape scoped to the cell body) is named and deliberately not built.
5. **Soft breaks are lost under `separator: '\n'`.** *Mitigation:* declared as change 5, with the `softBreak` follow-up named; a consumer needing them today sets `separator: '\n\n'` and accepts one row per paragraph.
6. **`Pairing` over pre-order is proven only for root permutations today.** *Mitigation:* keep all three gates, add the pre-order length gate, and add a property test that a rejected pairing degrades to index pairing without corrupting the tree or duplicating a node.
7. **Parse cost at document scale.** *Mitigation:* the measured guard test in P2. The inversion makes the block parse linear rather than super-linear, so the risk moves in the safe direction; there is no incremental parser and there will not be one in this design.
8. **Snapshot churn across every block-layout story.** *Mitigation:* AGENTS.md's rule, enforced per phase — diff the old and new structure, explain the diff, never regenerate.
9. **Ambiguity between two row kinds sharing an opener prefix** (`'---__slot__'` vs `'---\n__value__\n---'`). *Mitigation:* the longest-opener-first rule is deterministic and documented; the showcase avoids the collision (`'***__slot__'` for the divider), and `rowMarkupError` reports two kinds with an identical opener.

## Rejected alternatives and why

- **Row becomes a parser Markup in the segment alternation** — rejected 2026-08-20 and re-rejected: proven, registering two fence variants together yields zero marks, because a closing literal in the shared alternation eats the opening one.
- **Fold `RowNode` into `MarkNode`** — the fold forces descriptor-identity pairing, which mints a fresh node on every turn-into and takes drag state, collapse state and block selection with it.
- **Pair rows on descriptor identity** — same defect, already measured in `token-born-edit/issues/08`; kind-only pairing is precisely what keeps a row alive across a retype.
- **Synthetic group rows in the tree** — a group is presentation with zero bytes; folding it at render time keeps `anchorAt`, `sliceWithin`, `removePlan`, `movePlan` and `boundarySpan` free of a node that tiles nothing.
- **A global `escape` character** — makes backslash significant in every document a consumer stores, diffs and pastes, to buy one gesture.
- **Recognize openers inside the existing `rowPass` fixpoint** — it destroys the loop's only stated termination argument in the keystroke path; the inversion deletes the loop instead.
- **An incremental parser** — measured: scan-first is 0.25 ms at Notion scale and 3.10 ms at 285 KB, so a full re-parse per keystroke stays well under a frame.
- **Derive a row's kind from its first child mark (`row.lead()`)** — pushes the parser's shape into consumer components (`node.lead()?.meta()`), the incoherence the mandate rules out.
- **Store `depth` on the node** — mirrored state; `lead` is the truth and adapters already pass depth down when they map.
- **Two child lists on a row (`children` + `rows`)** — one list, inline-then-rows, leaves nine generic walks in `tree/`, `bind` and `transactions` completely untouched.
- **A second coordinate name (`contentRange`, `line`)** — naming the row's interior `slotRange` matches `MarkNode` and keeps ADR-0003's grep gate enforcing rather than dodged.
- **Core owning row DOM** — decided and rejected 2026-08-19; core owns structure and behavior, the consumer owns rendering.
- **A `contenteditable` host per row** — ADR-0002 stands; one host everywhere, block layout included.
- **Rename `store.block` to `store.controls`** — churn against a decision CONTEXT.md records explicitly; `store.rows` is the new neighbour and each is named for what it owns.
- **`Row`/`row` as component/config on the Option** — a third case-only pair, the exact defect api-v2 issue 01 exists to remove; the component nests inside `row`.