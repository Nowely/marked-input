import {computed, defineComponent} from 'vue'

import type {ChipTone} from '../vocabulary'
import {avatarTone, initialsOf} from '../vocabulary'

import styles from '../theme/notion.module.css'

export interface AvatarProps {
	name: string
	/** For a parent that owns the avatar's placement — the comment grid spans its avatar two rows. */
	className?: string
}

const TONE_CLASS: Record<ChipTone, string> = {
	grey: styles.avatarGrey,
	red: styles.avatarRed,
	amber: styles.avatarAmber,
	green: styles.avatarGreen,
	blue: styles.avatarBlue,
	purple: styles.avatarPurple,
}

/** The initials circle. `title` rather than `aria-label`: a bare `span` exposes no name to read it. */
export const Avatar = defineComponent({
	name: 'Avatar',
	props: {name: {type: String, required: true}, className: {type: String, default: undefined}},
	setup(props) {
		const toneClass = computed(() => TONE_CLASS[avatarTone(props.name)])
		return {
			classes: computed(() => (props.className ? `${toneClass.value} ${props.className}` : toneClass.value)),
			initials: computed(() => initialsOf(props.name)),
		}
	},
	template: '<span :class="classes" :title="name">{{ initials }}</span>',
})