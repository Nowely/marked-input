import {computed, defineComponent} from 'vue'

import {Avatar} from './Avatar'

import styles from '../theme/notion.module.css'

export interface AvatarStackProps {
	names: readonly string[]
	/** How many circles to draw. Whoever is left over becomes the "+N others" tail. */
	max?: number
}

/** Overlapping initials circles, with the overflow spelled out rather than drawn. */
export const AvatarStack = defineComponent({
	name: 'AvatarStack',
	components: {Avatar},
	props: {
		names: {type: Array as () => readonly string[], required: true},
		max: {type: Number, default: undefined},
	},
	setup(props) {
		const shown = computed(() => props.names.slice(0, props.max ?? props.names.length))
		return {styles, shown, others: computed(() => props.names.length - shown.value.length)}
	},
	template: `
		<span :class="styles.avatarStack">
			<Avatar v-for="name in shown" :key="name" :name="name" />
			<span v-if="others > 0" :class="styles.avatarStackTail">+{{ others }} others</span>
		</span>
	`,
})