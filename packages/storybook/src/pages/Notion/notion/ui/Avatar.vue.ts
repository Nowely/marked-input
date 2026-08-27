import {computed, defineComponent} from 'vue'

import type {ChipTone} from '../vocabulary'
import {CHIP_TONES} from '../vocabulary'

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

const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.filter(part => part.length > 0)
		.slice(0, 2)
		.map(part => part.charAt(0).toUpperCase())
		.join('')

/**
 * Same name, same colour, on every page and in any order — a sum over the code units, not a
 * counter, so a stack rendered twice does not recolour itself.
 */
const toneOf = (name: string): ChipTone => {
	let hash = 0
	for (let index = 0; index < name.length; index += 1) {
		hash = (hash * 31 + name.charCodeAt(index)) % 1000003
	}
	return CHIP_TONES[hash % CHIP_TONES.length]
}

/** The initials circle. `title` rather than `aria-label`: a bare `span` exposes no name to read it. */
export const Avatar = defineComponent({
	name: 'Avatar',
	props: {name: {type: String, required: true}, className: {type: String, default: undefined}},
	setup(props) {
		const toneClass = computed(() => TONE_CLASS[toneOf(props.name)])
		return {
			classes: computed(() => (props.className ? `${toneClass.value} ${props.className}` : toneClass.value)),
			initials: computed(() => initialsOf(props.name)),
		}
	},
	template: '<span :class="classes" :title="name">{{ initials }}</span>',
})