import type {Meta, StoryObj} from '@storybook/react-vite'
import type {ReactNode} from 'react'
import {useState} from 'react'

import {
	Avatar,
	AvatarStack,
	Board,
	type BoardColumnData,
	BookmarkCard,
	Callout,
	CardGrid,
	Chip,
	CommentThread,
	CoverBand,
	EffortBar,
	MetricCard,
	NOTION_THEME,
	PageChrome,
	PropertiesPanel,
	theme as styles,
	ViewTabs,
} from './notion'

/**
 * The showcase's consumer components on their own (`docs/scratch/notion-like/showcase.md`, final
 * section). Each one is a plain-props leaf: no markput import, no editor state. This page is where
 * they are judged as pixels, before a row component drops them into the document.
 */

/** Story scaffolding only. Layout, never colour — the colours all come from the theme module. */
const Row = ({children}: {children: ReactNode}) => (
	<div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center'}}>{children}</div>
)

const Section = ({title, children}: {title: string; children: ReactNode}) => (
	<section>
		<div className={styles.heading3}>{title}</div>
		{children}
	</section>
)

/**
 * The arrangement has to live somewhere for a drag to be worth performing, and the board no
 * longer holds it: in the document it is the row's own body, and here it is the story. Same
 * contract either way — the board announces the next arrangement and paints the one it is given.
 */
const BOARD_COLUMNS: BoardColumnData[] = [
	{
		id: 'todo',
		title: 'To do',
		cards: [
			{id: 'sla', title: 'Sign the vendor SLA', tag: {label: 'Legal', tone: 'red'}},
			{id: 'quota', title: 'EU region quota', tag: {label: 'Infra', tone: 'blue'}},
			{id: 'copy', title: 'Launch copy review'},
		],
	},
	{
		id: 'doing',
		title: 'In progress',
		cards: [
			{id: 'auth', title: 'Auth migration', tag: {label: 'Platform', tone: 'purple'}},
			{id: 'perf', title: 'p95 latency budget', tag: {label: 'Perf', tone: 'amber'}},
		],
	},
	{
		id: 'shipped',
		title: 'Shipped',
		cards: [{id: 'beta', title: 'Beta invites', tag: {label: 'Growth', tone: 'green'}}],
	},
]

const BoardDemo = () => {
	const [columns, setColumns] = useState<readonly BoardColumnData[]>(BOARD_COLUMNS)
	return <Board columns={columns} onMove={setColumns} />
}

/** `active` has to live somewhere for the bar to be worth clicking; here that is the story. */
const ViewTabsDemo = () => {
	const [active, setActive] = useState('Table')
	return <ViewTabs active={active} onSelect={setActive} tabs={['Table', 'Board', 'Timeline', 'Calendar']} />
}

const TEAM = ['Kara Vance', 'Ines Duarte', 'Milo Freeman', 'Priya Raman', 'Tomas Alvarez', 'Wen Li']

export default {
	title: 'Notion/UI kit',
	parameters: {
		docs: {
			description: {
				component:
					'The consumer components of the Notion showcase, each in isolation on the dark theme. ' +
					'Purely presentational: plain props in, theme classes out.',
			},
		},
	},
	decorators: [
		Story => (
			<div className={`${NOTION_THEME} ${styles.page}`} style={{minHeight: '100vh'}}>
				<div className={styles.column} style={{paddingTop: '24px'}}>
					<Story />
				</div>
			</div>
		),
	],
} satisfies Meta

/** Every tone, and the default (grey) reached by omitting the prop. */
export const Chips: StoryObj = {
	render: () => (
		<Section title="Chip">
			<Row>
				<Chip>Plain</Chip>
				<Chip tone="grey">Planned</Chip>
				<Chip tone="red">Blocked</Chip>
				<Chip tone="amber">In progress</Chip>
				<Chip tone="green">Done</Chip>
				<Chip tone="blue">Platform</Chip>
				<Chip tone="purple">Design</Chip>
			</Row>
		</Section>
	),
}

/** Initials from the name, colour from the name, and the stack's overflow spelled out. */
export const Avatars: StoryObj = {
	render: () => (
		<Section title="Avatar / AvatarStack">
			<Row>
				{TEAM.map(name => (
					<Avatar key={name} name={name} />
				))}
			</Row>
			<Row>
				<AvatarStack max={2} names={TEAM} />
				<AvatarStack names={TEAM.slice(0, 3)} />
			</Row>
		</Section>
	),
}

