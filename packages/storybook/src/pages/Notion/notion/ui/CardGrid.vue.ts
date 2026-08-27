import {defineComponent} from 'vue'

import styles from '../theme/notion.module.css'

/** The responsive row of cards: as many columns as fit, then it wraps. */
export const CardGrid = defineComponent({
	name: 'CardGrid',
	setup: () => ({styles}),
	template: '<div :class="styles.cardGrid"><slot /></div>',
})

/** It takes only its default slot, where React's twin takes `children`. */
export type CardGridProps = Record<string, never>