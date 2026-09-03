import type {Option, RowNode} from '@markput/vue'
import {Atomic, useControlRef} from '@markput/vue'
import type {Component} from 'vue'
import {computed, defineComponent, ref} from 'vue'

import {Due, Effort, Highlight, Link, Mention, Status, Who} from './marks'
import {theme} from './theme'
import {Board} from './ui/Board'
import {BookmarkCard} from './ui/BookmarkCard'
import {Callout} from './ui/Callout'
import {CardGrid} from './ui/CardGrid'
import {CommentThread} from './ui/CommentThread'
import {MetricCard} from './ui/MetricCard'
import {PropertiesPanel} from './ui/PropertiesPanel'
import {ViewTabs} from './ui/ViewTabs'
import type {BoardColumnData} from './vocabulary'
import {
	assembleNotion,
	CALLOUT_ICON,
	calloutTone,
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

import rowStyles from './rows.module.css'

/**
 * THE VUE PAINT, and the twin of `options.tsx`. Every kind is declared once in `vocabulary.ts`;
 * this file supplies components and nothing else, so the two adapters cannot drift on a markup, a
 * menu entry, a continuation or a split.
 *
 * A kind's component takes `class` and `style` by FALLTHROUGH — it declares the four row props it
 * reads and lets Vue merge the editor's own class with whatever the template writes. Nothing here
 * spreads a `ref` either: the editor's `ref` resolves through the component instance, so a kind
 * only has to render ONE root element.
 *
 * A kind whose component renders no default slot is an ATOMIC row: its text round-trips and it
 * drags and selects as a row, but nothing it paints is document surface. Such a kind wraps its
 * whole interior in one {@link Atomic}, which the adapter ships.
 */

/**
 * The row props every kind declares. Vue puts an undeclared prop onto the root element, so
 * leaving `node` or `depth` out would write them there as attributes.
 */
const rowProps = {
	meta: {type: String, default: undefined},
	node: {type: Object as () => RowNode, required: true},
	depth: {type: Number, default: 0},
} as const

/* ── page furniture ─────────────────────────────────────────────────────── */

const Title = defineComponent({
	name: 'NotionTitle',
	props: rowProps,
	setup: () => ({theme}),
	template: '<div :class="[theme.block, theme.title]"><slot /></div>',
})

const Caption = defineComponent({
	name: 'NotionCaption',
	props: rowProps,
	setup: () => ({theme}),
	template: '<div :class="[theme.block, theme.caption]"><slot /></div>',
})

const Properties = defineComponent({
	name: 'NotionProperties',
	components: {Atomic, PropertiesPanel},
	props: rowProps,
	setup: props => {
		const body = computed(() => props.node.slot())
		return {properties: computed(() => readProperties(body.value))}
	},
	template: '<div><Atomic><PropertiesPanel :properties="properties" /></Atomic></div>',
})

/**
 * The rule is an EMPTY SIBLING of the row's own line rather than the line itself: the theme draws
 * a divider as a zero-height border, and a row with no line box is a row the caret cannot stand
 * on. The row's own (normally empty) text stays after it.
 */
const Divider = defineComponent({
	name: 'NotionDivider',
	props: rowProps,
	// The rule is the row's only large target, so without the control ref a click on it — or an
	// arrow that lands on it — resolves to no anchor and the next keystroke is dropped.
	setup: () => ({theme, setControlRef: useControlRef()}),
	template: '<div :class="theme.block"><span :class="theme.divider" :ref="setControlRef" /><slot /></div>',
})

const Toc = defineComponent({
	name: 'NotionToc',
	components: {Atomic},
	props: rowProps,
	setup: props => {
		const body = computed(() => props.node.slot())
		return {theme, entries: computed(() => readTocEntries(body.value))}
	},
	template: `
		<div :class="theme.block">
			<Atomic :class="theme.tableOfContents">
				<span
					v-for="entry in entries"
					:key="entry.line"
					:class="entry.nested ? theme.tableOfContentsItemNested : theme.tableOfContentsItem"
				>{{ entry.text }}</span>
			</Atomic>
		</div>
	`,
})

/* ── prose ──────────────────────────────────────────────────────────────── */

const heading = (kindClass: string) =>
	defineComponent({
		name: 'NotionHeading',
		props: rowProps,
		setup: () => ({classes: [theme.block, kindClass]}),
		template: '<div :class="classes"><slot /></div>',
	})

const Quote = defineComponent({
	name: 'NotionQuote',
	props: rowProps,
	setup: () => ({theme}),
	template: '<div :class="[theme.block, theme.quote]"><slot /><slot name="rows" /></div>',
})

const CalloutRow = defineComponent({
	name: 'NotionCallout',
	components: {Callout},
	props: rowProps,
	setup(props) {
		const tone = computed(() => calloutTone(props.meta ?? 'neutral'))
		return {
			theme,
			tone,
			icon: computed(() => CALLOUT_ICON[tone.value]),
			cycle: () => props.node.turnInto(kinds.callout, {meta: nextCalloutTone(props.meta ?? 'neutral')}),
			setControlRef: useControlRef(),
		}
	},
	template: `
		<div>
			<Callout :tone="tone">
				<template #icon>
					<button :class="theme.calloutIcon" :ref="setControlRef" type="button" @click="cycle()">
						{{ icon }}
					</button>
				</template>
				<slot /><slot name="rows" />
			</Callout>
		</div>
	`,
})

const Code = defineComponent({
	name: 'NotionCode',
	props: rowProps,
	setup: props => ({
		theme,
		rowStyles,
		LANGUAGES,
		setControlRef: useControlRef(),
		// `v-model` rather than `:value`, and the reason is the DOM rather than taste: a bound
		// `value` on a `<select>` is written as an ATTRIBUTE, where React writes the property, and
		// the shared story snapshot compares the two paints byte for byte. The directive sets the
		// property, so both frameworks render the same `<select>`.
		language: computed({
			get: () => props.meta ?? 'bash',
			set: (next: string) => {
				props.node.turnInto(kinds.code, {meta: next})
			},
		}),
	}),
	template: `
		<div :class="[theme.block, theme.codeBlock]">
			<select
				v-model="language"
				:class="[theme.codeLanguageLabel, rowStyles.codeLanguage]"
				:ref="setControlRef"
			>
				<option v-for="language in LANGUAGES" :key="language">{{ language }}</option>
			</select>
			<slot />
		</div>
	`,
})

/* ── lists ──────────────────────────────────────────────────────────────── */

const Bullet = defineComponent({
	name: 'NotionBullet',
	props: rowProps,
	setup: () => ({theme, setControlRef: useControlRef()}),
	template: `
		<div :class="[theme.block, theme.listItem]">
			<span :class="depth > 0 ? theme.listBulletHollow : theme.listBullet" :ref="setControlRef" />
			<slot /><slot name="rows" />
		</div>
	`,
})

const Numbered = defineComponent({
	name: 'NotionNumbered',
	props: rowProps,
	setup: () => ({theme, rowStyles, setControlRef: useControlRef()}),
	template: `
		<div :class="[theme.block, theme.listItem, rowStyles.numbered]">
			<span :class="rowStyles.ordinal" :ref="setControlRef" />
			<slot /><slot name="rows" />
		</div>
	`,
})

const Todo = defineComponent({
	name: 'NotionTodo',
	props: rowProps,
	setup: props => ({
		theme,
		rowStyles,
		done: computed(() => props.meta === 'x'),
		tick: (event: Event) => {
			const box = event.target
			if (box instanceof HTMLInputElement) props.node.turnInto(kinds.todo, {meta: box.checked ? 'x' : ' '})
		},
		setControlRef: useControlRef(),
	}),
	template: `
		<div :class="[theme.block, theme.listItem]">
			<input
				type="checkbox"
				:checked="done"
				:class="rowStyles.todoBox"
				:ref="setControlRef"
				@change="tick"
			/>
			<span :class="done ? rowStyles.todoDone : undefined"><slot /></span>
			<slot name="rows" />
		</div>
	`,
})

/**
 * THE COLLAPSED TOGGLE. Its children are ALWAYS painted and `hidden` is what closes them: a row
 * that is not painted has left the DOM layer and taken its anchors with it, so a toggle that
 * renders no children when closed is a caret defect.
 *
 * `hidden="until-found"` rather than plain `hidden`, because plain `hidden` loses three things a
 * user expects: find-in-page cannot see the closed text, the browser cannot scroll to it, and a
 * match cannot open the toggle. Neither the value nor the event reaches a template binding — Vue
 * renders `:hidden="'until-found'"` as a bare `hidden` — so both go straight onto the element.
 *
 * WHAT THAT COSTS, stated rather than argued: find-in-page landing inside a closed toggle now
 * EDITS the document, because opening the row is a retype.
 */
const toggleRow = (open: boolean) =>
	defineComponent({
		name: open ? 'NotionToggleOpen' : 'NotionToggle',
		props: rowProps,
		setup(props) {
			const reveal = () => props.node.turnInto(kinds.toggleOpen)
			let body: HTMLElement | null = null
			return {
				theme,
				open,
				flip: () => props.node.turnInto(open ? kinds.toggle : kinds.toggleOpen),
				setControlRef: useControlRef(),
				setBodyRef: (element: unknown) => {
					body?.removeEventListener('beforematch', reveal)
					body = element instanceof HTMLElement ? element : null
					if (!body || open) return
					body.setAttribute('hidden', 'until-found')
					body.addEventListener('beforematch', reveal)
				},
			}
		},
		template: `
			<div :class="[theme.block, theme.toggleRow]">
				<button
					:aria-expanded="open"
					:aria-label="open ? 'Collapse' : 'Expand'"
					:class="open ? theme.toggleArrowOpen : theme.toggleArrow"
					:ref="setControlRef"
					type="button"
					@click="flip()"
				/>
				<slot />
				<div :class="theme.toggleChildren" :ref="setBodyRef"><slot name="rows" /></div>
			</div>
		`,
	})

/* ── the inline database ────────────────────────────────────────────────── */

const Cell = defineComponent({
	name: 'NotionCell',
	props: rowProps,
	setup: () => ({rowStyles}),
	template: '<div :class="rowStyles.tableCell"><slot /></div>',
})

const HeaderCell = defineComponent({
	name: 'NotionHeaderCell',
	props: rowProps,
	setup: () => ({rowStyles}),
	template: '<div :class="[rowStyles.tableCell, rowStyles.tableHeadCell]"><slot /></div>',
})

const TableLine = defineComponent({
	name: 'NotionTableLine',
	props: rowProps,
	setup: () => ({rowStyles}),
	template: '<div :class="rowStyles.tableLine"><slot name="rows" /></div>',
})

const TableHeader = defineComponent({
	name: 'NotionTableHeader',
	props: rowProps,
	setup: () => ({rowStyles}),
	template: '<div :class="[rowStyles.tableLine, rowStyles.tableHeadLine]"><slot name="rows" /></div>',
})

const TableFooter = defineComponent({
	name: 'NotionTableFooter',
	props: rowProps,
	setup: props => ({
		theme,
		setControlRef: useControlRef(),
		addLine: () => props.node.turnInto(kinds.tableLine, {text: newTableLineText(props.node.slot())}),
	}),
	template: `
		<div :class="[theme.block, theme.tableFooter]">
			<button
				:class="theme.tableFooterAction"
				:ref="setControlRef"
				type="button"
				@click="addLine()"
			>+ New</button>
			<span :class="theme.tableFooterSummary"><slot /></span>
		</div>
	`,
})

/** The view bar above a database. Its active tab is view state and belongs to nobody else. */
const Views = defineComponent({
	name: 'NotionViews',
	components: {Atomic, ViewTabs},
	props: rowProps,
	setup(props) {
		const body = computed(() => props.node.slot())
		const active = ref(body.value.split('|')[0] ?? '')
		return {
			tabs: computed(() => body.value.split('|')),
			active,
			select: (tab: string) => {
				active.value = tab
			},
		}
	},
	template: `
		<div>
			<Atomic><ViewTabs :active="active" :tabs="tabs" @select="select" /></Atomic>
		</div>
	`,
})

/* ── the board, metrics, bookmark, comments ─────────────────────────────── */

const BoardRow = defineComponent({
	name: 'NotionBoard',
	components: {Atomic, Board},
	props: rowProps,
	setup: props => {
		const body = computed(() => props.node.slot())
		return {
			columns: computed(() => readBoard(body.value)),
			move: (next: readonly BoardColumnData[]) => props.node.turnInto(kinds.board, {text: writeBoard(next)}),
		}
	},
	template: '<div><Atomic><Board :columns="columns" @move="move" /></Atomic></div>',
})

const Metrics = defineComponent({
	name: 'NotionMetrics',
	components: {Atomic, CardGrid, MetricCard},
	props: rowProps,
	setup: props => {
		const body = computed(() => props.node.slot())
		return {metrics: computed(() => readMetrics(body.value))}
	},
	template: `
		<div>
			<Atomic>
				<CardGrid>
					<MetricCard
						v-for="metric in metrics"
						:key="metric.label"
						:label="metric.label"
						:value="metric.value"
					/>
				</CardGrid>
			</Atomic>
		</div>
	`,
})

const Bookmark = defineComponent({
	name: 'NotionBookmark',
	components: {Atomic, BookmarkCard},
	props: rowProps,
	setup: props => {
		const body = computed(() => props.node.slot())
		return {body, card: computed(() => readBookmark(props.meta ?? ''))}
	},
	template: `
		<div>
			<Atomic>
				<BookmarkCard :description="card.description" :title="body" :url="card.url" />
			</Atomic>
		</div>
	`,
})

const Comments = defineComponent({
	name: 'NotionComments',
	components: {Atomic, CommentThread},
	props: rowProps,
	setup: props => {
		const body = computed(() => props.node.slot())
		return {comments: computed(() => readComments(body.value))}
	},
	template: '<div><Atomic><CommentThread :comments="comments" /></Atomic></div>',
})

/* ── the paragraph, which is the row with NO kind ───────────────────────── */

/**
 * `slots.paragraph` is the row with no kind and the only fallback left. It carries the
 * placeholder as an attribute the theme reads, and CSS decides when to show it: an empty row is
 * one whose only surface holds no text, which no component can be told.
 */
export const Paragraph = defineComponent({
	name: 'NotionParagraph',
	setup: () => ({theme, rowStyles}),
	template: `
		<div :class="[theme.block, theme.paragraph, rowStyles.paragraph]" data-placeholder="Type / for commands…">
			<slot />
		</div>
	`,
})

/* ── the vocabulary, wired to the paint above ───────────────────────────── */

// The two type arguments are given rather than inferred: each `defineComponent` above has its own
// setup return, so an inferred `TRow` would be the FIRST kind's exact type and every other kind
// would fail against it.
const {kinds, options} = assembleNotion<Component, Component>(
	{
		title: Title,
		caption: Caption,
		properties: Properties,
		divider: Divider,
		toc: Toc,
		h1: heading(theme.heading1),
		h2: heading(theme.heading2),
		h3: heading(theme.heading3),
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