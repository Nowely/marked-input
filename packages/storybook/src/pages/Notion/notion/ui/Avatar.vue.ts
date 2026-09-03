import {computed, defineComponent} from 'vue'

import type {ChipTone} from '../vocabulary'
import {avatarTone, initialsOf} from '../vocabulary'

import styles from '../theme/notion.module.css'

export interface AvatarProps {
	name: string
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
	// NO `className` PROP, unlike React's twin: a parent that owns this avatar's placement — the
	// comment grid spans its avatar two rows — writes an ordinary `class`, which Vue merges onto the
	// root after this component's own. Declaring one is a second implementation of the merge the
	// framework already does, and is the workaround `268feab1` deprecated.
	props: {name: {type: String, required: true}},
	setup: props => ({
		toneClass: computed(() => TONE_CLASS[avatarTone(props.name)]),
		initials: computed(() => initialsOf(props.name)),
	}),
	template: '<span :class="toneClass" :title="name">{{ initials }}</span>',
})