import {Store} from '@markput/core'
import type {Option} from '@markput/react'
import {describe, expect, it} from 'vitest'

import {rowsToDebugTree} from '../../../../core/src/features/tokens/parser/__testing__/tokensToDebugTree'
import type {RowToken, Token} from '../../../../core/src/features/tokens/parser/types'
import {snapshot} from '../../../../core/src/features/tokens/tree/__testing__/snapshot'
import {APOLLO_DOC} from './document'
import * as vocabulary from './notion'
import {fixtures} from './Notion.fixtures'

/**
 * THE STRUCTURAL HALF of the showcase's coverage. `Notion.react.spec.tsx` drives the page and
 * asserts the VALUE a gesture leaves behind; this file asserts the SHAPE the value parses to, so
 * a change in core that keeps every byte and loses the nesting is caught here and nowhere else.
 *
 * WHY A SHAPE AND NOT A ROUND TRIP. A round trip on the value string is BLIND to nesting: the
 * projection joins a row's subtree with the same separator that joins its siblings, so `[A, B]`
 * and `[A[B]]` serialise identically and a byte comparison passes on both. The debug tree prints
 * depth as indentation, which is the one reading that tells them apart — and the round trip is
 * asserted too, at the bottom, because neither implies the other.
 *
 * WHAT IT PARSES WITH. `fixtures.options` — the array the story hands the editor — and props
 * otherwise left alone, so the separator (`'\n'`) and the indent (`'\t'`) are the editor's own
 * defaults rather than a pair spelled again here. The parse therefore runs the whole compile the
 * page runs: `TokenModel` resolves each option's `row` declaration, drops what breaks a rule, and
 * hands the parser the same markups the showcase declares.
 *
 * `kind=N` in a snapshot is an INDEX INTO THAT ARRAY, and the legend below is what decodes it.
 */

/** The page's own editor, parsing `value` into the rows the adapters render. */
function tree(value: string): string {
	const store = new Store()
	store.props.set({options: fixtures.options, defaultValue: value})
	store.host.container(document.createElement('div'))
	const roots = snapshot(store.tokens.nodes(), store.tokens.rowConfig()?.separator)
	const rows = roots.filter(token => token.type === 'row')
	record(rows)
	return rowsToDebugTree(rows)
}

/** The value the same editor projects back — the round trip's other half. */
function projection(value: string): string {
	const store = new Store()
	store.props.set({options: fixtures.options, defaultValue: value})
	store.host.container(document.createElement('div'))
	return store.tokens.value()
}

/**
 * WHICH OPTIONS THE CASES BELOW HAVE ACTUALLY PARSED — every `descriptor.index` a tree carried,
 * at any depth, row kind and mark alike. It is what makes the last test of the file a gate rather
 * than a list somebody remembers to extend, and it is evidence of the parse rather than of the
 * spelling: a case that names a kind and feeds it a line the kind does not match records nothing.
 */
const parsed = new Set<number>()

function record(tokens: readonly (Token | RowToken)[]): void {
	for (const token of tokens) {
		if (token.type === 'text') continue
		if (token.descriptor) parsed.add(token.descriptor.index)
		record(token.children)
		if (token.type === 'row') record(token.rows)
	}
}