export const Effort: StoryObj = {
	render: () => (
		<Section title="EffortBar">
			<Row>
				<EffortBar label="Effort, not started" value={0} />
				<EffortBar label="Effort, a third" value={0.33} />
				<EffortBar label="Effort, most" value={0.82} />
				<EffortBar label="Effort, complete" value={1} />
				<EffortBar label="Effort, clamped" value={4} />
			</Row>
		</Section>
	),
}

export const Metrics: StoryObj = {
	render: () => (
		<Section title="MetricCard / CardGrid">
			<CardGrid>
				<MetricCard label="Beta users" value="4,120" />
				<MetricCard label="p95 latency" value="184ms" />
				<MetricCard label="Crash-free" value="99.4%" />
				<MetricCard label="Open bugs" value="37" />
			</CardGrid>
		</Section>
	),
}

export const Callouts: StoryObj = {
	render: () => (
		<Section title="Callout">
			<Callout icon="💡">Neutral: the default wash, for a note with no urgency.</Callout>
			<Callout icon="ℹ️" tone="info">
				Info: the auth migration lands on the 14th.
			</Callout>
			<Callout icon="✅" tone="success">
				Success: beta sign-off received from both regions.
			</Callout>
			<Callout icon="⚠️" tone="warning">
				Warning: launch gating on the auth migration.
			</Callout>
			<Callout icon="🚨" tone="danger">
				Danger: the vendor SLA is still unsigned.
			</Callout>
		</Section>
	),
}

export const Bookmark: StoryObj = {
	render: () => (
		<Section title="BookmarkCard">
			<BookmarkCard
				description="How the auth migration changes token lifetimes, and what breaks if it slips past the launch date."
				title="Auth migration — rollout plan"
				url="https://example.com/apollo/auth-migration"
			/>
		</Section>
	),
}

export const Comments: StoryObj = {
	render: () => (
		<Section title="CommentThread">
			<CommentThread
				comments={[
					{author: 'Kara Vance', timestamp: '2h ago', body: 'Can we confirm the EU quota before Friday?'},
					{
						author: 'Milo Freeman',
						timestamp: '41m ago',
						body: 'Asked the vendor this morning — expecting an answer tomorrow.',
					},
				]}
			/>
		</Section>
	),
}

/** Drag a card from one column to another: the drag is HTML5, and it lives inside the board. */
export const SprintBoard: StoryObj = {
	render: () => (
		<Section title="Board / BoardColumn / BoardCard">
			<BoardDemo />
		</Section>
	),
}

export const Tabs: StoryObj = {
	render: () => (
		<Section title="ViewTabs">
			<ViewTabsDemo />
		</Section>
	),
}

/** A value is a node, which is the whole point: chips and avatars are passed in, not described. */
export const Properties: StoryObj = {
	render: () => (
		<Section title="PropertiesPanel">
			<PropertiesPanel
				properties={[
					{name: 'Status', value: <Chip tone="amber">In progress</Chip>},
					{
						name: 'Owner',
						value: (
							<>
								<Avatar name="Kara Vance" />
								Kara Vance
							</>
						),
					},
					{name: 'Team', value: <AvatarStack max={2} names={TEAM} />},
					{name: 'Timeline', value: 'Apr 8 → Jun 30'},
					{
						name: 'Tags',
						value: (
							<>
								<Chip tone="blue">Platform</Chip>
								<Chip tone="purple">Design</Chip>
								<Chip>Q2</Chip>
							</>
						),
					},
					{
						name: 'Spec',
						value: (
							<a className={styles.link} href="https://example.com/apollo/spec">
								apollo/spec
							</a>
						),
					},
					{name: 'Confidence', value: '82%'},
				]}
			/>
		</Section>
	),
}

export const Chrome: StoryObj = {
	render: () => (
		<Section title="PageChrome / CoverBand">
			<PageChrome breadcrumb={['Product', 'Launches', 'Apollo']} editedLabel="Edited 14m ago" />
			<CoverBand icon="🚀" />
			<div className={styles.title}>Apollo — Q2 launch plan</div>
		</Section>
	),
}