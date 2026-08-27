import {defineComponent} from 'vue'

import styles from '../theme/notion.module.css'

export interface CoverBandProps {
	/** The page emoji. It overlaps the band's lower edge by half its box. */
	icon: string
}

/**
 * Two siblings, not a wrapper: the band wants the page's full width and the emoji wants the
 * content column's left edge, and only the parent knows where those are. The overlap is a
 * negative margin, so the pair works in whatever box the caller puts them in.
 */
export const CoverBand = defineComponent({
	name: 'CoverBand',
	inheritAttrs: false,
	props: {icon: {type: String, required: true}},
	setup: () => ({styles}),
	template: `
		<div :class="styles.coverBand" />
		<div :class="styles.coverIcon">{{ icon }}</div>
	`,
})