describe('every kind the showcase declares', () => {
	/**
	 * `kind=N` decoded. It is also the pin on the resolution the index IS: which option a row's
	 * component is looked up in, which the page decides by ORDER — `mention` re-listed at the head
	 * so it owns `@`, and one option carrying no markup at all so it can own `/`.
	 */
	it('numbers the kinds its snapshots print as kind=N', () => {
		const legend = fixtures.options.map((option, index) => `${index} ${nameOf(option)}`)

		expect(legend).toMatchInlineSnapshot(`
			[
			  "0 mention",
			  "1 —",
			  "2 text",
			  "3 title",
			  "4 caption",
			  "5 properties",
			  "6 divider",
			  "7 toc",
			  "8 h1",
			  "9 h2",
			  "10 h3",
			  "11 quote",
			  "12 callout",
			  "13 code",
			  "14 bullet",
			  "15 numbered",
			  "16 todo",
			  "17 toggle",
			  "18 toggleOpen",
			  "19 cell",
			  "20 headerCell",
			  "21 tableHeader",
			  "22 tableLine",
			  "23 tableFooter",
			  "24 views",
			  "25 board",
			  "26 metrics",
			  "27 bookmark",
			  "28 comments",
			  "29 link",
			  "30 highlight",
			  "31 status",
			  "32 who",
			  "33 due",
			  "34 effort",
			]
		`)
	})

	/* ── page furniture ─────────────────────────────────────────────────────── */

	it('types the title from "@title " and keeps only its body', () => {
		expect(tree('@title Apollo — Q2 launch plan')).toMatchInlineSnapshot(`
			"0: ROW "@title Apollo — Q2 launch plan" [0-30] kind=3
				0.0: TEXT "Apollo — Q2 launch plan" [7-30]"
		`)
	})

	it('types a caption from "@caption "', () => {
		expect(tree('@caption Inline database · 24 items')).toMatchInlineSnapshot(`
			"0: ROW "@caption Inline database · 24 items" [0-35] kind=4
				0.0: TEXT "Inline database · 24 items" [9-35]"
		`)
	})

	/**
	 * THE RAW BODY, and what makes it worth its own kind: the panel's interior crosses two
	 * separators without becoming three rows, and the `<who:…>` in it stays TEXT — a raw body is
	 * never re-parsed, so no markup inside one is matched.
	 *
	 * EVERY RAW-BODY CASE BELOW CARRIES ONE MARK-SHAPED TOKEN, and that is a measurement rather
	 * than a flourish: swapping this kind's `__value__` for a `__slot__` is the mutation that
	 * breaks the rule, and with a body holding no markup it changes NOTHING — one text token
	 * either way. Four of the six raw kinds passed that mutation green until their samples grew
	 * the token, which is the difference between a pin and a decoration.
	 */
	it('keeps a properties body raw, separators and all', () => {
		expect(tree('@properties\nStatus: chip:amber:In progress\nOwner: <who:Kara Vance>\n@end'))
			.toMatchInlineSnapshot(`
			"0: ROW "@properties↲Status: chip:amber:In progress↲Owner: <who:Kara Vance>↲@end" [0-71] kind=5
				0.0: TEXT "Status: chip:amber:In progress↲Owner: <who:Kara Vance>" [12-66]"
		`)
	})

	/** The rule's own row carries an EMPTY body, and the row after it is a row of its own. */
	it('types "---" as a divider with an empty body', () => {
		expect(tree('---\nApollo moves the collaboration layer.')).toMatchInlineSnapshot(`
			"0: ROW "---↲" [0-4] kind=6
				0.0: TEXT "" [3-3]
			 1: ROW "Apollo moves the collaboration layer." [4-41]
				1.0: TEXT "Apollo moves the collaboration layer." [4-41]"
		`)
	})

	/** A raw body keeps its tabs: the nested entry is text the panel reads, not a nested row. */
	it('keeps the table of contents raw, indent and all', () => {
		expect(tree('@toc\nLaunch tasks\n\tSprint board <status:At risk>\n@end')).toMatchInlineSnapshot(`
			"0: ROW "@toc↲Launch tasks↲⇥Sprint board <status:At risk>↲@end" [0-53] kind=7
				0.0: TEXT "Launch tasks↲⇥Sprint board <status:At risk>" [5-48]"
		`)
	})

	/* ── prose ──────────────────────────────────────────────────────────────── */

	it('types "# " as heading 1', () => {
		expect(tree('# Apollo')).toMatchInlineSnapshot(`
			"0: ROW "# Apollo" [0-8] kind=8
				0.0: TEXT "Apollo" [2-8]"
		`)
	})

	it('types "## " as heading 2', () => {
		expect(tree('## Launch tasks')).toMatchInlineSnapshot(`
			"0: ROW "## Launch tasks" [0-15] kind=9
				0.0: TEXT "Launch tasks" [3-15]"
		`)
	})

	it('types "### " as heading 3', () => {
		expect(tree('### Risks')).toMatchInlineSnapshot(`
			"0: ROW "### Risks" [0-9] kind=10
				0.0: TEXT "Risks" [4-9]"
		`)
	})

	it('types "> " as a quote and nests an indented line under it', () => {
		expect(tree("> If the cutover isn't boring, we're not ready to call it GA.\n\tSaid at the GA review."))
			.toMatchInlineSnapshot(`
			"0: ROW "> If the cutover isn't boring, we're not ready to call it GA.↲⇥Said at the GA review." [0-85] kind=11
				0.0: TEXT "If the cutover isn't boring, we're not ready to call it GA." [2-61]
				0.1: ROW "⇥Said at the GA review." [62-85] lead="⇥"
					0.1.0: TEXT "Said at the GA review." [63-85]"
		`)
	})

	/**
	 * THE LONGER OPENER WINS, and neither kind declares anything about the other: `'> [!__meta__] '`
	 * beats `'> '` on length alone, so the callout takes the first line and the quote the second.
	 */
	it('reads the callout tone into meta and leaves the plain quote alone', () => {
		expect(tree('> [!danger] Launch gating on the auth migration\n> If the cutover is boring.'))
			.toMatchInlineSnapshot(`
			"0: ROW "> [!danger] Launch gating on the auth migration↲" [0-48] kind=12 meta="danger"
				0.0: TEXT "Launch gating on the auth migration" [12-47]
			 1: ROW "> If the cutover is boring." [48-75] kind=11
				1.0: TEXT "If the cutover is boring." [50-75]"
		`)
	})

	/**
	 * A fence's interior is raw twice over: `# ` at a line start does not type a heading inside it,
	 * and `==…==` is not a highlight.
	 */
	it('keeps a code body raw and reads its language into meta', () => {
		expect(tree('```bash\napollo deploy --env=staging --canary=5%\n# → rollout 5% · ==healthy==\n```'))
			.toMatchInlineSnapshot(`
			"0: ROW "\`\`\`bash↲apollo deploy --env=staging --canary=5%↲# → rollout 5% · ==healthy==↲\`\`\`" [0-80] kind=13 meta="bash"
				0.0: TEXT "apollo deploy --env=staging --canary=5%↲# → rollout 5% · ==healthy==" [8-76]"
		`)
	})

	/* ── lists ──────────────────────────────────────────────────────────────── */

	/** THE NESTING PIN: the child is a row INSIDE the parent, not a sibling after it. */
	it('nests an indented bullet under the bullet above it', () => {
		expect(tree('- EU region capacity unconfirmed\n\t- Awaiting quota approval\n- Support headcount at 60%'))
			.toMatchInlineSnapshot(`
			"0: ROW "- EU region capacity unconfirmed↲⇥- Awaiting quota approval↲" [0-60] kind=14
				0.0: TEXT "EU region capacity unconfirmed" [2-32]
				0.1: ROW "⇥- Awaiting quota approval↲" [33-60] lead="⇥" kind=14
					0.1.0: TEXT "Awaiting quota approval" [36-59]
			 1: ROW "- Support headcount at 60%" [60-86] kind=14
				1.0: TEXT "Support headcount at 60%" [62-86]"
		`)
	})

	it('types "1. " as a numbered item', () => {
		expect(tree('1. Auth migration owns the critical path.')).toMatchInlineSnapshot(`
			"0: ROW "1. Auth migration owns the critical path." [0-41] kind=15
				0.0: TEXT "Auth migration owns the critical path." [3-41]"
		`)
	})

	/** `'- [__meta__] '` is longer than `'- '`, so a to-do wins over a bullet, ticked or not. */
	it('reads a to-do box into meta and beats the bullet opener', () => {
		expect(tree('- [ ] Confirm the EU quota with the vendor\n- [x] Signed off by Platform')).toMatchInlineSnapshot(`
			"0: ROW "- [ ] Confirm the EU quota with the vendor↲" [0-43] kind=16 meta=" "
				0.0: TEXT "Confirm the EU quota with the vendor" [6-42]
			 1: ROW "- [x] Signed off by Platform" [43-71] kind=16 meta="x"
				1.0: TEXT "Signed off by Platform" [49-71]"
		`)
	})

	it('nests a closed toggle body under its own line', () => {
		expect(tree('▸ Single-region GA first\n\tEU capacity is unconfirmed.')).toMatchInlineSnapshot(`
			"0: ROW "▸ Single-region GA first↲⇥EU capacity is unconfirmed." [0-53] kind=17
				0.0: TEXT "Single-region GA first" [2-24]
				0.1: ROW "⇥EU capacity is unconfirmed." [25-53] lead="⇥"
					0.1.0: TEXT "EU capacity is unconfirmed." [26-53]"
		`)
	})

	/** The open toggle is a KIND of its own, which is how the document says a toggle is open. */
	it('types the open toggle as its own kind and nests its children', () => {
		expect(
			tree(
				'▾ Why we cut the Android target\n\tShipping three platforms at once.\n\t1. Auth migration owns the critical path.'
			)
		).toMatchInlineSnapshot(`
			"0: ROW "▾ Why we cut the Android target↲⇥Shipping three platforms at once.↲⇥1. Auth migration owns the critical path." [0-109] kind=18
				0.0: TEXT "Why we cut the Android target" [2-31]
				0.1: ROW "⇥Shipping three platforms at once.↲" [32-67] lead="⇥"
					0.1.0: TEXT "Shipping three platforms at once." [33-66]
				0.2: ROW "⇥1. Auth migration owns the critical path." [67-109] lead="⇥" kind=15
					0.2.0: TEXT "Auth migration owns the critical path." [71-109]"
		`)
	})

	/* ── how deep a line may sit ────────────────────────────────────────────── */

	/**
	 * THE CEILING, on the page's own indent: a row descends AT MOST ONE LEVEL past the row before
	 * it, and an EMPTY row grants none at all. Without the second rule the blank line between two
	 * bullets adopts the one below it — one keystroke away under a single-newline separator — and
	 * every reading of "which rows are inside this one" moves with it: the drag, the collapse, the
	 * `rows` prop each kind is handed. The reference document holds no blank-then-indented pair, so
	 * nothing else in this file parses one.
	 */
	it('leaves a bullet indented under a blank line a root, since an empty row takes no children', () => {
		expect(tree('- alpha\n\n\t- beta')).toMatchInlineSnapshot(`
			"0: ROW "- alpha↲" [0-8] kind=14
				0.0: TEXT "alpha" [2-7]
			 1: ROW "↲" [8-9]
				1.0: TEXT "" [8-8]
			 2: ROW "⇥- beta" [9-16] lead="⇥" kind=14
				2.0: TEXT "beta" [12-16]"
		`)
	})

	/**
	 * A LEAD IS READ TO THE ROW'S OWN END, so a line that is NOTHING BUT its indent still carries
	 * one — which is what keeps the blank line Shift+Enter opens a CHILD of the item above it,
	 * before anything is typed into it, and what lets the line under that one go deeper still.
	 */
	it('reads a lead that fills the whole line, so a blank continuation still nests', () => {
		expect(tree('- alpha\n\t\n\t\t- beta')).toMatchInlineSnapshot(`
			"0: ROW "- alpha↲⇥↲⇥⇥- beta" [0-18] kind=14
				0.0: TEXT "alpha" [2-7]
				0.1: ROW "⇥↲⇥⇥- beta" [8-18] lead="⇥"
					0.1.0: TEXT "" [9-9]
					0.1.1: ROW "⇥⇥- beta" [10-18] lead="⇥⇥" kind=14
						0.1.1.0: TEXT "beta" [14-18]"
		`)
	})

	/* ── the inline database ────────────────────────────────────────────────── */

	/**
	 * THE CARVE. The line's own body is gone: what is left is one child row per cell, each carrying
	 * the delimiter it was carved at as its LEAD — structural bytes no caret may enter — and each
	 * holding ordinary inline content, so a chip inside a cell is a mark like any other.
	 */
	it('carves a table line into cells at " | " and parses each cell as inline content', () => {
		expect(tree('| Auth service migration | <status:Blocked> | <who:Kara Vance> | <due:2026-04-02> | <bar:0.2>'))
			.toMatchInlineSnapshot(`
				"0: ROW "| Auth service migration | <status:Blocked> | <who:Kara Vance> | <due:2026-04-02> | <bar:0.2>" [0-93] kind=22
					0.0: ROW "Auth service migration" [2-24] kind=19
						0.0.0: TEXT "Auth service migration" [2-24]
					0.1: ROW " | <status:Blocked>" [24-43] lead=" | " kind=19
						0.1.0: TEXT "" [27-27]
						0.1.1: MARK "<status:Blocked>" [27-43] [value="Blocked"]
						0.1.2: TEXT "" [43-43]
					0.2: ROW " | <who:Kara Vance>" [43-62] lead=" | " kind=19
						0.2.0: TEXT "" [46-46]
						0.2.1: MARK "<who:Kara Vance>" [46-62] [value="Kara Vance"]
						0.2.2: TEXT "" [62-62]
					0.3: ROW " | <due:2026-04-02>" [62-81] lead=" | " kind=19
						0.3.0: TEXT "" [65-65]
						0.3.1: MARK "<due:2026-04-02>" [65-81] [value="2026-04-02"]
						0.3.2: TEXT "" [81-81]
					0.4: ROW " | <bar:0.2>" [81-93] lead=" | " kind=19
						0.4.0: TEXT "" [84-84]
						0.4.1: MARK "<bar:0.2>" [84-93] [value="0.2"]
						0.4.2: TEXT "" [93-93]"
			`)
	})

	/** `'|= '` is longer than `'| '`, so the header line is never a body line. */
	it('carves the header line into header cells', () => {
		expect(tree('|= Task | Status | Owner | Due | Effort')).toMatchInlineSnapshot(`
			"0: ROW "|= Task | Status | Owner | Due | Effort" [0-39] kind=21
				0.0: ROW "Task" [3-7] kind=20
					0.0.0: TEXT "Task" [3-7]
				0.1: ROW " | Status" [7-16] lead=" | " kind=20
					0.1.0: TEXT "Status" [10-16]
				0.2: ROW " | Owner" [16-24] lead=" | " kind=20
					0.2.0: TEXT "Owner" [19-24]
				0.3: ROW " | Due" [24-30] lead=" | " kind=20
					0.3.0: TEXT "Due" [27-30]
				0.4: ROW " | Effort" [30-39] lead=" | " kind=20
					0.4.0: TEXT "Effort" [33-39]"
		`)
	})

	/** `'|+ '` beats both table openers, and the footer keeps its summary as its own body. */
	it('types "|+ " as the footer and carves nothing', () => {
		expect(tree('|+ Count 24 · 9 done')).toMatchInlineSnapshot(`
			"0: ROW "|+ Count 24 · 9 done" [0-20] kind=23
				0.0: TEXT "Count 24 · 9 done" [3-20]"
		`)
	})

	it('keeps the view bar as one body the tabs are read from', () => {
		expect(tree('@views Table|Board|Timeline|Calendar')).toMatchInlineSnapshot(`
			"0: ROW "@views Table|Board|Timeline|Calendar" [0-36] kind=24
				0.0: TEXT "Table|Board|Timeline|Calendar" [7-36]"
		`)
	})

	/* ── the board, the metrics, the cards ──────────────────────────────────── */

	/** The whole board is ONE row: its columns and cards are its raw body, not nested rows. */
	it('keeps the board a single row with a raw body', () => {
		expect(
			tree(
				'@board\nTo do\n- Sign the vendor SLA <due:2026-04-09>|red:Legal\nShipped\n- Beta invites|green:Growth\n@end'
			)
		).toMatchInlineSnapshot(`
			"0: ROW "@board↲To do↲- Sign the vendor SLA <due:2026-04-09>|red:Legal↲Shipped↲- Beta invites|green:Growth↲@end" [0-102] kind=25
				0.0: TEXT "To do↲- Sign the vendor SLA <due:2026-04-09>|red:Legal↲Shipped↲- Beta invites|green:Growth" [7-97]"
		`)
	})

	it('keeps the metric cards a single row with a raw body', () => {
		expect(tree('@metrics\nBeta users|4,120\np95 latency|184ms\nRollout|<bar:0.6>\n@end')).toMatchInlineSnapshot(`
			"0: ROW "@metrics↲Beta users|4,120↲p95 latency|184ms↲Rollout|<bar:0.6>↲@end" [0-66] kind=26
				0.0: TEXT "Beta users|4,120↲p95 latency|184ms↲Rollout|<bar:0.6>" [9-61]"
		`)
	})

	/** The url and the description ride in `meta`; the row's own body is the card's title. */
	it('splits a bookmark into meta and title', () => {
		expect(
			tree(
				'@bookmark(https://example.com/apollo|How the auth migration changes token lifetimes.) Auth migration — rollout plan'
			)
		).toMatchInlineSnapshot(`
			"0: ROW "@bookmark(https://example.com/apollo|How the auth migration changes token lifetimes.) Auth migration — rollout plan" [0-115] kind=27 meta="https://example.com/apollo|How the auth migration changes token lifetimes."
				0.0: TEXT "Auth migration — rollout plan" [86-115]"
		`)
	})

	it('keeps a comment thread a single row with a raw body', () => {
		expect(
			tree(
				'@comments\nKara Vance|2h ago|Can @[Platform](team-platform) confirm the EU quota?\nMilo Freeman|41m ago|Asked this morning.\n@end'
			)
		).toMatchInlineSnapshot(`
			"0: ROW "@comments↲Kara Vance|2h ago|Can @[Platform](team-platform) confirm the EU quota?↲Milo Freeman|41m ago|Asked this morning.↲@end" [0-126] kind=28
				0.0: TEXT "Kara Vance|2h ago|Can @[Platform](team-platform) confirm the EU quota?↲Milo Freeman|41m ago|Asked this morning." [10-121]"
		`)
	})

	/* ── inline marks ───────────────────────────────────────────────────────── */

	it('parses a mention into value and meta, inside the row that holds it', () => {
		expect(tree('Ownership sits with @[Platform](team-platform), and the rest follows.')).toMatchInlineSnapshot(`
			"0: ROW "Ownership sits with @[Platform](team-platform), and the rest follows." [0-69]
				0.0: TEXT "Ownership sits with " [0-20]
				0.1: MARK "@[Platform](team-platform)" [20-46] [value="Platform", meta="team-platform"]
				0.2: TEXT ", and the rest follows." [46-69]"
		`)
	})

	/** The one mark the reference page never writes; the vocabulary declares it, so it is pinned. */
	it('parses a link into value and meta', () => {
		expect(tree('The [spec](https://example.com/apollo/spec) has the detail.')).toMatchInlineSnapshot(`
			"0: ROW "The [spec](https://example.com/apollo/spec) has the detail." [0-59]
				0.0: TEXT "The " [0-4]
				0.1: MARK "[spec](https://example.com/apollo/spec)" [4-43] [value="spec", meta="https://example.com/apollo/spec"]
				0.2: TEXT " has the detail." [43-59]"
		`)
	})

	/** A SLOT mark, so its body is parsed and its text is a child token rather than a value. */
	it('parses a highlight into a slot with its own child text', () => {
		expect(tree('and ==launch gating on the auth migration== is what everything assumes.')).toMatchInlineSnapshot(`
			"0: ROW "and ==launch gating on the auth migration== is what everything assumes." [0-71]
				0.0: TEXT "and " [0-4]
				0.1: MARK "==launch gating on the auth migration==" [4-43] [value="", slot="launch gating on the auth migration"]
					0.1.0: TEXT "launch gating on the auth migration" [6-41]
				0.2: TEXT " is what everything assumes." [43-71]"
		`)
	})

	it('parses a status chip into a value', () => {
		expect(tree('<status:In progress>')).toMatchInlineSnapshot(`
			"0: ROW "<status:In progress>" [0-20]
				0.0: TEXT "" [0-0]
				0.1: MARK "<status:In progress>" [0-20] [value="In progress"]
				0.2: TEXT "" [20-20]"
		`)
	})

	it('parses an avatar into a value', () => {
		expect(tree('<who:Kara Vance>')).toMatchInlineSnapshot(`
			"0: ROW "<who:Kara Vance>" [0-16]
				0.0: TEXT "" [0-0]
				0.1: MARK "<who:Kara Vance>" [0-16] [value="Kara Vance"]
				0.2: TEXT "" [16-16]"
		`)
	})

	it('parses a due date into a value', () => {
		expect(tree('<due:2026-03-27 done>')).toMatchInlineSnapshot(`
			"0: ROW "<due:2026-03-27 done>" [0-21]
				0.0: TEXT "" [0-0]
				0.1: MARK "<due:2026-03-27 done>" [0-21] [value="2026-03-27 done"]
				0.2: TEXT "" [21-21]"
		`)
	})

	it('parses an effort bar into a value', () => {
		expect(tree('<bar:0.35>')).toMatchInlineSnapshot(`
			"0: ROW "<bar:0.35>" [0-10]
				0.0: TEXT "" [0-0]
				0.1: MARK "<bar:0.35>" [0-10] [value="0.35"]
				0.2: TEXT "" [10-10]"
		`)
	})

	/**
	 * THE GATE, and it runs last because it reads what the cases above left behind. A kind added to
	 * `options.tsx` with no case lands here rather than in a reviewer's memory, and so does a kind
	 * the compile DROPPED — a markup that breaks a row rule, or a second option claiming an opener
	 * an earlier one already owns, parses nothing and shows up as missing.
	 *
	 * AN OPTION WITH NO MARKUP IS NOT IN THE PARSE AT ALL, and that is what it is FOR: `text` names
	 * the row with no kind, so the scan can never carry its index and this gate must not ask it to.
	 * The exclusion is the fact rather than the name — a second such entry needs no edit here.
	 */
	it('parses something with every option the showcase declares', () => {
		const missing = vocabulary.notionOptions
			.filter(option => option.markup !== undefined && !parsed.has(indexOf(option)))
			.map(nameOf)

		expect(missing).toEqual([])
	})
})

