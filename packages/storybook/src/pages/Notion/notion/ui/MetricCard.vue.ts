import {defineComponent} from 'vue'

import styles from '../theme/notion.module.css'

export interface MetricCardProps {
	label: string
	/** Pre-formatted — "4,120", "184ms", "99.4%". The card does no arithmetic. */
	value: string
}

/** A muted label above one large number. */
export const MetricCard = defineComponent({
	name: 'MetricCard',
	props: {label: {type: String, required: true}, value: {type: String, required: true}},
	setup: () => ({styles}),
	template: `
		<div :class="styles.metricCard">
			<span :class="styles.metricLabel">{{ label }}</span>
			<span :class="styles.metricValue">{{ value }}</span>
		</div>
	`,
})