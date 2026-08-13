import type {CSSProperties} from 'vue'
import {defineComponent} from 'vue'

/**
 * The vue twin of `Tabs.tsx`. The element structure is identical on purpose — one `<div>` of
 * one `<button>` per tab — because both frameworks render the same stories and their HTML
 * snapshots have to be comparable. The inline styles only have to look the same, not read the
 * same: `snapshotHtml` strips `style` and `class` before comparing.
 *
 * A `template:` string rather than an SFC, like every other shared vue component here:
 * `vue-tsc` with `strictTemplates` refuses attributes it cannot type on a native element, and
 * a `.vue.ts` module keeps the seam file next to its react sibling.
 *
 * `Tab` is declared here rather than imported from `Tabs.tsx`: under `moduleSuffixes` /
 * `resolve.extensions` this file IS `./Tabs` for the vue program, so importing the name would
 * import itself.
 */

export interface Tab {
	value: string
	label: string
}

const tabsContainerStyle: CSSProperties = {
	display: 'flex',
	gap: '8px',
	borderBottom: '1px solid #e0e0e0',
	marginBottom: '16px',
}

const tabButtonStyle = (isActive: boolean): CSSProperties => ({
	padding: '8px 16px',
	border: 'none',
	backgroundColor: 'transparent',
	cursor: 'pointer',
	fontSize: '14px',
	fontWeight: 500,
	color: isActive ? '#000' : '#666',
	borderBottom: isActive ? '2px solid #2196f3' : 'none',
	marginBottom: '-1px',
	transition: 'all 0.2s',
})

export const Tabs = defineComponent({
	props: {
		tabs: {type: Array, required: true},
		activeTabId: {type: String, required: true},
		onChange: {type: Function, required: true},
	},
	setup: () => ({tabsContainerStyle, tabButtonStyle}),
	template: `
		<div :style="tabsContainerStyle">
			<button
				v-for="tab in tabs"
				:key="tab.value"
				:style="tabButtonStyle(activeTabId === tab.value)"
				@click="onChange(tab.value)"
			>{{ tab.label }}</button>
		</div>
	`,
})