describe('the reference document', () => {
	/**
	 * THE PAGE, AS ONE SHAPE. Read it top to bottom and `showcase.md`'s block list is there in
	 * order: the title, the properties panel, the rule, the intro with its mention and its
	 * highlight, the table of contents, the database's header line and five carved body lines, the
	 * board, the metric cards, the callout, the nested bullets, the two to-dos, the open toggle
	 * with three children and the two closed ones, the fence, the quote, the bookmark, the comment
	 * thread, and the empty last row that carries the placeholder.
	 *
	 * Every INDENTED line is a child row under the row above it. That is the fact a round trip
	 * cannot see and this snapshot can.
	 */
	it('parses to one known shape', () => {
		expect(tree(APOLLO_DOC)).toMatchInlineSnapshot(`
			"0: ROW "@title Apollo — Q2 launch plan↲" [0-31] kind=3
				0.0: TEXT "Apollo — Q2 launch plan" [7-30]
			 1: ROW "@properties↲Status: chip:amber:In progress↲Owner: person:Kara Vance↲Team: people:Kara Vance;Ines Duarte;Milo Freeman;Priya Raman;Tomas Alvarez;Wen Li↲Timeline: Apr 8 → Jun 30↲Tags: chip:blue:Platform, chip:purple:Design, Q2↲Spec: link:apollo/spec https://example.com/apollo/spec↲Confidence: 82%↲@end↲" [31-331] kind=5
				1.0: TEXT "Status: chip:amber:In progress↲Owner: person:Kara Vance↲Team: people:Kara Vance;Ines Duarte;Milo Freeman;Priya Raman;Tomas Alvarez;Wen Li↲Timeline: Apr 8 → Jun 30↲Tags: chip:blue:Platform, chip:purple:Design, Q2↲Spec: link:apollo/spec https://example.com/apollo/spec↲Confidence: 82%" [43-325]
			 2: ROW "---↲" [331-335] kind=6
				2.0: TEXT "" [334-334]
			 3: ROW "Apollo moves the collaboration layer from beta to general availability. Ownership sits with @[Platform](team-platform), and ==launch gating on the auth migration== is what everything downstream assumes.↲" [335-538]
				3.0: TEXT "Apollo moves the collaboration layer from beta to general availability. Ownership sits with " [335-427]
				3.1: MARK "@[Platform](team-platform)" [427-453] [value="Platform", meta="team-platform"]
				3.2: TEXT ", and " [453-459]
				3.3: MARK "==launch gating on the auth migration==" [459-498] [value="", slot="launch gating on the auth migration"]
					3.3.0: TEXT "launch gating on the auth migration" [461-496]
				3.4: TEXT " is what everything downstream assumes." [498-537]
			 4: ROW "@toc↲Launch tasks↲⇥Sprint board↲⇥Metrics & risks↲Decision log↲@end↲" [538-605] kind=7
				4.0: TEXT "Launch tasks↲⇥Sprint board↲⇥Metrics & risks↲Decision log" [543-599]
			 5: ROW "## Launch tasks↲" [605-621] kind=9
				5.0: TEXT "Launch tasks" [608-620]
			 6: ROW "@caption Inline database · 24 items↲" [621-657] kind=4
				6.0: TEXT "Inline database · 24 items" [630-656]
			 7: ROW "@views Table|Board|Timeline|Calendar↲" [657-694] kind=24
				7.0: TEXT "Table|Board|Timeline|Calendar" [664-693]
			 8: ROW "|= Task | Status | Owner | Due | Effort↲" [694-734] kind=21
				8.0: ROW "Task" [697-701] kind=20
					8.0.0: TEXT "Task" [697-701]
				8.1: ROW " | Status" [701-710] lead=" | " kind=20
					8.1.0: TEXT "Status" [704-710]
				8.2: ROW " | Owner" [710-718] lead=" | " kind=20
					8.2.0: TEXT "Owner" [713-718]
				8.3: ROW " | Due" [718-724] lead=" | " kind=20
					8.3.0: TEXT "Due" [721-724]
				8.4: ROW " | Effort" [724-733] lead=" | " kind=20
					8.4.0: TEXT "Effort" [727-733]
			 9: ROW "| Auth service migration | <status:Blocked> | <who:Kara Vance> | <due:2026-04-02> | <bar:0.2>↲" [734-828] kind=22
				9.0: ROW "Auth service migration" [736-758] kind=19
					9.0.0: TEXT "Auth service migration" [736-758]
				9.1: ROW " | <status:Blocked>" [758-777] lead=" | " kind=19
					9.1.0: TEXT "" [761-761]
					9.1.1: MARK "<status:Blocked>" [761-777] [value="Blocked"]
					9.1.2: TEXT "" [777-777]
				9.2: ROW " | <who:Kara Vance>" [777-796] lead=" | " kind=19
					9.2.0: TEXT "" [780-780]
					9.2.1: MARK "<who:Kara Vance>" [780-796] [value="Kara Vance"]
					9.2.2: TEXT "" [796-796]
				9.3: ROW " | <due:2026-04-02>" [796-815] lead=" | " kind=19
					9.3.0: TEXT "" [799-799]
					9.3.1: MARK "<due:2026-04-02>" [799-815] [value="2026-04-02"]
					9.3.2: TEXT "" [815-815]
				9.4: ROW " | <bar:0.2>" [815-827] lead=" | " kind=19
					9.4.0: TEXT "" [818-818]
					9.4.1: MARK "<bar:0.2>" [818-827] [value="0.2"]
					9.4.2: TEXT "" [827-827]
			 10: ROW "| Realtime sync engine | <status:In progress> | <who:Milo Freeman> | <due:2026-04-18> | <bar:0.6>↲" [828-926] kind=22
				10.0: ROW "Realtime sync engine" [830-850] kind=19
					10.0.0: TEXT "Realtime sync engine" [830-850]
				10.1: ROW " | <status:In progress>" [850-873] lead=" | " kind=19
					10.1.0: TEXT "" [853-853]
					10.1.1: MARK "<status:In progress>" [853-873] [value="In progress"]
					10.1.2: TEXT "" [873-873]
				10.2: ROW " | <who:Milo Freeman>" [873-894] lead=" | " kind=19
					10.2.0: TEXT "" [876-876]
					10.2.1: MARK "<who:Milo Freeman>" [876-894] [value="Milo Freeman"]
					10.2.2: TEXT "" [894-894]
				10.3: ROW " | <due:2026-04-18>" [894-913] lead=" | " kind=19
					10.3.0: TEXT "" [897-897]
					10.3.1: MARK "<due:2026-04-18>" [897-913] [value="2026-04-18"]
					10.3.2: TEXT "" [913-913]
				10.4: ROW " | <bar:0.6>" [913-925] lead=" | " kind=19
					10.4.0: TEXT "" [916-916]
					10.4.1: MARK "<bar:0.6>" [916-925] [value="0.6"]
					10.4.2: TEXT "" [925-925]
			 11: ROW "| Pricing page rewrite | <status:Done> | <who:Ines Duarte> | <due:2026-03-27 done> | <bar:1>↲" [926-1019] kind=22
				11.0: ROW "Pricing page rewrite" [928-948] kind=19
					11.0.0: TEXT "Pricing page rewrite" [928-948]
				11.1: ROW " | <status:Done>" [948-964] lead=" | " kind=19
					11.1.0: TEXT "" [951-951]
					11.1.1: MARK "<status:Done>" [951-964] [value="Done"]
					11.1.2: TEXT "" [964-964]
				11.2: ROW " | <who:Ines Duarte>" [964-984] lead=" | " kind=19
					11.2.0: TEXT "" [967-967]
					11.2.1: MARK "<who:Ines Duarte>" [967-984] [value="Ines Duarte"]
					11.2.2: TEXT "" [984-984]
				11.3: ROW " | <due:2026-03-27 done>" [984-1008] lead=" | " kind=19
					11.3.0: TEXT "" [987-987]
					11.3.1: MARK "<due:2026-03-27 done>" [987-1008] [value="2026-03-27 done"]
					11.3.2: TEXT "" [1008-1008]
				11.4: ROW " | <bar:1>" [1008-1018] lead=" | " kind=19
					11.4.0: TEXT "" [1011-1011]
					11.4.1: MARK "<bar:1>" [1011-1018] [value="1"]
					11.4.2: TEXT "" [1018-1018]
			 12: ROW "| Load test at 5× peak | <status:Planned> | <who:Priya Raman> | <due:2026-05-06> | <bar:0>↲" [1019-1110] kind=22
				12.0: ROW "Load test at 5× peak" [1021-1041] kind=19
					12.0.0: TEXT "Load test at 5× peak" [1021-1041]
				12.1: ROW " | <status:Planned>" [1041-1060] lead=" | " kind=19
					12.1.0: TEXT "" [1044-1044]
					12.1.1: MARK "<status:Planned>" [1044-1060] [value="Planned"]
					12.1.2: TEXT "" [1060-1060]
				12.2: ROW " | <who:Priya Raman>" [1060-1080] lead=" | " kind=19
					12.2.0: TEXT "" [1063-1063]
					12.2.1: MARK "<who:Priya Raman>" [1063-1080] [value="Priya Raman"]
					12.2.2: TEXT "" [1080-1080]
				12.3: ROW " | <due:2026-05-06>" [1080-1099] lead=" | " kind=19
					12.3.0: TEXT "" [1083-1083]
					12.3.1: MARK "<due:2026-05-06>" [1083-1099] [value="2026-05-06"]
					12.3.2: TEXT "" [1099-1099]
				12.4: ROW " | <bar:0>" [1099-1109] lead=" | " kind=19
					12.4.0: TEXT "" [1102-1102]
					12.4.1: MARK "<bar:0>" [1102-1109] [value="0"]
					12.4.2: TEXT "" [1109-1109]
			 13: ROW "| Vendor SLA sign-off | <status:At risk> | <who:Tomas Alvarez> | <due:2026-04-09> | <bar:0.35>↲" [1110-1205] kind=22
				13.0: ROW "Vendor SLA sign-off" [1112-1131] kind=19
					13.0.0: TEXT "Vendor SLA sign-off" [1112-1131]
				13.1: ROW " | <status:At risk>" [1131-1150] lead=" | " kind=19
					13.1.0: TEXT "" [1134-1134]
					13.1.1: MARK "<status:At risk>" [1134-1150] [value="At risk"]
					13.1.2: TEXT "" [1150-1150]
				13.2: ROW " | <who:Tomas Alvarez>" [1150-1172] lead=" | " kind=19
					13.2.0: TEXT "" [1153-1153]
					13.2.1: MARK "<who:Tomas Alvarez>" [1153-1172] [value="Tomas Alvarez"]
					13.2.2: TEXT "" [1172-1172]
				13.3: ROW " | <due:2026-04-09>" [1172-1191] lead=" | " kind=19
					13.3.0: TEXT "" [1175-1175]
					13.3.1: MARK "<due:2026-04-09>" [1175-1191] [value="2026-04-09"]
					13.3.2: TEXT "" [1191-1191]
				13.4: ROW " | <bar:0.35>" [1191-1204] lead=" | " kind=19
					13.4.0: TEXT "" [1194-1194]
					13.4.1: MARK "<bar:0.35>" [1194-1204] [value="0.35"]
					13.4.2: TEXT "" [1204-1204]
			 14: ROW "|+ Count 24 · 9 done↲" [1205-1226] kind=23
				14.0: TEXT "Count 24 · 9 done" [1208-1225]
			 15: ROW "## Sprint board↲" [1226-1242] kind=9
				15.0: TEXT "Sprint board" [1229-1241]
			 16: ROW "@board↲To do↲- Sign the vendor SLA|red:Legal↲- EU region quota|blue:Infra↲- Launch copy review↲In progress↲- Auth migration|purple:Platform↲- p95 latency budget|amber:Perf↲Shipped↲- Beta invites|green:Growth↲@end↲" [1242-1455] kind=25
				16.0: TEXT "To do↲- Sign the vendor SLA|red:Legal↲- EU region quota|blue:Infra↲- Launch copy review↲In progress↲- Auth migration|purple:Platform↲- p95 latency budget|amber:Perf↲Shipped↲- Beta invites|green:Growth" [1249-1449]
			 17: ROW "## Metrics & risks↲" [1455-1474] kind=9
				17.0: TEXT "Metrics & risks" [1458-1473]
			 18: ROW "@metrics↲Beta users|4,120↲p95 latency|184ms↲Crash-free|99.4%↲Open bugs|37↲@end↲" [1474-1553] kind=26
				18.0: TEXT "Beta users|4,120↲p95 latency|184ms↲Crash-free|99.4%↲Open bugs|37" [1483-1547]
			 19: ROW "> [!danger] Launch gating on the auth migration — GA holds only if cutover lands by 2026-04-09.↲" [1553-1649] kind=12 meta="danger"
				19.0: TEXT "Launch gating on the auth migration — GA holds only if cutover lands by 2026-04-09." [1565-1648]
			 20: ROW "### Risks↲" [1649-1659] kind=10
				20.0: TEXT "Risks" [1653-1658]
			 21: ROW "- Vendor SLA unsigned↲" [1659-1681] kind=14
				21.0: TEXT "Vendor SLA unsigned" [1661-1680]
			 22: ROW "- EU region capacity unconfirmed↲⇥- Awaiting quota approval↲" [1681-1741] kind=14
				22.0: TEXT "EU region capacity unconfirmed" [1683-1713]
				22.1: ROW "⇥- Awaiting quota approval↲" [1714-1741] lead="⇥" kind=14
					22.1.0: TEXT "Awaiting quota approval" [1717-1740]
			 23: ROW "- Support headcount at 60%↲" [1741-1768] kind=14
				23.0: TEXT "Support headcount at 60%" [1743-1767]
			 24: ROW "- [ ] Confirm the EU quota with the vendor↲" [1768-1811] kind=16 meta=" "
				24.0: TEXT "Confirm the EU quota with the vendor" [1774-1810]
			 25: ROW "- [x] Signed off by Platform↲" [1811-1840] kind=16 meta="x"
				25.0: TEXT "Signed off by Platform" [1817-1839]
			 26: ROW "## Decision log↲" [1840-1856] kind=9
				26.0: TEXT "Decision log" [1843-1855]
			 27: ROW "▾ Why we cut the Android target↲⇥Shipping three platforms at once puts the auth migration on the critical path twice.↲⇥1. Auth migration owns the critical path.↲⇥1. Three platforms at once doubles the QA matrix.↲" [1856-2068] kind=18
				27.0: TEXT "Why we cut the Android target" [1858-1887]
				27.1: ROW "⇥Shipping three platforms at once puts the auth migration on the critical path twice.↲" [1888-1974] lead="⇥"
					27.1.0: TEXT "Shipping three platforms at once puts the auth migration on the critical path twice." [1889-1973]
				27.2: ROW "⇥1. Auth migration owns the critical path.↲" [1974-2017] lead="⇥" kind=15
					27.2.0: TEXT "Auth migration owns the critical path." [1978-2016]
				27.3: ROW "⇥1. Three platforms at once doubles the QA matrix.↲" [2017-2068] lead="⇥" kind=15
					27.3.0: TEXT "Three platforms at once doubles the QA matrix." [2021-2067]
			 28: ROW "▸ Single-region GA first↲⇥EU capacity is unconfirmed, so a second region is a launch risk with no launch benefit.↲" [2068-2182] kind=17
				28.0: TEXT "Single-region GA first" [2070-2092]
				28.1: ROW "⇥EU capacity is unconfirmed, so a second region is a launch risk with no launch benefit.↲" [2093-2182] lead="⇥"
					28.1.0: TEXT "EU capacity is unconfirmed, so a second region is a launch risk with no launch benefit." [2094-2181]
			 29: ROW "▸ Adopt CRDT over OT↲⇥Presence and offline edits fall out of the same merge; OT needed a server for each.↲" [2182-2288] kind=17
				29.0: TEXT "Adopt CRDT over OT" [2184-2202]
				29.1: ROW "⇥Presence and offline edits fall out of the same merge; OT needed a server for each.↲" [2203-2288] lead="⇥"
					29.1.0: TEXT "Presence and offline edits fall out of the same merge; OT needed a server for each." [2204-2287]
			 30: ROW "## Canary procedure↲" [2288-2308] kind=9
				30.0: TEXT "Canary procedure" [2291-2307]
			 31: ROW "\`\`\`bash↲apollo deploy --env=staging --canary=5%↲# → rollout 5% · healthy · p95 184ms↲\`\`\`↲" [2308-2397] kind=13 meta="bash"
				31.0: TEXT "apollo deploy --env=staging --canary=5%↲# → rollout 5% · healthy · p95 184ms" [2316-2392]
			 32: ROW "> If the cutover isn't boring, we're not ready to call it GA.↲" [2397-2459] kind=11
				32.0: TEXT "If the cutover isn't boring, we're not ready to call it GA." [2399-2458]
			 33: ROW "@bookmark(https://example.com/apollo/auth-migration|How the auth migration changes token lifetimes, and what breaks if it slips.) Auth migration — rollout plan↲" [2459-2619] kind=27 meta="https://example.com/apollo/auth-migration|How the auth migration changes token lifetimes, and what breaks if it slips."
				33.0: TEXT "Auth migration — rollout plan" [2589-2618]
			 34: ROW "@comments↲Kara Vance|2h ago|Can we confirm the EU quota before Friday?↲Milo Freeman|41m ago|Asked the vendor this morning — expecting an answer tomorrow.↲@end↲" [2619-2778] kind=28
				34.0: TEXT "Kara Vance|2h ago|Can we confirm the EU quota before Friday?↲Milo Freeman|41m ago|Asked the vendor this morning — expecting an answer tomorrow." [2629-2772]
			 35: ROW "" [2778-2778]
				35.0: TEXT "" [2778-2778]"
		`)
	})

	/**
	 * AND BACK, byte for byte. The shape above is what the editor holds; this is what a consumer's
	 * `onChange` would receive on a document nobody has touched — structural bytes, leads,
	 * separators and the trailing empty row included.
	 */
	it('projects back to the value it was parsed from', () => {
		expect(projection(APOLLO_DOC)).toBe(APOLLO_DOC)
	})
})

/** Every option the vocabulary declares, under the name it exports it as. */
const DECLARED = Object.entries(vocabulary).flatMap(([name, exported]) =>
	vocabulary.notionOptions.filter(option => option === exported).map(option => ({name, option}))
)

/**
 * An option's name in the vocabulary. BY IDENTITY FIRST, because the two cell kinds are anonymous
 * — they carry no markup at all — and only then by markup, because the page re-lists `mention` as
 * a copy of itself with the `@` picker attached. `—` is the option that carries neither, and
 * exists only to own `/`.
 */
function nameOf(option: Option): string {
	const found =
		DECLARED.find(entry => entry.option === option) ??
		DECLARED.find(entry => entry.option.markup !== undefined && entry.option.markup === option.markup)
	return found?.name ?? '—'
}

/**
 * Where a vocabulary option sits in the array the page hands the editor — the number a parse
 * reports as `descriptor.index` and a snapshot prints as `kind=N`. Matched the same two ways, for
 * the same two reasons.
 */
function indexOf(option: Option): number {
	const identical = fixtures.options.indexOf(option)
	if (identical >= 0) return identical
	return fixtures.options.findIndex(other => other.markup !== undefined && other.markup === option.markup)
}