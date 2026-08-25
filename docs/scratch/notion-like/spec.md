# Typed, nested Rows — the design spec

Status: **approved direction, revised 2026-08-25 after four reduction lenses and two adversarial
verifications that ran real code.** Supersedes the deferral in ADR-0009. Every number below was
re-measured on `b0` at `414424a1`; probe specs were temporary and removed (`git status` clean).
Where a claim could not be reproduced it was replaced by the measurement, not by an argument.

## What this spec dropped

**Collapsed:** `enter`/`enterEmpty`/`backspace` (3 fields, 7 values, 5 of 5 `backspace:` uses were the default) → `continues?: boolean` plus one universal demote ladder; `tab` (3 values) → `indents?: boolean`, with Tab-walks-siblings falling out of `split`; `CoreOption.name` → the option index the mark path already resolves by (`resolveSlot.ts:77`); `menu.run` (both uses were data) → `menu.meta`/`menu.text`; `RowDescriptor` (8 fields, 6 of them verbatim copies of `MarkupDescriptor`) → the compiled descriptor itself; `group: string` + four component-only Options → `group?: Slot` keyed by component reference; `RowsController`/`store.rows` (7 members, each with an existing owner) → the node verbs, `OverlayController` and `store.block`; `RowNode.terminator` + `RowToken.terminator` + `rowTokenTerminator` + `movePlan`'s terminator normalization → a pre-order join by `config.separator`; `RowNode.slotRange` → a derived read off children edges; `RowDescriptor.open`/`body` → `trailingGap !== undefined` / `hasSlot`; `nests` (14 of 14 uses were `false`) → deleted, with `split` and indent-nesting made mutually exclusive instead; `RowsController.view(id)` + `useRowState` → the consumer keys collapse state by the published `node.id`; `FoldRecord` (4 origins, `before` + `after`) → `EditRecord` (2 origins, `base` + `next`) captured at `sink.commit`, which is the only place controlled mode has a pre-image at all; `TokenModel.rowSeparator` → `rowConfig` alone; `closeTrailingGaps`' `separators` parameter → deleted, both call sites pass `[]`. **Refused:** deleting the `layout` prop and the inline/block parse fork (the maintainer reserved it as a published-API question in `1235da9a`, and P2 *forecloses its discriminator* — that is surfaced as a blocker, not taken here); deleting `bind`'s sibling-freeze walk (measured 3 red React / 6 red Vue tests — a shipped behaviour change that needs its own commit); folding `BLOCK_MENU_ITEMS` into `MenuEntry` (a rename, not a reduction — the shapes genuinely differ, and both adapters plus the shared `Drag` spec depend on it); `CoreSlots.block`, `denote`, `api.focus()` (published or documented, rule 8).

## Decision — the thesis in one paragraph

**A Row gains a descriptor exactly the way a Mark has one, compiled from the same `Markup` by the
same compiler, and recognised by a different recognizer: a row scanner that runs *before* the
inline matcher and only ever looks at a row's own start.** The parser inverts — carve the block
skeleton first, parse inlines second, per row, over that row's own span — which removes a
mechanism rather than adding one: `rowPass`'s fixpoint, `findSeparators` and `groupRows` exist only
because separators and matches are mutually dependent, and after the inversion they are not. A
row's *kind* is therefore the row's own descriptor, not a mark hidden inside it; a row's structural
bytes are its **lead** (the indent run, or a split delimiter) plus its opener, which no caret can
enter; nesting is indentation in the one value string; and a table cell is an ordinary Row born
from its parent's declared split. Consumers write **one options array** in which `{markup, Mark}`
declares an inline mark and `{markup, row}` declares a row kind — same markup language, same
descriptor, same props vocabulary, one menu contribution, one component resolver. `@markput/notion`
is then options plus components, and its acceptance test is a grep that it imports nothing from
core internals.

**The case is concepts, not speed, and the honest cost is lines.** The spec previously claimed the
inversion buys 12× at 4000 rows and "deletes code". Re-measured, both halves were wrong:

| document | today's `parseRows` | today + a ~20-line loop fix | scan-first (prototyped, not built here) |
|---|---|---|---|
| 250 rows / 8 KB | 0.50 ms | 0.20 ms | ~0.19 ms |
| 1000 rows / 35 KB | 1.50 ms | 0.50 ms | ~0.46 ms |
| 4000 rows / 148 KB | 27.30 ms | 2.20 ms | ~2.96 ms |
| 8000 rows / 296 KB | 92.20 ms | 4.60 ms | ~3.90 ms |

The first two columns are my own run (darwin arm64, Node 24, median of 40 after 20 warmups, mixed
generated document with fences and inline marks); the third is a second reviewer's prototype on a
different generator, quoted as approximate and **not re-run here**. Machine and document-shape
noise between independent runs of *the same* code reached 27.3 vs 37.2 ms at 4000 rows, so treat
any single figure as ±35% and only the ratios as load-bearing. Two consequences the old text hid:

1. **Substantially all of the win is a defect, not the design.** `rowPass` contains two O(S·M)
   loops — `RowBuilder.ts:75` (`matches.some(...)` per separator occurrence) and `:111`
   (`separators.find(...)` per match). Replacing them with a two-pointer walk over the merged
   union of accepted extents and a binary search costs ~20 lines, keeps the fixpoint, keeps
   `findSeparators` and `groupRows`, inverts nothing, and is byte-identical over 40 000 fuzzed
   (document, separator) pairs (0 mismatches; the binary search's `<`→`<=` mutant produces 1361).
   That is **P0**, and it lands first precisely so the inversion is judged on what is left.
2. **The parser layer grows.** Removing `rowPass` (24 lines), `findSeparators` (15), `groupRows`
   (45) and `parseRows`' body (9) is −93; the scanner, the per-row inline pass and the row
   compiler are +155 *before* the nesting and split passes exist. Net roughly **+100 lines**
   at the parser layer. The number that improves is the concept count: −1 fixpoint whose only
   termination argument was "each round strictly shrinks `accepted`", −1 mutual dependence
   between separators and matches, −2 functions; +1 scanner with three sub-modes, +1 nest pass,
   +1 split pass, +1 position-shift step. The 1000-row `7.60 ms` figure the old text quoted was
   not reproducible by either reviewer (1.50 and ~2.2 ms) and is withdrawn. The predicted O(N²)
   from unmatched closed openers was **measured and refuted**: 32 000 unclosed fence lines parse
   in 4.68 ms.

## Consumer API — the code a consumer writes, in full, for every block kind in the showcase

### The types core publishes

```ts
// @markput/core — shared/types.ts
export interface CoreOption {
	/** UNCHANGED. With `row` absent this is an inline mark, matched anywhere. */
	markup?: Markup
	/** Presence makes this a ROW option: `markup` is matched ONLY at a row's own start, and
	 *  matching it TYPES the row. An option may carry `row` with no `markup` — an anonymous
	 *  kind, reachable only as a `split.as` target. */
	row?: RowSpec
	/** UNCHANGED. The inline component. */
	Mark?: Slot
	overlay?: {trigger?: string; data?: ReadonlyArray<string | {value: string; meta?: string; label?: string}>}
	/** One contribution to the block menu. Presence is what puts it there. */
	menu?: MenuSpec
}

export interface RowSpec {
	/** REQUIRED. Every row kind renders through its own component; `slots.block` is the
	 *  PARAGRAPH component (a row with no option), which is the only fallback left. */
	Component: Slot
	/** Enter at the end of a non-empty row of this kind opens another row of this kind, and
	 *  a mid-row Enter gives the tail this kind. Default false ⇒ a plain row. */
	continues?: boolean
	/** Tab / Shift+Tab change this row's depth. Default false, so Tab still leaves the field
	 *  everywhere else (ADR-0002's accepted cost, preserved). */
	indents?: boolean
	/** This row carves its OWN body into child rows at a literal — table cells. A split row
	 *  takes no indent-nested children; `rowMarkupError` rejects `split` with `indents`. */
	split?: {at: string; as: CoreOption}
	/** Consecutive siblings sharing this component REFERENCE render inside one wrapper.
	 *  Reference identity is the key — two kinds sharing a wrapper share one `const`. */
	group?: Slot
}

export interface MenuSpec {
	label: string
	section?: string
	keywords?: readonly string[]
	icon?: unknown
	/** Seeds the row this entry writes. Both were `menu.run` callbacks; both were data. */
	meta?: string
	text?: string
}

/** What an overlay renders. `mode` is a property of the CARET'S ROW, so it lives on the
 *  overlay, not copied onto every entry. */
export type MenuEntry = {option: CoreOption; label: string; section?: string; icon?: unknown}
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
	/** Nesting depth and position among siblings — both known by the parent that mapped them. */
	depth: number
	index: number
	node: RowNode
}
```

A `group` component receives `{children}` and nothing else. There is no `GroupProps`: no wrapper in
the showcase reads depth, and the old shape typed group components as `GroupProps` while assigning
them to a field declared `Slot` over `RowProps` — a type lie in the spec's own example code.

A row option's markup obeys the markup rules already shipped (`validateMarkup`), and the ban on a
*leading* placeholder becomes load-bearing rather than defensive: a row kind must open with a
literal or line-start recognition is undecidable. Four rules are added for rows, all reported
through `reportBadProp` with the option dropped, exactly as `markupError` already does:

1. exactly one body gap — `__slot__` **xor** `__value__`;
2. no two-`__value__` form (row openers are literal scans, never dynamic segments);
3. `split` may not be combined with `indents` (measured: a row holding both cells and indented
   children loses the indented children from the value projection in every projection rule tried);
4. two row kinds may not compile to an identical opener.

`__slot__` = the row's body is inline-parsed. `__value__` = the row's body is **raw**: one text
child, never re-parsed. **Only the body gap may cross a separator.** Every other gap's closing
literal must *start* at or before the row's own separator, or the candidate is rejected. This is
the one rule that makes fences and frontmatter work while stopping `'- [x hello⏎world] more'` from
becoming one todo whose `meta` swallows the next row — measured against the alternatives:

| closer rule | `code` fence | `todo` | `bookmark` |
|---|---|---|---|
| every gap unbounded (the old text) | works | **swallows rows** | **swallows rows** |
| every gap row-bound | **breaks** | works | works |
| **body gap only** | works | works | works |

Note the boundary: the fence's `__meta__` closer **is** the separator, so the test is
`closerStart > rowEnd` rejects — not `closerStart + closer.length > rowEnd`.

### `@markput/notion` — blocks.tsx, in full

```tsx
import type {Option, RowProps, MarkProps} from '@markput/react'
import {useControlRef} from '@markput/react'
import s from './theme.module.css'

/* ── page furniture ─────────────────────────────────────────────────────── */

export const properties: Option = {
	markup: '---\n__value__\n---',                  // raw + closed ⇒ spans lines, matches anywhere
	row: {Component: ({node}: RowProps) => <PropertiesPanel yaml={node.slot()} node={node} />},
	menu: {label: 'Page properties', section: 'Page'},
}

export const divider: Option = {
	markup: '---__slot__',                          // collides with `properties` BY DESIGN — see risk 8
	row: {Component: () => <hr className={s.hr} />},
	menu: {label: 'Divider', section: 'Basic', keywords: ['hr', 'rule']},
}

export const toc: Option = {
	markup: '@toc __slot__',
	row: {Component: ({children}: RowProps) => <nav className={s.toc}>{children}</nav>},
	menu: {label: 'Table of contents', section: 'Page'},
}

/* ── prose ──────────────────────────────────────────────────────────────── */

export const h1: Option = {
	markup: '# __slot__',
	row: {Component: ({children}: RowProps) => <h1 className={s.h1}>{children}</h1>},
	menu: {label: 'Heading 1', section: 'Basic', keywords: ['h1', 'title']},
}
export const h2: Option = {
	markup: '## __slot__',
	row: {Component: ({children}: RowProps) => <h2 className={s.h2}>{children}</h2>},
	menu: {label: 'Heading 2', section: 'Basic', keywords: ['h2']},
}
export const h3: Option = {
	markup: '### __slot__',
	row: {Component: ({children}: RowProps) => <h3 className={s.h3}>{children}</h3>},
	menu: {label: 'Heading 3', section: 'Basic', keywords: ['h3']},
}

export const quote: Option = {
	markup: '> __slot__',
	row: {
		Component: ({children, rows}: RowProps) => <blockquote className={s.quote}>{children}{rows}</blockquote>,
		continues: true, indents: true,
	},
	menu: {label: 'Quote', section: 'Basic'},
}

export const callout: Option = {
	markup: '> [!__meta__] __slot__',               // longest opener wins over `quote`
	row: {
		Component: ({meta = 'info', children, rows, node}: RowProps) => (
			<aside className={`${s.callout} ${s[meta]}`}>
				<button className={s.icon} ref={useControlRef()} onClick={() => node.turnInto(callout, {meta: nextTone(meta)})}>
					{ICON[meta]}
				</button>
				<div>{children}{rows}</div>
			</aside>
		),
		continues: true, indents: true,
	},
	menu: {label: 'Callout', section: 'Basic', meta: 'warn'},
}

export const code: Option = {
	markup: '```__meta__\n__value__\n```',          // raw + closed ⇒ the interior keeps its newlines
	row: {
		Component: ({meta, children, node}: RowProps) => (
			<pre className={s.code} data-lang={meta}>
				<select ref={useControlRef()} value={meta ?? 'ts'} onChange={e => node.turnInto(code, {meta: e.target.value})}>
					{LANGS.map(l => <option key={l}>{l}</option>)}
				</select>
				<code>{children}</code>
			</pre>
		),
	},
	menu: {label: 'Code', section: 'Media', keywords: ['fence', 'snippet']},
}
```

`code` declares no Enter behaviour: a raw closed body already contains separators, so Enter inside
one inserts a literal newline rather than splitting a row. That is derived from the compiled
descriptor (`!hasSlot && trailingGap === undefined`), not declared — it had exactly one user.

```tsx
/* ── lists. `group` is a component REFERENCE; consecutive siblings sharing it share a wrapper. ── */

const Bullets = ({children}: {children: ReactNode}) => <ul className={s.ul}>{children}</ul>
const Numbers = ({children}: {children: ReactNode}) => <ol className={s.ol}>{children}</ol>
const Todos   = ({children}: {children: ReactNode}) => <ul className={s.todos}>{children}</ul>

export const bullet: Option = {
	markup: '- __slot__',
	row: {continues: true, indents: true, group: Bullets,
		Component: ({children, rows, depth}: RowProps) => (
			<li className={s.li} data-depth={depth}>{children}{rows}</li>
		)},
	menu: {label: 'Bulleted list', section: 'Basic', keywords: ['ul', 'list']},
}

export const numbered: Option = {
	markup: '1. __slot__',                          // every item is literally `1.`, CommonMark-legal
	row: {continues: true, indents: true, group: Numbers,
		Component: ({children, rows, index}: RowProps) => (
			<li className={s.li} value={index + 1}>{children}{rows}</li>
		)},
	menu: {label: 'Numbered list', section: 'Basic', keywords: ['ol', 'ordered']},
}

export const todo: Option = {
	markup: '- [__meta__] __slot__',                // longest opener wins over `bullet`
	row: {continues: true, indents: true, group: Todos,
		Component: ({meta, children, rows, node}: RowProps) => (
			<li className={s.todo}>
				<input type="checkbox" ref={useControlRef()} checked={meta === 'x'}
				       onChange={e => node.turnInto(todo, {meta: e.target.checked ? 'x' : ' '})} />
				<span className={meta === 'x' ? s.done : undefined}>{children}</span>
				{rows}
			</li>
		)},
	menu: {label: 'To-do list', section: 'Basic', keywords: ['todo', 'task', 'check']},
}

export const toggle: Option = {
	markup: '▸ __slot__',
	row: {continues: true, indents: true,
		Component: ({children, rows, node}: RowProps) => {
			// CONSUMER-owned view state keyed by the PUBLISHED node id, which survives a
			// turn-into (row pairing is kind-only — `adopt.ts:91-96`). `hidden`, not
			// unmounted: an unpainted row leaves `bind`, and every anchor walk with it.
			const [open, setOpen] = useCollapse(node.id)
			return (
				<div className={s.toggle}>
					<button ref={useControlRef()} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▾' : '▸'}</button>
					<div className={s.toggleTitle}>{children}</div>
					<div className={s.toggleBody} hidden={!open}>{rows}</div>
				</div>
			)
		}},
	menu: {label: 'Toggle list', section: 'Basic', keywords: ['collapse', 'details']},
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

const Table = ({children}: {children: ReactNode}) => <div role="table" className={s.table}>{children}</div>

export const cell: Option = {
	// NO markup: an anonymous kind, never scanned, born only from its parent's `split`.
	row: {Component: ({children, index}: RowProps) => (
		<div role="cell" className={s.td} data-col={COLUMNS[index]?.key}>{children}</div>
	)},
}

export const tableRow: Option = {
	markup: '|__slot__',
	row: {
		split: {at: ' | ', as: cell},              // each cell is a real Row with its own text children
		group: Table,
		continues: true,
		Component: ({rows, index}: RowProps) => <div role="row" className={index === 0 ? s.thead : s.tr}>{rows}</div>,
	},
	menu: {label: 'Table', section: 'Database', text: 'Task | Status | Owner | Due | Effort'},
}

export const views: Option = {
	markup: '@views __slot__',
	row: {Component: ({children}: RowProps) => <ViewTabs>{children}</ViewTabs>},
	menu: {label: 'View tabs', section: 'Database'},
}
```

```
@views Table|Board|Timeline|Calendar
| Task | Status | Owner | Due | Effort
| Auth migration | <status:Blocked> | <who:SC> | <due:2026-05-02> | <bar:20>
| Rate limiter | <status:In progress> | <who:KI> | <due:2026-05-14> | <bar:60>
```

Each cell holds ordinary inline content, so chips, avatars, dates and bars are ordinary inline
options and the caret edits a cell in place. Tab walks to the next cell because the row is a split
child — nothing declares it.

```tsx
/* ── the board. Columns and cards are indented rows; a cross-column drag
      is the SAME nested move a list indent is. ───────────────────────────── */

export const board: Option = {
	markup: '@board __slot__',
	row: {Component: ({children, rows}: RowProps) => (
		<section className={s.board}><h4>{children}</h4><div className={s.columns}>{rows}</div></section>
	)},
	menu: {label: 'Board', section: 'Database'},
}
export const column: Option = {
	markup: '@col[__meta__] __slot__',
	row: {Component: ({meta, children, rows}: RowProps) => (
		<div className={s.column} data-tone={meta}><header>{children}</header>{rows}</div>
	), continues: true, indents: true},
}
export const card: Option = {
	markup: '@card[__meta__] __slot__',
	row: {Component: ({meta, children}: RowProps) => (
		<article className={s.card}>{children}<Tag tone={meta} /></article>
	), continues: true, indents: true},
	menu: {label: 'Card', section: 'Database'},
}

/* ── metrics, bookmark, comments ────────────────────────────────────────── */

export const metrics: Option = {
	markup: '@metrics\n__value__\n@end',            // raw + closed
	row: {Component: ({node}: RowProps) => <MetricGrid source={node.slot()} />},
	menu: {label: 'Metric cards', section: 'Media'},
}
export const bookmark: Option = {
	markup: '@bookmark(__meta__) __slot__',
	row: {Component: ({meta, children}: RowProps) => <BookmarkCard url={meta}>{children}</BookmarkCard>},
	menu: {label: 'Bookmark', section: 'Media'},
}
export const comment: Option = {
	markup: '@comment(__meta__) __slot__',          // meta = "author|2h ago"
	row: {Component: ({meta, children, rows}: RowProps) => (
		<CommentThread who={meta}>{children}{rows}</CommentThread>
	), continues: true, indents: true},
	menu: {label: 'Comment', section: 'Page'},
}

/* ── inline marks: the recognizer is UNCHANGED, so nothing here can regress ─ */

export const mention: Option = {
	markup: '@[__value__](__meta__)',
	Mark: ({value, meta}: MarkProps) => <Avatar id={meta} name={value} />,
	overlay: {trigger: '@', data: PEOPLE.map(p => ({value: p.name, meta: p.id, label: p.email}))},
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

The slash menu is one more option, and the consumer writes no filtering, no labels and no insert
logic:

```tsx
import {BlockMenu} from '@markput/react'
export const slash: Option = {overlay: {trigger: '/'}, Overlay: BlockMenu}
```

`BlockMenu` ships in each adapter beside `Suggestions` (core is framework-agnostic and ships no
components). A consumer replacing it reads the same three things core owns:

```tsx
const {entries, mode, choose, close} = useOverlay()
// entries: MenuEntry[] derived from every option's own `menu`, already filtered by the typed query
// mode:    'insert' on a row holding only the trigger, 'turnInto' on a row that already has text
// choose({option}) removes the trigger span and turns the caret's row into that kind — ONE splice,
//                  both gestures, because `turnInto` takes the new body text as a parameter
```

Consumer components that are **not** document content (a toggle arrow, a checkbox, a language
`<select>`) register through `useControlRef()`. This is **new adapter surface**, not an existing
wrapper: `useControlRef` does not exist today (grep: zero hits) and `controlRoots.ts` writes no DOM
attribute. What exists is `TokenModel.control()`, with two callers (`BlockControls.tsx:41`,
`BlockControls.vue:35`), and it *is* the thing that writes `contentEditable = 'false'`
(`TokenModel.ts:144`). `useControlRef()` is a three-line adapter wrapper over it, memoised per
component.

## Core model — types, signatures, and the value encoding for nested rows

### The value encoding

```
document := row*                             joined, in PRE-ORDER, by `config.separator`
row      := lead  body  childRows
lead     := indentUnit × depth               (an indent-nested row)
          | split.at                         (a cell, except the first, whose lead is '')
          | ''                               (a root row)
body     := annotate(markup, {slot: joinNodes(row.inline())})                    // slot kind
          | annotate(markup, {value: rawText, meta})                             // value kind
          | annotate(markup, {slot: row.rows().map(c => c.lead + joinNodes(c.inline())).join('')})
                                                                                 // split kind
          | joinNodes(row.inline())                                              // paragraph
```

**There is no `terminator`.** The pre-order join is what puts one separator between every pair of
adjacent rows and none after the last, so `terminator === '' ⟺ document-final` is structural rather
than stored-and-normalized. Measured basis: over 3000 generated documents under `'\n\n'`, `'\n'`
and `'---'`, a terminated row's terminator was *always exactly* the configured separator — zero
violations. The mechanisms this deletes are named in Adoption and in P5.

There is exactly **one** projection rule per row, and the split fold lives inside `body`, not
beside it. The old text carried two contradictory rules for a split row (`§value encoding` had the
cells fold; `§Tree`'s `joinNodes` arm appended `joinNodes(node.rows())` after the terminator); the
second was measured at **4.7% round-trip failure** over 25 400 generated documents — every non-final
split row, e.g. `'| a | b⏎next'` → `'|⏎ a | bnext'`. The rule above measured **0 failures / 25 400**.

Nesting is indentation and nothing else is invented: a row whose indent run is deeper than the
previous row's becomes its child, clamped **in the tree** to `previous.depth + 1` while the surplus
bytes stay verbatim in `lead`, so a paste of over-indented markdown round-trips byte-exactly and
merely renders shallower. Two consequences, both declared rather than papered over:

- **`lead` is the round-trip bytes; depth is the tree.** They are not the same fact and there is no
  function from one to the other: `'- a⏎\t\t- b⏎\t- c'` gives two depth-1 siblings whose leads are
  `'\t\t'` and `'\t'`. So `depth` is the recursion index the adapters already pass down when they
  map, `lead` is what `joinNodes` emits, and there is **no `rowDepth(row, indent)` function** —
  it would be a second, disagreeing reading of one name.
- **`setDepth` rewrites the whole lead** to `indent.repeat(depth)`. It is not "a splice on `lead`";
  it normalizes surplus indent bytes, which is observable (change 15).
- **An empty row takes no children.** Without this, `'- a⏎⏎\t- b'` makes the blank paragraph the
  parent of the bullet — measured, and one keystroke away under `separator: '\n'`.

A **split** row carves its own body at a literal: cell *k*'s `lead` is `''` for *k*=0 and `split.at`
otherwise. Round trip is concatenation.

### Parser

```ts
// parser/core/RowKind.ts  (new)
export interface RowKind {
	/** createMarkupDescriptor's OWN output, held — not copied field by field. `index` is the
	 *  option index, which is the same identity `resolveSlot.ts:77` already resolves marks by. */
	readonly descriptor: MarkupDescriptor
	readonly spec: ResolvedRowSpec
}
/** Non-throwing, props boundary — the row analogue of `markupError`, and the enforcement point
 *  for the four row rules. `createMarkupDescriptor` THROWS (`MarkupDescriptor.ts:59`), so the
 *  props path must ask this first, exactly as the mark path does. */
export function rowMarkupError(markup: Markup | undefined, spec: RowSpec): string | undefined

// A kind's two derived facts. No stored `open`, no stored `body`.
const isRaw  = (kind: RowKind) => !kind.descriptor.hasSlot
const isOpen = (kind: RowKind) => kind.descriptor.trailingGap !== undefined
```

`RowKind.descriptor.segments` is `SegmentDefinition[]`, not `readonly string[]` — the old text's
field type was wrong. What rows share with marks is `scanMarkupStructure` and the descriptor it
produces; the row scanner reads `segments` as literals and refuses any kind whose compilation
produced a dynamic segment (rule 2 above makes that unreachable, and the refusal is the pin).

```ts
// parser/types.ts
export interface RowToken {
	type: 'row'
	content: string
	/** INCLUDES the trailing separator when terminated, and — after the nest pass — the whole
	 *  subtree. Sibling positions therefore still ascend at every depth, which is what keeps
	 *  `anchorAt`'s walk shape. */
	position: {start: number; end: number}
	id?: number
	/** The option index. `undefined` ⇒ paragraph. */
	option?: number
	meta?: string
	lead: string
	slot: {content: string; start: number; end: number}
	children: Token[]                     // inline tokens of the body, absolute positions, text-edged
	rows: RowToken[]                      // child rows: indent-nested, or split cells
}

// parser/Parser.ts
export interface RowConfig {separator: string; indent: string}
class Parser {
	parse(value: string): Token[]                              // UNCHANGED
	parseRows(value: string, config: RowConfig): RowToken[]     // scan, then inline per row
}
```

`RowConfig` carries no `rows` array: the `Parser` is already rebuilt from `options`
(`TokenModel#parser`), so the compiled row kinds live on its own `MarkupRegistry` beside the mark
descriptors. One registry compiles both families. **There is no `RowRegistry`.**

`parseRows` is four linear passes and no fixpoint:

1. **Scan.** From offset *i*: consume the maximal run of `config.indent` → `lead`; try each row
   kind ordered by opener length descending then option index, accepting the first whose
   `segments[0]` is a literal prefix at that offset; walk its remaining literals forward with
   `indexOf`. A missing literal rejects the candidate. **A non-body gap whose closer starts past
   the row's own separator rejects the candidate.** A kind that is *open* stops its body at the
   next separator; a kind with a closing literal may cross separators — **but its match must end
   at a separator or at end of input, or it is rejected.** No match ⇒ paragraph, body to the next
   separator. Emit a flat `RowToken` with `lead`, `option`, `meta`, `slot`.
2. **Nest.** One stack pass over the flat list: `lead.length / config.indent.length` gives the
   candidate depth, clamped to `previous + 1`; an empty row takes no children; a split row takes
   no children. A parent's `position.end` extends to cover its subtree.
3. **Split.** For a kind with `split`, carve its `slot` span at `at` into child `RowToken`s of the
   option named by `split.as`.
4. **Inline.** For each non-raw row, run the *existing, unchanged* chain — `SegmentMatcher.search`
   → `PatternMatcher.process` → `acceptMatches` → `closeTrailingGaps(matches, length)` →
   `TreeBuilder.build` — over `value.slice(slot.start, slot.end)`, then shift the resulting token
   positions by `slot.start`. A raw row gets one text token spanning its body.

The end-at-a-separator rule in pass 1 is not decoration. Without it,
`'```ts⏎q⏎``` tail⏎next'` emits a `code` row that ends mid-line and a following paragraph starting
mid-line, which contradicts "the scan only ever looks at a row's own start" and breaks
`terminator === '' ⟺ document-final`.

`TreeBuilder.build` already guarantees text-edged children and yields exactly one empty text token
for an empty slot, so `groupRows`' re-implementation of that rule genuinely goes away.

**Deleted:** `rowPass`, `findSeparators`, `groupRows`, `rowTokenTerminator`, and
`closeTrailingGaps`' `separators` parameter — after the inversion both call sites pass `[]`, and
`:111`/`:114` reduce to `Math.max(match.end, scopeEnd)`. `RowBuilder.ts` collapses to
`acceptMatches` + `closeTrailingGaps(matches, valueLength)`.
`MarkupDescriptor.trailingGap` itself **survives**: `Base.stories.ts:72`'s `'@__value__'` is an
inline markup that still ends in a placeholder.

### Tree

```ts
// tree/types.ts
export interface RowNode {
	readonly kind: 'row'
	readonly id: Id
	/** THE row's kind: the index of its option, `undefined` for a paragraph. A SIGNAL, unlike
	 *  MarkNode.descriptor: a mark IS its markup, a row HAS a kind, and a turn-into must keep
	 *  the row's identity. */
	readonly option: Signal<number | undefined>
	readonly meta: Signal<string | undefined>
	/** INLINE children first, then CHILD ROWS. One list, so every generic walk in tree/ is
	 *  untouched. */
	readonly children: Signal<readonly TreeNode[]>
	inline(): readonly TreeNode[]      // children before the first row child
	rows(): readonly RowNode[]         // the row-child tail
	/** The row's own editable interior. DERIVED from children edges — proven over 3000
	 *  generated documents that a slot's range is exactly its children's outer edges. */
	slotRange(): {start: number; end: number}
	/** The row's own LINE, excluding its indent-nested subtree: what `turnInto` and `setDepth`
	 *  splice. Derived: `{start: position.start, end: rows()[0]?.position.start ?? position.end}`
	 *  for a nesting row, and `position` for a split row (its cells are inside its body). */
	lineRange(): {start: number; end: number}
	/** Structural bytes BEFORE the body: the indent run, or a cell's split delimiter.
	 *  Adoption-written; the clamp means the surplus bytes exist nowhere else. */
	lead: string
	position: {start: number; end: number}
	slot(): string                     // the interior's TEXT, joined from inline children
	range(): {start: number; end: number}
	// verbs
	turnInto(option: CoreOption | undefined, patch?: {meta?: string | null; text?: string}): boolean
	setDepth(depth: number): boolean
	splitAt(at: NodeAnchor): boolean
	moveTo(placement: RowPlacement): boolean
	remove(): boolean; duplicate(): boolean; insertAfter(text: string): boolean; mergeWith(next: TreeNode): boolean
}

export type RowPlacement = {parent: RowNode | null; index: number}
export type TreeNode = TextNode | MarkNode | RowNode          // shape unchanged, reach new

/** pairing[j] = the PRE-ORDER ROW index of the previous row that becomes new pre-order row j. */
export type Pairing = readonly number[]
```

`turnInto` takes `text` because the slash menu needs to strip the trigger span **and** retype the
row in one splice: `choose` computes `slot().slice(0, triggerStart) + slot().slice(triggerEnd)` and
passes it. Without it, ticket 11's assertion is unreachable. `splitAt` takes no kind: the tail's
kind is `continues ? this kind : paragraph`, which is the same one field.

`joinNodes` gains the config and becomes a pre-order join:

```ts
export function joinNodes(nodes: readonly TreeNode[], config?: RowConfig): string
// row arm:  preorderRows(nodes).map(row => row.lead + body(row)).join(config.separator)
```

`sliceWithin(nodes, start, end, config)` mirrors it. Note the one behaviour this exposes: slicing
*inside* a typed row now re-annotates a **partial** slot, so copying half a heading emits
`'# half'` (change 12).

### Adoption

- `adoptSiblings`' row arm keeps **kind-only pairing** (`adopt.ts:91-96`) — exactly what makes a
  turn-into preserve the id, the DOM element, the drag grip and the consumer's collapse state.
  `adoptRow` writes `option`, `meta` and `lead`.
- `snapshotNodeEquals`' row arm gains `option`/`meta`/`lead`, so a same-length retype can never be
  accepted by the prefix or suffix walk. It does **not** gain a terminator arm; there is none.
- `pairEquals`' row arm survives, but for a different reason than today's. Today it exists because
  "a permutation legally flips `terminated`" (`adopt.ts:348-352`) — that reason is gone. It now
  exists for the **lead delta**: it compares a row pair on `option`, `meta` and its **`inline()`
  children only** — never `children`, which would drag paired child rows into the comparison —
  under the pair's own content delta `token.slot.start − node.slotRange().start`, ignoring `lead`
  and `position`. This is load-bearing and measured: adding one `'\t'` changes a row's start delta
  by 0 while its children's is +1, so a position-delta comparison fails every pair and identity
  degrades to index pairing. Measured directly: `'a⏎⏎b'` → `'b⏎⏎\ta'` with `pairing:[1,0]` is
  refused today and the two rows swap content under fixed ids; the same permutation without the
  tab keeps ids on content.
- `resolvePairing` widens to pre-order rows: build `preorderRows(prev)` and
  `preorderRowTokens(parsed)`, keep the three gates (length, per-pair equality under its own delta,
  bijection), and produce a `Map<RowToken, RowNode>`. `adoptSiblings` gains a second, keyed lookup
  beside its positional walk — that is a real contract change to a function that also serves marks
  and text, and it is P3 work, not a clause. Adoption then walks the parsed row tree and, for each
  row token, adopts its paired node (or builds a fresh one) and writes
  `children = [...adoptedInline, ...adoptedChildRows]`. A flat root permutation is the degenerate
  case, so today's `movePlan` output stays valid input.
- Every `token.children` comparison becomes `[...token.children, ...token.rows]`: `adoptRow`,
  `snapshotNodeEquals`, `tree.buildNode`. Four sites, named because none of them were.
- **A structural edit with no pairing hint destroys row identity.** Proven: `resolvePairing` runs
  only when `window.pairing` exists (`adopt.ts:148`), `applyRange` is the only door, and the sole
  `Pairing` construction in non-spec code is `siblings.ts:113` inside `movePlan`. So a Tab-indent
  is an ordinary splice: measured, `'a⏎b⏎c'` → `'a⏎\tb⏎c'` destroys the indented row's node and its
  text child (`sameObject: false`). `setDepth` must therefore **emit a pre-order `Pairing`**, and
  it lands in P3 with the nesting pass, not in the verbs phase.
- **In-slot pairing is unbounded index pairing** (`adopt.ts:196-207`, the file's own comment).
  Cells are row children, so inserting a cell before or in the middle of a table row re-labels every
  downstream cell's id — measured on the nearest existing nested list: inserting at the end is
  clean, inserting first or middle shifts every id by one. P9 owns this, and its gate asserts ids.

### Anchors and DOM

- **`anchorAt` is NOT unchanged.** Its one-reading argument is a *parser invariant* and P1 deletes
  the invariant's source: `anchors.ts:8-14` names `RowBuilder.groupRows` as what "forces a row's
  first child to be a text token starting at the row's own start", and a typed row's children now
  cover only its slot. So `'# Title'` has no text over offsets 0–1, `anchorAt(roots, 0)` falls to
  `{after: owner}` — the **end** of the heading — and `selection.selectAll` breaks with it, because
  it seeds with `deps.anchorAt(0)` for exactly this reason (`selection.ts:90-97`). P1 adds a row
  arm: an offset covered by a row's lead or opener answers that row's slot start. `anchors.spec.ts`'s
  invariant prose is rewritten in the same commit.
- `offsetOfAnchor`, `adjacentMark`, `stepAnchor`, `findNode`, `reachable`, `shiftPositions`,
  `collectTree` — unchanged, because a row keeps one `children` list and sibling positions still
  ascend at every depth.
- `separatorSpan` → **`boundarySpan(roots, anchor, direction, config)`**: walks pre-order rows at
  every depth; the bytes between row A's content end and row B's content start are
  `config.separator + B.lead`.
- `entryAnchor` is rewritten. The shipped rule — "a row opening with a zero-width text then a mark
  enters that mark's slot" (`siblings.ts:143-149`) — is deleted, because a typed row's opener is no
  longer a child mark. A row enters its first inline text child at offset 0; a row with no inline
  children (a split row) enters `rows()[0]` recursively.
- `DomModel.#entryOf` (`DomModel.ts:222-228`) descends a row exactly one level to its edge child.
  Under nesting the last child **is a row**, so `{after: row}` resolves to a wrapper handle.
  Rewritten to descend recursively to the edge text/mark descendant.
- `tree/rowOf(roots, node): RowNode | undefined` — the innermost row containing a node. New, one
  pre-order walk; the overlay's `mode` needs it and nothing else answers it (`rootIndexOf` answers
  a *root* index, and P10 deletes it).
- **`bind` gains a second child-sequence host, and `applyEditableState` becomes idempotent.**
  `ElementBindings` gains `rowSequenceHost` beside the shipped `childSequenceHost`, fed by an arity
  change on the shipped SPI: `TokenModel.children(ownerId, part: 'inline' | 'rows' = 'inline')`.
  Named parts, not an array, because the caret mapping needs the split between `inline()` and
  `rows()` deterministically and registration order cannot give it. Two changes to
  `applyEditableState` (`bind.ts:270-294`), and the second is the one the old text missed:
  1. the freeze climb runs once per registered host;
  2. the climb **removes** `contenteditable` from every element *on* either path and sets `false`
     only on their off-path siblings. Today it is **add-only** — it removes the attribute from the
     token element and the two hosts alone (`:278-279`) — and `applyMountState` re-runs it only when
     a host's *object identity* changes (`:238-241`). So a row whose empty `<div>{rows}</div>` was
     frozen while it had no children stays frozen when it gains them, and the newly nested rows are
     untypeable. A gate that mounts an already-nested document passes anyway; the gate must nest at
     runtime and *then* type.

### The new features

There is **no `RowsController` and no `store.rows`.** Each of the seven members it was to own has an
existing owner, and a facade over three owners is a fourth place a fact lives:

| was | is |
|---|---|
| `descriptor(name)` | gone with `name`; the kind is the option index |
| `insert(after, name, text)` | `RowNode.insertAfter(text)` (shipped) — its only caller was `menu.run` |
| `turnInto(row, …)` | `RowNode.turnInto(option, patch)` |
| `move(ids, placement)` | `store.block.move(placement)` — the drag owner already calls the move (`BlockController.ts:456`) |
| `depthOf(row)` | deleted; depth is the recursion index the adapters pass as `RowProps.depth` |
| `entries(query, row)` | `OverlayController.entries` |
| `view(id)` | deleted; the consumer keys view state by the published `node.id` |

```ts
// features/overlay/OverlayController.ts — gains three members, mark arm untouched
readonly entries: Computed<readonly MenuEntry[]>       // options with `menu`, filtered by the query
readonly mode: Computed<'insert' | 'turnInto' | undefined>   // the trigger's row is only the trigger?
choose(pick: {option?: CoreOption; value?: string; meta?: string}): boolean

// features/slots/resolveSlot.ts
export function resolveNodeSlot(node: TreeNode, ctx: SlotContext): readonly [Slot, Record<string, unknown>]
/** Consecutive siblings sharing a `group` component reference, in one pass. ONE implementation:
 *  grouping at render time in both adapters is the same defect `9024586b` fixed for suggestions. */
export function resolveRowGroups(rows: readonly RowNode[], ctx: SlotContext): readonly RowGroup[]
export type RowGroup = {Group?: Slot; rows: readonly RowNode[]}

// features/block/BlockController.ts — store.block, name and role unchanged
readonly selected: Computed<readonly Id[]>   // DERIVED from (roots(), selection.anchors()): the
                                             // maximal pre-order rows fully covered. No second store.
move(placement: RowPlacement): boolean       // moves `selected`, normalized to maximal subtrees
rowAtPoint(clientX: number, clientY: number): {id: Id; rect: DOMRect} | undefined
// state.drop holds the RESOLVED {placement, rect} — what is painted and what will happen are one fact

// features/history/HistoryModel.ts — store.history
export type EditRecord = {
	origin: 'edit' | 'foreign'
	base: string; next: string; window: Window
	selectionBefore?: Anchors
}
class HistoryModel {
	undo(): boolean; redo(): boolean
	readonly canUndo: Computed<boolean>; readonly canRedo: Computed<boolean>
}

// tokens/seam/TokenModel.ts
readonly edits: Event<EditRecord>
/** Undo/redo's write. Adopts (uncontrolled) or emits and records `lastEmitted` (controlled),
 *  and emits NO EditRecord — which is why there is no `#replaying` latch. */
replay(value: string, selection?: Anchors): boolean
```

**History records at `sink.commit`, not at `fold`.** Proven: in controlled mode `sink.commit`
returns early on `deps.controlled()` and never calls `fold` (`valueBoundary.ts:90-98`), so a
fold-sourced stack has **no `'commit'` record at all** in the mode the repo's whole seam is designed
around, and its `selectionBefore` would be read at echo arrival — after the caret already moved.
`sink.commit` is the one place both modes pass through with the pre-image in hand:
`deps.tree.value()` is unmutated there by `CommitSink`'s own contract. `arrive` emits an
`origin: 'foreign'` record when the value is not an echo of `lastEmitted`; `reparse` emits nothing.
`HistoryModel` coalesces consecutive single-character inserts at contiguous anchors within 500 ms,
and on `'foreign'` clears redo and pushes a boundary. Undo is `tokens.replay(base, selectionBefore)`.

The `#replaying` flag is deleted before it is written. In controlled mode the round trip
`replay → onChange → parent setState → re-render → props.value watch → arrive` is not synchronous, so
a boolean cleared when `replay` returns is already `false` when the echo lands — a latch that fails
exactly in the mode it exists for, which is `pendingStructural` again (ADR-0008). The structural
answer is that `replay` is simply not an edit path.

## Ownership map

| Concern | Owner | Note |
|---|---|---|
| Row grammar, opener scan, nesting pass, split pass | `parser/core/RowScanner.ts` + `RowKind.ts` | new; `MarkupRegistry` compiles both families with `createMarkupDescriptor` |
| Inline matching | `parser/core/{SegmentMatcher,PatternMatcher,TreeBuilder}` | **byte-identical**; a row literal never enters the alternation |
| Nodes, identity, adoption, pairing | `tree/{tree,adopt}.ts` | kind-only row pairing; `Pairing` over pre-order rows |
| Anchors, boundaries, entry, plans, `rowOf` | `tree/{anchors,siblings}.ts` | the ONE place an offset is formed (ADR-0003) |
| Value, verbs, splices, seam, `edits` | `tokens/seam/TokenModel.ts` | `rowConfig` REPLACES `rowSeparator`; `edits` + `replay` added |
| DOM binding, caret, editable topology | `tokens/dom/{bind,DomModel,SelectionDriver}.ts` | `rowSequenceHost`; the climb becomes idempotent |
| Keyboard (Enter / Backspace / Tab / Mod+Z) | `features/keyboard/rowKeys.ts` | replaces `blockEdit.ts`; wired by the existing `enableInput` |
| Undo/redo stack | `features/history/HistoryModel.ts` → `store.history` | new; no DOM listener, hence `*Model` |
| Overlay trigger, entries, `mode`, `choose` | `features/overlay/OverlayController.ts` | gains three members; the mark arm is untouched |
| Block selection, multi-move, drag, drop, geometry | `features/block/BlockController.ts` → `store.block` | **name and role unchanged** (CONTEXT.md records the decision) |
| Component + props resolution, group runs | `features/slots/resolveSlot.ts` | `resolveMarkSlot` → `resolveNodeSlot`; `resolveRowGroups` |
| Row/group/cell components, chips, avatars, board, cards, collapse state | the consumer | core owns structure and behavior, the consumer owns rendering (2026-08-19 decision, unchanged) |

## Behavior changes and superseded ADRs

**ADRs.** **ADR-0009 superseded by ADR-0010, "Rows are typed and nest"**: the separator stays
structural, and a row's *lead* and *opener* join it as structural bytes no caret may enter; nesting
is no longer deferred. **New ADR-0011, "The block skeleton is scanned before inlines are parsed"** —
and its case is the concept count, with the measured split stated: the 12× belongs to P0's loop fix,
the inversion's own margin is ~1.2×, and the parser layer grows ~+100 lines.
*(Landed in P1 as ONE record, `ADR-0010`, merging the two above; the parser grew +136 and the whole
change +418 production lines. `0011` is unused — the next new ADR takes it, not `0012`.)*
**ADR-0006 amended by ADR-0012, "The editor owns undo"**: the guard stays fail-closed, and
`historyUndo`/`historyRedo` become expressed rather than dropped. **ADR-0007 is upheld and
strengthened** — row pairing stays kind-only, and `Pairing` widens to pre-order so a re-parent and a
Tab keep ids. **ADR-0001/0002/0004/0005/0008 stand.** **ADR-0003's gate DOES need widening**, against
the old text's claim: `addressSpace.spec.ts:53` is `/\.(?:position|slotRange)\b/`, and the new
structural field is **`lead`**, which `features/keyboard/rowKeys.ts` and
`features/block/BlockController.ts` both want. Add `|lead` — one character of regex, and the whole
difference between an enforced rule and a paragraph.

**Observable behavior:**

1. An inline mark can no longer span a row boundary. *Proven consequence:* today
   `'---\n__value__\n---'` and `'```__meta__\n__value__\n```'` match **only at offset 0**; that
   accident is replaced by row kinds with closing literals, which match anywhere.
2. A row-option markup matches **only** at a row's own start: `'load 5# peak'` stops taking a
   heading (ticket 01), and repeats stop nesting inside their own slot (ticket 06).
3. A row-option markup **with a closing literal may cross separators**, but only through its body
   gap and only if its match ends at a separator — fences and frontmatter work at any offset
   (tickets 07, 09) while `'- [x hi⏎there] more'` stays two rows.
4. `separator` default `'\n\n'` → `'\n'`: one line is one row, so a tight list is per-item rows
   (ticket 05). *Proven:* `'- a⏎- b⏎- c'` gives three sibling rows under `'\n'` and a three-deep
   staircase under `'\n\n'`.
5. **Keeping `separator: '\n\n'` is now worse than the staircase it replaced.** Under `'\n\n'` a
   tight list scans as ONE bullet row whose slot is the flat text `'a\n- b\n- c'` — the inner items
   are not nested, they are invisible. Declared, not fixed: `'\n'` is the default.
6. **Shift+Enter splits the row instead of breaking inside it.** Under one line per row a soft
   break has no representation that does not make some byte significant in every stored document,
   so the `'\n'` the generic `insertLineBreak` path writes lands as a boundary — a split that takes
   none of Enter's own rules. Deferred to a named follow-up (a `softBreak` string scanned only
   inside a row's body). Measured at P2, where this item first read "unbound".
7. `indent` is a new prop defaulting to `'\t'`: a leading tab run at a row start becomes structural.
8. **`indent: ''` turns off row TYPING on every indented line, not just nesting** — a line whose
   first character is not the opener is a paragraph. A consumer storing leading tabs as content
   loses row kinds on those lines. Declared.
9. **Space-indented markdown gets neither nesting nor a kind** under the default `indent: '\t'`:
   `'    - space child'` is a paragraph whose body is the whole string. The "over-indented paste
   round-trips and merely renders shallower" promise holds only for tab-indented text; CommonMark
   emits spaces. Declared; `indent: '  '` is the consumer's lever, and an odd run under it degrades
   the same way.
10. **CRLF is unhandled, in both the old shape and the new.** Under `separator: '\n'` a `'\r'` lands
    inside the row's slot. Not a regression, and not fixed here — stated because the old text
    claimed nothing about it.
11. Enter, Backspace-at-row-start and Tab change meaning per row kind, through exactly two declared
    fields. Tab is consumed only when the caret's row declares `indents` or is a split cell, so Tab
    still leaves the field elsewhere (ADR-0002's accepted cost preserved).
12. Copying part of a typed row emits a **partial re-annotation**: half a heading copies as
    `'# half'`. New observable clipboard behaviour.
13. `/` on a row that already has text converts it (ticket 11).
14. `history` defaults to **true**: Ctrl/Cmd+Z goes from doing nothing (ADR-0006 swallowed it) to
    undoing. Strictly an improvement, declared because it is observable.
15. **Tab normalizes an over-indented row's lead.** `setDepth` rewrites the whole lead to
    `indent.repeat(depth)`, so surplus indent bytes a paste preserved are lost on the first Tab.
    A choice, not a fix — the alternative is two disagreeing readings of "depth".
16. **Enter on an empty NESTED row of any kind outdents.** Under the single demote ladder there is
    no per-kind `enterEmpty`, so an empty nested quote outdents where the old table said it would
    become a paragraph. At depth 0 the two are identical. A choice, declared.
17. A row renders through its kind's component; `slots.block` becomes the **paragraph** component;
    `resolveMarkSlot` stops throwing for a row (`resolveSlot.ts:72-76`). **Every block-layout DOM
    snapshot changes shape** — rows nest, groups add wrappers. Diff and explain each; never
    regenerate.
18. Consecutive siblings sharing a `group` component gain a wrapper element.
19. A markdown table stops being one atomic mark: cells become rows and caret motion through a
    table changes completely.
20. Drag changes depth and parent, and a drop moves the whole block selection.
21. The caret can no longer sit inside a row's lead or opener, and neither is `textContent`. Any
    test asserting a row's text includes `'- '` changes.
22. **Nothing stops a row being nested under a kind whose component renders no `{rows}`** — a
    heading, a divider. The content stays in the value and round-trips; it is invisible until the
    row is outdented. This is what deleting `nests` costs, and it is Notion's own behaviour for
    headings. Declared as a choice.

**Published API broken:**

- `moveTo` leaves `TextNode`/`MarkNode` and `NodeCommands`; it becomes
  `RowNode.moveTo(placement: RowPlacement)`. Every in-repo caller is block layout
  (`BlockController.ts:456`, `markNode.spec.ts`'s `rowSetup` cases).
- `Pairing`'s domain changes from root indices to pre-order row indices. Type-identical, semantics
  not.
- `tree.rootIndexOf` and `TokenModel.rootIndexOf` are **deleted**. Sole non-spec caller is
  `BlockController.ts:448-449`, which P10 rewrites; and "the index of the ROOT whose subtree
  contains `id`" stops being well-defined once rows nest.
- `Parser.parseRows(value, separator)` → `parseRows(value, config: RowConfig)`;
  `RowToken.terminated: boolean` is **removed with no replacement**, plus `option`/`meta`/`lead`/
  `slot`/`rows`. `closeTrailingGaps(matches, separators, len)` → `closeTrailingGaps(matches, len)`.
- `TokenModel.rowSeparator` → `TokenModel.rowConfig: Computed<RowConfig | undefined>`.
  `rowSeparator` does **not** survive as a derived read: a census of its seven readers shows six ask
  a boolean, which `rowConfig() !== undefined` answers, and the seventh is the parse policy — which
  is `rowConfig` itself. `SlotsFeature`'s SSR gutter is safe because `rowConfig` is props-derived,
  exactly as `rowSeparator` was (rejection D8 is not re-opened).
- `SlotsFeature.blockComponent`/`blockProps` are deleted: `resolveNodeSlot` answers component and
  props for text, mark and row alike, so `Block` asks it exactly as `Token` does. It absorbs the
  `className`/`style` merge both adapters currently do by hand (`Block.tsx:60-66`,
  `Block.vue:26-37`). `CoreSlots.block`/`CoreSlotProps.block` **stay** — published and documented.
- `resolveMarkSlot` → `resolveNodeSlot`; `SlotName` keeps `'block'` as the paragraph component.
- `TokenModel.setValue(text, enterRoot?)` → `setValue(text)`. Sole caller is `blockEdit.ts:31`,
  which P6 deletes; `#enterRoot` keeps its second internal caller.
- `CoreOption` gains `row` and `menu`; it does **not** gain `name`. `overlay.data` widens from
  `string[]` to `ReadonlyArray<string | {value, meta?, label?}>`; `filterSuggestions` widens with it.
- `OverlayController.choose(value, meta?)` → `choose(pick: {option?, value?, meta?})`;
  `select({value, meta})` is unchanged for mention pickers.
- `BLOCK_MENU_ITEMS` **keeps its shape** (`{label, iconClass, run: (block) => void}`) and is
  demoted to the default *row-control* menu; the slash menu's entries come from
  `overlay.entries`. Unifying the two is a rename, not a reduction: both adapters' `BlockControls`
  and the shared `Drag` spec depend on this list, and its members are verbs, not kinds. Its gate
  moves from `rowSeparator` to `rowConfig`.
- New core exports: `RowNode`, `RowPlacement`, `RowSpec`, `RowKind`, `RowConfig`, `MenuSpec`,
  `MenuEntry`, `EditRecord`, `HistoryModel` (closes ticket 03 — React's
  `Extract<TreeNode, {kind:'row'}>` in `Block.tsx:15` goes away).
- New adapter exports: `RowProps`, `useControlRef`, `BlockMenu`. **Not** `GroupProps`, **not**
  `useRowState`.
- New props: `indent`, `history`.
- SPI arity change: `TokenModel.children(ownerId, part?: 'inline' | 'rows')`.

**Deliberate non-changes:** `Mark`/`mark` keep their shipped shape — breaking them buys nothing this
spec needs, and nesting the row component inside `row` is what keeps `row`/`Row` from becoming a
third case-only pair (api-v2 issue 01's defect). `store.block` keeps its name and role.
`MarkNode.slotRange` stays a stored field; making it derived like `RowNode.slotRange()` is a
worthwhile follow-up with its own diff, not a rider here.

**A decision this spec does not take, and P2 must not take silently.** `1235da9a` designed and
measured green the outright deletion of the `layout` prop and held it as a *published-API* question,
on the discriminator "a configured separator is the mode". P2 flips the default separator to
`'\n'`, which makes every editor that configures nothing a block editor — i.e. **P2 destroys that
discriminator**. Either the deferred deletion is decided before P2 lands, or the deferral is
re-recorded against the new default. Taking it here would be deciding a published-API question from
the inside, which `494a7222` reversed once already.

## Phases

Each phase lands on `pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check &&
pnpm run format:check` green, with no caller referencing a removed symbol. Thirteen phases, not
ten: three of the old ten hid a project inside a clause and are split here.

**P0 — The two hot loops in `rowPass`. No design change.**
`findSeparators`' `matches.some(...)` (`RowBuilder.ts:75`) becomes a two-pointer walk over the
merged union of accepted extents; `closeTrailingGaps`' `separators.find(...)` (`:111`) becomes a
binary search. The fixpoint, `findSeparators` and `groupRows` all stay. ~20 lines, its own
revertible commit, no public surface touched.
*Proving test:* an equivalence fuzz — 40 000 (document, separator) pairs over a row-opener and
inline-markup alphabet under `'\n'` and `'\n\n'`, asserting `parseRows` output is byte-identical
before and after (**measured: 0 mismatches**) — plus a cost pin at 4000 rows. *This pin reddens:*
mutating the binary search's `<` to `<=` produces 1361/40 000 mismatches.
*Exit:* green; **measured 27.30 → 2.20 ms at 4000 rows and 92.20 → 4.60 ms at 8000**, so every
later phase is judged against the fixed baseline, not the defect.

**P1 — Row kinds and the scan-first parse. Flat: no nesting, no split.**
`RowKind` compiled by `createMarkupDescriptor` on `MarkupRegistry`; `rowMarkupError` and the four
row rules; `RowScanner`; `Parser.parseRows(value, RowConfig)`; `RowToken`'s new fields;
`closeTrailingGaps` loses its `separators` parameter; delete `rowPass`/`findSeparators`/`groupRows`/
`rowTokenTerminator`. Tree: `RowNode.option`/`meta`/`slot()`/`slotRange()`/`lineRange()`,
`adoptRow`, `snapshotNodeEquals`, `pairEquals`, `joinNodes(nodes, config)`, `sliceWithin`.
`TokenModel.rowConfig` replaces `rowSeparator` **in the same commit**. Slots: `resolveNodeSlot`
absorbing `blockComponent`/`blockProps` and the `className`/`style` merge. **`anchorAt` gains a
row arm and `anchors.spec.ts`'s invariant prose is rewritten** — this is not optional and it is not
small (see Anchors). **`renderSubscription` gains an `option`/`meta` arm** for rows. Adapters render
a row through its kind's component. `indent: ''`, separator default unchanged.
*Proving tests, each chosen because it reddens when its own mechanism breaks:*
- `tokensToDebugTree` inline snapshots for the four closed tickets — `'load 5# peak'` is one
  paragraph whose `#` is text (01); `'- a⏎- b'` is two siblings, not a staircase (06);
  `'x⏎```js⏎q⏎```'` matches the fence mid-document (07); `'pre⏎---⏎a: 1⏎---'` matches frontmatter
  mid-document (09). *Reddens* on a scanner that types every row a paragraph — which the round-trip
  property cannot see.
- `'```ts⏎q⏎``` tail⏎next'` yields a `code` row and a paragraph that starts at a line start —
  the end-at-a-separator rule. *Reddens* without it.
- `'- [x hi⏎there] more'` is two rows, not one todo — the body-gap-only rule. *Reddens* without it.
- `anchorAt(roots, 0)` on `'# Title'` answers the slot's first text at offset 0, and
  `selection.selectAll()` on the same document selects from there. *Reddens* today.
- `row.turnInto(todo, {meta: 'x'})` changes the value `renderSubscription(row)` produces.
  *Reddens* on today's row arm, which reads `children()` alone — and without it every row control
  in the showcase (todo checkbox, callout tone, code `<select>`) is silently dead.
- a round-trip property `joinNodes(parseRows(v, cfg), cfg) === v` over documents generated from the
  row alphabet plus a **pinned** inline corpus. Scoped deliberately: the unrestricted property is
  **false today**, measured on `b0` at 9 failures / 20 000 generated inline strings —
  `'==<status:>===='` → `'==<status:>========'`, `'==@[]()===='` → `'==@[]()========'`,
  `'==# ===='`. That is a pre-existing inline-layer defect (identical answers from `joinNodes`,
  `toString` and `parseRows`); it is filed as its own ticket and is not P1's to fix.
*Exit:* five checks green; the existing `Notion` story renders from row options with its DOM
snapshot diffed and explained. Note the cost: P1 ports `options.tsx` and retires
`TableMark.tsx`/`PropertiesMark.tsx` as marks, so the table has no editable representation until P9.

**P2 — `'\n'` becomes the default separator.**
`PropsModel.separator` default; story and spec updates.
*Blocker to clear first:* the `layout`-deferral collision above. This phase does not land until that
question is answered in writing.
*Proving test:* the 05/06 specs, plus the P0 cost guard re-run at the new default.
*Exit:* green.

**P3 — Nesting, and the identity mechanism that makes it survivable.**
`indent` prop; `lead`; the stack pass with the depth clamp, the empty-row rule and the subtree
`position.end`; `children` = inline-then-rows with `inline()`/`rows()`; the four
`token.children` → `[...children, ...rows]` sites; `resolveRowGroups` plus recursive `Row` in both
adapters; `boundarySpan`; `entryAnchor` rewrite; `DomModel.#entryOf` recursive rewrite;
`rowSequenceHost` + the **idempotent** `applyEditableState` climb; `Pairing` over pre-order rows and
`adoptSiblings`' keyed lookup; **`RowNode.setDepth` emitting a pre-order `Pairing`** — moved here
from the verbs phase because P3's own exit criterion is otherwise unmeetable (a Tab-indent is an
ordinary splice with no pairing hint, and `resolvePairing` never runs).
*Measurement this phase owes before it writes Vue's recursive `Row`:* rejection D9 says a per-node
`v-if` in Vue's `Container` pushes 2N stray text nodes into the editing host, and `Container.vue:49`
carries that measurement in a comment. A recursive Row is that shape once per nesting row. Count the
container's text-node children in a nested prototype first. Named fallback if the cost returns:
group wrappers become a `data-group` attribute plus sibling CSS, with no tree change.
*Proving tests:*
- `tokensToDebugTree` inline snapshots over indented fixtures, including the over-indent clamp and
  the blank-line rule. Mandatory, because **the round-trip property is structurally blind to
  nesting**: `[A, B]` and `[A[B]]` join to the same string. A round-trip is not a nesting pin.
- an identity oracle asserting **object identity**, not counts: Tab-indenting row *k* of a
  three-row document keeps all six node objects. *Reddens today* — measured, the indented row's
  node and its text child are both replaced.
- a browser spec that presses Tab to nest and **then** types into the nested row, asserting the
  emitted value. Worded this way on purpose: a spec that mounts an already-nested document passes
  against the add-only climb.
*Exit:* green; nested rows are typeable in both adapters, and a Tab keeps every id.

**P4 — Row verbs on the nested tree.**
`turnInto(option, {meta, text})`, `splitAt`, `insertAfter`, `duplicate`, `remove`, `mergeWith`,
each corrected for nesting. Named, because each is a real defect under the new shape and none was in
the old text: `removePlan` is root-only (`siblings.ts:40-41`) and must widen or a nested final row's
removal leaves a dangling separator; `#insertAfter`/`#enterRoot` resolve through
`roots().indexOf(node)` (`TokenModel.ts:573-593`) and decline for nested nodes; `duplicate` composes
its separator from `props.separator()` and no lead (`:519-527`), so a nested copy lands at depth 0;
`applyAfter` splices at `node.position.end` (`transactions.ts:96`), which under nesting is past the
whole subtree; `turnInto` and `setDepth` splice `lineRange()`, not `position`.
*Proving test:* per-verb specs asserting the exact emitted value string **and** object identity of
every surviving row, each stated over a **nested** document — a turn-into on a row with two children
keeps all three ids. On a flat document these pass while proving nothing, because `applyStructural`
puts the whole subtree inside the window and only index coincidence saves the ids.
*Exit:* green.

**P5 — `movePlan` as a common-ancestor splice.**
Its own phase because it changes four independent things at once and the old text gave it one
bullet: addressing (`to: number` → `RowPlacement`, with an "is the placement inside the moved
subtree" test the tree has no parent pointers for), a **set** of ids normalized to maximal
subtrees, re-leading every descendant by a depth delta, and a `Pairing` over an arbitrary pre-order
splice where `rotate` on a flat slice does not generalize. Note the consequence the old text missed:
re-leading rewrites bytes inside the moved span, so adoption's "a verified move carries the
selection through unchanged" short-circuit (`adopt.ts:222`) is no longer sound for a depth-changing
move and must fall back to `map`.
What it *deletes*: the terminator normalization, its fail-closed door, and `siblings.ts:92`'s
scan-the-siblings recovery of the separator setting — all three are gone with the stored terminator.
*Proving test:* a property test over generated nested documents — for every legal placement the
result re-parses to the intended tree and every moved node keeps its object identity; every illegal
placement answers `undefined`. *This pin reddens:* deleting the re-leading step must turn the
property red, and deleting the inside-own-subtree test must turn the illegal-placement half red.
*Exit:* green; `RowNode.moveTo(placement)` and `store.block.move(placement)` are the only movers.

**P6 — The row keymap.**
`features/keyboard/rowKeys.ts` replaces `blockEdit.ts`; `handleRowParagraph` extended to
`insertLineBreak`; `setValue`'s `enterRoot` parameter deleted with its sole caller. One ladder, two
arms:

```ts
/** depth > 0 ⇒ setDepth(depth-1); depth 0 and typed ⇒ turnInto(undefined); else false. */
export function demote(row: RowNode): boolean
```
Enter at the end of a non-empty row: `continues` ⇒ another row of this kind at the same lead, else a
plain row. Enter mid-row: `splitAt`. Enter on an empty row: `demote`, and on `false` insert a plain
row. Backspace at the row's first caret position: `demote`, and on `false` `mergeWith(previous)`.
Enter inside a raw closed body inserts `'\n'`. Tab/Shift+Tab: `setDepth` when the row declares
`indents`; move to the next/previous cell when the row is a split child; otherwise not consumed.
*Proving test:* a table-driven unit spec, one case per rule × caret position × depth — including
Enter on an empty **nested** row (outdents) and on an empty root row (inserts) — plus a
shared-harness browser spec typing `- a⏎b⇥c⏎⏎` and asserting the emitted value at each step.
*Exit:* green; Enter continues a list, Enter on an empty item exits it, Backspace at row start
demotes, Tab/Shift+Tab renest.

**P7 — Slash menu: entries in core, insert and turn-into.**
`Option.menu`; `overlay.entries` as a `Computed` over options with the query pass reusing
`filterSuggestions`; `overlay.mode` via the new `tree/rowOf`; `choose({option})`; `BlockMenu` in
both adapters; `overlay.data` widening.
*Proving test:* ticket 11's currently failing assertion — a row reading `plain row`, `/`,
`Heading 1` must emit `'# plain row'`, not `'plain row# '` — which is reachable only because
`turnInto` takes `text`; plus an insert case on an **empty nested** row that asserts the caret lands
in the new row (today `#insertAfter` declines for a nested node and the caret does not move).
*Exit:* green; the showcase's menu component contains no filtering and no insert logic.

**P8 — History, both modes.**
`EditRecord`, `TokenModel.edits` emitted at `sink.commit` and at foreign `arrive`,
`TokenModel.replay`, `HistoryModel`, the `Mod+Z` keydown arm, the two inputType arms, the `history`
prop.
*Proving test:* type/undo/redo restores value **and** caret, run in **both** controlled and
uncontrolled mode — the controlled case is the point, because a fold-sourced stack has no record at
all there; a coalescing case; a structural verb (`duplicate`) is its own step; an undo of a **row
move** that asserts every row keeps its id (a `setValue`-based undo carries no `Pairing` and
re-pairs by index, which puts drag state and block selection on the wrong rows); an assertion that
`historyUndo` no longer reaches `dropUnexpressedInput`. *This pin reddens:* replacing `replay` with
`setValue` must turn the controlled test red by re-entering the stack.
*Exit:* green; ADR-0012 written.

**P9 — Split rows: editable cells.**
`split: {at, as}`; anonymous row kinds; the cell projection inside `body`; Tab between cells; the
`rowMarkupError` rule that `split` excludes `indents`.
*Proving test:* `'| a | b'` yields two cell rows and round-trips; `'| a | b⏎next'` round-trips
byte-exactly (**the old text's own P8 pin used the document-final case, which is the one the broken
projection rule happened to satisfy** — 4.7% of documents failed and none of them looked like that
fixture); a browser spec typing into cell 2 asserts the emitted value; a mention inserted in a cell
parses as a mark inside that cell's children; and an **id oracle**: typing `' | '` into column 2 of
a five-column row must not re-label columns 3–5. That last one *reddens today* — in-slot pairing is
unbounded index pairing, measured.
*Exit:* green; the database table is editable in place.

**P10 — Block selection and vertical nested drag.**
`store.block.selected` derived from `(roots(), selection.anchors())`; Esc escalation, Shift+arrows,
Mod+A scope; `rowAtPoint` — binary search over roots, then recursive descent into the hit row's own
`rows()`, because a parent's box **contains** its children's; `state.drop` holding a resolved
`RowPlacement`; drop → `store.block.move`. Deletes `tree.rootIndexOf` and `TokenModel.rootIndexOf`.
*Explicitly out of scope:* **cross-axis hit-testing.** `rowAt`'s stated premise is "rows tile the
container vertically in tree order" (`BlockController.ts:232`), and two mandated blocks break it —
a table row's cells share a Y span, and the board's columns are a horizontal flex row. A Y-descent
into either returns an arbitrary child, and the `nearest` fallback returns one confidently. A
per-kind drag axis is a follow-up with its own phase; P12's showcase suite must not assume it.
*Proving test:* a Playwright spec that Shift-selects two rows, drops them **into** a toggle at a
chosen depth, and asserts both the emitted value's indentation and that every moved node kept its
id; plus the deferred experiment this spec owes: after the drop, assert the consumer's collapse
state still tracks the moved toggle. If a cross-parent drop loses it, that is the measurement that
buys `store.block.collapsed: Signal<ReadonlySet<Id>>` — and not before.
*Exit:* green; nested drag preserves identity.

**P11 — `@markput/notion` and the React showcase.**
The option file above, the components, the theme, the showcase page, and `Notion.fixtures.react.tsx`.
*Proving test:* a React browser suite driving slash-insert, slash-turn-into on a row with text, Tab
nesting, undo, and a within-column card drag; plus a CI grep that `packages/notion/src` imports
nothing from `@markput/core/src` and calls neither `store.edit` nor `store.tokens`.
*Exit:* green.

**P12 — The Vue fixtures and the shared-spec suite.**
Its own phase because it is the single largest unstated deliverable in the old text. `Notion` is
React-only today — `Notion.stories.react.tsx` (96 lines), `Notion.react.spec.tsx` (123),
`options.tsx` (74) and four components — and AGENTS.md's shared-spec harness requires
`Notion.stories.ts` + `Notion.spec.ts` + `Notion.fixtures.react.tsx` + **`Notion.fixtures.vue.ts`**,
i.e. a Vue implementation of every block: toggle, board, columns, cards, the table, the properties
panel, the metric grid, the bookmark card, the comment thread.
*Proving test:* the P11 suite, promoted to `Notion.spec.ts` and run by both projects, so a
divergence between the adapters is a failing test rather than a difference nobody diffs.
*Exit:* the page in `showcase.md` renders in both frameworks and every interaction in its
"Interactions that must work" list passes.

## Risks and the mitigation for each

1. **`movePlan` under nesting and multi-selection is the highest-risk function in the design.**
   *Mitigation:* it is P5, alone, with a property test as its gate; fail closed when the affected
   span does not tile or when the placement is inside the moved subtree; the selection set
   normalized to maximal subtrees before planning. The clause the old text feared most — terminator
   normalization and its fail-closed door — is **deleted**, not mitigated, because the terminator is
   derived.
2. **Nested rows frozen by `applyEditableState`, at runtime rather than at mount.** The climb is
   add-only and `applyMountState` short-circuits on host identity, so a row frozen while childless
   stays frozen when it gains children. *Mitigation:* the idempotent clear-then-set climb in P3,
   gated by a browser spec that nests at runtime and then types. The alternative — deleting the
   sibling-freeze walk entirely, since every production hit is an unregistered consumer checkbox
   and this spec mandates `useControlRef()` for exactly those — is **measured** (3 red React tests,
   6 red Vue) and deliberately left as its own follow-up commit.
3. **A stray closing literal fuses unbounded rows on one keystroke.** This is the dangerous
   direction, and the old text named the harmless one. `'a⏎---⏎b⏎c⏎d⏎---⏎e'` is 7 rows today and 3
   under a naive scan, with `b c d` swallowed as raw frontmatter — typing `---` above an existing
   `---` collapses everything between them into one uneditable row. *Mitigation:* the body-gap-only
   rule plus end-at-a-separator bound the damage to one row's body; a closing literal *inside* a raw
   body still ends the row early, which is the same declared limitation `__value__` has today, with
   a pinned spec.
4. **A split cell cannot contain its delimiter.** *Mitigation:* declared; the follow-up (a per-kind
   escape scoped to the cell body) is named and deliberately not built.
5. **Soft breaks are lost under `separator: '\n'`, and `'\n\n'` is now a worse fallback than it
   was.** *Mitigation:* declared as changes 5 and 6, with the `softBreak` follow-up named.
6. **`Pairing` over pre-order is proven only for root permutations today, and a Tab has no hint at
   all.** *Mitigation:* `setDepth` emits a pairing (P3); keep all three gates plus a pre-order
   length gate; a property test that a rejected pairing degrades to index pairing without corrupting
   the tree or duplicating a node.
7. **Parse cost at document scale.** *Mitigation:* the guard lands in **P0** against today's shape,
   is re-run at P2's new default, and is **re-baselined at P3 and P9** — the P2-era generator
   contains neither indented documents nor split rows, so left where it was it would pin an
   intermediate shape. There is no incremental parser and there will not be one in this design.
8. **Two row kinds sharing an opener prefix.** The showcase does **not** avoid this — the old text's
   claim that it did was wrong twice over: its "safe" divider `'***__slot__'` swallows
   `'***emphasis*** here'` into an `<hr/>` that drops the text from the render while the value keeps
   it. The showcase now uses `'---__slot__'`, which collides with `properties`
   (`'---\n__value__\n---'`) **by design**. *Mitigation:* longest-opener-first is deterministic and
   correct here — `'---\n'` beats `'---'`, so a `---` line followed by a matching close is
   frontmatter and a lone `---` is a divider; `rowMarkupError` rejects two kinds compiling to an
   *identical* opener; pinned by a spec over both shapes.
9. **Snapshot churn across every block-layout story.** *Mitigation:* AGENTS.md's rule, enforced per
   phase — diff the old and new structure, explain the diff, never regenerate.
10. **Collapsed rows must be hidden, not unmounted.** An unpainted row leaves `bind`
    (`bind.ts:138-141`), so `#entryOf`, `'end'`, select-all's end seed and every arrow that resolves
    through the last root walk into a row with no element. *Mitigation:* the consumer contract is
    `hidden`/CSS, stated in the toggle component above and pinned by a browser spec that presses
    End with a collapsed toggle last in the document.

## Rejected alternatives and why

- **Row becomes a parser Markup in the segment alternation** — rejected 2026-08-20 and re-rejected:
  proven, registering two fence variants together yields zero marks, because a closing literal in the
  shared alternation eats the opening one.
- **Fold `RowNode` into `MarkNode`** — the fold forces descriptor-identity pairing, which mints a
  fresh node on every turn-into and takes drag state, collapse state and block selection with it.
- **Pair rows on descriptor identity** — same defect, already measured in
  `token-born-edit/issues/08`; kind-only pairing is precisely what keeps a row alive across a retype.
- **A `RowDescriptor` type of its own** — six of its eight fields were verbatim copies of
  `MarkupDescriptor`, two (`open`, `body`) were stored booleans for facts the compiler already
  answers, and its non-optional `markup` had no value for the anonymous `cell` kind. Hold the
  compiled descriptor; identify a row by its option index, which is what `resolveSlot.ts:77` already
  resolves marks by.
- **`RowsController` / `store.rows`** — after `name` and `view` go, every remaining member has an
  existing owner. A facade over three owners is a fourth place a fact lives.
- **`CoreOption.name`** — a second identity for a thing the option index already identifies, written
  in the old consumer file more than twenty times and never round-tripping.
- **`menu.run`** — both uses supplied data (a default `meta`, a seed string), and it opened a second
  write path beside `choose`, which the spec's own text calls the one path.
- **`RowSpec.nests`** — 14 of 14 uses were `false`, and its one real job (a split row must not also
  nest) is now a `rowMarkupError` rule that also closes a measured content-loss hole.
- **A stored `terminator` on the row** — one editor-level setting stored per row; the code already
  admitted it by recovering the setting from a sibling scan. Pre-order join by `config.separator`
  makes `terminator === '' ⟺ document-final` structural.
- **Core-owned per-row view state (`view(id)`, `useRowState`)** — a keyed signal registry, a second
  pruning clock beside `bind`'s, and a hook in both adapters, for one consumer component, justified
  by a remount claim that cannot be measured until nested drag exists. P10 names the experiment.
- **Synthetic group rows in the tree** — a group is presentation with zero bytes; folding it keeps
  `anchorAt`, `sliceWithin`, `removePlan`, `movePlan` and `boundarySpan` free of a node that tiles
  nothing. But the folding itself lives in **core** (`resolveRowGroups`), not in each adapter: one
  rule, one implementation.
- **A global `escape` character** — makes backslash significant in every document a consumer stores,
  diffs and pastes, to buy one gesture.
- **Recognize openers inside the existing `rowPass` fixpoint** — it destroys the loop's only stated
  termination argument in the keystroke path; the inversion deletes the loop instead.
- **An incremental parser** — after P0 a 4000-row document parses in 2.20 ms and an 8000-row one in
  4.60 ms, measured, so a full re-parse per keystroke stays under a frame.
- **Deleting `layout` and the inline/block parse fork as part of this work** — a published-API
  question the maintainer explicitly reserved. Surfaced as a P2 blocker instead.
- **Unifying `BLOCK_MENU_ITEMS` with `MenuEntry`** — a rename, not a reduction; row-control verbs
  and row kinds are different lists with different props, and both adapters plus the shared `Drag`
  spec depend on the shipped shape.
- **Derive a row's kind from its first child mark (`row.lead()`)** — pushes the parser's shape into
  consumer components, the incoherence the mandate rules out.
- **Store `depth` on the node, or compute it as `lead.length / indent.length`** — the first is
  mirrored state; the second disagrees with the tree on an over-indented paste, which is two facts
  under one name. Depth is the recursion index the adapters already pass down.
- **Two child lists on a row (`children` + `rows`)** — one list, inline-then-rows, leaves nine
  generic walks in `tree/`, `bind` and `transactions` untouched.
- **A second coordinate name (`contentRange`, `line`)** — naming the row's interior `slotRange`
  matches `MarkNode` and keeps ADR-0003's grep gate enforcing rather than dodged.
- **Core owning row DOM** — decided and rejected 2026-08-19; core owns structure and behavior, the
  consumer owns rendering.
- **A `contenteditable` host per row** — ADR-0002 stands; one host everywhere, block layout included.
- **Rename `store.block` to `store.controls`** — churn against a decision CONTEXT.md records
  explicitly.
- **`Row`/`row` as component/config on the Option** — a third case-only pair, the exact defect
  api-v2 issue 01 exists to remove; the component nests inside `row`.
- **Listing "unmatched closed openers are O(N²)" as a risk** — measured and refuted: 32 000
  unclosed fence lines parse in 4.68 ms.
