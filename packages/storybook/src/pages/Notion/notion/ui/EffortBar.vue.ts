import {computed, defineComponent} from 'vue'

import styles from '../theme/notion.module.css'

export interface EffortBarProps {
	/** A fraction, 0..1. Anything outside is clamped rather than refused. */
	value: number
	/** Hover text. The bar reads as a picture of the number, so the number is spelled out here. */
	label?: string
}

/**
 * A filled track: two elements, because the theme's fill is a box whose WIDTH the component sets
 * (`.effortBarFill`) — a value, not a colour, and the one thing set inline here.
 *
 * No `role="progressbar"`: the lint rule sends that role to a native `<progress>`, and `<progress>`
 * is a replaced element the theme's track/fill pair cannot dress.
 */
export const EffortBar = defineComponent({
	name: 'EffortBar',
	props: {value: {type: Number, required: true}, label: {type: String, default: undefined}},
	setup(props) {
		const fraction = computed(() => Math.min(1, Math.max(0, props.value)))
		return {styles, width: computed(() => `${(fraction.value * 100).toFixed(1)}%`)}
	},
	template: `
		<span :class="styles.effortBar" :title="label">
			<span :class="styles.effortBarFill" :style="{width}" />
		</span>
	`,
})