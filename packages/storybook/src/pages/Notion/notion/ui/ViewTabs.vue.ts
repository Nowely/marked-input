import {defineComponent} from 'vue'

import styles from '../theme/notion.module.css'

export interface ViewTabsProps {
	tabs: readonly string[]
	active: string
	actions?: readonly string[]
}

const DEFAULT_ACTIONS: readonly string[] = ['Filter', 'Sort', 'New']

/**
 * The inline database's view bar. `role=tablist` sits on the tabs alone, not on the bar: Filter,
 * Sort and New are commands, and calling them tabs would be a claim the widget does not honour.
 */
export const ViewTabs = defineComponent({
	name: 'ViewTabs',
	props: {
		tabs: {type: Array as () => readonly string[], required: true},
		active: {type: String, required: true},
		actions: {type: Array as () => readonly string[], default: () => DEFAULT_ACTIONS},
	},
	emits: ['select', 'action'],
	setup: () => ({styles}),
	template: `
		<div :class="styles.viewTabBar">
			<div :class="styles.viewTabList" role="tablist">
				<button
					v-for="tab in tabs"
					:key="tab"
					:aria-selected="tab === active"
					:class="tab === active ? styles.viewTabActive : styles.viewTab"
					role="tab"
					type="button"
					@click="$emit('select', tab)"
				>{{ tab }}</button>
			</div>
			<div :class="styles.viewTabActions">
				<button
					v-for="action in actions"
					:key="action"
					:class="styles.viewTabAction"
					type="button"
					@click="$emit('action', action)"
				>{{ action }}</button>
			</div>
		</div>
	`,
})