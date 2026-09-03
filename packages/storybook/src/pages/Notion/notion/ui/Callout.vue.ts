import {computed, defineComponent} from 'vue'

import type {CalloutTone} from '../vocabulary'
import {calloutTone} from '../vocabulary'

import styles from '../theme/notion.module.css'

export type {CalloutTone}

export interface CalloutProps {
	/** A tone. A name outside the set is drawn neutral rather than dropping the row. */
	tone?: string
}

const TONE_CLASS: Record<CalloutTone, string> = {
	neutral: styles.callout,
	info: styles.calloutInfo,
	success: styles.calloutSuccess,
	warning: styles.calloutWarning,
	danger: styles.calloutDanger,
}

/**
 * A tinted wash with an icon on the left. The icon is not hidden from readers: in a warning it
 * carries the warning.
 *
 * The icon arrives as a SLOT where React takes a node prop — the one shape difference between the
 * two paints, because a rendered node is a slot in Vue.
 */
export const Callout = defineComponent({
	name: 'Callout',
	props: {tone: {type: String, default: 'neutral'}},
	setup: props => ({styles, toneClass: computed(() => TONE_CLASS[calloutTone(props.tone)])}),
	template: `
		<div :class="toneClass">
			<span v-if="$slots.icon" :class="styles.calloutIcon"><slot name="icon" /></span>
			<div :class="styles.calloutBody"><slot /></div>
		</div>
	`,
})